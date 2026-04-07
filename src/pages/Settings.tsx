import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Sparkles, Play, Loader2, ChevronDown } from "lucide-react";
import { ELEVENLABS_VOICES, ELEVENLABS_MODELS, type ElevenLabsVoice } from "@/constants/elevenlabs-voices";

const planConfig: Record<string, { label: string; color: string; limit: number | null }> = {
  free: { label: "Gratuito", color: "bg-muted text-muted-foreground", limit: 30 },
  pro: { label: "Pro", color: "bg-[hsl(var(--primary))] text-primary-foreground", limit: 500 },
  premium: { label: "Premium", color: "bg-amber-500 text-white", limit: null },
  enterprise: { label: "Enterprise", color: "bg-amber-600 text-white", limit: null },
};

const Settings = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState(profile?.name || "");
  const [saving, setSaving] = useState(false);
  const [useElevenlabs, setUseElevenlabs] = useState(false);
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState("");
  const [elevenlabsModel, setElevenlabsModel] = useState("eleven_multilingual_v2");
  const [dynamicVoices, setDynamicVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  // Load extended profile fields
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("use_elevenlabs, elevenlabs_default_voice_id, elevenlabs_default_model")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUseElevenlabs((data as any).use_elevenlabs || false);
          setElevenlabsVoiceId((data as any).elevenlabs_default_voice_id || "");
          setElevenlabsModel((data as any).elevenlabs_default_model || "eleven_multilingual_v2");
        }
      });
  }, [user]);

  useEffect(() => { setName(profile?.name || ""); }, [profile?.name]);

  // Load dynamic voices for premium users
  useEffect(() => {
    if (profile?.plan !== "premium" && profile?.plan !== "enterprise") return;
    setLoadingVoices(true);
    supabase.functions.invoke("get-elevenlabs-voices")
      .then(({ data }) => {
        if (data?.voices?.length) setDynamicVoices(data.voices);
      })
      .catch(() => {})
      .finally(() => setLoadingVoices(false));
  }, [profile?.plan]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const updates: Record<string, any> = { name };
    if (profile?.plan === "premium" || profile?.plan === "enterprise") {
      updates.use_elevenlabs = useElevenlabs;
      updates.elevenlabs_default_voice_id = elevenlabsVoiceId || null;
      updates.elevenlabs_default_model = elevenlabsModel;
    }
    await supabase.from("profiles").update(updates).eq("id", user.id);
    setSaving(false);
    toast({ title: "Alterações salvas" });
  };

  const handlePreview = async (voiceId: string) => {
    setPreviewingVoice(voiceId);
    try {
      const { data, error } = await supabase.functions.invoke("preview-elevenlabs-voice", {
        body: { voice_id: voiceId },
      });
      if (error || !data?.audio_base64) throw new Error("No audio");
      const audioUrl = `data:audio/mpeg;base64,${data.audio_base64}`;
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch {
      toast({ title: "Erro", description: "Falha ao reproduzir prévia.", variant: "destructive" });
    } finally {
      setPreviewingVoice(null);
    }
  };

  const plan = planConfig[profile?.plan || "free"] || planConfig.free;
  const isPremium = profile?.plan === "premium" || profile?.plan === "enterprise";
  const pagesUsed = (profile as any)?.pages_used_month ?? 0;
  const resetDate = (profile as any)?.month_reset_at
    ? new Date((profile as any).month_reset_at).toLocaleDateString("pt-BR")
    : "—";

  const allVoices: ElevenLabsVoice[] = [
    ...ELEVENLABS_VOICES,
    ...dynamicVoices.filter((dv) => !ELEVENLABS_VOICES.some((v) => v.voice_id === dv.voice_id)),
  ];

  const voiceGroups = allVoices.reduce<Record<string, ElevenLabsVoice[]>>((acc, v) => {
    const g = v.group || "Português BR Nativo";
    if (!acc[g]) acc[g] = [];
    acc[g].push(v);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
            <Logo size="sm" />
          </div>
          <h1 className="text-lg font-semibold">Configurações</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container max-w-2xl py-8 space-y-6">
        {/* SEÇÃO 1 — Perfil */}
        <Card>
          <CardHeader><CardTitle>Perfil</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={profile?.email || ""} disabled className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Plano:</span>
              <Badge className={`${plan.color} border-0`}>
                {isPremium && <Sparkles className="h-3 w-3 mr-1" />}
                {plan.label}
              </Badge>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar alterações
            </Button>
          </CardContent>
        </Card>

        {/* SEÇÃO 2 — Uso do mês */}
        <Card>
          <CardHeader><CardTitle>Uso do mês</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {plan.limit === null ? (
              <p className="text-sm flex items-center gap-1"><Sparkles className="h-4 w-4 text-amber-500" /> Uso ilimitado</p>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span>{pagesUsed} de {plan.limit} páginas utilizadas</span>
                  <span>{Math.round((pagesUsed / plan.limit) * 100)}%</span>
                </div>
                <Progress value={(pagesUsed / plan.limit) * 100} />
              </>
            )}
            <p className="text-xs text-muted-foreground">Reinicia em {resetDate}</p>
          </CardContent>
        </Card>

        {/* SEÇÃO 3 — Motor de Voz (Premium only) */}
        {isPremium && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Motor de Voz Premium — ElevenLabs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Como usuário Premium, você tem acesso às vozes ultra-realistas do ElevenLabs,
                com qualidade de estúdio profissional em português brasileiro.
              </p>

              <div className="flex items-center gap-3">
                <Switch checked={useElevenlabs} onCheckedChange={setUseElevenlabs} />
                <Label>Usar ElevenLabs como motor de voz padrão</Label>
              </div>

              {useElevenlabs && (
                <div className="space-y-4 mt-4 border-t pt-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Modelo</Label>
                    <Select value={elevenlabsModel} onValueChange={setElevenlabsModel}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ELEVENLABS_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Voz Padrão</Label>
                    {loadingVoices && <p className="text-xs text-muted-foreground mt-1">Carregando vozes...</p>}
                    <div className="space-y-2 mt-2">
                      {Object.entries(voiceGroups).map(([group, voices]) => (
                        <Collapsible key={group} defaultOpen>
                          <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground py-1">
                            <ChevronDown className="h-3 w-3" /> {group}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-1 ml-4">
                            {voices.map((v) => (
                              <div
                                key={v.voice_id}
                                className={`flex items-center justify-between p-2 rounded-md text-sm cursor-pointer transition-colors ${
                                  elevenlabsVoiceId === v.voice_id ? "bg-primary/10 border border-primary/30" : "hover:bg-accent/50"
                                }`}
                                onClick={() => setElevenlabsVoiceId(v.voice_id)}
                              >
                                <div>
                                  <span className="font-medium">{v.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">{v.description}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={(e) => { e.stopPropagation(); handlePreview(v.voice_id); }}
                                  disabled={previewingVoice === v.voice_id}
                                >
                                  {previewingVoice === v.voice_id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <><Play className="h-3 w-3 mr-1" /> Ouvir</>
                                  )}
                                </Button>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Settings;
