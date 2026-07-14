import { useState, type ReactNode } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Icon,
  InlineGrid,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { CheckCircleIcon, CodeIcon, PersonIcon } from "@shopify/polaris-icons";
import type { StepVisualStatus } from "~/components/BuildPathProgress";
import { PromptCopyPopover } from "~/components/PromptCopyPopover";
import type { StepRoute } from "~/features/route.server";
import { FEATURE_BY_KEY, type FeatureDef, type FeatureKey } from "~/features/registry";

export type StepIntent = "complete-prompt" | "reset" | "skip";

interface BuildPathStepProps {
  feature: FeatureDef;
  status: StepVisualStatus;
  on: boolean;
  route: StepRoute | null;
  blocked: FeatureKey[];
  pending: boolean;
  pendingKey: FeatureKey | null;
  pendingIntent: StepIntent | null;
  openPromptKey: FeatureKey | null;
  onOpenPrompt: (key: FeatureKey | null) => void;
  onSubmitIntent: (key: FeatureKey, intent: StepIntent) => void;
  onCopyPrompt: (feature: FeatureDef) => void;
}

function stepPromptText(f: FeatureDef): string {
  return f.actor === "app" ? f.aiPrompt : f.sidekickPrompt;
}

function StepPromptPopover({
  feature: f,
  openPromptKey,
  pending,
  onOpenPrompt,
  onCopyPrompt,
}: {
  feature: FeatureDef;
  openPromptKey: FeatureKey | null;
  pending: boolean;
  onOpenPrompt: (key: FeatureKey | null) => void;
  onCopyPrompt: (feature: FeatureDef) => void;
}) {
  const isApp = f.actor === "app";
  return (
    <PromptCopyPopover
      open={openPromptKey === f.key}
      onOpenChange={(open) => onOpenPrompt(open ? f.key : null)}
      prompt={stepPromptText(f)}
      buttonLabel={isApp ? "View coding prompt" : "View Sidekick prompt"}
      helperText={
        isApp
          ? "Paste this into your coding agent (Cursor, Copilot, etc.) to build this step in the app."
          : "Open Sidekick in Shopify admin and paste this as-is."
      }
      fieldLabel={isApp ? "Coding agent prompt" : "Sidekick prompt"}
      disabled={pending}
      onCopy={() => onCopyPrompt(f)}
    />
  );
}

function StartOverButton({
  featureKey,
  pending,
  pendingKey,
  pendingIntent,
  onSubmitIntent,
}: {
  featureKey: FeatureKey;
  pending: boolean;
  pendingKey: FeatureKey | null;
  pendingIntent: StepIntent | null;
  onSubmitIntent: (key: FeatureKey, intent: StepIntent) => void;
}) {
  return (
    <Button
      variant="plain"
      size="slim"
      onClick={() => onSubmitIntent(featureKey, "reset")}
      loading={pending && pendingKey === featureKey && pendingIntent === "reset"}
      disabled={pending}
    >
      Start over
    </Button>
  );
}

function StepActions(props: BuildPathStepProps) {
  const {
    feature: f,
    on,
    blocked,
    pending,
    pendingKey,
    pendingIntent,
    openPromptKey,
    onOpenPrompt,
    onSubmitIntent,
    onCopyPrompt,
  } = props;
  const disabled = pending || blocked.length > 0;

  if (on) {
    return (
      <StartOverButton
        featureKey={f.key}
        pending={pending}
        pendingKey={pendingKey}
        pendingIntent={pendingIntent}
        onSubmitIntent={onSubmitIntent}
      />
    );
  }

  return (
    <InlineStack gap="200" wrap>
      <StepPromptPopover
        feature={f}
        openPromptKey={openPromptKey}
        pending={pending}
        onOpenPrompt={onOpenPrompt}
        onCopyPrompt={onCopyPrompt}
      />
      <Button
        variant="primary"
        onClick={() => onSubmitIntent(f.key, "complete-prompt")}
        loading={pending && pendingKey === f.key && pendingIntent === "complete-prompt"}
        disabled={disabled}
      >
        Mark as done
      </Button>
      <Button
        variant="plain"
        onClick={() => onSubmitIntent(f.key, "skip")}
        loading={pending && pendingKey === f.key && pendingIntent === "skip"}
        disabled={disabled}
      >
        Skip to next step
      </Button>
    </InlineStack>
  );
}

