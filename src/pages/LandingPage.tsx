import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Upload,
  Brain,
  Pencil,
  Download,
  BookOpen,
  Image,
  Film,
  Shield,
  FileText,
  Mic,
  School,
  GraduationCap,
  Accessibility,
  BookMarked,
  Check,
  Menu,
  X,
  ChevronRight,
  Play,
} from "lucide-react";

/* ─── Scroll‑reveal hook ─── */
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("revealed");
        }),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ─── Smooth scroll helper ─── */
const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

/* ================================================================
   LANDING PAGE
   ================================================================ */
const LandingPage = () => {
  useReveal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Solução", id: "solucao" },
    { label: "Funcionalidades", id: "funcionalidades" },
    { label: "Como Funciona", id: "como-funciona" },
    { label: "Conformidade Legal", id: "conformidade" },
    { label: "Planos", id: "planos" },
    { label: "Contato", id: "contato" },
  ];

  return (
    <div className="min-h-screen bg-[hsl(0,0%,100%)] text-[hsl(211,52%,24%)] overflow-x-hidden">
      {/* ── Global reveal CSS ── */}
      <style>{`
        .reveal{opacity:0;transform:translateY(32px);transition:opacity .7s ease,transform .7s ease}
        .revealed{opacity:1;transform:translateY(0)}
        @media(prefers-reduced-motion:reduce){.reveal,.revealed{opacity:1;transform:none;transition:none}}
      `}</style>

      {/* ─────────────────── HEADER ─────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[hsl(211,52%,24%)] shadow-lg"
            : "bg-[hsl(211,52%,24%)]/80 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2 focus:outline-none"
            aria-label="Voltar ao topo"
          >
            <svg width={32} height={32} viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="24" cy="10" r="4" fill="#fff" />
              <path d="M24 16c-3 0-5.5 1-7 2l1.5 3c1.2-.8 3.2-1.5 5.5-1.5s4.3.7 5.5 1.5l1.5-3c-1.5-1-4-2-7-2z" fill="#fff" />
              <path d="M21 22v10h2.5v-4h1v4H27V22h-1.5v4h-3v-4H21z" fill="#fff" />
              <path d="M34 18c1.5 1.5 2.5 3.5 2.5 6s-1 4.5-2.5 6" stroke="hsl(204,66%,47%)" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M38 14c2.5 2.8 4 6.2 4 10s-1.5 7.2-4 10" stroke="hsl(204,66%,47%)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
            </svg>
            <span className="text-lg font-bold text-[hsl(0,0%,100%)]">Accessibility</span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Navegação principal">
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="text-sm font-medium text-[hsl(0,0%,100%)]/80 transition-colors hover:text-[hsl(0,0%,100%)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(204,66%,47%)]"
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="hidden lg:block">
            <Link to="/auth">
              <Button className="rounded-full bg-[hsl(204,66%,47%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(204,66%,42%)]">
                Acessar Plataforma
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-[hsl(0,0%,100%)] lg:hidden focus:outline-none"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <nav
            className="flex flex-col gap-4 bg-[hsl(211,52%,24%)] px-6 pb-6 pt-2 lg:hidden"
            aria-label="Navegação principal mobile"
          >
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  scrollTo(l.id);
                  setMenuOpen(false);
                }}
                className="text-left text-sm font-medium text-[hsl(0,0%,100%)]/80 hover:text-[hsl(0,0%,100%)]"
              >
                {l.label}
              </button>
            ))}
            <Link to="/auth" onClick={() => setMenuOpen(false)}>
              <Button className="w-full rounded-full bg-[hsl(204,66%,47%)] text-[hsl(0,0%,100%)]">
                Acessar Plataforma
              </Button>
            </Link>
          </nav>
        )}
      </header>

      {/* ─────────────────── HERO ─────────────────── */}
      <section
        id="solucao"
        className="relative flex min-h-screen items-center bg-gradient-to-br from-[hsl(211,52%,24%)] to-[hsl(211,52%,18%)] pt-20"
      >
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-2 lg:px-8">
          {/* Text */}
          <div className="reveal flex flex-col justify-center gap-6">
            <h1 className="font-display text-4xl font-bold leading-tight text-[hsl(0,0%,100%)] md:text-5xl lg:text-6xl">
              Transforme qualquer livro em uma experiência acessível para todos
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[hsl(0,0%,100%)]/80">
              Plataforma SaaS com inteligência artificial para geração de Audiobooks,
              Audiodescrições e Videobooks a partir de qualquer PDF — em conformidade com a
              Lei Brasileira de Inclusão e as normas ABNT de acessibilidade.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/auth">
                <Button className="rounded-full bg-[hsl(28,80%,52%)] px-8 py-6 text-base font-semibold text-[hsl(0,0%,100%)] hover:bg-[hsl(28,80%,46%)]">
                  Começar Agora — É Grátis
                  <ChevronRight className="ml-1 h-5 w-5" />
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => scrollTo("como-funciona")}
                className="rounded-full border-[hsl(0,0%,100%)]/40 px-8 py-6 text-base text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,100%)]/10"
              >
                <Play className="mr-1 h-4 w-4" /> Ver Demonstração
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-2 text-sm text-[hsl(0,0%,100%)]/70">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[hsl(145,63%,35%)]" /> Conforme Lei 13.146/2015 (LBI)
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[hsl(145,63%,35%)]" /> ABNT NBR 16452:2016
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[hsl(145,63%,35%)]" /> Sem necessidade de instalar nada
              </span>
            </div>
          </div>

          {/* Mockup visual */}
          <div className="reveal flex items-center justify-center" style={{ transitionDelay: ".15s" }}>
            <div className="relative w-full max-w-md rounded-2xl border border-[hsl(0,0%,100%)]/10 bg-[hsl(211,52%,20%)] p-6 shadow-2xl">
              {/* Fake title bar */}
              <div className="mb-4 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[hsl(0,84%,60%)]" />
                <span className="h-3 w-3 rounded-full bg-[hsl(45,93%,58%)]" />
                <span className="h-3 w-3 rounded-full bg-[hsl(145,63%,35%)]" />
                <span className="ml-3 text-xs text-[hsl(0,0%,100%)]/40">Editor — Audiobook</span>
              </div>
              {/* Fake page thumbnails */}
              <div className="mb-4 flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={`flex h-16 w-12 items-center justify-center rounded-md text-xs font-bold ${
                      n === 1
                        ? "bg-[hsl(204,66%,47%)] text-[hsl(0,0%,100%)]"
                        : "bg-[hsl(0,0%,100%)]/10 text-[hsl(0,0%,100%)]/40"
                    }`}
                  >
                    p.{n}
                  </div>
                ))}
              </div>
              {/* Fake text area */}
              <div className="mb-4 space-y-2 rounded-lg bg-[hsl(0,0%,100%)]/5 p-4">
                <div className="h-2 w-3/4 rounded bg-[hsl(0,0%,100%)]/20" />
                <div className="h-2 w-full rounded bg-[hsl(0,0%,100%)]/15" />
                <div className="h-2 w-5/6 rounded bg-[hsl(0,0%,100%)]/15" />
                <div className="h-2 w-2/3 rounded bg-[hsl(0,0%,100%)]/10" />
              </div>
              {/* Fake player */}
              <div className="flex items-center gap-3 rounded-lg bg-[hsl(0,0%,100%)]/5 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(204,66%,47%)]">
                  <Play className="h-4 w-4 text-[hsl(0,0%,100%)]" />
                </div>
                <div className="flex-1">
                  <div className="h-1.5 w-full rounded bg-[hsl(0,0%,100%)]/10">
                    <div className="h-1.5 w-2/5 rounded bg-[hsl(204,66%,47%)]" />
                  </div>
                </div>
                <span className="text-xs text-[hsl(0,0%,100%)]/40">1:24</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── PROVA SOCIAL ─────────────────── */}
      <section className="bg-[hsl(211,52%,24%)] py-20">
        <div className="reveal mx-auto max-w-5xl px-4 text-center lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { num: "45,6 milhões", label: "Brasileiros com alguma deficiência (IBGE 2022)" },
              { num: "6,5 milhões", label: "Pessoas com deficiência visual no Brasil" },
              { num: "10 milhões", label: "Pessoas surdas no Brasil" },
            ].map((d) => (
              <div key={d.num} className="rounded-xl border border-[hsl(0,0%,100%)]/10 bg-[hsl(0,0%,100%)]/5 p-8">
                <p className="font-display text-3xl font-bold text-[hsl(204,66%,47%)] md:text-4xl">{d.num}</p>
                <p className="mt-2 text-sm text-[hsl(0,0%,100%)]/70">{d.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-lg font-medium text-[hsl(0,0%,100%)]/80">
            Cada livro publicado sem acessibilidade é uma barreira. A Accessibility derruba essas
            barreiras.
          </p>
        </div>
      </section>

      {/* ─────────────────── FUNCIONALIDADES ─────────────────── */}
      <section id="funcionalidades" className="scroll-mt-20 bg-[hsl(0,0%,100%)] py-24">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <h2 className="reveal text-center font-display text-3xl font-bold md:text-4xl">
            Três recursos. Uma solução completa.
          </h2>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: <BookOpen className="h-8 w-8" />,
                emoji: "📖",
                title: "Audiobook com IA",
                desc: "Extração inteligente do texto de cada página com reconhecimento de contexto pedagógico — títulos, boxes, glossários, balões de personagens. Narração profissional com vozes ultra‑realistas em português brasileiro, via Gemini TTS ou ElevenLabs. Download por página, capítulo ou livro inteiro.",
                badge: "Conforme NBR 15599",
              },
              {
                icon: <Image className="h-8 w-8" />,
                emoji: "🖼️",
                title: "Audiodescrição Inteligente",
                desc: "Descrição precisa de todos os elementos visuais — ilustrações, mapas, gráficos, tabelas e infográficos — seguindo rigorosamente a ABNT NBR 16452:2016 e o Guia para Produções Audiovisuais Acessíveis do Ministério da Cultura. Nível de detalhe proporcional ao contexto pedagógico de cada página.",
                badge: "Conforme NBR 16452:2016",
              },
              {
                icon: <Film className="h-8 w-8" />,
                emoji: "🎬",
                title: "Videobook Animado",
                desc: "Transforme as páginas do livro em vídeo animado sincronizado com a narração. Animações profissionais como Ken Burns, Spotlight e Pan. Editor visual com linha do tempo para sincronização de animações com o áudio. Exportação em MP4.",
                badge: "Planos Pro e Enterprise",
              },
            ].map((f, i) => (
              <div
                key={f.title}
                className="reveal group rounded-2xl border border-[hsl(214,32%,91%)] bg-[hsl(0,0%,100%)] p-8 shadow-sm transition-shadow hover:shadow-lg"
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[hsl(204,66%,47%)]/10 text-[hsl(204,66%,47%)] transition-colors group-hover:bg-[hsl(204,66%,47%)] group-hover:text-[hsl(0,0%,100%)]">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[hsl(215,16%,47%)]">{f.desc}</p>
                <Badge className="mt-4 bg-[hsl(145,63%,35%)]/10 text-[hsl(145,63%,35%)] hover:bg-[hsl(145,63%,35%)]/20">
                  {f.badge}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── COMO FUNCIONA ─────────────────── */}
      <section id="como-funciona" className="scroll-mt-20 bg-[hsl(210,25%,97%)] py-24">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <h2 className="reveal text-center font-display text-3xl font-bold md:text-4xl">
            Do PDF ao audiobook em minutos
          </h2>

          <div className="mt-16 grid gap-8 md:grid-cols-4">
            {[
              {
                icon: <Upload className="h-7 w-7" />,
                step: "01",
                title: "Upload",
                desc: "Faça upload do PDF do livro. A plataforma processa automaticamente todas as páginas, sem limite de tamanho.",
              },
              {
                icon: <Brain className="h-7 w-7" />,
                step: "02",
                title: "Extração Inteligente",
                desc: "A inteligência artificial analisa cada página, identifica o tipo de conteúdo e extrai o texto para narração ou descrição visual — seguindo as normas de acessibilidade brasileiras.",
              },
              {
                icon: <Pencil className="h-7 w-7" />,
                step: "03",
                title: "Revisão e Edição",
                desc: "Revise o texto gerado diretamente na plataforma antes de gerar o áudio. Ajuste voz, estilo de narração e configurações individuais por página.",
              },
              {
                icon: <Download className="h-7 w-7" />,
                step: "04",
                title: "Geração e Download",
                desc: "Gere os áudios com um clique. Faça download de MP3 individuais, por capítulo ou o livro completo em ZIP.",
              },
            ].map((s, i) => (
              <div
                key={s.step}
                className="reveal relative rounded-2xl bg-[hsl(0,0%,100%)] p-6 shadow-sm"
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <span className="font-display text-4xl font-bold text-[hsl(204,66%,47%)]/20">
                  {s.step}
                </span>
                <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(211,52%,24%)] text-[hsl(0,0%,100%)]">
                  {s.icon}
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[hsl(215,16%,47%)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── CONFORMIDADE LEGAL ─────────────────── */}
      <section id="conformidade" className="scroll-mt-20 bg-[hsl(210,18%,96%)] py-24">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <h2 className="reveal text-center font-display text-3xl font-bold md:text-4xl">
            Desenvolvido em conformidade com a legislação brasileira de acessibilidade
          </h2>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: <Shield className="h-8 w-8" />,
                title: "Lei nº 13.146/2015",
                subtitle: "Lei Brasileira de Inclusão",
                desc: "Garante o direito de acesso à informação e à comunicação em igualdade de condições. O artigo 68 determina a obrigatoriedade de livros em formatos acessíveis.",
              },
              {
                icon: <FileText className="h-8 w-8" />,
                title: "ABNT NBR 16452:2016",
                subtitle: "Norma de Audiodescrição",
                desc: "Os prompts de extração visual seguem literalmente as diretrizes técnicas desta norma — objetividade, presente do indicativo, do geral para o específico, sem interpretações.",
              },
              {
                icon: <Mic className="h-8 w-8" />,
                title: "Lei nº 10.436/2002 + Decreto 5.626/2005",
                subtitle: "Lei Libras",
                desc: "Reconhece a Língua Brasileira de Sinais como meio legal de comunicação. A audiodescrição gerada pode ser base para produção de conteúdo em Libras.",
              },
            ].map((c, i) => (
              <div
                key={c.title}
                className="reveal rounded-2xl bg-[hsl(0,0%,100%)] p-8 shadow-sm"
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[hsl(211,52%,24%)]/10 text-[hsl(211,52%,24%)]">
                  {c.icon}
                </div>
                <h3 className="text-lg font-bold">{c.title}</h3>
                <p className="text-sm font-medium text-[hsl(204,66%,47%)]">{c.subtitle}</p>
                <p className="mt-3 text-sm leading-relaxed text-[hsl(215,16%,47%)]">{c.desc}</p>
              </div>
            ))}
          </div>

          <div className="reveal mt-12 rounded-xl bg-[hsl(211,52%,24%)] p-6 text-center">
            <p className="text-lg font-semibold text-[hsl(0,0%,100%)]">
              Conformidade legal não é diferencial — é obrigação. A Accessibility entrega as duas
              coisas.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────── PARA QUEM É ─────────────────── */}
      <section className="bg-[hsl(0,0%,100%)] py-24">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <h2 className="reveal text-center font-display text-3xl font-bold md:text-4xl">
            Quem usa a Accessibility
          </h2>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <School className="h-7 w-7" />,
                emoji: "🏫",
                title: "Editoras e Produtoras Editoriais",
                desc: "Transforme seu catálogo inteiro em formato acessível. Atenda às obrigações legais e amplie seu mercado.",
              },
              {
                icon: <GraduationCap className="h-7 w-7" />,
                emoji: "🎓",
                title: "Secretarias de Educação e Escolas",
                desc: "Ofereça materiais didáticos acessíveis para alunos com deficiência visual, auditiva ou dificuldades de leitura.",
              },
              {
                icon: <Accessibility className="h-7 w-7" />,
                emoji: "♿",
                title: "Profissionais de Acessibilidade",
                desc: "Acelere seu fluxo de produção de audiobooks e audiodescrições com suporte de IA especializada em normas brasileiras.",
              },
              {
                icon: <BookMarked className="h-7 w-7" />,
                emoji: "📚",
                title: "Autores e Independentes",
                desc: "Publique seu livro já acessível desde o lançamento, sem depender de terceiros.",
              },
            ].map((a, i) => (
              <div
                key={a.title}
                className="reveal rounded-2xl border border-[hsl(214,32%,91%)] p-6 transition-shadow hover:shadow-md"
                style={{ transitionDelay: `${i * 0.08}s` }}
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(28,80%,52%)]/10 text-[hsl(28,80%,52%)]">
                  {a.icon}
                </div>
                <h3 className="font-bold">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[hsl(215,16%,47%)]">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── PLANOS ─────────────────── */}
      <section id="planos" className="scroll-mt-20 bg-[hsl(210,25%,97%)] py-24">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <h2 className="reveal text-center font-display text-3xl font-bold md:text-4xl">
            Planos para cada necessidade
          </h2>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {/* Free */}
            <div className="reveal rounded-2xl border border-[hsl(214,32%,91%)] bg-[hsl(0,0%,100%)] p-8 shadow-sm">
              <h3 className="text-xl font-bold">Free</h3>
              <p className="mt-2">
                <span className="text-3xl font-bold">R$0</span>
                <span className="text-[hsl(215,16%,47%)]">/mês</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-[hsl(215,16%,47%)]">
                {[
                  "1 projeto",
                  "30 páginas por mês",
                  "Audiobook e Audiodescrição",
                  "Vozes Gemini TTS",
                  "Download MP3",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(145,63%,35%)]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="mt-8 block">
                <Button variant="outline" className="w-full rounded-full">
                  Começar Grátis
                </Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="reveal relative rounded-2xl border-2 border-[hsl(28,80%,52%)] bg-[hsl(0,0%,100%)] p-8 shadow-lg" style={{ transitionDelay: ".1s" }}>
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[hsl(28,80%,52%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(28,80%,52%)]">
                Mais popular
              </Badge>
              <h3 className="text-xl font-bold">Pro</h3>
              <p className="mt-2">
                <span className="text-3xl font-bold">R$97</span>
                <span className="text-[hsl(215,16%,47%)]">/mês</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-[hsl(215,16%,47%)]">
                {[
                  "Projetos ilimitados",
                  "500 páginas por mês",
                  "Audiobook, Audiodescrição e Videobook",
                  "Todas as 30 vozes disponíveis",
                  "Download ZIP por capítulo",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(145,63%,35%)]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="mt-8 block">
                <Button className="w-full rounded-full bg-[hsl(28,80%,52%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(28,80%,46%)]">
                  Assinar Pro
                </Button>
              </Link>
            </div>

            {/* Enterprise */}
            <div className="reveal rounded-2xl border border-[hsl(214,32%,91%)] bg-[hsl(0,0%,100%)] p-8 shadow-sm" style={{ transitionDelay: ".2s" }}>
              <h3 className="text-xl font-bold">Enterprise</h3>
              <p className="mt-2">
                <span className="text-3xl font-bold">R$297</span>
                <span className="text-[hsl(215,16%,47%)]">/mês</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-[hsl(215,16%,47%)]">
                {[
                  "Tudo do Pro",
                  "Páginas ilimitadas",
                  "Vozes ultra‑realistas ElevenLabs",
                  "Modelo TTS premium (máxima qualidade)",
                  "Suporte prioritário",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(145,63%,35%)]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="mt-8 block">
                <Button className="w-full rounded-full bg-[hsl(211,52%,24%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(211,52%,20%)]">
                  Assinar Enterprise
                </Button>
              </Link>
            </div>
          </div>

          <p className="reveal mt-8 text-center text-sm text-[hsl(215,16%,47%)]">
            Todos os planos incluem acesso completo às funcionalidades do nível. Cancele quando
            quiser.
          </p>
        </div>
      </section>

      {/* ─────────────────── FAQ ─────────────────── */}
      <section className="bg-[hsl(0,0%,100%)] py-24">
        <div className="mx-auto max-w-3xl px-4 lg:px-8">
          <h2 className="reveal text-center font-display text-3xl font-bold md:text-4xl">
            Perguntas frequentes
          </h2>

          <Accordion type="single" collapsible className="reveal mt-12">
            {[
              {
                q: "A plataforma funciona com qualquer tipo de livro?",
                a: "Sim. A Accessibility suporta livros didáticos, literários, técnicos, infantis e gerais. A inteligência artificial adapta as regras de extração ao tipo de livro selecionado.",
              },
              {
                q: "As audiodescrições realmente seguem a ABNT NBR 16452:2016?",
                a: "Sim. Os prompts enviados à IA foram desenvolvidos com o conteúdo técnico real da norma — incluindo regras de redação, objetividade, proporcionalidade ao contexto e critérios de inclusão e exclusão de elementos visuais.",
              },
              {
                q: "Qual a diferença entre Gemini TTS e ElevenLabs?",
                a: "O Gemini TTS oferece 30 vozes de alta qualidade com excelente pronúncia em português brasileiro. O ElevenLabs, disponível no plano Enterprise, oferece vozes ultra‑realistas com naturalidade ainda maior, ideal para audiobooks comerciais de alta qualidade.",
              },
              {
                q: "Posso editar o texto antes de gerar o áudio?",
                a: "Sim. O texto extraído pela IA é totalmente editável antes da geração do áudio. Você pode corrigir, adicionar ou remover conteúdo conforme necessário.",
              },
              {
                q: "Os arquivos gerados têm uso comercial?",
                a: "Sim. Os arquivos MP3, ZIP e MP4 gerados pela plataforma podem ser utilizados comercialmente como parte dos materiais acessíveis do seu produto editorial.",
              },
              {
                q: "Existe limite de tamanho de arquivo PDF?",
                a: "O limite atual é de 100MB por arquivo, o que comporta a grande maioria dos livros didáticos e literários.",
              },
            ].map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-[hsl(215,16%,47%)]">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ─────────────────── CTA FINAL ─────────────────── */}
      <section
        id="contato"
        className="scroll-mt-20 bg-gradient-to-r from-[hsl(211,52%,24%)] to-[hsl(204,66%,47%)] py-24"
      >
        <div className="reveal mx-auto max-w-3xl px-4 text-center lg:px-8">
          <h2 className="font-display text-3xl font-bold text-[hsl(0,0%,100%)] md:text-4xl">
            Comece agora. Seu primeiro projeto é grátis.
          </h2>
          <p className="mt-4 text-lg text-[hsl(0,0%,100%)]/80">
            Junte‑se a editoras, escolas e profissionais de acessibilidade que já transformam seus
            materiais com a Accessibility.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/auth">
              <Button className="rounded-full bg-[hsl(28,80%,52%)] px-8 py-6 text-base font-semibold text-[hsl(0,0%,100%)] hover:bg-[hsl(28,80%,46%)]">
                Criar conta gratuita
              </Button>
            </Link>
            <a href="mailto:contato@accessibility.com.br">
              <Button
                variant="outline"
                className="rounded-full border-[hsl(0,0%,100%)]/40 px-8 py-6 text-base text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,100%)]/10"
              >
                Falar com nossa equipe
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ─────────────────── FOOTER ─────────────────── */}
      <footer className="bg-[hsl(211,52%,24%)] py-16 text-[hsl(0,0%,100%)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 md:grid-cols-3 lg:px-8">
          {/* Col 1 */}
          <div>
            <div className="flex items-center gap-2">
              <svg width={28} height={28} viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="10" r="4" fill="#fff" />
                <path d="M24 16c-3 0-5.5 1-7 2l1.5 3c1.2-.8 3.2-1.5 5.5-1.5s4.3.7 5.5 1.5l1.5-3c-1.5-1-4-2-7-2z" fill="#fff" />
                <path d="M21 22v10h2.5v-4h1v4H27V22h-1.5v4h-3v-4H21z" fill="#fff" />
                <path d="M34 18c1.5 1.5 2.5 3.5 2.5 6s-1 4.5-2.5 6" stroke="hsl(204,66%,47%)" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
              <span className="text-lg font-bold">Accessibility</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[hsl(0,0%,100%)]/60">
              Plataforma SaaS de acessibilidade editorial com inteligência artificial. Audiobooks,
              audiodescrições e videobooks em conformidade com a legislação brasileira.
            </p>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[hsl(0,0%,100%)]/40">
              Links
            </h4>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Funcionalidades", action: () => scrollTo("funcionalidades") },
                { label: "Planos", action: () => scrollTo("planos") },
              ].map((l) => (
                <li key={l.label}>
                  <button onClick={l.action} className="text-[hsl(0,0%,100%)]/70 hover:text-[hsl(0,0%,100%)]">
                    {l.label}
                  </button>
                </li>
              ))}
              <li>
                <Link to="/auth" className="text-[hsl(0,0%,100%)]/70 hover:text-[hsl(0,0%,100%)]">
                  Acessar plataforma
                </Link>
              </li>
              <li>
                <span className="text-[hsl(0,0%,100%)]/70">Política de Privacidade</span>
              </li>
              <li>
                <span className="text-[hsl(0,0%,100%)]/70">Termos de Uso</span>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[hsl(0,0%,100%)]/40">
              Conformidade
            </h4>
            <ul className="space-y-2 text-sm text-[hsl(0,0%,100%)]/70">
              <li>Lei nº 13.146/2015 (LBI)</li>
              <li>ABNT NBR 16452:2016</li>
              <li>Lei nº 10.436/2002</li>
              <li>Decreto nº 5.626/2005</li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-7xl border-t border-[hsl(0,0%,100%)]/10 px-4 pt-8 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 text-xs text-[hsl(0,0%,100%)]/40 md:flex-row">
            <p>© 2025 Accessibility. Todos os direitos reservados.</p>
            <p>Desenvolvido em conformidade com as normas brasileiras de acessibilidade.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
