import { Region, REGION_TYPE_LABELS, REGION_COLORS, ANIMATION_OPTIONS, BASE_ANIMATION_OPTIONS, TRANSITION_OPTIONS } from "./animation-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";

interface AnimationRegionPanelProps {
  regions: Region[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateRegion: (id: string, fields: Partial<Region>) => void;
  onRemoveRegion: (id: string) => void;
  onAddRegion: () => void;
  pageBaseAnimation: string;
  suggestedTransition: string;
  onBaseAnimChange: (v: string) => void;
  onTransitionChange: (v: string) => void;
}

const AnimationRegionPanel = ({
  regions, selectedId, onSelect, onUpdateRegion, onRemoveRegion, onAddRegion,
  pageBaseAnimation, suggestedTransition, onBaseAnimChange, onTransitionChange,
}: AnimationRegionPanelProps) => {
  const selected = regions.find((r) => r.id === selectedId);
  const sorted = [...regions].sort((a, b) => a.timestamp_start - b.timestamp_start);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Selected region controls */}
        {selected ? (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Região selecionada</h3>
            <div>
              <Label className="text-xs">Rótulo</Label>
              <Input
                value={selected.label}
                onChange={(e) => onUpdateRegion(selected.id, { label: e.target.value })}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={selected.type} onValueChange={(v) => onUpdateRegion(selected.id, { type: v })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REGION_TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Animação</Label>
              <Select value={selected.animation_suggestion} onValueChange={(v) => onUpdateRegion(selected.id, { animation_suggestion: v })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANIMATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Início (s)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={selected.timestamp_start}
                  onChange={(e) => onUpdateRegion(selected.id, { timestamp_start: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Fim (s)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={selected.timestamp_end}
                  onChange={(e) => onUpdateRegion(selected.id, { timestamp_end: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => { onRemoveRegion(selected.id); onSelect(null); }}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Remover região
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Clique em uma região no canvas para editá-la.</p>
        )}

        <Separator />

        {/* Regions list */}
        <div className="space-y-1">
          <h3 className="font-semibold text-sm">Regiões ({regions.length})</h3>
          {sorted.map((r) => (
            <button
              key={r.id}
              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                r.id === selectedId ? "bg-accent" : "hover:bg-muted"
              }`}
              onClick={() => onSelect(r.id)}
            >
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: REGION_COLORS[r.type] || "#6B7280" }}
              />
              <span className="flex-1 truncate">{r.label}</span>
              <span className="text-muted-foreground">{r.timestamp_start.toFixed(1)}s</span>
            </button>
          ))}
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={onAddRegion}>
            + Adicionar região
          </Button>
        </div>

        <Separator />

        {/* Page base animation */}
        <div>
          <Label className="text-xs font-semibold">Animação de fundo</Label>
          <Select value={pageBaseAnimation} onValueChange={onBaseAnimChange}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BASE_ANIMATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs font-semibold">Transição de saída</Label>
          <Select value={suggestedTransition} onValueChange={onTransitionChange}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRANSITION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </ScrollArea>
  );
};

export default AnimationRegionPanel;
