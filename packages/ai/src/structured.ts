import type { z } from "zod";
import type { ChatMessage, LlmClient } from "./llm";

export class StructuredOutputError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastRaw: string,
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

export interface StructuredResult<T> {
  data: T;
  attempts: number;
  evalMs: number;
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Small models sometimes wrap JSON in prose or code fences; take the outermost object.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Response was not valid JSON");
  }
}

/**
 * Ask for JSON, validate with zod, and on failure feed the error back and retry
 * (PRD.md §7: "7B JSON reliability → zod + retry").
 */
export async function generateStructured<S extends z.ZodType>(
  llm: LlmClient,
  args: { system: string; prompt: string; schema: S; maxAttempts?: number; temperature?: number },
): Promise<StructuredResult<z.output<S>>> {
  const maxAttempts = args.maxAttempts ?? 3;
  const messages: ChatMessage[] = [
    { role: "system", content: args.system },
    { role: "user", content: args.prompt },
  ];
  let evalMs = 0;
  let lastRaw = "";
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await llm.chatJson(messages, { temperature: args.temperature });
    evalMs += res.evalMs;
    lastRaw = res.content;
    try {
      const parsed = args.schema.safeParse(extractJson(res.content));
      if (parsed.success) return { data: parsed.data, attempts: attempt, evalMs };
      lastError = parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    messages.push(
      { role: "assistant", content: res.content },
      {
        role: "user",
        content: `That response did not match the required JSON shape: ${lastError}. Reply again with ONLY the corrected JSON object.`,
      },
    );
  }
  throw new StructuredOutputError(
    `Model output failed validation after ${maxAttempts} attempts: ${lastError}`,
    maxAttempts,
    lastRaw,
  );
}
