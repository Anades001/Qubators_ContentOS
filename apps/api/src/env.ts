import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { parseServerEnv } from "@contentos/config";

// Load the repo-root .env in local dev; in Docker the variables come from compose.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadDotenv({ path: path.join(repoRoot, ".env"), quiet: true });

const parsed = parseServerEnv();

export const env = {
  ...parsed,
  // Relative storage paths in .env are relative to the repo root, not the API's cwd.
  STORAGE_LOCAL_DIR: path.resolve(repoRoot, parsed.STORAGE_LOCAL_DIR),
};
