import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause, Music } from 'lucide-react';

// Frequencies for piano notes (C3 to B4 = 2 octaves)
const NOTE_FREQUENCIES = {
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56,
  'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00,
  'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13,
  'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00,
  'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
};

// White keys layout
const WHITE_KEYS = [
  'C3','D3','E3','F3','G3','A3','B3',
  'C4','D4','E4','F4','G4','A4','B4',
];
// Black keys with their position index relative to white keys
const BLACK_KEYS = [
  { note: 'C#3', after: 0 }, { note: 'D#3', after: 1 },
  { note: 'F#3', after: 3 }, { note: 'G#3', after: 4 }, { note: 'A#3', after: 5 },
  { note: 'C#4', after: 7 }, { note: 'D#4', after: 8 },
  { note: 'F#4', after: 10 }, { note: 'G#4', after: 11 }, { note: 'A#4', after: 12 },
];

// Keyboard mapping for playing with computer keys
const KEY_MAP = {
  'a': 'C3', 'w': 'C#3', 's': 'D3', 'e': 'D#3', 'd': 'E3',
  'f': 'F3', 't': 'F#3', 'g': 'G3', 'y': 'G#3', 'h': 'A3',
  'u': 'A#3', 'j': 'B3', 'k': 'C4', 'o': 'C#4', 'l': 'D4',
  'p': 'D#4', ';': 'E4',
};

// Clair de Lune - simplified melody (note, duration in beats, velocity)
const CLAIR_DE_LUNE = [
  // Opening measures - gentle ascending
  { note: 'E4', duration: 2, velocity: 0.3 },
  { note: 'G4', duration: 1, velocity: 0.25 },
  { note: 'A4', duration: 2, velocity: 0.35 },
  { note: 'G4', duration: 1, velocity: 0.25 },
  { note: 'E4', duration: 2, velocity: 0.3 },
  { note: 'D4', duration: 1, velocity: 0.2 },
  { note: 'C4', duration: 3, velocity: 0.35 },

  // Second phrase
  { note: 'D4', duration: 1.5, velocity: 0.25 },
  { note: 'E4', duration: 1.5, velocity: 0.3 },
  { note: 'G4', duration: 2, velocity: 0.35 },
  { note: 'A4', duration: 1, velocity: 0.4 },
  { note: 'G4', duration: 1, velocity: 0.3 },
  { note: 'E4', duration: 1, velocity: 0.25 },
  { note: 'D4', duration: 3, velocity: 0.3 },

  // Third phrase - more movement
  { note: 'C4', duration: 1, velocity: 0.2 },
  { note: 'E4', duration: 1, velocity: 0.3 },
  { note: 'G4', duration: 1.5, velocity: 0.35 },
  { note: 'B4', duration: 2, velocity: 0.45 },
  { note: 'A4', duration: 1, velocity: 0.35 },
  { note: 'G4', duration: 1.5, velocity: 0.3 },
  { note: 'E4', duration: 2, velocity: 0.25 },

  // Descending passage
  { note: 'G4', duration: 1, velocity: 0.3 },
  { note: 'F4', duration: 1, velocity: 0.28 },
  { note: 'E4', duration: 1.5, velocity: 0.25 },
  { note: 'D4', duration: 1, velocity: 0.22 },
  { note: 'C4', duration: 2, velocity: 0.3 },
  { note: 'E3', duration: 1, velocity: 0.2 },
  { note: 'G3', duration: 1, velocity: 0.22 },

  // Middle section - more expressive
  { note: 'A3', duration: 1.5, velocity: 0.3 },
  { note: 'C4', duration: 1, velocity: 0.35 },
  { note: 'E4', duration: 2, velocity: 0.4 },
  { note: 'G4', duration: 1.5, velocity: 0.45 },
  { note: 'A4', duration: 2.5, velocity: 0.5 },
  { note: 'G4', duration: 1, velocity: 0.4 },

  // Gentle resolution
  { note: 'E4', duration: 1.5, velocity: 0.35 },
  { note: 'D4', duration: 1, velocity: 0.3 },
  { note: 'C4', duration: 2, velocity: 0.35 },
  { note: 'G3', duration: 1, velocity: 0.2 },
  { note: 'A3', duration: 1, velocity: 0.22 },
  { note: 'C4', duration: 3, velocity: 0.3 },

  // Final phrase
  { note: 'E4', duration: 2, velocity: 0.35 },
  { note: 'D4', duration: 1, velocity: 0.28 },
  { note: 'C4', duration: 1, velocity: 0.25 },
  { note: 'E3', duration: 1, velocity: 0.2 },
  { note: 'G3', duration: 2, velocity: 0.25 },
  { note: 'C4', duration: 4, velocity: 0.3 },
];

