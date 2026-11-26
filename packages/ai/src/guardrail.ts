export interface GuardrailWarning {
  claim: string;
  reason: string;
}

/** Claims that need evidence before publishing (PRD §32, "AI Accuracy Guardrail"). */
const RISKY_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b100\s?%\s?\w+/i, reason: "Absolute claim — verify before publishing" },
  {
    pattern: /\b(certified|organic|vegan|cruelty[- ]free|eco[- ]friendly|sustainable)\b/i,
    reason: "Certification or sustainability claim — confirm you can prove it",
  },
  {
    pattern: /\b(best|cheapest|#1|number one|world'?s first)\b/i,
    reason: "Superlative or comparative claim — needs evidence",
  },
  {
    pattern: /\b(guarantee[ds]?|never fails?|lasts forever|cures?|clinically)\b/i,
    reason: "Guarantee or health/performance claim — verify",
  },
];

/**
 * Flags risky claims in AI output. `allowed` is the brand's own verified text (FAQs, guidelines)
 * — a claim that already appears there is treated as supported.
 */
export function scanClaims(texts: string[], allowed: string[] = []): GuardrailWarning[] {
  const support = allowed.join("\n").toLowerCase();
  const seen = new Set<string>();
  const warnings: GuardrailWarning[] = [];
  for (const text of texts) {
    for (const { pattern, reason } of RISKY_PATTERNS) {
      const match = text.match(pattern);
      if (!match) continue;
      const claim = match[0];
      const key = claim.toLowerCase();
      // Skip duplicates and fragments of a claim already flagged ("organic" inside "100% organic").
      if ([...seen].some((s) => s.includes(key)) || support.includes(key)) continue;
      seen.add(key);
      warnings.push({ claim, reason });
    }
  }
  return warnings;
}
