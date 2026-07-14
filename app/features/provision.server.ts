// Dispatches enable/disable for app-built steps. Each step module starts as a
// stub — implement it from the coding prompt, then Mark as done in the UI.
// This file does not auto-provision anything; Mark as done only flips progress.

import { FEATURE_BY_KEY, type FeatureKey } from "~/features/registry";
import { enableFeaturedSource, disableFeaturedSource } from "~/features/featured-source.server";
import { enableTrendingSource, disableTrendingSource } from "~/features/trending-source.server";
import { applySourceToggle } from "~/features/sources-state.server";
import { enableVariantDrop, disableVariantDrop } from "~/features/variant-drop.server";

type AdminGraphql = Parameters<typeof enableFeaturedSource>[0]["graphql"];

export async function provisionStep(params: {
  shop: string;
  graphql: AdminGraphql;
  key: FeatureKey;
  enabled: boolean;
}) {
  const { shop, graphql, key, enabled } = params;
  if (FEATURE_BY_KEY[key].actor === "merchant") return;

  if (key === "featured_source") {
    if (enabled) await enableFeaturedSource({ shop, graphql });
    else await disableFeaturedSource({ shop, graphql });
  } else if (key === "trending_source") {
    if (enabled) await enableTrendingSource({ shop, graphql });
    else await disableTrendingSource({ shop, graphql });
  } else if (key === "publish_sources") {
    await applySourceToggle({ shop, graphql, key, enabled });
  } else if (key === "variant_drop") {
    if (enabled) await enableVariantDrop({ shop, graphql });
    else await disableVariantDrop({ shop, graphql });
  }
}
