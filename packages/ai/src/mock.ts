import { MockLlmClient } from "./llm";
import { BRAND_DNA_SYSTEM, mockBrandDna, type BrandProfile } from "./prompts/brand-dna";

/** Reads `Label: value` lines back out of a prompt built by buildBrandDnaPrompt. */
function promptField(prompt: string, label: string): string | null {
  const line = prompt.split("\n").find((l) => l.startsWith(`${label}: `));
  const value = line?.slice(label.length + 2).trim();
  return value && !value.startsWith("(not provided") ? value : null;
}

/**
 * AI_DRIVER=mock: answers each known prompt type with a deterministic, schema-valid draft,
 * so the whole product can be clicked through without a model.
 */
export function createMockLlm(): MockLlmClient {
  return new MockLlmClient((messages) => {
    const system = messages.find((m) => m.role === "system")?.content;
    const prompt = messages.find((m) => m.role === "user")?.content ?? "";
    if (system === BRAND_DNA_SYSTEM) {
      const profile: BrandProfile = {
        name: promptField(prompt, "Name") ?? "Your brand",
        products: promptField(prompt, "Products/services")?.split(", ") ?? [],
        platforms: [],
        goals: [],
        tone: promptField(prompt, "Tone"),
        personality: promptField(prompt, "Personality"),
      };
      return JSON.stringify(mockBrandDna(profile));
    }
    return "{}";
  });
}
