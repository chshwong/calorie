/**
 * DATA ACCESS SERVICE - Water Logs
 * 
 * Per engineering guidelines section 3:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 * 
 * This service is platform-agnostic and can be reused in React Native.
 */

import { supabase } from '@/lib/supabase';
import { getUserProfile, updateUserProfile } from '@/lib/services/profile';
import { WaterUnit, toMl, fromMl, toGoalTripletFromMl, getEffectiveGoal } from '@/utils/waterUnits';

// Type definition for water daily log
export type WaterDaily = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD format
  total: number; // Total in the row's water_unit
  goal: number | null; // Goal in the row's water_unit
  water_unit: WaterUnit; // Unit used for this date
  goal_ml: number | null; // Canonical goal in ml
  goal_floz: number | null; // Cached goal in fl oz
  goal_cup: number | null; // Cached goal in cups
  // Legacy fields for backward compatibility during migration
  total_ml?: number;
  goal_ml_legacy?: number | null;
  created_at: string;
  updated_at: string;
};

// Columns to select - avoid select('*') per guideline 3.2
const WATER_DAILY_COLUMNS = `
  id,
  user_id,
  date,
  total,
  goal,
  water_unit,
  goal_ml,
  goal_floz,
  goal_cup,
  created_at,
  updated_at
`;

/**
 * Fetch water daily logs for a date range
 * 
 * @param userId - The user's ID
 * @param startDate - Start date in YYYY-MM-DD format (inclusive)
 * @param endDate - End date in YYYY-MM-DD format (inclusive)
 * @returns Array of WaterDaily objects, or empty array on error
 * 
 * Required index: water_daily_user_date_range_idx ON water_daily(user_id, date DESC)
 */
export async function getWaterDailyForDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<WaterDaily[]> {
  if (!userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('water_daily')
      .select(WATER_DAILY_COLUMNS)
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching water daily logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching water daily logs:', error);
    return [];
  }
}

/**
 * Fetch water daily log for a specific date
 * 
 * @param userId - The user's ID
 * @param dateString - Date in YYYY-MM-DD format
 * @returns WaterDaily object or null if not found
 * 
 * Required index: water_daily_user_date_idx ON water_daily(user_id, date)
 */
