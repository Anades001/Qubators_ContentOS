"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-cream/90 backdrop-blur">
        <div
          className={`mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-8 ${wide ? "max-w-6xl" : "max-w-[960px]"}`}
        >
          <Link href="/brands" className="font-display text-xl font-semibold">
            ContentOS
          </Link>
          <div className="flex items-center gap-3 text-[13px]">
            {session ? <span className="hidden text-stone sm:inline">{session.user.email}</span> : null}
            <button
              className="rounded-full px-3 py-1.5 font-medium hover:bg-white"
              onClick={async () => {
                await authClient.signOut();
                router.push("/sign-in");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-8 sm:px-8 sm:py-10 ${wide ? "max-w-6xl" : "max-w-[960px]"}`}>
        {children}
      </main>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-stone" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-plum-soft border-t-plum" />
      {label}
    </span>
  );
}
