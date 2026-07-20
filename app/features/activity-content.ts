// Workshop activity copy — Mission / Blueprint / Build path / take-home.

export const ACTIVITY_TITLE = "Build Viral with Collection Sources API";

export const ACTIVITY_SUBTITLE =
  "You write a metafield value; Shopify applies it to reflect who belongs in the collection.";

export const MISSION_THESIS =
  "You write a metafield value; Shopify maintains who belongs in the collection. Viral never takes over the list — it contributes the pulse.";

export const MISSION = `Every few weeks, a merchant opens "Trending on social" and drags products in and out by hand. It works — until it doesn't. The leather bags and accessories that were hot last month are still on the shelf. The ones catching fire this week never got added. The collection just falls behind.

That is the problem you are here to solve.

You will build Viral — an app that turns a social signal into a feature. Here is the twist most people miss: Viral does not take over the collection. It does not push a product list. It writes a score. Shopify reads the score and maintains who belongs. The merchant keeps the collection — and the freedom to curate it. Viral contributes the pulse.

Seed the store in Step 1 of the build path. Keep the API docs in Blueprint handy. Then walk the rest of the build path top to bottom. Each step opens the next.`;

export const MISSION_TEASER =
  "The merchant's Trending collection goes stale. You build the signal that keeps it current.";

export const MISSION_PULL_QUOTE = "The collection falls behind — until you write the signal.";

export const OUTCOME = `When you're done, Viral contributes a shareable Collection Source attached to the merchant's "Trending on social" collection. Step 1 seeds the catalog. Step 2 starts simple: a source with five manual selections. Later steps swap that for a condition-based source based on a trending_score signal, then publish it as shareable and attach it so the merchant can add more sources on the collection without modifying Viral's source.`;

export const SUCCESS_CRITERIA = [
  "A Collection Source gets added to new and existing collections — Viral never replaces the collections.",
  "After moving to a condition-based source using the trending signal, membership follows viral.trending_score; the app writes the metafield, not a maintained product list.",
  "After your app's shareable source is attached to the collection, the merchant can add their own sources in Admin's to include additional products.",
  "Changing trending_score moves membership (and anything wired to that collection) without any additional work.",
];

export const BLUEPRINT_INTRO = 'What "done" looks like for Collection Sources.';

export const BLUEPRINT_TEASER =
  "Outcome, success criteria, and Collection Sources API docs.";

export const RANDOMIZE_STEP_TITLE = "Randomize trending scores";

export const RANDOMIZE_STEP_DESCRIPTION =
  "Give every product (and variant) a fresh random viral.trending_score — watch membership in every Collection Source condition shift live, no Admin editing required.";

export const API_DOCS_TITLE = "Collection Sources API";

export const API_DOCS_DESCRIPTION =
  "Admin GraphQL 2026-07 — create, update, and delete Collection Conditions Sources (collection-owned or app-owned shareable), attach them to collections, and query a collection's details.";

export const API_DOCS_LINKS = [
  {
    label: "Create source",
    url: "https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/collectionConditionsSourceCreate",
  },
  {
    label: "Update source",
    url: "https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/collectionConditionsSourceUpdate",
  },
  {
    label: "Delete source",
    url: "https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/collectionConditionsSourceDelete",
  },
  {
    label: "Get collection details",
    url: "https://shopify.dev/docs/api/admin-graphql/2026-07/queries/collection",
  },
] as const;

/** Primary docs entry for coding prompts (create is the usual starting point). */
export const API_DOCS_URL = API_DOCS_LINKS[0].url;

export const BUILD_PATH_INTRO =
  "Top to bottom. Step 1 seeds the catalog with one click. Other App steps: open the coding prompt, implement the stub, then Mark as done. Merchant steps: paste the Sidekick prompt in admin. Skip nothing — the order is the argument.";

export const BUILD_PATH_TEASER = "Ten steps — app builds and merchant checkpoints in sequence.";

export const GO_FURTHER_TITLE = "Go further";

export const GO_FURTHER_TEASER =
  "Take the metafield-score pattern home and point it at your own app's intelligence.";

export const GO_FURTHER_BODY = `Here is what you actually learned — stripped of the leather bags and accessories and the workshop props.

Viral does not maintain a list. It maintains a number on every product. Shopify reads the number. The collection follows. That is the entire architecture: signal once, membership forever after.

Your app already computes numbers like that. Margin at risk. Sell-through values. Reviews going vertical at midnight. Pick the one that matters in your domain. Write it to a metafield. Wire it to a source condition on a collection the merchant already owns.

You are not cloning Viral. You are stealing the shape — and pointing it at your own intelligence.`;

export const GO_FURTHER_PROMPT_HELPER =
  "Paste this into your coding agent (Cursor, Copilot, etc.) to take the pattern home — start from a signal your app already computes.";

export const GO_FURTHER_PROMPT = `You're a Shopify app developer reusing Viral's pattern in your own app.

Context:
Viral writes a metafield score; Shopify recomputes collection membership from a Collection Source condition. You want the same shape pointed at a signal your app already computes (not necessarily trending).
API: Shopify Admin GraphQL 2026-07 only.
Docs: https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/collectionConditionsSourceCreate

Instructions:
1. Start from a signal your app already computes (margin at risk, sell-through, review velocity — whatever matters in your domain).
2. Pick a suitable conditions for it (metafields, tag or something else), show the write path, and wire a source condition on a collection.

Output:
State your signal, then: metafield def, write path, source condition, short compose-with-merchant note.`;
