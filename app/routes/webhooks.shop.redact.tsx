import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";

// GDPR: 48h after a shop uninstalls, erase everything we hold for that shop.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} for ${shop}: erasing all shop data.`);
  await prisma.session.deleteMany({ where: { shop } });
  await prisma.shopFeature.deleteMany({ where: { shop } });
  await prisma.managedResource.deleteMany({ where: { shop } });
  return new Response();
};
