// Thin wrapper around the Collection Sources API (Admin API 2026-07).
//
// Model (shopify.dev changelog "New Collection model and APIs now available"):
//   A Collection has `sources`. A CollectionConditionsSource has title, targetType
//   (PRODUCTS | VARIANTS), shareable, and inclusion/exclusion. Inclusion has matchType
//   (ALL | ANY) and either `selections` or `conditions`.
//
// Two ways to create a conditions source:
//   1. Collection-owned (not shareable): nest `{ source: { title, targetType, inclusion } }`
//      under collectionCreate.sources / collectionUpdate.sourcesToCreate.
//      CollectionCreateConditionsSourceInput has NO `shareable` field — do not send one.
//   2. App-owned shareable: collectionConditionsSourceCreate(input: …) always yields
//      shareable:true; then link with `{ shareableSource: { sourceId } }` on the collection.
//      Delete with collectionConditionsSourceDelete (auto-detaches from collections).
//
// Mutation shape:
//   - collectionCreate(collection: CollectionCreateInput!) / collectionUpdate(collection:
//     CollectionUpdateInput!) — argument is `collection`, not legacy `input`.
//   - sourcesToCreate oneOf: `source` | `subCollections` | `shareableSource: { sourceId }`.
//   - Existing sources: sourcesToUpdate: [{ condition: { id, inclusion: { … } } }].
//   - sourcesToDelete: [ID!] removes a collection-owned source (or unlinks a link).

type Gql = (query: string, opts?: { variables?: Record<string, unknown> }) => Promise<Response>;

export interface ProductSelection {
  productId: string;
  variantIds?: string[];
}

export type InclusionCondition = Record<string, unknown>;

export interface SourceFields {
  title: string;
  targetType?: "PRODUCTS" | "VARIANTS";
  matchType?: "ALL" | "ANY";
  selections?: ProductSelection[];
  conditions?: InclusionCondition[];
}

function inclusionBlock(spec: Pick<SourceFields, "matchType" | "selections" | "conditions">) {
  return {
    matchType: spec.matchType ?? (spec.conditions ? "ALL" : "ANY"),
    ...(spec.selections
      ? {
          selections: spec.selections.map((s) => ({
            productId: s.productId,
            variantIds: s.variantIds,
          })),
        }
      : {}),
    ...(spec.conditions ? { conditions: spec.conditions } : {}),
  };
}

/** Collection-owned source input — never includes `shareable` (not on the create input). */
function sourceFieldsInput(spec: SourceFields) {
  return {
    title: spec.title,
    targetType: spec.targetType ?? "PRODUCTS",
    inclusion: inclusionBlock(spec),
  };
}

// --- Create a collection with an initial set of sources ------------------------
export const CREATE_COLLECTION = `#graphql
  mutation CreateCollection($collection: CollectionCreateInput!) {
    collectionCreate(collection: $collection) {
      collection { id title handle sources { __typename id title } }
      userErrors { field message }
    }
  }
`;

export function createCollectionInput(opts: {
  title: string;
  handle?: string;
  sources: SourceFields[];
}) {
  return {
    collection: {
      title: opts.title,
      ...(opts.handle ? { handle: opts.handle } : {}),
      sources: opts.sources.map((s) => ({ source: sourceFieldsInput(s) })),
    },
  };
}

// --- Add one or more brand-new sources to an existing collection ---------------
export const ADD_COLLECTION_SOURCES = `#graphql
  mutation AddCollectionSources($collection: CollectionUpdateInput!) {
    collectionUpdate(collection: $collection) {
      collection { id sources { __typename id title } }
      userErrors { field message }
    }
  }
`;

export function addSourcesInput(opts: { collectionId: string; sources: SourceFields[] }) {
  return {
    collection: {
      id: opts.collectionId,
      sourcesToCreate: opts.sources.map((s) => ({ source: sourceFieldsInput(s) })),
    },
  };
}

// --- Edit an EXISTING source in place (swap selections <-> conditions, title,
// or just flip one field — only what you pass here is changed). To make a source
// shareable, use createShareableSource + linkShareableSource instead. ---
export const UPDATE_COLLECTION_SOURCE = `#graphql
  mutation UpdateCollectionSource($collection: CollectionUpdateInput!) {
    collectionUpdate(collection: $collection) {
      collection { id sources { __typename id title } }
      userErrors { field message }
    }
  }
`;

export function updateSourceInput(opts: {
  collectionId: string;
  sourceId: string;
  title?: string;
  inclusion?: CollectionUpdateInclusionPatch;
}) {
  return {
    collection: {
      id: opts.collectionId,
      sourcesToUpdate: [
        {
          condition: {
            id: opts.sourceId,
            ...(opts.title !== undefined ? { title: opts.title } : {}),
            ...(opts.inclusion ? { inclusion: opts.inclusion } : {}),
          },
        },
      ],
    },
  };
}

