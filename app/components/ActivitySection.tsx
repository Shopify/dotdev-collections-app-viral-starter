import { BlockStack, Button, Card, Collapsible, Icon, InlineStack, Text } from "@shopify/polaris";
import type { IconSource } from "@shopify/polaris";
import type { ReactNode } from "react";

interface ActivitySectionProps {
  id: string;
  title: string;
  teaser?: string;
  icon?: IconSource;
  open: boolean;
  onToggle: () => void;
  accessory?: ReactNode;
  children: ReactNode;
}

export function ActivitySection({
  id,
  title,
  teaser,
  icon,
  open,
  onToggle,
  accessory,
  children,
}: ActivitySectionProps) {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <InlineStack gap="200" blockAlign="center" wrap={false}>
            {icon && <Icon source={icon} tone="base" />}
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                {title}
              </Text>
              {!open && teaser && (
                <Text as="p" variant="bodySm" tone="subdued">
                  {teaser}
                </Text>
              )}
            </BlockStack>
          </InlineStack>
          <InlineStack gap="200" blockAlign="center" wrap={false}>
            {accessory}
            <Button
              variant="plain"
              onClick={onToggle}
              ariaExpanded={open}
              ariaControls={`${id}-content`}
            >
              {open ? "Hide" : "Show"}
            </Button>
          </InlineStack>
        </InlineStack>
        <Collapsible id={`${id}-content`} open={open}>
          <BlockStack gap="300">{children}</BlockStack>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}
