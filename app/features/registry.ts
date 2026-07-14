// The workshop arc as a list of steps. Each App step has a coding prompt;
// each Merchant step has a Sidekick prompt. Mark as done only tracks progress —
// you implement the Shopify-side work from the prompt (stubs in *.server.ts).
// Steps build on each other: write the signal, let Shopify handle membership,
// the merchant co-creates.
//
// Coding / Sidekick prompts: clear role, XML sections, high-signal context only
// (Anthropic prompt + context engineering). Public Admin API only.

export type FeatureKey =
  | "featured_source" // Step 1 — v1: app-owned source with 5 manual products
  | "trending_source" // Step 2 — same source, membership driven by a trending-score signal
  | "confirm_trending_collection" // Step 3 — Merchant checkpoint: confirm the target collection
  | "publish_sources" // Step 4 — make sources app-owned + shareable (co-creation in admin)
  | "add_merchant_rule" // Step 5 — Merchant checkpoint: compose an own rule alongside the source
  | "variant_drop" // Step 6 — variant-scoped "Red Drop": app shareable source, variant title + trending score
  | "loyalty_discount" // Step 7 — Merchant checkpoint: create an automatic discount targeting the trending collection
  | "shipping_profile" // Step 8 — Merchant checkpoint: reuse the trending signal on the "expedited" collection (shipping profile)
  | "confirm_live_results"; // Step 9 — Merchant checkpoint: review what's updating on its own

interface FeatureDefBase {
  key: FeatureKey;
  step: number;
  title: string;
  summary: string;
  // Keys that should be on before this one is useful. Surfaced as guidance in the UI.
  dependsOn: FeatureKey[];
  // Optional follow-up that happens outside the app (e.g. a CLI deploy). Rendered
  // as an info note on the step's card.
  note?: string;
}

// A step the attendee builds in the app from `aiPrompt`, then marks done.
export interface AppFeatureDef extends FeatureDefBase {
  actor: "app";
  // Prompt for a coding agent (Cursor, Copilot, etc.) to implement this step.
  aiPrompt: string;
}

// A checkpoint the merchant performs in Shopify admin — guided via Sidekick.
export interface MerchantFeatureDef extends FeatureDefBase {
  actor: "merchant";
  // Prompt to paste into Sidekick so the attendee acts as the merchant in admin.
  sidekickPrompt: string;
}

export type FeatureDef = AppFeatureDef | MerchantFeatureDef;

const API = "Shopify Admin GraphQL API 2026-07";
const DOCS =
  "https://shopify.dev/docs/api/admin-graphql/latest/mutations/collectionConditionsSourceCreate";

/** Shared shell for App coding prompts — role, common constraints, verify-first output. */
function appPrompt(opts: {
  context: string;
  instructions: string;
  constraints?: string;
  verify: string;
}): string {
  const extra = opts.constraints?.trim()
    ? `\n${opts.constraints
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => (l.startsWith("-") ? l : `- ${l}`))
        .join("\n")}`
    : "";
  return `You're a Shopify app developer shipping public Admin API patterns in the Viral workshop repo (Remix + Polaris).

<context>
${opts.context.trim()}
API: ${API} only. Docs: ${DOCS} (also SourceUpdate / SourceDelete).
</context>

<instructions>
${opts.instructions.trim()}
Implement the stub in the matching \`app/features/*.server.ts\` file. Dispatch is already wired in \`provision.server.ts\` — fill in enable/disable, do not dump GraphQL in chat. Prefer helpers in \`app/lib/collection-sources.server.ts\` and \`app/lib/metafields.server.ts\` (they surface Shopify \`userErrors\` clearly).
</instructions>

<constraints>
- Public ${API} only.
- Never use collection add/remove product APIs for membership.
- No new settings UI. Keep Collection Sources GraphQL in \`app/lib/collection-sources.server.ts\`.
- Idempotent via \`ManagedResource\`.${extra}
</constraints>

<output_format>
1. Files changed
2. Verify: ${opts.verify}
3. GraphQL only if the input shape is non-obvious — deliverable is working code
</output_format>`;
}

