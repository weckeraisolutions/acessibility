import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface ProcessingScreenProps {
  progress: number;
  currentPage: number;
  totalPages: number;
  error: string | null;
  onRetry: () => void;
}

const ProcessingScreen = ({ progress, currentPage, totalPages, error, onRetry }: ProcessingScreenProps) => {
  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold text-foreground">Erro no processamento</h2>
        <p className="text-muted-foreground text-center max-w-md">{error}</p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold text-foreground">Processando seu livro...</h2>
      <div className="w-full max-w-md space-y-2">
        <Progress value={progress} className="h-3" />
        <p className="text-sm text-center text-muted-foreground">
          {totalPages > 0
            ? `Processando página ${currentPage} de ${totalPages} — ${progress}%`
            : "Carregando PDF..."}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Não feche esta aba durante o processamento</p>
    </div>
  );
};

export default ProcessingScreen;