export interface CollectionUpdateInclusionPatch {
  matchType?: "ALL" | "ANY";
  conditionsToCreate?: InclusionCondition[];
  conditionsToDelete?: string[];
  selectionsToAdd?: ProductSelection[];
  selectionsToRemove?: ProductSelection[];
}

const GET_COLLECTION_SOURCES = `#graphql
  query GetCollectionSources($collectionId: ID!) {
    collection(id: $collectionId) {
      sources {
        __typename
        ... on CollectionConditionsSource {
          id
          title
          targetType
          shareable
          inclusion {
            matchType
            conditions {
              id
              __typename
              ... on CollectionSourceInclusionConditionMetafieldDecimal {
                definition { id }
                relation
                value
              }
              ... on CollectionSourceInclusionConditionMetafieldString {
                definition { id }
                relation
                matchType
                values
              }
              ... on CollectionSourceInclusionConditionMetafieldBoolean {
                definition { id }
                relation
                value
              }
            }
            selections(first: 50) {
              nodes {
                product { id }
                variantIds
              }
            }
          }
        }
      }
    }
  }
`;

type RawConditionNode = {
  id: string;
  __typename?: string;
  definition?: { id: string };
  relation?: string;
  // Decimal/Boolean expose a scalar `value`; String exposes `values` (a list) + `matchType`.
  value?: string | number | boolean;
  values?: string[];
  matchType?: "ALL" | "ANY";
};

type RawConditionsSource = {
  id?: string;
  title?: string;
  targetType?: "PRODUCTS" | "VARIANTS";
  shareable?: boolean;
  inclusion?: {
    matchType?: "ALL" | "ANY";
    conditions?: RawConditionNode[];
    selections?: {
      nodes: { product: { id: string }; variantIds?: string[] | null }[];
    };
  };
};

function parseCollectionSourcesBody(body: {
  data?: { collection?: { sources?: RawConditionsSource[] } | null };
}) {
  const collection = body.data?.collection;
  if (!collection) {
    throw new Error(
      "Collection no longer exists — it was likely deleted in Admin. Start over from Step 1 (or Reset the workshop) to rebuild it.",
    );
  }
  return collection.sources ?? [];
}

function conditionNodeToInput(node: RawConditionNode): InclusionCondition | null {
  const definitionId = node.definition?.id;
  if (!definitionId || node.relation == null) return null;

  switch (node.__typename) {
    case "CollectionSourceInclusionConditionMetafieldDecimal":
      if (node.value == null) return null;
      return {
        metafieldDecimal: {
          definitionId,
          relation: node.relation,
          value: String(node.value),
        },
      };
    case "CollectionSourceInclusionConditionMetafieldString":
      if (!node.values?.length) return null;
      return {
        metafieldString: {
          definitionId,
          relation: node.relation,
          matchType: node.matchType ?? "ANY",
          values: node.values,
        },
      };
    case "CollectionSourceInclusionConditionMetafieldBoolean":
      if (node.value == null) return null;
      return {
        metafieldBoolean: {
          definitionId,
          relation: node.relation,
          value: Boolean(node.value),
        },
      };
    default:
      return null;
  }
}

function inclusionFromSource(source: RawConditionsSource): SourceInclusionState {
  const { inclusion } = source;
  if (!inclusion) {
    throw new Error("Source inclusion is missing on the collection.");
  }
  const conditions = (inclusion.conditions ?? [])
    .map(conditionNodeToInput)
    .filter((c): c is InclusionCondition => c !== null);

  return {
    matchType: inclusion.matchType ?? null,
    conditionIds: (inclusion.conditions ?? []).map((c) => c.id),
    conditions,
    selections: (inclusion.selections?.nodes ?? []).map((node) => ({
      productId: node.product.id,
      ...(node.variantIds?.length ? { variantIds: node.variantIds } : {}),
    })),
  };
}

export interface CollectionConditionsSourceSummary {
  id: string;
  title: string;
  targetType: "PRODUCTS" | "VARIANTS";
  shareable: boolean;
}

/** List condition sources on a collection — use after link/create to repoint ManagedResource. */
export async function listCollectionConditionSources(
  graphql: Gql,
  collectionId: string,
): Promise<CollectionConditionsSourceSummary[]> {
  const res = await graphql(GET_COLLECTION_SOURCES, { variables: { collectionId } });
  const body = (await res.json()) as {
    data?: { collection?: { sources?: RawConditionsSource[] } | null };
  };
  return parseCollectionSourcesBody(body)
    .filter((s): s is RawConditionsSource & { id: string; title: string } =>
      Boolean(s.id && s.title),
    )
    .map((s) => ({
      id: s.id!,
      title: s.title!,
      targetType: s.targetType ?? "PRODUCTS",
      shareable: s.shareable ?? false,
    }));
}

