import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import VLibras from "@djpfs/react-vlibras";
import { ArrowRight, AudioLines, BookOpen, Check, Eye, FileText, Film, Menu, ShieldCheck, Upload, X } from "lucide-react";
import Logo from "@/components/Logo";
import SEO from "@/components/SEO";
import EditorialHero from "@/components/EditorialHero";

const navLinks = [
  { label: "Solução", id: "solucao" },
  { label: "Como funciona", id: "como-funciona" },
  { label: "Acessibilidade", id: "conformidade" },
  { label: "Planos", id: "planos" },
  { label: "Dúvidas", id: "duvidas" },
];

const features = [
  { icon: AudioLines, eyebrow: "Narração", title: "Texto que ganha voz", copy: "Revise o texto extraído do PDF e prepare a narração. Ouça o resultado antes de aprovar cada página.", accent: "blue", image: "/images/literario.jpg", alt: "Livro aberto cercado por obras literárias." },
  { icon: Eye, eyebrow: "Audiodescrição", title: "Imagens que fazem parte da leitura", copy: "Descreva as informações visuais relevantes para a compreensão da obra. Edite as descrições e confira sua relação com o texto.", accent: "teal", image: "/images/educacional.jpg", alt: "Professora e estudante analisam um livro juntas." },
  { icon: Film, eyebrow: "Videobook · acesso restrito", title: "Página e narração em vídeo", copy: "O módulo audiovisual combina páginas e áudio em um vídeo-base. A tradução e a interpretação em Libras exigem uma etapa profissional própria.", accent: "orange", image: "/images/infantil-poster.jpg", alt: "Cena do vídeo infantil original, com crianças e um livro digital." },
];

// Existing commercial reference. This page does not implement checkout.
const plans = [
  { name: "Free", price: "R$ 0", detail: "Primeiro contato com o estúdio", items: ["15 páginas por mês", "1 projeto", "Audiobook e audiodescrição"] },
  { name: "Creator", price: "R$ 97", detail: "Pequenos volumes editoriais", items: ["150 páginas por mês", "3 projetos", "Audiobook e audiodescrição"] },
  { name: "Pro", price: "R$ 197", detail: "Produção editorial recorrente", items: ["500 páginas por mês", "10 projetos", "Audiobook e audiodescrição"] },
  { name: "Enterprise", price: "R$ 497", detail: "Maior volume de produção", items: ["1.500 páginas por mês", "Projetos ilimitados", "Chave própria ElevenLabs"] },
];

