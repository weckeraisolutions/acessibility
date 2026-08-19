import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_page_text",
  title: "Atualizar texto da página",
  description: "Atualiza o texto de narração (audiobook) e/ou de audiodescrição de uma página do projeto.",
  inputSchema: {
    project_id: z.string().describe("ID (uuid) do projeto."),
    page_number: z.number().int().describe("Número da página dentro do projeto."),
    audiobook_text: z.string().optional().describe("Novo texto de narração do audiobook."),
    audiodesc_text: z.string().optional().describe("Novo texto de audiodescrição."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, page_number, audiobook_text, audiodesc_text }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
    if (audiobook_text === undefined && audiodesc_text === undefined) {
      throw new ToolError("Informe audiobook_text e/ou audiodesc_text.");
    }
    const supabase = supabaseForUser(ctx);
    const { data: page, error: findError } = await supabase
      .from("pages")
      .select("id")
      .eq("project_id", project_id)
      .eq("page_number", page_number)
      .maybeSingle();
    if (findError) throw new ToolError(findError.message);
    if (!page) throw new ToolError("Página não encontrada ou sem acesso.");

    const patch: Record<string, string> = {};
    if (audiobook_text !== undefined) patch.audiobook_text = audiobook_text;
    if (audiodesc_text !== undefined) patch.audiodesc_text = audiodesc_text;

    const { data, error } = await supabase
      .from("pages")
      .update(patch)
      .eq("id", page.id)
      .select("id, page_number, audiobook_text, audiodesc_text")
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { page: data },
    };
  },
});
