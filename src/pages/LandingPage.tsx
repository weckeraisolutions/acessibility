import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Upload, Brain, Pencil, Download, BookOpen, Image, Film,
  Shield, FileText, Mic, School, GraduationCap, Accessibility,
  BookMarked, Check, Menu, X, Play, Plus, Minus, ChevronRight, Sparkles,
} from "lucide-react";

/* ═══════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════ */

function useReveal() {
  useEffect(() => {
    const reveal = () => {
      document.querySelectorAll(".lp-reveal:not(.visible)").forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight - 40) {
          el.classList.add("visible");
        }
      });
    };
    // Run once immediately after a tick
    requestAnimationFrame(reveal);
    window.addEventListener("scroll", reveal, { passive: true });
    return () => window.removeEventListener("scroll", reveal);
  }, []);
}

function useCounter(end: number, duration = 2000) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setVal(Math.round(eased * end));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [end, duration]);
  return { ref, val };
}

/* Particle canvas */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; };
    resize();
    window.addEventListener("resize", resize);
    const N = 60;
    for (let i = 0; i < N; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2 + 1,
      });
    }
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        if (!prefersReduced) { p.x += p.vx; p.y += p.vy; }
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(79,172,222,0.4)";
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 160) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(79,172,222,${0.15 * (1 - d / 160)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.6 }} />;
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

/* ═══════════════════════════════════════════
   LOGO
   ═══════════════════════════════════════════ */
const Logo = () => (
  <div className="flex items-center gap-2">
    <svg width={32} height={32} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="10" r="4" fill="#4FACDE" />
      <path d="M24 16c-3 0-5.5 1-7 2l1.5 3c1.2-.8 3.2-1.5 5.5-1.5s4.3.7 5.5 1.5l1.5-3c-1.5-1-4-2-7-2z" fill="#4FACDE" />
      <path d="M21 22v10h2.5v-4h1v4H27V22h-1.5v4h-3v-4H21z" fill="#4FACDE" />
      <path d="M34 18c1.5 1.5 2.5 3.5 2.5 6s-1 4.5-2.5 6" stroke="#2E86C1" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M38 14c2.5 2.8 4 6.2 4 10s-1.5 7.2-4 10" stroke="#2E86C1" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
    </svg>
    <span className="font-outfit font-semibold text-lg tracking-tight" style={{ color: "var(--lp-text-primary)" }}>Accessibility</span>
  </div>
);

