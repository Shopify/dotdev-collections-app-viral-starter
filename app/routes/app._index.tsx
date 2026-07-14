import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData, useRevalidator } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Page,
  Layout,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  Button,
  List,
  Box,
  Card,
  Divider,
} from "@shopify/polaris";
import {
  BookIcon,
  ClipboardChecklistIcon,
  LightbulbIcon,
  PackageIcon,
} from "@shopify/polaris-icons";
import { useEffect, useRef, useState } from "react";
import { ActivitySection } from "~/components/ActivitySection";
import {
  BuildPathProgress,
  getCurrentStepKey,
  getStepVisualStatus,
} from "~/components/BuildPathProgress";
import { BuildPathStep, type StepIntent } from "~/components/BuildPathStep";
import { MissionCallout } from "~/components/MissionCallout";
import { PromptCopyPopover } from "~/components/PromptCopyPopover";
import {
  ACTIVITY_TITLE,
  ACTIVITY_SUBTITLE,
  OUTCOME,
  SUCCESS_CRITERIA,
  BLUEPRINT_INTRO,
  BLUEPRINT_TEASER,
  PARTS_INTRO,
  PARTS_TEASER,
  CATALOG_PART_TITLE,
  CATALOG_PART_DESCRIPTION,
  API_DOCS_TITLE,
  API_DOCS_DESCRIPTION,
  API_DOCS_LINKS,
  BUILD_PATH_INTRO,
  GO_FURTHER_TITLE,
  GO_FURTHER_TEASER,
  GO_FURTHER_BODY,
  GO_FURTHER_PROMPT,
  GO_FURTHER_PROMPT_HELPER,
  MISSION_TEASER,
} from "~/features/activity-content";
import { getFlags } from "~/features/flags.server";
import { provisionStep } from "~/features/provision.server";
import { retryStep, resetWorkshopExperience } from "~/features/reset-workshop.server";
import { getRoutes, setStepCompletion, type StepRoute } from "~/features/route.server";
import { FEATURES, FEATURE_BY_KEY, type FeatureDef, type FeatureKey } from "~/features/registry";
import { getProductCount, seedProducts, SEED_PRODUCTS } from "~/features/seed-products.server";
import { toActionError } from "~/lib/shopify-errors.server";
import { authenticate } from "~/shopify.server";

type SectionKey = "mission" | "blueprint" | "parts" | "goFurther";

