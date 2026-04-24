import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Page = Tables<"pages">;

interface Props {
  pages: Page[];
  startPage: number;
  endPage: number;
  onChange: (start: number, end: number) => void;
}

const PageGridSelector = ({ pages, startPage, endPage, onChange }: Props) => {
  const [anchor, setAnchor] = useState<number | null>(null);

  const handleClick = (pageNum: number) => {
    if (anchor === null) {
      setAnchor(pageNum);
      onChange(pageNum, pageNum);
    } else {
      const s = Math.min(anchor, pageNum);
      const e = Math.max(anchor, pageNum);
      onChange(s, e);
      setAnchor(null);
    }
  };

  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-64 overflow-y-auto p-2 border rounded-md bg-muted/20">
      {pages.map(p => {
        const inRange = p.page_number >= startPage && p.page_number <= endPage;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => handleClick(p.page_number)}
            className={cn(
              "relative aspect-[3/4] rounded border-2 overflow-hidden transition",
              inRange ? "border-primary ring-2 ring-primary/30" : "border-border opacity-70 hover:opacity-100",
            )}
            title={`Página ${p.page_number}`}
          >
            {p.thumbnail_url || p.image_url ? (
              <img src={p.thumbnail_url || p.image_url!} alt={`Página ${p.page_number}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-xs">{p.page_number}</div>
            )}
            <span className="absolute bottom-0 left-0 right-0 bg-background/80 text-[10px] text-center py-0.5">{p.page_number}</span>
          </button>
        );
      })}
    </div>
  );
};

export default PageGridSelector;