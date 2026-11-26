import Link from "next/link";
import { apiGet, type Flags, type Health } from "@/lib/api";

export const dynamic = "force-dynamic";

const PIPELINE = [
  ["🟣", "Idea"],
  ["🟡", "Draft"],
  ["🔵", "In Progress"],
  ["🟠", "Review"],
  ["🟢", "Approved"],
  ["📅", "Scheduled"],
  ["✅", "Published"],
] as const;

const FLAG_LABELS: Record<keyof Flags, string> = {
  publisher: "Publisher",
  analytics: "Content Intelligence",
  imageGen: "AI Image Generation",
  billing: "Billing",
};

function Dot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-danger"}`} />;
}

export default async function Home() {
  const [health, flags] = await Promise.all([apiGet<Health>("/api/health"), apiGet<Flags>("/api/flags")]);

  return (
    <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-8">
      <header className="mb-8">
        <p className="eyebrow">ContentOS · Phase 1</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-[44px]">
          From scattered ideas to an organized content engine.
        </h1>
        <p className="mt-3 max-w-xl text-[17px] text-[#4c4744]">
          Teach ContentOS your brand once — every idea, caption and campaign builds on it.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/sign-up" className="btn-primary">
            Get started
          </Link>
          <Link href="/sign-in" className="btn-ghost">
            Sign in
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-[15px] uppercase tracking-[.08em] text-stone">System</h2>
          <ul className="space-y-2 text-[15px]">
            <li className="flex items-center gap-2">
              <Dot ok={!!health} /> API {health ? `v${health.version}` : "unreachable"}
            </li>
            <li className="flex items-center gap-2">
              <Dot ok={health?.checks.db === "ok"} /> Database {health?.checks.db ?? "unknown"}
            </li>
            <li className="flex items-center gap-2">
              <Dot ok={!!health} /> Storage driver: {health?.checks.storage ?? "unknown"}
            </li>
          </ul>
        </div>

        <div className="card">
          <h2 className="mb-3 text-[15px] uppercase tracking-[.08em] text-stone">Feature flags</h2>
          <ul className="space-y-2 text-[15px]">
            {(Object.keys(FLAG_LABELS) as (keyof Flags)[]).map((key) => (
              <li key={key} className="flex items-center justify-between">
                <span>{FLAG_LABELS[key]}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    flags?.[key] ? "bg-plum-soft text-plum" : "bg-cream text-stone"
                  }`}
                >
                  {flags ? (flags[key] ? "On" : "Off") : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card sm:col-span-2">
          <h2 className="mb-3 text-[15px] uppercase tracking-[.08em] text-stone">Pipeline statuses</h2>
          <div className="flex flex-wrap gap-2">
            {PIPELINE.map(([icon, label]) => (
              <span key={label} className="rounded-full border border-line bg-cream px-3 py-1 text-[13px]">
                {icon} {label}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
