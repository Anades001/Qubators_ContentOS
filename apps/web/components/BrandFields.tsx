"use client";

import { PLATFORMS, PLATFORM_LABELS, type BrandInput } from "@/lib/types";
import { TagInput } from "./TagInput";

type Set = <K extends keyof BrandInput>(key: K, value: BrandInput[K]) => void;

interface Props {
  value: BrandInput;
  set: Set;
}

export function BasicsFields({ value, set }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="name">
          Brand name
        </label>
        <input
          id="name"
          className="input"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          required
          maxLength={80}
          autoFocus
        />
      </div>
      <div>
        <label className="label" htmlFor="industry">
          Industry
        </label>
        <input
          id="industry"
          className="input"
          placeholder="e.g. Crochet fashion & accessories"
          value={value.industry}
          onChange={(e) => set("industry", e.target.value)}
        />
      </div>
      <TagInput
        label="Products or services"
        placeholder="Type one and press Enter"
        hint="What you sell or offer. Press Enter after each."
        value={value.products}
        onChange={(v) => set("products", v)}
      />
    </div>
  );
}

export function AudienceFields({ value, set }: Props) {
  const toggle = (p: (typeof PLATFORMS)[number]) =>
    set(
      "platforms",
      value.platforms.includes(p) ? value.platforms.filter((x) => x !== p) : [...value.platforms, p],
    );
  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="audience">
          Who is your audience?
        </label>
        <textarea
          id="audience"
          className="input min-h-[110px]"
          placeholder="e.g. Young, fashion-conscious women (18–30) who love handmade, slow fashion"
          value={value.audience}
          onChange={(e) => set("audience", e.target.value)}
          maxLength={500}
        />
      </div>
      <fieldset>
        <legend className="label">Where do you post?</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const on = value.platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p)}
                className={`rounded-full border px-4 py-2 text-[13px] font-medium transition ${
                  on
                    ? "border-plum bg-plum-soft text-plum"
                    : "border-line bg-white text-ink hover:border-stone"
                }`}
              >
                {PLATFORM_LABELS[p]}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

export function PersonalityFields({ value, set }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="personality">
          Brand personality
        </label>
        <input
          id="personality"
          className="input"
          placeholder="e.g. Artistic, quietly confident"
          value={value.personality}
          onChange={(e) => set("personality", e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="tone">
          Tone of voice
        </label>
        <input
          id="tone"
          className="input"
          placeholder="e.g. Warm, artistic, feminine"
          value={value.tone}
          onChange={(e) => set("tone", e.target.value)}
        />
      </div>
      <TagInput
        label="Goals"
        placeholder="e.g. Launch new product"
        hint="What content should achieve for you right now."
        value={value.goals}
        onChange={(v) => set("goals", v)}
        max={10}
      />
    </div>
  );
}

export function VisualFields({ value, set }: Props) {
  const colors = value.colors ?? {};
  const setColor = (key: "primary" | "accent", hex: string) =>
    set("colors", { ...colors, [key]: hex.toUpperCase() });
  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="visualStyle">
          Visual style
        </label>
        <input
          id="visualStyle"
          className="input"
          placeholder="e.g. Minimal, soft luxury, natural light"
          value={value.visualStyle}
          onChange={(e) => set("visualStyle", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(["primary", "accent"] as const).map((key) => (
          <div key={key}>
            <label className="label capitalize" htmlFor={`color-${key}`}>
              {key} colour
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
              <input
                id={`color-${key}`}
                type="color"
                className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                value={colors[key] ?? "#000000"}
                onChange={(e) => setColor(key, e.target.value)}
              />
              <span className="font-mono text-[13px] text-stone">{colors[key] ?? "—"}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone">
        Logo and brand assets come with the Asset Library in a later phase.
      </p>
    </div>
  );
}
