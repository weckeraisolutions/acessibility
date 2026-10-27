// File storage contract for the private R2 bucket.
// The browser never holds R2 credentials: it asks this function for short-lived
// presigned URLs, and every action checks that the caller owns the project.
//
// POST JSON { action, ... }:
//   create-upload   { project_id, kind, file_name, content_type, size_bytes, checksum_sha256, page_id?, chapter_id? }
//   complete-upload { file_id }
//   create-download { file_id, as_attachment? }
//   delete          { file_id }
//   purge-project   { project_id }   (call before deleting a project)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getAuthedUser, userOwnsProject } from "../_shared/auth.ts";
import { deleteObject, headObject, hexToBase64, presignDownload, presignUpload } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MB = 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/mp4"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];

const KIND_RULES: Record<string, { types: string[]; maxBytes: number }> = {
  "pdf": { types: ["application/pdf"], maxBytes: 200 * MB },
  "page-image": { types: IMAGE_TYPES, maxBytes: 25 * MB },
  "page-thumbnail": { types: IMAGE_TYPES, maxBytes: 5 * MB },
  "page-image-hd": { types: IMAGE_TYPES, maxBytes: 50 * MB },
  "audiobook-audio": { types: AUDIO_TYPES, maxBytes: 100 * MB },
  "audiodesc-audio": { types: AUDIO_TYPES, maxBytes: 100 * MB },
  "interpreter-video": { types: VIDEO_TYPES, maxBytes: 2048 * MB },
  "videobook": { types: VIDEO_TYPES, maxBytes: 4096 * MB },
};

const UPLOAD_URL_TTL = 15 * 60;
const DOWNLOAD_URL_TTL = 15 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80);
  return cleaned || "arquivo";
}

async function ownedFile(userId: string, fileId: unknown) {
  if (typeof fileId !== "string" || !UUID_RE.test(fileId)) return null;
  const { data } = await admin.from("file_objects").select("*").eq("id", fileId).eq("user_id", userId).maybeSingle();
  return data;
}

async function belongsToProject(table: "pages" | "chapters", id: unknown, projectId: string) {
  if (id === undefined || id === null) return true;
  if (typeof id !== "string" || !UUID_RE.test(id)) return false;
  const { data } = await admin.from(table).select("id").eq("id", id).eq("project_id", projectId).maybeSingle();
  return !!data;
}

async function createUpload(userId: string, body: Record<string, unknown>) {
  const { project_id, kind, file_name, content_type, size_bytes, checksum_sha256, page_id, chapter_id } = body;
  if (typeof project_id !== "string" || !UUID_RE.test(project_id)) return respond({ error: "project_id inválido" }, 400);
  const rules = typeof kind === "string" ? KIND_RULES[kind] : undefined;
  if (!rules) return respond({ error: "kind inválido" }, 400);
  if (typeof content_type !== "string" || !rules.types.includes(content_type)) {
    return respond({ error: "Tipo de arquivo não permitido para este kind", allowed: rules.types }, 400);
  }
  if (typeof size_bytes !== "number" || !Number.isInteger(size_bytes) || size_bytes <= 0 || size_bytes > rules.maxBytes) {
    return respond({ error: "Tamanho inválido", max_bytes: rules.maxBytes }, 400);
  }
  if (typeof checksum_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(checksum_sha256)) {
    return respond({ error: "checksum_sha256 deve ser o SHA-256 em hexadecimal minúsculo" }, 400);
  }
  if (!(await userOwnsProject(userId, project_id))) return respond({ error: "Projeto não encontrado" }, 404);
  if (!(await belongsToProject("pages", page_id, project_id)) || !(await belongsToProject("chapters", chapter_id, project_id))) {
    return respond({ error: "page_id ou chapter_id não pertence ao projeto" }, 400);
  }

  const fileId = crypto.randomUUID();
  const originalName = typeof file_name === "string" ? file_name.slice(0, 255) : null;
  const objectKey = `users/${userId}/projects/${project_id}/${kind}/${fileId}-${safeFileName(originalName ?? "arquivo")}`;

  const { error } = await admin.from("file_objects").insert({
    id: fileId,
    user_id: userId,
    project_id,
    page_id: page_id ?? null,
    chapter_id: chapter_id ?? null,
    kind,
    object_key: objectKey,
    original_name: originalName,
    content_type,
    size_bytes,
    checksum_sha256,
  });
  if (error) {
    console.error("[r2-files] insert failed:", error.message);
    return respond({ error: "Não foi possível registrar o arquivo" }, 500);
  }

  const signed = await presignUpload(objectKey, checksum_sha256, UPLOAD_URL_TTL);
  return respond({
    file_id: fileId,
    upload_url: signed.url,
    upload_method: "PUT",
    upload_headers: { ...signed.headers, "content-type": content_type },
    expires_in: UPLOAD_URL_TTL,
  });
}