export const FEATURES: FeatureDef[] = [
  {
    key: "featured_source",
    step: 1,
    actor: "app",
    title: "Featured source (manual selection)",
    summary:
      "Easiest start: an app-owned Collection Source with five explicit product selections. Not shareable yet — the merchant can't compose beside it until a later step.",
    dependsOn: [],
    aiPrompt: appPrompt({
      context: `Step 1: create "Trending on social" with a collection-owned source of five product \`inclusion.selections\` (static list, not shareable).
Hooks: implement \`featured-source.server.ts\`; reuse helpers in \`collection-sources.server.ts\`. \`provision.server.ts\` already calls enable/disable.
Shape: nest \`{ source: { title, targetType, inclusion } }\` under collection create/update. Do not send \`shareable\` — that field is not on \`CollectionCreateConditionsSourceInput\`. Publish later uses \`collectionConditionsSourceCreate\` + \`shareableSource\`.`,
      instructions: `1. Implement enable so it creates the collection + five selections (stub currently throws).
2. Use \`listSeededProductGids(graphql, { limit: 5 })\` from \`seed-products.server.ts\` to get product GIDs; if it returns none, throw a clear error telling the user to seed under Parts.
3. Persist collection/source GIDs in ManagedResource (see comment at top of \`featured-source.server.ts\`).`,
      constraints: `- Do not call collectionConditionsSourceCreate yet.`,
      verify:
        "enable Step 1; Admin shows those five products; source is not shareable for co-creation",
    }),
  },
  {
    key: "trending_source",
    step: 2,
    actor: "app",
    title: "Trending signal",
    summary:
      "Swap the guest list for a score. viral.trending_score lands on each product; Shopify decides who qualifies. The app writes — it never curates.",
    dependsOn: ["featured_source"],
    note: 'Fallback: if a condition is rejected as "not enabled for collection conditions," open the viral.trending_score definition in Admin (Settings → Custom data → Products → Metafields) and enable "Use as a condition in collections." The app normally sets this for you.',
    aiPrompt: appPrompt({
      context: `Step 2: replace Step 1 selections with a \`viral.trending_score\` metafieldDecimal GREATER_THAN condition. App writes scores; Shopify recomputes membership.
A metafield definition can only be used in a collection condition when its \`smartCollectionCondition\` capability is enabled (it is off by default) — \`ensureMetafieldDefinition\` sets it for you.
Hooks: implement the stub in \`trending-source.server.ts\`; reuse \`metafields.server.ts\` (TRENDING) and \`setSourceToConditions\` / \`decimalGreaterThan\`. \`provision.server.ts\` already calls enable/disable.`,
      instructions: `1. Implement enable: ensure PRODUCT-owner decimal def (idempotent; handle TAKEN).
2. Write sample scores via \`setMetafieldValues\` (it batches — metafieldsSet caps at 25 metafields per call).
3. Swap source inclusion to conditions; disable restores the manual list.`,
      verify:
        "enable Step 2; change a product's trending_score in Admin; it joins/leaves with no app call",
    }),
  },
  {
    key: "confirm_trending_collection",
    step: 3,
    actor: "merchant",
    title: "Confirm the Trending collection",
    summary:
      'Open "Trending on social" in admin. Look once. This is the collection the signal will drive — and it is still the merchant\'s.',
    dependsOn: ["trending_source"],
    sidekickPrompt: `<context>
Viral added an app-owned source driven by viral.trending_score to my "Trending on social" collection. I still own the collection.
</context>

<instructions>
1. Open "Trending on social".
2. Confirm I still own it.
3. Point out Viral's source and that membership follows trending_score (not a hand-picked list).
4. Give me a short done checklist.
</instructions>

<output_format>
Numbered screens to open, then a 3–5 item checklist.
</output_format>`,
  },
  {
    key: "publish_sources",
    step: 4,
    actor: "app",
    title: "Publish sources for co-creation",
    summary:
      "Pull back the curtain. Make the source shareable so the merchant can see Viral's logic in the collection editor — and add their own beside it.",
    dependsOn: ["trending_source"],
    aiPrompt: appPrompt({
      context: `Step 4: make the trending source shareable so the merchant can compose beside it.
\`CollectionCreateConditionsSourceInput\` has no \`shareable\` field. Nested \`{ source: … }\` is always collection-owned.
Publish: \`collectionConditionsSourceCreate\` → link \`{ shareableSource: { sourceId } }\` → \`sourcesToDelete\` the old source; repoint ManagedResource. Unpublish: collection-owned twin + \`collectionConditionsSourceDelete\`.
Convention from here on: build every new source app-owned + shareable via this same \`collectionConditionsSourceCreate\` → link pattern (Step 6 does exactly this). Collection-owned nesting is only the Step 1/2 starting point.
Hooks: implement the stub in \`sources-state.server.ts\`; reuse \`createShareableSource\` / \`linkShareableSource\` / \`getSourceShareable\`. \`provision.server.ts\` already calls applySourceToggle.`,
      instructions: `1. Implement publish so enable swaps to a linked shareable source. Sequence:
   a. \`getSourceShareable\` — skip the swap if the source is already shareable.
   b. \`cloneSourceInclusion\` — read the current collection-owned source's conditions into a create-ready shape.
   c. \`createShareableSource\` with that cloned inclusion.
   d. \`linkShareableSource\` to attach it to the collection.
   e. \`sourcesToDelete\` the old collection-owned source.
   f. Re-query with \`findSourceOnCollection(graphql, collectionId, { shareable: true })\` and repoint the ManagedResource source GID (don't assume array position).
2. Persist the new source id; no orphan GIDs.`,
      constraints: `- Never send shareable on nested collection source create input.`,
      verify: "enable Step 4; collection editor shows Viral's source as composable",
    }),
  },
  {
    key: "add_merchant_rule",
    step: 5,
    actor: "merchant",
    title: "Add your own rule alongside Viral's source",
    summary:
      "Add a second condition in the collection editor — I want to promote clutches, so I add a product tag condition beside Viral's source. Two rulebooks, one collection. Shopify merges them; Viral never overwrites mine.",
    dependsOn: ["publish_sources"],
    sidekickPrompt: `<context>
On my "Trending on social" collection, Viral's shareable source is visible. I want to promote clutches, so I need my own condition on the same collection alongside Viral's signal. Shopify merges both; Viral must not overwrite my rules.
</context>

<instructions>
1. Open the collection editor; confirm Viral's source.
2. Walk me through adding my own condition: product tag equals "clutches".
3. Confirm both rulebooks remain — Viral's trending signal and my clutches tag condition.
</instructions>

<output_format>
Step-by-step UI walkthrough, then a short "it worked" check.
</output_format>`,
  },
  {
    key: "variant_drop",
    step: 6,
    actor: "app",
    title: "Variant drop: trending red products",
    summary:
      "Narrow the signal to variants — trending and red, both at once. Valentine's Day writes itself; no theme surgery required.",
    dependsOn: ["trending_source"],
    note: 'Fallback: if the trending-score condition is rejected as "not enabled for collection conditions," enable "Use as a condition in collections" on the variant viral.trending_score definition in Admin (Settings → Custom data → Variants → Metafields). The app normally sets this for you.',
    aiPrompt: appPrompt({
      context: `Step 6: "Red Drop" — create a NEW collection (handle \`red-drop\`) driven by an app-owned SHAREABLE source (collectionConditionsSourceCreate). Do not attach it to the Trending collection from Step 2; it is its own collection. Making the source shareable lets the merchant compose beside it.
Source = targetType VARIANTS, matchType ALL, two conditions: variant title CONTAINS "red" AND the trending-score metafield (viral.trending_score, PRODUCTVARIANT-owned) GREATER_THAN threshold.
Rule: the trending metafield condition needs the \`smartCollectionCondition\` capability enabled — \`ensureMetafieldDefinition\` handles it. Variant title is an attribute condition (no capability needed).`,
      instructions: `1. Ensure the PRODUCTVARIANT trending def; write the score onto the seeded red variants (find them by variant title containing "red") via \`setMetafieldValues\` (it batches — metafieldsSet caps at 25 per call).
2. Create the app SHAREABLE source (VARIANTS, matchType ALL): variantTitle CONTAINS "red" AND trending GREATER_THAN threshold. Then create the \`red-drop\` collection linked to that shareable source.
3. Record the collection + source in ManagedResource; keep enable/disable idempotent (disable deletes the shareable source so it doesn't orphan).`,
      constraints: `- The source must be app-owned and shareable; the metafield condition must be PRODUCTVARIANT-owned.`,
      verify:
        "enable Step 6; Red Drop membership is only red+trending variants, and the source shows as shareable in the collection editor",
    }),
  },
  {
    key: "loyalty_discount",
    step: 7,
    actor: "merchant",
    title: "Discount that follows the signal",
    summary:
      "Ten percent off whatever is trending — because the discount targets the collection, not a product list. The merchant creates it once; the signal moves and the offer follows.",
    dependsOn: ["trending_source"],
    sidekickPrompt: `<context>
Viral drives membership of "Trending on social" via viral.trending_score. I want 10% off whatever is currently trending. Because the discount targets the collection (not specific products), it stays correct as membership changes.
</context>

<instructions>
1. Go to Discounts → Create discount → Amount off products (automatic).
2. Set value to 10% off.
3. Under "Applies to", choose Specific collections and select "Trending on social".
4. Save and confirm it is Active.
5. Explain why targeting the collection means the discount follows the trending signal automatically.
</instructions>

<output_format>
Numbered screens to open, then a 3–5 item checklist confirming the discount is active and scoped to the collection.
</output_format>`,
  },
  {
    key: "shipping_profile",
    step: 8,
    actor: "merchant",
    title: "Reuse for an expedited shipping profile",
    summary:
      'Build a new "Expedite Shipping" collection with two sources: a price-over-$100 condition, plus Viral\'s app-owned Red Drop source reused as-is. Two rulebooks, one collection — no new API work, and the offer follows both signals.',
    dependsOn: ["variant_drop"],
    note: "You'll create a new collection named \"Expedite Shipping\" with a price condition, reuse Viral's shareable Red Drop source (Step 6) as a second source on it, then point an Expedited shipping profile at it.",
    sidekickPrompt: `<context>
Viral's Red Drop source (Step 6) is an app-owned, shareable source combining the trending signal with a red-variant condition. Goal: qualify products over $100 that are also in the Red Drop for expedited shipping — by composing two sources on one collection, not by editing shipping or product lists.
</context>

<instructions>
1. Create a new collection titled "Expedite Shipping" (Products → Collections → Create collection).
2. Add one condition: product price is greater than $100.
3. Add a second source to the same collection by reusing Viral's existing shareable source ("Red Drop (app source)") rather than creating a new condition — Shopify merges both sources.
4. Point an Expedited shipping profile at "Expedite Shipping" (Settings → Shipping and delivery).
5. Explain why membership follows both rules automatically — as prices change and as the Red Drop signal moves — with no manual re-curation.
</instructions>

<output_format>
Numbered screens to open, then a 3–5 item checklist confirming "Expedite Shipping" has both sources and is wired to the shipping profile.
</output_format>`,
  },
  {
    key: "confirm_live_results",
    step: 9,
    actor: "merchant",
    title: "Review what's updating on its own",
    summary:
      "Open admin and watch the machine run. Collection membership, the discount, shipping — all trailing the score. No one dragged anything.",
    dependsOn: ["loyalty_discount"],
    sidekickPrompt: `<context>
Membership follows the score; the loyalty discount targets that collection; Expedite Shipping (if on) composes a price condition with the Red Drop source. No hand-editing membership.
</context>

<instructions>
Walk me through verifying:
1. "Trending on social" follows trending_score (no drag-and-drop).
2. Loyalty discount targets that collection.
3. If Expedite Shipping is on, it still shows both the price-over-$100 condition and the reused Red Drop source.
</instructions>

<output_format>
Ordered admin checklist + what "healthy" looks like. Flag anything that means the signal is not driving membership.
</output_format>`,
  },
];

export const FEATURE_BY_KEY: Record<FeatureKey, FeatureDef> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f]),
) as Record<FeatureKey, FeatureDef>;
