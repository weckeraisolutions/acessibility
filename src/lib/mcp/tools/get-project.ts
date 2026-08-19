import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_project",
  title: "Detalhes do projeto",
  description: "Retorna os detalhes de um projeto, incluindo configurações globais de narração e capítulos.",
  inputSchema: { project_id: z.string().describe("ID (uuid) do projeto.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
    const supabase = supabaseForUser(ctx);
    const [{ data: project, error }, { data: chapters }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", project_id).maybeSingle(),
      supabase.from("chapters").select("id, title, start_page, end_page, order, videobook_status").eq("project_id", project_id).order("order"),
    ]);
    if (error) throw new ToolError(error.message);
    if (!project) throw new ToolError("Projeto não encontrado ou sem acesso.");
    const result = { project, chapters: chapters ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
