import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureMetafieldDefinition, COLOR, MATERIAL } from "~/lib/metafields.server";
import { throwIfUserErrors } from "~/lib/shopify-errors.server";

type AdminGraphql = (q: string, o?: { variables?: Record<string, unknown> }) => Promise<Response>;

// Bundled inside this repo (copied from the shared dotdev/seed-products catalog) so
// standalone deploys of this app don't depend on a directory outside the repo.
// Resolved relative to this file so it works regardless of cwd.
const SEED_PRODUCTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../seed-products",
);
const IMAGES_DIR = path.join(SEED_PRODUCTS_DIR, "product-images");

const COLORS = ["Brown", "Red", "Black"] as const;
type Color = (typeof COLORS)[number];

type ProductSeed = {
  title: string;
  productType: string;
  tags: string[];
  descriptionHtml: string;
  material: string;
  price: string;
  sku: string;
  imageBase: string;
};

type SeedCatalog = { products: ProductSeed[] };

// products.json is a copy of the canonical, app-agnostic catalog also used by the
// starter app (source of truth: dotdev/seed-products/products.json), read at
// runtime rather than hardcoded here.
const catalog = JSON.parse(
  fs.readFileSync(path.join(SEED_PRODUCTS_DIR, "products.json"), "utf-8"),
) as SeedCatalog;

export const SEED_PRODUCTS: ProductSeed[] = catalog.products;

/** Vendor stamped on every seeded product — use to query them back after Parts → Seed. */
export const SEED_VENDOR = "Viral";

export interface SeededProductGid {
  productId: string;
  variantIds: string[];
}

const LIST_SEED_PRODUCTS = `#graphql
  query ListSeedProducts($first: Int!, $query: String!) {
    products(first: $first, query: $query) {
      nodes {
        id
        variants(first: 10) {
          nodes { id }
        }
      }
    }
  }
`;

/** Product + variant GIDs for workshop steps (Step 1 selections, Step 6 variant metafields). */
export async function listSeededProductGids(
  graphql: AdminGraphql,
  opts?: { limit?: number },
): Promise<SeededProductGid[]> {
  const limit = opts?.limit ?? SEED_PRODUCTS.length;
  const res = await graphql(LIST_SEED_PRODUCTS, {
    variables: { first: limit, query: `vendor:${SEED_VENDOR}` },
  });
  const body = (await res.json()) as {
    data?: { products?: { nodes: { id: string; variants: { nodes: { id: string }[] } }[] } };
  };
  return (body.data?.products?.nodes ?? []).map((p) => ({
    productId: p.id,
    variantIds: p.variants.nodes.map((v) => v.id),
  }));
}

const STAGED_UPLOADS_CREATE = `#graphql
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const PRODUCT_SET = `#graphql
  mutation ProductSet($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(input: $input, synchronous: $synchronous) {
      product { id title }
      userErrors { field message }
    }
  }
`;

const COUNT_PRODUCTS = `#graphql
  { products(first: 1) { nodes { id } } }
`;

// No ID returns the shop's primary location — the one Admin uses for new
// inventory by default. Requires read_inventory or read_locations.
const PRIMARY_LOCATION = `#graphql
  { location { id } }
`;

// "Online Store" is an AppCatalog publication, not a fixed/well-known ID — look
// it up by catalog title rather than assuming which publication comes first.
const ONLINE_STORE_PUBLICATION = `#graphql
  query OnlineStorePublication {
    publications(first: 20) {
      nodes {
        id
        catalog { title }
      }
    }
  }
`;

const PUBLISH_PRODUCT = `#graphql
  mutation PublishProduct($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }
