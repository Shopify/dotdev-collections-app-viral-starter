import { BlockStack, Box, Button, InlineGrid, InlineStack, Text } from "@shopify/polaris";
import { FEATURES, FEATURE_BY_KEY, type FeatureKey } from "~/features/registry";

interface BuildPathProgressProps {
  isComplete: (key: FeatureKey) => boolean;
  currentKey: FeatureKey | null;
  onResetWorkshop?: () => void;
  resettingWorkshop?: boolean;
}

export function getCurrentStepKey(isComplete: (key: FeatureKey) => boolean): FeatureKey | null {
  for (const f of FEATURES) {
    if (!isComplete(f.key)) return f.key;
  }
  return null;
}

export type StepVisualStatus = "done" | "active" | "locked" | "upcoming";

export function getStepVisualStatus(
  key: FeatureKey,
  isComplete: (key: FeatureKey) => boolean,
  currentKey: FeatureKey | null,
): StepVisualStatus {
  if (isComplete(key)) return "done";
  if (key !== currentKey) return "upcoming";
  const blocked = FEATURE_BY_KEY[key].dependsOn.some((d) => !isComplete(d));
  return blocked ? "locked" : "active";
}

export function BuildPathProgress({
  isComplete,
  currentKey,
  onResetWorkshop,
  resettingWorkshop,
}: BuildPathProgressProps) {
  const done = FEATURES.filter((f) => isComplete(f.key)).length;
  const total = FEATURES.length;
  const current = currentKey ? FEATURE_BY_KEY[currentKey] : null;
  const allDone = done === total;

  return (
    <Box
      padding="400"
      background="bg-surface-secondary"
      borderRadius="300"
      borderWidth="025"
      borderColor="border-secondary"
    >
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <BlockStack gap="100">
            <Text as="p" variant="headingSm">
              {allDone
                ? "All steps complete"
                : current
                  ? `Up next — Step ${current.step}: ${current.title}`
                  : "Work through each step in order."}
            </Text>
            {allDone && (
              <Text as="p" variant="bodySm" tone="subdued">
                Open Go further for the take-home.
              </Text>
            )}
          </BlockStack>
          <Text as="span" variant="headingLg" fontWeight="bold">
            {`${done}/${total}`}
          </Text>
        </InlineStack>

        <InlineGrid columns={{ xs: total }} gap="100">
          {FEATURES.map((f) => {
            const status = getStepVisualStatus(f.key, isComplete, currentKey);
            const fill =
              status === "done"
                ? "bg-fill-success"
                : status === "active"
                  ? "bg-fill-emphasis"
                  : status === "locked"
                    ? "bg-fill-caution"
                    : "bg-surface-tertiary";

            return <Box key={f.key} minHeight="10px" borderRadius="100" background={fill} />;
          })}
        </InlineGrid>

        {onResetWorkshop && (
          <InlineStack align="end">
            <Button
              tone="critical"
              variant="plain"
              onClick={onResetWorkshop}
              loading={resettingWorkshop}
              disabled={resettingWorkshop}
            >
              Reset entire workshop
            </Button>
          </InlineStack>
        )}
      </BlockStack>
    </Box>
  );
}
