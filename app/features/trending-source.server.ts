/**
 * Step 3 — Trending signal.
 * Implement from the coding prompt on the build path, then Mark as done.
 */

type AdminGraphql = (q: string, o?: { variables?: Record<string, unknown> }) => Promise<Response>;

export async function enableTrendingSource(_opts: {
  shop: string;
  graphql: AdminGraphql;
}): Promise<void> {
  throw new Error(
    "trending_source is not implemented yet — use the Step 3 coding prompt, then Mark as done.",
  );
}

export async function disableTrendingSource(_opts: {
  shop: string;
  graphql: AdminGraphql;
}): Promise<void> {
  // No-op until Step 3 is implemented.
}