/** Find one source on a collection by id, title, and/or shareable flag. */
export async function findSourceOnCollection(
  graphql: Gql,
  collectionId: string,
  opts: { sourceId?: string; title?: string; shareable?: boolean },
): Promise<CollectionConditionsSourceSummary | null> {
  const sources = await listCollectionConditionSources(graphql, collectionId);
  return (
    sources.find((s) => {
      if (opts.sourceId && s.id !== opts.sourceId) return false;
      if (opts.title && s.title !== opts.title) return false;
      if (opts.shareable !== undefined && s.shareable !== opts.shareable) return false;
      return true;
    }) ?? null
  );
}

export interface SourceInclusionState {
  matchType: "ALL" | "ANY" | null;
  conditionIds: string[];
  /** Recreate-ready condition payloads (for shareable source create / clone). */
  conditions: InclusionCondition[];
  selections: ProductSelection[];
}

export async function readSourceInclusion(
  graphql: Gql,
  collectionId: string,
  sourceId: string,
): Promise<SourceInclusionState> {
  const res = await graphql(GET_COLLECTION_SOURCES, { variables: { collectionId } });
  const body = (await res.json()) as {
    data?: { collection?: { sources?: RawConditionsSource[] } | null };
  };
  const sources = parseCollectionSourcesBody(body);
  const source = sources.find((s) => s.id === sourceId);
  if (!source?.inclusion) {
    throw new Error(
      `Source ${sourceId} is no longer on collection ${collectionId} — it was likely deleted in Admin. Start over from Step 1 (or Reset the workshop) to rebuild it.`,
    );
  }
  return inclusionFromSource(source);
}

/** Clone a collection-owned source into create-shareable-source input. */
export async function cloneSourceInclusion(
  graphql: Gql,
  opts: { collectionId: string; sourceId: string },
): Promise<SourceFields> {
  const res = await graphql(GET_COLLECTION_SOURCES, {
    variables: { collectionId: opts.collectionId },
  });
  const body = (await res.json()) as {
    data?: { collection?: { sources?: RawConditionsSource[] } | null };
  };
  const source = parseCollectionSourcesBody(body).find((s) => s.id === opts.sourceId);
  if (!source?.title || !source.inclusion) {
    throw new Error(`Source ${opts.sourceId} not found on collection ${opts.collectionId}`);
  }
  const state = inclusionFromSource(source);
  return {
    title: source.title,
    targetType: source.targetType ?? "PRODUCTS",
    matchType: state.matchType ?? (state.conditions.length ? "ALL" : "ANY"),
    ...(state.conditions.length ? { conditions: state.conditions } : {}),
    ...(state.selections.length ? { selections: state.selections } : {}),
  };
}

function selectionInputs(selections: ProductSelection[]) {
  return selections.map((s) => ({
    productId: s.productId,
    ...(s.variantIds?.length ? { variantIds: s.variantIds } : {}),
  }));
}

/** Swap a source to declarative conditions (removes manual selections, replaces conditions). */
export async function setSourceToConditions(
  graphql: Gql,
  opts: {
    collectionId: string;
    sourceId: string;
    matchType?: "ALL" | "ANY";
    conditions: InclusionCondition[];
  },
) {
  const current = await readSourceInclusion(graphql, opts.collectionId, opts.sourceId);
  const inclusion: CollectionUpdateInclusionPatch = {
    matchType: opts.matchType ?? "ALL",
    conditionsToCreate: opts.conditions,
    ...(current.conditionIds.length ? { conditionsToDelete: current.conditionIds } : {}),
    ...(current.selections.length
      ? { selectionsToRemove: selectionInputs(current.selections) }
      : {}),
  };
  await runMutation(
    graphql,
    UPDATE_COLLECTION_SOURCE,
    updateSourceInput({ collectionId: opts.collectionId, sourceId: opts.sourceId, inclusion }),
  );
}

/** Swap a source to explicit product selections (removes conditions, replaces selections). */
export async function setSourceToSelections(
  graphql: Gql,
  opts: {
    collectionId: string;
    sourceId: string;
    matchType?: "ALL" | "ANY";
    selections: ProductSelection[];
  },
) {
  const current = await readSourceInclusion(graphql, opts.collectionId, opts.sourceId);
  const inclusion: CollectionUpdateInclusionPatch = {
    matchType: opts.matchType ?? "ANY",
    selectionsToAdd: selectionInputs(opts.selections),
    ...(current.conditionIds.length ? { conditionsToDelete: current.conditionIds } : {}),
    ...(current.selections.length
      ? { selectionsToRemove: selectionInputs(current.selections) }
      : {}),
  };
  await runMutation(
    graphql,
    UPDATE_COLLECTION_SOURCE,
    updateSourceInput({ collectionId: opts.collectionId, sourceId: opts.sourceId, inclusion }),
  );
}

