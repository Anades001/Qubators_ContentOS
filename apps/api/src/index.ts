import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { OllamaClient, createMockLlm } from "@contentos/ai";
import { getFeatureFlags } from "@contentos/config";
import { prisma } from "@contentos/db";
import { createStorage } from "@contentos/storage";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { env } from "./env";

const auth = createAuth(env, prisma);
const storage = createStorage(env);

const llm = env.AI_DRIVER === "mock" ? createMockLlm() : new OllamaClient(env.OLLAMA_HOST, env.AI_MODEL);

const app = createApp({
  flags: getFeatureFlags(env),
  storage,
  signingSecret: env.BETTER_AUTH_SECRET,
  appUrl: env.APP_URL,
  authHandler: toNodeHandler(auth),
  getSessionUser: async (req) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    return session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null;
  },
  userOwnsBrand: async (userId, brandId) =>
    (await prisma.brand.count({ where: { id: brandId, ownerId: userId } })) > 0,
  brands: { db: prisma, llm },
  pingDb: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
  version: process.env.npm_package_version,
});

const server = app.listen(env.API_PORT, () => {
  console.log(
    `ContentOS API listening on :${env.API_PORT} (storage=${storage.driver}, ai=${llm.driver}:${llm.model})`,
  );
});

const shutdown = () => {
  server.close(() => void prisma.$disconnect().then(() => process.exit(0)));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
