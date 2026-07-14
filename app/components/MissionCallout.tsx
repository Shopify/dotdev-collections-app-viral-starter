import { BlockStack, Button, Card, InlineStack, Text } from "@shopify/polaris";
import { MISSION, MISSION_PULL_QUOTE, MISSION_THESIS } from "~/features/activity-content";

interface MissionCalloutProps {
  onStartBuildPath: () => void;
}

export function MissionCallout({ onStartBuildPath }: MissionCalloutProps) {
  const bodyParagraphs = MISSION.split("\n\n");

  return (
    <Card>
      <BlockStack gap="300">
        <BlockStack gap="200">
          {bodyParagraphs.map((paragraph) => (
            <Text key={paragraph.slice(0, 24)} as="p" variant="bodyMd" tone="subdued">
              {paragraph}
            </Text>
          ))}
        </BlockStack>
        <BlockStack gap="100">
          <Text as="p" variant="headingMd">
            {MISSION_PULL_QUOTE}
          </Text>
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {MISSION_THESIS}
          </Text>
        </BlockStack>
        <InlineStack>
          <Button variant="primary" onClick={onStartBuildPath}>
            Start build path
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
