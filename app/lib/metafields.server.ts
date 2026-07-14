// Metafield helpers for the "signal" steps. A condition-based collection source
// references a metafield DEFINITION id, so each signal needs its definition
// created once per shop; then the app writes values (the signal) onto products.
import prisma from "~/db.server";
import { throwIfUserErrors } from "~/lib/shopify-errors.server";

type AdminGraphql = (q: string, o?: { variables?: Record<string, unknown> }) => Promise<Response>;

export const TRENDING = {
  namespace: "viral",
  key: "trending_score",
  type: "number_decimal",
  name: "Trending score",
  ownerType: "PRODUCT" as const,
};

export const COLOR = {
  namespace: "viral",
  key: "color",
  type: "single_line_text_field",
  name: "Color",
  ownerType: "PRODUCTVARIANT" as const,
};

// Variant-level mirror of TRENDING used by Step 6's VARIANTS source so that
// both conditions (trending + color) are at the same owner level. A VARIANTS
// source only accepts conditions whose metafield definition ownerType is
// PRODUCTVARIANT; mixing a PRODUCT-level definition would be rejected.
export const TRENDING_VARIANT = {
  namespace: "viral",
  key: "trending_score",
  type: "number_decimal",
  name: "Trending score (variant)",
  ownerType: "PRODUCTVARIANT" as const,
};

// A metafield definition can only be used in a collection condition when the
// `smartCollectionCondition` capability is enabled — it is NOT on by default.
// (This replaced the deprecated `useAsCollectionCondition` flag.) Query it back
// so we can enable it on definitions that already exist without it.
const FIND_DEFINITION = `#graphql
  query FindDef($namespace: String!, $key: String!, $ownerType: MetafieldOwnerType!) {
    metafieldDefinitions(first: 1, namespace: $namespace, key: $key, ownerType: $ownerType) {
      nodes {
        id
        capabilities { smartCollectionCondition { enabled eligible } }
      }
    }
  }
`;

const CREATE_DEFINITION = `#graphql
  mutation CreateDef($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id }
      userErrors { field message code }
    }
  }
`;

// Enable "Use as a condition in collections" for an existing definition.
const ENABLE_COLLECTION_CONDITION = `#graphql
  mutation EnableCollectionCondition($definition: MetafieldDefinitionUpdateInput!) {
    metafieldDefinitionUpdate(definition: $definition) {
      updatedDefinition { id }
      userErrors { field message code }
    }
  }
`;

type FoundDefinition = {
  id: string;
  capabilities?: { smartCollectionCondition?: { enabled: boolean; eligible: boolean } };
};

// Enable the smart-collection-condition capability on a definition that already
// exists (older definitions predate it). No-op if it is already on or ineligible.
async function ensureCollectionConditionCapability(
  graphql: AdminGraphql,
  def: Def,
  node: FoundDefinition | undefined,
) {
  const cap = node?.capabilities?.smartCollectionCondition;
  if (!cap || !cap.eligible || cap.enabled) return;
  const res = await graphql(ENABLE_COLLECTION_CONDITION, {
    variables: {
      definition: {
        namespace: def.namespace,
        key: def.key,
        ownerType: def.ownerType,
        capabilities: { smartCollectionCondition: { enabled: true } },
      },
    },
  });
  const json = (await res.json()) as {
    data?: { metafieldDefinitionUpdate?: { userErrors?: { message: string; code?: string }[] } };
  };
  throwIfUserErrors("metafieldDefinitionUpdate", json.data?.metafieldDefinitionUpdate?.userErrors);
}

