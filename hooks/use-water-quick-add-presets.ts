/**
 * React Query hook for water quick add presets
 * 
 * This is a derived hook - it does not hit the database.
 * It simply wraps the utility function with the current user's water_unit.
 */

import { useMemo } from 'react';
import { getWaterQuickAddPresets, type QuickAddPreset } from '@/utils/waterQuickAddPresets';
import { WaterUnit } from '@/utils/waterUnits';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useWaterDaily } from '@/hooks/use-water-logs';
import { useSelectedDate } from '@/hooks/use-selected-date';

/**
 * Hook to get quick add presets for the current user and selected date
 * 
 * Uses profile.water_unit for today, or water_daily.water_unit for past dates
 */
export function useWaterQuickAddPresets() {
  const { data: profile } = useUserProfile();
  const { selectedDateString, isToday } = useSelectedDate();
  const { todayWater } = useWaterDaily({ 
    daysBack: 0,
    targetDateString: selectedDateString,
  });

  // Determine active water unit
  const activeWaterUnit: WaterUnit = useMemo(() => {
    if (isToday) {
      return (profile?.water_unit as WaterUnit) || 'ml';
    } else {
      return (todayWater?.water_unit as WaterUnit) || (profile?.water_unit as WaterUnit) || 'ml';
    }
  }, [isToday, profile?.water_unit, todayWater?.water_unit]);

  // Get presets for active unit
  const presets = useMemo(() => {
    return getWaterQuickAddPresets(activeWaterUnit);
  }, [activeWaterUnit]);

  return {
    presets,
    activeWaterUnit,
  };
}

