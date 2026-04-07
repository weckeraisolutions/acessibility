import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="text-xl text-muted-foreground">Página não encontrada</p>
      <p className="text-sm text-muted-foreground">O recurso que você procura não existe ou você não tem permissão para acessá-lo.</p>
      <Button onClick={() => navigate("/dashboard")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Dashboard
      </Button>
    </div>
  );
};

export default NotFound;
