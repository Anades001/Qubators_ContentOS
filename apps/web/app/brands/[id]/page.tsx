"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell, Spinner } from "@/components/AppShell";
import { AudienceFields, BasicsFields, PersonalityFields, VisualFields } from "@/components/BrandFields";
import { DnaEditor, DnaSummary } from "@/components/DnaEditor";
import { api, cleanBrandInput } from "@/lib/api-client";
import {
  PLATFORM_LABELS,
  brandToInput,
  dnaToFields,
  emptyDna,
  type Brand,
  type BrandDna,
  type BrandInput,
  type DnaDraftResponse,
  type DnaFields,
  type GuardrailWarning,
} from "@/lib/types";

interface VersionRow {
  id: string;
  version: number;
  createdAt: string;
  sourceAiJobId: string | null;
}

type DnaMode =
  | { kind: "view" }
  | { kind: "edit"; draft: DnaFields; aiJobId: string | null; warnings: GuardrailWarning[] }
  | { kind: "generating" }
  | { kind: "history"; dna: BrandDna };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-3 last:border-0 sm:grid-cols-[160px_1fr]">
      <dt className="text-[13px] font-medium text-stone">{label}</dt>
      <dd className="text-[15px]">{value || <span className="text-stone">—</span>}</dd>
    </div>
  );
}

