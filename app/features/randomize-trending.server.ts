// "Randomize trending scores" — used on the final Review step so the merchant
// can see every Collection Source's membership shift live, without touching Admin.
// Writes a fresh random viral.trending_score to every product AND every variant
// (PRODUCT-level backs Trending/Publish; PRODUCTVARIANT-level backs Red Drop),
// then Shopify recomputes membership itself.
import {
  ensureMetafieldDefinition,
  setMetafieldValues,
  TRENDING,
  TRENDING_VARIANT,
} from "~/lib/metafields.server";

type AdminGraphql = (q: string, o?: { variables?: Record<string, unknown> }) => Promise<Response>;

const PRODUCTS_WITH_VARIANTS = `#graphql
  query ProductsWithVariantsForRandomize {
    products(first: 100) {
      nodes {
        id
        variants(first: 10) { nodes { id } }
      }
    }
  }
`;

// Every app-owned source's condition is `trending_score GREATER_THAN 0` — straddle
// zero so each click visibly moves some products in and out, not just reshuffles
// scores that all still clear the bar.
function randomScore(): string {
  return String(Math.floor(Math.random() * 200) - 50); // -50..149
}

export async function randomizeTrendingScores(opts: {
  shop: string;
  graphql: AdminGraphql;
}): Promise<{ productCount: number; variantCount: number }> {
  const { shop, graphql } = opts;

  await Promise.all([
    ensureMetafieldDefinition({ shop, graphql, def: TRENDING, featureKey: "trending_source" }),
    ensureMetafieldDefinition({ shop, graphql, def: TRENDING_VARIANT, featureKey: "variant_drop" }),
  ]);

  const res = await graphql(PRODUCTS_WITH_VARIANTS);
  const json = (await res.json()) as {
    data?: { products?: { nodes: { id: string; variants: { nodes: { id: string }[] } }[] } };
  };
  const nodes = json.data?.products?.nodes ?? [];
  if (!nodes.length) {
    throw new Error("No products found. Complete Step 1 (Seed sample products) first.");
  }

  const productValues = nodes.map((p) => ({ ownerId: p.id, value: randomScore() }));
  const variantValues = nodes.flatMap((p) =>
    p.variants.nodes.map((v) => ({ ownerId: v.id, value: randomScore() })),
  );

  await setMetafieldValues({ graphql, def: TRENDING, values: productValues });
  if (variantValues.length) {
    await setMetafieldValues({ graphql, def: TRENDING_VARIANT, values: variantValues });
  }

  return { productCount: productValues.length, variantCount: variantValues.length };
}
