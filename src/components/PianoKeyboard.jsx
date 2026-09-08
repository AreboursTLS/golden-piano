import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Volume2, VolumeX, Play, Square, Music, Loader2 } from 'lucide-react';

/* ──────────────── NOTES ──────────────── */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_PC = new Set([1, 3, 6, 8, 10]);
// Léger décalage des touches noires, comme sur un vrai clavier (C#/F# à gauche, D#/A# à droite)
const BLACK_OFFSET = { 1: -0.1, 3: 0.1, 6: -0.12, 8: 0, 10: 0.12 };

function toMidi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (parseInt(m[3], 10) + 1) * 12 + base + acc;
}
const toName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

/* ──────────────── SAMPLER (Salamander Grand Piano, CC BY 3.0) ──────────────── */

const SAMPLE_BASE = '/audio/piano/';
const SAMPLE_NAMES = [
  'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4',
  'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7',
];
const SAMPLE_MIDI = SAMPLE_NAMES.map((n) => toMidi(n.replace('s', '#')));

function makeImpulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

class PianoSampler {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.voices = new Map(); // midi -> voice (jeu manuel)
    this.scheduled = [];     // voix planifiées (lecture d'un morceau)
    this.held = new Set();
    this.sustain = false;
    this.ready = false;
    this.loading = null;
  }

  init() {
    if (this.ctx) return this.ctx;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.volume = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    const wet = ctx.createGain();
    wet.gain.value = 0.2;
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 2.4, 3);
    this.master.connect(comp);
    this.master.connect(reverb);
    reverb.connect(wet);
    wet.connect(comp);
    comp.connect(this.volume);
    this.volume.connect(ctx.destination);
    return ctx;
  }

  load() {
    if (this.loading) return this.loading;
    const ctx = this.init();
    this.loading = Promise.all(
      SAMPLE_NAMES.map(async (n, i) => {
        const res = await fetch(`${SAMPLE_BASE}${n}.mp3`);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(SAMPLE_MIDI[i], buf);
      })
    ).then(() => { this.ready = true; });
    return this.loading;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    if (this.volume) this.volume.gain.value = muted ? 0 : 1;
  }

  _voice(midi, velocity, t) {
    let best = SAMPLE_MIDI[0];
    for (const s of SAMPLE_MIDI) if (Math.abs(s - midi) < Math.abs(best - midi)) best = s;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.get(best);
    src.playbackRate.value = Math.pow(2, (midi - best) / 12);
    const g = this.ctx.createGain();
    const level = Math.pow(Math.min(1, Math.max(0.05, velocity)), 1.6);
    g.gain.setValueAtTime(level, t);
    src.connect(g);
    g.connect(this.master);
    src.start(t);
    return { src, g, level };
  }

  _release(v, t, time) {
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(v.level, t);
    v.g.gain.exponentialRampToValueAtTime(0.0005, t + time);
    v.src.stop(t + time + 0.05);
  }

  // Jeu manuel
  noteOn(midi, velocity = 0.7) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const prev = this.voices.get(midi);
    if (prev) this._release(prev, t, 0.06);
    const v = this._voice(midi, velocity, t);
    this.voices.set(midi, v);
    this.held.add(midi);
    v.src.onended = () => { if (this.voices.get(midi) === v) this.voices.delete(midi); };
  }

  noteOff(midi) {
    this.held.delete(midi);
    if (this.sustain) return;
    const v = this.voices.get(midi);
    if (!v) return;
    this._release(v, this.ctx.currentTime, 0.45);
    this.voices.delete(midi);
  }

  setSustain(on) {
    this.sustain = on;
    if (on || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [m, v] of this.voices) {
      if (!this.held.has(m)) { this._release(v, t, 0.45); this.voices.delete(m); }
    }
  }

  // Lecture planifiée d'un morceau
  schedule(midi, velocity, t, duration) {
    if (!this.ready) return;
    const v = this._voice(midi, velocity, t);
    this._release(v, t + duration, 0.5);
    this.scheduled.push(v);
  }

  stopScheduled() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const v of this.scheduled) {
      try {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setValueAtTime(v.g.gain.value, t);
        v.g.gain.exponentialRampToValueAtTime(0.0005, t + 0.25);
        v.src.stop(t + 0.3);
      } catch { /* déjà terminée */ }
    }
    this.scheduled = [];
  }
}

