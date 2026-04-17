import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
// @ts-ignore - no types shipped
import VLibras from "@djpfs/react-vlibras";
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
    <span className="font-semibold text-lg tracking-tight" style={{ color: "var(--lp-text-primary)" }}>Accessibility</span>
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
        className="w-full flex items-center justify-between p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4FACDE] rounded-2xl"
        aria-expanded={open}
      >
        <span className="font-medium text-[15px]" style={{ color: "var(--lp-text-primary)" }}>{q}</span>
        <span className="ml-4 shrink-0 transition-transform duration-300" style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)", color: "var(--lp-accent-blue)" }}>
          <Plus size={18} />
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-400"
        style={{ maxHeight: open ? "400px" : "0px", opacity: open ? 1 : 0, transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease" }}
      >
        <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: "var(--lp-text-secondary)" }}>{a}</p>
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

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} milhões`;
    return n.toLocaleString("pt-BR");
  };

  const logoItems = [
    "🏫 Secretarias de Educação",
    "📚 Editoras Educacionais",
    "♿ Profissionais de Acessibilidade",
    "🎓 Instituições de Ensino",
    "📖 Autores Independentes",
    "🏛️ Ministério da Educação",
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: "var(--lp-bg-base)" }}>

      {/* Global keyframes */}
      <style>{`
        @keyframes float{0%,100%{transform:perspective(1000px) rotateY(-6deg) rotateX(2deg) translateY(0)}50%{transform:perspective(1000px) rotateY(-6deg) rotateX(2deg) translateY(-10px)}}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        @keyframes playerProgress{0%{width:20%}100%{width:65%}}
        @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}
        @keyframes scroll-logos{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes shield-glow{0%,100%{filter:drop-shadow(0 0 8px rgba(79,172,222,0.3))}50%{filter:drop-shadow(0 0 20px rgba(79,172,222,0.6))}}
      `}</style>

      {/* ──── HEADER ──── */}
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300 lp-bg-base"
        style={{
          background: scrolled ? "rgba(6,10,16,0.95)" : "rgba(6,10,16,0.8)",
          backdropFilter: `blur(${scrolled ? 32 : 24}px)`,
          WebkitBackdropFilter: `blur(${scrolled ? 32 : 24}px)`,
          borderBottom: "1px solid var(--lp-glass-border)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4FACDE] rounded" aria-label="Voltar ao topo">
            <Logo />
          </button>

          <nav className="hidden lg:flex items-center gap-7" aria-label="Navegação principal">
            {navLinks.map((l) => (
              <button key={l.id} onClick={() => scrollTo(l.id)} className="text-[15px] font-medium tracking-[0.01em] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4FACDE] rounded px-1" style={{ color: "var(--lp-text-secondary)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--lp-text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--lp-text-secondary)")}
              >{l.label}</button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden lg:inline-flex items-center justify-center font-semibold text-[15px] tracking-[0.02em] px-5 py-2.5 rounded-lg text-white transition-all duration-200" style={{ background: "var(--lp-blue-mid)" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 20px var(--lp-blue-glow)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
            >Acessar Plataforma</Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden p-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4FACDE]" style={{ color: "var(--lp-text-primary)" }} aria-label="Menu">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden" style={{ borderTop: "1px solid var(--lp-glass-border)", background: "rgba(6,10,16,0.97)", backdropFilter: "blur(24px)" }}>
            <div className="flex flex-col gap-1 p-4">
              {navLinks.map((l) => (
                <button key={l.id} onClick={() => { scrollTo(l.id); setMenuOpen(false); }}
                  className="text-sm py-2.5 px-3 rounded-lg text-left transition-colors" style={{ color: "var(--lp-text-secondary)" }}>{l.label}</button>
              ))}
              <Link to="/auth" className="font-semibold text-sm py-2.5 px-3 rounded-lg text-white text-center mt-2" style={{ background: "var(--lp-blue-mid)" }}>Acessar Plataforma</Link>
            </div>
          </div>
        )}
      </header>

      {/* ──── HERO ──── */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden lp-bg-base">
        {/* Video background */}
        <video
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{ filter: "blur(4px) brightness(0.45)", opacity: 0.75, transform: "scale(1.1)" }}
          src="/videos/hero-bg.mp4"
        />
        <ParticleCanvas />
        <div className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8 w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16">
          {/* Left */}
          <div className="lp-reveal">
            {/* HERO HEADLINE — solid color, no gradient text */}
            <h1 className="font-serif leading-[1.1] mb-6" style={{
              fontSize: "clamp(48px, 6vw, 88px)",
              letterSpacing: "-0.01em",
              color: "#FFFFFF",
            }}>
              Transforme qualquer livro em uma{" "}
              <em className="not-italic" style={{ color: "var(--lp-accent-blue)", fontStyle: "italic" }}>experiência acessível</em>
            </h1>

            <p className="text-base lg:text-lg leading-[1.7] tracking-[0.01em] max-w-xl mb-8" style={{ color: "var(--lp-text-secondary)" }}>
              Gere Audiobooks, Audiodescrições e Videobooks de qualquer livro em PDF — com IA, em conformidade com a Lei Brasileira de Inclusão.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <Link to="/auth" className="inline-flex items-center justify-center font-semibold text-[15px] tracking-[0.02em] px-7 py-4 rounded-xl text-white transition-all duration-200" style={{ background: "var(--lp-orange)" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 30px var(--lp-orange-glow), 0 4px 16px rgba(0,0,0,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
              >Começar Agora — É Grátis</Link>
              <button onClick={() => scrollTo("como-funciona")} className="glass-card inline-flex items-center gap-2 text-[15px] font-semibold tracking-[0.02em] px-6 py-4 rounded-xl" style={{ color: "var(--lp-text-primary)" }}>
                <Play size={16} /> Ver Demonstração
              </button>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 mb-8">
              {["Conforme Lei 13.146/2015", "ABNT NBR 16452:2016", "Sem instalação"].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--lp-text-muted)" }}>
                  <Check size={14} style={{ color: "var(--lp-accent-green)" }} /> {t}
                </span>
              ))}
            </div>

            {/* Social proof counters */}
            <div className="flex flex-wrap gap-6">
              {[
                { num: "500+", label: "projetos processados" },
                { num: "3", label: "normas ABNT atendidas" },
                { num: "100%", label: "conforme Lei 13.146/2015" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-serif italic text-xl" style={{ color: "var(--lp-accent-blue)" }}>{s.num}</span>
                  <span className="text-xs" style={{ color: "var(--lp-text-muted)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Mockup refinado: Editor Audiobook */}
          <div className="lp-reveal hidden lg:block" style={{ perspective: "1200px" }}>
            <div style={{
              background: "rgba(10,18,32,0.92)", backdropFilter: "blur(40px)", border: "1px solid var(--lp-glass-border)",
              borderRadius: 20, boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
              animation: "float 6s ease-in-out infinite", overflow: "hidden",
            }}>
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--lp-glass-border)" }}>
                <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
                <span className="ml-3 text-xs flex items-center gap-1.5" style={{ color: "var(--lp-text-muted)" }}>
                  <BookOpen size={11} /> Editor — Audiobook
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(39,174,96,0.15)", border: "1px solid rgba(39,174,96,0.3)", color: "var(--lp-accent-green)" }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: "var(--lp-accent-green)", animation: "pulse-dot 2s infinite" }} /> ao vivo
                </span>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: "1px solid var(--lp-glass-border)", background: "rgba(255,255,255,0.02)" }}>
                {[
                  { icon: Brain, label: "IA" },
                  { icon: Mic, label: "Voz" },
                  { icon: Pencil, label: "Editar" },
                  { icon: Download, label: "Export" },
                ].map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md" style={{ background: i === 1 ? "rgba(46,134,193,0.18)" : "var(--lp-glass-bg)", border: i === 1 ? "1px solid rgba(79,172,222,0.35)" : "1px solid var(--lp-glass-border)", color: i === 1 ? "var(--lp-accent-blue)" : "var(--lp-text-muted)" }}>
                    <t.icon size={10} /> {t.label}
                  </span>
                ))}
                <span className="ml-auto text-[10px]" style={{ color: "var(--lp-text-muted)" }}>Pág. 1 / 24</span>
              </div>

              {/* Pages thumbnails */}
              <div className="p-5 grid grid-cols-4 gap-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="rounded-lg aspect-[3/4] relative overflow-hidden" style={{ background: i===1 ? "rgba(46,134,193,0.22)" : "var(--lp-glass-bg)", border: i===1 ? "1px solid rgba(79,172,222,0.5)" : "1px solid var(--lp-glass-border)", boxShadow: i===1 ? "0 0 16px rgba(79,172,222,0.25)" : "none" }}>
                    <div className="p-2">
                      <div className="w-full h-1.5 rounded-full mb-1.5" style={{ background: "var(--lp-glass-border)" }} />
                      <div className="w-3/4 h-1.5 rounded-full mb-1.5" style={{ background: "var(--lp-glass-bg)" }} />
                      <div className="w-1/2 h-1.5 rounded-full" style={{ background: "var(--lp-glass-bg)" }} />
                    </div>
                    {i === 1 && (
                      <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "var(--lp-accent-green)" }}>
                        <Check size={9} className="text-white" />
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1.5 text-[8px]" style={{ color: "var(--lp-text-muted)" }}>{String(i).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>

              {/* Text extract preview */}
              <div className="mx-5 mb-3 p-3 rounded-lg" style={{ background: "var(--lp-glass-bg)", border: "1px solid var(--lp-glass-border)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={10} style={{ color: "var(--lp-accent-teal)" }} />
                  <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: "var(--lp-accent-teal)" }}>Texto extraído</span>
                </div>
                <div className="space-y-1.5">
                  <div className="w-full h-1.5 rounded-full" style={{ background: "var(--lp-glass-border)" }} />
                  <div className="w-[92%] h-1.5 rounded-full" style={{ background: "var(--lp-glass-border)" }} />
                  <div className="w-[78%] h-1.5 rounded-full" style={{ background: "var(--lp-glass-border)" }} />
                </div>
              </div>

              {/* Waveform / progress bars */}
              <div className="px-5 pb-3 space-y-2">
                {[100, 85, 92, 60].map((w, i) => (
                  <div key={i} className="h-2 rounded-full overflow-hidden" style={{ width: `${w}%`, background: "var(--lp-glass-bg)" }}>
                    <div className="h-full rounded-full" style={{ width: "60%", background: "linear-gradient(90deg, rgba(79,172,222,0.5), rgba(79,172,222,0.05))", animation: "shimmer 2s infinite" }} />
                  </div>
                ))}
              </div>

              {/* Audio player */}
              <div className="mx-5 mb-5 p-3 rounded-xl flex items-center gap-3" style={{ background: "var(--lp-glass-bg)", border: "1px solid var(--lp-glass-border)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--lp-blue-mid)", boxShadow: "0 0 12px var(--lp-blue-glow)" }}><Play size={14} fill="white" stroke="white" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium" style={{ color: "var(--lp-text-primary)" }}>Capítulo 01 — Introdução</span>
                    <span className="text-[9px]" style={{ color: "var(--lp-text-muted)" }}>NBR 15599</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--lp-glass-border)" }}>
                    <div className="h-full rounded-full" style={{ width: "35%", background: "linear-gradient(90deg, var(--lp-blue-mid), var(--lp-accent-teal))", animation: "playerProgress 4s ease-in-out infinite alternate" }} />
                  </div>
                </div>
                <span className="text-[10px] shrink-0" style={{ color: "var(--lp-text-muted)" }}>1:24</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──── LOGO BAR ──── */}
      <section className="py-8 lp-bg-surface section-divider">
        <p className="text-center text-xs tracking-[0.1em] uppercase font-medium mb-5" style={{ color: "var(--lp-text-muted)" }}>Desenvolvido para atender</p>
        <div className="overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)" }}>
          <div className="flex gap-12" style={{ animation: "scroll-logos 25s linear infinite", width: "max-content" }}>
            {[...logoItems, ...logoItems].map((item, i) => (
              <span key={i} className="text-sm whitespace-nowrap px-4 py-2 rounded-lg transition-colors duration-300"
                style={{ color: "var(--lp-text-muted)", border: "1px solid var(--lp-glass-border)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--lp-text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--lp-text-muted)")}
              >{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ──── NÚMEROS (interstitial full-width) ──── */}
      <section id="solucao" className="py-20 lg:py-24 lp-bg-accent section-divider">
        <div className="mx-auto max-w-[900px] px-5 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-0 lp-reveal-stagger">
            {[
              { ref: c1.ref, val: c1.val, label: "Brasileiros com alguma deficiência (IBGE 2022)" },
              { ref: c2.ref, val: c2.val, label: "Pessoas com deficiência visual no Brasil" },
              { ref: c3.ref, val: c3.val, label: "Pessoas surdas no Brasil" },
            ].map((item, i) => (
              <div key={i} ref={item.ref} className="text-center px-6 md:px-12 lp-reveal relative" style={i > 0 ? { borderLeft: undefined } : {}}>
                <div className="font-serif italic mb-3" style={{
                  fontSize: "clamp(40px, 5vw, 64px)",
                  background: "linear-gradient(135deg, var(--lp-accent-blue), var(--lp-accent-teal))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>{formatNum(item.val)}</div>
                <p className="text-sm" style={{ color: "var(--lp-text-secondary)" }}>{item.label}</p>
                {i < 2 && <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-16" style={{ background: "var(--lp-glass-border)" }} />}
              </div>
            ))}
          </div>
          <p className="text-center text-sm mt-10" style={{ color: "var(--lp-text-muted)" }}>Cada livro publicado sem acessibilidade é uma barreira. A Accessibility derruba essas barreiras.</p>
        </div>
      </section>

      {/* ──── FUNCIONALIDADES (Bento Grid) ──── */}
      <section id="funcionalidades" className="py-20 lg:py-28 lp-bg-surface section-divider">
        <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
          <h2 className="font-serif text-center mb-4 lp-reveal" style={{ color: "var(--lp-text-primary)", fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 700 }}>
            Três recursos. Uma solução{" "}
            <span style={{ color: "var(--lp-accent-teal)" }}>completa</span>.
          </h2>
          <p className="text-center mb-14 lp-reveal" style={{ color: "var(--lp-text-secondary)" }}>Tudo o que você precisa para transformar livros em materiais acessíveis.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lp-reveal-stagger">
            {/* Audiobook */}
            <div className="glass-card card-feature-audio p-7 flex flex-col lp-reveal h-full">
              <div className="feature-icon-wrap feature-icon-wrap--audio">
                <BookOpen size={22} />
              </div>
              <h3 className="font-semibold text-lg mb-3" style={{ color: "var(--lp-text-primary)" }}>Audiobook com IA</h3>
              <p className="text-sm leading-[1.7] mb-5 flex-1" style={{ color: "var(--lp-text-secondary)" }}>Extração inteligente do texto com reconhecimento de contexto pedagógico. Narração profissional com vozes ultra-realistas em português brasileiro.</p>
              <span className="inline-flex self-start items-center text-xs font-medium tracking-[0.08em] uppercase px-3 py-1 rounded-full" style={{ border: "1px solid rgba(79,172,222,0.4)", color: "var(--lp-accent-blue)" }}>Conforme NBR 15599</span>
            </div>

            {/* Audiodescrição */}
            <div className="glass-card card-feature-audiodesc p-7 flex flex-col lp-reveal h-full">
              <div className="feature-icon-wrap feature-icon-wrap--audiodesc">
                <Image size={22} />
              </div>
              <h3 className="font-semibold text-lg mb-3" style={{ color: "var(--lp-text-primary)" }}>Audiodescrição Inteligente</h3>
              <p className="text-sm leading-[1.7] mb-5 flex-1" style={{ color: "var(--lp-text-secondary)" }}>Descrição precisa de elementos visuais seguindo a ABNT NBR 16452:2016. Nível de detalhe proporcional ao contexto pedagógico.</p>
              <span className="inline-flex self-start items-center text-xs font-medium tracking-[0.08em] uppercase px-3 py-1 rounded-full" style={{ border: "1px solid rgba(45,212,171,0.4)", color: "var(--lp-accent-teal)" }}>Conforme NBR 16452:2016</span>
            </div>

            {/* Videobook */}
            <div className="glass-card card-feature-video p-7 flex flex-col lp-reveal h-full">
              <div className="feature-icon-wrap feature-icon-wrap--video">
                <Film size={22} />
              </div>
              <h3 className="font-semibold text-lg mb-3" style={{ color: "var(--lp-text-primary)" }}>Videobook Animado</h3>
              <p className="text-sm leading-[1.7] mb-5 flex-1" style={{ color: "var(--lp-text-secondary)" }}>Páginas do livro em vídeo animado sincronizado com narração. Animações Ken Burns, Spotlight e Pan. Editor visual com linha do tempo. Exportação MP4.</p>
              <span className="inline-flex self-start items-center text-xs font-medium tracking-[0.08em] uppercase px-3 py-1 rounded-full" style={{ border: "1px solid rgba(244,145,58,0.4)", color: "var(--lp-accent-orange)" }}>Plano Enterprise</span>
            </div>
          </div>
        </div>
      </section>

      {/* ──── COMO FUNCIONA (Timeline) ──── */}
      <section id="como-funciona" className="py-20 lg:py-28 relative lp-bg-elevated section-divider">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(46,134,193,0.05) 0%, transparent 70%)" }} />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-center mb-4 lp-reveal" style={{ color: "var(--lp-text-primary)", fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 700 }}>Do PDF ao audiobook em minutos</h2>
          <p className="text-center mb-16 lp-reveal" style={{ color: "var(--lp-text-secondary)" }}>Quatro passos simples para transformar qualquer livro.</p>

          <div className="relative max-w-[700px] mx-auto">
            <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2" style={{ background: "linear-gradient(to bottom, transparent, rgba(79,172,222,0.4) 10%, rgba(79,172,222,0.4) 90%, transparent)" }} />

            {[
              { icon: Upload, num: "01", title: "Upload", desc: "Faça upload do PDF do livro. A plataforma processa automaticamente todas as páginas." },
              { icon: Brain, num: "02", title: "Extração Inteligente", desc: "A IA analisa cada página, identifica o tipo de conteúdo e extrai texto para narração." },
              { icon: Pencil, num: "03", title: "Revisão e Edição", desc: "Revise o texto gerado. Ajuste voz, estilo de narração e configurações por página." },
              { icon: Download, num: "04", title: "Geração e Download", desc: "Gere os áudios com um clique. Download de MP3, por capítulo ou livro completo em ZIP." },
            ].map((step, i) => {
              const isOdd = i % 2 === 0;
              return (
                <div key={i} className="lp-reveal mb-12 lg:mb-12 flex flex-col lg:grid lg:grid-cols-[1fr_60px_1fr] items-start lg:items-center">
                  <div className={`hidden lg:block ${isOdd ? "text-right pr-6" : ""}`}>
                    {isOdd && (
                      <div>
                        <h3 className="font-semibold text-base mb-2" style={{ color: "var(--lp-text-primary)" }}>{step.title}</h3>
                        <p className="text-sm leading-[1.7]" style={{ color: "var(--lp-text-secondary)" }}>{step.desc}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 lg:justify-center lg:gap-0 mb-3 lg:mb-0">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center relative z-10" style={{ background: "var(--lp-glass-bg)", border: "1px solid rgba(79,172,222,0.4)", boxShadow: "0 0 20px rgba(79,172,222,0.2)" }}>
                      <step.icon size={20} style={{ color: "var(--lp-accent-blue)" }} />
                    </div>
                    <h3 className="lg:hidden font-semibold text-base" style={{ color: "var(--lp-text-primary)" }}>{step.title}</h3>
                  </div>
                  <div className={`hidden lg:block ${!isOdd ? "pl-6" : ""}`}>
                    {!isOdd && (
                      <div>
                        <h3 className="font-semibold text-base mb-2" style={{ color: "var(--lp-text-primary)" }}>{step.title}</h3>
                        <p className="text-sm leading-[1.7]" style={{ color: "var(--lp-text-secondary)" }}>{step.desc}</p>
                      </div>
                    )}
                  </div>
                  <p className="lg:hidden text-sm leading-[1.7] ml-16" style={{ color: "var(--lp-text-secondary)" }}>{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──── CONFORMIDADE LEGAL ──── */}
      <section id="conformidade" className="py-20 lg:py-28 lp-bg-interstitial section-divider">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-center mb-4 lp-reveal" style={{ color: "var(--lp-text-primary)", fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 700 }}>Conformidade com a legislação brasileira</h2>
          <p className="text-center mb-14 lp-reveal" style={{ color: "var(--lp-text-secondary)" }}>Desenvolvido em conformidade total com as normas de acessibilidade.</p>

          <div className="lp-reveal card-featured p-8 lg:p-12 rounded-3xl relative">
            <div className="grid md:grid-cols-3 gap-8 lp-reveal-stagger">
              {[
                { icon: Shield, title: "Lei nº 13.146/2015", sub: "Lei Brasileira de Inclusão", desc: "Garante o direito de acesso à informação em igualdade de condições. O artigo 68 determina a obrigatoriedade de livros em formatos acessíveis.", color: "var(--lp-accent-blue)" },
                { icon: FileText, title: "ABNT NBR 16452:2016", sub: "Norma de Audiodescrição", desc: "Os prompts de extração visual seguem as diretrizes técnicas desta norma — objetividade, presente do indicativo, do geral para o específico.", color: "var(--lp-accent-teal)" },
                { icon: Mic, title: "Lei nº 10.436/2002", sub: "Lei Libras + Decreto 5.626", desc: "Reconhece a Língua Brasileira de Sinais como meio legal de comunicação. A audiodescrição gerada pode ser base para produção de conteúdo em Libras.", color: "var(--lp-accent-orange)" },
              ].map((law, i) => (
                <div key={i} className="lp-reveal">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `color-mix(in srgb, ${law.color} 12%, transparent)` }}>
                    <law.icon size={20} style={{ color: law.color }} />
                  </div>
                  <h3 className="font-semibold text-base mb-1" style={{ color: law.color }}>{law.title}</h3>
                  <p className="text-xs font-medium mb-3" style={{ color: "var(--lp-accent-teal)" }}>{law.sub}</p>
                  <p className="text-sm leading-[1.7]" style={{ color: "var(--lp-text-secondary)" }}>{law.desc}</p>
                </div>
              ))}
            </div>
            {/* Urgency banner */}
            <div className="mt-10 pt-8 flex flex-col md:flex-row items-center gap-6" style={{ borderTop: "1px solid rgba(46,134,193,0.15)" }}>
              <div className="text-5xl" style={{ animation: "shield-glow 3s ease-in-out infinite" }}>⚖️</div>
              <p className="text-sm leading-[1.7] flex-1" style={{ color: "var(--lp-text-secondary)" }}>
                O artigo 68 da Lei 13.146/2015 determina que instituições de ensino e editoras devem disponibilizar materiais em formatos acessíveis. A Accessibility automatiza esse processo.
              </p>
              <Link to="/auth" className="shrink-0 inline-flex items-center font-semibold text-[15px] tracking-[0.02em] px-6 py-3 rounded-xl text-white transition-all duration-200" style={{ background: "var(--lp-blue-mid)" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 20px var(--lp-blue-glow)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
              >Adequar meus materiais →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ──── PARA QUEM É (horizontal list with dividers) ──── */}
      <section className="py-20 lg:py-28 lp-bg-elevated section-divider">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-center mb-14 lp-reveal" style={{ color: "var(--lp-text-primary)", fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 700 }}>Quem usa a Accessibility</h2>
          <div className="lp-reveal grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--lp-glass-border)" }}>
            {[
              { icon: "🏫", title: "Editoras e Produtoras", desc: "Transforme seu catálogo inteiro em formato acessível. Atenda às obrigações legais e amplie seu mercado." },
              { icon: "🎓", title: "Secretarias e Escolas", desc: "Ofereça materiais didáticos acessíveis para alunos com deficiência visual, auditiva ou dificuldades de leitura." },
              { icon: "♿", title: "Profissionais de Acessibilidade", desc: "Acelere seu fluxo de produção com suporte de IA especializada em normas brasileiras." },
              { icon: "📖", title: "Autores Independentes", desc: "Publique seu livro já acessível desde o lançamento, sem depender de terceiros." },
            ].map((a, i) => (
              <div key={i} className="px-8 py-10 transition-colors duration-300"
                style={{ borderRight: i < 3 ? "1px solid var(--lp-glass-border)" : "none" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--lp-glass-bg-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span className="text-3xl block mb-4">{a.icon}</span>
                <h3 className="font-semibold text-base mb-2" style={{ color: "var(--lp-text-primary)" }}>{a.title}</h3>
                <p className="text-sm leading-[1.7]" style={{ color: "var(--lp-text-secondary)" }}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── PLANOS ──── */}
      <section id="planos" className="py-20 lg:py-28 lp-bg-surface section-divider">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-center mb-4 lp-reveal" style={{ color: "var(--lp-text-primary)", fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 700 }}>Planos para cada necessidade</h2>
          <p className="text-center mb-14 lp-reveal" style={{ color: "var(--lp-text-secondary)" }}>Comece grátis. Escale quando precisar.</p>

          {(() => {
            const plans = [
              {
                name: "Free",
                price: "R$ 0",
                period: "/mês",
                features: ["1 projeto", "30 páginas por mês", "Audiobook e Audiodescrição"],
                cta: "Começar Grátis",
                ctaTo: "/auth",
                variant: "default" as const,
              },
              {
                name: "Creator",
                price: "R$ 147",
                period: "/mês",
                features: ["2 projetos", "150 páginas por mês", "Audiobook e Audiodescrição", "Sem Videobook"],
                cta: "Escolher Creator",
                ctaTo: "/auth",
                variant: "default" as const,
              },
              {
                name: "Pro",
                price: "R$ 597",
                period: "/mês",
                features: ["5 projetos", "300 páginas por mês", "TTS Gemini e ElevenLabs", "Sem Videobook"],
                cta: "Escolher Pro",
                ctaTo: "/auth",
                variant: "featured" as const,
                highlightIdx: [2],
              },
              {
                name: "Enterprise",
                price: "R$ 1.498",
                period: "/mês",
                features: ["10 projetos", "1.000 páginas por mês", "TTS Premium", "Videobook incluído"],
                cta: "Escolher Enterprise",
                ctaTo: "/auth",
                variant: "default" as const,
                highlightIdx: [3],
              },
            ];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch lp-reveal-stagger max-w-6xl mx-auto">
                {plans.map((p, idx) => {
                  const isFeatured = p.variant === "featured";
                  return (
                    <div
                      key={p.name}
                      className={`${isFeatured ? "card-featured" : "glass-card"} p-6 lp-reveal relative flex flex-col`}
                      style={isFeatured ? { boxShadow: "0 0 0 1px rgba(79,172,222,0.1), 0 20px 60px rgba(46,134,193,0.2), 0 8px 32px rgba(0,0,0,0.4)" } : undefined}
                    >
                      {isFeatured && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold tracking-[0.08em] uppercase px-4 py-1 rounded-full text-white whitespace-nowrap" style={{ background: "var(--lp-orange)", boxShadow: "0 0 16px var(--lp-orange-glow)" }}>Mais popular</span>
                      )}
                      <h3 className={`font-semibold text-lg mb-1 ${isFeatured ? "pt-1" : ""}`} style={{ color: "var(--lp-text-primary)" }}>{p.name}</h3>
                      <div className="flex items-baseline gap-1 mb-5">
                        <span className="font-serif" style={{ fontSize: "38px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--lp-text-primary)" }}>{p.price}</span>
                        <span className="text-sm" style={{ color: "var(--lp-text-muted)" }}>{p.period}</span>
                      </div>
                      <ul className="space-y-3 mb-6 flex-1">
                        {p.features.map((f, i) => {
                          const highlight = (p.highlightIdx ?? []).includes(i);
                          const isNeg = /^Sem /i.test(f);
                          return (
                            <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: highlight ? "var(--lp-accent-blue)" : isNeg ? "var(--lp-text-muted)" : "var(--lp-text-secondary)" }}>
                              {highlight ? (
                                <Sparkles size={15} style={{ color: "var(--lp-accent-teal)" }} />
                              ) : isNeg ? (
                                <X size={15} style={{ color: "var(--lp-text-muted)" }} />
                              ) : (
                                <Check size={15} style={{ color: "var(--lp-accent-green)" }} />
                              )}
                              {f}
                            </li>
                          );
                        })}
                      </ul>
                      <Link
                        to={p.ctaTo}
                        className="block text-center font-semibold text-[15px] tracking-[0.02em] py-3 rounded-xl transition-all duration-200"
                        style={isFeatured
                          ? { background: "linear-gradient(135deg, var(--lp-orange), #f39c12)", color: "white" }
                          : { background: "var(--lp-glass-bg)", border: "1px solid var(--lp-glass-border)", color: "var(--lp-text-primary)" }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = "translateY(-1px)";
                          if (isFeatured) e.currentTarget.style.boxShadow = "0 0 24px var(--lp-orange-glow)";
                          else e.currentTarget.style.background = "var(--lp-glass-bg-hover)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = "translateY(0)";
                          if (isFeatured) e.currentTarget.style.boxShadow = "none";
                          else e.currentTarget.style.background = "var(--lp-glass-bg)";
                        }}
                      >{p.cta}</Link>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Plano Onyx — sob consulta */}
          <div className="mt-8 max-w-6xl mx-auto lp-reveal">
            <div className="card-featured p-6 lg:p-7 flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(244,145,58,0.15)", border: "1px solid rgba(244,145,58,0.35)", boxShadow: "0 0 16px rgba(244,145,58,0.25)" }}>
                  <Sparkles size={20} style={{ color: "var(--lp-accent-orange)" }} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg" style={{ color: "var(--lp-text-primary)" }}>Onyx</h3>
                  <p className="text-xs tracking-[0.08em] uppercase font-medium" style={{ color: "var(--lp-accent-orange)" }}>Sob consulta</p>
                </div>
              </div>
              <p className="text-sm leading-[1.7] flex-1" style={{ color: "var(--lp-text-secondary)" }}>
                Volume editorial alto, integrações personalizadas, SLA dedicado e produção customizada. Plano corporativo disponível somente via contato.
              </p>
              <a
                href="mailto:contato@accessibility.com.br"
                className="shrink-0 inline-flex items-center font-semibold text-[15px] tracking-[0.02em] px-6 py-3 rounded-xl text-white transition-all duration-200"
                style={{ background: "var(--lp-blue-mid)" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 20px var(--lp-blue-glow)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
              >Falar com nossa equipe →</a>
            </div>
          </div>

          <p className="text-center text-xs mt-8 lp-reveal" style={{ color: "var(--lp-text-muted)" }}>Todos os planos incluem acesso completo às funcionalidades do nível. Cancele quando quiser.</p>
        </div>
      </section>

      {/* ──── DEPOIMENTO ──── */}
      <section className="py-16 lg:py-20 lp-bg-accent section-divider">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <div className="card-featured p-10 lg:p-14 text-center lp-reveal">
            <span className="font-serif text-6xl leading-none" style={{ color: "var(--lp-accent-blue)" }}>"</span>
            <p className="text-base lg:text-lg leading-[1.7] my-6" style={{ color: "var(--lp-text-secondary)" }}>
              A Accessibility reduziu de semanas para horas o processo de produção de audiobooks para nossa coleção didática. A conformidade com a NBR 16452 é real — foi o primeiro produto que realmente entregou isso.
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm text-white" style={{ background: "linear-gradient(135deg, var(--lp-blue-mid), var(--lp-teal))" }}>EC</div>
              <div className="text-left">
                <p className="text-sm font-medium" style={{ color: "var(--lp-text-primary)" }}>Editora Educacional</p>
                <p className="text-xs" style={{ color: "var(--lp-text-muted)" }}>Coordenadora de Acessibilidade</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──── FAQ ──── */}
      <section id="faq" className="py-20 lg:py-28 lp-bg-base section-divider">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <h2 className="font-serif text-center mb-14 lp-reveal" style={{ color: "var(--lp-text-primary)", fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 700 }}>Perguntas frequentes</h2>
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
      <section className="py-24 lg:py-32 relative overflow-hidden lp-bg-accent section-divider">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(135deg, var(--lp-blue-deep) 0%, var(--lp-blue-mid) 50%, var(--lp-blue-deep) 100%)",
          opacity: 0.3,
        }} />
        <div className="absolute top-0 left-[10%] w-64 h-64 rounded-full pointer-events-none" style={{ background: "var(--lp-teal-glow)", filter: "blur(100px)" }} />
        <div className="absolute bottom-0 right-[10%] w-64 h-64 rounded-full pointer-events-none" style={{ background: "var(--lp-orange-glow)", filter: "blur(100px)" }} />
        <div className="relative z-10 mx-auto max-w-3xl px-5 text-center lp-reveal">
          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-[13px] font-medium tracking-[0.08em] uppercase"
            style={{ background: "rgba(230,126,34,0.15)", border: "1px solid rgba(230,126,34,0.3)", color: "var(--lp-accent-orange)" }}>
            🎯 Oferta de lançamento — Plano Pro com 30 dias grátis
          </div>
          <h2 className="font-serif mb-3" style={{
            fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 700,
            color: "#FFFFFF",
          }}>Comece agora.<br/>Seu primeiro projeto é gratuito.</h2>
          <p className="text-base mb-10" style={{ color: "var(--lp-text-secondary)" }}>Configure em menos de 5 minutos. Sem cartão de crédito. Cancele quando quiser.</p>
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <Link to="/auth" className="inline-flex items-center font-semibold text-[15px] tracking-[0.02em] px-8 py-4 rounded-xl text-white transition-all duration-200" style={{ background: "var(--lp-orange)" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 30px var(--lp-orange-glow)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
            >Criar conta gratuita →</Link>
            <a href="mailto:contato@accessibility.com.br" className="glass-card inline-flex items-center text-[15px] font-semibold tracking-[0.02em] px-7 py-4 rounded-xl" style={{ color: "var(--lp-text-primary)" }}>Falar com nossa equipe</a>
          </div>
          <p className="text-xs" style={{ color: "var(--lp-text-muted)" }}>✓ Sem cartão de crédito  ·  ✓ Setup em 5 minutos  ·  ✓ Cancele quando quiser</p>
        </div>
      </section>

      {/* ──── FOOTER ──── */}
      <footer className="lp-bg-base section-divider">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-14">
          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <Logo />
              <p className="text-sm mt-4 leading-[1.7]" style={{ color: "var(--lp-text-secondary)" }}>Plataforma SaaS de acessibilidade editorial com inteligência artificial. Audiobooks, audiodescrições e videobooks em conformidade com a legislação brasileira.</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4" style={{ color: "var(--lp-text-primary)" }}>Links</h4>
              <ul className="space-y-2">
                {[
                  { label: "Funcionalidades", action: () => scrollTo("funcionalidades") },
                  { label: "Planos", action: () => scrollTo("planos") },
                ].map((l, i) => (
                  <li key={i}><button onClick={l.action} className="text-sm transition-colors duration-200" style={{ color: "var(--lp-text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--lp-accent-blue)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--lp-text-secondary)")}
                  >{l.label}</button></li>
                ))}
                <li><Link to="/auth" className="text-sm transition-colors duration-200" style={{ color: "var(--lp-text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--lp-accent-blue)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--lp-text-secondary)")}
                >Acessar plataforma</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4" style={{ color: "var(--lp-text-primary)" }}>Conformidade</h4>
              <ul className="space-y-2">
                {["Lei nº 13.146/2015 (LBI)", "ABNT NBR 16452:2016", "Lei nº 10.436/2002", "Decreto nº 5.626/2005"].map((n) => (
                  <li key={n} className="text-sm" style={{ color: "var(--lp-text-muted)" }}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-6 flex flex-col md:flex-row justify-between gap-4" style={{ borderTop: "1px solid var(--lp-glass-border)" }}>
            <span className="text-xs" style={{ color: "var(--lp-text-muted)" }}>© 2025 Accessibility. Todos os direitos reservados.</span>
            <span className="text-xs" style={{ color: "var(--lp-text-muted)" }}>Desenvolvido em conformidade com as normas brasileiras de acessibilidade.</span>
          </div>
          {/* Footer a11y note */}
          <div className="footer-a11y-note">
            <span className="mr-1.5">♿</span>
            Esta página usa{" "}
            <a href="https://brailleinstitute.org/freefont" target="_blank" rel="noopener noreferrer" className="footer-a11y-link">
              Atkinson Hyperlegible Next
            </a>
            {" "}— a fonte criada pelo Braille Institute para pessoas com baixa visão — porque acessibilidade começa aqui.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
