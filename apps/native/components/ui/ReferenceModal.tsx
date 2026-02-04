import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "../../theme/tokens";
import { Text } from "./Text";
import { useColorScheme } from "../useColorScheme";

type ReferenceModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  closeLabel: string;
};

export function ReferenceModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
  contentStyle,
  closeLabel,
}: ReferenceModalProps) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.background }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.safeAreaContent}>
          <View style={styles.overlay}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
            <View style={[styles.modal, { backgroundColor: theme.card, borderColor: theme.border }, contentStyle]}>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text variant="title">{title}</Text>
                  {subtitle ? (
                    <Text variant="caption" tone="muted">
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  onPress={onClose}
                  style={[styles.closeButton, { borderColor: theme.border }]}
                >
                  <Feather name="x" size={18} color={theme.text} />
                </Pressable>
              </View>
              <ScrollView
                contentInsetAdjustmentBehavior={Platform.OS === "ios" ? "never" : undefined}
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: spacing.lg + insets.bottom },
                ]}
              >
                {children}
              </ScrollView>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaContent: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    gap: spacing.md,
  },
});