async function completeUpload(userId: string, body: Record<string, unknown>) {
  const file = await ownedFile(userId, body.file_id);
  if (!file) return respond({ error: "Arquivo não encontrado" }, 404);
  if (file.status === "uploaded") return respond({ file });

  const info = await headObject(file.object_key);
  if (!info) return respond({ error: "O envio ainda não chegou ao armazenamento" }, 409);

  const mismatch = info.size !== Number(file.size_bytes) ||
    info.contentType !== file.content_type ||
    info.checksumSha256 !== hexToBase64(file.checksum_sha256);
  if (mismatch) {
    await deleteObject(file.object_key);
    await admin.from("file_objects").delete().eq("id", file.id);
    return respond({ error: "O arquivo enviado não confere com o declarado e foi descartado" }, 422);
  }

  const { data, error } = await admin
    .from("file_objects")
    .update({ status: "uploaded", uploaded_at: new Date().toISOString() })
    .eq("id", file.id)
    .select()
    .single();
  if (error) return respond({ error: "Não foi possível confirmar o arquivo" }, 500);
  return respond({ file: data });
}

async function createDownload(userId: string, body: Record<string, unknown>) {
  const file = await ownedFile(userId, body.file_id);
  if (!file || file.status !== "uploaded") return respond({ error: "Arquivo não encontrado" }, 404);
  const name = body.as_attachment === true ? (file.original_name ?? undefined) : undefined;
  const url = await presignDownload(file.object_key, DOWNLOAD_URL_TTL, name);
  return respond({ url, expires_in: DOWNLOAD_URL_TTL, content_type: file.content_type });
}

async function deleteFile(userId: string, body: Record<string, unknown>) {
  const file = await ownedFile(userId, body.file_id);
  if (!file) return respond({ error: "Arquivo não encontrado" }, 404);
  await deleteObject(file.object_key);
  await admin.from("file_objects").delete().eq("id", file.id);
  return respond({ deleted: true });
}

async function purgeProject(userId: string, body: Record<string, unknown>) {
  const projectId = body.project_id;
  if (typeof projectId !== "string" || !UUID_RE.test(projectId)) return respond({ error: "project_id inválido" }, 400);
  if (!(await userOwnsProject(userId, projectId))) return respond({ error: "Projeto não encontrado" }, 404);
  const { data: files } = await admin.from("file_objects").select("id, object_key").eq("project_id", projectId);
  for (const f of files ?? []) {
    await deleteObject(f.object_key);
    await admin.from("file_objects").delete().eq("id", f.id);
  }
  return respond({ deleted: files?.length ?? 0 });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Use POST" }, 405);

  const user = await getAuthedUser(req);
  if (!user) return respond({ error: "Sessão inválida ou expirada" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return respond({ error: "JSON inválido" }, 400);
  }

  try {
    switch (body.action) {
      case "create-upload": return await createUpload(user.id, body);
      case "complete-upload": return await completeUpload(user.id, body);
      case "create-download": return await createDownload(user.id, body);
      case "delete": return await deleteFile(user.id, body);
      case "purge-project": return await purgeProject(user.id, body);
      default: return respond({ error: "action inválida" }, 400);
    }
  } catch (err) {
    console.error("[r2-files] action failed:", body.action, err instanceof Error ? err.message : String(err));
    return respond({ error: "Falha no armazenamento de arquivos" }, 502);
  }
});
