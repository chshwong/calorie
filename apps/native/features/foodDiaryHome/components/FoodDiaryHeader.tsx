import { useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, spacing } from "@/theme/tokens";

type FoodDiaryHeaderProps = {
  selectedDate: Date;
  today: Date;
  minDate: Date;
  isToday: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onSelectDate: (next: Date | string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
};

export function FoodDiaryHeader({
  selectedDate,
  today,
  minDate,
  isToday,
  canGoBack,
  canGoForward,
  onSelectDate,
  onGoBack,
  onGoForward,
}: FoodDiaryHeaderProps) {
  const { t, i18n } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const [showPicker, setShowPicker] = useState(false);

  const locale = i18n.language === "fr" ? "fr-FR" : "en-US";
  const dateLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [locale, selectedDate]
  );

  const titleKey = isToday ? "home.summary.title_today" : "home.summary.title_other";

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text variant="title">{t(titleKey)}</Text>
          <Text tone="muted">{dateLabel}</Text>
        </View>
        <Button
          title={t("home.date_picker.select_date")}
          variant="secondary"
          onPress={() => setShowPicker(true)}
        />
      </View>

      <View style={styles.navRow}>
        <Button
          title={t("home.date_picker.previous_day")}
          variant="ghost"
          disabled={!canGoBack}
          onPress={onGoBack}
        />
        <Button
          title={t("home.date_picker.next_day")}
          variant="ghost"
          disabled={!canGoForward}
          onPress={onGoForward}
        />
      </View>

      {showPicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          textColor={Platform.OS === "ios" ? theme.text : undefined}
          minimumDate={minDate}
          maximumDate={today}
          onChange={(event, nextDate) => {
            const eventType = (event as any)?.type;
            if (eventType === "dismissed") {
              setShowPicker(false);
              return;
            }
            if (nextDate) {
              onSelectDate(nextDate);
            }
            if (Platform.OS !== "ios") {
              setShowPicker(false);
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
});
