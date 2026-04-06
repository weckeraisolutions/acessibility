import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check } from "lucide-react";
import Logo from "@/components/Logo";
import { Tables } from "@/integrations/supabase/types";

type Page = Tables<"pages">;

interface EditorHeaderProps {
  projectName: string;
  pages: Page[];
  saving: boolean;
  activeTab: string;
  onNameChange: (name: string) => void;
}

const EditorHeader = ({ projectName, pages, saving, activeTab, onNameChange }: EditorHeaderProps) => {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(projectName);

  const handleConfirm = () => {
    setEditing(false);
    if (name.trim() && name !== projectName) onNameChange(name.trim());
  };

  const prefix = activeTab === "videobook" ? "video" : activeTab;

  const extracted = pages.filter((p) => {
    if (activeTab === "videobook") return p.video_status !== "pending";
    const text = activeTab === "audiobook" ? p.audiobook_text : p.audiodesc_text;
    return !!text;
  }).length;

  const audioGenerated = pages.filter((p) => {
    if (activeTab === "videobook") return !!p.video_clip_url;
    const url = activeTab === "audiobook" ? p.audiobook_audio_url : p.audiodesc_audio_url;
    return !!url;
  }).length;

  const approved = pages.filter((p) => {
    const status = activeTab === "audiobook" ? p.audiobook_status : activeTab === "audiodesc" ? p.audiodesc_status : p.video_status;
    return status === "approved";
  }).length;

  return (
    <header className="border-b bg-card sticky top-0 z-30">
      <div className="container flex h-14 items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
        </Button>

        <div className="flex-1 flex justify-center">
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleConfirm}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              className="max-w-xs text-center h-8"
              autoFocus
            />
          ) : (
            <button onClick={() => setEditing(true)} className="font-semibold hover:underline cursor-pointer bg-transparent border-none text-foreground">
              {projectName}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3" /> Salvo
            </span>
          )}
          <Badge variant="secondary">{extracted} extraídas</Badge>
          <Badge variant="secondary">{audioGenerated} áudios</Badge>
          <Badge variant="outline">{approved} aprovados</Badge>
        </div>
      </div>
    </header>
  );
};

export default EditorHeader;
