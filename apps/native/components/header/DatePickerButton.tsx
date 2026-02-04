import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useColorScheme } from "@/components/useColorScheme";
import { colors, radius, spacing } from "@/theme/tokens";

type DatePickerButtonProps = {
  selectedDate: Date;
  today: Date;
  minimumDate: Date;
  maximumDate: Date;
  onDateSelect: (next: Date | string) => void;
};

export function DatePickerButton({
  selectedDate,
  today,
  minimumDate,
  maximumDate,
  onDateSelect,
}: DatePickerButtonProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("home.date_picker.select_date")}
        onPress={() => setShowPicker(true)}
        style={[styles.button, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.iconWrap}>
          <Feather name="calendar" size={18} color={theme.text} />
        </View>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          textColor={Platform.OS === "ios" ? theme.text : undefined}
          minimumDate={minimumDate}
          maximumDate={maximumDate ?? today}
          onChange={(event, nextDate) => {
            const eventType = (event as any)?.type;
            if (eventType === "dismissed") {
              setShowPicker(false);
              return;
            }
            if (nextDate) {
              onDateSelect(nextDate);
            }
            if (Platform.OS !== "ios") {
              setShowPicker(false);
            }
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xs,
    minWidth: 36,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
