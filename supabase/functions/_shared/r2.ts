// Cloudflare R2 access through its S3-compatible API.
// Credentials come only from Edge Function secrets, never from the client.

import { AwsClient } from "npm:aws4fetch@1.0.20";

const accountId = Deno.env.get("R2_ACCOUNT_ID");
const bucket = Deno.env.get("R2_BUCKET");
const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");

if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
  console.error("[r2] Missing R2_* secrets");
}

const client = new AwsClient({
  accessKeyId: accessKeyId ?? "",
  secretAccessKey: secretAccessKey ?? "",
  service: "s3",
  region: "auto",
});

function objectUrl(key: string): URL {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encoded}`);
}

/** Converts a hex SHA-256 digest to the base64 form S3 checksum headers use. */
export function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.match(/../g)!.map((b) => parseInt(b, 16)));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Presigned PUT URL. The checksum header is signed, so R2 rejects any body
 * whose SHA-256 differs from the one declared when the upload was requested.
 */
export async function presignUpload(key: string, checksumSha256Hex: string, expiresIn: number) {
  const url = objectUrl(key);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  const headers = { "x-amz-checksum-sha256": hexToBase64(checksumSha256Hex) };
  const signed = await client.sign(new Request(url, { method: "PUT", headers }), { aws: { signQuery: true } });
  return { url: signed.url, headers };
}

export async function presignDownload(key: string, expiresIn: number, downloadName?: string) {
  const url = objectUrl(key);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  if (downloadName) {
    url.searchParams.set(
      "response-content-disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
    );
  }
  const signed = await client.sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
  return signed.url;
}

export interface ObjectInfo {
  size: number;
  contentType: string | null;
  checksumSha256: string | null;
}

/** Returns null when the object does not exist. */
export async function headObject(key: string): Promise<ObjectInfo | null> {
  const res = await client.fetch(objectUrl(key), {
    method: "HEAD",
    headers: { "x-amz-checksum-mode": "ENABLED" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD failed with HTTP ${res.status}`);
  return {
    size: Number(res.headers.get("content-length") ?? "0"),
    contentType: res.headers.get("content-type"),
    checksumSha256: res.headers.get("x-amz-checksum-sha256"),
  };
}

/** Server-side upload, used when the function itself produces the file. */
export async function putObject(key: string, bytes: Uint8Array, contentType: string, checksumSha256Hex: string) {
  const res = await client.fetch(objectUrl(key), {
    method: "PUT",
    headers: { "content-type": contentType, "x-amz-checksum-sha256": hexToBase64(checksumSha256Hex) },
    body: bytes,
  });
  if (!res.ok) throw new Error(`R2 PUT failed with HTTP ${res.status}`);
}

export async function getObject(key: string): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const res = await client.fetch(objectUrl(key), { method: "GET" });
  if (!res.ok) throw new Error(`R2 GET failed with HTTP ${res.status}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function deleteObject(key: string): Promise<void> {
  const res = await client.fetch(objectUrl(key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE failed with HTTP ${res.status}`);
}
