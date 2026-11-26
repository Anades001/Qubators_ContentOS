import { z } from "zod";

export const BRAND_DNA_PROMPT_VERSION = "brand-dna@1";

/** Brand facts collected by the onboarding wizard. */
export interface BrandProfile {
  name: string;
  industry?: string | null;
  products: string[];
  audience?: string | null;
  platforms: string[];
  personality?: string | null;
  tone?: string | null;
  goals: string[];
  visualStyle?: string | null;
}

const phrase = z.string().trim().min(1).max(160);
const list = (min: number, max: number) =>
  z
    .array(phrase)
    .min(min)
    .transform((items) => [...new Set(items)].slice(0, max));

/** What the model must return. Lists are clamped rather than rejected when too long. */
export const brandDnaSchema = z.object({
  voice: list(3, 6),
  pillars: list(3, 6),
  ctas: list(2, 5),
  usePhrases: list(2, 8),
  avoidPhrases: list(2, 8),
  guidelines: z.string().trim().min(20).max(1500),
});
export type BrandDnaDraft = z.output<typeof brandDnaSchema>;

export const BRAND_DNA_SYSTEM = `You are ContentOS, a brand strategist for creators and small businesses.
You turn brand facts into a concise "Brand DNA" that every later AI task reuses.
Rules:
- Be specific to THIS brand; no generic marketing filler.
- Never invent certifications, awards, statistics or guarantees.
- Write in the brand's own voice where you write copy (CTAs, phrases).
- Respond with ONLY a JSON object, no prose, no code fences.`;

const line = (label: string, value: string | string[] | null | undefined) => {
  const v = Array.isArray(value) ? value.filter(Boolean).join(", ") : value?.trim();
  return v ? `${label}: ${v}` : `${label}: (not provided — infer conservatively)`;
};

export function buildBrandDnaPrompt(brand: BrandProfile): string {
  return [
    "Brand facts:",
    line("Name", brand.name),
    line("Industry", brand.industry),
    line("Products/services", brand.products),
    line("Audience", brand.audience),
    line("Platforms", brand.platforms),
    line("Personality", brand.personality),
    line("Tone", brand.tone),
    line("Goals", brand.goals),
    line("Visual style", brand.visualStyle),
    "",
    "Return JSON with exactly these keys:",
    `{
  "voice": string[3-6]        // adjectives or short traits describing how the brand sounds
  "pillars": string[3-6]      // recurring content themes, e.g. "Behind the scenes"
  "ctas": string[2-5]         // ready-to-use calls to action in the brand voice
  "usePhrases": string[2-8]   // signature words/phrases to use
  "avoidPhrases": string[2-8] // words/claims to avoid (off-brand or unverifiable)
  "guidelines": string        // 2-5 sentences of practical writing guidance
}`,
  ].join("\n");
}

/** Offline draft used by AI_DRIVER=mock — plausible, deterministic, brand-aware. */
export function mockBrandDna(brand: BrandProfile): BrandDnaDraft {
  const tone = (brand.tone ?? brand.personality ?? "warm, clear, confident")
    .split(/[,/]| and /)
    .map((s) => s.trim())
    .filter(Boolean);
  const voice = [
    ...new Set([...tone.map((t) => t[0]!.toUpperCase() + t.slice(1)), "Clear", "Helpful", "Genuine"]),
  ].slice(0, 5);
  const product = brand.products[0] ?? "our products";
  return {
    voice,
    pillars: ["Behind the scenes", "Education & tips", "Product spotlights", "Customer stories", "Community"],
    ctas: [`Shop the ${product} — link in bio`, "Save this for later", "DM us with your questions"],
    usePhrases: [`made by ${brand.name}`, "thoughtfully made", "here's how"],
    avoidPhrases: ["cheap", "guaranteed results", "100% natural"],
    guidelines: `Write like ${brand.name} talks to a friend: ${voice.slice(0, 3).join(", ").toLowerCase()}. Lead with something concrete about ${product}, keep sentences short, and end with one clear call to action. Only state facts you can back up.`,
  };
}