/* ──────────────── MORCEAU : J.-S. Bach, Prélude n°1 en do majeur (BWV 846) ──────────────── */

const BACH_MEASURES = [
  ['C4', 'E4', 'G4', 'C5', 'E5'], ['C4', 'D4', 'A4', 'D5', 'F5'], ['B3', 'D4', 'G4', 'D5', 'F5'], ['C4', 'E4', 'G4', 'C5', 'E5'],
  ['C4', 'E4', 'A4', 'E5', 'A5'], ['C4', 'D4', 'F#4', 'A4', 'D5'], ['B3', 'D4', 'G4', 'D5', 'G5'], ['B3', 'C4', 'E4', 'G4', 'C5'],
  ['A3', 'C4', 'E4', 'G4', 'C5'], ['D3', 'A3', 'D4', 'F#4', 'C5'], ['G3', 'B3', 'D4', 'G4', 'B4'], ['G3', 'Bb3', 'E4', 'G4', 'C#5'],
  ['F3', 'A3', 'D4', 'A4', 'D5'], ['F3', 'Ab3', 'D4', 'F4', 'B4'], ['E3', 'G3', 'C4', 'G4', 'C5'], ['E3', 'F3', 'A3', 'C4', 'F4'],
  ['D3', 'F3', 'A3', 'C4', 'F4'], ['G2', 'D3', 'G3', 'B3', 'F4'], ['C3', 'E3', 'G3', 'C4', 'E4'], ['C3', 'G3', 'Bb3', 'C4', 'E4'],
  ['F2', 'F3', 'A3', 'C4', 'E4'], ['F#2', 'C3', 'A3', 'C4', 'Eb4'], ['Ab2', 'F3', 'B3', 'C4', 'D4'], ['G2', 'F3', 'G3', 'B3', 'D4'],
  ['G2', 'E3', 'G3', 'C4', 'E4'], ['G2', 'D3', 'G3', 'C4', 'F4'], ['G2', 'D3', 'G3', 'B3', 'F4'], ['G2', 'Eb3', 'A3', 'C4', 'F#4'],
  ['G2', 'E3', 'G3', 'C4', 'G4'], ['G2', 'D3', 'G3', 'C4', 'F4'], ['G2', 'D3', 'G3', 'B3', 'F4'], ['C2', 'C3', 'G3', 'Bb3', 'E4'],
];

function buildPrelude() {
  const S = 0.235; // durée d'une double-croche (≈ 64 à la noire)
  const notes = [];
  let t = 0;
  const add = (name, at, dur, vel) => notes.push({ midi: toMidi(name), time: at, duration: dur, velocity: vel });

  BACH_MEASURES.forEach((m, mi) => {
    const swell = mi >= 19 && mi <= 24 ? 0.1 : mi >= 28 ? -0.06 : 0;
    for (let half = 0; half < 2; half++) {
      const t0 = t + half * 8 * S;
      add(m[0], t0, 8 * S, 0.62 + swell);
      add(m[1], t0 + S, 7 * S, 0.52 + swell);
      [2, 3, 4, 2, 3, 4].forEach((k, i) => {
        add(m[k], t0 + (i + 2) * S, 2.2 * S, 0.5 + (i === 0 ? 0.06 : 0) + swell + (Math.random() - 0.5) * 0.04);
      });
    }
    t += 16 * S;
  });

  // Mesures 33 et 34 : figures particulières
  add('C2', t, 16 * S, 0.64);
  add('C3', t + S, 15 * S, 0.52);
  ['F3', 'A3', 'C4', 'F4', 'C4', 'A3', 'C4', 'A3', 'F3', 'A3', 'F3', 'D3', 'F3', 'D3']
    .forEach((n, i) => add(n, t + (i + 2) * S, 2.2 * S, 0.5));
  t += 16 * S;
  add('C2', t, 16 * S, 0.64);
  add('B2', t + S, 15 * S, 0.52);
  ['G4', 'B4', 'D5', 'F5', 'D5', 'B4', 'D5', 'B4', 'G3', 'B3', 'D4', 'F4', 'E4', 'D4']
    .forEach((n, i) => add(n, t + (i + 2) * S, 2.2 * S, 0.52));
  t += 16 * S;

  // Accord final
  ['C2', 'C3', 'E4', 'G4', 'C5'].forEach((n) => add(n, t, 18 * S, 0.62));
  return { title: 'Bach — Prélude en do majeur', notes, duration: t + 18 * S + 1.5 };
}

