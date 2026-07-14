/**
 * Format Shopify Admin GraphQL failures so Mark as done / seed banners are readable.
 * Prefer throwing via `throwIfUserErrors` from helpers; the home action also normalizes
 * any Error into a structured payload for the UI.
 */

export type ShopifyFieldError = {
  message: string;
  field?: string[] | null;
  code?: string | null;
};

export class ShopifyUserErrorsError extends Error {
  readonly operation: string;
  readonly userErrors: string[];

  constructor(operation: string, errors: ShopifyFieldError[]) {
    const lines = errors.map(formatOneUserError);
    super(
      lines.length === 1
        ? `Shopify userErrors on ${operation}: ${lines[0]}`
        : `Shopify userErrors on ${operation}:\n${lines.map((l) => `• ${l}`).join("\n")}`,
    );
    this.name = "ShopifyUserErrorsError";
    this.operation = operation;
    this.userErrors = lines;
  }
}

export class ShopifyGraphqlError extends Error {
  readonly messages: string[];

  constructor(messages: string[]) {
    super(
      messages.length === 1
        ? `Shopify GraphQL error: ${messages[0]}`
        : `Shopify GraphQL errors:\n${messages.map((m) => `• ${m}`).join("\n")}`,
    );
    this.name = "ShopifyGraphqlError";
    this.messages = messages;
  }
}

function formatOneUserError(e: ShopifyFieldError): string {
  const field = e.field?.filter(Boolean).join(".") || null;
  const code = e.code ? ` [${e.code}]` : "";
  if (field) return `${field}: ${e.message}${code}`;
  return `${e.message}${code}`;
}

/** Throw a clear Error when a mutation payload includes userErrors. */
export function throwIfUserErrors(
  operation: string,
  errors: ShopifyFieldError[] | null | undefined,
): void {
  if (!errors?.length) return;
  throw new ShopifyUserErrorsError(operation, errors);
}

/** Throw when the response has top-level GraphQL `errors` (syntax/auth/etc.). */
export function throwIfGraphqlErrors(errors: { message: string }[] | null | undefined): void {
  if (!errors?.length) return;
  throw new ShopifyGraphqlError(errors.map((e) => e.message));
}

export type ActionErrorPayload = {
  message: string;
  userErrors?: string[];
};

/** Normalize any thrown value for JSON action responses + banner UI. */
export function toActionError(e: unknown): ActionErrorPayload {
  if (e instanceof ShopifyUserErrorsError) {
    return { message: e.message, userErrors: e.userErrors };
  }
  if (e instanceof ShopifyGraphqlError) {
    return { message: e.message, userErrors: e.messages };
  }
  if (e instanceof Error) {
    // Attendee code may throw raw strings that already look like userErrors.
    const lines = e.message
      .split("\n")
      .map((l) => l.replace(/^[•\-\*]\s*/, "").trim())
      .filter(Boolean);
    const looksLikeShopify = /userErrors?|GraphQL error|Access denied|INVALID|TAKEN/i.test(
      e.message,
    );
    if (looksLikeShopify && lines.length > 1) {
      return { message: e.message, userErrors: lines.slice(1) };
    }
    return { message: e.message };
  }
  return { message: "Failed" };
}
