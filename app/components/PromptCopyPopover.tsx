import { BlockStack, Box, Button, Popover, Scrollable, Text, TextField } from "@shopify/polaris";

export interface PromptCopyPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  /** Activator button label — opens the popover (does not copy by itself). */
  buttonLabel?: string;
  helperText?: string;
  fieldLabel?: string;
  disabled?: boolean;
  onCopy: () => void;
}

const DEFAULT_CODING_HELPER =
  "Paste this into your coding agent (Cursor, Copilot, etc.) to build this step in the app.";

/**
 * Shared copy-prompt UI used by build-path App steps and Go further.
 * Activator opens a popover; prompt text scrolls; Copy stays pinned at the bottom.
 */
export function PromptCopyPopover({
  open,
  onOpenChange,
  prompt,
  buttonLabel = "View coding prompt",
  helperText = DEFAULT_CODING_HELPER,
  fieldLabel = "Coding agent prompt",
  disabled = false,
  onCopy,
}: PromptCopyPopoverProps) {
  return (
    <Popover
      active={open}
      onClose={() => onOpenChange(false)}
      preferredPosition="below"
      preferredAlignment="left"
      activator={
        <Button onClick={() => onOpenChange(!open)} disabled={disabled}>
          {buttonLabel}
        </Button>
      }
    >
      <Box minWidth="320px" maxWidth="420px">
        <Popover.Section>
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" tone="subdued">
              {helperText}
            </Text>
            <Scrollable style={{ maxHeight: "220px" }} focusable>
              <TextField
                label={fieldLabel}
                labelHidden
                value={prompt}
                readOnly
                multiline={16}
                autoComplete="off"
              />
            </Scrollable>
            <Button variant="primary" onClick={onCopy}>
              Copy
            </Button>
          </BlockStack>
        </Popover.Section>
      </Box>
    </Popover>
  );
}
