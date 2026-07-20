import prisma from "~/db.server";
import { FEATURES, FEATURE_BY_KEY, type FeatureKey } from "~/features/registry";
import { provisionStep } from "~/features/provision.server";

type AdminGraphql = Parameters<typeof provisionStep>[0]["graphql"];

const APP_TEARDOWN_ORDER: FeatureKey[] = [
  "variant_drop",
  "publish_sources",
  "trending_source",
  "featured_source",
];

// Start over from a step: clear that step AND every step after it, since the
// build path is linear. Prevents stale completions from an earlier run lingering
// when the attendee restarts. Best-effort disable for implemented app steps.
export async function retryStep(shop: string, key: FeatureKey, graphql?: AdminGraphql) {
  const startIndex = FEATURES.findIndex((f) => f.key === key);
  if (startIndex === -1) return;
  const keys = FEATURES.slice(startIndex).map((f) => f.key);

  // Tear down implemented app steps last-first so later steps unwind before
  // the ones they build on.
  for (const k of [...keys].reverse()) {
    if (graphql && FEATURE_BY_KEY[k].actor === "app") {
      try {
        await provisionStep({ shop, graphql, key: k, enabled: false });
      } catch {
        // Stub or partial impl — still clear local progress.
      }
    }
  }

  await prisma.shopFeature.updateMany({
    where: { shop, key: { in: keys } },
    data: { enabled: false, config: null },
  });

  // Restarting from Step 1 or Step 2 invalidates cached metafield-definition GIDs.
  if (keys.includes("featured_source") || keys.includes("seed_products")) {
    await prisma.managedResource.deleteMany({
      where: { shop, kind: "metafieldDefinition" },
    });
  }
}

// Clear all progress. Best-effort Shopify teardown for implemented app steps.
export async function resetWorkshopExperience(opts: {
  shop: string;
  graphql: AdminGraphql;
}): Promise<{ warnings: string[] }> {
  const { shop, graphql } = opts;
  const warnings: string[] = [];

  for (const key of APP_TEARDOWN_ORDER) {
    try {
      await provisionStep({ shop, graphql, key, enabled: false });
    } catch (e) {
      // Stubs throw until implemented — ignore those; surface real teardown errors.
      const msg = e instanceof Error ? e.message : "teardown failed";
      if (!msg.includes("not implemented yet")) {
        warnings.push(`${FEATURE_BY_KEY[key].title}: ${msg}`);
      }
    }
  }

  await prisma.shopFeature.deleteMany({ where: { shop } });
  await prisma.managedResource.deleteMany({ where: { shop } });

  return { warnings };
}