/* ═══════════════════════════════════════════
   FAQ ITEM
   ═══════════════════════════════════════════ */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-card mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-blue-mid)] rounded-2xl"
        aria-expanded={open}
      >
        <span className="font-outfit font-medium text-[15px]" style={{ color: "var(--lp-text-primary)" }}>{q}</span>
        <span className="ml-4 shrink-0 transition-transform duration-300" style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)", color: "var(--lp-blue-bright)" }}>
          <Plus size={18} />
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-400"
        style={{ maxHeight: open ? "400px" : "0px", opacity: open ? 1 : 0, transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease" }}
      >
        <p className="px-5 pb-5 font-outfit text-sm leading-relaxed" style={{ color: "var(--lp-text-secondary)" }}>{a}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
const LandingPage = () => {
  useReveal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const navLinks = [
    { label: "Solução", id: "solucao" },
    { label: "Funcionalidades", id: "funcionalidades" },
    { label: "Como Funciona", id: "como-funciona" },
    { label: "Conformidade", id: "conformidade" },
    { label: "Planos", id: "planos" },
    { label: "FAQ", id: "faq" },
  ];

  const c1 = useCounter(45600000, 2500);
  const c2 = useCounter(6500000, 2500);
  const c3 = useCounter(10000000, 2500);

  const bgStyle: React.CSSProperties = {
    backgroundColor: "var(--lp-bg-base)",
    backgroundImage: `
      radial-gradient(ellipse 80% 60% at 20% 10%, rgba(46,134,193,0.15) 0%, transparent 60%),
      radial-gradient(ellipse 60% 80% at 80% 20%, rgba(26,188,156,0.10) 0%, transparent 55%),
      radial-gradient(ellipse 70% 50% at 50% 80%, rgba(30,58,95,0.20) 0%, transparent 60%),
      radial-gradient(ellipse 40% 40% at 90% 90%, rgba(230,126,34,0.08) 0%, transparent 50%)`,
  };

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} milhões`;
    return n.toLocaleString("pt-BR");
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={bgStyle}>

      {/* ──── HEADER ──── */}
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(8,12,20,0.95)" : "rgba(8,12,20,0.8)",
          backdropFilter: `blur(${scrolled ? 32 : 24}px)`,
          WebkitBackdropFilter: `blur(${scrolled ? 32 : 24}px)`,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-blue-mid)] rounded" aria-label="Voltar ao topo">
            <Logo />
          </button>

          <nav className="hidden lg:flex items-center gap-7" aria-label="Navegação principal">
            {navLinks.map((l) => (
              <button key={l.id} onClick={() => scrollTo(l.id)} className="font-outfit text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-blue-mid)] rounded px-1" style={{ color: "var(--lp-text-secondary)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--lp-text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--lp-text-secondary)")}
              >{l.label}</button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden lg:inline-flex items-center justify-center font-outfit font-medium text-sm px-5 py-2.5 rounded-lg text-white transition-all duration-200" style={{ background: "var(--lp-blue-mid)" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 20px var(--lp-blue-glow)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
            >Acessar Plataforma</Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden p-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-blue-mid)]" style={{ color: "var(--lp-text-primary)" }} aria-label="Menu">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(8,12,20,0.97)", backdropFilter: "blur(24px)" }}>
            <div className="flex flex-col gap-1 p-4">
              {navLinks.map((l) => (
                <button key={l.id} onClick={() => { scrollTo(l.id); setMenuOpen(false); }}
                  className="font-outfit text-sm py-2.5 px-3 rounded-lg text-left transition-colors" style={{ color: "var(--lp-text-secondary)" }}>{l.label}</button>
              ))}
              <Link to="/auth" className="font-outfit font-medium text-sm py-2.5 px-3 rounded-lg text-white text-center mt-2" style={{ background: "var(--lp-blue-mid)" }}>Acessar Plataforma</Link>
            </div>
          </div>
        )}
      </header>

      {/* ──── HERO ──── */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{ filter: "blur(6px) brightness(0.4)", opacity: 0.7, transform: "scale(1.1)" }}
          src="/videos/hero-bg.mp4"
        />
        <ParticleCanvas />
        <div className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8 w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16">
          {/* Left */}
          <div className="lp-reveal">

            <h1 className="font-serif leading-[1.08] mb-6" style={{
              fontSize: "clamp(42px, 6vw, 76px)",
              background: "linear-gradient(135deg, #ffffff 0%, #4FACDE 40%, #1abc9c 70%, #ffffff 100%)",
              backgroundSize: "200% 200%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "gradientShift 6s ease infinite",
            }}>
              Transforme qualquer livro em uma experiência acessível
            </h1>
            <style>{`@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>

            <p className="font-outfit text-base lg:text-lg leading-relaxed max-w-xl mb-8" style={{ color: "var(--lp-text-secondary)" }}>
              Plataforma SaaS com inteligência artificial para geração de Audiobooks, Audiodescrições e Videobooks a partir de qualquer PDF — em conformidade com a Lei Brasileira de Inclusão e as normas ABNT.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <Link to="/auth" className="inline-flex items-center justify-center font-outfit font-semibold text-sm px-7 py-4 rounded-xl text-white transition-all duration-200" style={{ background: "var(--lp-orange)" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 30px var(--lp-orange-glow), 0 4px 16px rgba(0,0,0,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
              >Começar Agora — É Grátis</Link>
              <button onClick={() => scrollTo("como-funciona")} className="glass-card inline-flex items-center gap-2 font-outfit text-sm px-6 py-4 rounded-xl" style={{ color: "var(--lp-text-primary)" }}>
                <Play size={16} /> Ver Demonstração
              </button>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {["Conforme Lei 13.146/2015", "ABNT NBR 16452:2016", "Sem instalação"].map(t => (
                <span key={t} className="flex items-center gap-1.5 font-outfit text-xs" style={{ color: "var(--lp-text-muted)" }}>
                  <Check size={14} style={{ color: "var(--lp-green)" }} /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — Mockup */}
          <div className="lp-reveal hidden lg:block" style={{ perspective: "1000px" }}>
            <div style={{
              background: "rgba(13,20,36,0.9)", backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 20, boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
              animation: "float 6s ease-in-out infinite", overflow: "hidden",
            }}>
              <style>{`@keyframes float{0%,100%{transform:perspective(1000px) rotateY(-6deg) rotateX(2deg) translateY(0)}50%{transform:perspective(1000px) rotateY(-6deg) rotateX(2deg) translateY(-10px)}}`}</style>
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
                <span className="ml-3 font-outfit text-xs" style={{ color: "var(--lp-text-muted)" }}>Editor — Audiobook</span>
              </div>
              {/* Content */}
              <div className="p-5 grid grid-cols-4 gap-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="rounded-lg aspect-[3/4]" style={{ background: i===1 ? "rgba(46,134,193,0.2)" : "rgba(255,255,255,0.03)", border: i===1 ? "1px solid rgba(79,172,222,0.4)" : "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="p-2">
                      <div className="w-full h-1.5 rounded-full mb-1.5" style={{ background: "rgba(255,255,255,0.08)" }} />
                      <div className="w-3/4 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Text area */}
              <div className="px-5 pb-3 space-y-2">
                {[100, 85, 92, 60].map((w, i) => (
                  <div key={i} className="h-2 rounded-full overflow-hidden" style={{ width: `${w}%`, background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: "60%", background: "linear-gradient(90deg, rgba(79,172,222,0.3), rgba(79,172,222,0.05))", animation: "shimmer 2s infinite" }} />
                  </div>
                ))}
                <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
              </div>
              {/* Player */}
              <div className="mx-5 mb-5 p-3 rounded-xl flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--lp-blue-mid)" }}><Play size={14} fill="white" stroke="white" /></div>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: "35%", background: "var(--lp-blue-mid)", animation: "playerProgress 4s ease-in-out infinite alternate" }} />
                  </div>
                  <style>{`@keyframes playerProgress{0%{width:20%}100%{width:65%}}`}</style>
                </div>
                <span className="font-outfit text-[10px]" style={{ color: "var(--lp-text-muted)" }}>1:24</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──── NÚMEROS ──── */}
      <section id="solucao" className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="glass-card p-10 lg:p-14 lp-reveal">
            <div className="grid md:grid-cols-3 gap-10 text-center lp-reveal-stagger">
              {[
                { ref: c1.ref, val: c1.val, label: "Brasileiros com alguma deficiência (IBGE 2022)" },
                { ref: c2.ref, val: c2.val, label: "Pessoas com deficiência visual no Brasil" },
                { ref: c3.ref, val: c3.val, label: "Pessoas surdas no Brasil" },
              ].map((item, i) => (
                <div key={i} ref={item.ref} className="lp-reveal">
                  <div className="font-serif italic text-4xl lg:text-5xl mb-3" style={{ color: "var(--lp-blue-bright)" }}>{formatNum(item.val)}</div>
                  <p className="font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 pt-8" style={{ borderTop: "1px solid var(--lp-glass-border)" }}>
              <p className="font-outfit text-center text-sm" style={{ color: "var(--lp-text-muted)" }}>Cada livro publicado sem acessibilidade é uma barreira. A Accessibility derruba essas barreiras.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ──── FUNCIONALIDADES ──── */}
      <section id="funcionalidades" className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-3xl lg:text-5xl text-center mb-4 lp-reveal" style={{ color: "var(--lp-text-primary)" }}>
            Três recursos. Uma solução{" "}
            <span style={{ background: "linear-gradient(135deg, #4FACDE, #1abc9c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>completa</span>.
          </h2>
          <p className="font-outfit text-center mb-14 lp-reveal" style={{ color: "var(--lp-text-secondary)" }}>Tudo o que você precisa para transformar livros em materiais acessíveis.</p>

          <div className="grid md:grid-cols-3 gap-6 lp-reveal-stagger">
            {[
              { icon: BookOpen, title: "Audiobook com IA", desc: "Extração inteligente do texto com reconhecimento de contexto pedagógico. Narração profissional com vozes ultra-realistas em português brasileiro, via Gemini TTS ou ElevenLabs.", badge: "Conforme NBR 15599", glow: "rgba(79,172,222,0.4)", color: "#4FACDE" },
              { icon: Image, title: "Audiodescrição Inteligente", desc: "Descrição precisa de elementos visuais seguindo a ABNT NBR 16452:2016. Nível de detalhe proporcional ao contexto pedagógico de cada página.", badge: "Conforme NBR 16452:2016", glow: "rgba(26,188,156,0.4)", color: "#1abc9c" },
              { icon: Film, title: "Videobook Animado", desc: "Páginas do livro em vídeo animado sincronizado com narração. Animações Ken Burns, Spotlight e Pan. Editor visual com linha do tempo. Exportação MP4.", badge: "Planos Pro e Enterprise", glow: "rgba(230,126,34,0.4)", color: "#E67E22" },
            ].map((f, i) => (
              <div key={i} className="glass-card p-7 flex flex-col lp-reveal group"
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${f.color}33`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--lp-glass-border)")}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: `${f.color}15`, boxShadow: `0 0 20px ${f.glow}` }}>
                  <f.icon size={22} style={{ color: f.color }} />
                </div>
                <h3 className="font-outfit font-semibold text-lg mb-3" style={{ color: "var(--lp-text-primary)" }}>{f.title}</h3>
                <p className="font-outfit text-sm leading-relaxed mb-5 flex-1" style={{ color: "var(--lp-text-secondary)" }}>{f.desc}</p>
                <span className="inline-flex self-start items-center font-outfit text-xs px-3 py-1 rounded-full" style={{ border: `1px solid ${f.color}40`, color: f.color }}>{f.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── COMO FUNCIONA ──── */}
      <section id="como-funciona" className="py-20 lg:py-28 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(46,134,193,0.05) 0%, transparent 70%)" }} />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-3xl lg:text-5xl text-center mb-4 lp-reveal" style={{ color: "var(--lp-text-primary)" }}>Do PDF ao audiobook em minutos</h2>
          <p className="font-outfit text-center mb-16 lp-reveal" style={{ color: "var(--lp-text-secondary)" }}>Quatro passos simples para transformar qualquer livro.</p>

          <div className="grid md:grid-cols-4 gap-6 lp-reveal-stagger">
            {[
              { icon: Upload, num: "01", title: "Upload", desc: "Faça upload do PDF do livro. A plataforma processa automaticamente todas as páginas, sem limite de tamanho." },
              { icon: Brain, num: "02", title: "Extração Inteligente", desc: "A IA analisa cada página, identifica o tipo de conteúdo e extrai texto para narração ou descrição visual." },
              { icon: Pencil, num: "03", title: "Revisão e Edição", desc: "Revise o texto gerado na plataforma. Ajuste voz, estilo de narração e configurações por página." },
              { icon: Download, num: "04", title: "Geração e Download", desc: "Gere os áudios com um clique. Download de MP3 individuais, por capítulo ou livro completo em ZIP." },
            ].map((step, i) => (
              <div key={i} className="glass-card p-6 relative lp-reveal">
                <span className="font-serif text-6xl absolute top-4 right-4 select-none" style={{ color: "var(--lp-text-muted)", opacity: 0.3 }}>{step.num}</span>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: "rgba(79,172,222,0.1)" }}>
                  <step.icon size={20} style={{ color: "var(--lp-blue-bright)" }} />
                </div>
                <h3 className="font-outfit font-semibold text-base mb-2" style={{ color: "var(--lp-text-primary)" }}>{step.title}</h3>
                <p className="font-outfit text-sm leading-relaxed" style={{ color: "var(--lp-text-secondary)" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── CONFORMIDADE LEGAL ──── */}
      <section id="conformidade" className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-3xl lg:text-5xl text-center mb-4 lp-reveal" style={{ color: "var(--lp-text-primary)" }}>Conformidade com a legislação brasileira</h2>
          <p className="font-outfit text-center mb-14 lp-reveal" style={{ color: "var(--lp-text-secondary)" }}>Desenvolvido em conformidade total com as normas de acessibilidade.</p>

          <div className="lp-reveal p-8 lg:p-12 rounded-3xl relative" style={{ background: "rgba(30,58,95,0.15)", border: "1px solid rgba(46,134,193,0.2)" }}>
            <div className="grid md:grid-cols-3 gap-8 lp-reveal-stagger">
              {[
                { icon: Shield, title: "Lei nº 13.146/2015", sub: "Lei Brasileira de Inclusão", desc: "Garante o direito de acesso à informação em igualdade de condições. O artigo 68 determina a obrigatoriedade de livros em formatos acessíveis.", color: "#4FACDE" },
                { icon: FileText, title: "ABNT NBR 16452:2016", sub: "Norma de Audiodescrição", desc: "Os prompts de extração visual seguem as diretrizes técnicas desta norma — objetividade, presente do indicativo, do geral para o específico.", color: "#1abc9c" },
                { icon: Mic, title: "Lei nº 10.436/2002", sub: "Lei Libras + Decreto 5.626", desc: "Reconhece a Língua Brasileira de Sinais como meio legal de comunicação. A audiodescrição gerada pode ser base para produção de conteúdo em Libras.", color: "#E67E22" },
              ].map((law, i) => (
                <div key={i} className="lp-reveal">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${law.color}15` }}>
                    <law.icon size={20} style={{ color: law.color }} />
                  </div>
                  <h3 className="font-outfit font-semibold text-base mb-1" style={{ color: law.color }}>{law.title}</h3>
                  <p className="font-outfit text-xs font-medium mb-3" style={{ color: "var(--lp-teal)" }}>{law.sub}</p>
                  <p className="font-outfit text-sm leading-relaxed" style={{ color: "var(--lp-text-secondary)" }}>{law.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 pt-8 text-center" style={{ borderTop: "1px solid rgba(46,134,193,0.15)" }}>
              <p className="font-serif italic text-lg lg:text-xl" style={{ color: "var(--lp-text-secondary)" }}>
                "Conformidade legal não é diferencial — é obrigação. A Accessibility entrega as duas coisas."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ──── PARA QUEM É ──── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-3xl lg:text-5xl text-center mb-14 lp-reveal" style={{ color: "var(--lp-text-primary)" }}>Quem usa a Accessibility</h2>
          <div className="grid sm:grid-cols-2 gap-5 lp-reveal-stagger">
            {[
              { icon: School, title: "Editoras e Produtoras Editoriais", desc: "Transforme seu catálogo inteiro em formato acessível. Atenda às obrigações legais e amplie seu mercado." },
              { icon: GraduationCap, title: "Secretarias de Educação e Escolas", desc: "Ofereça materiais didáticos acessíveis para alunos com deficiência visual, auditiva ou dificuldades de leitura." },
              { icon: Accessibility, title: "Profissionais de Acessibilidade", desc: "Acelere seu fluxo de produção de audiobooks e audiodescrições com suporte de IA especializada em normas brasileiras." },
              { icon: BookMarked, title: "Autores e Independentes", desc: "Publique seu livro já acessível desde o lançamento, sem depender de terceiros." },
            ].map((a, i) => (
              <div key={i} className="glass-card p-6 flex gap-5 lp-reveal group"
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(230,126,34,0.3)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--lp-glass-border)")}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(230,126,34,0.1)" }}>
                  <a.icon size={20} style={{ color: "var(--lp-orange)" }} />
                </div>
                <div>
                  <h3 className="font-outfit font-semibold text-base mb-1" style={{ color: "var(--lp-text-primary)" }}>{a.title}</h3>
                  <p className="font-outfit text-sm leading-relaxed" style={{ color: "var(--lp-text-secondary)" }}>{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── PLANOS ──── */}
      <section id="planos" className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-3xl lg:text-5xl text-center mb-4 lp-reveal" style={{ color: "var(--lp-text-primary)" }}>Planos para cada necessidade</h2>
          <p className="font-outfit text-center mb-14 lp-reveal" style={{ color: "var(--lp-text-secondary)" }}>Comece grátis. Escale quando precisar.</p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-start lp-reveal-stagger">
            {/* Free Plan */}
            <div className="glass-card p-6 lp-reveal">
              <h3 className="font-outfit font-semibold text-lg mb-1" style={{ color: "var(--lp-text-primary)" }}>Free</h3>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="font-serif text-4xl" style={{ color: "var(--lp-text-primary)" }}>R$ 0</span>
                <span className="font-outfit text-sm" style={{ color: "var(--lp-text-muted)" }}>/mês</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> 1 projeto
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> 15 páginas por mês
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> TTS Google (padrão)
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> Audiobook básico
                </li>
              </ul>
              <Link to="/auth" className="block text-center font-outfit font-semibold text-sm py-3 rounded-xl transition-all duration-200"
                style={{ background: "var(--lp-glass-bg)", border: "1px solid var(--lp-glass-border)", color: "var(--lp-text-primary)" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.background = "var(--lp-glass-bg-hover)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.background = "var(--lp-glass-bg)"; }}
              >Começar Grátis</Link>
            </div>

            {/* Creator Plan */}
            <div className="glass-card p-6 lp-reveal">
              <h3 className="font-outfit font-semibold text-lg mb-1" style={{ color: "var(--lp-text-primary)" }}>Creator</h3>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="font-serif text-4xl" style={{ color: "var(--lp-text-primary)" }}>R$ 147</span>
                <span className="font-outfit text-sm" style={{ color: "var(--lp-text-muted)" }}>/mês</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> 3 projetos
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> 90 páginas por mês
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> TTS Google (padrão)
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> Audiobook + Audiodescrição
                </li>
              </ul>
              <Link to="/auth" className="block text-center font-outfit font-semibold text-sm py-3 rounded-xl transition-all duration-200"
                style={{ background: "var(--lp-blue-mid)", color: "white" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.background = "var(--lp-blue-bright)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.background = "var(--lp-blue-mid)"; }}
              >Escolher Creator</Link>
            </div>

            {/* Pro Plan - Featured */}
            <div className="glass-card p-6 lp-reveal relative lg:scale-[1.02]"
              style={{ background: "rgba(46,134,193,0.08)", border: "1px solid rgba(79,172,222,0.3)", boxShadow: "0 0 40px rgba(46,134,193,0.15), 0 8px 32px rgba(0,0,0,0.4)" }}
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-outfit text-xs font-semibold px-4 py-1 rounded-full text-white" style={{ background: "var(--lp-orange)", boxShadow: "0 0 16px var(--lp-orange-glow)" }}>Mais popular</span>
              <h3 className="font-outfit font-semibold text-lg mb-1 pt-1" style={{ color: "var(--lp-text-primary)" }}>Pro</h3>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="font-serif text-4xl" style={{ color: "var(--lp-text-primary)" }}>R$ 297</span>
                <span className="font-outfit text-sm" style={{ color: "var(--lp-text-muted)" }}>/mês</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> 10 projetos
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> 250 páginas por mês
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-blue-bright)" }}>
                  <Sparkles size={15} style={{ color: "var(--lp-teal)" }} /> TTS Premium ElevenLabs
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> Tudo do Creator + Videobook
                </li>
              </ul>
              <Link to="/auth" className="block text-center font-outfit font-semibold text-sm py-3 rounded-xl transition-all duration-200"
                style={{ background: "linear-gradient(135deg, var(--lp-orange), #f39c12)", color: "white" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 0 24px var(--lp-orange-glow)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >Escolher Pro</Link>
            </div>

            {/* Enterprise Plan */}
            <div className="glass-card p-6 lp-reveal" style={{ border: "1px solid rgba(79,172,222,0.2)" }}>
              <h3 className="font-outfit font-semibold text-lg mb-1" style={{ color: "var(--lp-text-primary)" }}>Enterprise</h3>
              <div className="mb-5">
                <span className="font-serif text-2xl" style={{ color: "var(--lp-text-secondary)" }}>Entre em contato</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> Tudo dos anteriores
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> Volumes ilimitados
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> Suporte dedicado
                </li>
                <li className="flex items-center gap-2.5 font-outfit text-sm" style={{ color: "var(--lp-text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--lp-green)" }} /> Onboarding personalizado
                </li>
              </ul>
              <Link to="/auth" className="block text-center font-outfit font-semibold text-sm py-3 rounded-xl transition-all duration-200"
                style={{ background: "transparent", border: "1px solid rgba(79,172,222,0.3)", color: "var(--lp-blue-bright)" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.background = "rgba(79,172,222,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.background = "transparent"; }}
              >Falar com Vendas</Link>
            </div>
          </div>
          <p className="font-outfit text-center text-xs mt-8 lp-reveal" style={{ color: "var(--lp-text-muted)" }}>Todos os planos incluem acesso completo às funcionalidades do nível. Cancele quando quiser.</p>
        </div>
      </section>

      {/* ──── FAQ ──── */}
      <section id="faq" className="py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <h2 className="font-serif text-3xl lg:text-5xl text-center mb-14 lp-reveal" style={{ color: "var(--lp-text-primary)" }}>Perguntas frequentes</h2>
          <div className="lp-reveal">
            {[
              { q: "A plataforma funciona com qualquer tipo de livro?", a: "Sim. A Accessibility suporta livros didáticos, literários, técnicos, infantis e gerais. A inteligência artificial adapta as regras de extração ao tipo de livro selecionado." },
              { q: "As audiodescrições realmente seguem a ABNT NBR 16452:2016?", a: "Sim. Os prompts enviados à IA foram desenvolvidos com o conteúdo técnico real da norma — incluindo regras de redação, objetividade, proporcionalidade ao contexto e critérios de inclusão e exclusão de elementos visuais." },
              { q: "Qual a diferença entre Gemini TTS e ElevenLabs?", a: "O Gemini TTS oferece 30 vozes de alta qualidade com excelente pronúncia em português brasileiro. O ElevenLabs, disponível no plano Enterprise, oferece vozes ultra-realistas com naturalidade ainda maior, ideal para audiobooks comerciais." },
              { q: "Posso editar o texto antes de gerar o áudio?", a: "Sim. O texto extraído pela IA é totalmente editável antes da geração do áudio. Você pode corrigir, adicionar ou remover conteúdo conforme necessário." },
              { q: "Os arquivos gerados têm uso comercial?", a: "Sim. Os arquivos MP3, ZIP e MP4 gerados pela plataforma podem ser utilizados comercialmente como parte dos materiais acessíveis do seu produto editorial." },
              { q: "Existe limite de tamanho de arquivo PDF?", a: "O limite atual é de 100MB por arquivo, o que comporta a grande maioria dos livros didáticos e literários." },
            ].map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
          </div>
        </div>
      </section>

      {/* ──── CTA FINAL ──── */}
      <section className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(135deg, var(--lp-blue-deep) 0%, var(--lp-blue-mid) 50%, var(--lp-blue-deep) 100%)",
          opacity: 0.3,
        }} />
        <div className="absolute top-0 left-[10%] w-64 h-64 rounded-full pointer-events-none" style={{ background: "var(--lp-teal-glow)", filter: "blur(100px)" }} />
        <div className="absolute bottom-0 right-[10%] w-64 h-64 rounded-full pointer-events-none" style={{ background: "var(--lp-orange-glow)", filter: "blur(100px)" }} />
        <div className="relative z-10 mx-auto max-w-3xl px-5 text-center lp-reveal">
          <h2 className="font-serif text-3xl lg:text-5xl mb-5" style={{
            background: "linear-gradient(135deg, #ffffff, #4FACDE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Comece agora. Seu primeiro projeto é grátis.</h2>
          <p className="font-outfit text-base mb-10" style={{ color: "var(--lp-text-secondary)" }}>Junte-se a editoras, escolas e profissionais de acessibilidade que já transformam seus materiais com a Accessibility.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/auth" className="inline-flex items-center font-outfit font-semibold text-sm px-8 py-4 rounded-xl text-white transition-all duration-200" style={{ background: "var(--lp-orange)" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 30px var(--lp-orange-glow)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
            >Criar conta gratuita</Link>
            <a href="mailto:contato@accessibility.com.br" className="glass-card inline-flex items-center font-outfit text-sm px-7 py-4 rounded-xl" style={{ color: "var(--lp-text-primary)" }}>Falar com nossa equipe</a>
          </div>
        </div>
      </section>

      {/* ──── FOOTER ──── */}
      <footer style={{ background: "var(--lp-bg-surface)", borderTop: "1px solid var(--lp-glass-border)" }}>
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-14">
          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <Logo />
              <p className="font-outfit text-sm mt-4 leading-relaxed" style={{ color: "var(--lp-text-secondary)" }}>Plataforma SaaS de acessibilidade editorial com inteligência artificial. Audiobooks, audiodescrições e videobooks em conformidade com a legislação brasileira.</p>
            </div>
            <div>
              <h4 className="font-outfit font-semibold text-sm mb-4" style={{ color: "var(--lp-text-primary)" }}>Links</h4>
              <ul className="space-y-2">
                {[
                  { label: "Funcionalidades", action: () => scrollTo("funcionalidades") },
                  { label: "Planos", action: () => scrollTo("planos") },
                ].map((l, i) => (
                  <li key={i}><button onClick={l.action} className="font-outfit text-sm transition-colors duration-200" style={{ color: "var(--lp-text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--lp-blue-bright)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--lp-text-secondary)")}
                  >{l.label}</button></li>
                ))}
                <li><Link to="/auth" className="font-outfit text-sm transition-colors duration-200" style={{ color: "var(--lp-text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--lp-blue-bright)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--lp-text-secondary)")}
                >Acessar plataforma</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-outfit font-semibold text-sm mb-4" style={{ color: "var(--lp-text-primary)" }}>Conformidade</h4>
              <ul className="space-y-2">
                {["Lei nº 13.146/2015 (LBI)", "ABNT NBR 16452:2016", "Lei nº 10.436/2002", "Decreto nº 5.626/2005"].map((n) => (
                  <li key={n} className="font-outfit text-sm" style={{ color: "var(--lp-text-muted)" }}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-6 flex flex-col md:flex-row justify-between gap-4" style={{ borderTop: "1px solid var(--lp-glass-border)" }}>
            <span className="font-outfit text-xs" style={{ color: "var(--lp-text-muted)" }}>© 2025 Accessibility. Todos os direitos reservados.</span>
            <span className="font-outfit text-xs" style={{ color: "var(--lp-text-muted)" }}>Desenvolvido em conformidade com as normas brasileiras de acessibilidade.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
