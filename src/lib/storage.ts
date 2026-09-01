import { supabase } from "@/integrations/supabase/client";

const STORAGE_OBJECT_MARKER = "/storage/v1/object/";

export function storagePathFromValue(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("http")) return value;

  try {
    const url = new URL(value);
    const markerIndex = url.pathname.indexOf(STORAGE_OBJECT_MARKER);
    if (markerIndex === -1) return null;

    const segments = url.pathname
      .slice(markerIndex + STORAGE_OBJECT_MARKER.length)
      .split("/")
      .filter(Boolean);
    if (["public", "authenticated", "sign"].includes(segments[0])) segments.shift();
    segments.shift();
    return decodeURIComponent(segments.join("/"));
  } catch {
    return null;
  }
}

export async function createPrivateStorageUrl(
  bucket: string,
  value: string | null | undefined,
  expiresIn = 60 * 60 * 24,
): Promise<string | null> {
  const path = storagePathFromValue(value);
  if (!path) return value || null;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    console.warn(`[storage] Could not create protected URL for ${bucket}.`, error.message);
    return null;
  }
  return data.signedUrl;
}
