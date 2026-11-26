import { Ollama } from "ollama";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  /** Model time in ms as reported by the backend (or wall time if unavailable). */
  evalMs: number;
}

/** Minimal LLM surface the app needs. JSON mode only — every AI route returns structured data. */
export interface LlmClient {
  readonly driver: "ollama" | "mock";
  readonly model: string;
  chatJson(messages: ChatMessage[], opts?: { temperature?: number }): Promise<ChatResult>;
}

export class OllamaClient implements LlmClient {
  readonly driver = "ollama" as const;
  private readonly client: Ollama;

  constructor(
    host: string,
    readonly model: string,
    fetchImpl?: typeof fetch,
  ) {
    this.client = new Ollama({ host, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
  }

  async chatJson(messages: ChatMessage[], opts: { temperature?: number } = {}): Promise<ChatResult> {
    const started = Date.now();
    const res = await this.client.chat({
      model: this.model,
      messages,
      format: "json",
      stream: false,
      options: { temperature: opts.temperature ?? 0.4 },
    });
    const evalNs = res.total_duration ?? 0;
    return {
      content: res.message.content,
      evalMs: evalNs > 0 ? Math.round(evalNs / 1e6) : Date.now() - started,
    };
  }
}

/**
 * Deterministic stand-in for tests, CI and machines without Ollama (AI_DRIVER=mock).
 * The handler receives the conversation and returns the raw JSON string the model would.
 */
export class MockLlmClient implements LlmClient {
  readonly driver = "mock" as const;
  readonly model = "mock";
  calls: ChatMessage[][] = [];

  constructor(private readonly handler: (messages: ChatMessage[], call: number) => string) {}

  async chatJson(messages: ChatMessage[]): Promise<ChatResult> {
    this.calls.push(messages);
    return { content: this.handler(messages, this.calls.length), evalMs: 0 };
  }
}