// --- Read back just `shareable` for a source, so callers can skip an unneeded
// publish/unpublish swap when the live value already matches the target. ---------
export async function getSourceShareable(
  graphql: Gql,
  collectionId: string,
  sourceId: string,
): Promise<boolean | null> {
  const source = await findSourceOnCollection(graphql, collectionId, { sourceId });
  return source?.shareable ?? null;
}

// --- App-owned shareable sources (collectionConditionsSourceCreate / Delete) ---
// Creating via this mutation always yields shareable:true. Link with shareableSource.
export const CREATE_SHAREABLE_SOURCE = `#graphql
  mutation CreateShareableSource($input: CollectionCreateConditionsSourceInput!) {
    collectionConditionsSourceCreate(input: $input) {
      source { id title shareable }
      userErrors { field message }
    }
  }
`;

export function createShareableSourceInput(spec: SourceFields) {
  return { input: sourceFieldsInput(spec) };
}

export async function createShareableSource(
  graphql: Gql,
  spec: SourceFields,
): Promise<{ id: string; title: string; shareable: boolean }> {
  const data = await runMutation(
    graphql,
    CREATE_SHAREABLE_SOURCE,
    createShareableSourceInput(spec),
  );
  const source = (data as any)?.collectionConditionsSourceCreate?.source;
  if (!source?.id) throw new Error("collectionConditionsSourceCreate did not return a source id.");
  return source;
}

export const LINK_SHAREABLE_SOURCE = `#graphql
  mutation LinkShareableSource($collection: CollectionUpdateInput!) {
    collectionUpdate(collection: $collection) {
      collection { id sources { __typename id title } }
      userErrors { field message }
    }
  }
`;

export function linkShareableSourceInput(opts: { collectionId: string; sourceId: string }) {
  return {
    collection: {
      id: opts.collectionId,
      sourcesToCreate: [{ shareableSource: { sourceId: opts.sourceId } }],
    },
  };
}

export async function linkShareableSource(
  graphql: Gql,
  opts: { collectionId: string; sourceId: string },
) {
  return runMutation(graphql, LINK_SHAREABLE_SOURCE, linkShareableSourceInput(opts));
}

export const DELETE_SHAREABLE_SOURCE = `#graphql
  mutation DeleteShareableSource($id: ID!) {
    collectionConditionsSourceDelete(id: $id) {
      deletedId
      userErrors { field message }
    }
  }
`;

/** Deletes an app-owned shareable source and auto-detaches it from every collection. */
export async function deleteShareableSource(graphql: Gql, sourceId: string) {
  return runMutation(graphql, DELETE_SHAREABLE_SOURCE, { id: sourceId });
}

// --- Remove a collection-owned source (or unlink) via sourcesToDelete ------------
export const REMOVE_COLLECTION_SOURCES = `#graphql
  mutation RemoveCollectionSources($collection: CollectionUpdateInput!) {
    collectionUpdate(collection: $collection) {
      collection { id sources { __typename id title } }
      userErrors { field message }
    }
  }
`;

export function removeSourcesInput(opts: { collectionId: string; sourceIds: string[] }) {
  return { collection: { id: opts.collectionId, sourcesToDelete: opts.sourceIds } };
}

import { throwIfGraphqlErrors, throwIfUserErrors } from "~/lib/shopify-errors.server";

export async function runMutation(graphql: Gql, query: string, variables: Record<string, unknown>) {
  const res = await graphql(query, { variables });
  const body = (await res.json()) as {
    data?: Record<string, { userErrors?: { field: string[]; message: string; code?: string }[] }>;
    errors?: { message: string }[];
  };
  throwIfGraphqlErrors(body.errors);
  const opName = body.data ? Object.keys(body.data)[0] : "mutation";
  const op = body.data ? Object.values(body.data)[0] : undefined;
  throwIfUserErrors(opName ?? "mutation", op?.userErrors);
  if (!body.data) {
    throw new Error("Shopify Admin API returned no data for this mutation.");
  }
  return body.data;
}

// Condition helpers (relations confirmed against schema).
export const decimalGreaterThan = (definitionId: string, value: string): InclusionCondition => ({
  metafieldDecimal: { definitionId, relation: "GREATER_THAN", value },
});
export const booleanEquals = (definitionId: string, value: boolean): InclusionCondition => ({
  metafieldBoolean: { definitionId, relation: "EQUALS", value },
});
// String conditions take a list of values + a matchType (not a scalar value).
export const stringEquals = (definitionId: string, value: string): InclusionCondition => ({
  metafieldString: { definitionId, relation: "EQUALS", matchType: "ANY", values: [value] },
});
