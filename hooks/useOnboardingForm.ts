import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Alert, Platform, Dimensions } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { ageFromDob, ActivityLevel, calculateBMR, calculateTDEE, calculateRequiredDailyCalorieDiff, calculateSafeCalorieTarget } from '@/utils/calculations';
import { 
  validatePreferredName, 
  validateHeightCm as validateHeightCmUtil, 
  validateActivityLevel as validateActivityLevelUtil, 
  validateWeightKg as validateWeightKgUtil, 
  validateBodyFatPercent as validateBodyFatPercentUtil,
  validateTimeline as validateTimelineUtil, 
  validateSex as validateSexUtil, 
  validateGoal as validateGoalUtil 
} from '@/utils/validation';
import { validateGoalWeight as validateGoalWeightNew } from '@/lib/onboarding/goal-weight-validation';
import { 
  convertHeightToCm, 
  kgToLb, 
  lbToKg,
  roundTo1,
  roundTo2,
  roundTo3,
} from '@/utils/bodyMetrics';
import { 
  filterNumericInput, 
  filterPreferredNameInput, 
  normalizeSpaces 
} from '@/utils/inputFilters';
import { updateProfile } from '@/lib/services/profileService';
import { uploadUserAvatar, setProfileAvatarUrl } from '@/lib/avatar/avatar-service';
import { checkProfanity } from '@/utils/profanity';
import { insertWeightLogAndUpdateProfile } from '@/lib/services/weightLog';
import { PROFILES, DERIVED } from '@/constants/constraints';
import { getSuggestedTargetWeightLb } from '@/lib/onboarding/goal-weight-rules';
import { 
  scheduleDraftSave, 
  flushDraftSave, 
  type OnboardingDraft,
  getLastDraftError 
} from '@/lib/onboarding/onboarding-draft-sync';
import type { DailyFocusTargets } from '@/components/onboarding/steps/DailyFocusTargetsStep';

type GoalType = 'lose' | 'maintain' | 'gain' | 'recomp';

