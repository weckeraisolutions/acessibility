import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { applyRhythmTags, splitForHighlight } from "@/lib/rhythm-tags";

interface Props {
  open: boolean;
  onClose: () => void;
  text: string;
  preset: string;
  /** When true, shows the user-authored text as-is (no auto tags). */
  advancedMode?: boolean;
}

/**
 * Modal showing the exact text (with <break> tags highlighted) that will be
 * sent to ElevenLabs. Mirrors the backend `applyRhythmTags` 1:1.
 */
const RhythmPreviewDialog = ({ open, onClose, text, preset, advancedMode }: Props) => {
  const { processed, counts } = useMemo(() => {
    if (advancedMode) {
      const tagMatches = text.match(/<break[^>]*\/>/g) || [];
      return {
        processed: text,
        counts: { paragraph: 0, heading: 0, ellipsis: 0, longSentence: 0, item: 0, lineBreak: 0, total: tagMatches.length },
      };
    }
    const r = applyRhythmTags(text || "", preset);
    return { processed: r.text, counts: r.counts };
  }, [text, preset, advancedMode]);

  const parts = useMemo(() => splitForHighlight(processed), [processed]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>👁 Texto com pausas</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 text-xs">
          <strong>{counts.total} pausa(s) {advancedMode ? "manuais" : "inseridas"}:</strong>{" "}
          {advancedMode ? (
            <span>tags <code>&lt;break&gt;</code> escritas pelo usuário.</span>
          ) : (
            <span>
              {counts.heading} após títulos/questões, {counts.item} entre alternativas,{" "}
              {counts.lineBreak} em quebras de linha, {counts.paragraph} entre parágrafos,{" "}
              {counts.ellipsis} em reticências, {counts.longSentence} em frases longas.
            </span>
          )}
          <div className="mt-1 text-[11px] text-muted-foreground">Preset: <strong>{preset}</strong></div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-md border bg-background p-3 font-mono text-xs whitespace-pre-wrap leading-relaxed">
          {parts.length === 0 ? (
            <span className="text-muted-foreground">Sem texto para visualizar.</span>
          ) : (
            parts.map((p, i) =>
              p.kind === "tag" ? (
                <span
                  key={i}
                  className="inline-block px-1 rounded mx-0.5 font-semibold"
                  style={{ background: "hsl(48 100% 88%)", color: "hsl(25 95% 45%)" }}
                >
                  {p.value}
                </span>
              ) : (
                <span key={i}>{p.value}</span>
              ),
            )
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RhythmPreviewDialog;