const PIECE = buildPrelude();

/* ──────────────── CLAVIER D'ORDINATEUR (positions physiques, e.code) ──────────────── */

const CODE_MAP = {
  KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63, KeyD: 64, KeyF: 65, KeyT: 66, KeyG: 67,
  KeyY: 68, KeyH: 69, KeyU: 70, KeyJ: 71, KeyK: 72, KeyO: 73, KeyL: 74, KeyP: 75,
  Semicolon: 76, Quote: 77,
};
const DEFAULT_LABELS = { Semicolon: ';', Quote: "'" };
function defaultLabels() {
  const labels = {};
  for (const code of Object.keys(CODE_MAP)) labels[code] = DEFAULT_LABELS[code] || code.replace('Key', '');
  return labels;
}

/* ──────────────── DISPOSITION ──────────────── */

const RANGES = [[36, 84], [48, 84]]; // C2→C6, C3→C6
const MIN_WHITE = 38;

function countWhites([lo, hi]) {
  let n = 0;
  for (let m = lo; m <= hi; m++) if (!BLACK_PC.has(m % 12)) n++;
  return n;
}

function computeLayout(width) {
  for (const r of RANGES) {
    const n = countWhites(r);
    const w = Math.floor(width / n);
    if (w >= MIN_WHITE) {
      const ww = Math.min(w, 52);
      const h = Math.round(Math.min(230, Math.max(140, ww * 5.2)));
      return { range: r, W: ww, H: h, kbWidth: ww * n, scrollable: false };
    }
  }
  const r = RANGES[RANGES.length - 1];
  const n = countWhites(r);
  return { range: r, W: MIN_WHITE, H: 170, kbWidth: MIN_WHITE * n, scrollable: true };
}

function buildKeys([lo, hi], W, H) {
  const keys = [];
  let whiteIdx = 0;
  for (let m = lo; m <= hi; m++) {
    const pc = m % 12;
    if (BLACK_PC.has(pc)) {
      const bw = W * 0.58;
      keys.push({ midi: m, black: true, left: whiteIdx * W - bw / 2 + BLACK_OFFSET[pc] * W, width: bw, height: H * 0.62 });
    } else {
      keys.push({ midi: m, black: false, left: whiteIdx * W, width: W, height: H, whiteIdx });
      whiteIdx++;
    }
  }
  return keys;
}

/* ──────────────── COMPOSANT ──────────────── */

const sampler = new PianoSampler();

