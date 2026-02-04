import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { FOOD_SEARCH } from "@/constants/constraints";
import { useAuth } from "@/contexts/AuthContext";
import { searchFoodMaster, type FoodMaster } from "@/services/foodSearch";

type FoodSearchOptions = {
  includeCustomFoods?: boolean;
  maxResults?: number;
};

export function useFoodSearch(queryText: string, options: FoodSearchOptions = {}) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { includeCustomFoods = true, maxResults = FOOD_SEARCH.MAX_RESULTS } = options;

  const normalizedQuery = useMemo(() => queryText.trim(), [queryText]);
  const enabled = Boolean(userId) && normalizedQuery.length >= FOOD_SEARCH.MIN_QUERY_LENGTH;

  return useQuery<FoodMaster[]>({
    queryKey: ["food-search", userId, normalizedQuery, includeCustomFoods, maxResults],
    enabled,
    queryFn: () =>
      searchFoodMaster({
        userId,
        query: normalizedQuery,
        includeCustomFoods,
        maxResults,
      }),
  });
}
