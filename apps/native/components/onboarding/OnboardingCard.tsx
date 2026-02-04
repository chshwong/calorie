import React from "react";
import { StyleSheet } from "react-native";

import { Card, CardProps } from "../ui/Card";
import { useColorScheme } from "../useColorScheme";
import { colors, radius, spacing } from "../../theme/tokens";

type OnboardingCardProps = CardProps;

export function OnboardingCard({ style, ...props }: OnboardingCardProps) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  return <Card style={[styles.card, { shadowColor: theme.text }, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg + 4,
    borderWidth: 0,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
});