export async function getWaterDailyForDate(
  userId: string,
  dateString: string
): Promise<WaterDaily | null> {
  if (!userId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('water_daily')
      .select(WATER_DAILY_COLUMNS)
      .eq('user_id', userId)
      .eq('date', dateString)
      .single();

    if (error) {
      // Not found is okay (user hasn't logged water today)
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching water daily log:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception fetching water daily log:', error);
    return null;
  }
}

/**
 * Upsert water daily log (insert or update)
 * Adds deltaMl to existing total, or creates new record
 * Supports negative deltas (subtraction) - floors at 0
 * Converts deltaMl to the row's water_unit before storing
 * 
 * @param userId - The user's ID
 * @param dateString - Date in YYYY-MM-DD format
 * @param deltaMl - Amount to add/subtract (in ml, can be negative)
 * @param goalMl - Optional goal in ml (used if creating new record)
 * @returns The updated/created WaterDaily object or null on error
 */
export async function addWater(
  userId: string,
  dateString: string,
  deltaMl: number,
  goalMl: number | null = null
): Promise<WaterDaily | null> {
  if (!userId) {
    return null;
  }

  try {
    // First, try to get existing record
    const existing = await getWaterDailyForDate(userId, dateString);

    if (existing) {
      // Convert current total from row's unit to ml, add delta, convert back
      const currentTotalMl = toMl(existing.total, existing.water_unit);
      const newTotalMl = Math.max(0, currentTotalMl + deltaMl);
      
      // Validate total doesn't exceed 6000ml
      if (newTotalMl > 6000) {
        throw new Error('Total water cannot exceed 6000 ml. Current total plus this amount would exceed the limit.');
      }
      
      const newTotal = fromMl(newTotalMl, existing.water_unit);
      
      const { data, error } = await supabase
        .from('water_daily')
        .update({ total: newTotal })
        .eq('id', existing.id)
        .select(WATER_DAILY_COLUMNS)
        .single();

      if (error) {
        console.error('Error updating water daily log:', error);
        return null;
      }

      return data;
    } else {
      // Create new record - use getOrCreateWaterDailyForDate to ensure goal comes from profile
      // Only if deltaMl is positive (can't start with negative)
      const initialMl = Math.max(0, deltaMl);
      
      // Validate total doesn't exceed 6000ml
      if (initialMl > 6000) {
        throw new Error('Total water cannot exceed 6000 ml. This amount would exceed the limit.');
      }
      
      // Get or create the record (will use profile goal if goalMl not provided)
      const waterDaily = await getOrCreateWaterDailyForDate(userId, dateString);
      if (!waterDaily) {
        return null;
      }
      
      // Update total if deltaMl is positive (convert to row's unit)
      if (initialMl > 0) {
        // Validate total doesn't exceed 6000ml (check against existing total if any)
        const existingTotalMl = toMl(waterDaily.total || 0, waterDaily.water_unit);
        const newTotalMl = existingTotalMl + initialMl;
        if (newTotalMl > 6000) {
          throw new Error('Total water cannot exceed 6000 ml. Current total plus this amount would exceed the limit.');
        }
        
        const newTotal = fromMl(initialMl, waterDaily.water_unit);
        const { data, error } = await supabase
          .from('water_daily')
          .update({ total: newTotal })
          .eq('id', waterDaily.id)
          .select(WATER_DAILY_COLUMNS)
          .single();

        if (error) {
          console.error('Error updating new water daily log:', error);
          return waterDaily; // Return the created record even if update fails
        }

        return data;
      }
      
      return waterDaily;
    }
  } catch (error) {
    console.error('Exception adding water:', error);
    return null;
  }
}

/**
 * Set water goal for a specific date
 * Validates goal is between 480ml and 5000ml
 * 
 * If the date is today, also updates profiles.water_goal_ml to keep them in sync.
 * Past dates do NOT update the profile (historical accuracy).
 * 
 * @param userId - The user's ID
 * @param dateString - Date in YYYY-MM-DD format
 * @param goalMl - Goal in ml (must be between 480 and 5000)
 * @returns The updated WaterDaily object or null on error
 * @throws Error if goal is outside valid range
 */
export async function setWaterGoal(
  userId: string,
  dateString: string,
  goalMl: number
): Promise<WaterDaily | null> {
  if (!userId) {
    return null;
  }

    // Validate goal limits
    if (goalMl < 480 || goalMl > 5000) {
      throw new Error('Goal must be between 480ml and 5000ml');
  }

  try {
    // Check if this is today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];
    const isToday = dateString === todayString;

    // Get or create record (ensures it exists)
    const existing = await getOrCreateWaterDailyForDate(userId, dateString);
    if (!existing) {
      return null;
    }

    // Convert goal to row's water_unit
    const goalInUnit = fromMl(goalMl, existing.water_unit);
    const goalTriplet = toGoalTripletFromMl(goalMl);

    // Update existing record's goal fields
    const { data, error } = await supabase
      .from('water_daily')
      .update({ 
        goal: goalInUnit,
        goal_ml: goalTriplet.goalMl,
        goal_floz: goalTriplet.goalFloz,
        goal_cup: goalTriplet.goalCup,
      })
      .eq('id', existing.id)
      .select(WATER_DAILY_COLUMNS)
      .single();

    if (error) {
      console.error('Error updating water goal:', error);
      return null;
    }

    // If this is today's goal, also update the profile
    // Past dates do NOT update the profile to preserve historical accuracy
    if (isToday && data) {
      try {
        const profileTriplet = toGoalTripletFromMl(goalMl);
        await updateUserProfile(userId, { 
          goal_ml: profileTriplet.goalMl,
          goal_floz: profileTriplet.goalFloz,
          goal_cup: profileTriplet.goalCup,
        });
      } catch (profileError) {
        // Log error but don't fail the water goal update
        console.error('Error updating profile goal:', profileError);
      }
    }

    return data;
  } catch (error) {
    console.error('Exception setting water goal:', error);
    return null;
  }
}

/**
 * Get or create water daily log for a specific date
 * 
 * If the record doesn't exist, creates it with goal from profile
 * Uses profile's water_unit and goal_ml to set up the new row
 * 
 * @param userId - The user's ID
 * @param dateString - Date in YYYY-MM-DD format
 * @returns WaterDaily object (existing or newly created)
 */
export async function getOrCreateWaterDailyForDate(
  userId: string,
  dateString: string
): Promise<WaterDaily | null> {
  if (!userId) {
    return null;
  }

  try {
    // Try to fetch existing record
    const existing = await getWaterDailyForDate(userId, dateString);
    
    if (existing) {
      return existing;
    }

    // Record doesn't exist - create it with goal from profile (using defaults if missing)
    const profile = await getUserProfile(userId);
    const profileWaterUnit = (profile?.water_unit as WaterUnit) || 'ml';
    const storedProfileGoalMl = profile?.goal_ml || null;
    const storedProfileGoalInUnit = storedProfileGoalMl ? fromMl(storedProfileGoalMl, profileWaterUnit) : null;
    
    // Get effective goal (with fallback to defaults)
    const { goalInUnit, goalMl: effectiveGoalMl } = getEffectiveGoal(profileWaterUnit, storedProfileGoalInUnit);
    const goalTriplet = toGoalTripletFromMl(effectiveGoalMl);

    const { data, error } = await supabase
      .from('water_daily')
      .insert({
        user_id: userId,
        date: dateString,
        total: 0,
        goal: goalInUnit,
        water_unit: profileWaterUnit,
        goal_ml: goalTriplet.goalMl,
        goal_floz: goalTriplet.goalFloz,
        goal_cup: goalTriplet.goalCup,
      })
      .select(WATER_DAILY_COLUMNS)
      .single();

    if (error) {
      console.error('Error creating water daily log:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception getting or creating water daily:', error);
    return null;
  }
}

/**
 * Sync today's water_daily with profile settings
 * 
 * This is called when the user updates their profile water unit or goal.
 * Only today's row is updated - past days remain unchanged for historical accuracy.
 * 
 * @param userId - The user's ID
 * @returns The updated WaterDaily object or null on error
 */
export async function syncTodayWaterWithProfile(
  userId: string
): Promise<WaterDaily | null> {
  if (!userId) {
    return null;
  }

  try {
    // Get current profile settings
    const profile = await getUserProfile(userId);
    const profileWaterUnit = (profile?.water_unit as WaterUnit) || 'ml';
    const storedProfileGoalMl = profile?.goal_ml || null;
    const storedProfileGoalInUnit = storedProfileGoalMl ? fromMl(storedProfileGoalMl, profileWaterUnit) : null;

    // Get today's date string
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];

    // Try to get existing record for today
    const existing = await getWaterDailyForDate(userId, todayString);

    // Get effective goal (with fallback to defaults)
    const { goalInUnit, goalMl: effectiveGoalMl } = getEffectiveGoal(profileWaterUnit, storedProfileGoalInUnit);
    const goalTriplet = toGoalTripletFromMl(effectiveGoalMl);

    if (existing) {
      // If unit changed, convert total from old unit to new unit
      let newTotal = existing.total;
      if (existing.water_unit !== profileWaterUnit) {
        const currentTotalMl = toMl(existing.total, existing.water_unit);
        newTotal = fromMl(currentTotalMl, profileWaterUnit);
      }

      // Update existing record
      const { data, error } = await supabase
        .from('water_daily')
        .update({ 
          water_unit: profileWaterUnit,
          total: newTotal,
          goal: goalInUnit,
          goal_ml: goalTriplet.goalMl,
          goal_floz: goalTriplet.goalFloz,
          goal_cup: goalTriplet.goalCup,
        })
        .eq('id', existing.id)
        .select(WATER_DAILY_COLUMNS)
        .single();

      if (error) {
        console.error('Error syncing today water with profile:', error);
        return null;
      }

      return data;
    } else {
      // Create new record for today with profile settings
      const { data, error } = await supabase
        .from('water_daily')
        .insert({
          user_id: userId,
          date: todayString,
          total: 0,
          goal: goalInUnit,
          water_unit: profileWaterUnit,
          goal_ml: goalTriplet.goalMl,
          goal_floz: goalTriplet.goalFloz,
          goal_cup: goalTriplet.goalCup,
        })
        .select(WATER_DAILY_COLUMNS)
        .single();

      if (error) {
        console.error('Error creating today water daily with synced settings:', error);
        return null;
      }

      return data;
    }
  } catch (error) {
    console.error('Exception syncing today water with profile:', error);
    return null;
  }
}

/**
 * Update water unit and goal for today
 * Updates both profile and today's water_daily row
 * 
 * @param userId - The user's ID
 * @param waterUnit - New water unit ('ml', 'floz', 'cup')
 * @param goalInUnit - Goal value in the new unit
 * @returns The updated WaterDaily object or null on error
 */
export async function updateWaterUnitAndGoal(
  userId: string,
  waterUnit: WaterUnit,
  goalInUnit: number
): Promise<WaterDaily | null> {
  if (!userId) {
    return null;
  }

  try {
    // Convert goal to ml for validation
    const goalMl = toMl(goalInUnit, waterUnit);
    
    // Validate goal limits (480-5000ml)
    if (goalMl < 480 || goalMl > 5000) {
      throw new Error('Goal must be between 480ml and 5000ml');
    }

    const goalTriplet = toGoalTripletFromMl(goalMl);

    // Update profile
    await updateUserProfile(userId, {
      water_unit: waterUnit,
      goal_ml: goalTriplet.goalMl,
      goal_floz: goalTriplet.goalFloz,
      goal_cup: goalTriplet.goalCup,
    });

    // Sync today's water_daily with profile
    return await syncTodayWaterWithProfile(userId);
  } catch (error) {
    console.error('Exception updating water unit and goal:', error);
    throw error;
  }
}

/**
 * Update water total for a specific date (set absolute value)
 * Accepts total in the row's water_unit, validates in ml (0-5000ml)
 * 
 * @param userId - The user's ID
 * @param dateString - Date in YYYY-MM-DD format
 * @param totalInUnit - Total in the row's water_unit (must convert to 0-5000ml)
 * @returns The updated WaterDaily object or null on error
 * @throws Error if total is outside valid range
 */
export async function updateWaterTotal(
  userId: string,
  dateString: string,
  totalInUnit: number
): Promise<WaterDaily | null> {
  if (!userId) {
    return null;
  }

  try {
    // Get or create record (ensures it exists with profile goal)
    const existing = await getOrCreateWaterDailyForDate(userId, dateString);
    if (!existing) {
      return null;
    }

    // Convert to ml for validation
    const totalMl = toMl(totalInUnit, existing.water_unit);
    
    // Validate total limits (0 to 5000ml)
    if (totalMl < 0 || totalMl > 5000) {
      throw new Error('Total must be between 0ml and 5000ml');
    }

    // Clamp to valid range and convert back to row's unit
    const clampedTotalMl = Math.max(0, Math.min(5000, totalMl));
    const clampedTotal = fromMl(clampedTotalMl, existing.water_unit);

    // Update existing record's total
    const { data, error } = await supabase
      .from('water_daily')
      .update({ total: clampedTotal })
      .eq('id', existing.id)
      .select(WATER_DAILY_COLUMNS)
      .single();

    if (error) {
      console.error('Error updating water total:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception updating water total:', error);
    return null;
  }
}

