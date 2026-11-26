"use client";

import type { DnaFields, GuardrailWarning } from "@/lib/types";
import { TagInput } from "./TagInput";

interface Props {
  value: DnaFields;
  onChange: (next: DnaFields) => void;
  warnings?: GuardrailWarning[];
}

export function GuardrailBanner({ warnings }: { warnings: GuardrailWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div role="alert" className="rounded-xl border border-[#F3D9A4] bg-[#FFF8EB] p-4 text-[14px]">
      <p className="font-semibold">⚠️ Verify before publishing</p>
      <ul className="mt-2 space-y-1">
        {warnings.map((w) => (
          <li key={w.claim}>
            <span className="font-medium">“{w.claim}”</span> <span className="text-stone">— {w.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DnaEditor({ value, onChange, warnings = [] }: Props) {
  const set = <K extends keyof DnaFields>(key: K, v: DnaFields[K]) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-5">
      <GuardrailBanner warnings={warnings} />
      <TagInput
        label="Voice"
        hint="How the brand sounds — 3 to 6 traits."
        value={value.voice}
        onChange={(v) => set("voice", v)}
        max={10}
      />
      <TagInput
        label="Content pillars"
        hint="Recurring themes every idea maps to."
        value={value.pillars}
        onChange={(v) => set("pillars", v)}
        max={10}
      />
      <TagInput label="Calls to action" value={value.ctas} onChange={(v) => set("ctas", v)} max={10} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TagInput label="Phrases to use" value={value.usePhrases} onChange={(v) => set("usePhrases", v)} />
        <TagInput
          label="Phrases to avoid"
          value={value.avoidPhrases}
          onChange={(v) => set("avoidPhrases", v)}
          tone="avoid"
        />
      </div>
      <div>
        <label className="label" htmlFor="guidelines">
          Writing guidelines
        </label>
        <textarea
          id="guidelines"
          className="input min-h-[120px]"
          value={value.guidelines}
          onChange={(e) => set("guidelines", e.target.value)}
          maxLength={3000}
        />
      </div>
    </div>
  );
}

/** Read-only view of a saved DNA. */
export function DnaSummary({ value }: { value: DnaFields }) {
  const Row = ({ label, items, avoid }: { label: string; items: string[]; avoid?: boolean }) => (
    <div>
      <h3 className="mb-2 text-[13px] font-medium text-stone">{label}</h3>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((i) => (
            <span
              key={i}
              className={`rounded-full px-2.5 py-1 text-[13px] ${avoid ? "bg-[#FDECEC] text-danger line-through decoration-1" : "bg-cream text-ink"}`}
            >
              {i}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-stone">—</p>
      )}
    </div>
  );
  return (
    <div className="space-y-5">
      <Row label="Voice" items={value.voice} />
      <Row label="Content pillars" items={value.pillars} />
      <Row label="Calls to action" items={value.ctas} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Row label="Phrases to use" items={value.usePhrases} />
        <Row label="Phrases to avoid" items={value.avoidPhrases} avoid />
      </div>
      <div>
        <h3 className="mb-2 text-[13px] font-medium text-stone">Writing guidelines</h3>
        <p className="whitespace-pre-line text-[15px] leading-relaxed">{value.guidelines || "—"}</p>
      </div>
    </div>
  );
}
