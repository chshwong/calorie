import React from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, radius, spacing } from "@/theme/tokens";

type OnboardingErrorBoxProps = {
  message: string;
};

export function OnboardingErrorBox({ message }: OnboardingErrorBoxProps) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  return (
    <View style={[styles.container, { borderColor: theme.danger, backgroundColor: withAlpha(theme.danger, 0.12) }]}>
      <Text variant="caption" tone="danger" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  text: {
    textAlign: "center",
  },
});

function withAlpha(color: string, alpha: number) {
  const normalized = color.replace("#", "");
  if (normalized.length !== 6) {
    return color;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
