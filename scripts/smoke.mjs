#!/usr/bin/env node
/**
 * Smoke suite for the prompt-only Viral starter.
 * Validates structural invariants that unit tests would cover if present.
 *
 * Run this on a FRESH, unmodified clone to confirm the starter ships correctly
 * (prompt-only, stubs not implemented). It is NOT a per-step check: once you
 * implement a stub, the "throws not implemented" assertion is expected to fail
 * for that file — that means your step is done, not that the starter is broken.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const passes = [];

function ok(name, cond, detail = "") {
  if (cond) passes.push(name);
  else failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

// --- Must-have files ---
const mustHave = [
  "README.md",
  "package.json",
  "shopify.app.toml",
  "shopify.web.toml",
  "prisma/schema.prisma",
  "app/routes/app._index.tsx",
  "app/components/BuildPathStep.tsx",
  "app/features/registry.ts",
  "app/features/provision.server.ts",
  "app/lib/collection-sources.server.ts",
  "app/lib/metafields.server.ts",
  "seed-products/products.json",
];
for (const f of mustHave) ok(`exists ${f}`, exists(f));

// --- Must NOT exist (stripped from full Viral / old starter) ---
const mustNot = [
  "prompts",
  "starter",
  "app/routes/room.tsx",
  "app/features/workshop-state.server.ts",
  "NEXT-STEPS.md",
  "AGENTS.md",
  "TROUBLESHOOTING.md",
];
for (const f of mustNot) ok(`absent ${f}`, !exists(f));

// --- No Build for me / auto path in app code ---
const appFiles = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(ts|tsx|md|toml)$/.test(ent.name)) appFiles.push(p);
  }
}
walk(path.join(root, "app"));
appFiles.push(path.join(root, "README.md"), path.join(root, "package.json"));

const banned = [/build-auto/, /Build for me/, /\bTurn on\b/];
for (const file of appFiles) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);
  for (const re of banned) {
    ok(`${rel} free of ${re}`, !re.test(text));
  }
}

// --- StepIntent is prompt-only (+ seed for Step 1) ---
const stepUi = read("app/components/BuildPathStep.tsx");
ok(
  "StepIntent is complete-prompt|seed|reset|skip",
  /export type StepIntent = "complete-prompt" \| "seed" \| "reset" \| "skip"/.test(stepUi),
);
ok("BuildPathStep has Skip to next step", /Skip to next step/.test(stepUi));
ok("BuildPathStep has Mark as done", /Mark as done/.test(stepUi));
ok("BuildPathStep has View coding prompt", /View coding prompt/.test(stepUi));
ok("BuildPathStep has View Sidekick prompt", /View Sidekick prompt/.test(stepUi));
ok("BuildPathStep has no build-auto submit", !/build-auto/.test(stepUi));
ok("BuildPathStep has Seed sample products", /Seed sample products/.test(stepUi));

// --- Action route intents ---
const index = read("app/routes/app._index.tsx");
ok("home action has complete-prompt", /complete-prompt/.test(index));
ok("home action has no build-auto", !/build-auto/.test(index));
ok("home action has no turn-off", !/turn-off/.test(index));
ok("Mark as done calls provisionStep", /provisionStep\(/.test(index));

// --- Route type includes prompt + auto (Step 1 seed) ---
const route = read("app/features/route.server.ts");
ok('StepRoute includes "prompt"', /"prompt"/.test(route));
ok('StepRoute includes "auto"', /"auto"/.test(route));

// --- Registry completeness ---
const registry = read("app/features/registry.ts");
const expectedKeys = [
  "seed_products",
  "featured_source",
  "trending_source",
  "confirm_trending_collection",
  "publish_sources",
  "add_merchant_rule",
  "variant_drop",
  "loyalty_discount",
  "shipping_profile",
  "confirm_live_results",
];
for (const key of expectedKeys) {
  ok(`registry has ${key}`, new RegExp(`key:\\s*"${key}"`).test(registry));
}
ok("registry has app prompts", /aiPrompt:/.test(registry));
ok("registry has sidekick prompts", /sidekickPrompt:/.test(registry));
ok("registry does not mention Build for me", !/Build for me/.test(registry));
ok("seed step is provisionOnly", /provisionOnly:\s*true/.test(registry));
ok("home has no Parts section", !/title="Parts"/.test(index));
ok("home has randomize-trending", /randomize-trending/.test(index));
ok(
  "seed-products exports enableSeedProducts",
  /export async function enableSeedProducts/.test(read("app/features/seed-products.server.ts")),
);

const collectionSources = read("app/lib/collection-sources.server.ts");
ok(
  "collection-sources has cloneSourceInclusion",
  /export async function cloneSourceInclusion/.test(collectionSources),
);
ok(
  "collection-sources has findSourceOnCollection",
  /export async function findSourceOnCollection/.test(collectionSources),
);
ok("createCollectionInput accepts handle", /handle\?: string/.test(collectionSources));
ok(
  "seed-products exports listSeededProductGids",
  /export async function listSeededProductGids/.test(read("app/features/seed-products.server.ts")),
);

// --- Feature stubs: fresh clone should throw; implemented stubs are skipped ---
const stubs = [
  "featured-source.server.ts",
  "trending-source.server.ts",
  "sources-state.server.ts",
  "variant-drop.server.ts",
];
const implementedStubs = [];
for (const stub of stubs) {
  const text = read(`app/features/${stub}`);
  const isStub = /not implemented yet/.test(text);
  if (isStub) {
    ok(`${stub} throws not implemented`, true);
  } else {
    implementedStubs.push(stub);
    passes.push(`${stub} implemented (stub check skipped — expected after you complete that step)`);
  }
}

// --- Seed catalog ---
const catalog = JSON.parse(read("seed-products/products.json"));
ok("seed catalog has products array", Array.isArray(catalog.products));
ok(
  "seed catalog has 20 products",
  catalog.products.length === 20,
  `got ${catalog.products.length}`,
);
const images = fs.readdirSync(path.join(root, "seed-products/product-images"));
ok("seed has 80 product images", images.length === 80, `got ${images.length}`);

// --- shopify.app.toml ---
const toml = read("shopify.app.toml");
ok("api_version is 2026-07", /api_version = "2026-07"/.test(toml));
ok("placeholder client_id", /client_id = "00000000000000000000000000000000"/.test(toml));
ok("has write_products scope", /write_products/.test(toml));
ok("no discount scopes (Step 7 is merchant-driven)", !/discounts/.test(toml));

// --- package.json scripts ---
const pkg = JSON.parse(read("package.json"));
for (const s of ["dev", "build", "setup", "typecheck", "format:check"]) {
  ok(`script ${s}`, Boolean(pkg.scripts?.[s]));
}
ok("no test script (expected for this starter)", !pkg.scripts?.test);

// --- README reflects prompt-only ---
const readme = read("README.md");
ok("README mentions Mark as done", /Mark as done/.test(readme));
ok("README mentions coding prompt", /coding prompt/i.test(readme));
ok("README mentions Sidekick", /Sidekick/.test(readme));
ok("README has get started commands", /pnpm install/.test(readme) && /pnpm run dev/.test(readme));

// --- Import graph: provision wires stubs ---
const provision = read("app/features/provision.server.ts");
for (const name of [
  "enableFeaturedSource",
  "enableTrendingSource",
  "applySourceToggle",
  "enableVariantDrop",
]) {
  ok(`provision imports/uses ${name}`, provision.includes(name));
}

// --- Build output exists after build (optional soft check) ---
if (exists("build")) {
  ok("build/ directory present after build", true);
} else {
  // Not a failure if build hasn't run yet in this process; suite may run before build.
  passes.push("build/ check skipped (not present yet)");
}

// --- Report ---
console.log(`\nSmoke suite: ${passes.length} passed, ${failures.length} failed\n`);
if (implementedStubs.length) {
  console.log("Implemented stubs (skipped — your step is done, starter is not broken):");
  for (const stub of implementedStubs) console.log(`  ↷ ${stub}`);
  console.log("");
}
if (failures.length) {
  console.error("FAILURES:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("All smoke checks passed.");
