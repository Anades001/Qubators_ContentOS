import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { ServerEnv } from "@contentos/config";
import type { PrismaClient } from "@contentos/db";

/** Google Calendar scope requested at sign-in so one OAuth grant covers app + GCal (PRD §1). */
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export function createAuth(env: ServerEnv, prisma: PrismaClient) {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            scope: [GOOGLE_CALENDAR_SCOPE],
            accessType: "offline" as const,
            prompt: "consent" as const,
          },
        }
      : {};

  return betterAuth({
    appName: "ContentOS",
    baseURL: env.API_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      // Email delivery is stubbed (EMAIL_DRIVER=log) until ZeptoMail is wired in Phase 6.
      requireEmailVerification: false,
    },
    socialProviders: google,
  });
}

export type Auth = ReturnType<typeof createAuth>;
