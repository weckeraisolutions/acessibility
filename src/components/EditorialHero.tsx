import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, AudioLines, BookOpen, Check, ChevronLeft, ChevronRight, Eye, Pause, Play } from "lucide-react";

const HERO_INTERVAL = 8000;
const editorialSlides = [
  {
    name: "Infantil", title: "Pequenas histórias.", emphasis: "Grandes descobertas.",
    copy: "Dê voz aos livros infantis e descreva suas ilustrações. Prepare novas formas de acompanhar cada história, com revisão humana em cada etapa.",
    image: "/images/infantil-poster.jpg", alt: "Ilustração de duas crianças acompanhando um livro digital, uma delas usando fones de ouvido.",
    caption: "Ilustrações que também podem ser ouvidas", detail: "Livros infantis e histórias ilustradas", color: "orange",
  },
  {
    name: "Literário", title: "Muitas vozes.", emphasis: "Mais formas de ler.",
    copy: "Romances, contos e poesia de diferentes autores. Transforme o texto em narração e revise a leitura sem perder o estilo de cada obra.",
    image: "/images/literario.jpg", alt: "Um livro aberto entre estantes e pilhas de obras de diferentes autores em uma livraria.",
    caption: "Cada obra, com sua própria voz", detail: "Romances, contos, crônicas e poesia", color: "blue",
  },
  {
    name: "Educacional", title: "Conhecimento para", emphasis: "mais pessoas.",
    copy: "Prepare livros didáticos e materiais de estudo em áudio, com descrição de imagens e revisão do conteúdo. A acessibilidade começa na preparação de cada página.",
    image: "/images/educacional.jpg", alt: "Professora e estudante leem juntas um livro aberto sobre a mesa de uma biblioteca.",
    caption: "Aprender começa por ter acesso", detail: "Livros didáticos e materiais de estudo", color: "teal",
  },
];

export default function EditorialHero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rotating = !paused && !hovered && !hidden && !reducedMotion;
  const slide = editorialSlides[active];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(media.matches);
    const onVisibility = () => setHidden(document.hidden);
    media.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % editorialSlides.length), HERO_INTERVAL);
    return () => window.clearInterval(timer);
  }, [rotating, active]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active === 0 && rotating && !videoFailed) {
      void video.play().catch(() => setVideoPlaying(false));
    } else video.pause();
  }, [active, rotating, videoFailed]);

  const selectSlide = (index: number) => {
    setActive((index + editorialSlides.length) % editorialSlides.length);
    setPaused(true);
  };

  return (
    <section className={`studio-hero editorial-hero theme-${slide.color}`} aria-label="Livros para diferentes públicos" aria-roledescription="carrossel"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(true);
      }}>
      <div className="studio-glow studio-glow--blue" aria-hidden="true" />
      <div className="studio-glow studio-glow--orange" aria-hidden="true" />
      <div className="studio-container relative z-10 py-12 lg:py-20">
        <div className="editorial-hero-grid">
          <div className="editorial-hero-copy">
            <span className="studio-kicker"><BookOpen size={15} /> Produção editorial acessível</span>
            <h1 className="studio-display mt-6" aria-live="off">{slide.title}<br /><em>{slide.emphasis}</em></h1>
            <p className="hero-description">{slide.copy}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth?mode=signup" className="studio-button studio-button--primary">Criar primeiro projeto <ArrowRight size={17} /></Link>
              <a href="#como-funciona" className="studio-button studio-button--quiet">Conhecer o fluxo <ChevronRight size={16} /></a>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {["PDF como ponto de partida", "Revisão humana"].map(item => <span key={item} className="flex items-center gap-2"><Check size={15} className="text-green-300" />{item}</span>)}
            </div>
          </div>

          <div className="editorial-media" role="group" aria-roledescription="slide" aria-label={`${active + 1} de 3: ${slide.name}`}>
            {editorialSlides.map((item, index) => (
              <img key={item.name} src={item.image} alt={item.alt} width={1440} height={1080}
                aria-hidden={index !== active} className={`editorial-image ${index === active ? "is-active" : ""}`}
                decoding="async" />
            ))}
            <video ref={videoRef} loop muted playsInline preload="metadata" src="/videos/hero-bg.mp4"
              poster="/images/infantil-poster.jpg" aria-hidden="true" tabIndex={-1}
              className={`editorial-video ${active === 0 && videoPlaying && !videoFailed ? "is-active" : ""}`}
              onPlaying={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} onError={() => setVideoFailed(true)} />
            <div className="editorial-media-shade" aria-hidden="true" />
            <span className="editorial-media-tag">{slide.name}</span>
            <div className="editorial-media-caption"><strong>{slide.caption}</strong><span>{slide.detail}</span></div>
          </div>
        </div>

        <div className="editorial-controls">
          <div className="editorial-selectors" role="group" aria-label="Escolher público">
            {editorialSlides.map((item, index) => <button key={item.name} type="button" aria-pressed={active === index} onClick={() => selectSlide(index)}>
              <span aria-hidden="true">0{index + 1}</span>{item.name}
            </button>)}
          </div>
          <div className="flex items-center gap-2">
            <span className="sr-only" aria-live={rotating ? "off" : "polite"}>{slide.name}, {active + 1} de 3</span>
            <button className="studio-icon-button" type="button" aria-label="Variação anterior" onClick={() => selectSlide(active - 1)}><ChevronLeft size={18} /></button>
            <button className="studio-icon-button" type="button" aria-label="Próxima variação" onClick={() => selectSlide(active + 1)}><ChevronRight size={18} /></button>
            <button className="studio-button studio-button--quiet" type="button" disabled={reducedMotion}
              onClick={() => setPaused(value => !value)} aria-label={paused || reducedMotion ? "Retomar apresentação automática" : "Pausar apresentação automática"}>
              {paused || reducedMotion ? <Play size={15} /> : <Pause size={15} />}
              <span>{reducedMotion ? "Sem animação" : paused ? "Retomar" : "Pausar"}</span>
            </button>
          </div>
        </div>
        <div className="editorial-format-strip" aria-label="Formatos de produção">
          <span><AudioLines size={18} /> Audiobook</span><span><Eye size={18} /> Audiodescrição</span><span><BookOpen size={18} /> Revisão por página</span>
        </div>
      </div>
    </section>
  );
}
