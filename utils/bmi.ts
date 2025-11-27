/**
 * DOMAIN UTILITIES - BMI Calculations
 * 
 * Pure functions for BMI calculations and categorization.
 * Per engineering guidelines section 7:
 * - Domain logic lives in plain TS modules
 * - No React/browser/UI imports allowed
 */

import type { BMICategory } from './types';

/**
 * BMI category thresholds and their associated colors
 * Colors follow semantic conventions:
 * - Blue for underweight (needs attention)
 * - Green for normal/healthy
 * - Orange/amber for overweight (caution)
 * - Red for obese (warning)
 */
const BMI_CATEGORIES: Array<{ maxBmi: number; category: BMICategory }> = [
  {
    maxBmi: 18.5,
    category: {
      label: 'Underweight',
      labelKey: 'home.stats.bmi_underweight',
      color: '#3B82F6',
    },
  },
  {
    maxBmi: 25,
    category: {
      label: 'Normal Weight',
      labelKey: 'home.stats.bmi_normal',
      color: '#10B981',
    },
  },
  {
    maxBmi: 30,
    category: {
      label: 'Overweight/Muscular',
      labelKey: 'home.stats.bmi_overweight',
      color: '#F59E0B',
    },
  },
  {
    maxBmi: Infinity,
    category: {
      label: 'Obese',
      labelKey: 'home.stats.bmi_obese',
      color: '#EF4444',
    },
  },
];

/**
 * Get the BMI category for a given BMI value
 * 
 * @param bmiValue - Calculated BMI value
 * @returns BMICategory with label, i18n key, and color
 */
export function getBMICategory(bmiValue: number): BMICategory {
  for (const { maxBmi, category } of BMI_CATEGORIES) {
    if (bmiValue < maxBmi) {
      return category;
    }
  }
  
  // Fallback (should never reach here due to Infinity)
  return BMI_CATEGORIES[BMI_CATEGORIES.length - 1].category;
}

/**
 * Calculate BMI from height in cm and weight in lbs
 * Uses the imperial formula: BMI = 703 × weight(lb) / height(in)²
 * 
 * @param heightCm - Height in centimeters
 * @param weightLb - Weight in pounds
 * @returns BMI value
 */
export function calculateBMI(heightCm: number, weightLb: number): number {
  // Convert cm to inches (1 inch = 2.54 cm)
  const heightInches = heightCm / 2.54;
  return (703 * weightLb) / (heightInches * heightInches);
}

/**
 * Get the time-of-day greeting based on current hour
 * 
 * @param hour - Hour in 24-hour format (0-23)
 * @returns i18n key for the appropriate greeting
 */
export function getGreetingKey(hour: number): string {
  if (hour < 12) {
    return 'home.greeting.morning';
  } else if (hour < 18) {
    return 'home.greeting.afternoon';
  } else {
    return 'home.greeting.evening';
  }
}

