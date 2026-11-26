"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AppShell, Spinner } from "@/components/AppShell";
import { AudienceFields, BasicsFields, PersonalityFields, VisualFields } from "@/components/BrandFields";
import { DnaEditor } from "@/components/DnaEditor";
import { api, cleanBrandInput } from "@/lib/api-client";
import {
  emptyBrandInput,
  emptyDna,
  type Brand,
  type BrandInput,
  type DnaDraftResponse,
  type DnaFields,
  type GuardrailWarning,
} from "@/lib/types";

const STEPS = [
  { title: "Tell us about your brand", subtitle: "The basics every piece of content builds on." },
  { title: "Who are you talking to?", subtitle: "Ideas are shaped around your audience and platforms." },
  { title: "How does your brand sound?", subtitle: "Personality, tone and what you're working towards." },
  { title: "How does it look?", subtitle: "Visual direction for image prompts and designs." },
  {
    title: "Your Brand DNA",
    subtitle: "Drafted by AI from your answers. Edit anything — you're in control.",
  },
] as const;

function Progress({ step }: { step: number }) {
  return (
    <ol className="mb-8 flex gap-2" aria-label="Onboarding progress">
      {STEPS.map((s, i) => (
        <li
          key={s.title}
          aria-current={i === step ? "step" : undefined}
          className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-plum" : "bg-line"}`}
        >
          <span className="sr-only">
            Step {i + 1}: {s.title}
          </span>
        </li>
      ))}
    </ol>
  );
}

type DnaState =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "draft"; aiJobId: string | null; warnings: GuardrailWarning[] }
  | { kind: "error"; message: string };

function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const brandIdParam = params.get("brand");

  const [step, setStep] = useState(brandIdParam ? 4 : 0);
  const [brand, setBrand] = useState<BrandInput>(emptyBrandInput);
  const [brandId, setBrandId] = useState<string | null>(brandIdParam);
  const [brandName, setBrandName] = useState("");
  const [dna, setDna] = useState<DnaFields>(emptyDna);
  const [dnaState, setDnaState] = useState<DnaState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generatedFor = useRef<string | null>(null);

  const set = <K extends keyof BrandInput>(key: K, value: BrandInput[K]) =>
    setBrand((b) => ({ ...b, [key]: value }));

  const generate = useCallback(async (id: string) => {
    setDnaState({ kind: "generating" });
    try {
      const draft = await api<DnaDraftResponse>(`/api/brands/${id}/dna/generate`, { method: "POST" });
      setDna(draft.resultJson);
      setDnaState({ kind: "draft", aiJobId: draft.aiJobId, warnings: draft.guardrailWarnings });
    } catch (err) {
      setDnaState({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  }, []);

  // Entering the DNA step (fresh or after a refresh) drafts once automatically.
  useEffect(() => {
    if (step !== 4 || !brandId || generatedFor.current === brandId) return;
    generatedFor.current = brandId;
    void api<{ brand: Brand }>(`/api/brands/${brandId}`)
      .then(({ brand }) => setBrandName(brand.name))
      .catch(() => router.replace("/onboarding"));
    void generate(brandId);
  }, [step, brandId, generate, router]);

  async function createBrand() {
    setBusy(true);
    setError(null);
    try {
      const { brand: created } = await api<{ brand: Brand }>("/api/brands", {
        method: "POST",
        body: cleanBrandInput({ ...brand }),
      });
      setBrandId(created.id);
      setBrandName(created.name);
      router.replace(`/onboarding?brand=${created.id}`);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create brand");
    } finally {
      setBusy(false);
    }
  }

  async function saveDna() {
    if (!brandId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/brands/${brandId}/dna`, {
        method: "POST",
        body: { ...dna, sourceAiJobId: dnaState.kind === "draft" ? dnaState.aiJobId : null },
      });
      router.push(`/brands/${brandId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setBusy(false);
    }
  }

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (step === 0 && !brand.name.trim()) return setError("Brand name is required");
    setError(null);
    if (step === 3) void createBrand();
    else setStep((s) => s + 1);
  }

  const { title, subtitle } = STEPS[step]!;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">
          Step {step + 1} of {STEPS.length}
          {brandName ? ` · ${brandName}` : ""}
        </p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl">{title}</h1>
        <p className="mt-2 text-[15px] text-stone">{subtitle}</p>
        <div className="mt-6">
          <Progress step={step} />
        </div>

        {step < 4 ? (
          <form onSubmit={next} className="card space-y-6">
            {step === 0 && <BasicsFields value={brand} set={set} />}
            {step === 1 && <AudienceFields value={brand} set={set} />}
            {step === 2 && <PersonalityFields value={brand} set={set} />}
            {step === 3 && <VisualFields value={brand} set={set} />}
            {error ? <p className="text-[13px] text-danger">{error}</p> : null}
            <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-5">
              <button
                type="button"
                className="btn-ghost"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </button>
              <button className={step === 3 ? "btn-accent" : "btn-primary"} disabled={busy}>
                {step === 3 ? (busy ? "Creating…" : "✨ Draft my Brand DNA") : "Continue"}
              </button>
            </div>
          </form>
        ) : (
          <div className="card space-y-6">
            {dnaState.kind === "generating" || dnaState.kind === "idle" ? (
              <div className="py-10 text-center">
                <Spinner label="Reading your answers and drafting your Brand DNA…" />
                <p className="mt-3 text-xs text-stone">On a local model this can take up to a minute.</p>
              </div>
            ) : null}

            {dnaState.kind === "error" ? (
              <div className="space-y-4 py-4">
                <p className="text-[15px] text-danger">{dnaState.message}</p>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-accent" onClick={() => brandId && void generate(brandId)}>
                    Try again
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setDnaState({ kind: "draft", aiJobId: null, warnings: [] })}
                  >
                    Fill it in myself
                  </button>
                </div>
              </div>
            ) : null}

            {dnaState.kind === "draft" ? (
              <>
                <DnaEditor value={dna} onChange={setDna} warnings={dnaState.warnings} />
                {error ? <p className="text-[13px] text-danger">{error}</p> : null}
                <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-5">
                  <button
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => brandId && void generate(brandId)}
                  >
                    ↻ Regenerate
                  </button>
                  <button
                    className="btn-primary"
                    disabled={busy || !dna.voice.length || !dna.pillars.length}
                    onClick={saveDna}
                  >
                    {busy ? "Saving…" : "Save Brand DNA"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}
