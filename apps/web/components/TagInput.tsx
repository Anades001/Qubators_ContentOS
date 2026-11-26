"use client";

import { useId, useState } from "react";

interface Props {
  label: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  tone?: "default" | "avoid";
}

/** Free-text list editor: Enter or comma adds, × removes, Backspace on empty removes last. */
export function TagInput({ label, hint, value, onChange, placeholder, max = 20, tone = "default" }: Props) {
  const id = useId();
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const items = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (items.length) onChange([...value, ...items].slice(0, max));
    setDraft("");
  };

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="flex min-h-[50px] flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 py-2 transition focus-within:border-plum focus-within:ring-4 focus-within:ring-plum-soft">
        {value.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] ${
              tone === "avoid" ? "bg-[#FDECEC] text-danger" : "bg-plum-soft text-plum"
            }`}
          >
            <span className={tone === "avoid" ? "line-through decoration-1" : undefined}>{item}</span>
            <button
              type="button"
              aria-label={`Remove ${item}`}
              className="ml-0.5 rounded-full px-1 leading-none opacity-70 hover:opacity-100"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          className="min-w-[140px] flex-1 bg-transparent px-1.5 py-1 text-[15px] outline-none"
          value={draft}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
        />
      </div>
      {hint ? <p className="mt-1.5 text-xs text-stone">{hint}</p> : null}
    </div>
  );
}