export default function BrandPage() {
  const { id } = useParams<{ id: string }>();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [dna, setDna] = useState<BrandDna | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [mode, setMode] = useState<DnaMode>({ kind: "view" });
  const [editingProfile, setEditingProfile] = useState<BrandInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ brand, dna }, { versions }] = await Promise.all([
      api<{ brand: Brand; dna: BrandDna | null }>(`/api/brands/${id}`),
      api<{ versions: VersionRow[] }>(`/api/brands/${id}/dna/versions`),
    ]);
    setBrand(brand);
    setDna(dna);
    setVersions(versions);
  }, [id]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const regenerate = () => {
    setMode({ kind: "generating" });
    setError(null);
    api<DnaDraftResponse>(`/api/brands/${id}/dna/generate`, { method: "POST" })
      .then((d) =>
        setMode({ kind: "edit", draft: d.resultJson, aiJobId: d.aiJobId, warnings: d.guardrailWarnings }),
      )
      .catch((err: Error) => {
        setError(err.message);
        setMode({ kind: "view" });
      });
  };

  const saveDna = (draft: DnaFields, aiJobId: string | null) =>
    run(async () => {
      const { dna: saved } = await api<{ dna: BrandDna }>(`/api/brands/${id}/dna`, {
        method: "POST",
        body: { ...draft, sourceAiJobId: aiJobId },
      });
      await load();
      setMode({ kind: "view" });
      flash(`Saved as version ${saved.version}`);
    });

  const viewVersion = (version: number) =>
    run(async () => {
      if (dna && version === dna.version) return setMode({ kind: "view" });
      const { dna: old } = await api<{ dna: BrandDna }>(`/api/brands/${id}/dna/versions/${version}`);
      setMode({ kind: "history", dna: old });
    });

  const restore = (version: number) =>
    run(async () => {
      const { dna: restored } = await api<{ dna: BrandDna }>(
        `/api/brands/${id}/dna/versions/${version}/restore`,
        {
          method: "POST",
        },
      );
      await load();
      setMode({ kind: "view" });
      flash(`Restored version ${version} as version ${restored.version}`);
    });

  const saveProfile = (input: BrandInput) =>
    run(async () => {
      const { brand: updated } = await api<{ brand: Brand }>(`/api/brands/${id}`, {
        method: "PATCH",
        body: cleanBrandInput({ ...input }),
      });
      setBrand(updated);
      setEditingProfile(null);
      flash("Profile updated — regenerate your DNA to reflect the changes");
    });

  if (!brand) {
    return (
      <AppShell wide>
        {error ? <p className="text-danger">{error}</p> : <Spinner label="Loading brand…" />}
      </AppShell>
    );
  }

  const setProfile = <K extends keyof BrandInput>(key: K, value: BrandInput[K]) =>
    setEditingProfile((p) => (p ? { ...p, [key]: value } : p));

  return (
    <AppShell wide>
      <Link href="/brands" className="eyebrow">
        ← All brands
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl">{brand.name}</h1>
        {dna ? (
          <span className="rounded-full bg-plum-soft px-3 py-1 text-[12px] font-semibold text-plum">
            DNA v{dna.version}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[15px] text-stone">{brand.industry}</p>

      {notice ? (
        <p role="status" className="mt-4 rounded-xl bg-[#ECFDF3] px-4 py-3 text-[14px] text-[#067647]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-xl bg-[#FDECEC] px-4 py-3 text-[14px] text-danger">{error}</p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <section className="card" aria-labelledby="dna-heading">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 id="dna-heading" className="text-[15px] uppercase tracking-[.08em] text-stone">
                {mode.kind === "history" ? `Brand DNA · version ${mode.dna.version}` : "Brand DNA"}
              </h2>
              {mode.kind === "view" ? (
                <div className="flex gap-2">
                  <button
                    className="btn-ghost !py-2"
                    onClick={() =>
                      setMode({
                        kind: "edit",
                        draft: dna ? dnaToFields(dna) : emptyDna(),
                        aiJobId: null,
                        warnings: [],
                      })
                    }
                  >
                    Edit
                  </button>
                  <button className="btn-accent !py-2" onClick={regenerate}>
                    ✨ Regenerate
                  </button>
                </div>
              ) : null}
            </div>

            {mode.kind === "view" ? (
              dna ? (
                <DnaSummary value={dnaToFields(dna)} />
              ) : (
                <div className="py-6 text-center">
                  <p className="text-stone">No Brand DNA yet.</p>
                  <Link href={`/onboarding?brand=${brand.id}`} className="btn-accent mt-4">
                    ✨ Draft it now
                  </Link>
                </div>
              )
            ) : null}

            {mode.kind === "generating" ? (
              <div className="py-10 text-center">
                <Spinner label="Drafting a fresh Brand DNA…" />
              </div>
            ) : null}

            {mode.kind === "edit" ? (
              <>
                {mode.aiJobId ? (
                  <p className="mb-4 rounded-xl bg-plum-soft px-4 py-3 text-[13px] text-plum">
                    AI draft — review and edit, then save to create a new version. Nothing changes until you
                    save.
                  </p>
                ) : null}
                <DnaEditor
                  value={mode.draft}
                  warnings={mode.warnings}
                  onChange={(draft) => setMode({ ...mode, draft })}
                />
                <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
                  <button className="btn-ghost" disabled={busy} onClick={() => setMode({ kind: "view" })}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    disabled={busy || !mode.draft.voice.length || !mode.draft.pillars.length}
                    onClick={() => saveDna(mode.draft, mode.aiJobId)}
                  >
                    {busy ? "Saving…" : "Save new version"}
                  </button>
                </div>
              </>
            ) : null}

            {mode.kind === "history" ? (
              <>
                <p className="mb-4 rounded-xl bg-cream px-4 py-3 text-[13px] text-stone">
                  Viewing an older version from {fmt(mode.dna.createdAt)}. Restoring copies it forward as a
                  new version.
                </p>
                <DnaSummary value={dnaToFields(mode.dna)} />
                <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
                  <button className="btn-ghost" onClick={() => setMode({ kind: "view" })}>
                    Back to current
                  </button>
                  <button className="btn-primary" disabled={busy} onClick={() => restore(mode.dna.version)}>
                    Restore version {mode.dna.version}
                  </button>
                </div>
              </>
            ) : null}
          </section>

          <section className="card" aria-labelledby="profile-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="profile-heading" className="text-[15px] uppercase tracking-[.08em] text-stone">
                Brand profile
              </h2>
              {!editingProfile ? (
                <button className="btn-ghost !py-2" onClick={() => setEditingProfile(brandToInput(brand))}>
                  Edit
                </button>
              ) : null}
            </div>
            {editingProfile ? (
              <form
                className="space-y-8"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveProfile(editingProfile);
                }}
              >
                <BasicsFields value={editingProfile} set={setProfile} />
                <AudienceFields value={editingProfile} set={setProfile} />
                <PersonalityFields value={editingProfile} set={setProfile} />
                <VisualFields value={editingProfile} set={setProfile} />
                <div className="flex justify-end gap-3 border-t border-line pt-5">
                  <button type="button" className="btn-ghost" onClick={() => setEditingProfile(null)}>
                    Cancel
                  </button>
                  <button className="btn-primary" disabled={busy || !editingProfile.name.trim()}>
                    {busy ? "Saving…" : "Save profile"}
                  </button>
                </div>
              </form>
            ) : (
              <dl>
                <ProfileRow label="Products" value={brand.products.join(", ")} />
                <ProfileRow label="Audience" value={brand.audience} />
                <ProfileRow
                  label="Platforms"
                  value={brand.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}
                />
                <ProfileRow label="Personality" value={brand.personality} />
                <ProfileRow label="Tone" value={brand.tone} />
                <ProfileRow label="Goals" value={brand.goals.join(" · ")} />
                <ProfileRow label="Visual style" value={brand.visualStyle} />
                <ProfileRow
                  label="Colours"
                  value={
                    brand.colors ? (
                      <span className="flex gap-3">
                        {(["primary", "accent"] as const)
                          .flatMap((k) => (brand.colors?.[k] ? [[k, brand.colors[k]] as const] : []))
                          .map(([k, c]) => (
                            <span key={k} className="inline-flex items-center gap-1.5 text-[13px]">
                              <span
                                className="h-4 w-4 rounded-full border border-line"
                                style={{ background: c }}
                              />
                              <span className="capitalize text-stone">{k}</span> {c}
                            </span>
                          ))}
                      </span>
                    ) : null
                  }
                />
              </dl>
            )}
          </section>
        </div>

        <aside className="card h-fit" aria-labelledby="history-heading">
          <h2 id="history-heading" className="mb-3 text-[15px] uppercase tracking-[.08em] text-stone">
            Version history
          </h2>
          {versions.length === 0 ? (
            <p className="text-[13px] text-stone">Versions appear here each time you save.</p>
          ) : (
            <ol className="space-y-1">
              {versions.map((v) => {
                const active =
                  (mode.kind === "history" && mode.dna.version === v.version) ||
                  (mode.kind !== "history" && dna?.version === v.version);
                return (
                  <li key={v.id}>
                    <button
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[14px] transition ${
                        active ? "bg-plum-soft text-plum" : "hover:bg-cream"
                      }`}
                      onClick={() => viewVersion(v.version)}
                    >
                      <span className="font-medium">
                        v{v.version}
                        {v.version === dna?.version ? (
                          <span className="ml-1.5 text-[11px] font-semibold uppercase">current</span>
                        ) : null}
                      </span>
                      <span className="text-[12px] text-stone">
                        {v.sourceAiJobId ? "✨ " : ""}
                        {fmt(v.createdAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-3 text-[11px] text-stone">✨ = started from an AI draft</p>
        </aside>
      </div>
    </AppShell>
  );
}
