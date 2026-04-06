import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportFooterProps {
  activeTab: string;
  totalPages: number;
}

const ExportFooter = ({ activeTab, totalPages }: ExportFooterProps) => {
  const { toast } = useToast();
  const placeholder = () => toast({ title: "Em breve", description: "Exportação será implementada." });

  const chapters = [
    { value: "all", label: "Livro inteiro" },
    ...Array.from({ length: Math.ceil(totalPages / 10) }, (_, i) => ({
      value: String(i + 1),
      label: `Capítulo ${i + 1} (págs ${i * 10 + 1}–${Math.min((i + 1) * 10, totalPages)})`,
    })),
  ];

  return (
    <footer className="border-t bg-card py-4">
      <div className="container flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">Capítulo/Seção:</Label>
          <Select defaultValue="all">
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chapters.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={placeholder}>
          <Download className="h-3 w-3 mr-1" /> Baixar seleção (ZIP)
        </Button>
        <Button variant="outline" size="sm" onClick={placeholder}>
          <Download className="h-3 w-3 mr-1" /> Baixar livro inteiro (ZIP)
        </Button>
        {activeTab === "videobook" && (
          <Button size="sm" onClick={placeholder}>
            <Download className="h-3 w-3 mr-1" /> Baixar Videobook Completo (MP4)
          </Button>
        )}
      </div>
    </footer>
  );
};

export default ExportFooter;
