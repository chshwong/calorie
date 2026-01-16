import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { colors, radius, spacing } from "../../theme/tokens";
import { useColorScheme } from "../useColorScheme";
import { Text } from "./Text";

type ChoiceTileProps = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: "default" | "compact";
  showCheck?: boolean;
  style?: ViewStyle;
  accessibilityRole?: "button" | "radio";
  accessibilityState?: { selected?: boolean; disabled?: boolean };
};

export function ChoiceTile({
  title,
  description,
  selected,
  onPress,
  disabled,
  icon,
  variant = "default",
  showCheck = true,
  style,
  accessibilityRole = "button",
  accessibilityState,
}: ChoiceTileProps) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const isCompact = variant === "compact";

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected, disabled, ...accessibilityState }}
      android_ripple={{ color: "transparent" }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        isCompact && styles.tileCompact,
        pressed && styles.pressed,
        {
          backgroundColor: selected ? withAlpha(theme.primary, 0.16) : theme.card,
          borderColor: selected ? theme.primary : theme.border,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <View style={styles.textBlock}>
          <Text variant="body" style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
          {description ? (
            <Text variant="caption" tone="muted" style={styles.description}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      {showCheck && selected ? (
        <View style={styles.checkWrap}>
          <Feather name="check" size={16} color={theme.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    minHeight: spacing.xxl + spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tileCompact: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: spacing.xl + spacing.sm,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  icon: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "600",
  },
  description: {
    lineHeight: 16,
  },
  checkWrap: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.md,
  },
  pressed: {
    opacity: 0.92,
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
