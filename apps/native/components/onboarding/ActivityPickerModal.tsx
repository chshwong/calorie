import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { ActivityStepContent } from "@/components/onboarding/ActivityStepContent";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { ActivityLevel } from "@/lib/validation/activity";
import { colors, radius, spacing } from "@/theme/tokens";

type ActivityPickerModalProps = {
  visible: boolean;
  value: ActivityLevel | "";
  loading: boolean;
  onCancel: () => void;
  onSave: (nextValue: ActivityLevel) => void;
};

export function ActivityPickerModal({
  visible,
  value,
  loading,
  onCancel,
  onSave,
}: ActivityPickerModalProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const [draftValue, setDraftValue] = useState<ActivityLevel | "">(value);

  useEffect(() => {
    if (visible) {
      setDraftValue(value);
    }
  }, [value, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button" />
        <View style={[styles.modal, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.header}>
            <Text variant="title">{t("onboarding.calorie_target.adjust_activity_link")}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <ActivityStepContent
              value={draftValue}
              onChange={setDraftValue}
              disabled={loading}
            />
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Button
              title={t("common.cancel")}
              variant="secondary"
              onPress={onCancel}
              disabled={loading}
            />
            <Button
              title={t("common.save")}
              onPress={() => {
                if (draftValue) {
                  onSave(draftValue);
                }
              }}
              disabled={loading || !draftValue}
              loading={loading}
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    width: "100%",
    maxWidth: 440,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    alignItems: "center",
  },
  scrollContent: {
    gap: spacing.lg,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
});
