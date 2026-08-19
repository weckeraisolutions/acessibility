import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_page",
  title: "Ler página",
  description: "Retorna o texto do audiobook e da audiodescrição de uma página específica de um projeto.",
  inputSchema: {
    project_id: z.string().describe("ID (uuid) do projeto."),
    page_number: z.number().int().describe("Número da página dentro do projeto."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, page_number }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
    const { data, error } = await supabaseForUser(ctx)
      .from("pages")
      .select("id, page_number, audiobook_text, audiobook_style, audiobook_status, audiodesc_text, audiodesc_style, audiodesc_status, audiodesc_validated, audiodesc_validation_score, audiodesc_validation_violations")
      .eq("project_id", project_id)
      .eq("page_number", page_number)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Página não encontrada ou sem acesso.");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { page: data },
    };
  },
});
