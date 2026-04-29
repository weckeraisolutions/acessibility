// Centralized Gemini API key rotation (round-robin) + automatic failover.
// NEVER log key values — only key_index (0 or 1).

let roundRobinIndex = 0;

export function getGeminiKeys(): string[] {
  const k1 = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
  const k2 = (Deno.env.get("GEMINI_API_KEY2") ?? "").trim();
  return [k1, k2].filter((k) => k.length > 0);
}

export function validateGeminiKeysConfigured(): { ok: boolean; message?: string } {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    return { ok: false, message: "Nenhuma chave Gemini configurada (GEMINI_API_KEY ou GEMINI_API_KEY2)" };
  }
  return { ok: true };
}

export function getNextGeminiKeyIndex(keysLength: number): number {
  if (keysLength <= 0) return 0;
  const idx = roundRobinIndex % keysLength;
  roundRobinIndex = (roundRobinIndex + 1) % Number.MAX_SAFE_INTEGER;
  return idx;
}

const RECOVERABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export interface BothKeysFailedError {
  both_keys_failed: true;
  last_status: number;
  last_error_text: string;
  last_response?: Response;
}

/**
 * Calls a Gemini endpoint using the configured key(s) with round-robin and
 * automatic failover on recoverable errors (429/5xx/network).
 *
 * - With 1 key configured: behaves like a single attempt (no failover).
 * - With 2 keys: tries the next round-robin key first; on recoverable failure,
 *   tries the other key. If both fail, throws BothKeysFailedError.
 * - Non-recoverable errors (e.g. 400/403) are returned as-is without failover.
 */
export async function callGeminiWithFailover(
  callFn: (apiKey: string, keyIndex: number) => Promise<Response>,
): Promise<Response> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw { status: 500, error: "no_gemini_keys", message: "Nenhuma chave Gemini configurada" };
  }

  const startIdx = getNextGeminiKeyIndex(keys.length);
  const order = keys.length === 1 ? [startIdx] : [startIdx, (startIdx + 1) % keys.length];

  let lastStatus = 0;
  let lastErrorText = "";
  let lastResponse: Response | undefined;
  let lastThrown: unknown = null;

  for (let i = 0; i < order.length; i++) {
    const idx = order[i];
    const isLast = i === order.length - 1;
    try {
      const resp = await callFn(keys[idx], idx);
      if (resp.ok) {
        if (i > 0) {
          console.log(`[GEMINI-KEYS] attempt key_index=${idx} status=${resp.status} - success after failover`);
        } else {
          console.log(`[GEMINI-KEYS] attempt key_index=${idx} status=${resp.status}`);
        }
        return resp;
      }

      const status = resp.status;
      const recoverable = RECOVERABLE_STATUSES.has(status);
      // We need to read the body for diagnostics, but only if we won't return the response.
      if (recoverable && !isLast && keys.length > 1) {
        const errText = await resp.text().catch(() => "");
        lastStatus = status;
        lastErrorText = errText;
        lastResponse = undefined;
        const nextIdx = order[i + 1];
        console.log(`[GEMINI-KEYS] attempt key_index=${idx} status=${status} - failing over to key_index=${nextIdx}`);
        continue;
      }

      // Non-recoverable, OR last attempt: return the response unchanged so the caller can read body once.
      if (!recoverable) {
        console.log(`[GEMINI-KEYS] attempt key_index=${idx} status=${status} - non-recoverable, returning`);
        return resp;
      }

      // Recoverable but last attempt → both keys failed
      const errText = await resp.text().catch(() => "");
      console.log(`[GEMINI-KEYS] attempt key_index=${idx} status=${status}`);
      console.log(`[GEMINI-KEYS] both keys failed last_status=${status} last_error=${errText.slice(0, 200)}`);
      const err: BothKeysFailedError = {
        both_keys_failed: true,
        last_status: status,
        last_error_text: errText,
      };
      throw err;
    } catch (e) {
      // BothKeysFailedError already constructed → rethrow
      if (e && typeof e === "object" && (e as any).both_keys_failed) throw e;

      lastThrown = e;
      lastStatus = lastStatus || 0;
      lastErrorText = (e as any)?.message || String(e);

      if (!isLast && keys.length > 1) {
        const nextIdx = order[i + 1];
        console.log(`[GEMINI-KEYS] attempt key_index=${idx} network_error=${lastErrorText.slice(0, 120)} - failing over to key_index=${nextIdx}`);
        continue;
      }

      if (keys.length === 1) {
        // Single key configured → propagate original error
        throw e;
      }

      console.log(`[GEMINI-KEYS] both keys failed last_status=${lastStatus} last_error=${lastErrorText.slice(0, 200)}`);
      const err: BothKeysFailedError = {
        both_keys_failed: true,
        last_status: lastStatus,
        last_error_text: lastErrorText,
      };
      throw err;
    }
  }

  // Unreachable, but TypeScript needs a return
  throw lastThrown ?? { both_keys_failed: true, last_status: lastStatus, last_error_text: lastErrorText };
}

export function isBothKeysFailed(e: unknown): e is BothKeysFailedError {
  return !!(e && typeof e === "object" && (e as any).both_keys_failed === true);
}