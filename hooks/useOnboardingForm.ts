import type { DailyFocusTargets } from '@/components/onboarding/steps/DailyFocusTargetsStep';
import { showAppToast } from '@/components/ui/app-toast';
import { DERIVED, POLICY, PROFILES } from '@/constants/constraints';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { userConfigQueryKey } from '@/hooks/use-user-config';
import { setProfileAvatarUrl, uploadUserAvatar } from '@/lib/avatar/avatar-service';
import { acceptActiveLegalDocuments, fetchActiveLegalDocuments } from '@/lib/legal/legal-db';
import { mapCaloriePlanToDb } from '@/lib/onboarding/calorie-plan';
import { getSuggestedTargetWeightLb } from '@/lib/onboarding/goal-weight-rules';
import { validateGoalWeight as validateGoalWeightNew } from '@/lib/onboarding/goal-weight-validation';
import {
  flushDraftSave,
  getLastDraftError,
  scheduleDraftSave,
  type OnboardingDraft
} from '@/lib/onboarding/onboarding-draft-sync';
import { onboardingFlagStore } from '@/lib/onboardingFlagStore';
import { setPersistentCache } from '@/lib/persistentCache';
import { insertWeightLogAndUpdateProfile } from '@/lib/services/weightLog';
import {
  convertHeightToCm,
  kgToLb,
  lbToKg,
  roundTo1,
  roundTo2,
  roundTo3,
} from '@/utils/bodyMetrics';
import { ActivityLevel, ageFromDob, calculateBMR, calculateSafeCalorieTarget, calculateTDEE } from '@/utils/calculations';
import {
  filterPreferredNameInput,
  normalizeSpaces
} from '@/utils/inputFilters';
import { checkProfanity } from '@/utils/profanity';
import {
  validateActivityLevel as validateActivityLevelUtil,
  validateBodyFatPercent as validateBodyFatPercentUtil,
  validateDateOfBirth,
  validateGoal as validateGoalUtil,
  validateHeightCm as validateHeightCmUtil,
  validatePreferredName,
  validateSex as validateSexUtil,
  validateWeightKg as validateWeightKgUtil
} from '@/utils/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Dimensions, Platform } from 'react-native';

type GoalType = 'lose' | 'maintain' | 'gain' | 'recomp';
type ModulePreference = 'Exercise' | 'Med' | 'Water';
type PlanSelection = 'free' | 'premium';

