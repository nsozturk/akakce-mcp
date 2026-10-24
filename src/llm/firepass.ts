/**
 * Fire-Pass guarded Fireworks client.
 *
 * COST-CRITICAL: only the Fire-Pass turbo router is covered by subscription plans.
 * Any other Fireworks model is billed per-token. We hard-assert the model slug
 * before every call and refuse to run on mismatch.
 */

export const FIREWORKS_BASE = "https://api.fireworks.ai/inference/v1";
export const FIRE_PASS_MODEL = "accounts/fireworks/routers/kimi-k2p6-turbo";

export class FirePassGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirePassGuardError";
  }
}

/** Hard guard — throws unless `model` is exactly the Fire-Pass turbo router. */
export function assertFirePassModel(model: string): void {
  if (model !== FIRE_PASS_MODEL) {
    throw new FirePassGuardError(
      `Refusing to call Fireworks with model '${model}'. Fire Pass covers ONLY ` +
        `'${FIRE_PASS_MODEL}'. Any other model is billed per-token — aborting.`,
    );
  }
}

export function fireworksKeyAvailable(): boolean {
  return Boolean(process.env.FIREWORKS_API_KEY);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * One guarded chat completion against the Fire-Pass turbo router.
 * Retries HTTP 429 with exponential backoff. Never sends any other model.
 */
export async function firePassChat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<string> {
  const model = opts.model ?? FIRE_PASS_MODEL;
  assertFirePassModel(model); // guard #1: before constructing the request

  const key = process.env.FIREWORKS_API_KEY;
  if (!key) {
    throw new FirePassGuardError(
      "FIREWORKS_API_KEY is not set; akakce_llm_enrich is disabled.",
    );
  }

  const body = JSON.stringify({
    model, // guard #1 already validated this exact slug
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1024,
  });

  const backoffs = [3000, 4000, 6000, 10000];
  for (let attempt = 0; ; attempt++) {
    assertFirePassModel(model); // guard #2: before the actual network call
    const res = await fetch(`${FIREWORKS_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body,
    });
    if (res.status === 429 && attempt < backoffs.length) {
      await sleep(backoffs[attempt]);
      continue;
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Fireworks HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content ?? "";
  }
}