const TEMPO = 100; // BPM
const BEAT_DURATION = 60 / TEMPO;

function createPianoSound(audioCtx, frequency, velocity = 0.3, duration = 1) {
  const now = audioCtx.currentTime;

  // Main oscillator - sine for fundamental
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(frequency, now);

  // Second harmonic for richness
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(frequency * 2, now);

  // Third harmonic - subtle
  const osc3 = audioCtx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(frequency * 3, now);

  // Gain nodes for each harmonic
  const gain1 = audioCtx.createGain();
  const gain2 = audioCtx.createGain();
  const gain3 = audioCtx.createGain();

  // Master gain with ADSR envelope
  const masterGain = audioCtx.createGain();

  // Set harmonic levels
  gain1.gain.setValueAtTime(velocity, now);
  gain2.gain.setValueAtTime(velocity * 0.25, now);
  gain3.gain.setValueAtTime(velocity * 0.08, now);

  // ADSR envelope on master
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(1, now + 0.01); // Attack
  masterGain.gain.exponentialRampToValueAtTime(0.7, now + 0.08); // Decay
  masterGain.gain.exponentialRampToValueAtTime(0.4, now + duration * 0.5); // Sustain
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Release

  // Connect
  osc1.connect(gain1);
  osc2.connect(gain2);
  osc3.connect(gain3);
  gain1.connect(masterGain);
  gain2.connect(masterGain);
  gain3.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  // Start and stop
  osc1.start(now);
  osc2.start(now);
  osc3.start(now);
  osc1.stop(now + duration + 0.1);
  osc2.stop(now + duration + 0.1);
  osc3.stop(now + duration + 0.1);

  return { stop: () => {
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  }};
}

