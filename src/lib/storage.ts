import { supabase } from "@/integrations/supabase/client";

// Signed URLs are presentation values only. Never persist them in the database.
const references = new Map<string, string>();
export const SESSION_EXPIRED_EVENT = "studio:session-expired";

export function fileReference(value: string): string {
  return references.get(value) ?? value;
}
export function fileId(value: string | null | undefined): string {
  const ref = value ? fileReference(value) : "";
  if (!/^r2:[0-9a-f-]{36}$/i.test(ref)) throw new Error("Arquivo indisponível. Envie o arquivo novamente.");
  return ref.slice(3);
}
export function rememberFileUrl(ref: string, url: string): string {
  fileId(ref);
  references.set(url, ref);
  return url;
}
export async function invokeStudioFunction(name: string, body: Record<string, unknown>) {
  const result = await supabase.functions.invoke(name, { body });
  if (result.error) {
    const status = result.error.context?.status;
    if (status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    let detail = "";
    try { detail = (await result.error.context?.clone().json())?.message || ""; } catch { /* no JSON body */ }
    throw new Error(status === 401 ? "Sua sessão expirou. Entre novamente."
      : status === 403 || status === 404 ? "Acesso negado ou recurso não encontrado."
      : detail || result.error.message || "Não foi possível concluir a operação.");
  }
  return result.data;
}
export async function downloadUrl(value: string, asAttachment = false): Promise<string> {
  const data = await invokeStudioFunction("r2-files", { action: "create-download", file_id: fileId(value), as_attachment: asAttachment });
  if (!data?.url) throw new Error("Não foi possível obter o arquivo.");
  return rememberFileUrl(`r2:${fileId(value)}`, data.url);
}
export const studioFunctions = {
  async invoke(name: string, options: { body: Record<string, unknown> }) {
    try { return { data: await invokeStudioFunction(name, options.body), error: null as Error | null }; }
    catch (error) { return { data: null, error: error as Error }; }
  },
};
export async function fetchStoredFile(value: string, asAttachment = false): Promise<Response> {
  const response = await fetch(await downloadUrl(value, asAttachment));
  if (!response.ok) throw new Error("Falha ao baixar arquivo. Tente novamente.");
  return response;
}
export async function createPrivateStorageUrl(_bucket: string, value: string | null | undefined): Promise<string | null> {
  return value ? downloadUrl(value) : null;
}
type FileKind = "pdf" | "page-image" | "page-thumbnail" | "page-image-hd" | "interpreter-video" | "videobook";
export async function uploadFile(blob: Blob, options: { project_id: string; kind: FileKind; file_name: string; page_id?: string; chapter_id?: string }): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const data = await invokeStudioFunction("r2-files", {
    action: "create-upload", ...options, content_type: blob.type, size_bytes: blob.size, checksum_sha256: checksum,
  });
  if (!data?.file_id || !data.upload_url || data.upload_method !== "PUT" || !data.upload_headers) throw new Error("Resposta de upload inválida.");
  try {
    const response = await fetch(data.upload_url, { method: "PUT", headers: data.upload_headers, body: blob });
    if (!response.ok) throw new Error("Falha no envio do arquivo. Tente novamente.");
    const completed = await invokeStudioFunction("r2-files", { action: "complete-upload", file_id: data.file_id });
    if (completed?.file?.status !== "uploaded") throw new Error("O envio não foi confirmado.");
    return `r2:${data.file_id}`;
  } catch (error) {
    await deleteFile(`r2:${data.file_id}`).catch(() => undefined);
    if (error instanceof TypeError) {
      throw new Error("Não foi possível conectar ao armazenamento de arquivos. Tente novamente ou contate o suporte.");
    }
    throw error;
  }
}
export async function deleteFile(value: string) {
  await invokeStudioFunction("r2-files", { action: "delete", file_id: fileId(value) });
}
export async function deleteProject(projectId: string) {
  // Keep ownership available for retry if R2 cleanup fails.
  await invokeStudioFunction("r2-files", { action: "purge-project", project_id: projectId });
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}
