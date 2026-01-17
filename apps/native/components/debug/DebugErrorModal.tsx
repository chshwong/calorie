import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, radius, spacing } from "@/theme/tokens";

type DebugErrorModalProps = {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export function DebugErrorModal({
  visible,
  title = "Debug Error",
  message,
  onClose,
}: DebugErrorModalProps) {
  // Only render in DEV mode
  if (!__DEV__) {
    return null;
  }

  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text variant="title" style={styles.title}>
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { opacity: 0.7 },
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close debug modal"
          >
            <Feather name="x" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          <View
            style={[
              styles.messageContainer,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              selectable
              style={[
                styles.messageText,
                {
                  color: theme.text,
                  fontFamily: "monospace",
                },
              ]}
            >
              {message}
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Button title="Close" onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    flex: 1,
    fontWeight: "700",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  messageContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  messageText: {
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
});
