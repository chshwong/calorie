import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../theme/tokens";
import { useColorScheme } from "../useColorScheme";
import { Button } from "./Button";
import { Text } from "./Text";

type ConfirmModalProps = {
  visible: boolean;
  title?: string;
  message: string;
  cancelText: string;
  confirmText: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmVariant?: "primary" | "destructive";
  allowDismiss?: boolean;
};

export function ConfirmModal({
  visible,
  title,
  message,
  cancelText,
  confirmText,
  onCancel,
  onConfirm,
  confirmVariant = "primary",
  allowDismiss = true,
}: ConfirmModalProps) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const confirmButtonStyle =
    confirmVariant === "destructive"
      ? { backgroundColor: theme.danger, borderColor: theme.danger }
      : undefined;
  const confirmTitleProps =
    confirmVariant === "destructive"
      ? { style: { color: theme.dangerText } }
      : undefined;

  const handleRequestClose = () => {
    if (allowDismiss) {
      onCancel();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={handleRequestClose}
          accessibilityRole="button"
        />
        <View
          style={[
            styles.container,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          accessibilityViewIsModal
        >
          {title ? (
            <Text variant="label" style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          <Text tone="muted" style={styles.message}>
            {message}
          </Text>
          <View style={styles.actions}>
            <Button title={cancelText} variant="secondary" onPress={onCancel} />
            <Button
              title={confirmText}
              onPress={onConfirm}
              style={confirmButtonStyle}
              titleProps={confirmTitleProps}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    textAlign: "center",
  },
  message: {
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
});
