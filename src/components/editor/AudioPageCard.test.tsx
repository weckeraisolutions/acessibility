import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import AudioPageCard from "./AudioPageCard";
import type { Tables } from "@/integrations/supabase/types";
const { invoke, toast } = vi.hoisted(() => ({ invoke: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/usePageNarrations", () => ({ usePageNarrations: () => ({ narrations: [], add: vi.fn(), addMany: vi.fn(), update: vi.fn(), remove: vi.fn() }) }));
const id = "11111111-1111-4111-8111-111111111111";
const page = { id: "page", project_id: "project", page_number: 1, image_url: "r2:" + id, audiobook_text: "Texto sintético para testar.", audiobook_status: "extracted" } as Tables<"pages">;
const project = { id: "project", book_type: "general" } as Tables<"projects">;
function mount(voice = "preferred-elevenlabs") {
  const update = vi.fn();
  render(<AudioPageCard page={page} project={project} mode="audiobook" globalVoice="Zephyr" onUpdate={update}
    ttsEngine="gemini" elevenlabsVoices={[]} selectedElevenlabsVoice={voice} hideImage />);
  return update;
}
beforeEach(() => { vi.clearAllMocks(); });
describe("editor function contract", () => {
  it("extracts using the stable image_file_id", async () => {
    invoke.mockResolvedValue({ data: { success: true, text: "Extraído" }, error: null });
    const update = mount();
    fireEvent.click(screen.getByRole("button", { name: "Extrair esta página" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(invoke.mock.calls[0][0]).toBe("extract-text");
    expect(invoke.mock.calls[0][1].body.image_file_id).toBe(id);
    expect(invoke.mock.calls[0][1].body).not.toHaveProperty("image_url");
  });
  it("sends the fallback voice with Gemini and persists audio_ref, never audio_url", async () => {
    invoke.mockResolvedValue({ data: { success: true, audio_ref: "r2:" + id, audio_url: "https://signed.invalid/audio", duration_seconds: 2, engine: "gemini" }, error: null });
    const update = mount();
    fireEvent.click(screen.getByRole("button", { name: /Gerar áudio/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(invoke.mock.calls[0][1].body).toMatchObject({ use_elevenlabs: false, elevenlabs_voice_id: "preferred-elevenlabs", page_id: "page", project_id: "project" });
    expect(update.mock.calls[0][1].audiobook_audio_url).toBe("r2:" + id);
  });
  it("does not call generation without a fallback voice", async () => {
    mount("");
    fireEvent.click(screen.getByRole("button", { name: /Gerar áudio/i }));
    expect(invoke).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Selecione uma voz ElevenLabs de reserva" }));
  });
  it("restores the generation button after a server failure", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("Unavailable") });
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Gerar áudio/i }));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /Gerar áudio/i })).toBeEnabled();
  });
});