function actorIcon(actor: FeatureDef["actor"]) {
  return actor === "merchant" ? PersonIcon : CodeIcon;
}

function StepShell({
  compact,
  active,
  children,
}: {
  compact?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      padding={compact ? "300" : "400"}
      {...(active
        ? {
            background: "bg-surface-secondary",
            borderInlineStartWidth: "025",
            borderColor: "border-emphasis",
            paddingInlineStart: "400",
          }
        : {})}
    >
      {children}
    </Box>
  );
}

function CompactStepLine({
  feature: f,
  tone,
  icon,
}: {
  feature: FeatureDef;
  tone?: "subdued" | undefined;
  icon: typeof CheckCircleIcon;
}) {
  return (
    <InlineGrid columns="20px 1fr" gap="300" alignItems="center">
      <Icon source={icon} tone={tone === "subdued" ? "subdued" : "success"} />
      <Text as="p" variant="bodyMd" tone={tone}>
        <Text as="span" variant="bodySm" tone="subdued">
          {`Step ${f.step} · `}
        </Text>
        {f.title}
      </Text>
    </InlineGrid>
  );
}

function StepMeta({ feature: f }: { feature: FeatureDef }) {
  return (
    <BlockStack gap="100">
      <InlineStack gap="200" blockAlign="center" wrap>
        <Badge>{`Step ${f.step}`}</Badge>
        <Badge tone={f.actor === "merchant" ? "info" : undefined}>
          {f.actor === "merchant" ? "Merchant" : "App"}
        </Badge>
      </InlineStack>
      <Text as="h3" variant="headingSm">
        {f.title}
      </Text>
    </BlockStack>
  );
}

export function BuildPathStep(props: BuildPathStepProps) {
  const {
    feature: f,
    status,
    on,
    blocked,
    openPromptKey,
    pending,
    onOpenPrompt,
    onCopyPrompt,
  } = props;
  const [expanded, setExpanded] = useState(false);

  if (status === "done") {
    return (
      <StepShell compact>
        <BlockStack gap="300">
          <InlineGrid columns="1fr auto" gap="400" alignItems="center">
            <CompactStepLine feature={f} icon={CheckCircleIcon} />
            <InlineStack gap="200" blockAlign="center">
              <Button
                variant="plain"
                size="slim"
                disclosure={expanded ? "up" : "down"}
                ariaExpanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Hide" : "Details"}
              </Button>
              <StepActions {...props} />
            </InlineStack>
          </InlineGrid>
          {expanded && (
            <Box paddingInlineStart="800">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  {f.summary}
                </Text>
                <InlineStack gap="200" wrap>
                  <StepPromptPopover
                    feature={f}
                    openPromptKey={openPromptKey}
                    pending={pending}
                    onOpenPrompt={onOpenPrompt}
                    onCopyPrompt={onCopyPrompt}
                  />
                </InlineStack>
                {f.note && <Banner tone="info">{f.note}</Banner>}
              </BlockStack>
            </Box>
          )}
        </BlockStack>
      </StepShell>
    );
  }

  if (status === "upcoming") {
    return (
      <StepShell compact>
        <CompactStepLine feature={f} tone="subdued" icon={actorIcon(f.actor)} />
      </StepShell>
    );
  }

  const isActive = status === "active";

  return (
    <StepShell active={isActive}>
      <BlockStack gap="300">
        <StepMeta feature={f} />
        <Text as="p" variant="bodyMd" tone="subdued">
          {f.summary}
        </Text>
        {status === "locked" && blocked.length > 0 && (
          <Text as="p" variant="bodySm" tone="caution">
            {`Finish ${blocked.map((b) => FEATURE_BY_KEY[b].title).join(", ")} first.`}
          </Text>
        )}
        {isActive && <StepActions {...props} />}
        {f.note && (isActive || on) && <Banner tone="info">{f.note}</Banner>}
      </BlockStack>
    </StepShell>
  );
}
