// Tracks that a step was completed via the prompt path (Mark as done).
// Stored in ShopFeature.config as a small JSON blob.
import prisma from "~/db.server";
import { FEATURES, type FeatureKey } from "./registry";

export type StepRoute = "prompt";
export type RouteState = Partial<Record<FeatureKey, StepRoute>>;

export async function getRoutes(shop: string): Promise<RouteState> {
  const rows = await prisma.shopFeature.findMany({ where: { shop } });
  const state: RouteState = {};
  for (const row of rows) {
    if (!row.key || !FEATURES.some((f) => f.key === row.key)) continue;
    if (!row.config) continue;
    try {
      const parsed = JSON.parse(row.config);
      if (parsed && parsed.route === "prompt") {
        state[row.key as FeatureKey] = "prompt";
      }
    } catch {
      // Skip rows with malformed config JSON.
    }
  }
  return state;
}

export async function setStepCompletion(
  shop: string,
  key: FeatureKey,
  opts: { enabled: boolean; route: StepRoute | null },
) {
  const config = opts.route ? JSON.stringify({ route: opts.route }) : null;
  return prisma.shopFeature.upsert({
    where: { shop_key: { shop, key } },
    update: { enabled: opts.enabled, config },
    create: { shop, key, enabled: opts.enabled, config },
  });
}
