import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";

// The repo uses a single root .env; load it for every Prisma CLI command.
loadDotenv({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
