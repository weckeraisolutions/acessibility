import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VLibras from "@djpfs/react-vlibras";
import {
  ArrowRight, AudioLines, BookOpen, Check, ChevronRight, Eye, FileText,
  Film, Menu, Pause, Play, ShieldCheck, Sparkles, Upload, WandSparkles, X,
} from "lucide-react";
import Logo from "@/components/Logo";
import SEO from "@/components/SEO";

const navLinks = [
  { label: "Solução", id: "solucao" },
  { label: "Fluxo", id: "como-funciona" },
  { label: "Conformidade", id: "conformidade" },
  { label: "Planos", id: "planos" },
];

const features = [
  { icon: AudioLines, eyebrow: "Narração", title: "Audiobook com controle editorial", copy: "Extraia, revise e gere a narração por página ou capítulo. Corrija apenas o trecho que precisa de atenção.", accent: "blue" },
  { icon: Eye, eyebrow: "Contexto visual", title: "Audiodescrição orientada por norma", copy: "Produza descrições objetivas e editáveis, com revisão humana antes da aprovação final.", accent: "teal" },
  { icon: Film, eyebrow: "Produção audiovisual", title: "Videobook organizado por capítulo", copy: "Sincronize páginas e áudio, gere o vídeo-base e prepare a entrega para o intérprete de Libras.", accent: "orange" },
];

const plans = [
  { name: "Free", price: "R$ 0", detail: "Para validar o primeiro fluxo", items: ["15 páginas por mês", "1 projeto", "Audiobook e audiodescrição"] },
  { name: "Creator", price: "R$ 97", detail: "Para produção recorrente", items: ["150 páginas por mês", "3 projetos", "Download por capítulo"] },
  { name: "Pro", price: "R$ 197", detail: "Para operação editorial", items: ["500 páginas por mês", "10 projetos", "Videobook e exportação"], featured: true },
];

