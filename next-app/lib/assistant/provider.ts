// lib/assistant/provider.ts — the one place the assistant talks to a language model.
//
// Owner decision 5: the provider is one adapter and one set of environment variables. This
// speaks the OpenAI-compatible chat-completions shape, which OpenRouter, OpenAI and most
// others accept, so moving provider means changing ASSISTANT_BASE_URL and ASSISTANT_API_KEY
// and, at most, this file. No vendor SDK, and nothing vendor-specific leaks out of here.
//
// The model does ONE thing for this assistant: it phrases an answer that retrieve.ts has
// already looked up. It never decides a fact. So a failure here is never an outage — the
// caller falls back to the unphrased answer (rung 3 in answer.ts) — and this module is
// written to fail fast and quietly rather than to try hard.
//
// Environment:
//   ASSISTANT_BASE_URL   e.g. https://openrouter.ai/api/v1      (no trailing slash)
//   ASSISTANT_API_KEY    the provider key. Server-side only; never NEXT_PUBLIC_.
//   ASSISTANT_MODELS     comma-separated fallback chain, best first, e.g.
//                        google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,dots-studio/dots-3-note-preview:free
//
// The chain is configuration, never a literal in code: free models rotate out without
// warning, and the privacy policy names the providers, so changing the chain is a release
// step with a policy amendment, not a quick edit.

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  /** Fallback chain, best first. */
  models: string[];
  /** Sent as X-Title / HTTP-Referer; OpenRouter shows them in its dashboard. Harmless elsewhere. */
  appName?: string;
  appUrl?: string;
  /**
   * Extra fields merged into every request body. Set from ASSISTANT_EXTRA_BODY (JSON) for a
   * provider that needs something non-standard. For OpenRouter the default is
   * {"reasoning":{"enabled":false}}: some free models are reasoning models and will spend the
   * whole token budget thinking and return no content at all — phrasing three sentences does
   * not need reasoning. Providers that reject unknown fields get nothing extra unless asked.
   */
  extraBody?: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PhraseRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface PhraseResult {
  text: string;
  modelId: string;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderConfig | null {
  const baseUrl = env.ASSISTANT_BASE_URL?.replace(/\/+$/, '');
  const apiKey = env.ASSISTANT_API_KEY;
  const models = (env.ASSISTANT_MODELS ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (!baseUrl || !apiKey || !models.length) return null;
  let extraBody: Record<string, unknown> | undefined;
  if (env.ASSISTANT_EXTRA_BODY) {
    try {
      extraBody = JSON.parse(env.ASSISTANT_EXTRA_BODY) as Record<string, unknown>;
    } catch {
      console.warn('[assistant] ASSISTANT_EXTRA_BODY is not valid JSON; ignoring');
    }
  } else if (/openrouter\.ai/.test(baseUrl)) {
    extraBody = { reasoning: { enabled: false } };
  }
  return {
    baseUrl,
    apiKey,
    models,
    appName: env.ASSISTANT_APP_NAME ?? 'MyBuddyMaid support assistant',
    appUrl: env.ASSISTANT_APP_URL ?? 'https://mybuddymaid.in',
    extraBody,
  };
}

// ─── Circuit breaker ────────────────────────────────────────────────────────────────────────
// Per model, in memory, per server instance. Three consecutive failures skip the model for five
// minutes, so a dead model costs one timeout rather than one per conversation. Instances do not
// share state; that is acceptable because rung 3 is always there and the cost of a miss is one
// slow request, not a wrong answer.

interface Circuit {
  failures: number;
  openUntil: number;
}

const circuits = new Map<string, Circuit>();
const OPEN_AFTER_FAILURES = 3;
const OPEN_FOR_MS = 5 * 60 * 1000;

function circuitOpen(model: string, now: number): boolean {
  const c = circuits.get(model);
  return !!c && c.openUntil > now;
}

function recordFailure(model: string, now: number): void {
  const c = circuits.get(model) ?? { failures: 0, openUntil: 0 };
  c.failures += 1;
  if (c.failures >= OPEN_AFTER_FAILURES) {
    c.openUntil = now + OPEN_FOR_MS;
    c.failures = 0;
  }
  circuits.set(model, c);
}

function recordSuccess(model: string): void {
  circuits.delete(model);
}

/** Test hook. */
export function resetCircuits(): void {
  circuits.clear();
}

// ─── The call ───────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Ask the first available model in the chain to produce a completion. Returns null when every
 * model failed, was rate-limited, timed out, or answered with nothing usable. Never throws.
 */
export async function phrase(
  req: PhraseRequest,
  config: ProviderConfig,
  deps: { fetchImpl?: FetchLike; now?: () => number } = {},
): Promise<PhraseResult | null> {
  const fetchImpl = deps.fetchImpl ?? (globalThis.fetch as FetchLike);
  const now = deps.now ?? Date.now;
  const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (const model of config.models) {
    if (circuitOpen(model, now())) continue;

    try {
      const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...(config.appUrl ? { 'HTTP-Referer': config.appUrl } : {}),
          ...(config.appName ? { 'X-Title': config.appName } : {}),
        },
        body: JSON.stringify({
          ...(config.extraBody ?? {}),
          model,
          messages: req.messages,
          max_tokens: req.maxTokens ?? 320,
          temperature: req.temperature ?? 0.3,
          stream: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        // 429 and 5xx are the model or provider being unavailable; 4xx otherwise is our request.
        // Either way this model is not answering right now — count it and move on.
        recordFailure(model, now());
        console.warn(`[assistant] ${model} returned ${res.status}`);
        continue;
      }

      const body = (await res.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
      };
      const raw = body.choices?.[0]?.message?.content;
      const text = (Array.isArray(raw) ? raw.map((p) => p?.text ?? '').join('') : raw ?? '').trim();
      if (!text) {
        recordFailure(model, now());
        continue;
      }

      recordSuccess(model);
      return { text, modelId: body.model ?? model };
    } catch (err) {
      // AbortError (timeout), network failure, or unparseable JSON. Same treatment.
      recordFailure(model, now());
      console.warn(`[assistant] ${model} threw: ${err instanceof Error ? err.name : String(err)}`);
    }
  }

  return null;
}
