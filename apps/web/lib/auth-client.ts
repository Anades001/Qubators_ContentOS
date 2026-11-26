"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin: /api/auth/* is proxied to the API by next.config rewrites (dev) or Caddy (prod).
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? "http://localhost:3000" : window.location.origin,
  basePath: "/api/auth",
});
