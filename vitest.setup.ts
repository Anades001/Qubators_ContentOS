import path from "node:path";
import { config as loadDotenv } from "dotenv";

// Integration tests use DATABASE_URL from the environment (CI) or the root .env (local).
loadDotenv({ path: path.resolve(import.meta.dirname, ".env"), quiet: true });
