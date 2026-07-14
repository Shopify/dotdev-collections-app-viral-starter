import prisma from "~/db.server";
import { FEATURES, type FeatureKey } from "./registry";

export type FlagState = Record<FeatureKey, boolean>;

export async function getFlags(shop: string): Promise<FlagState> {
  const rows = await prisma.shopFeature.findMany({ where: { shop } });
  const state = Object.fromEntries(FEATURES.map((f) => [f.key, false])) as FlagState;
  for (const row of rows) {
    if (row.key in state) state[row.key as FeatureKey] = row.enabled;
  }
  return state;
}

export async function setFlag(shop: string, key: FeatureKey, enabled: boolean) {
  return prisma.shopFeature.upsert({
    where: { shop_key: { shop, key } },
    update: { enabled },
    create: { shop, key, enabled },
  });
}
