import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { FOOD_SEARCH } from "@/constants/constraints";
import { dateKeyToLocalStartOfDay } from "@/lib/foodDiary/date-guard";
import { toDateKey } from "@/lib/foodDiary/dateKey";
import { MEAL_TYPE_ORDER, type CalorieEntry, type MealType } from "@/lib/foodDiary/types";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, radius, spacing } from "@/theme/tokens";
import { useMealEntries } from "@/features/mealtypeLog/hooks/useMealEntries";
import { useFoodSearch } from "@/features/mealtypeLog/hooks/useFoodSearch";
import type { FoodMaster } from "@/services/foodSearch";

type MealTypeLogScreenProps = {
  date: string;
  mealType: string;
};

export function MealTypeLogScreen({ date, mealType }: MealTypeLogScreenProps) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const normalizedMealType = useMemo<MealType>(() => {
    return MEAL_TYPE_ORDER.includes(mealType as MealType) ? (mealType as MealType) : "dinner";
  }, [mealType]);

  const dateKey = useMemo(() => toDateKey(date), [date]);
  const locale = i18n.language === "fr" ? "fr-FR" : "en-US";
  const dateText = useMemo(() => {
    const formatted = dateKeyToLocalStartOfDay(dateKey).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return formatted;
  }, [dateKey, locale]);

  const mealTypeLabel = t(`home.meal_types.${normalizedMealType}`);

  const { entries, isLoading: entriesLoading } = useMealEntries(dateKey, normalizedMealType);

  const [searchText, setSearchText] = useState("");
  const [debouncedText, setDebouncedText] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedText(searchText);
    }, FOOD_SEARCH.DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchText]);

  const {
    data: searchResults = [],
    isLoading: searchLoading,
    isError: searchError,
  } = useFoodSearch(debouncedText, { includeCustomFoods: true });

  const handleSelectFood = useCallback(
    (food: FoodMaster) => {
      router.push({
        pathname: "/food-edit",
        params: {
          date: dateKey,
          mealType: normalizedMealType,
          foodId: food.id,
        },
      });
    },
    [dateKey, normalizedMealType, router]
  );

  const renderEntryRow = useCallback(
    (entry: CalorieEntry) => (
      <View key={entry.id} style={[styles.entryRow, { borderColor: theme.border }]}>
        <View style={styles.rowText}>
          <Text variant="label">{entry.item_name}</Text>
        </View>
        <Text variant="caption" tone="muted">
          {formatCalories(entry.calories_kcal, t)}
        </Text>
      </View>
    ),
    [theme.border, t]
  );

  const renderResult = useCallback(
    ({ item }: { item: FoodMaster }) => {
      const servingLabel = formatServing(item.serving_size, item.serving_unit);
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => handleSelectFood(item)}
          style={({ pressed }) => [
            styles.resultRow,
            { borderColor: theme.border, backgroundColor: theme.card },
            pressed && styles.rowPressed,
          ]}
        >
          <View style={styles.rowText}>
            <Text variant="label">{item.name}</Text>
            {item.brand ? (
              <Text variant="caption" tone="muted">
                {item.brand}
              </Text>
            ) : null}
          </View>
          <Text variant="caption" tone="muted">
            {formatCalories(item.calories_kcal, t)}
            {servingLabel ? ` / ${servingLabel}` : ""}
          </Text>
        </Pressable>
      );
    },
    [handleSelectFood, t, theme.border, theme.card]
  );

  const showEmptyResults =
    debouncedText.trim().length >= FOOD_SEARCH.MIN_QUERY_LENGTH && !searchLoading;

  return (
    <Screen padding={0}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={renderResult}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text variant="title">{mealTypeLabel}</Text>
                <Text variant="caption" tone="muted">
                  {dateText}
                </Text>
              </View>
              <Button
                title={t("common.back")}
                variant="ghost"
                onPress={() => router.back()}
              />
            </View>
            <Input
              placeholder={t("mealtype_log.search_placeholder")}
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.section}>
              <Text variant="label">
                {t("mealtype_log.food_log.title_with_count", { count: entries.length })}
              </Text>
              {entriesLoading ? (
                <ActivityIndicator color={theme.primary} />
              ) : entries.length > 0 ? (
                <View style={styles.sectionList}>{entries.map(renderEntryRow)}</View>
              ) : (
                <Text variant="caption" tone="muted">
                  {t("mealtype_log.food_log.no_entries")}
                </Text>
              )}
            </View>
            <View style={styles.section}>
              <Text variant="label">{t("mealtype_log.tabs.search")}</Text>
              {searchLoading ? (
                <ActivityIndicator color={theme.primary} />
              ) : searchError ? (
                <Text variant="caption" tone="danger">
                  {t("common.error")}
                </Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          showEmptyResults ? (
            <View style={styles.emptyResults}>
              <Text variant="caption" tone="muted">
                {t("mealtype_log.search_placeholder")}
              </Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function formatCalories(calories: number | null | undefined, t: (key: string) => string) {
  const value = typeof calories === "number" ? Math.round(calories) : 0;
  return `${value} ${t("home.food_log.kcal")}`;
}

function formatServing(size: number | null | undefined, unit: string | null | undefined) {
  if (!size || !unit) return "";
  return `${size}${unit}`;
}

const styles = StyleSheet.create({
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: {
    gap: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionList: {
    gap: spacing.sm,
  },
  entryRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  rowText: {
    flex: 1,
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  rowPressed: {
    opacity: 0.8,
  },
  emptyResults: {
    marginTop: spacing.sm,
  },
});
