// src/constants/constraints.ts

import { DB_MIN_WEIGHT_LB, DB_MAX_WEIGHT_LB, LB_PER_KG, lbToKg } from '@/lib/domain/weight-constants';

// truth in code
export const PROFILES = {
    WEIGHT_LB: { MIN: DB_MIN_WEIGHT_LB, MAX: DB_MAX_WEIGHT_LB },     // DB: profiles_weight_lb_check, NOT NULL
    HEIGHT_CM: { MIN: 50, MAX: 260 },     // DB: profiles_height_cm_check, NOT NULL
    BODY_FAT_PERCENT: { MIN_EXCLUSIVE: 2, MAX: 80 }, // DB: profiles_body_fat_percent_range (nullable)
    WATER_GOAL_ML: { MIN: 500, MAX: 5000 }, // DB: water_goal_ml_range (nullable)
  } as const;
// truth in Database
// export const PROFILES = {
//     WEIGHT_LB: { MIN: 45, MAX: 880 },     // DB: profiles_weight_lb_check, NOT NULL
//     HEIGHT_CM: { MIN: 50, MAX: 260 },     // DB: profiles_height_cm_check, NOT NULL
//     BODY_FAT_PERCENT: { MIN_EXCLUSIVE: 0, MAX: 80 }, // DB: profiles_body_fat_percent_range (nullable)
//     WATER_GOAL_ML: { MIN: 500, MAX: 5000 }, // DB: water_goal_ml_range (nullable)
//   } as const;
  // Optional: derived ranges (always derive from the LB constraint so it can't drift)
  export const DERIVED = {
    WEIGHT_KG: {
      MIN: lbToKg(DB_MIN_WEIGHT_LB),
      MAX: lbToKg(DB_MAX_WEIGHT_LB),
    },
  } as const;
  
  export const TEXT_LIMITS = {
    BUNDLES_NAME: { MIN_LEN: 1, MAX_LEN: 40 },  // DB: bundles_name_check
    EXERCISE_NAME_MAX_LEN: 30,                  // DB: exercise_log name_length
    NOTES_MAX_LEN: 200,                         // DB: exercise_log_notes_length, med_log_notes_length
    MED_NAME_MAX_LEN: 30,                       // DB: med_log_name_length
    MED_DOSE_UNIT_MAX_LEN: 10,                  // DB: med_log_dose_unit_length
  } as const;
  
  export const RANGES = {
    CALORIES_KCAL: { MIN: 0, MAX: 5000 },       // DB: calorie_entries_calories_kcal_check
    EXERCISE_MINUTES: { MIN: 0, MAX: 999 },     // DB: minutes_range (nullable)
    MED_DOSE_AMOUNT: { MIN: 0, MAX: 9999 },     // DB: med_log_dose_amount_range (nullable)
    WATER_PRESET_SLOT: { MIN: 1, MAX: 5 },      // DB: water_quick_presets_slot_check
  } as const;

  // Daily nutrient target ranges (for onboarding and daily focus targets)
  export const NUTRIENT_TARGETS = {
    PROTEIN_G: { MIN: 80, MAX: 250, STEP: 5 },
    // Slider range computation bounds
    PROTEIN_SLIDER: { MIN: 30, MAX: 250 },
    FIBER_G: { MIN: 22, MAX: 45, STEP: 1 },
    // Slider range computation bounds
    FIBER_SLIDER: { MIN: 10, MAX: 70 },
    CARBS_G: { MIN: 120, MAX: 400, STEP: 10 },
    // Slider range computation bounds
    CARBS_SLIDER: { MIN: 10, MAX: 400 },
    SUGAR_G: { MIN: 25, MAX: 70, STEP: 5 },
    SODIUM_MG: { MIN: 1500, MAX: 3500, STEP: 100 },
    // Slider range computation bounds
    SODIUM_SLIDER: { MIN: 500, MAX: 7000 },
    SUGAR_SLIDER: { MIN: 10, MAX: 100 },
  } as const;

  // Policy (not shown in DB constraints you pasted) — keep separate and label clearly
  export const POLICY = {
    DOB: { MIN_AGE_YEARS: 13, MAX_AGE_YEARS: 120 },
    NAME: { MIN_LEN: 1, MAX_LEN: 50 }, // No contraint in DB
  } as const;
  