import { useLocalSearchParams } from "expo-router";

import { FoodEditScreen } from "@/features/food-edit/FoodEditScreen";

export default function FoodEditRoute() {
  const params = useLocalSearchParams();
  const rawDate = params.date;
  const rawMealType = params.mealType;
  const rawFoodId = params.foodId;

  const date = Array.isArray(rawDate) ? rawDate[0] : rawDate;
  const mealType = Array.isArray(rawMealType) ? rawMealType[0] : rawMealType;
  const foodId = Array.isArray(rawFoodId) ? rawFoodId[0] : rawFoodId;

  return (
    <FoodEditScreen
      date={typeof date === "string" ? date : ""}
      mealType={typeof mealType === "string" ? mealType : ""}
      foodId={typeof foodId === "string" ? foodId : ""}
    />
  );
}
