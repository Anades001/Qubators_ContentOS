import type { ServerEnv } from "./env";

/** Features that exist in the plan but are gated off in the MVP (PRD.md §5). */
export const FEATURE_FLAGS = ["publisher", "analytics", "imageGen", "billing"] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];
export type FeatureFlags = Record<FeatureFlag, boolean>;

export function getFeatureFlags(
  env: Pick<ServerEnv, "FEATURE_PUBLISHER" | "FEATURE_ANALYTICS" | "FEATURE_IMAGE_GEN" | "FEATURE_BILLING">,
): FeatureFlags {
  return {
    publisher: env.FEATURE_PUBLISHER,
    analytics: env.FEATURE_ANALYTICS,
    imageGen: env.FEATURE_IMAGE_GEN,
    billing: env.FEATURE_BILLING,
  };
}

export class FeatureDisabledError extends Error {
  readonly status = 404;
  constructor(public readonly flag: FeatureFlag) {
    super(`Feature "${flag}" is not enabled`);
    this.name = "FeatureDisabledError";
  }
}

export function assertFeature(flags: FeatureFlags, flag: FeatureFlag): void {
  if (!flags[flag]) throw new FeatureDisabledError(flag);
}
