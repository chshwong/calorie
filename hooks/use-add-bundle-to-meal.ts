/**
 * Custom hook for adding bundle entries to a meal
 * 
 * Extracts the bundle addition logic from LogFoodScreen into a reusable hook.
 * Handles fetching food details, calculating nutrients, inserting entries, and refreshing data.
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useDailyEntries } from '@/hooks/use-daily-entries';
import type { Bundle } from '@/lib/services/bundles';

interface UseAddBundleToMealParams {
  /** User ID for the entries */
  userId: string | undefined;
  /** Entry date in YYYY-MM-DD format */
  entryDate: string;
  /** Meal type (breakfast, lunch, dinner, afternoon_snack) */
  mealType: string;
  /** Callback to mark entries as newly added for highlighting */
  markAsNewlyAdded: (entryId: string) => void;
}

interface UseAddBundleToMealReturn {
  /** Loading state for bundle addition */
  loading: boolean;
  /** Function to add bundle entries to the meal */
  addBundleEntries: (bundle: Bundle) => Promise<void>;
}

/**
 * Hook for adding bundle entries to a meal
 * 
 * @param params - Configuration parameters
 * @returns Loading state and addBundleEntries function
 */
export function useAddBundleToMeal({
  userId,
  entryDate,
  mealType,
  markAsNewlyAdded,
}: UseAddBundleToMealParams): UseAddBundleToMealReturn {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { refetch: refetchEntries } = useDailyEntries(entryDate);

  // Get meal type label for success message
  const getMealTypeLabel = useCallback((type: string): string => {
    const labels: Record<string, string> = {
      'breakfast': t('mealtype_log.meal_types.breakfast'),
      'lunch': t('mealtype_log.meal_types.lunch'),
      'dinner': t('mealtype_log.meal_types.dinner'),
      'afternoon_snack': t('mealtype_log.meal_types.snack'),
    };
    return labels[type.toLowerCase()] || type;
  }, [t]);

  const addBundleEntries = useCallback(async (bundle: Bundle) => {
    if (!userId) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.user_not_authenticated'));
      return;
    }

    setLoading(true);
    try {
      // Fetch food details for all items
      const foodIds = bundle.items
        ?.filter(item => item.food_id)
        .map(item => item.food_id!) || [];
      
      const { data: foodsData, error: foodsError } = foodIds.length > 0
        ? await supabase
            .from('food_master')
            .select('*')
            .in('id', foodIds)
        : { data: [], error: null };

      if (foodsError) {
        Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.fetch_failed', { error: foodsError.message }));
        setLoading(false);
        return;
      }

      const foodsMap = new Map((foodsData || []).map(food => [food.id, food]));

      // Prepare entries to insert
      const entriesToInsert = await Promise.all(
        (bundle.items || []).map(async (item) => {
          let calories = 0;
          let protein = 0;
          let carbs = 0;
          let fat = 0;
          let fiber = 0;
          let saturatedFat = 0;
          let transFat = 0;
          let sugar = 0;
          let sodium = 0;
          let itemName = item.item_name || t('mealtype_log.food_log.unknown_food');

          if (item.food_id && foodsMap.has(item.food_id)) {
            const food = foodsMap.get(item.food_id)!;
            itemName = food.name;
            let multiplier = 1;

            if (item.serving_id) {
              const { data: servingData, error: servingError } = await supabase
                .from('food_servings')
                .select('weight_g, volume_ml')
                .eq('id', item.serving_id)
                .single();

              if (servingError || !servingData) {
                // Fallback to unit-based calculation
                if (item.unit === 'g' || item.unit === 'ml') {
                  multiplier = item.quantity / 100;
                } else {
                  multiplier = (item.quantity * food.serving_size) / 100;
                }
              } else {
                // Use weight_g or volume_ml from the serving
                const servingValue = servingData.weight_g ?? servingData.volume_ml ?? 0;
                multiplier = (item.quantity * servingValue) / 100;
              }
            } else {
              // Unit-based serving (1g or 1ml) or other units
              if (item.unit === 'g' || item.unit === 'ml') {
                multiplier = item.quantity / 100;
              } else {
                multiplier = (item.quantity * food.serving_size) / 100;
              }
            }

            calories = (food.calories_kcal || 0) * multiplier;
            protein = (food.protein_g || 0) * multiplier;
            carbs = (food.carbs_g || 0) * multiplier;
            fat = (food.fat_g || 0) * multiplier;
            fiber = (food.fiber_g || 0) * multiplier;
            saturatedFat = (food.saturated_fat_g || 0) * multiplier;
            transFat = (food.trans_fat_g || 0) * multiplier;
            sugar = (food.sugar_g || 0) * multiplier;
            sodium = (food.sodium_mg || 0) * multiplier;
          }

          // Validate quantity and unit
          const parsedQuantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity || '0'));
          if (isNaN(parsedQuantity) || !isFinite(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error(`Invalid quantity for item: ${itemName}`);
          }

          if (!item.unit || typeof item.unit !== 'string') {
            throw new Error(`Invalid unit for item: ${itemName}`);
          }

          // Validate calculated values
          const validatedCalories = isNaN(calories) || !isFinite(calories) ? 0 : Math.round(calories * 100) / 100;
          const validatedProtein = (protein > 0 && isFinite(protein)) ? Math.round(protein * 100) / 100 : null;
          const validatedCarbs = (carbs > 0 && isFinite(carbs)) ? Math.round(carbs * 100) / 100 : null;
          const validatedFat = (fat > 0 && isFinite(fat)) ? Math.round(fat * 100) / 100 : null;
          const validatedFiber = (fiber > 0 && isFinite(fiber)) ? Math.round(fiber * 100) / 100 : null;
          const validatedSaturatedFat = (saturatedFat > 0 && isFinite(saturatedFat)) ? Math.round(saturatedFat * 100) / 100 : null;
          const validatedTransFat = (transFat > 0 && isFinite(transFat)) ? Math.round(transFat * 100) / 100 : null;
          const validatedSugar = (sugar > 0 && isFinite(sugar)) ? Math.round(sugar * 100) / 100 : null;
          const validatedSodium = (sodium > 0 && isFinite(sodium)) ? Math.round(sodium * 100) / 100 : null;

          // Build entry data similar to saveEntry function
          const entryData: any = {
            user_id: userId,
            entry_date: entryDate,
            eaten_at: null,
            meal_type: mealType.toLowerCase(),
            item_name: itemName.trim(),
            quantity: parsedQuantity,
            unit: item.unit,
            calories_kcal: validatedCalories,
            protein_g: validatedProtein,
            carbs_g: validatedCarbs,
            fat_g: validatedFat,
            fiber_g: validatedFiber,
          };

          // Only include food_id if it exists (like in saveEntry)
          if (item.food_id) {
            entryData.food_id = item.food_id;
          }

          // Only include serving_id if it exists (like in saveEntry)
          if (item.serving_id) {
            entryData.serving_id = item.serving_id;
          }

          // Only include fat detail fields if they have values greater than 0
          if (validatedSaturatedFat !== null) {
            entryData.saturated_fat_g = validatedSaturatedFat;
          }
          if (validatedTransFat !== null) {
            entryData.trans_fat_g = validatedTransFat;
          }

          // Only include sugar_g if it has a value greater than 0
          if (validatedSugar !== null) {
            entryData.sugar_g = validatedSugar;
          }

          // Only include sodium_mg if it has a value greater than 0
          if (validatedSodium !== null) {
            entryData.sodium_mg = validatedSodium;
          }

          return entryData;
        })
      );

      // Validate entries before inserting
      if (entriesToInsert.length === 0) {
        Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.no_valid_entries'));
        setLoading(false);
        return;
      }

      // Insert all entries
      const { data: insertedData, error: insertError } = await supabase
        .from('calorie_entries')
        .insert(entriesToInsert)
        .select('id');

      if (insertError) {
        // Show detailed error message
        const errorDetails = insertError.details || insertError.hint || '';
        const errorMessage = t('mealtype_log.bundles.add_failed', { error: `${insertError.message}${errorDetails ? `\n\nDetails: ${errorDetails}` : ''}` });
        Alert.alert(t('alerts.error_title'), errorMessage);
        setLoading(false);
        return;
      }

      // Verify entries were inserted
      if (!insertedData || insertedData.length === 0) {
        Alert.alert(t('alerts.error_title'), t('mealtype_log.errors.no_entries_added'));
        setLoading(false);
        return;
      }

      // Mark all newly added entries for highlight animation
      insertedData.forEach((entry) => {
        if (entry.id) {
          markAsNewlyAdded(entry.id);
        }
      });

      // Refresh entries - ensure we wait for it to complete
      // Force a fresh fetch to ensure we get the latest data
      await refetchEntries();
      
      // Double-check: fetch again after a brief moment to ensure consistency
      await new Promise(resolve => setTimeout(resolve, 200));
      await refetchEntries();
      
      // Show success message after entries are refreshed
      const mealTypeLabel = getMealTypeLabel(mealType);
      Alert.alert(t('alerts.success'), t('mealtype_log.bundles.added_success', { name: bundle.name, mealType: mealTypeLabel }));
    } catch (error: any) {
      Alert.alert(t('alerts.error_title'), t('mealtype_log.bundles.add_failed', { error: error?.message || t('common.unexpected_error') }));
    } finally {
      setLoading(false);
    }
  }, [userId, entryDate, mealType, markAsNewlyAdded, refetchEntries, t, getMealTypeLabel]);

  return {
    loading,
    addBundleEntries,
  };
}

