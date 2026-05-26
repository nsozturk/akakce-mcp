/**
 * Shared HTTP layer for Akakçe.
 *
 * The api6 JSON endpoints are public (no auth/cookie). However, the `/product/*`
 * endpoints and the www.akakce.com product pages sit behind Akamai bot protection
 * that fingerprints the TLS/HTTP2 client: Node's built-in `fetch` (undici) gets a
 * 403 challenge page, while `curl` is accepted. To be robust across ALL endpoints
 * we route every request through the system `curl` with browser headers copied
 * verbatim from the captured HAR.
 */
import { execFile } from "node:child_process";

export const API_BASE = "https://api6.akakce.com";
export const WEB_BASE = "https://www.akakce.com";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Origin: WEB_BASE,
  Referer: `${WEB_BASE}/`,
};

const DEFAULT_TIMEOUT_S = 15;
const MAX_RETRIES = 2;

export class AkakceApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = "AkakceApiError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run a single curl GET, returning { status, body }. */
function curlGet(
  url: string,
  accept: string,
): Promise<{ status: number; body: string }> {
  const args = [
    "-s",
    "--compressed",
    "--max-time",
    String(DEFAULT_TIMEOUT_S),
    "-w",
    "\n%{http_code}",
    "-H",
    `Accept: ${accept}`,
  ];
  for (const [k, v] of Object.entries(BROWSER_HEADERS)) {
    args.push("-H", `${k}: ${v}`);
  }
  args.push(url);

  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      args,
      { maxBuffer: 32 * 1024 * 1024 },
      (err, stdout) => {
        if (err && !stdout) {
          reject(new AkakceApiError(`curl failed: ${err.message}`, undefined, url));
          return;
        }
        const nl = stdout.lastIndexOf("\n");
        const body = nl >= 0 ? stdout.slice(0, nl) : stdout;
        const status = nl >= 0 ? Number(stdout.slice(nl + 1).trim()) : 0;
        resolve({ status, body });
      },
    );
  });
}

/** Fetch raw text with transient-error retry/backoff. */
export async function fetchText(
  url: string,
  accept = "text/html,application/json",
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { status, body } = await curlGet(url, accept);
      if (status === 429 || status >= 500) {
        if (attempt < MAX_RETRIES) {
          await sleep(400 * 2 ** attempt);
          continue;
        }
        throw new AkakceApiError(`Upstream ${status}`, status, url);
      }
      if (status < 200 || status >= 400) {
        throw new AkakceApiError(`HTTP ${status}`, status, url);
      }
      return body;
    } catch (err) {
      lastErr = err;
      if (err instanceof AkakceApiError && err.status && err.status < 500) throw err;
      if (attempt < MAX_RETRIES) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
    }
  }
  throw new AkakceApiError(
    `Request failed after ${MAX_RETRIES + 1} attempts: ${String(lastErr)}`,
    undefined,
    url,
  );
}

/**
 * GET a JSON endpoint. `path` may be absolute (https://...) or a path on api6.
 * Query values are URL-encoded; arrays are joined with ",".
 */
export async function apiGet<T = unknown>(
  path: string,
  query: Record<string, string | number | undefined | (string | number)[]> = {},
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const text = await fetchText(url.toString(), "application/json, text/plain, */*");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AkakceApiError(
      `Response was not valid JSON (first 120 chars: ${text.slice(0, 120)})`,
      undefined,
      url.toString(),
    );
  }
}

/** Extract the numeric product code from an Akakçe product URL (`...,<CODE>.html`). */
export function codeFromUrl(url: string): number | undefined {
  const m = url.match(/,(\d+)\.html/);
  return m ? Number(m[1]) : undefined;
}

/** Absolutize a relative Akakçe URL/image path. */
export function absoluteUrl(u: string | undefined): string | undefined {
  if (!u) return u;
  if (u.startsWith("http")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  return `${WEB_BASE}${u.startsWith("/") ? "" : "/"}${u}`;
}
