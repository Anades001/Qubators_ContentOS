import { describe, expect, it } from "vitest";
import { EnvError, assertFeature, getFeatureFlags, parseServerEnv } from "../src";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/contentos",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

describe("parseServerEnv", () => {
  it("applies safe local defaults", () => {
    const env = parseServerEnv(base);
    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.AI_MODEL).toBe("mistral:7b-instruct");
    expect(env.FEATURE_PUBLISHER).toBe(false);
    expect(env.API_PORT).toBe(4000);
  });

  it("treats empty strings as unset", () => {
    const env = parseServerEnv({ ...base, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it("rejects a short auth secret", () => {
    expect(() => parseServerEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow(EnvError);
  });

  it("requires S3 credentials for non-local storage", () => {
    expect(() => parseServerEnv({ ...base, STORAGE_DRIVER: "minio" })).toThrow(/S3_ACCESS_KEY_ID/);
    expect(() =>
      parseServerEnv({
        ...base,
        STORAGE_DRIVER: "r2",
        S3_ACCESS_KEY_ID: "a",
        S3_SECRET_ACCESS_KEY: "b",
      }),
    ).toThrow(/R2_ACCOUNT_ID/);
  });

  it("requires Google OAuth credentials in pairs", () => {
    expect(() => parseServerEnv({ ...base, GOOGLE_CLIENT_ID: "id" })).toThrow(/GOOGLE_CLIENT_SECRET/);
  });
});

describe("feature flags", () => {
  it("are off by default and can be enabled", () => {
    const off = getFeatureFlags(parseServerEnv(base));
    expect(Object.values(off).every((v) => v === false)).toBe(true);
    expect(() => assertFeature(off, "publisher")).toThrow(/publisher/);

    const on = getFeatureFlags(parseServerEnv({ ...base, FEATURE_PUBLISHER: "true" }));
    expect(on.publisher).toBe(true);
    expect(() => assertFeature(on, "publisher")).not.toThrow();
  });
});
