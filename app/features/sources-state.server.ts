/**
 * Step 5 — Publish sources for co-creation.
 * Implement from the coding prompt on the build path, then Mark as done.
 */

import type { FeatureKey } from "~/features/registry";

type AdminGraphql = (q: string, o?: { variables?: Record<string, unknown> }) => Promise<Response>;

export async function applySourceToggle(_opts: {
  shop: string;
  graphql: AdminGraphql;
  key: FeatureKey;
  enabled: boolean;
}): Promise<void> {
  throw new Error(
    "publish_sources is not implemented yet — use the Step 5 coding prompt, then Mark as done.",
  );
}
