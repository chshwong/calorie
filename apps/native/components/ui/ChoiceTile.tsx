import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { colors, radius, spacing } from "../../theme/tokens";
import { useColorScheme } from "../useColorScheme";
import { Text } from "./Text";

type ChoiceTileProps = {
  title: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  accessibilityRole?: "button" | "radio";
  accessibilityState?: { selected?: boolean; disabled?: boolean };
};

export function ChoiceTile({
  title,
  selected,
  onPress,
  disabled,
  icon,
  accessibilityRole = "button",
  accessibilityState,
}: ChoiceTileProps) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected, disabled, ...accessibilityState }}
      android_ripple={{ color: "transparent" }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        pressed && styles.pressed,
        {
          backgroundColor: selected ? withAlpha(theme.primary, 0.16) : theme.card,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}
    >
      <View style={styles.content}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text variant="body" style={[styles.title, { color: theme.text }]}>
          {title}
        </Text>
      </View>
      {selected ? (
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
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  icon: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "600",
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
