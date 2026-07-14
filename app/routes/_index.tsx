import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { login } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};

export default function Index() {
  return (
    <main style={{ fontFamily: "Inter, system-ui", padding: "2rem", maxWidth: 640 }}>
      <h1>Viral</h1>
      <p>DotDev 2026 workshop app — app-owned Collection Sources on Admin API 2026-07.</p>
      <p>Install on a dev store to begin. Open the app inside Shopify admin.</p>
    </main>
  );
}