const LandingPage = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleVideo = () => {
    const video = document.getElementById("hero-video") as HTMLVideoElement | null;
    if (!video) return;
    if (video.paused) { void video.play(); setPlaying(true); }
    else { video.pause(); setPlaying(false); }
  };

  return (
    <div className="studio-site min-h-screen overflow-x-hidden bg-background text-foreground">
      <SEO title="Accessibility — Produção editorial acessível" description="Transforme PDFs em audiobooks, audiodescrições e videobooks com uma esteira editorial acessível." path="/" />
      <VLibras forceOnload />

      <header className={`studio-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="studio-container flex h-[72px] items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Voltar ao topo" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Logo size="sm" /></button>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
            {navLinks.map((link) => <button key={link.id} onClick={() => scrollTo(link.id)} className="studio-nav-link">{link.label}</button>)}
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="studio-button studio-button--quiet hidden sm:inline-flex">Entrar</Link>
            <Link to="/auth" className="studio-button studio-button--primary hidden sm:inline-flex">Começar grátis <ArrowRight size={16} /></Link>
            <button className="studio-icon-button lg:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        {menuOpen && <nav className="studio-mobile-nav" aria-label="Navegação móvel">
          {navLinks.map((link) => <button key={link.id} onClick={() => { scrollTo(link.id); setMenuOpen(false); }}>{link.label}</button>)}
          <Link to="/auth">Acessar plataforma</Link>
        </nav>}
      </header>

      <main>
        <section className="studio-hero">
          <div className="studio-glow studio-glow--blue" /><div className="studio-glow studio-glow--orange" />
          <div className="studio-container relative z-10 grid items-center gap-12 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
            <div className="max-w-2xl">
              <div className="studio-kicker"><Sparkles size={14} /> Esteira editorial de acessibilidade</div>
              <h1 className="studio-display mt-7">Produza no ritmo do <em>pensamento.</em></h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">Transforme livros em audiobooks, audiodescrições e videobooks dentro de um fluxo único, revisável e orientado por exceções.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/auth" className="studio-button studio-button--primary">Criar primeiro projeto <ArrowRight size={17} /></Link>
                <button onClick={() => scrollTo("como-funciona")} className="studio-button studio-button--quiet"><Play size={16} /> Ver o fluxo</button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
                {["Revisão humana", "Arquivos privados", "Processo retomável"].map((item) => <span key={item} className="flex items-center gap-2"><Check size={15} className="text-[hsl(var(--success))]" />{item}</span>)}
              </div>
            </div>

            <div className="studio-product-frame" aria-label="Demonstração visual do Accessibility Studio">
              <div className="studio-window-bar">
                <div className="flex gap-1.5" aria-hidden="true"><span /><span /><span /></div>
                <span className="text-xs text-muted-foreground">Accessibility Studio · Projeto em revisão</span>
                <span className="studio-live"><span /> sincronizado</span>
              </div>
              <div className="studio-video-wrap">
                <video id="hero-video" autoPlay loop muted playsInline preload="metadata" src="/videos/hero-bg.mp4" />
                <div className="studio-video-shade" />
                <button onClick={toggleVideo} className="studio-video-control" aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
                <div className="studio-video-caption"><span>Capítulo 03</span><strong>O mundo que cabe em um livro</strong><small>Página 12 de 24 · narração aprovada</small></div>
              </div>
              <div className="studio-editor-strip">
                <div className="studio-mini-panel"><span className="studio-panel-label">Páginas</span><div className="studio-thumbnails"><span /><span className="active" /><span /></div></div>
                <div className="studio-mini-panel studio-wave-panel"><span className="studio-panel-label">Narração</span><div className="studio-wave" aria-hidden="true">{Array.from({ length: 24 }).map((_, i) => <i key={i} style={{ height: `${18 + ((i * 17) % 38)}%` }} />)}</div></div>
                <div className="studio-mini-panel"><span className="studio-panel-label">Exceções</span><strong className="studio-big-number">3</strong><small className="text-muted-foreground">itens para revisar</small></div>
              </div>
            </div>
          </div>
        </section>

        <section className="studio-proof-bar" aria-label="Públicos atendidos"><div className="studio-container flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {["Editoras", "Instituições de ensino", "Produtores editoriais", "Profissionais de acessibilidade", "Autores"].map((item) => <span key={item}>{item}</span>)}
        </div></section>

        <section id="solucao" className="studio-section"><div className="studio-container">
          <div className="studio-section-heading"><span className="studio-kicker"><WandSparkles size={14} /> Uma única operação</span><h2 className="studio-display studio-display--section">Do PDF à entrega, sem perder o contexto.</h2><p>O sistema organiza produção, revisão e aprovação para que o operador atue somente onde uma decisão humana é necessária.</p></div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {features.map(({ icon: Icon, eyebrow, title, copy, accent }) => <article key={title} className={`studio-feature-card studio-feature-card--${accent}`}><div className="studio-feature-icon"><Icon size={22} /></div><span className="studio-panel-label">{eyebrow}</span><h3>{title}</h3><p>{copy}</p><div className="studio-card-visual" aria-hidden="true"><span /><span /><span /><span /></div></article>)}
          </div>
        </div></section>

        <section id="como-funciona" className="studio-section studio-section--contrast"><div className="studio-container grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-28"><span className="studio-kicker"><FileText size={14} /> Fluxo visível</span><h2 className="studio-display studio-display--section mt-6">Cada etapa informa o próximo passo.</h2><p className="mt-5 max-w-lg text-muted-foreground">Progresso real, bloqueios compreensíveis e retomada segura. Sem depender de uma aba aberta para saber o que aconteceu.</p></div>
          <ol className="studio-process-list">
            {[
              [Upload, "Importar", "Envie o PDF e confirme a estrutura do livro."],
              [Sparkles, "Processar", "Texto, imagens e audiodescrições são preparados."],
              [Eye, "Revisar exceções", "A interface destaca apenas o que precisa de decisão."],
              [AudioLines, "Produzir narração", "Gere e aprove blocos, páginas ou capítulos."],
              [Film, "Exportar", "Monte o vídeo-base e organize a entrega editorial."],
            ].map(([Icon, title, copy], index) => { const StepIcon = Icon as typeof Upload; return <li key={title as string}><span className="studio-step-number">0{index + 1}</span><span className="studio-step-icon"><StepIcon size={20} /></span><div><h3>{title as string}</h3><p>{copy as string}</p></div><ChevronRight size={18} className="text-muted-foreground" /></li>; })}
          </ol>
        </div></section>

        <section id="conformidade" className="studio-section"><div className="studio-container"><div className="studio-compliance-panel">
          <div><span className="studio-kicker"><ShieldCheck size={14} /> Acessibilidade desde a interface</span><h2 className="studio-display studio-display--section mt-6">Produzir conteúdo acessível exige uma ferramenta acessível.</h2><p className="mt-5 max-w-2xl text-muted-foreground">Navegação por teclado, foco visível, contraste, linguagem operacional e estados que não dependem somente de cor fazem parte do produto.</p></div>
          <div className="studio-compliance-grid">{["Lei Brasileira de Inclusão", "ABNT NBR 16452", "Fluxos por teclado", "Revisão humana"].map((item) => <span key={item}><Check size={16} />{item}</span>)}</div>
        </div></div></section>

        <section id="planos" className="studio-section studio-section--contrast"><div className="studio-container">
          <div className="studio-section-heading"><span className="studio-kicker">Comece pequeno</span><h2 className="studio-display studio-display--section">Um plano para cada ritmo de produção.</h2></div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">{plans.map((plan) => <article key={plan.name} className={`studio-plan ${plan.featured ? "is-featured" : ""}`}>{plan.featured && <span className="studio-plan-badge">Mais escolhido</span>}<h3>{plan.name}</h3><p>{plan.detail}</p><div className="studio-price">{plan.price}<small>/mês</small></div><ul>{plan.items.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul><Link to="/auth" className={`studio-button ${plan.featured ? "studio-button--primary" : "studio-button--quiet"}`}>Escolher {plan.name}</Link></article>)}</div>
        </div></section>

        <section className="studio-final-cta"><div className="studio-container text-center"><BookOpen size={30} className="mx-auto text-primary" /><h2 className="studio-display studio-display--section mx-auto mt-6 max-w-3xl">Seu próximo livro pode nascer acessível.</h2><p className="mx-auto mt-5 max-w-xl text-muted-foreground">Crie um projeto, envie o PDF e acompanhe toda a produção em uma única esteira.</p><Link to="/auth" className="studio-button studio-button--primary mt-8">Começar grátis <ArrowRight size={17} /></Link></div></section>
      </main>

      <footer className="studio-footer"><div className="studio-container flex flex-col items-center justify-between gap-5 py-8 md:flex-row"><Logo size="sm" /><p>Produção editorial acessível, do PDF à entrega.</p><Link to="/auth">Acessar plataforma</Link></div></footer>
    </div>
  );
};

export default LandingPage;