const DEFAULT_SECTION_OPEN: Record<SectionKey, boolean> = {
  mission: true,
  blueprint: false,
  parts: true,
  goFurther: false,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const [flags, routes, productCount] = await Promise.all([
    getFlags(session.shop),
    getRoutes(session.shop),
    getProductCount(admin.graphql),
  ]);
  return json({
    flags,
    routes,
    productCount,
    seedCount: SEED_PRODUCTS.length,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "seed") {
    try {
      const results = await seedProducts({ shop: session.shop, graphql: admin.graphql });
      const failed = results.filter((r) => r.errors.length > 0);
      if (failed.length) {
        const userErrors = failed.flatMap((r) => r.errors.map((e) => `${r.title}: ${e.message}`));
        return json({
          kind: "seed" as const,
          ok: false as const,
          error: `Shopify userErrors while seeding ${failed.length} product(s)`,
          userErrors,
          created: results.length - failed.length,
        });
      }
      return json({ kind: "seed" as const, ok: true as const, created: results.length });
    } catch (e) {
      const err = toActionError(e);
      return json({
        kind: "seed" as const,
        ok: false as const,
        error: err.message,
        userErrors: err.userErrors,
      });
    }
  }

  if (intent === "reset-workshop") {
    try {
      const { warnings } = await resetWorkshopExperience({
        shop: session.shop,
        graphql: admin.graphql,
      });
      return json({ kind: "reset-workshop" as const, ok: true as const, warnings });
    } catch (e) {
      const err = toActionError(e);
      return json({
        kind: "reset-workshop" as const,
        ok: false as const,
        error: err.message,
        userErrors: err.userErrors,
      });
    }
  }

  const key = form.get("key") as FeatureKey;
  const stepIntent = intent as StepIntent;

  if (!FEATURE_BY_KEY[key]) {
    return json({
      kind: "step" as const,
      ok: false as const,
      key,
      error: "Unknown feature",
      userErrors: undefined as string[] | undefined,
    });
  }

  try {
    if (stepIntent === "complete-prompt") {
      // App steps: run the attendee's implementation, then mark progress.
      // Merchant steps: progress only (Sidekick work happens in admin).
      await provisionStep({
        shop: session.shop,
        graphql: admin.graphql,
        key,
        enabled: true,
      });
      await setStepCompletion(session.shop, key, { enabled: true, route: "prompt" });
    } else if (stepIntent === "skip") {
      // Advance the flow without running the attendee's implementation.
      await setStepCompletion(session.shop, key, { enabled: true, route: "prompt" });
    } else if (stepIntent === "reset") {
      await retryStep(session.shop, key, admin.graphql);
    } else {
      return json({
        kind: "step" as const,
        ok: false as const,
        key,
        error: "Unknown intent",
        userErrors: undefined as string[] | undefined,
      });
    }
    const enabled = stepIntent === "complete-prompt" || stepIntent === "skip";
    const route: StepRoute | null = enabled ? "prompt" : null;
    return json({
      kind: "step" as const,
      ok: true as const,
      key,
      enabled,
      route,
      skipped: stepIntent === "skip",
    });
  } catch (e) {
    const err = toActionError(e);
    return json({
      kind: "step" as const,
      ok: false as const,
      key,
      error: err.message,
      userErrors: err.userErrors,
    });
  }
};

type OptimisticPatch = { enabled?: boolean; route?: StepRoute | null };

function stepErrorTitle(message: string, userErrors?: string[]): string {
  if (/not implemented yet/i.test(message)) return "Step not implemented yet";
  if (/no longer exists|no longer on collection|deleted in Admin/i.test(message)) {
    return "Collection or source was deleted";
  }
  if (
    userErrors?.length ||
    /userErrors?|GraphQL error|Shopify rejected|Access denied|INVALID|TAKEN/i.test(message)
  ) {
    return "Shopify rejected the change";
  }
  return "Could not update";
}

function ErrorDetails({ message, userErrors }: { message: string; userErrors?: string[] | null }) {
  if (userErrors?.length) {
    return (
      <List type="bullet">
        {userErrors.map((line) => (
          <List.Item key={line}>{line}</List.Item>
        ))}
      </List>
    );
  }
  return <>{message}</>;
}

export default function Workshop() {
  const { flags, routes, productCount, seedCount } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const seeder = useFetcher<typeof action>();
  const workshopReset = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const buildPathRef = useRef<HTMLDivElement>(null);
  const handledStepResultRef = useRef<typeof fetcher.data>(undefined);
  const handledWorkshopResetRef = useRef<typeof workshopReset.data>(undefined);
  const [optimistic, setOptimistic] = useState<Partial<Record<FeatureKey, OptimisticPatch>>>({});
  const [openPromptKey, setOpenPromptKey] = useState<FeatureKey | null>(null);
  const [goFurtherPromptOpen, setGoFurtherPromptOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(DEFAULT_SECTION_OPEN);

  const toggleSection = (key: SectionKey) => {
    setSectionsOpen((current) => ({ ...current, [key]: !current[key] }));
  };

  const value = (k: FeatureKey): boolean => optimistic[k]?.enabled ?? flags[k];
  const routeValue = (k: FeatureKey): StepRoute | null => {
    const patch = optimistic[k];
    if (patch && "route" in patch) return patch.route ?? null;
    return routes[k] ?? null;
  };

  const pending = fetcher.state !== "idle";
  const pendingKey = (fetcher.formData?.get("key") as FeatureKey | null) ?? null;
  const pendingIntent = (fetcher.formData?.get("intent") as StepIntent | null) ?? null;
  const seeding = seeder.state !== "idle";

  const stepResult =
    fetcher.data && "kind" in fetcher.data && fetcher.data.kind === "step" ? fetcher.data : null;
  const seedResult =
    seeder.data && "kind" in seeder.data && seeder.data.kind === "seed" ? seeder.data : null;
  const workshopResetResult =
    workshopReset.data &&
    "kind" in workshopReset.data &&
    workshopReset.data.kind === "reset-workshop"
      ? workshopReset.data
      : null;
  const workshopWarnings =
    workshopResetResult?.ok === true && workshopResetResult.warnings?.length
      ? workshopResetResult.warnings
      : null;

  let actionError: { message: string; userErrors?: string[] } | null = null;
  if (stepResult && !stepResult.ok) {
    actionError = {
      message: stepResult.error,
      userErrors: Array.isArray(stepResult.userErrors) ? stepResult.userErrors : undefined,
    };
  } else if (workshopResetResult && !workshopResetResult.ok) {
    actionError = {
      message: workshopResetResult.error,
      userErrors: Array.isArray(workshopResetResult.userErrors)
        ? workshopResetResult.userErrors
        : undefined,
    };
  } else if (seedResult && !seedResult.ok) {
    actionError = {
      message: seedResult.error ?? "Seed failed",
      userErrors: Array.isArray(seedResult.userErrors) ? seedResult.userErrors : undefined,
    };
  }

  const catalogReady = productCount > 0;
  const currentStepKey = getCurrentStepKey(value);

  useEffect(() => {
    if (catalogReady) {
      setSectionsOpen((current) => ({ ...current, parts: false }));
    }
  }, [catalogReady]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !stepResult) return;
    if (handledStepResultRef.current === fetcher.data) return;
    handledStepResultRef.current = fetcher.data;

    if (stepResult.ok) {
      const f = FEATURE_BY_KEY[stepResult.key];
      const wasRetry = !stepResult.enabled && stepResult.route === null;
      const wasSkip = "skipped" in stepResult && stepResult.skipped;
      const msg = wasSkip
        ? `${f.title} skipped`
        : wasRetry
          ? `${f.title} — ready to start over`
          : stepResult.enabled
            ? `${f.title} complete`
            : `${f.title} updated`;
      shopify.toast.show(msg);
      setOptimistic((o) => ({
        ...o,
        [stepResult.key]: {
          enabled: stepResult.enabled,
          route: stepResult.route ?? null,
        },
      }));
      revalidator.revalidate();
    } else if (stepResult.key) {
      const key = stepResult.key;
      setOptimistic((o) => {
        const next = { ...o };
        delete next[key];
        return next;
      });
      const userErrors = Array.isArray(stepResult.userErrors) ? stepResult.userErrors : undefined;
      const detail = userErrors?.length ? userErrors.join("; ") : stepResult.error;
      shopify.toast.show(detail, { isError: true });
    }
  }, [fetcher.state, fetcher.data, stepResult, shopify, revalidator]);

  useEffect(() => {
    setOptimistic((o) => {
      let changed = false;
      const next = { ...o };
      for (const key of Object.keys(next) as FeatureKey[]) {
        const patch = next[key];
        if (!patch) continue;
        const flagOk = patch.enabled === undefined || patch.enabled === flags[key];
        const routeOk = !("route" in patch) || (patch.route ?? null) === (routes[key] ?? null);
        if (flagOk && routeOk) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : o;
    });
  }, [flags, routes]);

  useEffect(() => {
    if (workshopReset.state !== "idle" || !workshopResetResult) return;
    if (handledWorkshopResetRef.current === workshopReset.data) return;
    handledWorkshopResetRef.current = workshopReset.data;

    if (workshopResetResult.ok) {
      setOptimistic({});
      setOpenPromptKey(null);
      revalidator.revalidate();
      if (workshopResetResult.warnings?.length) {
        shopify.toast.show("Workshop reset — some Shopify cleanup had warnings");
      } else {
        shopify.toast.show("Workshop reset — start from the top");
      }
    }
  }, [workshopReset.state, workshopReset.data, workshopResetResult, shopify, revalidator]);

  const submitIntent = (key: FeatureKey, intent: StepIntent) => {
    if (intent === "reset") {
      // Start over from this step: optimistically clear it and every step after
      // it (the server cascades the same way).
      const startIndex = FEATURES.findIndex((f) => f.key === key);
      setOptimistic((o) => {
        const next = { ...o };
        for (const f of FEATURES.slice(startIndex)) {
          next[f.key] = { enabled: false, route: null };
        }
        return next;
      });
    } else {
      const patch: OptimisticPatch = { enabled: true, route: "prompt" };
      setOptimistic((o) => ({ ...o, [key]: patch }));
    }
    fetcher.submit({ intent, key }, { method: "POST" });
  };

  const copyPrompt = (f: FeatureDef) => {
    const text = f.actor === "app" ? f.aiPrompt : f.sidekickPrompt;
    navigator.clipboard.writeText(text);
    shopify.toast.show(f.actor === "app" ? "Coding prompt copied" : "Sidekick prompt copied");
    setOpenPromptKey(null);
  };

  const copyTakehomePrompt = () => {
    navigator.clipboard.writeText(GO_FURTHER_PROMPT);
    shopify.toast.show("Coding prompt copied");
    setGoFurtherPromptOpen(false);
  };

  const openStepPrompt = (key: FeatureKey | null) => {
    setGoFurtherPromptOpen(false);
    setOpenPromptKey(key);
  };

  const openGoFurtherPrompt = (open: boolean) => {
    if (open) setOpenPromptKey(null);
    setGoFurtherPromptOpen(open);
  };

  const resetWorkshop = () => {
    workshopReset.submit({ intent: "reset-workshop" }, { method: "POST" });
  };

  const resettingWorkshop = workshopReset.state !== "idle";

  const scrollToBuildPath = () => {
    setSectionsOpen((current) => ({ ...current, mission: false }));
    requestAnimationFrame(() => {
      buildPathRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const stepProps = (key: FeatureKey) => {
    const f = FEATURE_BY_KEY[key];
    const on = value(key);
    const blocked = f.dependsOn.filter((d) => !value(d));
    const route = routeValue(key);

    return {
      feature: f,
      status: getStepVisualStatus(key, value, currentStepKey),
      on,
      route,
      blocked,
      pending,
      pendingKey,
      pendingIntent,
      openPromptKey,
      onOpenPrompt: openStepPrompt,
      onSubmitIntent: submitIntent,
      onCopyPrompt: copyPrompt,
    };
  };

  return (
    <Page title={ACTIVITY_TITLE} subtitle={ACTIVITY_SUBTITLE}>
      <Layout>
        {actionError && (
          <Layout.Section>
            <Banner
              tone="critical"
              title={stepErrorTitle(actionError.message, actionError.userErrors)}
            >
              <ErrorDetails message={actionError.message} userErrors={actionError.userErrors} />
            </Banner>
          </Layout.Section>
        )}

        {workshopWarnings && (
          <Layout.Section>
            <Banner tone="warning" title="Workshop reset — partial Shopify cleanup">
              <List type="bullet">
                {workshopWarnings.map((w) => (
                  <List.Item key={w}>{w}</List.Item>
                ))}
              </List>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <ActivitySection
            id="mission"
            title="Mission"
            teaser={MISSION_TEASER}
            icon={BookIcon}
            open={sectionsOpen.mission}
            onToggle={() => toggleSection("mission")}
          >
            <MissionCallout onStartBuildPath={scrollToBuildPath} />
          </ActivitySection>
        </Layout.Section>

        <Layout.Section>
          <ActivitySection
            id="blueprint"
            title="Blueprint"
            teaser={BLUEPRINT_TEASER}
            icon={ClipboardChecklistIcon}
            open={sectionsOpen.blueprint}
            onToggle={() => toggleSection("blueprint")}
          >
            <Text as="p" variant="bodySm" tone="subdued">
              {BLUEPRINT_INTRO}
            </Text>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Outcome
              </Text>
              {OUTCOME.split("\n\n").map((paragraph) => (
                <Text key={paragraph.slice(0, 24)} as="p" variant="bodyMd" tone="subdued">
                  {paragraph}
                </Text>
              ))}
            </BlockStack>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Success criteria
              </Text>
              <List type="bullet">
                {SUCCESS_CRITERIA.map((criterion) => (
                  <List.Item key={criterion}>{criterion}</List.Item>
                ))}
              </List>
            </BlockStack>
          </ActivitySection>
        </Layout.Section>

        <Layout.Section>
          <ActivitySection
            id="parts"
            title="Parts"
            teaser={PARTS_TEASER}
            icon={PackageIcon}
            open={sectionsOpen.parts}
            onToggle={() => toggleSection("parts")}
            accessory={
              <Badge tone={catalogReady ? "success" : "attention"}>
                {catalogReady ? "Catalog ready" : "Seed needed"}
              </Badge>
            }
          >
            <Text as="p" variant="bodyMd" tone="subdued">
              {PARTS_INTRO}
            </Text>

            <Box
              padding="400"
              background="bg-surface-secondary"
              borderRadius="200"
              borderWidth="025"
              borderColor="border-secondary"
            >
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {CATALOG_PART_TITLE}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {`${seedCount} products — ${CATALOG_PART_DESCRIPTION}`}
                  </Text>
                </BlockStack>
                {seedResult?.ok === true && "created" in seedResult && (
                  <Banner tone="success">{`Created ${seedResult.created} products.`}</Banner>
                )}
                <seeder.Form method="post">
                  <input type="hidden" name="intent" value="seed" />
                  <Button submit loading={seeding} disabled={seeding} variant="primary">
                    Seed sample products
                  </Button>
                </seeder.Form>
              </BlockStack>
            </Box>

            <Box
              padding="400"
              background="bg-surface-secondary"
              borderRadius="200"
              borderWidth="025"
              borderColor="border-secondary"
            >
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {API_DOCS_TITLE}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {API_DOCS_DESCRIPTION}
                </Text>
                <InlineStack gap="200" wrap>
                  {API_DOCS_LINKS.map((link) => (
                    <Button key={link.url} url={link.url} target="_blank">
                      {link.label}
                    </Button>
                  ))}
                </InlineStack>
              </BlockStack>
            </Box>
          </ActivitySection>
        </Layout.Section>

        <Layout.Section>
          <div ref={buildPathRef} id="build-path-anchor">
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Build path
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {BUILD_PATH_INTRO}
                </Text>
              </BlockStack>

              <BuildPathProgress
                isComplete={value}
                currentKey={currentStepKey}
                onResetWorkshop={resetWorkshop}
                resettingWorkshop={resettingWorkshop}
              />

              <Card padding="0">
                <BlockStack gap="0">
                  {FEATURES.map((f, index) => (
                    <Box key={f.key}>
                      <BuildPathStep {...stepProps(f.key)} />
                      {index < FEATURES.length - 1 && <Divider />}
                    </Box>
                  ))}
                </BlockStack>
              </Card>
            </BlockStack>
          </div>
        </Layout.Section>

        <Layout.Section>
          <ActivitySection
            id="go-further"
            title={GO_FURTHER_TITLE}
            teaser={GO_FURTHER_TEASER}
            icon={LightbulbIcon}
            open={sectionsOpen.goFurther}
            onToggle={() => toggleSection("goFurther")}
          >
            {GO_FURTHER_BODY.split("\n\n").map((paragraph) => (
              <Text key={paragraph.slice(0, 24)} as="p" variant="bodyMd" tone="subdued">
                {paragraph}
              </Text>
            ))}
            <InlineStack gap="200" wrap>
              <PromptCopyPopover
                open={goFurtherPromptOpen}
                onOpenChange={openGoFurtherPrompt}
                prompt={GO_FURTHER_PROMPT}
                helperText={GO_FURTHER_PROMPT_HELPER}
                onCopy={copyTakehomePrompt}
              />
            </InlineStack>
          </ActivitySection>
        </Layout.Section>

        <Layout.Section>
          <Box paddingBlockEnd="800" />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