export function useOnboardingForm() {
  const { t } = useTranslation();
  const { user, loading: authLoading, refreshProfile, profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 12; // Steps 1-12: ... Daily Focus Targets, Module Preferences, Plan, Legal Agreement
  
  // Container type is only defined in web builds; in native it will be empty.
  const containerType = useMemo(() => {
    if (Platform.OS !== 'web') return '';
    if (typeof window === 'undefined') return '';
    return String((window as any).__AVOVIBE_CONTAINER__?.type ?? '');
  }, []);

  // Native onboarding WebView only: skip Plan step (step 11).
  const skipPlanStep = containerType === 'native_onboarding';

  const isNativeWrapperWeb = containerType === 'native' || containerType === 'native_onboarding';

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

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
  
  // Step 8: Daily Calorie Target
  const [calorieTarget, setCalorieTarget] = useState<number | null>(null);
  const [maintenanceCalories, setMaintenanceCalories] = useState<number | null>(null);
  const [caloriePlan, setCaloriePlan] = useState<string | null>(null);
  const [calorieExecutionMode, setCalorieExecutionMode] = useState<'override' | undefined>(undefined);
  
  // Step 9: Daily Focus Targets
  const [dailyTargets, setDailyTargets] = useState<DailyFocusTargets | null>(null);

  // Step 10: Module Preferences (tap-to-rank Top 2; Food is implied as #1)
  const [modulePreferences, setModulePreferences] = useState<ModulePreference[]>([]);
  const modulePrefsPrefilledRef = useRef(false);

  // Step 11: Plan (fake premium) — local-only
  const [selectedPlan, setSelectedPlan] = useState<PlanSelection>('free');
  const [premiumInsisted, setPremiumInsisted] = useState(false);
  
  // Step 10: Legal Agreement
  const [legalAgreeTerms, setLegalAgreeTerms] = useState(false);
  const [legalAgreePrivacy, setLegalAgreePrivacy] = useState(false);
  const [legalAcknowledgeRisk, setLegalAcknowledgeRisk] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Prefill module preferences for back navigation / returning users
  useEffect(() => {
    if (modulePrefsPrefilledRef.current) return;
    if (!profile) return;

    const picks: ModulePreference[] = [];
    const add = (value: any) => {
      if ((value === 'Exercise' || value === 'Med' || value === 'Water') && !picks.includes(value)) {
        picks.push(value);
      }
    };
    add(profile.focus_module_2);
    add(profile.focus_module_3);

    modulePrefsPrefilledRef.current = true;
    setModulePreferences(picks.slice(0, 2));
  }, [profile]);

  // Guard: in native onboarding WebView, never allow Plan step to render/stick.
  useEffect(() => {
    if (!skipPlanStep) return;
    if (currentStep !== 11) return;
    goToStep(12);
  }, [currentStep, goToStep, skipPlanStep]);

  // Canonical profile update mutation (React Query) per engineering guidelines
  const updateProfileMutation = useUpdateProfile();
  
  // Redirect to login if no user
  useEffect(() => {
    // Avoid redirect churn while auth is still initializing (especially in native-wrapper mode
    // where a session may be bridged in moments after initial render).
    if (authLoading) return;
    if (!user) {
      // In the native WebView wrapper, web login must never appear. Request native session instead
      // and let the wrapper bridge apply it (or bounce to native login if needed).
      if (isNativeWrapperWeb) {
        (window as any).ReactNativeWebView?.postMessage?.('REQUEST_NATIVE_SESSION');
        return;
      }
      router.replace('/login');
    }
  }, [authLoading, isNativeWrapperWeb, user, router]);
  
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
    
    // Date of Birth validation (uses shared policy defaults from constants/constraints.ts)
    const dobErrorKey = validateDateOfBirth(dateOfBirthStep2);
    if (dobErrorKey) {
      return t(dobErrorKey);
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
  // Note: AppDatePicker now handles closing the modal via onClose callback
  // This handler only updates the date value
  const handleDateOfBirthChange = (date: Date) => {
    updateDateOfBirthStep2(date);
    // Modal closing is handled by AppDatePicker's "Select Date" button via onClose callback
  };
  
  // Calculate min/max dates for DOB using policy constraints
  const getDOBMinDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - POLICY.DOB.MAX_AGE_YEARS);
    return date;
  };
  
  const getDOBMaxDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - POLICY.DOB.MIN_AGE_YEARS);
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
    
    // Step 8: Daily Calorie Target - only include if explicitly set (not null/undefined)
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
      // Daily focus targets step - proceed to module preferences step
      goToStep(10);
    } else if (currentStep === 10) {
      // Module preferences step - save focus modules (Food is implied as #1), then proceed to legal
      if (user) {
        // Default priority order (fallback list): Exercise, Med, Water
        const fallbackOrder: ModulePreference[] = ['Exercise', 'Med', 'Water'];
        
        // Get user selections (ordered, max 2, excluding 'Food')
        const selected = modulePreferences.slice(0, 2).filter((m): m is ModulePreference => 
          m === 'Exercise' || m === 'Med' || m === 'Water'
        );

        let focus2: 'Exercise' | 'Med' | 'Water';
        let focus3: 'Exercise' | 'Med' | 'Water';

        if (selected.length === 2) {
          // User selected 2 modules: use them as-is
          focus2 = selected[0];
          focus3 = selected[1];
        } else if (selected.length === 1) {
          // User selected 1 module: use it for focus2, use first fallback that is NOT equal to it for focus3
          focus2 = selected[0];
          focus3 = fallbackOrder.find((m) => m !== selected[0]) ?? 'Med';
        } else {
          // User selected 0 modules: use defaults (Exercise, Med)
          focus2 = 'Exercise';
          focus3 = 'Med';
        }

        // Guardrail: ensure focus_module_2 !== focus_module_3 always
        if (focus2 === focus3) {
          // If somehow they're equal, use the fallback order
          focus2 = 'Exercise';
          focus3 = 'Med';
        }

        // Fire-and-forget: do not block Next
        updateProfileMutation.mutate({
          focus_module_1: 'Food',
          focus_module_2: focus2,
          focus_module_3: focus3,
        });
      }
      goToStep(skipPlanStep ? 12 : 11);
    } else if (currentStep === 11) {
      // Plan step - proceed to legal (toast nudge if Premium selected)
      if (selectedPlan === 'premium' && !premiumInsisted) {
        // Non-blocking: user still proceeds.
        const { showAppToast } = require('@/components/ui/app-toast');
        showAppToast(t('onboarding.plan.premium_next_nudge'));
      }
      goToStep(12);
    } else if (currentStep === 12) {
      // Legal agreement step - handled by handleProceedToLegal
      handleProceedToLegal();
    }
  };
  
  const shouldDisableNext = (): boolean => {
    if (currentStep === 1) {
      // Name & DOB step: require both fields to have input before enabling Next
      const hasName = preferredName.trim().length > 0;
      const hasDob = dateOfBirthStep2.trim().length > 0;
      return !hasName || !hasDob;
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
    } else if (currentStep === 10) {
      // Module Preferences step - user can proceed with 0 selections
      return false;
    } else if (currentStep === 11) {
      // Plan step - only allow Next when Free is selected
      return selectedPlan !== 'free';
    } else if (currentStep === 12) {
      // Legal Agreement step - all three checkboxes must be checked
      return !legalAgreeTerms || !legalAgreePrivacy || !legalAcknowledgeRisk;
    }
    return false;
  };
  
  const handleBack = () => {
    clearErrors();
    if (skipPlanStep && currentStep === 12) {
      goToStep(10);
      return;
    }
    if (currentStep > 1) goToStep(currentStep - 1);
  };
  
  const handleCompleteOnboarding = async (options?: { markComplete?: boolean; navigateTo?: string }) => {
    const markComplete = options?.markComplete ?? true;
    const destination = options?.navigateTo ?? '/(tabs)';

    const startTime = performance.now();
    clearErrors();
    
    // Guard: prevent multiple submissions
    if (isSubmitting) {
      return;
    }
    
    // Guard: Don't start mutation if tab is not visible (web only)
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      setErrorText('Please make sure the tab is visible before continuing.');
      return;
    }
    
    // Validate legal checkboxes if marking complete
    if (markComplete) {
      if (!legalAgreeTerms || !legalAgreePrivacy || !legalAcknowledgeRisk) {
        setErrorText(t('onboarding.legal.error_all_required'));
        return;
      }
    }
    
    // Validate targets are set
    if (!dailyTargets) {
      setErrorText('Please set your daily focus targets.');
      return;
    }
    
    if (!user || !profile) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Begin submission - set both loading states
    setIsSubmitting(true);
    setLoading(true);
    
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
    
    
    try {
      // If marking complete, accept legal documents first
      if (markComplete) {
        // Fetch active legal documents
        const activeDocs = await fetchActiveLegalDocuments();
        
        if (!activeDocs || activeDocs.length === 0) {
          setErrorText(t('onboarding.legal.error_no_docs'));
          setIsSubmitting(false);
          setLoading(false);
          return;
        }
        
        // Insert acceptances into user_legal_acceptances
        await acceptActiveLegalDocuments({
          userId: user.id,
          docs: activeDocs.map(d => ({ doc_type: d.doc_type, version: d.version })),
        });
      }
      
      // Calculate BMR and TDEE
      const bmr = calculateBMR(currentWeightKgValue, heightCmValue, ageNum, sex as 'male' | 'female');
      const tdee = calculateTDEE(bmr, activityLevel as ActivityLevel);
      
      // Calculate required daily calorie difference
      // No timeline/deadline - use mild deficit/surplus based on goal
      let dailyCalorieDiff = 0;
      if (goal === 'lose') {
        dailyCalorieDiff = -250;
      } else if (goal === 'gain') {
        dailyCalorieDiff = 250;
      } else {
        dailyCalorieDiff = 0;
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
        // Using 'any' here because error types from flushDraftSave can vary
        // and we need to safely handle the error without type checking
        setErrorText(t('onboarding.error_save_failed'));
        setIsSubmitting(false);
        setLoading(false);
        return; // Keep user on final step
      }
      
      // Step 2: Final profile update with calculated values, targets, timeline fields, and onboarding_complete=true
      // Use calorie target from step 9 if available, otherwise fall back to calculated targetCalories
      const finalCalorieTarget = calorieTarget !== null ? calorieTarget : targetCalories;
      const finalMaintenanceCalories = maintenanceCalories !== null ? maintenanceCalories : targetCalories;
      
      const finalCaloriePlan = mapCaloriePlanToDb(caloriePlan);
      
      const updateData: Record<string, any> = {
        daily_calorie_target: finalCalorieTarget,
        goal_target_date: null,
        goal_timeframe: null,
      };
      
      // Only set onboarding_complete when we are truly finished (after legal)
      if (markComplete) {
        updateData.onboarding_complete = true;
      }
      
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
        updateData.onboarding_targets_set_at = new Date().toISOString();
      }
      
      // Perform final mutation with timeout and retry support
      const mutationStart = performance.now();
      const MUTATION_TIMEOUT_MS = 5000; // 5 second timeout
      
      // Use React Query mutation (updates caches + AuthContext) per engineering guidelines.
      const mutationPromise = updateProfileMutation.mutateAsync(updateData);
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), MUTATION_TIMEOUT_MS);
      });
      
      let updatedProfile: any | null = null;
      try {
        updatedProfile = await Promise.race([mutationPromise, timeoutPromise]);
      } catch (error: any) {
        // Using 'any' here because Promise.race can reject with various error types
        // (Error, string, object, etc.) and we need to check error.message safely
        if (error.message === 'TIMEOUT') {
          // Timeout occurred - show retry option
          if (process.env.NODE_ENV !== 'production') {
            const mutationTime = performance.now() - mutationStart;
            console.warn(`[handleCompleteOnboarding] Final mutation timeout after ${mutationTime.toFixed(2)}ms`);
          }
          setErrorText(t('onboarding.error_network_waking'));
          setIsSubmitting(false);
          setLoading(false);
          return; // Allow user to retry by clicking Next again
        }
        throw error; // Re-throw other errors
      }
      
      const mutationTime = performance.now() - mutationStart;
      
      if (!updatedProfile) {
        throw new Error('Failed to save profile');
      }
      
      // After DB update succeeds, update caches/stores (best-effort, no awaits required)
      const queryKey = userConfigQueryKey(user.id);
      const cacheKey = `userConfig:${user.id}`;
      
      // Update React Query cache (best-effort)
      try {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) {
            return { onboarding_complete: true };
          }
          return { ...old, onboarding_complete: true };
        });
      } catch (e) {
        // Ignore cache update errors
      }

      // Update persistent cache (best-effort)
      try {
        const updatedCache = queryClient.getQueryData(queryKey);
        if (updatedCache) {
          setPersistentCache(cacheKey, { ...updatedCache, onboarding_complete: true });
        } else {
          setPersistentCache(cacheKey, { onboarding_complete: true });
        }
      } catch (e) {
        // Ignore persistent cache errors
      }

      // Write to onboardingFlagStore (best-effort)
      try {
        if (Platform.OS === 'web') {
          // Web can use sync write if available
          onboardingFlagStore.write(user.id, true).catch(() => {
            // Ignore write errors
          });
        } else {
          onboardingFlagStore.write(user.id, true).catch(() => {
            // Ignore write errors
          });
        }
      } catch (e) {
        // Ignore flag store errors
      }
      
      // Show warning if pace was adjusted
      if (warningMessage) {
        Alert.alert('Pace Adjusted', warningMessage);
      }
      
      // Navigate after DB save succeeded
      if (destination) {
        // Engineering guideline #14: avoid window.location.* navigation.
        // Expo Router replace is sufficient; caches/persisted flags already drive routing decisions.
        router.replace(destination as any);
      }
    } catch (error: any) {
      // Using 'any' here because error types can vary (Error, string, object, etc.)
      // and we need to safely extract a message for display
      const errorMessage = error.message || t('onboarding.error_complete_failed');
      showAppToast('Failed to save. Please try again.');
      setErrorText(errorMessage);
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleProceedToLegal = async () => {
    // Guard: prevent multiple submissions
    if (isSubmitting) {
      return;
    }
    
    clearErrors();
    
    // A) Validate all legal checkboxes are checked
    if (!legalAgreeTerms || !legalAgreePrivacy || !legalAcknowledgeRisk) {
      setErrorText(t('onboarding.legal.error_all_required'));
      return;
    }
    
    if (!user) {
      setErrorText(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Begin submission - set both loading states
    setIsSubmitting(true);
    setLoading(true);
    
    try {
      // B) Fetch active legal documents
      const activeDocs = await fetchActiveLegalDocuments();
      
      if (!activeDocs || activeDocs.length === 0) {
        setErrorText(t('onboarding.legal.error_no_docs'));
        setIsSubmitting(false);
        setLoading(false);
        return;
      }
      
      // C) Insert acceptances into user_legal_acceptances and await completion
      await acceptActiveLegalDocuments({
        userId: user.id,
        docs: activeDocs.map(d => ({ doc_type: d.doc_type, version: d.version })),
      });
      
      // D) Persist onboarding completion - await this call; it must not be fire-and-forget
      // This updates the profile with onboarding_complete=true and all final data
      await handleCompleteOnboarding({
        markComplete: true,
        navigateTo: '/(tabs)',
      });
      
      // E) Navigation happens inside handleCompleteOnboarding after all DB writes complete
      // Reset submitting state after successful completion (component may unmount on navigation)
      setIsSubmitting(false);
      setLoading(false);
      
    } catch (error: any) {
      // Using 'any' here because React Query and Supabase error types can vary
      // (Error, string, object, etc.) and we need to safely extract a message for display
      console.error('Error in handleProceedToLegal:', error);
      setErrorText(error instanceof Error ? error.message : t('onboarding.error_complete_failed'));
      setIsSubmitting(false);
      setLoading(false);
      // User stays on legal screen on error
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
    modulePreferences,
    setModulePreferences,
    selectedPlan,
    setSelectedPlan,
    premiumInsisted,
    setPremiumInsisted,
    legalAgreeTerms,
    setLegalAgreeTerms,
    legalAgreePrivacy,
    setLegalAgreePrivacy,
    legalAcknowledgeRisk,
    setLegalAcknowledgeRisk,
    loading,
    isSubmitting,
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
    handleProceedToLegal,
    shouldDisableNext,
  };
}

