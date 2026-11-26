import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { StorageAdapter, StorageDriverName } from "./types";

export interface StorageConfig {
  STORAGE_DRIVER: StorageDriverName;
  STORAGE_LOCAL_DIR: string;
  S3_BUCKET: string;
  S3_ENDPOINT?: string | undefined;
  S3_REGION: string;
  S3_ACCESS_KEY_ID?: string | undefined;
  S3_SECRET_ACCESS_KEY?: string | undefined;
  R2_ACCOUNT_ID?: string | undefined;
  API_URL: string;
  BETTER_AUTH_SECRET: string;
}

/** Picks the adapter from STORAGE_DRIVER. Callers never import a concrete driver. */
export function createStorage(cfg: StorageConfig): StorageAdapter {
  if (cfg.STORAGE_DRIVER === "local") {
    return new LocalStorage({
      rootDir: cfg.STORAGE_LOCAL_DIR,
      bucket: cfg.S3_BUCKET,
      publicBaseUrl: cfg.API_URL,
      signingSecret: cfg.BETTER_AUTH_SECRET,
    });
  }
  const endpoint =
    cfg.S3_ENDPOINT ??
    (cfg.R2_ACCOUNT_ID ? `https://${cfg.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
  if (!endpoint || !cfg.S3_ACCESS_KEY_ID || !cfg.S3_SECRET_ACCESS_KEY) {
    throw new Error(`STORAGE_DRIVER=${cfg.STORAGE_DRIVER} needs an endpoint and S3 credentials`);
  }
  return new S3Storage({
    driver: cfg.STORAGE_DRIVER,
    bucket: cfg.S3_BUCKET,
    endpoint,
    region: cfg.S3_REGION,
    accessKeyId: cfg.S3_ACCESS_KEY_ID,
    secretAccessKey: cfg.S3_SECRET_ACCESS_KEY,
  });
}
