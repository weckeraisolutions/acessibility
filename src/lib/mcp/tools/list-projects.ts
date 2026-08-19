import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "Listar projetos",
  description: "Lista os projetos (ebooks) acessíveis do usuário autenticado, com status de processamento e total de páginas.",
  inputSchema: {
    limit: z.number().int().optional().describe("Número máximo de projetos a retornar (padrão 20)."),
    search: z.string().optional().describe("Filtro opcional por trecho do nome do projeto."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = supabaseForUser(ctx)
      .from("projects")
      .select("id, name, book_title, book_type, processing_status, total_pages, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(take);
    if (search?.trim()) query = query.ilike("name", `%${search.trim()}%`);
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { projects: data ?? [] },
    };
  },
});
