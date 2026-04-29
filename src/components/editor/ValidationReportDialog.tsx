import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle } from "lucide-react";

interface Violation {
  regra?: string;
  trecho?: string;
  explicacao?: string;
}

interface ValidationReportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  score: number | null;
  wasCorrected: boolean;
  textOriginal: string | null;
  textFinal: string;
  violations: Violation[];
}

const ValidationReportDialog = ({
  open,
  onOpenChange,
  score,
  wasCorrected,
  textOriginal,
  textFinal,
  violations,
}: ValidationReportDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Relatório de Validação por IA
            {score !== null && (
              <Badge variant="secondary" className="ml-2">
                Score {score}/100
              </Badge>
            )}
            {wasCorrected && (
              <Badge className="bg-blue-500 text-white border-0">Texto ajustado</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Auditoria automática GPT-4o conforme ABNT NBR 16452:2016, Lei 13.146/2015 e manual IBC.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="violations" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="violations">
              Violações ({violations.length})
            </TabsTrigger>
            <TabsTrigger value="diff" disabled={!wasCorrected || !textOriginal}>
              Texto original vs ajustado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="violations" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[50vh] pr-3">
              {violations.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">
                  Nenhuma violação detectada. Texto aprovado integralmente.
                </p>
              ) : (
                <ul className="space-y-3">
                  {violations.map((v, i) => (
                    <li key={i} className="rounded-md border border-border/60 p-3 bg-muted/20">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-semibold">{v.regra || `Violação ${i + 1}`}</span>
                      </div>
                      {v.trecho && (
                        <p className="text-xs italic text-muted-foreground mb-1 border-l-2 border-amber-500 pl-2">
                          “{v.trecho}”
                        </p>
                      )}
                      {v.explicacao && (
                        <p className="text-xs text-foreground/80">{v.explicacao}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="diff" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-2 gap-3 h-[50vh]">
              <div className="flex flex-col min-h-0">
                <h4 className="text-xs font-semibold mb-1 text-muted-foreground uppercase">Original</h4>
                <ScrollArea className="flex-1 rounded-md border border-border/60 p-2 bg-muted/20">
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{textOriginal || ""}</p>
                </ScrollArea>
              </div>
              <div className="flex flex-col min-h-0">
                <h4 className="text-xs font-semibold mb-1 text-primary uppercase">Ajustado</h4>
                <ScrollArea className="flex-1 rounded-md border border-primary/40 p-2 bg-primary/5">
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{textFinal}</p>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ValidationReportDialog;
