import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { colors, radius, spacing } from "../../theme/tokens";
import { useColorScheme } from "../useColorScheme";

type HeroCardProps = {
  children: React.ReactNode;
  size?: number;
  cornerRadius?: number;
  style?: ViewStyle;
};

export function HeroCard({
  children,
  size = 160,
  cornerRadius = radius.xl,
  style,
}: HeroCardProps) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  return (
    <View
      style={[
        styles.card,
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.text,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
});
