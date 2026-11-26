"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, Spinner } from "@/components/AppShell";
import { api } from "@/lib/api-client";
import { PLATFORM_LABELS, type Brand } from "@/lib/types";

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ brands: Brand[] }>("/api/brands")
      .then(({ brands }) => {
        if (brands.length === 0) router.replace("/onboarding");
        else setBrands(brands);
      })
      .catch((err: Error) => setError(err.message));
  }, [router]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="mt-3 font-display text-4xl">Your brands</h1>
        </div>
        <Link href="/onboarding" className="btn-primary">
          + New brand
        </Link>
      </div>

      {error ? <p className="mt-8 text-danger">{error}</p> : null}
      {!brands && !error ? (
        <div className="mt-10">
          <Spinner label="Loading…" />
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {brands?.map((b) => {
          const colors = b.colors ?? {};
          return (
            <Link
              key={b.id}
              href={b.dnaVersion ? `/brands/${b.id}` : `/onboarding?brand=${b.id}`}
              className="card block transition hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <span className="flex -space-x-1.5">
                  {[colors.primary, colors.accent].filter(Boolean).map((c) => (
                    <span
                      key={c}
                      className="h-6 w-6 rounded-full border-2 border-white"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <h2 className="font-display text-2xl">{b.name}</h2>
              </div>
              <p className="mt-2 text-[14px] text-stone">{b.industry ?? "No industry set"}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
                {b.dnaVersion ? (
                  <span className="rounded-full bg-plum-soft px-2.5 py-0.5 font-semibold text-plum">
                    DNA v{b.dnaVersion}
                  </span>
                ) : (
                  <span className="rounded-full bg-[#FFF8EB] px-2.5 py-0.5 font-semibold text-[#8a5a00]">
                    Finish Brand DNA →
                  </span>
                )}
                {b.platforms.map((p) => (
                  <span key={p} className="rounded-full border border-line px-2.5 py-0.5 text-stone">
                    {PLATFORM_LABELS[p]}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
