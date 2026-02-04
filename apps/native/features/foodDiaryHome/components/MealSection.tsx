import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { FoodEntryRow } from "@/features/foodDiaryHome/components/FoodEntryRow";
import type { CalorieEntry } from "@/lib/foodDiary/types";
import { spacing } from "@/theme/tokens";

type MealSectionProps = {
  mealTypeLabel: string;
  entries: CalorieEntry[];
  totalCalories: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPressHeader?: () => void;
  onPressAdd?: () => void;
  onPressEntry?: (entry: CalorieEntry) => void;
};

export function MealSection({
  mealTypeLabel,
  entries,
  totalCalories,
  isExpanded,
  onToggleExpand,
  onPressHeader,
  onPressAdd,
  onPressEntry,
}: MealSectionProps) {
  const { t } = useTranslation();
  const calorieLabel = t("home.food_log.kcal");
  const hasEntries = entries.length > 0;
  const toggleLabel = isExpanded
    ? t("home.accessibility.collapse_details")
    : t("home.accessibility.expand_details");

  return (
    <Card style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={onPressHeader}
        disabled={!onPressHeader}
      >
        <Text variant="label">{mealTypeLabel}</Text>
        {hasEntries ? (
          <Text>
            {Math.round(totalCalories)} {calorieLabel}
          </Text>
        ) : null}
      </Pressable>

      {hasEntries && isExpanded ? (
        <View style={styles.entries}>
          {entries.map((entry) => (
            <FoodEntryRow
              key={entry.id}
              entry={entry}
              calorieLabel={calorieLabel}
              onPress={onPressEntry ? () => onPressEntry(entry) : undefined}
            />
          ))}
        </View>
      ) : (
        <Button
          title={t("home.food_log.log_food_prompt")}
          variant="ghost"
          onPress={onPressAdd}
        />
      )}

      {hasEntries ? (
        <Button title={toggleLabel} variant="ghost" onPress={onToggleExpand} />
      ) : null}

    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entries: {
    gap: spacing.xs,
  },
});
