/**
 * Persistent Akakçe session (the `AAATLGST` auth cookie obtained at login).
 *
 * Stored at ~/.config/akakce-mcp/session.json with 0600 perms — the token is a
 * long-lived credential (rememberMe ≈ 1 year), so we never put it in the repo or
 * env; it lives only in the user's config dir.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";

const DIR = join(homedir(), ".config", "akakce-mcp");
const FILE = join(DIR, "session.json");

export interface Session {
  cookie: string; // full "AAATLGST=...." cookie pair
  userId?: number;
  email?: string;
  name?: string;
  savedAt: string;
}

let cache: Session | null | undefined;

export function loadSession(): Session | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(FILE, "utf-8")) as Session;
  } catch {
    cache = null;
  }
  return cache;
}

export function saveSession(s: Session): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(s, null, 2), { mode: 0o600 });
  cache = s;
}

export function clearSession(): boolean {
  cache = null;
  if (existsSync(FILE)) {
    rmSync(FILE);
    return true;
  }
  return false;
}

/** Cookie string for authed requests, or undefined if not logged in. */
export function authCookie(): string | undefined {
  return loadSession()?.cookie;
}
