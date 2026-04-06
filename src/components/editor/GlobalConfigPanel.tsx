import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, Zap, Key } from "lucide-react";
import { VOICES } from "@/constants/voices";
import { useToast } from "@/hooks/use-toast";
import { useTextExtractor } from "@/hooks/useTextExtractor";
import { Tables } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Page = Tables<"pages">;
type Project = Tables<"projects">;

interface GlobalConfigPanelProps {
  mode: "audiobook" | "audiodesc";
  style: string;
  voice: string;
  onStyleChange: (v: string) => void;
  onVoiceChange: (v: string) => void;
  pages: Page[];
  project: Project;
  onPageUpdate: (pageId: string, fields: Partial<Page>) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

const placeholders: Record<string, string> = {
  audiobook: "Ex: Ritmo fluido e contínuo, dicção clara e precisa, adequada para o público deste livro",
  audiodesc: "Ex: Objetivo e preciso, do geral para o específico, verbos no presente",
};

const GlobalConfigPanel = ({
  mode,
  style,
  voice,
  onStyleChange,
  onVoiceChange,
  pages,
  project,
  onPageUpdate,
  apiKey,
  onApiKeyChange,
}: GlobalConfigPanelProps) => {
  const [open, setOpen] = useState(true);
  const [apiKeyDialog, setApiKeyDialog] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const { toast } = useToast();
  const extractor = useTextExtractor();

  const handleStartExtraction = async () => {
    if (!localApiKey.trim()) {
      toast({ title: "Erro", description: "Insira a chave da API Gemini.", variant: "destructive" });
      return;
    }
    onApiKeyChange(localApiKey);
    setApiKeyDialog(false);
    const results = await extractor.extractAll(pages, mode, project, localApiKey, onPageUpdate);
    toast({
      title: "Extração concluída",
      description: `${results.extracted} extraídas, ${results.noContent} sem conteúdo, ${results.errors} com erro`,
    });
  };

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg bg-card mb-4">
        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 rounded-t-lg">
          <span className="font-semibold text-sm">⚙️ Configuração Global — {mode === "audiobook" ? "Audiobook" : "Audiodescrição"}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 pt-0 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estilo de Narração Global</Label>
            <Textarea
              rows={3}
              value={style}
              onChange={(e) => onStyleChange(e.target.value)}
              placeholder={placeholders[mode]}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Voz Padrão Global</Label>
            <Select value={voice} onValueChange={onVoiceChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label} — {v.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {extractor.extracting ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Extraindo página {extractor.currentPage} de {extractor.totalPages}...</span>
                <span>{Math.round((extractor.currentPage / extractor.totalPages) * 100)}%</span>
              </div>
              <Progress value={(extractor.currentPage / extractor.totalPages) * 100} />
            </div>
          ) : (
            <Button variant="default" onClick={() => setApiKeyDialog(true)}>
              <Zap className="h-4 w-4 mr-1" /> Extrair todos os textos
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={apiKeyDialog} onOpenChange={setApiKeyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" /> Chave da API Gemini
            </DialogTitle>
            <DialogDescription>
              Insira sua chave da API do Google AI Studio para extrair textos.{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Obter chave gratuita →
              </a>
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="AIza..."
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApiKeyDialog(false)}>Cancelar</Button>
            <Button onClick={handleStartExtraction}>
              <Zap className="h-4 w-4 mr-1" /> Iniciar extração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GlobalConfigPanel;
