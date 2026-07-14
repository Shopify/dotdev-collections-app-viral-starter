// Workshop activity copy — Mission / Blueprint / Parts / take-home.

export const ACTIVITY_TITLE = "Build Viral with Collection Sources API";

export const ACTIVITY_SUBTITLE =
  "You write a metafield score; Shopify decides who belongs in the collection.";

export const MISSION_THESIS =
  "You write a metafield score; Shopify decides who belongs in the collection. Viral never takes over the list — it contributes the pulse.";

export const MISSION = `Every few weeks, a merchant opens "Trending on social" and drags products in and out by hand. It works — until it doesn't. The leather bags and accessories that were hot last month are still on the shelf. The ones catching fire this week never make the cut. The collection doesn't lie. It just falls behind.

That is the problem you are here to solve.

You will build Viral — an app that turns a social signal into a feature. Here is the twist most people miss: Viral does not take over the collection. It does not push a product list. It writes a score. Shopify reads the score and maintains who belongs. The merchant keeps the collection — and the freedom to curate it. Viral contributes the pulse.

Seed the store under Parts. Keep the API docs handy. Then walk the build path top to bottom. Each step opens the next.`;

export const MISSION_TEASER =
  "The merchant's Trending collection goes stale. You build the signal that keeps it live.";

export const MISSION_PULL_QUOTE = "The collection falls behind — until you write the signal.";

export const OUTCOME = `When you're done, Viral owns an app Collection Source on the merchant's "Trending on social" collection — not the collection itself. Step 1 is the easy start: five manual selections, not shareable. Later steps turn that source into a live trending_score signal and publish it so the merchant can add their own rules beside it. Two authors, one collection.`;

export const SUCCESS_CRITERIA = [
  "An app-owned Collection Source sits on the merchant's collection — Viral never replaces the collection.",
  "After the trending signal step, membership follows viral.trending_score; the app writes the metafield, not a maintained product list.",
  "Once published as shareable, the merchant can compose their own rule beside Viral's source in the collection editor.",
  "Changing trending_score moves membership (and anything wired to that collection) without a second curation pass.",
];

export const BLUEPRINT_INTRO =
  'What "done" looks like for Collection Sources — not a primer on smart collections.';

export const BLUEPRINT_TEASER =
  "Finished-system checks: app-owned source, signal, merchant co-creation.";

export const PARTS_INTRO =
  "Line these up before (and during) the build path: sample products and the Collection Sources API docs.";

export const PARTS_TEASER = "Seed products and Collection Sources API docs.";

export const CATALOG_PART_TITLE = "Seed products";

export const CATALOG_PART_DESCRIPTION =
  "Leather bags and accessories for the merchant's store — run this once so the build path has merchandise to work with.";

export const API_DOCS_TITLE = "Collection Sources API";

export const API_DOCS_DESCRIPTION =
  "Admin GraphQL 2026-07 — create, update, and delete app-owned Collection Conditions Sources (then attach them to collections), and query a collection's details. Open these from the app while you work; you do not need to hunt the repo for docs.";

export const API_DOCS_LINKS = [
  {
    label: "Create source",
    url: "https://shopify.dev/docs/api/admin-graphql/latest/mutations/collectionConditionsSourceCreate",
  },
  {
    label: "Update source",
    url: "https://shopify.dev/docs/api/admin-graphql/latest/mutations/collectionConditionsSourceUpdate",
  },
  {
    label: "Delete source",
    url: "https://shopify.dev/docs/api/admin-graphql/latest/mutations/collectionConditionsSourceDelete",
  },
  {
    label: "Get collection details",
    url: "https://shopify.dev/docs/api/admin-graphql/latest/queries/collection",
  },
] as const;

/** Primary docs entry for coding prompts (create is the usual starting point). */
export const API_DOCS_URL = API_DOCS_LINKS[0].url;

export const BUILD_PATH_INTRO =
  "Top to bottom. App steps: open the coding prompt, implement the stub, then Mark as done. Merchant steps: paste the Sidekick prompt in admin. Skip nothing — the order is the argument.";

export const BUILD_PATH_TEASER = "Nine steps — app builds and merchant checkpoints in sequence.";

export const GO_FURTHER_TITLE = "Go further";

export const GO_FURTHER_TEASER =
  "Take the metafield-score pattern home and point it at your own app's intelligence.";

export const GO_FURTHER_BODY = `Here is what you actually learned — stripped of the leather bags and accessories and the workshop props.

Viral does not maintain a list. It maintains a number on every product. Shopify reads the number. The collection follows. That is the entire architecture: signal once, membership forever after.

Your app already computes numbers like that. Margin at risk. Sell-through spiking. Reviews going vertical at midnight. Pick the one that matters in your domain. Write it to a metafield. Wire it to a source condition on a collection the merchant already owns.

You are not cloning Viral. You are stealing the shape — and pointing it at your own intelligence.`;

export const GO_FURTHER_PROMPT_HELPER =
  "Paste this into your coding agent (Cursor, Copilot, etc.) to take the pattern home — start from a signal your app already computes.";

export const GO_FURTHER_PROMPT = `You're a Shopify app developer reusing Viral's pattern in your own app.

<context>
Viral writes a metafield score; Shopify recomputes collection membership from a Collection Source condition. The merchant keeps the collection and their rules.
You want the same shape pointed at a signal your app already computes (not necessarily trending).
API: Shopify Admin GraphQL 2026-07 only.
Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/collectionConditionsSourceCreate
</context>

<instructions>
1. Start from a signal your app already computes (margin at risk, sell-through, review velocity — whatever matters in your domain).
2. Pick a product or variant metafield score for it, show the write path, and wire a source condition on a merchant-owned collection.
</instructions>

<constraints>
- Public Admin GraphQL 2026-07 only; no collection add/remove for membership.
- Do not clone trending_score unless that is your signal.
- Keep it to one schema proposal — not a laundry list.
</constraints>

<output_format>
State your signal, then: metafield def, write path, source condition, short compose-with-merchant note.
</output_format>`;
