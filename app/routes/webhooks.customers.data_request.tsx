import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

// GDPR: a customer (via a store) requests the data you hold on them.
// Viral stores no customer PII — only per-shop sessions and the app's own
// collection/source records — so there is nothing to return. We still verify
// the HMAC (authenticate.webhook throws 401 on an invalid signature) and ack.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} for ${shop}: no customer data stored.`);
  return new Response();
};
