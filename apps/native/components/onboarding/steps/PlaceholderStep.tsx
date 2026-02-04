import React from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Text } from "../../ui/Text";
import { spacing } from "../../../theme/tokens";

type PlaceholderStepProps = {
  onBack: () => void;
};

export function PlaceholderStep({ onBack }: PlaceholderStepProps) {
  return (
    <>
      <Text variant="caption" tone="muted">
        Step 2 of 12
      </Text>
      <Text variant="title" style={styles.title}>
        Next step coming soon
      </Text>
      <Text tone="muted" style={styles.subtitle}>
        This step will be implemented in the next batch.
      </Text>
      <Card>
        <View style={styles.section}>
          <Text tone="muted" style={styles.centerText}>
            Thanks for your patience while we build the rest of onboarding.
          </Text>
          <Button title="Back" variant="secondary" onPress={onBack} />
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  section: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
});
