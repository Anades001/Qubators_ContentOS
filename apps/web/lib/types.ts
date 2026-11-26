export const PLATFORMS = [
  "INSTAGRAM",
  "TIKTOK",
  "LINKEDIN",
  "PINTEREST",
  "FACEBOOK",
  "YOUTUBE",
  "X",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  PINTEREST: "Pinterest",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  X: "X",
};

export interface BrandInput {
  name: string;
  industry: string;
  products: string[];
  audience: string;
  platforms: Platform[];
  personality: string;
  tone: string;
  goals: string[];
  visualStyle: string;
  colors: { primary?: string; accent?: string } | null;
}

export interface Brand
  extends Omit<BrandInput, "industry" | "audience" | "personality" | "tone" | "visualStyle"> {
  id: string;
  slug: string;
  industry: string | null;
  audience: string | null;
  personality: string | null;
  tone: string | null;
  visualStyle: string | null;
  createdAt: string;
  updatedAt: string;
  dnaVersion?: number | null;
}

export interface DnaFields {
  voice: string[];
  pillars: string[];
  ctas: string[];
  usePhrases: string[];
  avoidPhrases: string[];
  guidelines: string;
}

export interface BrandDna extends Omit<DnaFields, "guidelines"> {
  id: string;
  version: number;
  guidelines: string | null;
  sourceAiJobId: string | null;
  createdAt: string;
}

export interface GuardrailWarning {
  claim: string;
  reason: string;
}

export interface DnaDraftResponse {
  aiJobId: string;
  resultJson: DnaFields;
  model: string;
  promptVersion: string;
  evalMs: number;
  guardrailWarnings: GuardrailWarning[];
}

export const emptyBrandInput = (): BrandInput => ({
  name: "",
  industry: "",
  products: [],
  audience: "",
  platforms: [],
  personality: "",
  tone: "",
  goals: [],
  visualStyle: "",
  colors: { primary: "#E8B4B8", accent: "#C9A96A" },
});

export const brandToInput = (b: Brand): BrandInput => ({
  name: b.name,
  industry: b.industry ?? "",
  products: b.products,
  audience: b.audience ?? "",
  platforms: b.platforms,
  personality: b.personality ?? "",
  tone: b.tone ?? "",
  goals: b.goals,
  visualStyle: b.visualStyle ?? "",
  colors: b.colors ?? null,
});

export const emptyDna = (): DnaFields => ({
  voice: [],
  pillars: [],
  ctas: [],
  usePhrases: [],
  avoidPhrases: [],
  guidelines: "",
});

export const dnaToFields = (d: BrandDna): DnaFields => ({
  voice: d.voice,
  pillars: d.pillars,
  ctas: d.ctas,
  usePhrases: d.usePhrases,
  avoidPhrases: d.avoidPhrases,
  guidelines: d.guidelines ?? "",
});