export default function PianoKeyboard() {
  const [muted, setMuted] = useState(false);
  const [sustain, setSustain] = useState(false);
  const [loadingSounds, setLoadingSounds] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [userActive, setUserActive] = useState(() => new Set());
  const [playActive, setPlayActive] = useState(() => new Set());
  const [layout, setLayout] = useState({ width: 0 });
  const [keyLabels, setKeyLabels] = useState(defaultLabels);
  const [visible, setVisible] = useState(false);

  const sectionRef = useRef(null);
  const scrollRef = useRef(null);
  const startRef = useRef(0);
  const rafRef = useRef(null);
  const pointerDownRef = useRef(false);
  const pointerKeysRef = useRef(new Set());
  const codeDownRef = useRef(new Set());

  /* Mesure de la largeur disponible */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLayout({ width: e.contentRect.width }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Chargement des sons dès que la section approche */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting && !sampler.loading) {
        setLoadingSounds(true);
        sampler.load().then(() => setLoadingSounds(false));
      }
    }, { threshold: 0.15, rootMargin: '200px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* Étiquettes des touches du clavier d'ordinateur (AZERTY / QWERTY) */
  useEffect(() => {
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard.getLayoutMap().then((map) => {
        const labels = { ...defaultLabels() };
        for (const code of Object.keys(CODE_MAP)) {
          const v = map.get(code);
          if (v) labels[code] = v.toUpperCase();
        }
        setKeyLabels(labels);
      }).catch(() => {});
    }
  }, []);

  /* Disposition du clavier */
  const { range, W, H, kbWidth, scrollable } = useMemo(() => computeLayout(layout.width), [layout.width]);

  const keys = useMemo(() => buildKeys(range, W, H), [range, W, H]);

  /* Sur mobile, centrer le clavier sur le do central */
  useEffect(() => {
    if (!scrollable || !scrollRef.current) return;
    const el = scrollRef.current;
    const c4 = keys.find((k) => k.midi === 60);
    if (c4) el.scrollLeft = Math.max(0, c4.left - el.clientWidth / 2 + W * 3);
  }, [scrollable, keys, W]);

  useEffect(() => { sampler.setMuted(muted); }, [muted]);
  useEffect(() => { sampler.setSustain(sustain); }, [sustain]);

  /* Jeu manuel */
  const pressKey = useCallback((midi, velocity = 0.75) => {
    sampler.resume();
    sampler.noteOn(midi, velocity);
    setUserActive((prev) => { const n = new Set(prev); n.add(midi); return n; });
  }, []);

  const releaseKey = useCallback((midi) => {
    sampler.noteOff(midi);
    setUserActive((prev) => { if (!prev.has(midi)) return prev; const n = new Set(prev); n.delete(midi); return n; });
  }, []);

  /* Clavier d'ordinateur (seulement quand la section est visible) */
  useEffect(() => {
    if (!visible) return;
    const isTyping = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;
    const onDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
      const midi = CODE_MAP[e.code];
      if (!midi || codeDownRef.current.has(e.code)) return;
      e.preventDefault();
      codeDownRef.current.add(e.code);
      pressKey(midi, 0.7);
    };
    const onUp = (e) => {
      const midi = CODE_MAP[e.code];
      if (!midi) return;
      codeDownRef.current.delete(e.code);
      releaseKey(midi);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [visible, pressKey, releaseKey]);

  /* Souris / tactile */
  useEffect(() => {
    const up = () => {
      pointerDownRef.current = false;
      for (const m of pointerKeysRef.current) releaseKey(m);
      pointerKeysRef.current.clear();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [releaseKey]);

  const onKeyPointerDown = (midi) => (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    pointerDownRef.current = true;
    pointerKeysRef.current.add(midi);
    pressKey(midi);
  };
  const onKeyPointerEnter = (midi) => (e) => {
    if (e.pointerType !== 'mouse' || !pointerDownRef.current || !(e.buttons & 1)) return;
    pointerKeysRef.current.add(midi);
    pressKey(midi, 0.65);
  };
  const onKeyPointerLeave = (midi) => (e) => {
    if (e.pointerType !== 'mouse' || !pointerKeysRef.current.has(midi)) return;
    pointerKeysRef.current.delete(midi);
    releaseKey(midi);
  };

  /* Lecture du morceau */
  const stopPlayback = useCallback(() => {
    sampler.stopScheduled();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setIsPlaying(false);
    setPlayActive(new Set());
    setProgress(0);
  }, []);

  const startPlayback = useCallback(async () => {
    sampler.resume();
    if (!sampler.ready) {
      setLoadingSounds(true);
      await sampler.load();
      setLoadingSounds(false);
    }
    const ctx = sampler.ctx;
    const start = ctx.currentTime + 0.15;
    startRef.current = start;
    for (const n of PIECE.notes) sampler.schedule(n.midi, n.velocity, start + n.time, n.duration);
    setIsPlaying(true);

    let lastKey = '';
    const tick = () => {
      const t = ctx.currentTime - startRef.current;
      if (t >= PIECE.duration) { stopPlayback(); return; }
      const active = [];
      for (const n of PIECE.notes) {
        if (n.time <= t && t < n.time + Math.min(n.duration, 8)) active.push(n.midi);
      }
      const key = active.join(',');
      if (key !== lastKey) { lastKey = key; setPlayActive(new Set(active)); }
      setProgress(Math.max(0, t / PIECE.duration));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopPlayback]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); sampler.stopScheduled(); }, []);

  const togglePlay = () => (isPlaying ? stopPlayback() : startPlayback());

  const midiToCode = useMemo(() => {
    const m = {};
    for (const [code, midi] of Object.entries(CODE_MAP)) m[midi] = code;
    return m;
  }, []);

  const isActive = (midi) => userActive.has(midi) || playActive.has(midi);
  const showLabels = !scrollable && W >= 40;

  return (
    <section ref={sectionRef} className="relative py-24 md:py-32 bg-ink overflow-hidden">
      {/* Texture de fond */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 md:px-10">
        {/* En-tête */}
        <div className="text-center mb-10 md:mb-14">
          <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-gold block mb-4">
            Expérience Interactive
          </span>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-white font-normal tracking-tight leading-tight">
            Jouez avec le piano
          </h2>
          <p className="text-white/50 text-sm md:text-base mt-4 max-w-lg mx-auto leading-relaxed">
            Écoutez un prélude s'interpréter sur un véritable piano à queue,
            ou jouez vous-même en cliquant sur les touches ou avec votre clavier.
          </p>
        </div>

        {/* Commandes */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            onClick={togglePlay}
            disabled={loadingSounds && !isPlaying}
            className="flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-dark disabled:opacity-60 text-ink text-xs font-semibold uppercase tracking-wider rounded-full transition-colors duration-200 cursor-pointer min-w-[150px] justify-center"
            aria-label={isPlaying ? 'Arrêter la lecture' : 'Écouter le prélude'}
          >
            {loadingSounds && !isPlaying
              ? <><Loader2 size={14} className="animate-spin" /> Chargement</>
              : isPlaying
                ? <><Square size={13} /> Arrêter</>
                : <><Play size={14} /> Écouter</>}
          </button>

          <button
            onClick={() => setSustain((s) => !s)}
            className={`flex items-center gap-2 px-4 py-2.5 border text-xs uppercase tracking-wider rounded-full transition-all duration-200 cursor-pointer ${
              sustain ? 'border-gold text-gold bg-gold/10' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40'
            }`}
            aria-pressed={sustain}
            aria-label="Pédale de sustain"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${sustain ? 'bg-gold' : 'bg-white/30'}`} />
            Pédale
          </button>

          <button
            onClick={() => setMuted((m) => !m)}
            className="flex items-center gap-2 px-4 py-2.5 border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-xs uppercase tracking-wider rounded-full transition-all duration-200 cursor-pointer"
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {muted ? 'Muet' : 'Son'}
          </button>
        </div>

        {/* Morceau en cours */}
        <div className={`max-w-md mx-auto mb-8 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/40">{PIECE.title}</span>
            <span className="text-[10px] tabular-nums text-white/30">
              {Math.floor(progress * PIECE.duration / 60)}:{String(Math.floor(progress * PIECE.duration % 60)).padStart(2, '0')}
            </span>
          </div>
          <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gold rounded-full" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        {/* Corps du piano */}
        <div
          className="mx-auto rounded-2xl p-3 sm:p-4 md:p-5 ring-1 ring-white/10"
          style={{
            maxWidth: scrollable ? '100%' : kbWidth + 40,
            background: 'linear-gradient(to bottom, #2c2c2c 0%, #161616 40%, #0b0b0b 100%)',
            boxShadow: '0 40px 80px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Bandeau au-dessus des touches */}
          <div className="flex items-center justify-between px-1 pb-3 md:pb-4">
            <span className="font-serif text-gold/80 text-xs sm:text-sm tracking-[0.25em] uppercase">Arnault Frachet</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/25">
              {toName(range[0])} – {toName(range[1])}
            </span>
          </div>
          <div className="h-[3px] rounded-full mb-[3px]" style={{ background: 'linear-gradient(to right, #6b1a1a, #a52c2c 50%, #6b1a1a)' }} />

          {/* Touches */}
          <div
            ref={scrollRef}
            className={scrollable ? 'overflow-x-auto scrollbar-hide' : 'overflow-hidden'}
            style={{ touchAction: 'pan-x' }}
          >
            <div className="relative select-none" style={{ width: kbWidth, height: H, background: '#0a0a0a' }}>
              {keys.filter((k) => !k.black).map((k) => {
                const active = isActive(k.midi);
                const code = midiToCode[k.midi];
                return (
                  <button
                    key={k.midi}
                    type="button"
                    aria-label={`Note ${toName(k.midi)}`}
                    onPointerDown={onKeyPointerDown(k.midi)}
                    onPointerEnter={onKeyPointerEnter(k.midi)}
                    onPointerLeave={onKeyPointerLeave(k.midi)}
                    onContextMenu={(e) => e.preventDefault()}
                    className="absolute top-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                    style={{
                      left: k.left,
                      width: k.width - 1,
                      height: k.height,
                      borderRadius: '0 0 4px 4px',
                      background: active
                        ? 'linear-gradient(to bottom, #e3cc8b 0%, #c6a962 70%, #b3934f 100%)'
                        : 'linear-gradient(to bottom, #ffffff 0%, #fbfaf7 70%, #ebe8e1 100%)',
                      boxShadow: active
                        ? 'inset 0 3px 8px rgba(0,0,0,0.3), 0 0 18px rgba(198,169,98,0.35)'
                        : 'inset 0 -5px 0 rgba(0,0,0,0.05), inset -1px 0 0 rgba(0,0,0,0.06), 0 5px 6px rgba(0,0,0,0.55)',
                      transform: active ? 'translateY(2px)' : 'none',
                      transition: 'background 80ms, box-shadow 80ms, transform 60ms',
                    }}
                  >
                    {k.midi % 12 === 0 && (
                      <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-medium tracking-tight ${active ? 'text-ink/60' : 'text-ink/25'}`}>
                        {toName(k.midi)}
                      </span>
                    )}
                    {showLabels && code && (
                      <span className={`absolute bottom-7 left-1/2 -translate-x-1/2 w-4 h-4 flex items-center justify-center rounded-[3px] text-[8px] font-semibold ${active ? 'bg-ink/15 text-ink/70' : 'bg-ink/[0.06] text-ink/35'}`}>
                        {keyLabels[code]}
                      </span>
                    )}
                  </button>
                );
              })}

              {keys.filter((k) => k.black).map((k) => {
                const active = isActive(k.midi);
                const code = midiToCode[k.midi];
                return (
                  <button
                    key={k.midi}
                    type="button"
                    aria-label={`Note ${toName(k.midi)}`}
                    onPointerDown={onKeyPointerDown(k.midi)}
                    onPointerEnter={onKeyPointerEnter(k.midi)}
                    onPointerLeave={onKeyPointerLeave(k.midi)}
                    onContextMenu={(e) => e.preventDefault()}
                    className="absolute top-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                    style={{
                      left: k.left,
                      width: k.width,
                      height: k.height,
                      borderRadius: '0 0 3px 3px',
                      background: active
                        ? 'linear-gradient(to bottom, #c9ad6a 0%, #9a7b3c 60%, #7d6330 100%)'
                        : 'linear-gradient(to bottom, #4a4a4a 0%, #202020 10%, #0d0d0d 100%)',
                      boxShadow: active
                        ? 'inset 0 3px 6px rgba(0,0,0,0.5), 0 0 14px rgba(198,169,98,0.45)'
                        : '0 6px 8px rgba(0,0,0,0.7), inset 0 -10px 0 rgba(255,255,255,0.035), inset 2px 0 0 rgba(255,255,255,0.05), inset -2px 0 0 rgba(0,0,0,0.6)',
                      transform: active ? 'translateY(2px) scaleY(0.985)' : 'none',
                      transformOrigin: 'top',
                      transition: 'background 80ms, box-shadow 80ms, transform 60ms',
                    }}
                  >
                    {showLabels && code && (
                      <span className={`absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 flex items-center justify-center rounded-[3px] text-[8px] font-semibold ${active ? 'bg-black/20 text-ink/70' : 'bg-white/10 text-white/50'}`}>
                        {keyLabels[code]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Aide et crédits */}
        <div className="flex flex-col items-center gap-2 mt-8">
          <div className="hidden md:flex items-center gap-2">
            <Music size={12} className="text-white/30" />
            <p className="text-white/30 text-[11px] tracking-wide">
              Clavier d'ordinateur : rangée du milieu pour les touches blanches, rangée du dessus pour les noires.
            </p>
          </div>
          {scrollable && (
            <p className="text-white/30 text-[11px] tracking-wide md:hidden">Faites glisser le clavier pour découvrir toutes les octaves.</p>
          )}
          <p className="text-white/20 text-[10px] tracking-wide">
            Sons : Salamander Grand Piano (Alexander Holm, CC BY 3.0)
          </p>
        </div>
      </div>
    </section>
  );
}
