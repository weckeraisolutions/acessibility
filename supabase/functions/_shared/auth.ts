// Shared authentication helpers for edge functions.
// All functions use verify_jwt = false (Lovable default) and validate JWTs in code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
 * SSRF guard: only allow URLs whose hostname is the project's Supabase host
 * or a *.supabase.co / *.supabase.in subdomain.
 */
export function isAllowedFetchUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    const supaUrl = Deno.env.get("SUPABASE_URL");
    if (supaUrl) {
      try {
        const supaHost = new URL(supaUrl).hostname.toLowerCase();
        if (host === supaHost) return true;
      } catch { /* ignore */ }
    }
    if (host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) return true;
    return false;
  } catch {
    return false;
  }
}