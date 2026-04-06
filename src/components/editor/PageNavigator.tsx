import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PageNavigatorProps {
  currentPair: number;
  totalPairs: number;
  onPrev: () => void;
  onNext: () => void;
}

const PageNavigator = ({ currentPair, totalPairs, onPrev, onNext }: PageNavigatorProps) => (
  <div className="flex items-center justify-center gap-4 py-3">
    <Button variant="outline" size="sm" onClick={onPrev} disabled={currentPair <= 0}>
      <ChevronLeft className="h-4 w-4 mr-1" /> Par anterior
    </Button>
    <span className="text-sm text-muted-foreground">
      Par {currentPair + 1} de {totalPairs}
    </span>
    <Button variant="outline" size="sm" onClick={onNext} disabled={currentPair >= totalPairs - 1}>
      Próximo par <ChevronRight className="h-4 w-4 ml-1" />
    </Button>
  </div>
);

export default PageNavigator;
