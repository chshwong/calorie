import { useLocalSearchParams } from "expo-router";

import { MealTypeLogScreen } from "@/features/mealtypeLog/MealTypeLogScreen";

export default function MealTypeLogRoute() {
  const params = useLocalSearchParams();
  const rawDate = params.date;
  const rawMealType = params.mealType;

  const date = Array.isArray(rawDate) ? rawDate[0] : rawDate;
  const mealType = Array.isArray(rawMealType) ? rawMealType[0] : rawMealType;

  return (
    <MealTypeLogScreen
      date={typeof date === "string" ? date : ""}
      mealType={typeof mealType === "string" ? mealType : "dinner"}
    />
  );
}
