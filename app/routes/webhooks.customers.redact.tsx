import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

// GDPR: erase a specific customer's data. Viral holds no customer-level data,
// so there is nothing to delete. HMAC is verified by authenticate.webhook.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} for ${shop}: no customer data to redact.`);
  return new Response();
};