export function useOnboardingForm() {
  const { t } = useTranslation();
  const { user, refreshProfile, profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 9; // Steps 1-9: Name, Sex, Height, Activity, Current Weight, Goal, Goal Weight, Daily Calorie Target, Daily Focus Targets
  
  // Step 6: Goal
  const [goal, setGoal] = useState<GoalType | ''>('');
  const [showAdvancedGoals, setShowAdvancedGoals] = useState(false);
  
  // Step 1: Preferred Name and Date of Birth
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [preferredName, setPreferredName] = useState('');
  const [dateOfBirthStep2, setDateOfBirthStep2] = useState('');
  const [showDatePickerStep2, setShowDatePickerStep2] = useState(false);
  const [selectedDateStep2, setSelectedDateStep2] = useState<Date>(() => {
    // Default to June 4, 1983
    return new Date(1983, 5, 4); // Month is 0-indexed, so 5 = June
  });
  
  // Step 2: Sex
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  
  // Step 3: Height
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft/in'>('cm');
  
  const weightsPrefilledRef = useRef(false);
  
  // Step 4: Activity Level
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | ''>('');
  
  // Step 5: Current Weight
  const [currentWeightKg, setCurrentWeightKg] = useState('');
  const [currentWeightLb, setCurrentWeightLb] = useState('');
  const [currentWeightUnit, setCurrentWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [currentBodyFatPercent, setCurrentBodyFatPercent] = useState('');
  
  // Step 7: Goal Weight
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [goalWeightLb, setGoalWeightLb] = useState('');
  const [goalWeightUnit, setGoalWeightUnit] = useState<'kg' | 'lb'>('kg');
  
  // Goal weight suggestion - derived value, not state
  const goalWeightSuggestion = useMemo(() => {
    const currentWeightLbNum = currentWeightLb ? parseFloat(currentWeightLb) : null;
    const heightCmNum = heightCm ? parseFloat(heightCm.toString()) : null;
    
    if (!goal || currentWeightLbNum === null) {
      return null;
    }
    
    return getSuggestedTargetWeightLb({
      goalType: goal as GoalType,
      currentWeightLb: currentWeightLbNum,
      heightCm: heightCmNum,
      sexAtBirth: sex || null,
      dobISO: dateOfBirthStep2 || null,
    });
  }, [goal, currentWeightLb, heightCm, sex, dateOfBirthStep2]);
  
  // Step 8: Timeline
  const [timelineOption, setTimelineOption] = useState<'3_months' | '6_months' | '12_months' | 'no_deadline' | 'custom_date' | ''>('');
  const [customTargetDate, setCustomTargetDate] = useState<string | null>(null);
  
  // Step 9: Daily Calorie Target
  const [calorieTarget, setCalorieTarget] = useState<number | null>(null);
  const [maintenanceCalories, setMaintenanceCalories] = useState<number | null>(null);
  const [caloriePlan, setCaloriePlan] = useState<string | null>(null);
  const [calorieExecutionMode, setCalorieExecutionMode] = useState<'override' | undefined>(undefined);
  
  // Step 10: Daily Focus Targets
  const [dailyTargets, setDailyTargets] = useState<{
    proteinGMin: number;
    fiberGMin: number;
    carbsGMax: number;
    sugarGMax: number;
    sodiumMgMax: number;
    waterMlTarget: number;
  } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorTextState] = useState<string | null>(null);
  const [errorKey, setErrorKeyState] = useState<string | null>(null);
  const [errorParams, setErrorParamsState] = useState<Record<string, any> | undefined>(undefined);
  
  // Draft sync status tracking
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const lastSyncErrorRef = useRef<Error | null>(null);
  
  // Unified error management helpers
  const setErrorText = (text: string | null) => {
    setErrorTextState(text);
    setErrorKeyState(null);
    setErrorParamsState(undefined);
  };
  
  const setErrorI18n = (key: string | null, params?: Record<string, any>) => {
    setErrorKeyState(key);
    setErrorParamsState(params);
    setErrorTextState(null);
  };
  
  const clearErrors = () => {
    setErrorTextState(null);
    setErrorKeyState(null);
    setErrorParamsState(undefined);
  };
  
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;
  
  // Redirect to login if no user
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user]);
  
  // Prefill preferredName from user's display name (from OAuth provider) or existing profile
  useEffect(() => {
    if (user && !preferredName) {
      // First try profile
      if (profile?.first_name) {
        setPreferredName(profile.first_name);
        return;
      }
      
      // Then try OAuth metadata
      const displayName = user.user_metadata?.full_name 
        || user.user_metadata?.name 
        || user.user_metadata?.given_name
        || '';
      
      if (displayName) {
        const firstNameFromDisplay = displayName.split(' ')[0];
        setPreferredName(firstNameFromDisplay);
      }
    }
  }, [user, profile]);
  
  // Prefill date of birth from profile if available
  useEffect(() => {
    if (profile?.date_of_birth && !dateOfBirthStep2) {
      setDateOfBirthStep2(profile.date_of_birth);
      const dobDate = new Date(profile.date_of_birth + 'T00:00:00');
      if (!isNaN(dobDate.getTime())) {
        setSelectedDateStep2(dobDate);
      }
    }
  }, [profile]);

  // Prefill avatar from profile if available
  useEffect(() => {
    if (profile?.avatar_url && !avatarUri) {
      setAvatarUri(profile.avatar_url);
    }
  }, [profile]);

  // Prefill weight from profile.weight_lb (weight_kg is intentionally ignored)
  useEffect(() => {
    if (!profile || weightsPrefilledRef.current) return;

    const preferredUnit: 'kg' | 'lb' = profile.weight_unit === 'kg' ? 'kg' : 'lb';
    const hasExistingInput = Boolean(currentWeightKg || currentWeightLb);

    // Respect any in-progress user input
    if (hasExistingInput) {
      weightsPrefilledRef.current = true;
      return;
    }

    setCurrentWeightUnit(preferredUnit);
    setGoalWeightUnit(preferredUnit);

    if (profile.weight_lb !== null && profile.weight_lb !== undefined) {
      const displayLb = roundTo1(profile.weight_lb);
      const displayKg = roundTo1(lbToKg(profile.weight_lb));

      setCurrentWeightLb(displayLb.toString());
      setCurrentWeightKg(displayKg.toString());
    }

    if (profile.body_fat_percent !== null && profile.body_fat_percent !== undefined) {
      const displayBf = roundTo1(profile.body_fat_percent);
      setCurrentBodyFatPercent(displayBf.toString());
    }

    weightsPrefilledRef.current = true;
  }, [profile, currentWeightKg, currentWeightLb]);
  
  // Prefill sex from profile if available
  useEffect(() => {
    if (profile?.gender && !sex) {
      if (profile.gender === 'male' || profile.gender === 'female') {
        setSex(profile.gender);
      }
    }
  }, [profile]);
  
  // Prefill height from profile if available
  useEffect(() => {
    if (profile?.height_cm && !heightCm) {
      setHeightCm(profile.height_cm.toString());
      if (profile.height_unit === 'ft') {
        setHeightUnit('ft/in');
        const totalInches = profile.height_cm / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = Math.round(totalInches % 12);
        setHeightFt(feet.toString());
        setHeightIn(inches.toString());
      }
    }
  }, [profile]);
  
  // Prefill activity level from profile if available
  useEffect(() => {
    if (profile?.activity_level && !activityLevel) {
      const validActivityLevels = ['sedentary', 'light', 'moderate', 'high', 'very_high'];
      if (validActivityLevels.includes(profile.activity_level)) {
        setActivityLevel(profile.activity_level as 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high');
      }
    }
  }, [profile]);
  
  // Prefill goal from profile if available
  useEffect(() => {
    if (profile?.goal_type && !goal) {
      const validGoalTypes = ['lose', 'maintain', 'gain', 'recomp'];
      if (validGoalTypes.includes(profile.goal_type)) {
        setGoal(profile.goal_type as GoalType);
      }
    }
  }, [profile]);
  
  // Conversion helper function for validation
  const getHeightInCm = (): number | null => {
    return convertHeightToCm(heightUnit, heightCm, heightFt, heightIn);
  };
  
  // Unit conversion-aware setters
  const setWeightUnit = (unit: 'kg' | 'lb') => {
    setCurrentWeightUnit(unit);
    // Sync goalWeightUnit with currentWeightUnit since GoalWeightStep uses the same unit preference
    setGoalWeightUnit(unit);
    if (unit === 'kg') {
      if (currentWeightLb) {
        const kg = roundTo1(lbToKg(parseFloat(currentWeightLb)));
        setCurrentWeightKg(kg.toString());
      }
      // Also convert goal weight if needed
      if (goalWeightLb) {
        const kg = roundTo1(lbToKg(parseFloat(goalWeightLb)));
        setGoalWeightKg(kg.toString());
      }
    } else {
      if (currentWeightKg) {
        const lbs = roundTo1(kgToLb(parseFloat(currentWeightKg)));
        setCurrentWeightLb(lbs.toString());
      }
      // Also convert goal weight if needed
      if (goalWeightKg) {
        const lbs = roundTo1(kgToLb(parseFloat(goalWeightKg)));
        setGoalWeightLb(lbs.toString());
      }
    }
    clearErrors();
  };
  
  const setGoalWeightUnitWithConversion = (unit: 'kg' | 'lb') => {
    setGoalWeightUnit(unit);
    if (unit === 'kg') {
      if (goalWeightLb) {
        const kg = roundTo1(lbToKg(parseFloat(goalWeightLb)));
        setGoalWeightKg(kg.toString());
      }
    } else {
      if (goalWeightKg) {
        const lbs = roundTo1(kgToLb(parseFloat(goalWeightKg)));
        setGoalWeightLb(lbs.toString());
      }
    }
    clearErrors();
  };
  
  const setHeightUnitWithConversion = (unit: 'cm' | 'ft/in') => {
    setHeightUnit(unit);
    if (unit === 'cm') {
      if (heightFt && heightIn) {
        const totalInches = parseFloat(heightFt) * 12 + parseFloat(heightIn);
        const cm = totalInches * 2.54;
        setHeightCm(cm.toFixed(1));
      }
    } else {
      if (heightCm) {
        const totalInches = parseFloat(heightCm) / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = Math.round(totalInches % 12);
        setHeightFt(feet.toString());
        setHeightIn(inches.toString());
      }
    }
    clearErrors();
  };
  
  // Display getters
  const getCurrentWeightDisplay = (): { value: string; unitLabel: 'lb' | 'kg' } => {
    if (currentWeightUnit === 'kg' && currentWeightKg) {
      return { value: currentWeightKg, unitLabel: 'kg' };
    } else if (currentWeightUnit === 'lb' && currentWeightLb) {
      return { value: currentWeightLb, unitLabel: 'lb' };
    }
    return { value: '', unitLabel: currentWeightUnit === 'kg' ? 'kg' : 'lb' };
  };
  
  const getGoalWeightDisplay = (): { value: string; unitLabel: 'lb' | 'kg' } => {
    if (goalWeightUnit === 'kg' && goalWeightKg) {
      return { value: goalWeightKg, unitLabel: 'kg' };
    } else if (goalWeightUnit === 'lb' && goalWeightLb) {
      return { value: goalWeightLb, unitLabel: 'lb' };
    }
    return { value: '', unitLabel: goalWeightUnit === 'kg' ? 'kg' : 'lb' };
  };

  
  const handlePreferredNameChange = (text: string) => {
    const filtered = filterPreferredNameInput(preferredName, text);
    setPreferredName(filtered);
    // Clear error when user types (errors only show on submit)
    if (errorText && (errorText.includes('name') || errorText.includes('Name'))) {
      clearErrors();
    }
  };
  
  const handlePreferredNameBlur = () => {
    // Normalize spaces: remove leading/trailing, collapse multiple spaces
    const normalized = normalizeSpaces(preferredName);
    if (normalized !== preferredName) {
      setPreferredName(normalized);
    }
  };
  
  const validateNameAge = (): string | null => {
    // Preferred Name is required
    if (!preferredName || preferredName.trim().length === 0) {
      return t('onboarding.name_age.error_name_required');
    }
    
    // Preferred Name validation using strict rules
    // Normalize spaces before validation
    const normalized = normalizeSpaces(preferredName);
    
    // Profanity check (after normalization, before minimum-letter validation)
    if (checkProfanity(normalized)) {
      return "Please choose a different name.";
    }
    
    // Check emoji count (must be 1 or less)
    const chars = Array.from(normalized);
    let emojiCount = 0;
    for (const ch of chars) {
      const codePoint = ch.codePointAt(0);
      if (codePoint && codePoint >= 0x1F000) {
        emojiCount += 1;
      }
    }
    if (emojiCount > 1) {
      return 'Only 1 emoji max';
    }
    
    const nameValidation = validatePreferredName(normalized);
    if (!nameValidation.valid) {
      return nameValidation.error || t('onboarding.name_age.error_name_invalid');
    }
    
    // Date of Birth is required
    if (!dateOfBirthStep2 || dateOfBirthStep2.trim().length === 0) {
      return t('onboarding.name_age.error_dob_required');
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateOfBirthStep2)) {
      return t('onboarding.name_age.error_dob_format');
    }
    
    const dobDate = new Date(dateOfBirthStep2 + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dobDate > today) {
      return t('onboarding.name_age.error_dob_future');
    }
    
    const actualAge = ageFromDob(dateOfBirthStep2);
    
    if (actualAge < 18) {
      return t('onboarding.name_age.error_age_minimum');
    }
    
    if (actualAge > 100) {
      return t('onboarding.name_age.error_age_maximum');
    }
    
    return null;
  };
  
  // Convert selectedDateStep2 to YYYY-MM-DD format for Step 2
  const updateDateOfBirthStep2 = (date: Date) => {
    setSelectedDateStep2(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setDateOfBirthStep2(`${year}-${month}-${day}`);
  };
  
  // Handle opening date picker for Step 2
  const handleOpenDatePickerStep2 = () => {
    if (!dateOfBirthStep2) {
      // Default to June 4, 1983
      setSelectedDateStep2(new Date(1983, 5, 4)); // Month is 0-indexed, so 5 = June
    } else {
      const existingDate = new Date(dateOfBirthStep2 + 'T00:00:00');
      setSelectedDateStep2(existingDate);
    }
    setShowDatePickerStep2(true);
  };
  
  // Handle date change from AppDatePicker
  const handleDateOfBirthChange = (date: Date) => {
    updateDateOfBirthStep2(date);
    setShowDatePickerStep2(false);
  };
  
  // Calculate min/max dates for DOB (18-100 years old)
  const getDOBMinDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 100);
    return date;
  };
  
  const getDOBMaxDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date;
  };
  
  // Validation functions using utility modules
  const validateSex = (): string | null => {
    const errorKey = validateSexUtil(sex);
    return errorKey ? t(errorKey) : null;
  };
  
  const validateHeight = (): string | null => {
    const heightCmValue = getHeightInCm();
    const errorKey = validateHeightCmUtil(heightCmValue);
    return errorKey ? t(errorKey) : null;
  };
  
  const validateActivity = (): string | null => {
    const errorKey = validateActivityLevelUtil(activityLevel);
    return errorKey ? t(errorKey) : null;
  };
  
  const validateCurrentWeight = (): string | null => {
    const raw = currentWeightUnit === 'kg' ? parseFloat(currentWeightKg) : parseFloat(currentWeightLb);
    const weightKgValue = isNaN(raw) || raw <= 0 ? null : (currentWeightUnit === 'kg' ? raw : lbToKg(raw));
    const errorKey = validateWeightKgUtil(weightKgValue);
    if (errorKey) return t(errorKey);

    const bf = currentBodyFatPercent.trim().length > 0 ? parseFloat(currentBodyFatPercent) : null;
    const bfError = validateBodyFatPercentUtil(bf);
    if (bfError) return bfError;

    return null;
  };
  
  const validateGoalWeight = (): { i18nKey: string; i18nParams?: Record<string, any> } | null => {
    // Get current weight in lb
    let currentWeightLbValue: number;
    if (currentWeightUnit === 'kg') {
      const kg = parseFloat(currentWeightKg) || 0;
      currentWeightLbValue = kgToLb(kg);
    } else {
      currentWeightLbValue = parseFloat(currentWeightLb) || 0;
    }

    // Get target weight input
    const targetInput = goalWeightUnit === 'kg' 
      ? parseFloat(goalWeightKg) 
      : parseFloat(goalWeightLb);

    if (!goal || !currentWeightLbValue || isNaN(targetInput)) {
      return null;
    }

    // Use new validator
    const result = validateGoalWeightNew({
      currentWeightLb: currentWeightLbValue,
      goalType: goal as 'lose' | 'gain' | 'maintain' | 'recomp',
      weightUnit: goalWeightUnit === 'kg' ? 'kg' : 'lbs',
      targetInput: targetInput,
    });

    if (!result.ok) {
      return {
        i18nKey: result.i18nKey,
        i18nParams: result.i18nParams,
      };
    }

    return null;
  };
  
  /**
   * Build draft from current form state
   */
  const buildDraft = (): OnboardingDraft => {
    const draft: OnboardingDraft = {};
    
    // Step 1: Name and DOB
    if (preferredName) {
      const normalized = normalizeSpaces(preferredName);
      if (normalized) {
        draft.first_name = normalized;
      }
    }
    if (dateOfBirthStep2) {
      draft.date_of_birth = dateOfBirthStep2;
    }
    
    // Step 2: Sex
    if (sex === 'male' || sex === 'female') {
      draft.gender = sex;
    }
    
    // Step 3: Height
    const heightCmValue = getHeightInCm();
    if (heightCmValue !== null) {
      draft.height_cm = heightCmValue;
      draft.height_unit = heightUnit === 'ft/in' ? 'ft' : heightUnit;
    }
    
    // Step 4: Activity Level
    if (activityLevel && ['sedentary', 'light', 'moderate', 'high', 'very_high'].includes(activityLevel)) {
      draft.activity_level = activityLevel as 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';
    }
    
    // Step 5: Current Weight
    if (currentWeightUnit === 'kg' && currentWeightKg) {
      const kg = parseFloat(currentWeightKg);
      if (!isNaN(kg) && kg > 0) {
        draft.weight_lb = roundTo3(kgToLb(kg));
        draft.weight_unit = 'kg';
      }
    } else if (currentWeightUnit === 'lb' && currentWeightLb) {
      const lb = parseFloat(currentWeightLb);
      if (!isNaN(lb) && lb > 0) {
        draft.weight_lb = roundTo3(lb);
        draft.weight_unit = 'lbs';
      }
    }
    if (currentBodyFatPercent && currentBodyFatPercent.trim().length > 0) {
      const bf = parseFloat(currentBodyFatPercent);
      if (!isNaN(bf) && bf > 0) {
        draft.body_fat_percent = roundTo2(bf);
      }
    }
    
    // Step 6: Goal
    if (goal && ['lose', 'maintain', 'gain', 'recomp'].includes(goal)) {
      draft.goal_type = goal as 'lose' | 'maintain' | 'gain' | 'recomp';
    }
    
    // Step 7: Goal Weight
    if (goalWeightUnit === 'kg' && goalWeightKg) {
      const kg = parseFloat(goalWeightKg);
      if (!isNaN(kg) && kg > 0) {
        draft.goal_weight_lb = roundTo3(kgToLb(kg));
      }
    } else if (goalWeightUnit === 'lb' && goalWeightLb) {
      const lb = parseFloat(goalWeightLb);
      if (!isNaN(lb) && lb > 0) {
        draft.goal_weight_lb = roundTo3(lb);
      }
    }
    
    // Step 8: Timeline
    if (timelineOption && ['3_months', '6_months', '12_months', 'no_deadline', 'custom_date'].includes(timelineOption)) {
      draft.goal_timeframe = timelineOption as '3_months' | '6_months' | '12_months' | 'no_deadline' | 'custom_date';
    }
    if (customTargetDate) {
      draft.goal_target_date = customTargetDate;
    }
    
    // Step 9: Daily Calorie Target - only include if explicitly set (not null/undefined)
    // Using daily_calorie_target (existing column name)
    if (calorieTarget !== null && calorieTarget !== undefined) {
      draft.daily_calorie_target = calorieTarget;
    }
    if (maintenanceCalories !== null && maintenanceCalories !== undefined) {
      draft.maintenance_calories = maintenanceCalories;
    }
    if (caloriePlan && typeof caloriePlan === 'string' && caloriePlan.trim().length > 0) {
      draft.calorie_plan = caloriePlan;
      draft.onboarding_calorie_set_at = new Date().toISOString();
    }
    
    return draft;
  };
  
  const validateTimeline = (): string | null => {
    const errorKey = validateTimelineUtil(timelineOption, customTargetDate || null);
    return errorKey ? t(errorKey) : null;
  };
  
  const validateGoal = (): string | null => {
    const errorKey = validateGoalUtil(goal);
    return errorKey ? t(errorKey) : null;
  };
  
  const handleGoalNext = () => {
    const startTime = performance.now();
    clearErrors();
    
    // Validate Goal step
    const validationError = validateGoal();
    if (validationError) {
      setErrorText(validationError);
      return;
    }
    
    if (!user) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Build draft and schedule background save
    const draft = buildDraft();
    setSyncStatus('saving');
    scheduleDraftSave(draft, user.id, queryClient, 'step_goal');
    
    // Move to next step immediately (optimistic)
    setCurrentStep(7);
    
    // Update sync status after a short delay (background save will complete)
    setTimeout(() => {
      const { error } = getLastDraftError();
      if (error) {
        setSyncStatus('error');
        lastSyncErrorRef.current = error;
      } else {
        setSyncStatus('idle');
        setLastSavedAt(Date.now());
      }
    }, 100);
  };
  
  const handleNameAgeNext = () => {
    const startTime = performance.now();
    clearErrors();
    
    // Validate Step 2
    const validationError = validateNameAge();
    if (validationError) {
      setErrorText(validationError);
      return;
    }
    
    if (!user) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Upload avatar in background (fire-and-forget, don't block)
    if (avatarUri && user) {
      uploadUserAvatar({ userId: user.id, sourceUri: avatarUri })
        .then(({ cacheBustedUrl }) => setProfileAvatarUrl({ userId: user.id, avatarUrl: cacheBustedUrl }))
        .catch((error) => {
          console.error('Failed to upload avatar', error);
          // Do not block onboarding if avatar upload fails
        });
    }

    // Build draft and schedule background save
    const draft = buildDraft();
    setSyncStatus('saving');
    scheduleDraftSave(draft, user.id, queryClient, 'step_name_age');
    
    // Move to next step immediately (optimistic)
    setCurrentStep(2);
    
    // Update sync status after a short delay
    setTimeout(() => {
      const { error } = getLastDraftError();
      if (error) {
        setSyncStatus('error');
        lastSyncErrorRef.current = error;
      } else {
        setSyncStatus('idle');
        setLastSavedAt(Date.now());
      }
    }, 100);
  };
  
  const handleSexNext = () => {
    const startTime = performance.now();
    clearErrors();
    
    // Validate Step 3
    const validationError = validateSex();
    if (validationError) {
      setErrorText(validationError);
      return;
    }
    
    if (!user) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Build draft and schedule background save
    const draft = buildDraft();
    setSyncStatus('saving');
    scheduleDraftSave(draft, user.id, queryClient, 'step_sex');
    
    // Move to next step immediately (optimistic)
    setCurrentStep(3);
    
    setTimeout(() => {
      const { error } = getLastDraftError();
      if (error) {
        setSyncStatus('error');
        lastSyncErrorRef.current = error;
      } else {
        setSyncStatus('idle');
        setLastSavedAt(Date.now());
      }
    }, 100);
  };
  
  const handleHeightNext = () => {
    const startTime = performance.now();
    clearErrors();
    
    // Validate Step 4
    const validationError = validateHeight();
    if (validationError) {
      setErrorText(validationError);
      return;
    }
    
    if (!user) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Build draft and schedule background save
    const draft = buildDraft();
    setSyncStatus('saving');
    scheduleDraftSave(draft, user.id, queryClient, 'step_height');
    
    // Move to next step immediately (optimistic)
    setCurrentStep(4);
    
    setTimeout(() => {
      const { error } = getLastDraftError();
      if (error) {
        setSyncStatus('error');
        lastSyncErrorRef.current = error;
      } else {
        setSyncStatus('idle');
        setLastSavedAt(Date.now());
      }
    }, 100);
  };
  
  const handleActivityNext = () => {
    const startTime = performance.now();
    clearErrors();
    
    // Validate Step 5
    const validationError = validateActivity();
    if (validationError) {
      setErrorText(validationError);
      return;
    }
    
    if (!user) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Build draft and schedule background save
    const draft = buildDraft();
    setSyncStatus('saving');
    scheduleDraftSave(draft, user.id, queryClient, 'step_activity');
    
    // Move to next step immediately (optimistic)
    setCurrentStep(5);
    
    setTimeout(() => {
      const { error } = getLastDraftError();
      if (error) {
        setSyncStatus('error');
        lastSyncErrorRef.current = error;
      } else {
        setSyncStatus('idle');
        setLastSavedAt(Date.now());
      }
    }, 100);
  };
  
  const handleCurrentWeightNext = () => {
    const startTime = performance.now();
    clearErrors();
    
    // Validate Step 6
    const validationError = validateCurrentWeight();
    if (validationError) {
      setErrorText(validationError);
      return;
    }
    
    if (!user) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Save weight log in background (fire-and-forget, don't block)
    let weightLbValue: number;
    if (currentWeightUnit === 'kg') {
      const kg = parseFloat(currentWeightKg);
      weightLbValue = kgToLb(kg);
    } else {
      weightLbValue = parseFloat(currentWeightLb);
    }
    const storedWeightLb = roundTo3(weightLbValue);
    const storedBodyFat =
      currentBodyFatPercent && currentBodyFatPercent.trim().length > 0
        ? roundTo2(parseFloat(currentBodyFatPercent))
        : null;

    insertWeightLogAndUpdateProfile({
      userId: user.id,
      weighedAt: new Date(),
      weightLb: storedWeightLb,
      bodyFatPercent: storedBodyFat,
      weightUnit: currentWeightUnit,
    }).catch((logError) => {
      console.error('Weight log insert failed, falling back to draft save', logError);
      // Draft save will handle the profile update
    });
    
    // Build draft and schedule background save
    const draft = buildDraft();
    // IMPORTANT: Explicitly persist body_fat_percent even when blank (null) so the DB clears it.
    // The weight-log path intentionally skips profile updates when bodyFatPercent is null.
    draft.body_fat_percent = storedBodyFat;
    setSyncStatus('saving');
    scheduleDraftSave(draft, user.id, queryClient, 'step_current_weight');
    
    // Move to next step immediately (optimistic)
    setCurrentStep(6);
    
    setTimeout(() => {
      const { error } = getLastDraftError();
      if (error) {
        setSyncStatus('error');
        lastSyncErrorRef.current = error;
      } else {
        setSyncStatus('idle');
        setLastSavedAt(Date.now());
      }
    }, 100);
  };
  
  const handleGoalWeightNext = () => {
    const startTime = performance.now();
    clearErrors();
    
    // Validate Step 7
    const validationResult = validateGoalWeight();
    if (validationResult) {
      setErrorI18n(validationResult.i18nKey, validationResult.i18nParams);
      return;
    }
    
    if (!user) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Build draft and schedule background save
    const draft = buildDraft();
    setSyncStatus('saving');
    scheduleDraftSave(draft, user.id, queryClient, 'step_goal_weight');
    
    // Move to next step immediately (optimistic)
    setCurrentStep(8);
    
    setTimeout(() => {
      const { error } = getLastDraftError();
      if (error) {
        setSyncStatus('error');
        lastSyncErrorRef.current = error;
      } else {
        setSyncStatus('idle');
        setLastSavedAt(Date.now());
      }
    }, 100);
  };
  
  const handleTimelineNext = () => {
    clearErrors();
    
    // Validate timeline step
    const validationError = validateTimeline();
    if (validationError) {
      setErrorText(validationError);
      return;
    }
    
    if (!user) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Build draft with timeline fields and schedule background save (fire-and-forget)
    const draft = buildDraft();
    setSyncStatus('saving');
    scheduleDraftSave(draft, user.id, queryClient, 'step_timeline');
    
    // Move to next step immediately (optimistic, no blocking)
    setCurrentStep(9);
    
    setTimeout(() => {
      const { error } = getLastDraftError();
      if (error) {
        setSyncStatus('error');
        lastSyncErrorRef.current = error;
      } else {
        setSyncStatus('idle');
        setLastSavedAt(Date.now());
      }
    }, 100);
  };
  
  const handleCalorieTargetNext = () => {
    clearErrors();
    
    // Validate calorie target is set (all goals)
    // HARD_HARD_STOP (700) is the only absolute blocker.
    if (calorieTarget === null || !isFinite(calorieTarget) || calorieTarget < 700 || maintenanceCalories === null || caloriePlan === null) {
      setErrorText('Please select a calorie target.');
      return;
    }
    
    if (!user) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Schedule background save of calorie target (fire-and-forget)
    const draft = buildDraft();
    setSyncStatus('saving');
    scheduleDraftSave(draft, user.id, queryClient, 'step_calorie_target');
    
    // Move to next step immediately (optimistic, no blocking)
    // Step 9 is Daily Focus Targets (TimelineStep was removed)
    setCurrentStep(9);
    
    setTimeout(() => {
      const { error } = getLastDraftError();
      if (error) {
        setSyncStatus('error');
        lastSyncErrorRef.current = error;
        console.error('Async calorie target save failed:', error);
      } else {
        setSyncStatus('idle');
        setLastSavedAt(Date.now());
      }
    }, 100);
  };
  
  const handleNext = () => {
    clearErrors();
    
    if (currentStep === 1) {
      // Name & Age step
      handleNameAgeNext();
    } else if (currentStep === 2) {
      // Sex step
      handleSexNext();
    } else if (currentStep === 3) {
      // Height step
      handleHeightNext();
    } else if (currentStep === 4) {
      // Activity level step
      handleActivityNext();
    } else if (currentStep === 5) {
      // Current weight step
      handleCurrentWeightNext();
    } else if (currentStep === 6) {
      // Goal step - handle separately to save goal_type
      handleGoalNext();
    } else if (currentStep === 7) {
      // Goal weight step
      handleGoalWeightNext();
    } else if (currentStep === 8) {
      // Daily calorie target step - navigate to focus targets step (async save)
      // TimelineStep was removed, so this is now step 8
      handleCalorieTargetNext();
    } else if (currentStep === 9) {
      // Daily focus targets step - handled by handleCompleteOnboarding
      handleCompleteOnboarding();
    }
  };
  
  const shouldDisableNext = (): boolean => {
    if (currentStep === 1) {
      return !dateOfBirthStep2 || dateOfBirthStep2.trim().length === 0;
    } else if (currentStep === 2) {
      return !sex || (sex !== 'male' && sex !== 'female');
    } else if (currentStep === 3) {
      // Check if height is valid
      if (heightUnit === 'cm') {
        const cm = parseFloat(heightCm);
        return isNaN(cm) || cm <= 0 || cm < PROFILES.HEIGHT_CM.MIN || cm > PROFILES.HEIGHT_CM.MAX;
      } else {
        const ft = parseFloat(heightFt);
        const inches = parseFloat(heightIn);
        if (isNaN(ft) || isNaN(inches) || ft <= 0) return true;
        const totalInches = ft * 12 + inches;
        const cmValue = totalInches * 2.54;
        return cmValue < PROFILES.HEIGHT_CM.MIN || cmValue > PROFILES.HEIGHT_CM.MAX;
      }
    } else if (currentStep === 4) {
      return !activityLevel || (activityLevel !== 'sedentary' && activityLevel !== 'light' && activityLevel !== 'moderate' && activityLevel !== 'high' && activityLevel !== 'very_high');
    } else if (currentStep === 5) {
      // Check if current weight is valid
      if (currentWeightUnit === 'kg') {
        const kg = parseFloat(currentWeightKg);
        return isNaN(kg) || kg <= 0 || kg < DERIVED.WEIGHT_KG.MIN || kg > DERIVED.WEIGHT_KG.MAX;
      } else {
        const lbs = parseFloat(currentWeightLb);
        if (isNaN(lbs) || lbs <= 0) return true;
        // Compare pounds directly against PROFILES.WEIGHT_LB to avoid floating-point conversion errors
        return lbs < PROFILES.WEIGHT_LB.MIN || lbs > PROFILES.WEIGHT_LB.MAX;
      }

      if (currentBodyFatPercent) {
        const bf = parseFloat(currentBodyFatPercent);
        if (isNaN(bf) || bf <= 0 || bf > PROFILES.BODY_FAT_PERCENT.MAX) return true;
      }
    } else if (currentStep === 6) {
      return !goal;
    } else if (currentStep === 7) {
      // Check if goal weight is valid (basic validation, detailed validation happens on submit)
      if (goalWeightUnit === 'kg') {
        const kg = parseFloat(goalWeightKg);
        return isNaN(kg) || kg <= 0 || kg < DERIVED.WEIGHT_KG.MIN || kg > DERIVED.WEIGHT_KG.MAX;
      } else {
        const lbs = parseFloat(goalWeightLb);
        if (isNaN(lbs) || lbs <= 0) return true;
        // Compare pounds directly against PROFILES.WEIGHT_LB to avoid floating-point conversion errors
        return lbs < PROFILES.WEIGHT_LB.MIN || lbs > PROFILES.WEIGHT_LB.MAX;
      }
    } else if (currentStep === 8) {
      // Daily Calorie Target step (TimelineStep was removed)
      // Validate: calorieTarget must be >= 700 (HARD_HARD_STOP) and finite
      // Do NOT require >= 1200 or soft floors - those are warnings, not blockers
      if (calorieTarget === null || !isFinite(calorieTarget) || calorieTarget < 700) {
        return true; // Disable Next
      }
      // Also require maintenanceCalories and caloriePlan to be set
      return maintenanceCalories === null || caloriePlan === null;
    } else if (currentStep === 9) {
      // Daily Focus Targets step
      return !dailyTargets;
    }
    return false;
  };
  
  const handleBack = () => {
    clearErrors();
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleCompleteOnboarding = async () => {
    const startTime = performance.now();
    clearErrors();
    
    // Guard: Don't start mutation if tab is not visible (web only)
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      setErrorText('Please make sure the tab is visible before continuing.');
      return;
    }
    
    // Validate targets are set
    if (!dailyTargets) {
      setErrorText('Please set your daily focus targets.');
      return;
    }
    
    // Validate timeline step (should already be saved, but validate for safety)
    const validationError = validateTimeline();
    if (validationError) {
      setErrorText(validationError);
      return;
    }
    
    if (!user || !profile) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Gather required data for calculations
    if (!profile.date_of_birth) {
      setErrorText('Date of birth is required. Please go back and complete Step 1.');
      return;
    }
    
    const ageNum = ageFromDob(profile.date_of_birth);
    const heightCmValue = parseFloat(heightCm) || (profile.height_cm as number);
    
    // Get weights in kg
    let currentWeightKgValue: number;
    let goalWeightKgValue: number;
    
    if (currentWeightUnit === 'kg') {
      currentWeightKgValue = parseFloat(currentWeightKg);
    } else {
      currentWeightKgValue = lbToKg(parseFloat(currentWeightLb));
    }
    
    if (goalWeightUnit === 'kg') {
      goalWeightKgValue = parseFloat(goalWeightKg);
    } else {
      goalWeightKgValue = lbToKg(parseFloat(goalWeightLb));
    }
    
    if (!ageNum || !heightCmValue || !currentWeightKgValue || !goalWeightKgValue || !activityLevel || !sex || !goal) {
      setErrorText('Missing required information. Please complete all previous steps.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Calculate BMR and TDEE
      const bmr = calculateBMR(currentWeightKgValue, heightCmValue, ageNum, sex as 'male' | 'female');
      const tdee = calculateTDEE(bmr, activityLevel as ActivityLevel);
      
      // Calculate timeline in weeks
      let weeksToGoal: number | null = null;
      let targetDate: string | null = null;
      
      if (timelineOption === '3_months') {
        weeksToGoal = 12;
      } else if (timelineOption === '6_months') {
        weeksToGoal = 26;
      } else if (timelineOption === '12_months') {
        weeksToGoal = 52;
      } else if (timelineOption === 'custom_date' && customTargetDate) {
        const targetDateObj = new Date(customTargetDate);
        const today = new Date();
        const diffTime = targetDateObj.getTime() - today.getTime();
        weeksToGoal = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
        targetDate = customTargetDate;
        if (weeksToGoal < 1) weeksToGoal = null;
      }
      
      // Calculate required daily calorie difference
      let dailyCalorieDiff = 0;
      if (weeksToGoal && weeksToGoal > 0) {
        dailyCalorieDiff = calculateRequiredDailyCalorieDiff(currentWeightKgValue, goalWeightKgValue, weeksToGoal);
      } else {
        // No deadline - use mild deficit/surplus based on goal
        if (goal === 'lose') {
          dailyCalorieDiff = -250;
        } else if (goal === 'gain') {
          dailyCalorieDiff = 250;
        } else {
          dailyCalorieDiff = 0;
        }
      }
      
      // Calculate safe calorie target with safety limits
      const { targetCalories, adjustedDailyDiff, warningMessage } = calculateSafeCalorieTarget(
        tdee,
        dailyCalorieDiff,
        sex as 'male' | 'female'
      );
      
      // Step 1: Flush draft save (ensures all intermediate steps are saved)
      try {
        const draft = buildDraft();
        await flushDraftSave(draft, user.id, queryClient);
      } catch (error: any) {
        setErrorText('Failed to save your information. Please try again.');
        setLoading(false);
        return; // Keep user on final step
      }
      
      // Step 2: Final profile update with calculated values, targets, timeline fields, and onboarding_complete=true
      // Use calorie target from step 9 if available, otherwise fall back to calculated targetCalories
      const finalCalorieTarget = calorieTarget !== null ? calorieTarget : targetCalories;
      const finalMaintenanceCalories = maintenanceCalories !== null ? maintenanceCalories : targetCalories;
      
      // Map UI plan names to database values
      const mapCaloriePlanToDb = (plan: string | null): string => {
        if (!plan) return 'calculated';
        switch (plan) {
          case 'onTime':
            return 'calculated';
          case 'sustainable':
            return 'recommended';
          case 'accelerated':
            return 'aggressive';
          case 'custom':
            return 'custom';
          default:
            return 'calculated';
        }
      };
      
      const finalCaloriePlan = mapCaloriePlanToDb(caloriePlan);
      
       const updateData: Record<string, any> = {
         daily_calorie_target: finalCalorieTarget,
         goal_target_date: targetDate,
         goal_timeframe: timelineOption,
         onboarding_complete: true,
       };
       
       // Add optional fields only if they exist in schema (will be added via migration)
       // For now, only include fields that definitely exist
       if (finalMaintenanceCalories !== null) {
         updateData.maintenance_calories = finalMaintenanceCalories;
       }
       if (finalCaloriePlan) {
         updateData.calorie_plan = finalCaloriePlan;
         updateData.onboarding_calorie_set_at = new Date().toISOString();
       }
       if (dailyTargets) {
         updateData.protein_g_min = dailyTargets.proteinGMin;
         updateData.fiber_g_min = dailyTargets.fiberGMin;
         updateData.carbs_g_max = dailyTargets.carbsGMax;
         updateData.sugar_g_max = dailyTargets.sugarGMax;
         updateData.sodium_mg_max = dailyTargets.sodiumMgMax;
         updateData.water_goal_ml = dailyTargets.waterMlTarget; // Using existing column name
         updateData.onboarding_targets_set_at = new Date().toISOString();
       }
      
      // Perform final mutation with timeout and retry support
      const mutationStart = performance.now();
      const MUTATION_TIMEOUT_MS = 5000; // 5 second timeout
      
      const mutationPromise = updateProfile(user.id, updateData);
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), MUTATION_TIMEOUT_MS);
      });
      
      let updatedProfile: any | null = null;
      try {
        updatedProfile = await Promise.race([mutationPromise, timeoutPromise]);
      } catch (error: any) {
        if (error.message === 'TIMEOUT') {
          // Timeout occurred - show retry option
          const mutationTime = performance.now() - mutationStart;
          console.warn(`[handleCompleteOnboarding] Final mutation timeout after ${mutationTime.toFixed(2)}ms`);
          setErrorText('Network is waking up... Please try again.');
          setLoading(false);
          return; // Allow user to retry by clicking Next again
        }
        throw error; // Re-throw other errors
      }
      
      const mutationTime = performance.now() - mutationStart;
      
      if (!updatedProfile) {
        throw new Error('Failed to save profile');
      }
      
      // Update cache with final profile
      queryClient.setQueryData(['userProfile', user.id], updatedProfile);
      
      // Also refresh profile in AuthContext (fire-and-forget)
      refreshProfile().catch(() => {}); // Fire-and-forget
      
      // Show warning if pace was adjusted
      if (warningMessage) {
        Alert.alert('Pace Adjusted', warningMessage);
      }
      
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to complete onboarding. Please try again.';
      setErrorText(errorMessage);
      setLoading(false);
    }
  };
  
  return {
    // State
    currentStep,
    totalSteps,
    goal,
    setGoal,
    showAdvancedGoals,
    setShowAdvancedGoals,
    avatarUri,
    setAvatarUri,
    preferredName,
    dateOfBirthStep2,
    selectedDateStep2,
    showDatePickerStep2,
    setShowDatePickerStep2,
    sex,
    setSex,
    heightCm,
    setHeightCm,
    heightFt,
    setHeightFt,
    heightIn,
    setHeightIn,
    heightUnit,
    setHeightUnit,
    activityLevel,
    setActivityLevel,
    currentWeightKg,
    setCurrentWeightKg,
    currentWeightLb,
    setCurrentWeightLb,
    currentWeightUnit,
    setCurrentWeightUnit,
    currentBodyFatPercent,
    setCurrentBodyFatPercent,
    goalWeightKg,
    setGoalWeightKg,
    goalWeightLb,
    setGoalWeightLb,
    goalWeightUnit,
    setGoalWeightUnit,
    timelineOption,
    setTimelineOption,
    customTargetDate,
    setCustomTargetDate,
    calorieTarget,
    maintenanceCalories,
    caloriePlan,
    calorieExecutionMode,
    setCalorieTarget,
    setMaintenanceCalories,
    setCaloriePlan,
    setCalorieExecutionMode,
    dailyTargets,
    setDailyTargets,
    loading,
    errorText,
    errorKey,
    errorParams,
    isDesktop,
    
    // Draft sync status (for debugging, not shown in UI except final step)
    syncStatus,
    lastSavedAt,
    
    // Goal weight suggestion (derived, not state)
    goalWeightSuggestion,
    
    // Error handlers
    setErrorText,
    setErrorI18n,
    clearErrors,
    
    // Unit conversion setters
    setWeightUnit,
    setGoalWeightUnitWithConversion,
    setHeightUnitWithConversion,
    
    // Display getters
    getCurrentWeightDisplay,
    getGoalWeightDisplay,
    
    // Handlers
    handlePreferredNameChange,
    handlePreferredNameBlur,
    handleOpenDatePickerStep2,
    handleDateOfBirthChange,
    getDOBMinDate,
    getDOBMaxDate,
    handleNext,
    handleBack,
    handleCompleteOnboarding,
    shouldDisableNext,
  };
}