`;

const SEED_INVENTORY_QUANTITY = 10;

async function getPrimaryLocationId(graphql: AdminGraphql): Promise<string | null> {
  const res = await graphql(PRIMARY_LOCATION);
  const { data } = (await res.json()) as { data?: { location?: { id: string } | null } };
  return data?.location?.id ?? null;
}

async function getOnlineStorePublicationId(graphql: AdminGraphql): Promise<string | null> {
  const res = await graphql(ONLINE_STORE_PUBLICATION);
  const { data } = (await res.json()) as {
    data?: { publications?: { nodes: { id: string; catalog?: { title: string } | null }[] } };
  };
  const nodes = data?.publications?.nodes ?? [];
  return nodes.find((n) => n.catalog?.title === "Online Store")?.id ?? null;
}

async function publishToOnlineStore(
  graphql: AdminGraphql,
  productId: string,
  publicationId: string,
): Promise<{ message: string }[]> {
  const res = await graphql(PUBLISH_PRODUCT, {
    variables: { id: productId, input: [{ publicationId }] },
  });
  const { data } = (await res.json()) as {
    data?: { publishablePublish?: { userErrors?: { message: string }[] } };
  };
  return data?.publishablePublish?.userErrors ?? [];
}

export async function getProductCount(graphql: AdminGraphql): Promise<number> {
  const res = await graphql(COUNT_PRODUCTS);
  const { data } = (await res.json()) as { data?: { products?: { nodes: unknown[] } } };
  return data?.products?.nodes?.length ?? 0;
}

type UploadedFile = { originalSource: string; filename: string; alt: string; contentType: "IMAGE" };

// Returns null (rather than throwing) when the source file doesn't exist on disk —
// some seed products don't have photography yet and ship without images.
async function uploadImage(
  graphql: AdminGraphql,
  absPath: string,
  filename: string,
  alt: string,
): Promise<UploadedFile | null> {
  if (!fs.existsSync(absPath)) return null;

  const stagedRes = await graphql(STAGED_UPLOADS_CREATE, {
    variables: {
      input: [{ filename, mimeType: "image/png", resource: "PRODUCT_IMAGE", httpMethod: "POST" }],
    },
  });
  const stagedJson = (await stagedRes.json()) as {
    data?: {
      stagedUploadsCreate?: {
        stagedTargets?: {
          url: string;
          resourceUrl: string;
          parameters: { name: string; value: string }[];
        }[];
        userErrors?: { message: string }[];
      };
    };
  };
  const payload = stagedJson.data?.stagedUploadsCreate;
  throwIfUserErrors("stagedUploadsCreate", payload?.userErrors);
  const target = payload?.stagedTargets?.[0];
  if (!target) throw new Error(`stagedUploadsCreate: no staged target for ${filename}`);

  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append("file", new Blob([fs.readFileSync(absPath)]), filename);

  const uploadRes = await fetch(target.url, { method: "POST", body: form });
  if (!uploadRes.ok) {
    throw new Error(
      `Staged upload failed for ${filename}: ${uploadRes.status} ${uploadRes.statusText}`,
    );
  }

  return { originalSource: target.resourceUrl, filename, alt, contentType: "IMAGE" };
}

type SeedContext = { locationId: string | null; onlineStorePublicationId: string | null };

async function seedProduct(graphql: AdminGraphql, product: ProductSeed, ctx: SeedContext) {
  const [lifestyle, brown, red, black] = await Promise.all([
    uploadImage(
      graphql,
      path.join(IMAGES_DIR, `${product.imageBase}-lifestyle.png`),
      `${product.imageBase}-lifestyle.png`,
      `${product.title} lifestyle photo`,
    ),
    uploadImage(
      graphql,
      path.join(IMAGES_DIR, `${product.imageBase}-brown.png`),
      `${product.imageBase}-brown.png`,
      `${product.title} in brown`,
    ),
    uploadImage(
      graphql,
      path.join(IMAGES_DIR, `${product.imageBase}-red.png`),
      `${product.imageBase}-red.png`,
      `${product.title} in red`,
    ),
    uploadImage(
      graphql,
      path.join(IMAGES_DIR, `${product.imageBase}-black.png`),
      `${product.imageBase}-black.png`,
      `${product.title} in black`,
    ),
  ]);

  const byColor: Record<Color, UploadedFile | null> = { Brown: brown, Red: red, Black: black };
  const files = [lifestyle, brown, red, black].filter((f): f is UploadedFile => f !== null);

  const variants = COLORS.map((color) => {
    const file = byColor[color];
    return {
      optionValues: [{ optionName: "Color", name: color }],
      price: product.price,
      inventoryItem: { sku: `${product.sku}-${color.slice(0, 3).toUpperCase()}`, tracked: true },
      ...(ctx.locationId
        ? {
            inventoryQuantities: [
              {
                locationId: ctx.locationId,
                name: "available",
                quantity: SEED_INVENTORY_QUANTITY,
              },
            ],
          }
        : {}),
      ...(file ? { file } : {}),
      metafields: [
        {
          namespace: COLOR.namespace,
          key: COLOR.key,
          type: COLOR.type,
          value: color.toLowerCase(),
        },
      ],
    };
  });

  const input = {
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    vendor: "Viral",
    productType: product.productType,
    tags: product.tags,
    status: "ACTIVE",
    productOptions: [{ name: "Color", values: COLORS.map((name) => ({ name })) }],
    ...(files.length ? { files } : {}),
    metafields: [
      {
        namespace: MATERIAL.namespace,
        key: MATERIAL.key,
        type: MATERIAL.type,
        value: product.material,
      },
    ],
    variants,
  };

  const res = await graphql(PRODUCT_SET, { variables: { input, synchronous: true } });
  const json = (await res.json()) as {
    data?: {
      productSet?: {
        product?: { id: string; title: string };
        userErrors?: { message: string }[];
      };
    };
  };
  const payload = json.data?.productSet;
  const productId = payload?.product?.id;
  const errors = [...(payload?.userErrors ?? [])];

  // Publish once the product exists — a separate call because productSet has
  // no publications field. Best-effort: a missing Online Store channel (e.g. a
  // headless-only dev store) shouldn't fail the whole seed run.
  if (productId && ctx.onlineStorePublicationId) {
    errors.push(...(await publishToOnlineStore(graphql, productId, ctx.onlineStorePublicationId)));
  }

  return { title: product.title, id: productId, errors };
}

export async function seedProducts(opts: { shop: string; graphql: AdminGraphql }) {
  const { shop, graphql } = opts;
  await ensureMetafieldDefinition({ shop, graphql, def: COLOR, featureKey: "seed_products" });
  await ensureMetafieldDefinition({ shop, graphql, def: MATERIAL, featureKey: "seed_products" });

  const [locationId, onlineStorePublicationId] = await Promise.all([
    getPrimaryLocationId(graphql),
    getOnlineStorePublicationId(graphql),
  ]);
  const ctx: SeedContext = { locationId, onlineStorePublicationId };

  const results = [];
  for (const product of SEED_PRODUCTS) {
    results.push(await seedProduct(graphql, product, ctx));
  }
  return results;
}
