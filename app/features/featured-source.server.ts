/**
 * Step 1 — Featured source (manual selection).
 * Implement from the coding prompt on the build path, then Mark as done.
 *
 * Start here — do not invent GraphQL from scratch:
 * - Helpers: `app/lib/collection-sources.server.ts`
 * - Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/collectionConditionsSourceCreate
 *
 * ManagedResource pattern (see also `ensureMetafieldDefinition` in
 * `app/lib/metafields.server.ts`):
 *
 *   await prisma.managedResource.upsert({
 *     where: { shop_kind_handle: { shop, kind: "collection", handle: "trending-on-social" } },
 *     create: { shop, kind: "collection", featureKey: "featured_source", handle: "trending-on-social", gid },
 *     update: { gid, featureKey: "featured_source" },
 *   });
 *
 * Use distinct `kind` values for what you store (e.g. "collection", "source") and a
 * stable `handle` per logical resource so enable/disable stays idempotent.
 */

type AdminGraphql = (q: string, o?: { variables?: Record<string, unknown> }) => Promise<Response>;

export async function enableFeaturedSource(_opts: {
  shop: string;
  graphql: AdminGraphql;
}): Promise<void> {
  throw new Error(
    "featured_source is not implemented yet — use the Step 1 coding prompt, then Mark as done.",
  );
}

export async function disableFeaturedSource(_opts: {
  shop: string;
  graphql: AdminGraphql;
}): Promise<void> {
  // No-op until Step 1 is implemented. `graphql` is passed so your teardown can
  // delete the Shopify collection/source, not just clear local progress.
}

export async function requireFeaturedCollection(_opts: {
  shop: string;
  graphql: AdminGraphql;
}): Promise<{ collectionGid: string; sourceGid: string }> {
  throw new Error(
    "featured_source is not implemented yet — finish Step 1 before later steps that need the collection.",
  );
}
