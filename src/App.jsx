import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Mail, MapPin,
  ChevronDown, Menu, X, ExternalLink, Star, Users, Calendar, Globe
} from 'lucide-react';
import PianoKeyboard from './components/PianoKeyboard';

/* ──────────────── HOOKS ──────────────── */

function useFadeIn() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('opacity-100', 'translate-y-0');
          el.classList.remove('opacity-0', 'translate-y-8');
          obs.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function FadeIn({ children, className = '', delay = '' }) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className={`opacity-0 translate-y-8 transition-all duration-700 ease-out ${delay} ${className}`}>
      {children}
    </div>
  );
}

function useParallax(speed = 0.3) {
  const ref = useRef(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const viewH = window.innerHeight;
        if (rect.bottom > 0 && rect.top < viewH) {
          const progress = (viewH - rect.top) / (viewH + rect.height);
          setOffset((progress - 0.5) * speed * rect.height);
        }
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [speed]);

  return { ref, offset };
}

/* ──────────────── PARALLAX DIVIDER ──────────────── */

function ParallaxDivider({ image, height = 'h-[50vh] md:h-[70vh]', overlay = 'bg-black/30', children }) {
  const { ref, offset } = useParallax(0.4);
  return (
    <div ref={ref} className={`relative ${height} overflow-hidden`}>
      <div
        className="absolute inset-0 bg-cover bg-center will-change-transform"
        style={{
          backgroundImage: `url('${image}')`,
          transform: `translateY(${offset}px) scale(1.15)`,
          filter: 'grayscale(40%)',
        }}
      />
      <div className={`absolute inset-0 ${overlay}`} />
      {children && (
        <div className="relative h-full flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

/* ──────────────── VIDEO SECTION ──────────────── */

function VideoSection({ src, children, overlay = 'bg-black/50' }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(video);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative h-[60vh] md:h-[80vh] overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        style={{ filter: 'grayscale(30%) brightness(0.7)' }}
      />
      <div className={`absolute inset-0 ${overlay}`} />
      <div className="relative h-full flex items-center justify-center px-6">
        {children}
      </div>
    </div>
  );
}

/* ──────────────── NAV ──────────────── */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Biographie', href: '#bio' },
    { label: 'Piano', href: '#piano' },
    { label: 'Prestations', href: '#services' },
    { label: 'Galerie', href: '#gallery' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
      scrolled
        ? 'bg-beige/95 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.05)]'
        : 'bg-transparent'
    }`}>
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between h-16 md:h-20">
        <a href="#" className={`font-serif text-lg md:text-xl tracking-tight transition-colors duration-300 ${
          scrolled ? 'text-ink' : 'text-white'
        }`}>
          Arnault Frachet
        </a>
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className={`text-[11px] uppercase tracking-[0.05em] font-medium transition-opacity duration-200 hover:opacity-60 ${
              scrolled ? 'text-ink' : 'text-white'
            }`}>
              {l.label}
            </a>
          ))}
        </div>
        <button
          className={`md:hidden cursor-pointer ${scrolled ? 'text-ink' : 'text-white'}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden bg-beige/98 backdrop-blur-md border-t border-border px-6 py-8">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm font-medium text-ink hover:text-gold transition-colors">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

/* ──────────────── HERO (VIDEO BG) ──────────────── */

function Hero() {
  const { ref, offset } = useParallax(0.25);

  return (
    <header ref={ref} className="relative h-screen min-h-[700px] w-full overflow-hidden bg-black">
      {/* Fallback image for slow connections (behind the video) */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/portrait-david-arous.webp')",
          filter: 'grayscale(100%) contrast(1.1) brightness(0.5)',
        }}
      />

      {/* Video background */}
      <video
        className="absolute inset-0 w-full h-full object-cover will-change-transform"
        style={{
          filter: 'grayscale(100%) contrast(1.05) brightness(0.5)',
          transform: `translateY(${offset}px) scale(1.1)`,
        }}
        src="/videos/london-performance-web.mp4"
        poster="/images/portrait-david-arous.webp"
        autoPlay muted loop playsInline preload="auto"
      />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end pb-20 md:pb-28 px-6 md:px-10 max-w-[1400px] mx-auto">
        <FadeIn>
          <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gold mb-4 block">
            Pianiste International
          </span>
        </FadeIn>
        <FadeIn delay="delay-100">
          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-[6.5rem] text-white font-normal leading-[0.92] tracking-tight">
            Arnault<br />
            <em className="text-white/60">Frachet</em>
          </h1>
        </FadeIn>
        <FadeIn delay="delay-200">
          <p className="mt-6 md:mt-8 text-white/45 text-sm md:text-base max-w-md leading-relaxed">
            Laissez-vous transporter par des nuances allant de la douceur
            et la poésie mélancolique à la fougue et aux rythmes les plus endiablés.
          </p>
        </FadeIn>
        <FadeIn delay="delay-300">
          <div className="mt-8 flex items-center gap-6">
            <a href="#bio" className="inline-flex items-center gap-2 px-6 py-3 bg-gold hover:bg-gold-dark text-ink text-xs font-semibold uppercase tracking-wider rounded-full transition-colors duration-200 cursor-pointer">
              Découvrir <ArrowRight size={12} />
            </a>
            <a href="#piano" className="inline-flex items-center gap-2 text-xs font-medium text-white/60 border-b border-white/20 pb-1 hover:text-gold hover:border-gold transition-colors duration-200 cursor-pointer">
              Jouer le piano
            </a>
          </div>
        </FadeIn>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown size={20} className="text-white/25" />
      </div>
    </header>
  );
}

/* ──────────────── BIO ──────────────── */

function Bio() {
  const { ref: imgRef, offset: imgOffset } = useParallax(0.15);

  return (
    <section id="bio" className="py-24 md:py-36 bg-beige">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Text */}
          <FadeIn>
            <div className="max-w-lg">
              <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-muted mb-4 block">
                Biographie
              </span>
              <h2 className="font-serif text-3xl md:text-4xl lg:text-[2.8rem] font-normal leading-tight tracking-tight text-ink mb-8">
                La rigueur classique<br />
                au service de <em className="text-muted">l'émotion</em>
              </h2>
              <div className="space-y-5 text-sm text-muted leading-relaxed">
                <p>
                  Arnault Frachet découvre l'univers musical dès l'âge de cinq ans.
                  C'est la rencontre avec Nicole Havilland Cortes qui est décisive et
                  lui transmet la passion du piano.
                </p>
                <p>
                  Son parcours académique se poursuit à Paris, où il se perfectionne
                  auprès d'éminents maîtres en piano classique et jazz, couronné par
                  de nombreux prix aux conservatoires de Saint-Maur, Montreuil et au
                  Conservatoire Européen de Paris.
                </p>
                <p>
                  Musicien complet et improvisateur né, il se consacre entièrement à
                  la scène après avoir enseigné le piano pendant une dizaine d'années.
                  Compositeur et Arrangeur, membre de la SACEM, il est pianiste au
                  Moulin Rouge à Paris depuis 2017.
                </p>
              </div>

              {/* Stats */}
              <div className="flex gap-10 mt-10 pt-8 border-t border-border">
                <div>
                  <div className="font-serif text-3xl text-ink">30+</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted mt-1">Années de scène</div>
                </div>
                <div>
                  <div className="font-serif text-3xl text-ink">5</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted mt-1">Continents</div>
                </div>
                <div>
                  <div className="font-serif text-3xl text-ink">100+</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted mt-1">Événements / an</div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Photo collage with parallax */}
          <FadeIn delay="delay-150">
            <div ref={imgRef} className="relative h-[550px] md:h-[650px]">
              {/* Main portrait */}
              <div
                className="absolute top-0 right-0 w-[65%] h-[75%] rounded-lg overflow-hidden shadow-2xl"
                style={{ zIndex: 3 }}
              >
                <div
                  className="w-full h-full bg-cover bg-center will-change-transform"
                  style={{
                    backgroundImage: "url('/images/hero-portrait.webp')",
                    filter: 'grayscale(80%) contrast(1.1)',
                    transform: `translateY(${imgOffset * 0.3}px)`,
                  }}
                />
              </div>
              {/* Bottom-left: live */}
              <div
                className="absolute bottom-0 left-0 w-[55%] h-[50%] rounded-lg overflow-hidden shadow-xl"
                style={{ zIndex: 2 }}
              >
                <div
                  className="w-full h-full bg-cover bg-center will-change-transform"
                  style={{
                    backgroundImage: "url('/images/moulin-rouge.webp')",
                    filter: 'grayscale(50%)',
                    transform: `translateY(${imgOffset * -0.2}px)`,
                  }}
                />
              </div>
              {/* Gold accent line */}
              <div className="absolute top-[60%] left-[25%] w-px h-24 bg-gold/40" style={{ zIndex: 4 }} />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ──────────────── SERVICES ──────────────── */

const SERVICES = [
  {
    icon: <Star size={20} />,
    title: 'Récitals Privés',
    desc: 'Du piano solo aux configurations en duo, trio ou quartet, une prestation musicale sur-mesure pour vos événements les plus intimes.',
    image: '/images/piano-violon.webp',
  },
  {
    icon: <Users size={20} />,
    title: 'Événements & Galas',
    desc: 'Mariages, anniversaires, événements corporate — une ambiance musicale parfaitement orchestrée pour chaque occasion.',
    image: '/images/monaco-wedding-2.webp',
  },
  {
    icon: <Calendar size={20} />,
    title: 'Karaoké Live',
    desc: 'Une expérience de karaoké exceptionnelle, accompagné par un pianiste professionnel pour un moment unique.',
    image: '/images/on-stage-band.webp',
  },
  {
    icon: <Globe size={20} />,
    title: 'Logistique Clé en Main',
    desc: 'Location de pianos, sonorisation, lumières — une gestion complète pour une tranquillité d\'esprit totale.',
    image: '/images/soundcheck.webp',
  },
];

function Services() {
  return (
    <section id="services" className="py-24 md:py-36 bg-cream">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <FadeIn>
          <div className="text-center mb-16">
            <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-muted block mb-4">
              Prestations
            </span>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-[2.8rem] font-normal tracking-tight text-ink">
              L'Excellence Musicale
            </h2>
            <p className="text-muted text-sm mt-4 max-w-lg mx-auto leading-relaxed">
              Quelle que soit la nature de votre événement, une prestation
              musicale parfaitement adaptée à vos exigences.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {SERVICES.map((s, i) => (
            <FadeIn key={s.title} delay={i % 2 === 1 ? 'delay-100' : ''}>
              <div className="group relative bg-white rounded-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full">
                {/* Image header */}
                <div className="h-48 overflow-hidden">
                  <div
                    className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                    style={{
                      backgroundImage: `url('${s.image}')`,
                      filter: 'grayscale(40%) brightness(0.85)',
                    }}
                  />
                </div>
                <div className="p-8">
                  <div className="w-10 h-10 rounded-full bg-beige flex items-center justify-center text-gold mb-5 -mt-12 relative z-10 shadow-md">
                    {s.icon}
                  </div>
                  <h3 className="text-base font-medium text-ink mb-3">{s.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────── GALLERY ──────────────── */

const GALLERY_IMAGES = [
  { src: '/images/arnault-monaco.webp', alt: 'Monaco', span: 'col-span-2 row-span-2' },
  { src: '/images/stage-sea.webp', alt: 'Scène en bord de mer', span: '' },
  { src: '/images/fender-rhodes.webp', alt: 'Fender Rhodes', span: '' },
  { src: '/images/rooftop-paris.webp', alt: 'Rooftop Paris', span: 'col-span-2' },
  { src: '/images/on-stage.webp', alt: 'On Stage', span: '' },
  { src: '/images/dubai.webp', alt: 'Dubai', span: '' },
  { src: '/images/palais-venise.webp', alt: 'Palais de Venise', span: 'col-span-2' },
  { src: '/images/trio-monaco.webp', alt: 'Trio Monaco', span: '' },
  { src: '/images/gospel.webp', alt: 'Gospel', span: '' },
  { src: '/images/invalides-paris.webp', alt: 'Invalides Paris', span: 'col-span-2 row-span-2' },
  { src: '/images/maroc-piano.webp', alt: 'Maroc Piano', span: '' },
  { src: '/images/rome-showtime.webp', alt: 'Rome', span: '' },
  { src: '/images/backstage.webp', alt: 'Backstage', span: '' },
  { src: '/images/concert-kristel-adams.webp', alt: 'Concert Kristel Adams', span: '' },
  { src: '/images/musee-rodin.webp', alt: 'Musée Rodin', span: 'col-span-2' },
  { src: '/videos/monaco-duo-web.mp4', alt: 'Duo à Monaco', span: 'row-span-2', video: true },
  { src: '/images/cannes-bwf.webp', alt: 'Palais des Festivals, Cannes', span: '' },
  { src: '/images/monaco-wedding.webp', alt: 'Opéra de Monte-Carlo', span: '' },
  { src: '/images/chorale.webp', alt: 'Chorale', span: 'col-span-2' },
  { src: '/images/porsche-antibes.webp', alt: 'Piano de cristal, Antibes', span: '' },
  { src: '/videos/percus-web.mp4', alt: 'Percussions', span: 'col-span-2', video: true },
  { src: '/images/ritz.webp', alt: 'Place Vendôme, Paris', span: '' },
  { src: '/images/maldives.webp', alt: 'Maldives', span: '' },
  { src: '/images/show-danseuses.webp', alt: 'Cabaret', span: '' },
  { src: '/images/studio.webp', alt: 'Studio', span: 'col-span-2' },
  { src: '/images/live.webp', alt: 'Live', span: '' },
  { src: '/images/live-2.webp', alt: 'Live', span: '' },
  { src: '/images/concert-thiais.webp', alt: 'Concert', span: '' },
  { src: '/images/selfie-yellow.webp', alt: 'Backstage', span: 'row-span-2' },
  { src: '/images/selfie-white.webp', alt: 'Portrait', span: 'row-span-2' },
  { src: '/images/selfie-stage.webp', alt: 'Portrait', span: 'row-span-2' },
  { src: '/images/illustration-cava.webp', alt: 'Illustration', span: '' },
];

function Gallery() {
  return (
    <section id="gallery" className="py-24 md:py-36 bg-beige">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <FadeIn>
          <div className="mb-12">
            <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-muted block mb-4">
              Galerie
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-ink">
              Moments Capturés
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-2 md:grid-cols-4 grid-flow-dense gap-2 md:gap-3 auto-rows-[180px] md:auto-rows-[220px]">
          {GALLERY_IMAGES.map((img) => (
            <FadeIn key={img.src} className={img.span}>
              <div className="group relative w-full h-full rounded-lg overflow-hidden cursor-pointer">
                {img.video ? (
                  <video
                    src={img.src}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                    style={{ filter: 'grayscale(25%)' }}
                    autoPlay muted loop playsInline preload="metadata"
                  />
                ) : (
                  <img
                    src={img.src} alt={img.alt} loading="lazy" decoding="async"
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
                    style={{ filter: 'grayscale(25%)' }}
                  />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                  <span className="text-white text-[10px] uppercase tracking-wider font-medium">{img.alt}</span>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────── REFERENCES ──────────────── */

function References() {
  const venues = [
    'Moulin Rouge', 'Opéra Garnier', 'Bercy', 'Zénith', 'Olympia',
    'Casino de Paris', 'Folies Bergères', 'Bataclan', 'La Cigale',
    'Palais des Festivals Cannes', 'Sporting Monaco',
  ];
  const collabs = [
    'Patrick Bruel', 'Nicoletta', 'Yves Duteil', 'Jeanne Mas', 'Gérard Lenorman',
    'Philippe Lavil', 'Imagination', 'Dave', 'Ishtar',
  ];
  const events = [
    'Mariage Prince Albert II de Monaco',
    'Mariage Jean Réno',
    'Mariage Victoria Swarovski',
    'Bugatti', 'Van Cleef & Arpels',
    'Hugo Boss', 'OVH',
  ];

  return (
    <section className="py-24 md:py-36 bg-cream">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <FadeIn>
          <div className="text-center mb-16">
            <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-muted block mb-4">
              Références
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-ink">
              Scènes & Collaborations
            </h2>
          </div>
        </FadeIn>

        {/* Collaboration photos strip */}
        <FadeIn>
          <div className="flex gap-3 mb-16 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {[
              { src: '/images/patrick-bruel.webp', label: 'Patrick Bruel' },
              { src: '/images/nicoletta.webp', label: 'Nicoletta' },
              { src: '/images/imagination.webp', label: 'Imagination' },
              { src: '/images/jean-pax-mefret.webp', label: 'Jean-Pax Méfret' },
              { src: '/images/arnault-donore.webp', label: 'Donoré' },
              { src: '/images/arnault-bamy.webp', label: 'Bamy' },
              { src: '/images/france2.webp', label: 'France 2' },
              { src: '/images/yves-duteil.webp', label: 'Yves Duteil' },
              { src: '/images/nicoletta-lido.webp', label: 'Nicoletta au Lido' },
              { src: '/images/sporting-monaco.webp', label: 'Sporting Monaco' },
            ].map(c => (
              <div key={c.label} className="flex-shrink-0 snap-start group cursor-pointer">
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-lg overflow-hidden mb-2">
                  <img
                    src={c.src} alt={c.label} loading="lazy" decoding="async"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    style={{ filter: 'grayscale(40%)' }}
                  />
                </div>
                <span className="text-[11px] text-muted font-medium">{c.label}</span>
              </div>
            ))}
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16">
          <FadeIn>
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.1em] text-muted font-medium mb-6 pb-3 border-b border-border">
                Salles & Palaces
              </h3>
              <ul className="space-y-3">
                {venues.map(v => (
                  <li key={v} className="text-sm text-ink font-medium">{v}</li>
                ))}
              </ul>
            </div>
          </FadeIn>
          <FadeIn delay="delay-100">
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.1em] text-muted font-medium mb-6 pb-3 border-b border-border">
                Artistes
              </h3>
              <ul className="space-y-3">
                {collabs.map(c => (
                  <li key={c} className="text-sm text-ink font-medium">{c}</li>
                ))}
              </ul>
            </div>
          </FadeIn>
          <FadeIn delay="delay-200">
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.1em] text-muted font-medium mb-6 pb-3 border-b border-border">
                Événements Privés
              </h3>
              <ul className="space-y-3">
                {events.map(e => (
                  <li key={e} className="text-sm text-ink font-medium">{e}</li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ──────────────── CONTACT CTA ──────────────── */

function Contact() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      setSent(true);
      setEmail('');
      setTimeout(() => setSent(false), 3000);
    }
  };

  return (
    <section id="contact" className="py-24 md:py-36 bg-beige">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <FadeIn>
          <div className="text-center max-w-lg mx-auto">
            <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-muted block mb-4">
              Contact
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-ink mb-3">
              Trouvez l'accord parfait.
            </h2>
            <p className="text-muted text-sm leading-relaxed mb-8">
              Discutons de votre projet. Laissez votre adresse email
              ou contactez-moi directement.
            </p>

            <form onSubmit={handleSubmit} className="relative max-w-sm mx-auto mb-10">
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={sent ? 'Merci, à bientôt !' : 'Votre email'}
                className="w-full px-5 py-4 bg-beige-dark rounded-full text-sm text-ink placeholder:text-muted/60 outline-none focus:ring-2 focus:ring-gold/30 transition-all"
              />
              <button type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-ink hover:bg-gold rounded-full flex items-center justify-center transition-colors duration-200 cursor-pointer"
                aria-label="Envoyer">
                <ArrowRight size={14} className="text-white" />
              </button>
            </form>

            <div className="flex flex-wrap justify-center gap-6 text-xs text-muted">
              <a href="mailto:contact@arnaultfrachet.com" className="flex items-center gap-1.5 hover:text-ink transition-colors cursor-pointer">
                <Mail size={12} /> contact@arnaultfrachet.com
              </a>
              <span className="flex items-center gap-1.5">
                <MapPin size={12} /> Paris, France
              </span>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ──────────────── FOOTER ──────────────── */

function Footer() {
  return (
    <footer className="border-t border-border bg-beige">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-16 md:mb-24">
          <div>
            <div className="font-serif text-lg text-ink mb-1">Arnault Frachet</div>
            <div className="text-muted text-sm">Pianiste & Compositeur</div>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.1em] text-muted mb-5">Prestations</h4>
            <ul className="space-y-3">
              {['Récitals Privés', 'Événements & Galas', 'Karaoké Live', 'Composition sur-mesure'].map(l => (
                <li key={l}>
                  <a href="#services" className="text-sm text-ink font-medium hover:opacity-60 transition-opacity cursor-pointer inline-flex items-center gap-1">
                    {l} <ExternalLink size={9} className="text-muted" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.1em] text-muted mb-5">Média</h4>
            <ul className="space-y-3">
              {['Galerie Photo', 'Vidéos Live', 'Cinéma & TV'].map(l => (
                <li key={l}>
                  <a href="#gallery" className="text-sm text-ink font-medium hover:opacity-60 transition-opacity cursor-pointer inline-flex items-center gap-1">
                    {l} <ExternalLink size={9} className="text-muted" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.1em] text-muted mb-5">Suivre</h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-ink font-medium hover:opacity-60 transition-opacity cursor-pointer inline-flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg> Instagram
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-ink font-medium hover:opacity-60 transition-opacity cursor-pointer inline-flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg> YouTube
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-muted border-t border-border pt-6">
          <div>&copy; {new Date().getFullYear()} Arnault Frachet. Tous droits réservés.</div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-gold rounded-full" />
            Paris, France
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────── APP ──────────────── */

export default function App() {
  return (
    <div className="bg-beige min-h-screen">
      <Nav />
      <Hero />
      <Bio />

      {/* Parallax divider — Moulin Rouge */}
      <ParallaxDivider image="/images/paris-street.webp" overlay="bg-black/40">
        <FadeIn>
          <div className="text-center">
            <span className="font-serif text-3xl md:text-5xl lg:text-6xl text-white font-normal italic leading-tight">
              "La musique donne une âme<br className="hidden md:block" /> à nos cœurs"
            </span>
            <span className="block mt-4 text-white/40 text-xs uppercase tracking-[0.2em]">Platon</span>
          </div>
        </FadeIn>
      </ParallaxDivider>

      <div id="piano">
        <PianoKeyboard />
      </div>

      {/* Video section — Courchevel luxury venue */}
      <VideoSection src="/videos/courchevel-web.mp4" overlay="bg-black/40">
        <FadeIn>
          <div className="text-center max-w-2xl">
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold block mb-4">
              Du Studio aux Palaces
            </span>
            <h2 className="font-serif text-3xl md:text-5xl text-white font-normal leading-tight">
              Une présence scénique<br />
              <em className="text-white/60">d'exception</em>
            </h2>
            <p className="mt-6 text-white/40 text-sm max-w-md mx-auto leading-relaxed">
              Du Moulin Rouge aux palaces de Courchevel, de Monaco à Dubaï —
              une expérience musicale calibrée pour les lieux les plus prestigieux.
            </p>
          </div>
        </FadeIn>
      </VideoSection>

      <Services />

      {/* Parallax divider — Stage photo */}
      <ParallaxDivider image="/images/le-grand-hotel-paris.webp" height="h-[40vh] md:h-[50vh]" overlay="bg-black/20" />

      <Gallery />

      {/* Video section — Pompidou */}
      <VideoSection src="/videos/pompidou-web.mp4" overlay="bg-black/50">
        <FadeIn>
          <div className="text-center max-w-xl">
            <span className="font-serif text-2xl md:text-4xl text-white font-normal italic">
              Du Centre Pompidou au Sporting de Monaco
            </span>
            <p className="mt-4 text-white/40 text-sm">
              Plus de 30 ans d'expérience sur les plus grandes scènes internationales.
            </p>
          </div>
        </FadeIn>
      </VideoSection>

      <References />

      {/* Parallax contact prelude */}
      <ParallaxDivider image="/images/saint-sulpice.webp" height="h-[35vh] md:h-[45vh]" overlay="bg-black/50">
        <FadeIn>
          <a href="#contact" className="inline-flex items-center gap-3 px-8 py-4 border border-white/30 hover:border-gold hover:text-gold text-white text-xs uppercase tracking-widest rounded-full transition-all duration-300 cursor-pointer">
            Réserver une prestation <ArrowRight size={14} />
          </a>
        </FadeIn>
      </ParallaxDivider>

      <Contact />
      <Footer />
    </div>
  );
}
