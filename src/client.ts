/**
 * Shared HTTP layer for Akakçe (api6.akakce.com).
 *
 * The endpoints are public except the /user/* suite, which authenticates via the
 * `AAATLGST` cookie obtained at login. Akamai bot protection fingerprints the
 * TLS/HTTP2 client (Node `fetch` → 403, `curl` accepted), so every request goes
 * through the system `curl` with browser/app headers.
 *
 * /auth/* responses are base64-encoded JSON; everything else is plain JSON. The
 * JSON parser auto-detects and decodes base64.
 */
import { execFile } from "node:child_process";
import { authCookie } from "./session.js";

export const API_BASE = "https://api6.akakce.com";
export const WEB_BASE = "https://www.akakce.com";

// Web (Chrome) headers — used for browse/search/product endpoints.
const WEB_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Origin: WEB_BASE,
  Referer: `${WEB_BASE}/`,
};

// Native-app User-Agent — used for /user/*, /auth/*, /home/v3/app, app ctquery.
const APP_UA = "Akakce/100 CFNetwork/1335.0.3.4 Darwin/21.6.0";

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

export class AkakceAuthError extends Error {
  constructor(message = "Bu işlem için giriş gerekli. Önce akakce_login kullanın.") {
    super(message);
    this.name = "AkakceAuthError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RequestOpts {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown; // JSON body for POST/DELETE
  app?: boolean; // use native-app UA
  auth?: boolean; // attach AAATLGST cookie (required for /user/*)
  accept?: string;
  /** capture response headers (e.g. Set-Cookie at login) */
  wantHeaders?: boolean;
}

interface RawResult {
  status: number;
  body: string;
  headers: string;
}

function runCurl(url: string, opts: RequestOpts): Promise<RawResult> {
  const headers = { ...(opts.app ? { "User-Agent": APP_UA } : WEB_HEADERS) };
  const args: string[] = [
    "-s",
    "--compressed",
    "--max-time",
    String(DEFAULT_TIMEOUT_S),
    "-w",
    "\n%{http_code}",
  ];
  if (opts.wantHeaders) args.push("-D", "-"); // dump response headers to stdout
  args.push("-X", opts.method ?? "GET");
  args.push("-H", `Accept: ${opts.accept ?? "application/json, text/plain, */*"}`);
  for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);

  if (opts.auth) {
    const cookie = authCookie();
    if (!cookie) throw new AkakceAuthError();
    args.push("-H", `Cookie: ${cookie}`);
  }
  if (opts.body !== undefined) {
    args.push("-H", "Content-Type: application/json");
    args.push("--data-binary", JSON.stringify(opts.body));
  }
  args.push(url);

  return new Promise((resolve, reject) => {
    execFile("curl", args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) {
        reject(new AkakceApiError(`curl failed: ${err.message}`, undefined, url));
        return;
      }
      // With -D -, headers precede body separated by a blank line; status code is
      // the last line (from -w). Split status off first.
      const lastNl = stdout.lastIndexOf("\n");
      const status = lastNl >= 0 ? Number(stdout.slice(lastNl + 1).trim()) : 0;
      let rest = lastNl >= 0 ? stdout.slice(0, lastNl) : stdout;
      let headers = "";
      if (opts.wantHeaders) {
        const sep = rest.indexOf("\r\n\r\n") >= 0 ? "\r\n\r\n" : "\n\n";
        const idx = rest.indexOf(sep);
        if (idx >= 0) {
          headers = rest.slice(0, idx);
          rest = rest.slice(idx + sep.length);
        }
      }
      resolve({ status, body: rest, headers });
    });
  });
}

async function request(url: string, opts: RequestOpts): Promise<RawResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const r = await runCurl(url, opts);
      if (r.status === 429 || r.status >= 500) {
        if (attempt < MAX_RETRIES) {
          await sleep(400 * 2 ** attempt);
          continue;
        }
        throw new AkakceApiError(`Upstream ${r.status}`, r.status, url);
      }
      if (r.status === 401 || r.status === 403) {
        if (opts.auth) throw new AkakceAuthError("Oturum geçersiz/süresi dolmuş. akakce_login ile tekrar giriş yapın.");
        throw new AkakceApiError(`HTTP ${r.status}`, r.status, url);
      }
      if (r.status < 200 || r.status >= 400) {
        throw new AkakceApiError(`HTTP ${r.status}`, r.status, url);
      }
      return r;
    } catch (err) {
      lastErr = err;
      if (err instanceof AkakceAuthError) throw err;
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

/** Decode a body that may be base64-encoded JSON (used by /auth/* responses). */
function decodeMaybeBase64(text: string): string {
  const t = text.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return text;
  try {
    const dec = Buffer.from(text, "base64").toString("utf-8");
    const d = dec.trimStart();
    if (d.startsWith("{") || d.startsWith("[")) return dec;
  } catch {
    /* not base64 */
  }
  return text;
}

/** Raw text fetch (used for product-page HTML scraping). */
export async function fetchText(url: string, accept = "text/html"): Promise<string> {
  const r = await request(url, { accept });
  return r.body;
}

function buildUrl(
  path: string,
  query: Record<string, string | number | undefined | (string | number)[]>,
): string {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  return url.toString();
}

function parseJson<T>(text: string, url: string): T {
  const decoded = decodeMaybeBase64(text);
  try {
    return JSON.parse(decoded) as T;
  } catch {
    throw new AkakceApiError(
      `Response was not valid JSON (first 120 chars: ${decoded.slice(0, 120)})`,
      undefined,
      url,
    );
  }
}

/** GET a JSON endpoint. */
export async function apiGet<T = unknown>(
  path: string,
  query: Record<string, string | number | undefined | (string | number)[]> = {},
  opts: Pick<RequestOpts, "app" | "auth"> = {},
): Promise<T> {
  const url = buildUrl(path, query);
  const r = await request(url, { method: "GET", ...opts });
  return parseJson<T>(r.body, url);
}

/** POST/DELETE a JSON endpoint. */
export async function apiSend<T = unknown>(
  method: "POST" | "DELETE",
  path: string,
  body: unknown,
  opts: Pick<RequestOpts, "app" | "auth"> = {},
): Promise<T> {
  const url = buildUrl(path, {});
  const r = await request(url, { method, body, ...opts });
  return parseJson<T>(r.body, url);
}

/**
 * Login: POST credentials, capture the Set-Cookie AAATLGST pair.
 * Returns the cookie string + decoded result body.
 */
export async function loginRequest(
  email: string,
  password: string,
): Promise<{ cookie: string; result: any }> {
  const url = buildUrl("/auth/user/login", {});
  const r = await runCurl(url, {
    method: "POST",
    body: { email, password, rememberMe: true },
    app: true,
    wantHeaders: true,
  });
  if (r.status < 200 || r.status >= 400) {
    throw new AkakceApiError(`Login HTTP ${r.status}`, r.status, url);
  }
  const m = r.headers.match(/[Ss]et-[Cc]ookie:\s*(AAATLGST=[^;]+)/);
  if (!m) {
    throw new AkakceAuthError(
      "Giriş başarısız: e-posta/şifre hatalı olabilir (oturum çerezi alınamadı).",
    );
  }
  const parsed = parseJson<any>(r.body, url);
  return { cookie: m[1], result: parsed?.result ?? parsed };
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