export default function PianoKeyboard() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNotes, setActiveNotes] = useState(new Set());
  const [currentNoteIdx, setCurrentNoteIdx] = useState(0);
  const audioCtxRef = useRef(null);
  const playbackRef = useRef(null);
  const pressedKeysRef = useRef(new Set());

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playNote = useCallback((noteName, velocity = 0.3, duration = 0.8) => {
    if (!soundEnabled) return;
    const freq = NOTE_FREQUENCIES[noteName];
    if (!freq) return;
    const ctx = getAudioCtx();
    createPianoSound(ctx, freq, velocity, duration);
  }, [soundEnabled, getAudioCtx]);

  const highlightNote = useCallback((noteName, durationMs = 300) => {
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.add(noteName);
      return next;
    });
    setTimeout(() => {
      setActiveNotes(prev => {
        const next = new Set(prev);
        next.delete(noteName);
        return next;
      });
    }, durationMs);
  }, []);

  // Playback logic
  useEffect(() => {
    if (!isPlaying) {
      if (playbackRef.current) {
        clearTimeout(playbackRef.current);
        playbackRef.current = null;
      }
      return;
    }

    let idx = currentNoteIdx;
    let cancelled = false;

    function playNext() {
      if (cancelled || idx >= CLAIR_DE_LUNE.length) {
        if (!cancelled) {
          setIsPlaying(false);
          setCurrentNoteIdx(0);
        }
        return;
      }

      const entry = CLAIR_DE_LUNE[idx];
      const durationSec = entry.duration * BEAT_DURATION;
      const durationMs = durationSec * 1000;

      playNote(entry.note, entry.velocity, durationSec);
      highlightNote(entry.note, Math.min(durationMs, durationMs * 0.8));

      idx++;
      setCurrentNoteIdx(idx);

      playbackRef.current = setTimeout(playNext, durationMs);
    }

    playNext();

    return () => {
      cancelled = true;
      if (playbackRef.current) {
        clearTimeout(playbackRef.current);
      }
    };
  }, [isPlaying, playNote, highlightNote, currentNoteIdx]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (KEY_MAP[key] && !pressedKeysRef.current.has(key)) {
        pressedKeysRef.current.add(key);
        const noteName = KEY_MAP[key];
        playNote(noteName, 0.4, 1.2);
        highlightNote(noteName, 500);
      }
    };
    const handleKeyUp = (e) => {
      pressedKeysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [playNote, highlightNote]);

  const handleWhiteKeyClick = (note) => {
    playNote(note, 0.4, 1.2);
    highlightNote(note, 400);
  };

  const handleBlackKeyClick = (note) => {
    playNote(note, 0.35, 1.0);
    highlightNote(note, 400);
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      getAudioCtx(); // ensure audio context is started on user gesture
      setCurrentNoteIdx(0);
      setIsPlaying(true);
    }
  };

  const progress = CLAIR_DE_LUNE.length > 0
    ? (currentNoteIdx / CLAIR_DE_LUNE.length) * 100
    : 0;

  return (
    <section className="relative py-24 md:py-32 bg-ink overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-10">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-16">
          <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-gold block mb-4">
            Expérience Interactive
          </span>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-white font-normal tracking-tight leading-tight">
            Jouez avec le piano
          </h2>
          <p className="text-white/50 text-sm md:text-base mt-4 max-w-lg mx-auto leading-relaxed">
            Écoutez une mélodie s'interpréter devant vous, ou jouez vous-même
            en cliquant sur les touches ou en utilisant votre clavier.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={togglePlay}
            className="flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-dark text-ink text-xs font-semibold uppercase tracking-wider rounded-full transition-colors duration-200 cursor-pointer"
            aria-label={isPlaying ? 'Mettre en pause' : 'Jouer la mélodie'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause' : 'Écouter'}
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-2 px-4 py-2.5 border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-xs uppercase tracking-wider rounded-full transition-all duration-200 cursor-pointer"
            aria-label={soundEnabled ? 'Couper le son' : 'Activer le son'}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {soundEnabled ? 'Son' : 'Muet'}
          </button>
        </div>

        {/* Progress bar */}
        {isPlaying && (
          <div className="max-w-md mx-auto mb-8">
            <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Keyboard hint */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Music size={12} className="text-white/30" />
          <p className="text-white/30 text-[11px] tracking-wide">
            Touches clavier : A S D F G H J K (blanches) &middot; W E T Y U O P (noires)
          </p>
        </div>

        {/* Piano keyboard */}
        <div className="flex justify-center">
          <div className="relative select-none">
            {/* White keys */}
            <div className="flex">
              {WHITE_KEYS.map((note, i) => {
                const isActive = activeNotes.has(note);
                return (
                  <button
                    key={note}
                    onMouseDown={() => handleWhiteKeyClick(note)}
                    onTouchStart={(e) => { e.preventDefault(); handleWhiteKeyClick(note); }}
                    className={`
                      relative w-10 sm:w-12 md:w-14 h-36 sm:h-44 md:h-52
                      border border-ink/10 rounded-b-md
                      transition-all duration-100 cursor-pointer
                      ${isActive
                        ? 'bg-gold shadow-[0_0_20px_rgba(198,169,98,0.4)]'
                        : 'bg-white hover:bg-cream'
                      }
                      ${i > 0 ? '-ml-px' : ''}
                    `}
                    style={{ zIndex: 1 }}
                    aria-label={`Note ${note}`}
                  >
                    <span className={`
                      absolute bottom-2 left-1/2 -translate-x-1/2
                      text-[9px] font-medium tracking-tight
                      ${isActive ? 'text-ink/70' : 'text-ink/20'}
                    `}>
                      {note.replace(/\d/, '')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Black keys */}
            {BLACK_KEYS.map(({ note, after }) => {
              const isActive = activeNotes.has(note);
              // Calculate position: each white key is w-10 (40px) on mobile, w-12 (48px) sm, w-14 (56px) md
              // Black key sits between white keys at index `after` and `after+1`
              return (
                <button
                  key={note}
                  onMouseDown={(e) => { e.stopPropagation(); handleBlackKeyClick(note); }}
                  onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleBlackKeyClick(note); }}
                  className={`
                    absolute top-0
                    w-6 sm:w-7 md:w-8 h-20 sm:h-26 md:h-32
                    rounded-b-md
                    transition-all duration-100 cursor-pointer
                    ${isActive
                      ? 'bg-gold shadow-[0_0_15px_rgba(198,169,98,0.5)]'
                      : 'bg-ink hover:bg-ink/80 border border-white/5'
                    }
                  `}
                  style={{
                    zIndex: 2,
                    left: `calc(${after + 1} * var(--key-w) - var(--black-half))`,
                    '--key-w': 'clamp(40px, 8vw, 56px)',
                    '--black-half': 'clamp(12px, 2.5vw, 16px)',
                  }}
                  aria-label={`Note ${note}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
