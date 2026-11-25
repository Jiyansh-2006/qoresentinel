export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatOptions {
  apiKey?: string;
  model?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface GroqChatResult {
  status: "generated" | "not_configured" | "unavailable";
  content: string | null;
  model: string | null;
  error?: string;
}

const DEFAULT_MODEL = "openai/gpt-oss-120b";

export async function completeGroqChat(
  messages: GroqChatMessage[],
  options: GroqChatOptions = {}
): Promise<GroqChatResult> {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
  if (!apiKey?.trim()) {
    return {
      status: "not_configured",
      content: null,
      model: null,
      error: "GROQ_API_KEY is not configured.",
    };
  }

  const model = options.model?.trim() || process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (options.fetcher ?? fetch)(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 220,
          messages,
        }),
      }
    );

    if (!response.ok) {
      return {
        status: "unavailable",
        content: null,
        model,
        error: `Groq request failed (HTTP ${response.status}).`,
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return {
        status: "unavailable",
        content: null,
        model,
        error: "Groq returned an empty or invalid response.",
      };
    }

    return {
      status: "generated",
      content: content.trim(),
      model,
    };
  } catch {
    return {
      status: "unavailable",
      content: null,
      model,
      error: controller.signal.aborted
        ? `Groq request timed out after ${timeoutMs} ms.`
        : "Groq request failed because the provider could not be reached or returned invalid data.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
