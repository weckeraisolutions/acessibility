import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import getProject from "./tools/get-project";
import listPages from "./tools/list-pages";
import getPage from "./tools/get-page";
import updatePageText from "./tools/update-page-text";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "accessibility-studio",
  title: "Accessibility Studio",
  version: "0.1.0",
  instructions:
    "Ferramentas do Accessibility Studio (audiobooks, audiodescrição e videobooks acessíveis). Use `list_projects` para encontrar projetos, `get_project` para detalhes e capítulos, `list_pages` e `get_page` para ler textos de narração e audiodescrição, e `update_page_text` para editar esses textos. Todas as operações são feitas como o usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjects, getProject, listPages, getPage, updatePageText],
});
