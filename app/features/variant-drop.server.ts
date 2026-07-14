/**
 * Step 6 — Variant drop (Red Drop).
 * Implement from the coding prompt on the build path, then Mark as done.
 */

type AdminGraphql = (q: string, o?: { variables?: Record<string, unknown> }) => Promise<Response>;

export async function enableVariantDrop(_opts: {
  shop: string;
  graphql: AdminGraphql;
}): Promise<void> {
  throw new Error(
    "variant_drop is not implemented yet — use the Step 6 coding prompt, then Mark as done.",
  );
}

export async function disableVariantDrop(_opts: {
  shop: string;
  graphql: AdminGraphql;
}): Promise<void> {
  // No-op until Step 6 is implemented. `graphql` is passed so your teardown can
  // delete the Shopify source, not just clear local progress.
}
