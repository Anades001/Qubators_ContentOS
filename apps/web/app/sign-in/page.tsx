"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Only follow same-site relative redirects. */
const safeNext = (next: string | null) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : "/brands";

function SignInForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (error) setError(error.message ?? "Sign-in failed");
    else router.push(next);
  }

  return (
    <form onSubmit={onSubmit} className="card mt-8 space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className={`input ${error ? "border-danger" : ""}`}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            void authClient.signIn.social({ provider: "google", callbackURL: window.location.origin + next })
          }
        >
          Continue with Google
        </button>
      </div>
      <p className="text-[13px] text-stone">
        New here?{" "}
        <Link className="font-medium text-plum" href="/sign-up">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default function SignInPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Link href="/" className="eyebrow">
        ← ContentOS
      </Link>
      <h1 className="mt-3 font-display text-4xl">Welcome back.</h1>
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
