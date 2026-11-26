"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState("demo@contentos.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) setError(error.message ?? "Sign-in failed");
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Link href="/" className="eyebrow">
        ← ContentOS
      </Link>
      <h1 className="mt-3 font-display text-4xl">Welcome back.</h1>

      {isPending ? null : session ? (
        <div className="card mt-8 space-y-4">
          <p>
            Signed in as <strong>{session.user.name}</strong> ({session.user.email}).
          </p>
          <button className="btn-ghost" onClick={() => void authClient.signOut()}>
            Sign out
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              type="email"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
            <p className="mt-1.5 text-xs text-stone">Seeded demo password: ombrafiore-demo</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                void authClient.signIn.social({ provider: "google", callbackURL: window.location.origin })
              }
            >
              Continue with Google
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
