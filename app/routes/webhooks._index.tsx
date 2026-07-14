import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";

// Defensive catch-all for the bare `/webhooks` path. Per-topic webhooks are wired
// in shopify.app.toml to `/webhooks/<topic>` routes; this only exists so a stale
// registration (e.g. an older app version that pointed app/uninstalled at
// `/webhooks`) is acknowledged with 200 instead of a 404 stack trace.
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, session, topic } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop} on /webhooks (catch-all)`);
    if (topic === "APP_UNINSTALLED" && session) {
      await prisma.session.deleteMany({ where: { shop } });
      await prisma.shopFeature.deleteMany({ where: { shop } });
      await prisma.managedResource.deleteMany({ where: { shop } });
    }
  } catch (error) {
    // authenticate.webhook throws a Response on HMAC/parse failure. Swallow it so
    // stale or unverifiable deliveries don't surface as errors during the workshop.
    console.log("Ignoring unverifiable webhook on /webhooks (catch-all)", error);
  }
  return new Response();
};
