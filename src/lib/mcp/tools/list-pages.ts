import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_pages",
  title: "Listar páginas",
  description: "Lista as páginas de um projeto com o status de audiobook, audiodescrição e videobook.",
  inputSchema: {
    project_id: z.string().describe("ID (uuid) do projeto."),
    from_page: z.number().int().optional().describe("Número da primeira página do intervalo."),
    to_page: z.number().int().optional().describe("Número da última página do intervalo."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, from_page, to_page }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
    let query = supabaseForUser(ctx)
      .from("pages")
      .select("id, page_number, audiobook_status, audiodesc_status, video_status, audiodesc_validated, audiodesc_validation_score")
      .eq("project_id", project_id)
      .order("page_number");
    if (typeof from_page === "number") query = query.gte("page_number", from_page);
    if (typeof to_page === "number") query = query.lte("page_number", to_page);
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { pages: data ?? [] },
    };
  },
});