const SET_METAFIELDS = `#graphql
  mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

type Def = { namespace: string; key: string; type: string; name: string; ownerType: string };

// Idempotent: returns the definition id, creating it only if absent. Cached in
// ManagedResource so we don't re-query on every toggle.
export async function ensureMetafieldDefinition(opts: {
  shop: string;
  graphql: AdminGraphql;
  def: Def;
  featureKey: string;
}): Promise<string> {
  const { shop, graphql, def, featureKey } = opts;
  // Cache key includes ownerType so TRENDING (PRODUCT) and TRENDING_VARIANT (PRODUCTVARIANT)
  // don't collide — same namespace/key but different definitions.
  const cacheHandle = `${def.key}__${def.ownerType}`;
  const cached = await prisma.managedResource.findUnique({
    where: { shop_kind_handle: { shop, kind: "metafieldDefinition", handle: cacheHandle } },
  });
  if (cached) return cached.gid;

  const found = await graphql(FIND_DEFINITION, {
    variables: { namespace: def.namespace, key: def.key, ownerType: def.ownerType },
  });
  const foundJson = (await found.json()) as {
    data?: { metafieldDefinitions?: { nodes: FoundDefinition[] } };
  };
  const foundNode = foundJson.data?.metafieldDefinitions?.nodes?.[0];
  let id = foundNode?.id;

  if (id) {
    // Definition already exists — make sure it can be used as a collection condition.
    await ensureCollectionConditionCapability(graphql, def, foundNode);
  } else {
    const res = await graphql(CREATE_DEFINITION, {
      variables: {
        definition: {
          name: def.name,
          namespace: def.namespace,
          key: def.key,
          type: def.type,
          ownerType: def.ownerType,
          capabilities: { smartCollectionCondition: { enabled: true } },
        },
      },
    });
    const json = (await res.json()) as {
      data?: {
        metafieldDefinitionCreate?: {
          createdDefinition?: { id: string };
          userErrors?: { message: string; code?: string }[];
        };
      };
    };
    const payload = json.data?.metafieldDefinitionCreate;
    id = payload?.createdDefinition?.id;
    const errs = payload?.userErrors ?? [];
    // A concurrent install may have created it (code TAKEN); re-query in that case.
    if (!id && errs.length && !errs.some((e) => e.code === "TAKEN")) {
      throwIfUserErrors("metafieldDefinitionCreate", errs);
    }
    if (!id) {
      const retry = await graphql(FIND_DEFINITION, {
        variables: { namespace: def.namespace, key: def.key, ownerType: def.ownerType },
      });
      const rj = (await retry.json()) as {
        data?: { metafieldDefinitions?: { nodes: FoundDefinition[] } };
      };
      const retryNode = rj.data?.metafieldDefinitions?.nodes?.[0];
      id = retryNode?.id;
      // The winning create may not have set the capability — ensure it here too.
      await ensureCollectionConditionCapability(graphql, def, retryNode);
    }
  }
  if (!id) throw new Error("Could not resolve metafield definition id");

  await prisma.managedResource.create({
    data: { shop, kind: "metafieldDefinition", featureKey, handle: cacheHandle, gid: id },
  });
  return id;
}

export async function setMetafieldValues(opts: {
  graphql: AdminGraphql;
  def: Def;
  values: { ownerId: string; value: string }[];
}) {
  const { graphql, def, values } = opts;
  if (!values.length) return;
  // metafieldsSet accepts at most 25 metafields per call — chunk larger writes
  // (e.g. seeding scores across a big catalog) so we never hit the input limit.
  const BATCH_SIZE = 25;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const chunk = values.slice(i, i + BATCH_SIZE);
    const res = await graphql(SET_METAFIELDS, {
      variables: {
        metafields: chunk.map((v) => ({
          ownerId: v.ownerId,
          namespace: def.namespace,
          key: def.key,
          type: def.type,
          value: v.value,
        })),
      },
    });
    const json = (await res.json()) as {
      data?: { metafieldsSet?: { userErrors?: { message: string; field?: string[] }[] } };
    };
    throwIfUserErrors("metafieldsSet", json.data?.metafieldsSet?.userErrors);
  }
}

export const MATERIAL = {
  namespace: "viral",
  key: "material",
  type: "single_line_text_field",
  name: "Material",
  ownerType: "PRODUCT" as const,
};
