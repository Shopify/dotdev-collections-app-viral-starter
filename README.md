# Viral — DotDev 2026 workshop starter

> **Build Viral with Collection Sources API**
>
> Read the story. Seed the store. Walk the build path — one step at a time.
>
> Prompt-only starter: each App step has a coding prompt; each Merchant step has
> a Sidekick prompt. **Mark as done** tracks progress.

Audience: **Shopify app developers**. Coding-agent prompts stick to public
Admin GraphQL `2026-07` only.

**In one sentence:** you write a metafield score; Shopify decides who belongs in the
collection. Thesis: _write the signal once, let Shopify handle membership, the
merchant co-creates from there._

## Prerequisites

1. A [Shopify Partner account](https://partners.shopify.com/) and the [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) installed and logged in (`shopify auth login`).
2. A **development store** that can call Admin GraphQL **2026-07** (Collection Sources). Create the store from the Partner Dashboard, then confirm Collection Sources mutations work against it using the [collectionConditionsSourceCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/collectionConditionsSourceCreate) docs (API version `2026-07` / latest preview as directed in the workshop).
3. Node.js and [pnpm](https://pnpm.io/installation).
4. A coding agent (Cursor, Copilot, etc.) and **Sidekick** in Shopify admin (for merchant steps).

## Quick glossary

| Term                              | Meaning                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Signal**                        | A metafield score your app writes (e.g. `viral.trending_score`).                                                                                                         |
| **Collection Source**             | App-owned rules on a collection. Docs: [collectionConditionsSourceCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/collectionConditionsSourceCreate). |
| **Collection-owned vs shareable** | Nested `{ source: … }` = collection-owned. Shareable = create with `collectionConditionsSourceCreate`, then link — merchant can compose beside it.                       |
| **Sidekick**                      | Admin AI assistant for merchant steps. Paste the prompt as-is.                                                                                                           |
| **ManagedResource**               | Local Prisma row mapping `kind` + `handle` → Shopify GID (idempotent enable/disable).                                                                                    |

## Get started

`shopify.app.toml` ships with a **placeholder** `client_id` (`0000…`). That is expected on first run — you create or link a real app via the CLI.

```bash
cp .env.example .env
pnpm install
pnpm run setup
pnpm run dev --reset
```

1. Copy `.env.example` → `.env` **before** `pnpm run setup`. Prisma needs `DATABASE_URL` (already set in the example). Leave `SHOPIFY_*` empty; the CLI fills them when you link.
2. `pnpm run setup` generates the Prisma client and applies migrations.
3. In a **normal interactive terminal** (not CI or a headless agent), run `pnpm run dev --reset`: pick your Partner organization, create or select an app, then choose your 2026-07-capable development store.
4. Open the embedded app from admin when the CLI prints the preview URL.

If you already linked an app and only need a normal restart:

```bash
pnpm run dev
```

Shopify CLI may create local files under `.shopify/` and `shopify.app.<name>.toml` — those stay local (gitignored).

> **pnpm note:** pass CLI flags after the script name, e.g. `pnpm run dev --reset`. Do **not** use `pnpm run dev -- --reset` — the extra `--` makes Shopify CLI reject `--reset`.

### Troubleshooting first run

| Symptom                                                  | What to do                                                                                                                                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Failed to prompt: Which organization is this work for?` | The CLI needs an interactive TTY. Run `shopify auth login`, then `pnpm run dev --reset` in your own terminal (Terminal.app, iTerm, VS Code/Cursor terminal) — not a non-interactive agent/CI shell. |
| `No app with client ID 0000… found`                      | Expected before linking. Use `pnpm run dev --reset` to create or select a real app.                                                                                                                 |
| `Unexpected argument: --reset`                           | You used `pnpm run dev -- --reset`. Drop the extra `--`.                                                                                                                                            |
| `Environment variable not found: DATABASE_URL`           | Copy `.env.example` → `.env` before `pnpm run setup`.                                                                                                                                               |
| Collection Sources / GraphQL errors on 2026-07 fields    | Confirm the store can use the API version in the [Collection Sources docs](https://shopify.dev/docs/api/admin-graphql/latest/mutations/collectionConditionsSourceCreate).                           |

## How the workshop works

The app home (`/app`) is the activity:

1. **Mission** — why Viral writes a score instead of a product list
2. **Blueprint** — outcome + success criteria (expand the section in the app)
3. **Parts** — seed sample products and open Collection Sources API docs
4. **Build path** — nine steps in order (App builds + Merchant checkpoints)
5. **Go further** — take-home prompt to reuse the pattern on a signal your own app already computes (expand that section when you finish the build path)

### App steps

1. Open **View coding prompt**
2. Paste into your coding agent and **implement the stub** in `app/features/*.server.ts` (dispatch is already wired in `provision.server.ts`)
3. Click **Mark as done** — that runs your `enable*` implementation, then records progress

Until the stub is implemented, **Mark as done** shows **Step not implemented yet** with the stub message. If Shopify returns `userErrors` (or a GraphQL error), the banner title is **Shopify rejected the change** and lists each error.

### Merchant steps

1. Open **View Sidekick prompt**
2. Paste into Sidekick and act as the merchant in admin
3. Click **Mark as done** (progress only — no app provisioning)

Paste the Sidekick prompt as-is.

## Build path (nine steps)

| Step | Actor    | Title                                      |
| ---- | -------- | ------------------------------------------ |
| 1    | App      | Featured source (manual selection)         |
| 2    | App      | Trending signal                            |
| 3    | Merchant | Confirm the Trending collection            |
| 4    | App      | Publish sources for co-creation            |
| 5    | Merchant | Add your own rule alongside Viral's source |
| 6    | App      | Variant drop: trending red products        |
| 7    | Merchant | Discount that follows the signal           |
| 8    | Merchant | Reuse for an expedited shipping profile    |
| 9    | Merchant | Review what's updating on its own          |

**Step 1 tip:** start from helpers in `app/lib/collection-sources.server.ts` — do not invent Collection Sources mutations from scratch. Public reference: [collectionConditionsSourceCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/collectionConditionsSourceCreate).

**Step 8 note:** Step 8 creates (or reuses) a collection with handle `expedited` behind an Expedited shipping profile, then adds the trending condition — the Sidekick prompt walks you through it.

Step definitions and prompts live in `app/features/registry.ts`. Wire enable/disable through `app/features/provision.server.ts`.

## What's in this repo

```
app/                 Remix app — activity UI, stubs, helpers
prisma/              Session + ShopFeature + ManagedResource
seed-products/       Sample catalog (products + images)
scripts/             Optional smoke checks (`pnpm run smoke`)
shopify.app.toml     App config (placeholder client_id — link via CLI)
```

## Scripts

| Command              | What it does                    |
| -------------------- | ------------------------------- |
| `pnpm run setup`     | Prisma generate + migrate       |
| `pnpm run dev`       | Shopify app dev (tunnel + Vite) |
| `pnpm run build`     | Production Remix build          |
| `pnpm run typecheck` | `tsc --noEmit`                  |
| `pnpm run smoke`     | Fresh-clone integrity checks    |

`pnpm run smoke` validates a **fresh, unmodified** starter (prompt-only, stubs not yet implemented). It is not a per-step check: once you implement a stub, its "not implemented" assertion is expected to fail — that means your step works.

### Which check to run when

| When                      | Command                  | Expect                                                         |
| ------------------------- | ------------------------ | -------------------------------------------------------------- |
| Fresh clone               | `pnpm run smoke`         | All checks pass                                                |
| After implementing a step | `pnpm exec tsc --noEmit` | Passes                                                         |
| After implementing a step | `pnpm run smoke`         | Implemented stubs are skipped (not failures) — that's expected |

The smoke suite validates the unmodified starter; once you implement a step, that stub's "not implemented" check is skipped, which is normal.
