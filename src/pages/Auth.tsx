import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, AudioLines, BookOpen, Check, Eye, Film } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import SEO from "@/components/SEO";
import { describeAuthError } from "@/lib/authError";

const Auth = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextPath = rawNext && /^\/(?!\/)/.test(rawNext) && !rawNext.includes("\\") ? rawNext : null;
  const redirectTarget = nextPath ?? "/dashboard";
  const authCallbackUrl = `${window.location.origin}/auth${
    nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""
  }`;
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const reportAuthError = (message: string) => {
    toast({ title: "Não foi possível concluir", description: describeAuthError(message), variant: "destructive" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (session) {
    return <Navigate to={redirectTarget} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setIsLoading(false);
    if (error) {
      reportAuthError(error.message);
    } else {
      navigate(redirectTarget);
    }
    } catch { reportAuthError("network"); } finally { setIsLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirm) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
    const { error } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        data: { name: signupName },
        emailRedirectTo: authCallbackUrl,
      },
    });
    setIsLoading(false);
    if (error) {
      reportAuthError(error.message);
    } else {
      toast({ title: "Cadastro realizado!", description: "Verifique seu email para confirmar a conta." });
    }
    } catch { reportAuthError("network"); } finally { setIsLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authCallbackUrl },
    });
    if (error) {
      setIsLoading(false);
      reportAuthError(error.message);
    }
    } catch { reportAuthError("network"); } finally { setIsLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail || !document.querySelector<HTMLInputElement>("#login-email")?.checkValidity()) {
      toast({ title: "Informe seu email", description: "Digite seu email no campo acima.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      reportAuthError(error.message);
    } else {
      toast({ title: "Solicitação recebida", description: "Se houver uma conta com esse email, você receberá as instruções de recuperação." });
    }
    } catch { reportAuthError("network"); } finally { setIsLoading(false); }
  };

  return (
    <div className="app-shell grid min-h-screen lg:grid-cols-[1.15fr_.85fr]">
      <SEO
        title="Entrar — Accessibility"
        description="Acesse sua conta Accessibility para criar audiobooks, audiodescrições e videobooks acessíveis com IA."
        path="/auth"
        noindex
      />
      <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <img src="/images/infantil-poster.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,17,.65),rgba(5,10,17,.92)),linear-gradient(0deg,#050a11,transparent_55%)]" />
        <div className="relative z-10"><Link to="/" className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Logo size="md" /></Link></div>
        <div className="relative z-10 max-w-2xl">
          <span className="app-eyebrow">Accessibility Studio</span>
          <h2 className="studio-display studio-display--section mt-6">Toda a produção editorial em um único fluxo.</h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">Prepare texto, audiodescrição e narração. Confira cada página antes de aprovar o resultado.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[AudioLines, Eye, Film].map((Icon, index) => <div key={index} className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur"><Icon size={20} className="text-primary" /><span className="mt-3 block text-sm text-muted-foreground">{["Narração", "Audiodescrição", "Videobook"][index]}</span></div>)}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-sm text-muted-foreground"><Check size={16} className="text-green-300" /> Interface acessível e orientada por etapas</div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 md:px-10">
        <div className="w-full max-w-md space-y-7">
          <div className="flex items-center justify-between lg:hidden">
            <Logo size="sm" />
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Voltar</Link>
          </div>
          <div>
            <span className="app-eyebrow">Área de produção</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Acesse seu estúdio</h1>
            <p className="mt-2 text-sm text-muted-foreground">Continue de onde parou ou crie um novo projeto.</p>
          </div>

        <Card className="app-panel border-white/10 shadow-2xl shadow-black/20">
          <CardContent className="p-6">
            <Tabs defaultValue={searchParams.get("mode") === "signup" ? "signup" : "login"}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" autoComplete="email" placeholder="seu@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input id="login-password" type="password" autoComplete="current-password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isLoading}>
                    Entrar com Google
                  </Button>
                  <button type="button" disabled={isLoading} onClick={handleForgotPassword} className="min-h-11 w-full rounded-md text-center text-sm text-muted-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition-colors">
                    Esqueci minha senha
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome</Label>
                    <Input id="signup-name" autoComplete="name" placeholder="Seu nome" value={signupName} onChange={(e) => setSignupName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" autoComplete="email" placeholder="seu@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input id="signup-password" type="password" autoComplete="new-password" minLength={8} aria-describedby="password-help" placeholder="••••••••" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                    <p id="password-help" className="text-xs text-muted-foreground">Use pelo menos 8 caracteres.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                    <Input id="signup-confirm" type="password" autoComplete="new-password" minLength={8} placeholder="••••••••" value={signupConfirm} onChange={(e) => setSignupConfirm(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Cadastrando..." : "Cadastrar"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><BookOpen size={14} /> Seus projetos e arquivos permanecem privados.</p>
      </div>
      </section>
    </div>
  );
};

export default Auth;
