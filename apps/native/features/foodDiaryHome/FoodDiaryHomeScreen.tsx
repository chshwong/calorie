import { RefreshControl, StyleSheet, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { CollapsibleModuleHeader } from "@/components/header/CollapsibleModuleHeader";
import { DatePickerButton } from "@/components/header/DatePickerButton";
import { DaySummaryCard } from "@/features/foodDiaryHome/components/DaySummaryCard";
import { MealSection } from "@/features/foodDiaryHome/components/MealSection";
import { useSelectedDate } from "@/features/foodDiaryHome/hooks/useSelectedDate";
import { useDailySummary } from "@/features/foodDiaryHome/hooks/useDailySummary";
import { useTargets } from "@/features/foodDiaryHome/hooks/useTargets";
import { addDays, toDateKey } from "@/lib/foodDiary/dateKey";
import { MEAL_TYPE_ORDER } from "@/lib/foodDiary/types";
import { spacing } from "@/theme/tokens";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";

export function FoodDiaryHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const {
    selectedDate,
    selectedDateKey,
    today,
    minDate,
    isToday,
    canGoBack,
    canGoForward,
  } = useSelectedDate();
  const { dailyTotals, groupedEntries, isLoading, refetch } = useDailySummary(selectedDateKey);
  const { targets, userConfig } = useTargets();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>(() => {
    return MEAL_TYPE_ORDER.reduce<Record<string, boolean>>((acc, mealType) => {
      acc[mealType] = true;
      return acc;
    }, {});
  });

  const mealToggle = useMemo(
    () => (mealType: string) => {
      setExpandedMeals((prev) => ({ ...prev, [mealType]: !prev[mealType] }));
    },
    []
  );

  const navigateWithDate = (next: Date | string) => {
    const nextKey = toDateKey(next);
    router.replace({ pathname: "/(tabs)", params: { date: nextKey } });
  };

  const locale = i18n.language === "fr" ? "fr-FR" : "en-US";
  const dateText = useMemo(
    () =>
      selectedDate.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [locale, selectedDate]
  );

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <Screen padding={0}>
      <CollapsibleModuleHeader
        dateText={dateText}
        preferredName={userConfig?.first_name ?? undefined}
        rightAvatarUri={userConfig?.avatar_url ?? undefined}
        rightAction={
          <DatePickerButton
            selectedDate={selectedDate}
            today={today}
            minimumDate={minDate}
            maximumDate={today}
            onDateSelect={navigateWithDate}
          />
        }
        goBackOneDay={
          canGoBack
            ? () => {
                navigateWithDate(addDays(selectedDateKey, -1));
              }
            : undefined
        }
        goForwardOneDay={
          canGoForward
            ? () => {
                navigateWithDate(addDays(selectedDateKey, 1));
              }
            : undefined
        }
        isToday={isToday}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
          <DaySummaryCard totals={dailyTotals} targets={targets} isLoading={isLoading} />
          <View style={styles.mealList}>
            {MEAL_TYPE_ORDER.map((mealType) => {
              const group = groupedEntries[mealType];
              const mealTypeLabel = t(`home.meal_types.${mealType}`);
              return (
                <MealSection
                  key={mealType}
                  mealTypeLabel={mealTypeLabel}
                  entries={group.entries}
                  totalCalories={group.totalCalories}
                  isExpanded={expandedMeals[mealType] ?? true}
                  onToggleExpand={() => mealToggle(mealType)}
                  onPressHeader={() =>
                    router.push({
                      pathname: "/mealtype-log",
                      params: { mealType, date: selectedDateKey },
                    })
                  }
                  onPressAdd={() =>
                    router.push({
                      pathname: "/mealtype-log",
                      params: { mealType, date: selectedDateKey },
                    })
                  }
                  onPressEntry={() =>
                    router.push({
                      pathname: "/mealtype-log",
                      params: { mealType, date: selectedDateKey },
                    })
                  }
                />
              );
            })}
          </View>
          <Button
            title={t("food.log_food")}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/log",
                params: { entryDate: selectedDateKey },
              })
            }
          />
        </View>
      </CollapsibleModuleHeader>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  mealList: {
    gap: spacing.md,
  },
});
