import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { spacing } from "@/theme/tokens";
import type { CalorieEntry } from "@/lib/foodDiary/types";

type FoodEntryRowProps = {
  entry: CalorieEntry;
  onPress?: () => void;
  calorieLabel: string;
};

export function FoodEntryRow({ entry, onPress, calorieLabel }: FoodEntryRowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.info}>
        <Text numberOfLines={1}>{entry.item_name}</Text>
        {entry.food_id ? (
          <Text tone="muted" variant="caption" numberOfLines={1}>
            {formatQuantity(entry.quantity)} {entry.unit}
          </Text>
        ) : null}
      </View>
      <Text>
        {Math.round(entry.calories_kcal)} {calorieLabel}
      </Text>
    </Pressable>
  );
}

function formatQuantity(value: number) {
  return Math.round(value) === value ? value.toString() : value.toFixed(1);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
});
