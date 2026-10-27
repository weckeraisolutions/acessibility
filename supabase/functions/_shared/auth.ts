// Shared authentication helpers for edge functions.
// Functions validate JWTs in code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getObject } from "./r2.ts";

export interface AuthedUser {
  id: string;
  email?: string | null;
}

/**
 * Validates the Authorization Bearer token and returns the authenticated user.
 * Returns null when no/invalid token.
 */
export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anonKey) return null;

  const sb = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Verifies that the given project_id belongs to the authenticated user.
 * Uses service-role client to bypass RLS (we've already verified the JWT).
 */
export async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);
  const { data, error } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data && !error;
}

/**
 * Verifies that the given page_id belongs to a project owned by userId.
 * Returns the project_id when valid, otherwise null.
 */
export async function userOwnsPage(userId: string, pageId: string): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);
  const { data, error } = await admin
    .from("pages")
    .select("project_id, projects!inner(user_id)")
    .eq("id", pageId)
    .maybeSingle();
  if (error || !data) return null;
  // @ts-expect-error — embedded relation
  const ownerId = data.projects?.user_id;
  if (ownerId !== userId) return null;
  return data.project_id as string;
}

/**
 * SSRF guard for legacy image URLs: only this project's own Supabase host over HTTPS.
 */
export function isAllowedFetchUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    const supaUrl = Deno.env.get("SUPABASE_URL");
    return !!supaUrl && u.hostname.toLowerCase() === new URL(supaUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
}

/** Database columns that point to R2 files store `r2:{file_objects.id}`. */
export const R2_REF_PREFIX = "r2:";

export function r2FileIdFromRef(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(R2_REF_PREFIX)) return null;
  const id = value.slice(R2_REF_PREFIX.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/**
 * Loads a page image owned by userId within projectId. Accepts an R2 file id,
 * an `r2:{id}` reference, or a legacy URL on this project's Supabase host.
 * Returns null when the image is missing, not owned, or not allowed.
 */
export async function loadPageImage(
  userId: string,
  projectId: string,
  imageFileId: unknown,
  imageUrl: unknown,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const fileId = typeof imageFileId === "string" ? imageFileId : r2FileIdFromRef(imageUrl);
  if (fileId) {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: file } = await admin
      .from("file_objects")
      .select("object_key, content_type, kind, status")
      .eq("id", fileId)
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!file || file.status !== "uploaded" || !["page-image", "page-image-hd"].includes(file.kind)) return null;
    const obj = await getObject(file.object_key);
    return { bytes: obj.bytes, contentType: file.content_type };
  }
  if (typeof imageUrl !== "string" || !isAllowedFetchUrl(imageUrl)) return null;
  const res = await fetch(imageUrl);
  if (!res.ok) return null;
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") || "image/png" };
}