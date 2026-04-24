import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Film, Sparkles, Bell } from "lucide-react";
import { Link } from "react-router-dom";

const VideobookComingSoon = () => {
  return (
    <div className="flex items-center justify-center py-10">
      <Card className="relative max-w-2xl w-full overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-10 text-center">
        <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="relative space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30">
            <Film className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Em desenvolvimento
            </div>
            <h2 className="text-3xl font-serif tracking-tight text-foreground">
              Videobook está chegando
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-lg mx-auto">
              Estamos construindo um novo padrão de acessibilidade editorial:
              transformar seus livros em <strong className="text-foreground">videobooks com narração, audiodescrição e
              intérprete de Libras</strong> — tudo gerado com IA, prontos para distribuição.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { t: "Narração + AD", d: "Sincronizadas página a página" },
              { t: "Libras com IA", d: "Intérprete virtual integrado" },
              { t: "Export profissional", d: "MP4 em alta resolução" },
            ].map((f) => (
              <div key={f.t} className="rounded-lg border border-border/50 bg-background/40 p-3 text-left">
                <p className="text-sm font-semibold text-foreground">{f.t}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.d}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button asChild>
              <Link to="?tab=unified">
                <Sparkles className="h-4 w-4 mr-1" />
                Continuar com Narração + AD
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="mailto:contato@acessibility.io?subject=Lista%20de%20espera%20Videobook">
                <Bell className="h-4 w-4 mr-1" />
                Avise-me no lançamento
              </a>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Em breve disponível para todos os planos. Obrigado por construir um mundo mais acessível com a gente.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default VideobookComingSoon;