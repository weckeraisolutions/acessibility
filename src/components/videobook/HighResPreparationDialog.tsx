import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  current: number;
  total: number;
  message: string;
}

const HighResPreparationDialog = ({ open, current, total, message }: Props) => {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparando páginas em alta resolução
          </DialogTitle>
          <DialogDescription>{message || "Isto pode levar alguns minutos…"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Progress value={pct} className="h-3" />
          <p className="text-xs text-muted-foreground text-center">
            {current}/{total} páginas • {pct}%
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HighResPreparationDialog;