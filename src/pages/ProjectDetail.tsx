import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <Logo size="sm" />
        </div>
      </header>
      <main className="container py-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h1 className="text-2xl font-bold mb-2">Projeto</h1>
          <p className="text-muted-foreground">ID: {id}</p>
          <p className="text-muted-foreground mt-2">A interface de edição do projeto será implementada em breve.</p>
        </div>
      </main>
    </div>
  );
};

export default ProjectDetail;
