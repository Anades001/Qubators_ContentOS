"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signUp.email({ name, email, password });
    setBusy(false);
    if (error) setError(error.message ?? "Could not create account");
    else router.push("/onboarding");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Link href="/" className="eyebrow">
        ← ContentOS
      </Link>
      <h1 className="mt-3 font-display text-4xl">Create your workspace.</h1>
      <p className="mt-2 text-[15px] text-stone">
        Next, we&apos;ll learn your brand so every idea sounds like you.
      </p>
      <form onSubmit={onSubmit} className="card mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            className="input"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="mt-1.5 text-xs text-stone">At least 8 characters.</p>
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </div>
        <button className="btn-primary" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-[13px] text-stone">
          Already have an account?{" "}
          <Link className="font-medium text-plum" href="/sign-in">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