const questions = [
  ["Que tipos de livro posso preparar?", "Livros infantis, obras literárias, materiais didáticos e técnicos em PDF. A qualidade da extração depende do arquivo: páginas digitalizadas, tabelas e diagramações complexas precisam de conferência cuidadosa."],
  ["Posso revisar o texto antes de gerar o áudio?", "Sim. O fluxo inclui edição do texto e das audiodescrições por página. Confira nomes, pronúncia, ordem de leitura e informações visuais antes de aprovar a narração."],
  ["Qual é o limite do arquivo?", "O formulário de novo projeto aceita PDF de até 100 MB. Envie apenas obras que você tenha autorização para adaptar. Limites de páginas e geração dependem da conta e dos serviços configurados."],
  ["O videobook já inclui tradução em Libras?", "Não. O vídeo-base não substitui o trabalho de um tradutor e intérprete de Libras. O módulo audiovisual tem acesso restrito nesta etapa do produto."],
  ["O resultado é automaticamente certificado como acessível?", "Não. A geração assistida não garante conformidade. O material precisa de revisão editorial, validação por profissionais de acessibilidade e avaliação com o público que vai utilizá-lo."],
  ["Escolher um plano aqui gera uma cobrança?", "Não. Esta página apresenta a referência dos planos, mas não possui contratação ou pagamento. Os botões levam ao acesso da plataforma. A disponibilidade comercial e os limites precisam ser confirmados antes da contratação."],
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <div className="studio-site min-h-screen bg-background text-foreground" id="inicio">
      <SEO title="Accessibility | Livros em áudio e audiodescrição" description="Prepare livros infantis, literários e educacionais em áudio e audiodescrição, com revisão editorial por página." path="/" />
      <a className="studio-skip-link" href="#conteudo">Pular para o conteúdo</a>
      <VLibras />
      <header className="studio-header" onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
      }}>
        <div className="studio-container flex h-[72px] items-center justify-between gap-3">
          <a href="#inicio" aria-label="Accessibility, início"><Logo size="sm" /></a>
          <nav className="hidden items-center gap-5 xl:flex" aria-label="Navegação principal">
            {navLinks.map(link => <a key={link.id} href={`#${link.id}`} className="studio-nav-link">{link.label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="studio-button studio-button--quiet hidden sm:inline-flex">Entrar</Link>
            <Link to="/auth?mode=signup" className="studio-button studio-button--primary hidden md:inline-flex">Criar conta <ArrowRight size={16} /></Link>
            <button ref={menuButton} className="studio-icon-button xl:hidden" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && <nav id="mobile-navigation" className="studio-mobile-nav" aria-label="Navegação móvel">
          {navLinks.map(link => <a key={link.id} href={`#${link.id}`} onClick={() => setMenuOpen(false)}>{link.label}</a>)}
          <Link to="/auth">Entrar na plataforma</Link><Link to="/auth?mode=signup">Criar conta</Link>
        </nav>}
      </header>

      <main id="conteudo" tabIndex={-1}>
        <EditorialHero />
        <section className="studio-proof-bar" aria-label="Para quem é o estúdio">
          <div className="studio-container flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {["Editoras", "Instituições de ensino", "Profissionais de acessibilidade", "Autores"].map(item => <span key={item}>{item}</span>)}
          </div>
        </section>

        <section id="solucao" className="studio-section"><div className="studio-container">
          <div className="studio-section-heading"><span className="studio-kicker">Da página à escuta</span><h2 className="studio-display studio-display--section">Outras formas de acessar o mesmo livro.</h2><p>Texto, imagem e voz têm funções diferentes. O trabalho editorial conecta esses elementos sem dispensar a revisão de quem conhece a obra.</p></div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {features.map(({ icon: Icon, eyebrow, title, copy, accent, image, alt }) => <article key={title} className={`studio-feature-card studio-feature-card--${accent}`}>
              <img className="studio-feature-photo" src={image} alt={alt} loading="lazy" width="720" height="480" />
              <div className="studio-feature-icon"><Icon size={22} /></div><span className="studio-panel-label">{eyebrow}</span><h3>{title}</h3><p>{copy}</p>
            </article>)}
          </div>
        </div></section>

        <section id="como-funciona" className="studio-section studio-section--contrast"><div className="studio-container grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div><span className="studio-kicker"><FileText size={14} /> O trabalho, etapa por etapa</span><h2 className="studio-display studio-display--section mt-6">Você acompanha. Você revisa. Você aprova.</h2><p className="mt-5 max-w-lg text-muted-foreground">Comece pelo PDF e confira cada resultado antes de avançar. Durante o processamento, mantenha a página aberta e acompanhe os avisos do sistema.</p><Link to="/auth?mode=signup" className="studio-button studio-button--quiet mt-6">Acessar o estúdio <ArrowRight size={16} /></Link></div>
          <ol className="studio-process-list">
            {[
              { icon: Upload, title: "Importar o livro", copy: "Selecione um PDF de até 100 MB e indique o tipo de conteúdo." },
              { icon: FileText, title: "Conferir a extração", copy: "Verifique texto, ordem de leitura e imagens de cada página." },
              { icon: Eye, title: "Revisar o conteúdo", copy: "Ajuste o texto e as audiodescrições antes de produzir a narração." },
              { icon: AudioLines, title: "Ouvir e aprovar", copy: "Gere o áudio e revise pronúncia, clareza e relação com a página." },
              { icon: Film, title: "Preparar a entrega", copy: "Use as opções de exportação disponíveis para sua conta e módulo." },
            ].map(({ icon: Icon, title, copy }, index) => <li key={title}><span className="studio-step-number">0{index + 1}</span><span className="studio-step-icon"><Icon size={20} /></span><div><h3>{title}</h3><p>{copy}</p></div></li>)}
          </ol>
        </div></section>

        <section id="conformidade" className="studio-section"><div className="studio-container"><div className="studio-compliance-panel">
          <div><span className="studio-kicker"><ShieldCheck size={14} /> Revisão é parte da acessibilidade</span><h2 className="studio-display studio-display--section mt-6">A tecnologia ajuda. O cuidado editorial permanece.</h2><p className="mt-5 max-w-2xl text-muted-foreground">A ferramenta apoia a produção, mas não certifica a obra. Avalie a precisão das descrições, a experiência de escuta e a adequação ao público antes de publicar.</p></div>
          <div className="studio-compliance-grid">{["Conferência da ordem de leitura", "Descrição de imagens relevantes", "Revisão de pronúncia e contexto", "Validação com o público"].map(item => <span key={item}><Check size={16} />{item}</span>)}</div>
        </div></div></section>

        <section id="planos" className="studio-section studio-section--contrast"><div className="studio-container">
          <div className="studio-section-heading"><span className="studio-kicker">Volumes de produção</span><h2 className="studio-display studio-display--section">Planeje o tamanho da sua operação.</h2><p>Referência de planos. Contratação e pagamento não estão disponíveis nesta página. Confirme disponibilidade, recursos e limites antes de contratar.</p></div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{plans.map(plan => <article key={plan.name} className="studio-plan"><h3>{plan.name}</h3><p>{plan.detail}</p><div className="studio-price">{plan.price}<small>/mês</small></div><ul>{plan.items.map(item => <li key={item}><Check size={15} />{item}</li>)}</ul><Link to="/auth" className="studio-button studio-button--quiet">Acessar plataforma</Link></article>)}</div>
        </div></section>

        <section id="duvidas" className="studio-section"><div className="studio-container grid gap-10 lg:grid-cols-[.7fr_1fr]">
          <div><span className="studio-kicker">Antes de começar</span><h2 className="studio-display studio-display--section mt-6">Dúvidas de quem produz.</h2></div>
          <div className="studio-faq">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
        </div></section>

        <section className="studio-final-cta"><div className="studio-container text-center"><BookOpen size={30} className="mx-auto text-primary" /><h2 className="studio-display studio-display--section mx-auto mt-6 max-w-3xl">Seu próximo livro pode ser ouvido por mais pessoas.</h2><p className="mx-auto mt-5 max-w-xl text-muted-foreground">Prepare o PDF, revise o conteúdo e acompanhe cada etapa da produção.</p><Link to="/auth?mode=signup" className="studio-button studio-button--primary mt-8">Criar minha conta <ArrowRight size={17} /></Link></div></section>
      </main>
      <footer className="studio-footer"><div className="studio-container py-8">
        <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center"><a href="#inicio" aria-label="Accessibility, início"><Logo size="sm" /></a><p>Produção editorial acessível, do PDF à entrega.</p><Link to="/auth">Acessar plataforma</Link></div>
        <nav aria-label="Navegação do rodapé" className="mt-6 flex flex-wrap gap-5">{navLinks.map(link => <a key={link.id} href={`#${link.id}`}>{link.label}</a>)}</nav>
        <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed">Fotografias ilustrativas: <a href="https://unsplash.com/photos/HH4WBGNyltc" target="_blank" rel="noreferrer">Jaredd Craig / Unsplash</a> e <a href="https://www.pexels.com/photo/9489803/" target="_blank" rel="noreferrer">Yaroslav Shuraev / Pexels</a>. Vídeo infantil original do projeto. As imagens não representam clientes ou endosso ao produto.</p>
      </div></footer>
    </div>
  );
}
