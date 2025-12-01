import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { ageFromDob, dobFromAge, ActivityLevel, calculateBMR, calculateTDEE, calculateRequiredDailyCalorieDiff, calculateSafeCalorieTarget } from '@/utils/calculations';
import { updateProfile } from '@/lib/services/profileService';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

type Gender = 'male' | 'female' | 'not_telling';

function StepIndicator({ currentStep, totalSteps, colors }: { currentStep: number; totalSteps: number; colors: any }) {
  return (
    <View style={styles.stepIndicatorContainer}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View key={i} style={styles.stepIndicatorRow}>
          <View
            style={[
              styles.stepDot,
              {
                backgroundColor: i < currentStep ? colors.tint : colors.border,
                borderColor: i === currentStep ? colors.tint : colors.border,
              },
            ]}
          />
          {i < totalSteps - 1 && (
            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor: i < currentStep ? colors.tint : colors.border,
                },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
}

type GoalType = 'lose' | 'maintain' | 'gain' | 'recomp';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { user, refreshProfile, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 8; // Step 1: Goal, Step 2: Name & Age, Step 3: Sex, Step 4: Height, Step 5: Activity, Step 6: Weight, Step 7: Goal Weight, Step 8: Timeline (more steps coming later)
  
  // Step 1: Goal
  const [goal, setGoal] = useState<GoalType | ''>('');
  const [showAdvancedGoals, setShowAdvancedGoals] = useState(false);
  
  // Step 2: Preferred Name and Date of Birth
  const [preferredName, setPreferredName] = useState('');
  const [dateOfBirthStep2, setDateOfBirthStep2] = useState('');
  const [showDatePickerStep2, setShowDatePickerStep2] = useState(false);
  const [selectedDateStep2, setSelectedDateStep2] = useState<Date>(() => {
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() - 25);
    return defaultDate;
  });
  const [calendarViewMonthStep2, setCalendarViewMonthStep2] = useState<Date>(() => {
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() - 25);
    return defaultDate;
  });
  
  // Step 3: Sex
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  
  // Step 4: Height
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  
  // Legacy state for old steps (will be reorganized into Steps 5+ later)
  const [firstName, setFirstName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => {
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() - 25);
    return defaultDate;
  });
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const yearScrollViewRef = useRef<ScrollView>(null);
  const monthScrollViewRef = useRef<ScrollView>(null);
  
  // Auto-scroll to current year/month when picker opens
  useEffect(() => {
    if (showYearMonthPicker && yearScrollViewRef.current) {
      const currentYear = calendarViewMonth.getFullYear();
      const yearIndex = new Date().getFullYear() - currentYear;
      const yearItemHeight = 60;
      
      setTimeout(() => {
        yearScrollViewRef.current?.scrollTo({
          y: Math.max(0, (yearIndex - 2) * yearItemHeight),
          animated: true,
        });
      }, 100);
    }
  }, [showYearMonthPicker, calendarViewMonth]);
  
  // Step 5: Activity Level
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'high' | 'very_high' | ''>('');
  
  // Step 6: Current Weight
  const [currentWeightKg, setCurrentWeightKg] = useState('');
  const [currentWeightLb, setCurrentWeightLb] = useState('');
  const [currentWeightUnit, setCurrentWeightUnit] = useState<'kg' | 'lbs'>('kg');
  
  // Step 7: Goal Weight
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [goalWeightLb, setGoalWeightLb] = useState('');
  const [goalWeightUnit, setGoalWeightUnit] = useState<'kg' | 'lbs'>('kg');
  
  // Step 8: Timeline
  const [timelineOption, setTimelineOption] = useState<'3_months' | '6_months' | '12_months' | 'no_deadline' | 'custom_date' | ''>('');
  const [customTargetDate, setCustomTargetDate] = useState<string | null>(null);
  
  // Legacy state for old steps (will be reorganized later)
  const [weightLb, setWeightLb] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
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
        setCalendarViewMonthStep2(new Date(dobDate));
      }
    }
  }, [profile]);
  
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
        setHeightUnit('ft');
        const totalInches = profile.height_cm / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = Math.round(totalInches % 12);
        setHeightFt(feet.toString());
        setHeightIn(inches.toString());
      }
    }
  }, [profile]);
  
  // Convert selectedDate to YYYY-MM-DD format
  const updateDateOfBirth = (date: Date) => {
    setSelectedDate(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setDateOfBirth(`${year}-${month}-${day}`);
  };
  
  // Handle opening date picker
  const handleOpenDatePicker = () => {
    if (!dateOfBirth) {
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() - 25);
      setCalendarViewMonth(new Date(defaultDate));
      setSelectedDate(defaultDate);
    } else {
      const existingDate = new Date(dateOfBirth + 'T00:00:00');
      setCalendarViewMonth(new Date(existingDate));
    }
    setShowDatePicker(true);
  };
  
  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    return firstDay.getDay();
  };
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(calendarViewMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCalendarViewMonth(newMonth);
  };
  
  const handleDateSelect = (day: number) => {
    const newDate = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (newDate > today) {
      return;
    }
    
    updateDateOfBirth(newDate);
  };
  
  const isDateSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === calendarViewMonth.getMonth() &&
      selectedDate.getFullYear() === calendarViewMonth.getFullYear()
    );
  };
  
  const isDateDisabled = (day: number) => {
    const date = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };
  
  // Filter numeric input
  const filterNumericInput = (text: string): string => {
    let filtered = text.replace(/[^0-9.]/g, '');
    const parts = filtered.split('.');
    if (parts.length > 2) {
      filtered = parts[0] + '.' + parts.slice(1).join('');
    }
    return filtered;
  };
  
  // Conversion functions
  const convertHeightToCm = (): number | null => {
    if (heightUnit === 'cm') {
      const cm = parseFloat(heightCm);
      return isNaN(cm) ? null : cm;
    } else {
      const ft = parseFloat(heightFt);
      const inches = parseFloat(heightIn);
      if (isNaN(ft) || isNaN(inches)) return null;
      const totalInches = ft * 12 + inches;
      return totalInches * 2.54;
    }
  };
  
  const convertWeightToLb = (): number | null => {
    if (weightUnit === 'lbs') {
      const lbs = parseFloat(weightLb);
      return isNaN(lbs) ? null : lbs;
    } else {
      const kg = parseFloat(weightKg);
      return isNaN(kg) ? null : kg * 2.20462;
    }
  };
  
  const validateStep1 = (): string | null => {
    if (!firstName || firstName.trim().length === 0) {
      return 'Preferred Name is required';
    }
    
    if (firstName.length > 40) {
      return 'Preferred Name must be 40 characters or less';
    }
    
    if (!dateOfBirth) {
      return 'Date of birth is required';
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateOfBirth)) {
      return 'Date of birth must be in YYYY-MM-DD format';
    }
    
    const dobDate = new Date(dateOfBirth + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dobDate > today) {
      return 'Date of birth cannot be in the future';
    }
    
    const actualAge = ageFromDob(dateOfBirth);
    
    if (actualAge < 13) {
      return 'You must be at least 13 years old';
    }
    
    if (actualAge > 150) {
      return 'Date of birth cannot be more than 150 years ago';
    }
    
    return null;
  };
  
  const validateStep2 = (): string | null => {
    const heightCmValue = convertHeightToCm();
    if (!heightCmValue) {
      return 'Height is required';
    }
    
    const weightLbValue = convertWeightToLb();
    if (!weightLbValue) {
      return 'Weight is required';
    }
    
    if (heightCmValue < 50 || heightCmValue > 304.8) {
      return 'Height must be between 50 cm and 304.8 cm (approximately 1\'8" to 10\'0")';
    }
    
    if (weightLbValue < 45 || weightLbValue > 1200) {
      return 'Weight must be between 45 and 1200 lbs (approximately 20 to 544 kg)';
    }
    
    return null;
  };
  
  const validateGoal = (): string | null => {
    if (!goal || goal.trim().length === 0) {
      return t('onboarding.goal.error_select_goal');
    }
    return null;
  };
  
  const validateNameAge = (): string | null => {
    // Preferred Name is optional but check length if provided
    if (preferredName && preferredName.trim().length > 40) {
      return t('onboarding.name_age.error_name_too_long');
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
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() - 25);
      setCalendarViewMonthStep2(new Date(defaultDate));
      setSelectedDateStep2(defaultDate);
    } else {
      const existingDate = new Date(dateOfBirthStep2 + 'T00:00:00');
      setCalendarViewMonthStep2(new Date(existingDate));
      setSelectedDateStep2(existingDate);
    }
    setShowDatePickerStep2(true);
  };
  
  const navigateMonthStep2 = (direction: 'prev' | 'next') => {
    const newMonth = new Date(calendarViewMonthStep2);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCalendarViewMonthStep2(newMonth);
  };
  
  const handleDateSelectStep2 = (day: number) => {
    const newDate = new Date(calendarViewMonthStep2.getFullYear(), calendarViewMonthStep2.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (newDate > today) {
      return;
    }
    
    updateDateOfBirthStep2(newDate);
  };
  
  const isDateSelectedStep2 = (day: number) => {
    if (!selectedDateStep2) return false;
    return (
      selectedDateStep2.getDate() === day &&
      selectedDateStep2.getMonth() === calendarViewMonthStep2.getMonth() &&
      selectedDateStep2.getFullYear() === calendarViewMonthStep2.getFullYear()
    );
  };
  
  const isDateDisabledStep2 = (day: number) => {
    const date = new Date(calendarViewMonthStep2.getFullYear(), calendarViewMonthStep2.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };
  
  const getDaysInMonthStep2 = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };
  
  const getFirstDayOfMonthStep2 = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    return firstDay.getDay();
  };
  
  const validateSex = (): string | null => {
    if (!sex || (sex !== 'male' && sex !== 'female')) {
      return t('onboarding.sex.error_select_sex');
    }
    return null;
  };
  
  const validateHeight = (): string | null => {
    let heightCmValue: number | null = null;
    
    if (heightUnit === 'cm') {
      const cm = parseFloat(heightCm);
      if (isNaN(cm) || cm <= 0) {
        return t('onboarding.height.error_height_required');
      }
      heightCmValue = cm;
    } else {
      const ft = parseFloat(heightFt);
      const inches = parseFloat(heightIn);
      if (isNaN(ft) || isNaN(inches) || ft <= 0) {
        return t('onboarding.height.error_height_required');
      }
      const totalInches = ft * 12 + inches;
      heightCmValue = totalInches * 2.54;
    }
    
    if (heightCmValue < 120 || heightCmValue > 230) {
      return t('onboarding.height.error_height_invalid');
    }
    
    return null;
  };
  
  const validateActivity = (): string | null => {
    if (!activityLevel || (activityLevel !== 'sedentary' && activityLevel !== 'light' && activityLevel !== 'moderate' && activityLevel !== 'high' && activityLevel !== 'very_high')) {
      return t('onboarding.activity.error_select_activity');
    }
    return null;
  };
  
  const validateCurrentWeight = (): string | null => {
    let weightKgValue: number | null = null;
    
    if (currentWeightUnit === 'kg') {
      const kg = parseFloat(currentWeightKg);
      if (isNaN(kg) || kg <= 0) {
        return t('onboarding.current_weight.error_weight_required');
      }
      weightKgValue = kg;
    } else {
      const lbs = parseFloat(currentWeightLb);
      if (isNaN(lbs) || lbs <= 0) {
        return t('onboarding.current_weight.error_weight_required');
      }
      weightKgValue = lbs / 2.20462;
    }
    
    if (weightKgValue < 35 || weightKgValue > 250) {
      return t('onboarding.current_weight.error_weight_invalid');
    }
    
    return null;
  };
  
  const validateGoalWeight = (): string | null => {
    let goalWeightKgValue: number | null = null;
    let currentWeightKgValue: number | null = null;
    
    // Get goal weight in kg
    if (goalWeightUnit === 'kg') {
      const kg = parseFloat(goalWeightKg);
      if (isNaN(kg) || kg <= 0) {
        return t('onboarding.goal_weight.error_weight_required');
      }
      goalWeightKgValue = kg;
    } else {
      const lbs = parseFloat(goalWeightLb);
      if (isNaN(lbs) || lbs <= 0) {
        return t('onboarding.goal_weight.error_weight_required');
      }
      goalWeightKgValue = lbs / 2.20462;
    }
    
    // Get current weight in kg
    if (currentWeightUnit === 'kg') {
      currentWeightKgValue = parseFloat(currentWeightKg);
    } else {
      const lbs = parseFloat(currentWeightLb);
      currentWeightKgValue = lbs / 2.20462;
    }
    
    // Validate range
    if (goalWeightKgValue < 35 || goalWeightKgValue > 250) {
      return t('onboarding.goal_weight.error_weight_invalid');
    }
    
    // Validate based on goal type
    if (goal === 'lose') {
      // Goal weight must be lower than current weight (allow 0.5 kg tolerance for rounding)
      if (goalWeightKgValue >= currentWeightKgValue - 0.5) {
        return t('onboarding.goal_weight.error_lose_too_high');
      }
    } else if (goal === 'gain') {
      // Goal weight must be higher than current weight (allow 0.5 kg tolerance for rounding)
      if (goalWeightKgValue <= currentWeightKgValue + 0.5) {
        return t('onboarding.goal_weight.error_gain_too_low');
      }
    } else if (goal === 'maintain' || goal === 'recomp') {
      // Goal weight should be close to current weight (within 5 kg)
      const difference = Math.abs(goalWeightKgValue - currentWeightKgValue);
      if (difference > 5) {
        return t('onboarding.goal_weight.error_maintain_too_different');
      }
    }
    
    return null;
  };
  
  const validateTimeline = (): string | null => {
    if (!timelineOption || (timelineOption !== '3_months' && timelineOption !== '6_months' && timelineOption !== '12_months' && timelineOption !== 'no_deadline' && timelineOption !== 'custom_date')) {
      return t('onboarding.timeline.error_select_timeline');
    }
    
    if (timelineOption === 'custom_date' && !customTargetDate) {
      return t('onboarding.timeline.error_select_timeline');
    }
    
    return null;
  };
  
  // Filter numeric input for height
  const filterHeightInput = (text: string): string => {
    let filtered = text.replace(/[^0-9.]/g, '');
    const parts = filtered.split('.');
    if (parts.length > 2) {
      filtered = parts[0] + '.' + parts.slice(1).join('');
    }
    return filtered;
  };
  
  const handleGoalNext = async () => {
    setError(null);
    
    // Validate Goal step
    const validationError = validateGoal();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (!user) {
      setError(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Save goal to profile
    setLoading(true);
    try {
      const updatedProfile = await updateProfile(user.id, { goal_type: goal });
      
      if (!updatedProfile) {
        throw new Error('Failed to save goal');
      }
      
      // Refresh profile to get updated data
      await refreshProfile();
      
      // Move to next step
      setCurrentStep(2);
    } catch (error: any) {
      setError(error.message || 'Failed to save goal. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleNameAgeNext = async () => {
    setError(null);
    
    // Validate Step 2
    const validationError = validateNameAge();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (!user) {
      setError(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Save name and date of birth to profile
    setLoading(true);
    try {
      const updateData: any = {};
      if (preferredName.trim()) {
        updateData.first_name = preferredName.trim();
      }
      if (dateOfBirthStep2) {
        updateData.date_of_birth = dateOfBirthStep2;
      }
      
      const updatedProfile = await updateProfile(user.id, updateData);
      
      if (!updatedProfile) {
        throw new Error('Failed to save profile');
      }
      
      // Refresh profile to get updated data
      await refreshProfile();
      
      // Move to next step
      setCurrentStep(3);
    } catch (error: any) {
      setError(error.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSexNext = async () => {
    setError(null);
    
    // Validate Step 3
    const validationError = validateSex();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (!user) {
      setError(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Save sex to profile
    setLoading(true);
    try {
      const updatedProfile = await updateProfile(user.id, { gender: sex });
      
      if (!updatedProfile) {
        throw new Error('Failed to save profile');
      }
      
      // Refresh profile to get updated data
      await refreshProfile();
      
      // Move to next step
      setCurrentStep(4);
    } catch (error: any) {
      setError(error.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleHeightNext = async () => {
    setError(null);
    
    // Validate Step 4
    const validationError = validateHeight();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (!user) {
      setError(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Convert height to cm and save to profile
    setLoading(true);
    try {
      let heightCmValue: number;
      
      if (heightUnit === 'cm') {
        heightCmValue = parseFloat(heightCm);
      } else {
        const ft = parseFloat(heightFt);
        const inches = parseFloat(heightIn);
        const totalInches = ft * 12 + inches;
        heightCmValue = totalInches * 2.54;
      }
      
      const updatedProfile = await updateProfile(user.id, {
        height_cm: heightCmValue,
        height_unit: heightUnit,
      });
      
      if (!updatedProfile) {
        throw new Error('Failed to save profile');
      }
      
      // Refresh profile to get updated data
      await refreshProfile();
      
      // Move to next step
      setCurrentStep(5);
    } catch (error: any) {
      setError(error.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleActivityNext = async () => {
    setError(null);
    
    // Validate Step 5
    const validationError = validateActivity();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (!user) {
      setError(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Save activity level to profile
    setLoading(true);
    try {
      const updatedProfile = await updateProfile(user.id, { activity_level: activityLevel });
      
      if (!updatedProfile) {
        throw new Error('Failed to save profile');
      }
      
      // Refresh profile to get updated data
      await refreshProfile();
      
      // Move to next step
      setCurrentStep(6);
    } catch (error: any) {
      setError(error.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCurrentWeightNext = async () => {
    setError(null);
    
    // Validate Step 6
    const validationError = validateCurrentWeight();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (!user) {
      setError(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Convert weight to kg and save to profile
    setLoading(true);
    try {
      let weightKgValue: number;
      
      if (currentWeightUnit === 'kg') {
        weightKgValue = parseFloat(currentWeightKg);
      } else {
        const lbs = parseFloat(currentWeightLb);
        weightKgValue = lbs / 2.20462;
      }
      
      const updatedProfile = await updateProfile(user.id, {
        weight_kg: weightKgValue,
        weight_lb: weightKgValue * 2.20462,
        weight_unit: currentWeightUnit,
      });
      
      if (!updatedProfile) {
        throw new Error('Failed to save profile');
      }
      
      // Refresh profile to get updated data
      await refreshProfile();
      
      // Move to next step
      setCurrentStep(7);
    } catch (error: any) {
      setError(error.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoalWeightNext = async () => {
    setError(null);
    
    // Validate Step 7
    const validationError = validateGoalWeight();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (!user) {
      setError(t('onboarding.error_no_session'));
      router.replace('/login');
      return;
    }
    
    // Convert goal weight to kg and save to profile
    setLoading(true);
    try {
      let goalWeightKgValue: number;
      
      if (goalWeightUnit === 'kg') {
        goalWeightKgValue = parseFloat(goalWeightKg);
      } else {
        const lbs = parseFloat(goalWeightLb);
        goalWeightKgValue = lbs / 2.20462;
      }
      
      const updatedProfile = await updateProfile(user.id, {
        goal_weight_kg: goalWeightKgValue,
        goal_weight_lb: goalWeightKgValue * 2.20462,
      });
      
      if (!updatedProfile) {
        throw new Error('Failed to save profile');
      }
      
      // Refresh profile to get updated data
      await refreshProfile();
      
      // Move to next step
      setCurrentStep(8);
    } catch (error: any) {
      setError(error.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleNext = () => {
    setError(null);
    
    if (currentStep === 1) {
      // Goal step - handle separately to save goal_type
      handleGoalNext();
    } else if (currentStep === 2) {
      // Name & Age step
      handleNameAgeNext();
    } else if (currentStep === 3) {
      // Sex step
      handleSexNext();
    } else if (currentStep === 4) {
      // Height step
      handleHeightNext();
    } else if (currentStep === 5) {
      // Activity level step
      handleActivityNext();
    } else if (currentStep === 6) {
      // Current weight step
      handleCurrentWeightNext();
    } else if (currentStep === 7) {
      // Goal weight step
      handleGoalWeightNext();
    } else if (currentStep === 8) {
      // Timeline step - handled by handleCompleteOnboarding
      handleCompleteOnboarding();
    }
  };
  
  const shouldDisableNext = (): boolean => {
    if (currentStep === 1) {
      return !goal;
    } else if (currentStep === 2) {
      return !dateOfBirthStep2 || dateOfBirthStep2.trim().length === 0;
    } else if (currentStep === 3) {
      return !sex || (sex !== 'male' && sex !== 'female');
    } else if (currentStep === 4) {
      // Check if height is valid
      if (heightUnit === 'cm') {
        const cm = parseFloat(heightCm);
        return isNaN(cm) || cm <= 0 || cm < 120 || cm > 230;
      } else {
        const ft = parseFloat(heightFt);
        const inches = parseFloat(heightIn);
        if (isNaN(ft) || isNaN(inches) || ft <= 0) return true;
        const totalInches = ft * 12 + inches;
        const cmValue = totalInches * 2.54;
        return cmValue < 120 || cmValue > 230;
      }
    } else if (currentStep === 5) {
      return !activityLevel || (activityLevel !== 'sedentary' && activityLevel !== 'light' && activityLevel !== 'moderate' && activityLevel !== 'high' && activityLevel !== 'very_high');
    } else if (currentStep === 6) {
      // Check if current weight is valid
      if (currentWeightUnit === 'kg') {
        const kg = parseFloat(currentWeightKg);
        return isNaN(kg) || kg <= 0 || kg < 35 || kg > 250;
      } else {
        const lbs = parseFloat(currentWeightLb);
        if (isNaN(lbs) || lbs <= 0) return true;
        const kgValue = lbs / 2.20462;
        return kgValue < 35 || kgValue > 250;
      }
    } else if (currentStep === 7) {
      // Check if goal weight is valid (basic validation, detailed validation happens on submit)
      if (goalWeightUnit === 'kg') {
        const kg = parseFloat(goalWeightKg);
        return isNaN(kg) || kg <= 0 || kg < 35 || kg > 250;
      } else {
        const lbs = parseFloat(goalWeightLb);
        if (isNaN(lbs) || lbs <= 0) return true;
        const kgValue = lbs / 2.20462;
        return kgValue < 35 || kgValue > 250;
      }
    } else if (currentStep === 8) {
      return !timelineOption || (timelineOption === 'custom_date' && !customTargetDate);
    }
    return false;
  };
  
  const handleBack = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleCompleteOnboarding = async () => {
    setError(null);
    
    // Handle Step 8 (Timeline) completion with BMR/TDEE calculations
    if (currentStep === 8) {
      const validationError = validateTimeline();
      if (validationError) {
        setError(validationError);
        Alert.alert('Validation Error', validationError);
        return;
      }
      
      if (!user || !profile) {
        setError(t('onboarding.error_no_session'));
        router.replace('/login');
        return;
      }
      
      // Gather required data for calculations
      // Derive age from date of birth stored in profile
      if (!profile.date_of_birth) {
        setError('Date of birth is required. Please go back and complete Step 2.');
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
        currentWeightKgValue = parseFloat(currentWeightLb) / 2.20462;
      }
      
      if (goalWeightUnit === 'kg') {
        goalWeightKgValue = parseFloat(goalWeightKg);
      } else {
        goalWeightKgValue = parseFloat(goalWeightLb) / 2.20462;
      }
      
      if (!ageNum || !heightCmValue || !currentWeightKgValue || !goalWeightKgValue || !activityLevel || !sex || !goal) {
        setError('Missing required information. Please complete all previous steps.');
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
          if (weeksToGoal < 1) weeksToGoal = null; // Invalid date in past
        }
        
        // Calculate required daily calorie difference
        let dailyCalorieDiff = 0;
        if (weeksToGoal && weeksToGoal > 0) {
          dailyCalorieDiff = calculateRequiredDailyCalorieDiff(currentWeightKgValue, goalWeightKgValue, weeksToGoal);
        } else {
          // No deadline - use mild deficit/surplus based on goal
          if (goal === 'lose') {
            dailyCalorieDiff = -250; // Mild deficit
          } else if (goal === 'gain') {
            dailyCalorieDiff = 250; // Mild surplus
          } else {
            dailyCalorieDiff = 0; // Maintenance
          }
        }
        
        // Calculate safe calorie target with safety limits
        const { targetCalories, adjustedDailyDiff, warningMessage } = calculateSafeCalorieTarget(
          tdee,
          dailyCalorieDiff,
          sex as 'male' | 'female'
        );
        
        // Prepare profile update data
        const updateData: any = {
          daily_calorie_target: targetCalories,
          goal_target_date: targetDate,
          goal_timeframe: timelineOption,
        };
        
        // Save all the calculated values
        const updatedProfile = await updateProfile(user.id, updateData);
        
        if (!updatedProfile) {
          throw new Error('Failed to save profile');
        }
        
        // Note: We don't set onboarding_complete = true here yet per user's instructions
        // They said to route to next part of onboarding
        
        await refreshProfile();
        
        // Show warning if pace was adjusted
        if (warningMessage) {
          Alert.alert('Pace Adjusted', warningMessage);
        }
        
        // For now, complete onboarding (user said there will be more steps later)
        await updateProfile(user.id, { onboarding_complete: true });
        await refreshProfile();
        router.replace('/(tabs)');
        return;
      } catch (error: any) {
        setError(error.message || 'Failed to complete onboarding. Please try again.');
        Alert.alert('Error', error.message || 'Failed to complete onboarding. Please try again.');
        setLoading(false);
        return;
      }
    }
    
    // Legacy completion handler for old steps (if still in use)
    // Validate Step 3 (Physical Info)
    const validationError = validateStep2();
    if (validationError) {
      setError(validationError);
      Alert.alert('Validation Error', validationError);
      return;
    }
    
    if (!user) {
      setError('No user session found. Please log in again.');
      router.replace('/login');
      return;
    }
    
    setLoading(true);
    
    try {
      const heightCmValue = convertHeightToCm();
      const weightLbValue = convertWeightToLb();
      
      if (!heightCmValue || !weightLbValue) {
        throw new Error('Height and Weight are required');
      }
      
      // Try using the database function first
      let profileError = null;
      let profileSuccess = false;
      
      try {
        const { data: functionData, error: functionError } = await supabase.rpc('create_user_profile', {
          p_user_id: user.id,
          p_first_name: firstName.trim(),
          p_date_of_birth: dateOfBirth,
          p_gender: gender,
          p_height_cm: heightCmValue,
          p_weight_lb: weightLbValue,
          p_height_unit: heightUnit,
          p_weight_unit: weightUnit,
          p_onboarding_complete: true, // Complete onboarding
        });
        
        if (functionError) {
          console.error('Function error:', functionError);
          profileError = functionError;
        } else {
          profileSuccess = true;
        }
      } catch (e: any) {
        console.error('Exception calling function:', e);
        profileError = e;
      }
      
      // If function failed, try direct upsert
      if (!profileSuccess) {
        const profileData = {
          user_id: user.id,
          first_name: firstName.trim(),
          date_of_birth: dateOfBirth,
          gender,
          height_cm: heightCmValue,
          weight_lb: weightLbValue,
          height_unit: heightUnit,
          weight_unit: weightUnit,
          is_active: true,
          onboarding_complete: true, // Complete onboarding
        };
        
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(profileData, { onConflict: 'user_id' });
        
        if (upsertError) {
          console.error('Direct upsert error:', upsertError);
          throw new Error(upsertError.message || 'Failed to save profile');
        } else {
          profileSuccess = true;
        }
      }
      
      // Refresh the profile in AuthContext
      await refreshProfile();
      
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to complete onboarding. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      setLoading(false);
    }
  };
  
  const renderGoalStep = () => {
    const basicGoals: Array<{ value: GoalType; labelKey: string; descriptionKey: string }> = [
      {
        value: 'lose',
        labelKey: 'onboarding.goal.lose_weight.label',
        descriptionKey: 'onboarding.goal.lose_weight.description',
      },
      {
        value: 'maintain',
        labelKey: 'onboarding.goal.maintain_weight.label',
        descriptionKey: 'onboarding.goal.maintain_weight.description',
      },
      {
        value: 'gain',
        labelKey: 'onboarding.goal.gain_weight.label',
        descriptionKey: 'onboarding.goal.gain_weight.description',
      },
    ];
    
    const advancedGoals: Array<{ value: GoalType; labelKey: string; descriptionKey: string }> = [
      {
        value: 'recomp',
        labelKey: 'onboarding.goal.recomp.label',
        descriptionKey: 'onboarding.goal.recomp.description',
      },
    ];
    
    const allGoals = showAdvancedGoals ? [...basicGoals, ...advancedGoals] : basicGoals;
    
    return (
      <View style={styles.stepContent}>
        <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
          {t('onboarding.goal.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          {t('onboarding.goal.subtitle')}
        </ThemedText>
        
        <View style={styles.goalContainer}>
          {allGoals.map((goalOption) => (
            <TouchableOpacity
              key={goalOption.value}
              style={[
                styles.goalCard,
                { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                goal === goalOption.value && { 
                  backgroundColor: colors.tint, 
                  borderColor: colors.tint,
                  ...Platform.select({
                    web: {
                      boxShadow: `0 4px 12px ${colors.tint}40`,
                    },
                    default: {
                      shadowColor: colors.tint,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    },
                  }),
                },
              ]}
              onPress={() => {
                setGoal(goalOption.value);
                setError(null);
              }}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${t(goalOption.labelKey)}${goal === goalOption.value ? ' selected' : ''}`,
                `Double tap to select ${t(goalOption.labelKey)}`,
                loading
              )}
              accessibilityRole="radio"
              accessibilityState={{ selected: goal === goalOption.value }}
            >
              <Text
                style={[
                  styles.goalCardTitle,
                  { color: goal === goalOption.value ? '#fff' : colors.text },
                ]}
              >
                {t(goalOption.labelKey)}
              </Text>
              <Text
                style={[
                  styles.goalCardDescription,
                  { 
                    color: goal === goalOption.value 
                      ? 'rgba(255, 255, 255, 0.9)' 
                      : colors.textSecondary 
                  },
                ]}
              >
                {t(goalOption.descriptionKey)}
              </Text>
              {goal === goalOption.value && (
                <View style={styles.goalCardCheckmark}>
                  <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        {!showAdvancedGoals && (
          <TouchableOpacity
            style={styles.advancedGoalLink}
            onPress={() => setShowAdvancedGoals(true)}
            disabled={loading}
            {...getButtonAccessibilityProps(
              t('onboarding.goal.advanced_goal'),
              'Double tap to show advanced goal options'
            )}
          >
            <ThemedText style={[styles.advancedGoalLinkText, { color: colors.tint }]}>
              {t('onboarding.goal.advanced_goal')}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  const renderNameAgeStep = () => (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.name_age.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        {t('onboarding.name_age.subtitle')}
      </ThemedText>
      
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>
          {t('onboarding.name_age.preferred_name_label')}
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: error && preferredName && preferredName.length > 40 ? '#EF4444' : colors.border,
              color: colors.text,
              backgroundColor: colors.backgroundSecondary,
              ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
            },
          ]}
          placeholder={t('onboarding.name_age.preferred_name_placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={preferredName}
          onChangeText={(text) => {
            if (text.length <= 40) {
              setPreferredName(text);
              setError(null);
            }
          }}
          maxLength={40}
          autoCapitalize="words"
          autoComplete="given-name"
          editable={!loading}
          {...getInputAccessibilityProps(
            t('onboarding.name_age.preferred_name_label'),
            t('onboarding.name_age.preferred_name_placeholder'),
            error && preferredName && preferredName.length > 40 ? error : undefined,
            false
          )}
        />
      </View>
      
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>
          {t('onboarding.name_age.dob_label')} *
        </ThemedText>
        <TouchableOpacity
          style={[
            styles.dateInput,
            {
              borderColor: error && !dateOfBirthStep2 ? '#EF4444' : colors.border,
              backgroundColor: colors.backgroundSecondary,
            },
          ]}
          onPress={handleOpenDatePickerStep2}
          disabled={loading}
          {...getButtonAccessibilityProps(
            t('onboarding.name_age.dob_label'),
            'Double tap to select your date of birth'
          )}
        >
          <Text style={[styles.dateInputText, { color: dateOfBirthStep2 ? colors.text : colors.textSecondary }]}>
            {dateOfBirthStep2 || t('onboarding.name_age.dob_placeholder')}
          </Text>
          <IconSymbol name="calendar" size={20} color={colors.icon} />
        </TouchableOpacity>
        
        {dateOfBirthStep2 && (
          <View style={styles.ageDisplay}>
            <ThemedText style={[styles.ageLabel, { color: colors.textSecondary }]}>
              {t('onboarding.name_age.age_display', { age: ageFromDob(dateOfBirthStep2) })}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
  
  const renderSexStep = () => (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.sex.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        {t('onboarding.sex.subtitle')}
      </ThemedText>
      
      <View style={styles.goalContainer}>
        {[
          { value: 'male' as const, labelKey: 'onboarding.sex.male' },
          { value: 'female' as const, labelKey: 'onboarding.sex.female' },
        ].map((sexOption) => (
          <TouchableOpacity
            key={sexOption.value}
            style={[
              styles.goalCard,
              { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
              sex === sexOption.value && { 
                backgroundColor: colors.tint, 
                borderColor: colors.tint,
                ...Platform.select({
                  web: {
                    boxShadow: `0 4px 12px ${colors.tint}40`,
                  },
                  default: {
                    shadowColor: colors.tint,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  },
                }),
              },
            ]}
            onPress={() => {
              setSex(sexOption.value);
              setError(null);
            }}
            disabled={loading}
            {...getButtonAccessibilityProps(
              `${t(sexOption.labelKey)}${sex === sexOption.value ? ' selected' : ''}`,
              `Double tap to select ${t(sexOption.labelKey)}`,
              loading
            )}
            accessibilityRole="radio"
            accessibilityState={{ selected: sex === sexOption.value }}
          >
            <Text
              style={[
                styles.goalCardTitle,
                { color: sex === sexOption.value ? '#fff' : colors.text },
              ]}
            >
              {t(sexOption.labelKey)}
            </Text>
            {sex === sexOption.value && (
              <View style={styles.goalCardCheckmark}>
                <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
  
  const renderHeightStep = () => (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.height.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        {t('onboarding.height.subtitle')}
      </ThemedText>
      
      <View style={styles.measurementSection}>
        <View style={styles.measurementHeader}>
          <ThemedText style={[styles.label, { color: colors.text }]}>
            {t('onboarding.height.height_label')}
          </ThemedText>
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[
                styles.unitButton,
                { borderColor: colors.border },
                heightUnit === 'cm' && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => {
                setHeightUnit('cm');
                if (heightFt && heightIn) {
                  const totalInches = parseFloat(heightFt) * 12 + parseFloat(heightIn);
                  const cm = totalInches * 2.54;
                  setHeightCm(cm.toFixed(1));
                }
              }}
              disabled={loading}
            >
              <Text style={[styles.unitButtonText, { color: heightUnit === 'cm' ? '#fff' : colors.text }]}>
                cm
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.unitButton,
                { borderColor: colors.border },
                heightUnit === 'ft' && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => {
                setHeightUnit('ft');
                if (heightCm) {
                  const totalInches = parseFloat(heightCm) / 2.54;
                  const feet = Math.floor(totalInches / 12);
                  const inches = Math.round(totalInches % 12);
                  setHeightFt(feet.toString());
                  setHeightIn(inches.toString());
                }
              }}
              disabled={loading}
            >
              <Text style={[styles.unitButtonText, { color: heightUnit === 'ft' ? '#fff' : colors.text }]}>
                ft/in
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {heightUnit === 'cm' ? (
          <TextInput
            style={[
              styles.input,
              {
                borderColor: error && !heightCm ? '#EF4444' : colors.border,
                color: colors.text,
                backgroundColor: colors.backgroundSecondary,
                ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
              },
            ]}
            placeholder={t('onboarding.height.height_cm_placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={heightCm}
            onChangeText={(text) => {
              setHeightCm(filterHeightInput(text));
              setError(null);
            }}
            keyboardType="numeric"
            editable={!loading}
            {...getInputAccessibilityProps(
              'Height in centimeters',
              t('onboarding.height.height_cm_placeholder'),
              error && !heightCm ? error : undefined,
              true
            )}
          />
        ) : (
          <View style={styles.dualInputRow}>
            <View style={styles.dualInputContainer}>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: error && !heightFt ? '#EF4444' : colors.border,
                    color: colors.text,
                    backgroundColor: colors.backgroundSecondary,
                    ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                  },
                ]}
                placeholder={t('onboarding.height.height_ft_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={heightFt}
                onChangeText={(text) => {
                  setHeightFt(filterHeightInput(text));
                  setError(null);
                }}
                keyboardType="numeric"
                editable={!loading}
                {...getInputAccessibilityProps(
                  'Height in feet',
                  t('onboarding.height.height_ft_placeholder'),
                  error && !heightFt ? error : undefined,
                  true
                )}
              />
              <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>ft</Text>
            </View>
            <View style={styles.dualInputContainer}>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: error && !heightIn ? '#EF4444' : colors.border,
                    color: colors.text,
                    backgroundColor: colors.backgroundSecondary,
                    ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                  },
                ]}
                placeholder={t('onboarding.height.height_in_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={heightIn}
                onChangeText={(text) => {
                  setHeightIn(filterHeightInput(text));
                  setError(null);
                }}
                keyboardType="numeric"
                editable={!loading}
                {...getInputAccessibilityProps(
                  'Height in inches',
                  t('onboarding.height.height_in_placeholder'),
                  error && !heightIn ? error : undefined,
                  true
                )}
              />
              <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>in</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
  
  const renderActivityStep = () => (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.activity.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        {t('onboarding.activity.subtitle')}
      </ThemedText>
      
      <View style={styles.goalContainer}>
        {[
          { value: 'sedentary' as const, labelKey: 'onboarding.activity.sedentary.label', descriptionKey: 'onboarding.activity.sedentary.description' },
          { value: 'light' as const, labelKey: 'onboarding.activity.light.label', descriptionKey: 'onboarding.activity.light.description' },
          { value: 'moderate' as const, labelKey: 'onboarding.activity.moderate.label', descriptionKey: 'onboarding.activity.moderate.description' },
          { value: 'high' as const, labelKey: 'onboarding.activity.high.label', descriptionKey: 'onboarding.activity.high.description' },
          { value: 'very_high' as const, labelKey: 'onboarding.activity.very_high.label', descriptionKey: 'onboarding.activity.very_high.description' },
        ].map((activity) => (
          <TouchableOpacity
            key={activity.value}
            style={[
              styles.goalCard,
              { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
              activityLevel === activity.value && { 
                backgroundColor: colors.tint, 
                borderColor: colors.tint,
                ...Platform.select({
                  web: { boxShadow: `0 4px 12px ${colors.tint}40` },
                  default: {
                    shadowColor: colors.tint,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  },
                }),
              },
            ]}
            onPress={() => {
              setActivityLevel(activity.value);
              setError(null);
            }}
            disabled={loading}
            {...getButtonAccessibilityProps(
              `${t(activity.labelKey)}${activityLevel === activity.value ? ' selected' : ''}`,
              `Double tap to select ${t(activity.labelKey)}`,
              loading
            )}
            accessibilityRole="radio"
            accessibilityState={{ selected: activityLevel === activity.value }}
          >
            <Text style={[styles.goalCardTitle, { color: activityLevel === activity.value ? '#fff' : colors.text }]}>
              {t(activity.labelKey)}
            </Text>
            <Text style={[styles.goalCardDescription, { color: activityLevel === activity.value ? 'rgba(255,255,255,0.9)' : colors.textSecondary }]}>
              {t(activity.descriptionKey)}
            </Text>
            {activityLevel === activity.value && (
              <View style={styles.goalCardCheckmark}>
                <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
  
  const renderCurrentWeightStep = () => {
    // Sync weight units between current and goal weight for consistency
    const displayUnit = currentWeightUnit;
    
    return (
      <View style={styles.stepContent}>
        <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
          {t('onboarding.current_weight.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          {t('onboarding.current_weight.subtitle')}
        </ThemedText>
        
        <View style={styles.measurementSection}>
          <View style={styles.measurementHeader}>
            <ThemedText style={[styles.label, { color: colors.text }]}>
              {t('onboarding.current_weight.weight_label')}
            </ThemedText>
            <View style={styles.unitToggle}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { borderColor: colors.border },
                  currentWeightUnit === 'kg' && { backgroundColor: colors.tint, borderColor: colors.tint },
                ]}
                onPress={() => {
                  setCurrentWeightUnit('kg');
                  if (currentWeightLb) {
                    const kg = parseFloat(currentWeightLb) / 2.20462;
                    setCurrentWeightKg(kg.toFixed(1));
                  }
                }}
                disabled={loading}
              >
                <Text style={[styles.unitButtonText, { color: currentWeightUnit === 'kg' ? '#fff' : colors.text }]}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { borderColor: colors.border },
                  currentWeightUnit === 'lbs' && { backgroundColor: colors.tint, borderColor: colors.tint },
                ]}
                onPress={() => {
                  setCurrentWeightUnit('lbs');
                  if (currentWeightKg) {
                    const lbs = parseFloat(currentWeightKg) * 2.20462;
                    setCurrentWeightLb(lbs.toFixed(1));
                  }
                }}
                disabled={loading}
              >
                <Text style={[styles.unitButtonText, { color: currentWeightUnit === 'lbs' ? '#fff' : colors.text }]}>lbs</Text>
              </TouchableOpacity>
            </View>
          </View>
          {currentWeightUnit === 'kg' ? (
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: error && !currentWeightKg ? '#EF4444' : colors.border,
                  color: colors.text,
                  backgroundColor: colors.backgroundSecondary,
                  ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                },
              ]}
              placeholder={t('onboarding.current_weight.weight_kg_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={currentWeightKg}
              onChangeText={(text) => {
                setCurrentWeightKg(filterHeightInput(text));
                setError(null);
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                'Current weight in kilograms',
                t('onboarding.current_weight.weight_kg_placeholder'),
                error && !currentWeightKg ? error : undefined,
                true
              )}
            />
          ) : (
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: error && !currentWeightLb ? '#EF4444' : colors.border,
                  color: colors.text,
                  backgroundColor: colors.backgroundSecondary,
                  ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                },
              ]}
              placeholder={t('onboarding.current_weight.weight_lb_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={currentWeightLb}
              onChangeText={(text) => {
                setCurrentWeightLb(filterHeightInput(text));
                setError(null);
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                'Current weight in pounds',
                t('onboarding.current_weight.weight_lb_placeholder'),
                error && !currentWeightLb ? error : undefined,
                true
              )}
            />
          )}
        </View>
      </View>
    );
  };
  
  const renderGoalWeightStep = () => {
    // Sync weight units with current weight step
    const displayUnit = goalWeightUnit;
    
    return (
      <View style={styles.stepContent}>
        <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
          {t('onboarding.goal_weight.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          {t('onboarding.goal_weight.subtitle')}
        </ThemedText>
        
        <View style={styles.measurementSection}>
          <View style={styles.measurementHeader}>
            <ThemedText style={[styles.label, { color: colors.text }]}>
              {t('onboarding.goal_weight.weight_label')}
            </ThemedText>
            <View style={styles.unitToggle}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { borderColor: colors.border },
                  goalWeightUnit === 'kg' && { backgroundColor: colors.tint, borderColor: colors.tint },
                ]}
                onPress={() => {
                  setGoalWeightUnit('kg');
                  if (goalWeightLb) {
                    const kg = parseFloat(goalWeightLb) / 2.20462;
                    setGoalWeightKg(kg.toFixed(1));
                  }
                }}
                disabled={loading}
              >
                <Text style={[styles.unitButtonText, { color: goalWeightUnit === 'kg' ? '#fff' : colors.text }]}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { borderColor: colors.border },
                  goalWeightUnit === 'lbs' && { backgroundColor: colors.tint, borderColor: colors.tint },
                ]}
                onPress={() => {
                  setGoalWeightUnit('lbs');
                  if (goalWeightKg) {
                    const lbs = parseFloat(goalWeightKg) * 2.20462;
                    setGoalWeightLb(lbs.toFixed(1));
                  }
                }}
                disabled={loading}
              >
                <Text style={[styles.unitButtonText, { color: goalWeightUnit === 'lbs' ? '#fff' : colors.text }]}>lbs</Text>
              </TouchableOpacity>
            </View>
          </View>
          {goalWeightUnit === 'kg' ? (
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: error && !goalWeightKg ? '#EF4444' : colors.border,
                  color: colors.text,
                  backgroundColor: colors.backgroundSecondary,
                  ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                },
              ]}
              placeholder={t('onboarding.goal_weight.weight_kg_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={goalWeightKg}
              onChangeText={(text) => {
                setGoalWeightKg(filterHeightInput(text));
                setError(null);
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                'Goal weight in kilograms',
                t('onboarding.goal_weight.weight_kg_placeholder'),
                error && !goalWeightKg ? error : undefined,
                true
              )}
            />
          ) : (
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: error && !goalWeightLb ? '#EF4444' : colors.border,
                  color: colors.text,
                  backgroundColor: colors.backgroundSecondary,
                  ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                },
              ]}
              placeholder={t('onboarding.goal_weight.weight_lb_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={goalWeightLb}
              onChangeText={(text) => {
                setGoalWeightLb(filterHeightInput(text));
                setError(null);
              }}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                'Goal weight in pounds',
                t('onboarding.goal_weight.weight_lb_placeholder'),
                error && !goalWeightLb ? error : undefined,
                true
              )}
            />
          )}
        </View>
      </View>
    );
  };
  
  const renderTimelineStep = () => {
    // Calculate summary for display
    let currentWeightDisplay = '';
    let goalWeightDisplay = '';
    
    if (currentWeightUnit === 'kg' && currentWeightKg) {
      currentWeightDisplay = `${currentWeightKg} kg`;
    } else if (currentWeightUnit === 'lbs' && currentWeightLb) {
      currentWeightDisplay = `${currentWeightLb} lb`;
    }
    
    if (goalWeightUnit === 'kg' && goalWeightKg) {
      goalWeightDisplay = `${goalWeightKg} kg`;
    } else if (goalWeightUnit === 'lbs' && goalWeightLb) {
      goalWeightDisplay = `${goalWeightLb} lb`;
    }
    
    return (
      <View style={styles.stepContent}>
        <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
          {t('onboarding.timeline.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          {t('onboarding.timeline.subtitle')}
        </ThemedText>
        
        {currentWeightDisplay && goalWeightDisplay && (
          <View style={[styles.summaryBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              {t('onboarding.timeline.summary_label')}
            </ThemedText>
            <ThemedText style={[styles.summaryValue, { color: colors.text }]}>
              From {currentWeightDisplay} to {goalWeightDisplay}
            </ThemedText>
          </View>
        )}
        
        <View style={styles.goalContainer}>
          {[
            { value: '3_months' as const, labelKey: 'onboarding.timeline.three_months' },
            { value: '6_months' as const, labelKey: 'onboarding.timeline.six_months' },
            { value: '12_months' as const, labelKey: 'onboarding.timeline.twelve_months' },
            { value: 'no_deadline' as const, labelKey: 'onboarding.timeline.no_deadline' },
          ].map((timeline) => (
            <TouchableOpacity
              key={timeline.value}
              style={[
                styles.goalCard,
                { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                timelineOption === timeline.value && { 
                  backgroundColor: colors.tint, 
                  borderColor: colors.tint,
                  ...Platform.select({
                    web: { boxShadow: `0 4px 12px ${colors.tint}40` },
                    default: {
                      shadowColor: colors.tint,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    },
                  }),
                },
              ]}
              onPress={() => {
                setTimelineOption(timeline.value);
                setCustomTargetDate(null);
                setError(null);
              }}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${t(timeline.labelKey)}${timelineOption === timeline.value ? ' selected' : ''}`,
                `Double tap to select ${t(timeline.labelKey)}`,
                loading
              )}
              accessibilityRole="radio"
              accessibilityState={{ selected: timelineOption === timeline.value }}
            >
              <Text style={[styles.goalCardTitle, { color: timelineOption === timeline.value ? '#fff' : colors.text }]}>
                {t(timeline.labelKey)}
              </Text>
              {timelineOption === timeline.value && (
                <View style={styles.goalCardCheckmark}>
                  <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };
  
  // Legacy step renderers (will be reorganized into Steps 5+ later)
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        Personal Information
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Tell us a bit about yourself
      </ThemedText>
      
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Preferred Name</ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: error && !firstName ? '#EF4444' : colors.border,
              color: colors.text,
              backgroundColor: colors.background,
              ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
            },
          ]}
          placeholder="Enter your preferred name"
          placeholderTextColor={colors.textSecondary}
          value={firstName}
          onChangeText={(text) => {
            if (text.length <= 40) {
              setFirstName(text);
              setError(null);
            }
          }}
          maxLength={40}
          autoCapitalize="words"
          autoComplete="given-name"
          editable={!loading}
          {...getInputAccessibilityProps('Preferred name', 'Enter your preferred name', error && !firstName ? error : undefined, true)}
        />
      </View>
      
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Date of Birth</ThemedText>
        <TouchableOpacity
          style={[
            styles.dateInput,
            {
              borderColor: error && !dateOfBirth ? '#EF4444' : colors.border,
              backgroundColor: colors.backgroundSecondary,
            },
          ]}
          onPress={handleOpenDatePicker}
          disabled={loading}
          {...getButtonAccessibilityProps('Date of birth', 'Double tap to select your date of birth')}
        >
          <Text style={[styles.dateInputText, { color: dateOfBirth ? colors.text : colors.textSecondary }]}>
            {dateOfBirth || 'Select your date of birth'}
          </Text>
          <IconSymbol name="calendar" size={20} color={colors.icon} />
        </TouchableOpacity>
        
        {dateOfBirth && (
          <View style={styles.ageDisplay}>
            <ThemedText style={[styles.ageLabel, { color: colors.textSecondary }]}>
              Age: <Text style={{ color: colors.text, fontWeight: '600' }}>{ageFromDob(dateOfBirth)} years old</Text>
            </ThemedText>
          </View>
        )}
      </View>
      
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Gender at Birth</ThemedText>
        <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
          For accuracy on caloric calculations
        </ThemedText>
        <View style={styles.genderContainer}>
          {(['male', 'female', 'not_telling'] as Gender[]).map((g) => {
            const displayText = g === 'not_telling' ? 'Not Telling' : g.charAt(0).toUpperCase() + g.slice(1);
            return (
              <TouchableOpacity
                key={g}
                style={[
                  styles.genderButton,
                  { borderColor: colors.border },
                  gender === g && { backgroundColor: colors.tint, borderColor: colors.tint },
                ]}
                onPress={() => setGender(g)}
                disabled={loading}
                {...getButtonAccessibilityProps(`${displayText}${gender === g ? ' selected' : ''}`, `Double tap to select ${displayText}`)}
                accessibilityRole="radio"
                accessibilityState={{ selected: gender === g }}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    { color: gender === g ? '#fff' : colors.text },
                  ]}
                >
                  {displayText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {gender === 'not_telling' && (
          <ThemedText style={[styles.description, { color: colors.textSecondary, marginTop: 8 }]}>
            No problem at all. For caloric calculations, we'll use values based on XX-typical physiology.
          </ThemedText>
        )}
      </View>
    </View>
  );
  
  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        Physical Information
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Help us calculate your caloric needs
      </ThemedText>
      
      <View style={styles.measurementSection}>
        <View style={styles.measurementHeader}>
          <ThemedText style={[styles.label, { color: colors.text }]}>Height</ThemedText>
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[
                styles.unitButton,
                { borderColor: colors.border },
                heightUnit === 'cm' && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => {
                setHeightUnit('cm');
                if (heightFt && heightIn) {
                  const totalInches = parseFloat(heightFt) * 12 + parseFloat(heightIn);
                  const cm = totalInches * 2.54;
                  setHeightCm(cm.toFixed(1));
                }
              }}
              disabled={loading}
            >
              <Text style={[styles.unitButtonText, { color: heightUnit === 'cm' ? '#fff' : colors.text }]}>
                cm
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.unitButton,
                { borderColor: colors.border },
                heightUnit === 'ft' && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => {
                setHeightUnit('ft');
                if (heightCm) {
                  const totalInches = parseFloat(heightCm) / 2.54;
                  const feet = Math.floor(totalInches / 12);
                  const inches = Math.round(totalInches % 12);
                  setHeightFt(feet.toString());
                  setHeightIn(inches.toString());
                }
              }}
              disabled={loading}
            >
              <Text style={[styles.unitButtonText, { color: heightUnit === 'ft' ? '#fff' : colors.text }]}>
                ft/in
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {heightUnit === 'cm' ? (
          <TextInput
            style={[
              styles.input,
              {
                borderColor: error && !heightCm ? '#EF4444' : colors.border,
                color: colors.text,
                backgroundColor: colors.backgroundSecondary,
                ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
              },
            ]}
            placeholder="50 to 304.8"
            placeholderTextColor={colors.textSecondary}
            value={heightCm}
            onChangeText={(text) => setHeightCm(filterNumericInput(text))}
            keyboardType="numeric"
            editable={!loading}
            {...getInputAccessibilityProps('Height in centimeters', 'Enter your height in centimeters', error && !heightCm ? error : undefined, true)}
          />
        ) : (
          <View style={styles.dualInputRow}>
            <View style={styles.dualInputContainer}>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: error && !heightFt ? '#EF4444' : colors.border,
                    color: colors.text,
                    backgroundColor: colors.backgroundSecondary,
                    ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                  },
                ]}
                placeholder="ft (max 10)"
                placeholderTextColor={colors.textSecondary}
                value={heightFt}
                onChangeText={(text) => setHeightFt(filterNumericInput(text))}
                keyboardType="numeric"
                editable={!loading}
                {...getInputAccessibilityProps('Height in feet', 'Enter your height in feet', error && !heightFt ? error : undefined, true)}
              />
              <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>ft</Text>
            </View>
            <View style={styles.dualInputContainer}>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: error && !heightIn ? '#EF4444' : colors.border,
                    color: colors.text,
                    backgroundColor: colors.backgroundSecondary,
                    ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                  },
                ]}
                placeholder="in"
                placeholderTextColor={colors.textSecondary}
                value={heightIn}
                onChangeText={(text) => setHeightIn(filterNumericInput(text))}
                keyboardType="numeric"
                editable={!loading}
                {...getInputAccessibilityProps('Height in inches', 'Enter your height in inches', error && !heightIn ? error : undefined, true)}
              />
              <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>in</Text>
            </View>
          </View>
        )}
      </View>
      
      <View style={styles.measurementSection}>
        <View style={styles.measurementHeader}>
          <ThemedText style={[styles.label, { color: colors.text }]}>Weight</ThemedText>
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[
                styles.unitButton,
                { borderColor: colors.border },
                weightUnit === 'lbs' && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => {
                setWeightUnit('lbs');
                if (weightKg) {
                  const lbs = parseFloat(weightKg) * 2.20462;
                  setWeightLb(lbs.toFixed(1));
                }
              }}
              disabled={loading}
            >
              <Text style={[styles.unitButtonText, { color: weightUnit === 'lbs' ? '#fff' : colors.text }]}>
                lbs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.unitButton,
                { borderColor: colors.border },
                weightUnit === 'kg' && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => {
                setWeightUnit('kg');
                if (weightLb) {
                  const kg = parseFloat(weightLb) / 2.20462;
                  setWeightKg(kg.toFixed(1));
                }
              }}
              disabled={loading}
            >
              <Text style={[styles.unitButtonText, { color: weightUnit === 'kg' ? '#fff' : colors.text }]}>
                kg
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {weightUnit === 'lbs' ? (
          <TextInput
            style={[
              styles.input,
              {
                borderColor: error && !weightLb ? '#EF4444' : colors.border,
                color: colors.text,
                backgroundColor: colors.backgroundSecondary,
                ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
              },
            ]}
            placeholder="45 to 1200"
            placeholderTextColor={colors.textSecondary}
            value={weightLb}
            onChangeText={(text) => setWeightLb(filterNumericInput(text))}
            keyboardType="numeric"
            editable={!loading}
            {...getInputAccessibilityProps('Weight in pounds', 'Enter your weight in pounds', error && !weightLb ? error : undefined, true)}
          />
        ) : (
          <TextInput
            style={[
              styles.input,
              {
                borderColor: error && !weightKg ? '#EF4444' : colors.border,
                color: colors.text,
                backgroundColor: colors.backgroundSecondary,
                ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
              },
            ]}
            placeholder="20 to 544"
            placeholderTextColor={colors.textSecondary}
            value={weightKg}
            onChangeText={(text) => setWeightKg(filterNumericInput(text))}
            keyboardType="numeric"
            editable={!loading}
            {...getInputAccessibilityProps('Weight in kilograms', 'Enter your weight in kilograms', error && !weightKg ? error : undefined, true)}
          />
        )}
      </View>
    </View>
  );
  
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.cardContainer, { maxWidth: isDesktop ? 520 : '100%' }]}>
          <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.cardHeader}>
              {currentStep > 1 ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBack}
                  disabled={loading}
                  {...getButtonAccessibilityProps('Back', 'Double tap to go back to previous step')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol name="chevron.left" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <View style={styles.backButton} />
              )}
              <ThemedText type="title" style={[styles.headerTitle, { color: colors.text }]}>
                {currentStep === 1 ? t('onboarding.goal.header') : t('onboarding.title')}
              </ThemedText>
              <View style={styles.backButton} />
            </View>
            
            <StepIndicator currentStep={currentStep} totalSteps={totalSteps} colors={colors} />
            
            <View style={styles.cardContent}>
              {currentStep === 1 && renderGoalStep()}
              {currentStep === 2 && renderNameAgeStep()}
              {currentStep === 3 && renderSexStep()}
              {currentStep === 4 && renderHeightStep()}
              {currentStep === 5 && renderActivityStep()}
              {currentStep === 6 && renderCurrentWeightStep()}
              {currentStep === 7 && renderGoalWeightStep()}
              {currentStep === 8 && renderTimelineStep()}
              
              {error && (
                <View
                  style={[styles.errorContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444' }]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  {...(Platform.OS === 'web' ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
                >
                  <ThemedText style={[styles.errorText, { color: '#EF4444' }]}>{error}</ThemedText>
                </View>
              )}
              
              <View style={styles.buttonContainer}>
                {currentStep < totalSteps ? (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      getMinTouchTargetStyle(),
                      {
                        backgroundColor: colors.tint,
                        opacity: (loading || shouldDisableNext()) ? 0.6 : 1,
                        ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                      },
                    ]}
                    onPress={handleNext}
                    disabled={loading || shouldDisableNext()}
                    {...getButtonAccessibilityProps(
                      t('common.next'),
                      'Double tap to continue to next step',
                      loading || shouldDisableNext()
                    )}
                  >
                    {loading ? (
                      <View style={styles.buttonLoading}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.buttonText}>{t('common.loading')}</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>{t('common.next')}</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      getMinTouchTargetStyle(),
                      {
                        backgroundColor: colors.tint,
                        opacity: loading ? 0.6 : 1,
                        ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                      },
                    ]}
                    onPress={handleCompleteOnboarding}
                    disabled={loading}
                    {...getButtonAccessibilityProps(
                      loading ? t('onboarding.saving') : t('onboarding.complete_button'),
                      'Double tap to complete your profile setup',
                      loading
                    )}
                  >
                    {loading ? (
                      <View style={styles.buttonLoading}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.buttonText}>{t('onboarding.saving')}</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>{t('onboarding.complete_button')}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={[styles.datePickerOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.datePickerModal, { backgroundColor: colors.background }]}>
              <View style={[styles.datePickerHeader, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.datePickerTitle, { color: colors.text }]}>
                  Select Date of Birth
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.datePickerCloseButton}
                  {...getButtonAccessibilityProps('Close', 'Double tap to close date picker')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol name="xmark" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              {/* Month/Year Navigation */}
              <View style={[styles.calendarHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => navigateMonth('prev')}
                  {...getButtonAccessibilityProps('Previous month', 'Double tap to go to previous month')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol name="chevron.left" size={24} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.calendarMonthYear}
                  onPress={() => setShowYearMonthPicker(true)}
                  {...getButtonAccessibilityProps('Select month and year', 'Double tap to select a different month and year')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <ThemedText style={[styles.calendarMonthYearText, { color: colors.text }]}>
                    {calendarViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </ThemedText>
                  <IconSymbol name="chevron.down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => navigateMonth('next')}
                  disabled={(() => {
                    const nextMonth = new Date(calendarViewMonth);
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    const today = new Date();
                    return nextMonth > today;
                  })()}
                  {...getButtonAccessibilityProps('Next month', 'Double tap to go to next month')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol 
                    name="chevron.right" 
                    size={24} 
                    color={(() => {
                      const nextMonth = new Date(calendarViewMonth);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      const today = new Date();
                      return nextMonth > today ? colors.textSecondary : colors.text;
                    })()} 
                  />
                </TouchableOpacity>
              </View>
              
              {/* Calendar Grid */}
              <View style={styles.calendarBody}>
                {/* Day Headers */}
                <View style={styles.calendarWeekHeader}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <View key={index} style={styles.calendarDayHeader}>
                      <ThemedText style={[styles.calendarDayHeaderText, { color: colors.textSecondary }]}>
                        {day}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                
                {/* Calendar Days */}
                <View style={styles.calendarDays}>
                  {(() => {
                    const daysInMonth = getDaysInMonth(calendarViewMonth);
                    const firstDay = getFirstDayOfMonth(calendarViewMonth);
                    const days: JSX.Element[] = [];
                    
                    for (let i = 0; i < firstDay; i++) {
                      days.push(
                        <View key={`empty-${i}`} style={styles.calendarDayCell} />
                      );
                    }
                    
                    for (let day = 1; day <= daysInMonth; day++) {
                      const isSelected = isDateSelected(day);
                      const isDisabled = isDateDisabled(day);
                      const date = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), day);
                      const isToday = (() => {
                        const today = new Date();
                        return (
                          date.getDate() === today.getDate() &&
                          date.getMonth() === today.getMonth() &&
                          date.getFullYear() === today.getFullYear()
                        );
                      })();
                      
                      days.push(
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.calendarDayCell,
                            isSelected && { backgroundColor: colors.tint },
                            isDisabled && styles.calendarDayDisabled,
                          ]}
                          onPress={() => !isDisabled && handleDateSelect(day)}
                          disabled={isDisabled}
                          {...getButtonAccessibilityProps(
                            `Select ${day}`,
                            `Double tap to select ${day}`,
                            isDisabled
                          )}
                          {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                        >
                          <ThemedText
                            style={[
                              styles.calendarDayText,
                              {
                                color: isSelected
                                  ? '#fff'
                                  : isDisabled
                                  ? colors.textSecondary
                                  : isToday
                                  ? colors.tint
                                  : colors.text,
                                fontWeight: isToday ? '600' : '400',
                              },
                            ]}
                          >
                            {day}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    }
                    
                    return days;
                  })()}
                </View>
              </View>
              
              <View style={[styles.datePickerFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.datePickerDoneButton, { backgroundColor: colors.tint }]}
                  onPress={() => setShowDatePicker(false)}
                  {...getButtonAccessibilityProps('Done', 'Double tap to confirm date selection')}
                  {...(Platform.OS === 'web' ? getFocusStyle('#fff') : {})}
                >
                  <Text style={styles.datePickerDoneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      
      {/* Year/Month Picker Modal */}
      <Modal
        visible={showYearMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowYearMonthPicker(false)}
      >
        <TouchableOpacity
          style={[styles.datePickerOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setShowYearMonthPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.yearMonthPickerModal, { backgroundColor: colors.background }]}>
              <View style={[styles.datePickerHeader, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.datePickerTitle, { color: colors.text }]}>
                  Select Year and Month
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowYearMonthPicker(false)}
                  style={styles.datePickerCloseButton}
                  {...getButtonAccessibilityProps('Close', 'Double tap to close year and month picker')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol name="xmark" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.yearMonthPickerBody}>
                {/* Year Picker */}
                <View style={styles.yearMonthPickerColumn}>
                  <ThemedText style={[styles.yearMonthPickerLabel, { color: colors.textSecondary }]}>
                    Year
                  </ThemedText>
                  <ScrollView 
                    ref={yearScrollViewRef}
                    style={styles.yearMonthPickerScrollView} 
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles.yearMonthPickerScrollContent}
                  >
                    {Array.from({ length: 150 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      const maxYear = new Date().getFullYear();
                      if (year > maxYear) return null;
                      const isSelected = calendarViewMonth.getFullYear() === year;
                      return (
                        <TouchableOpacity
                          key={year}
                          style={[
                            styles.yearMonthPickerOption,
                            isSelected && { backgroundColor: colors.tint, borderColor: colors.tint },
                            !isSelected && { borderColor: colors.border },
                          ]}
                          onPress={() => {
                            const newDate = new Date(calendarViewMonth);
                            newDate.setFullYear(year);
                            const today = new Date();
                            if (newDate > today) {
                              newDate.setTime(today.getTime());
                            }
                            setCalendarViewMonth(newDate);
                          }}
                          {...getButtonAccessibilityProps(
                            `Select year ${year}`,
                            `Double tap to select year ${year}`,
                            false
                          )}
                          {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                        >
                          <ThemedText
                            style={[
                              styles.yearMonthPickerOptionText,
                              { color: isSelected ? '#fff' : colors.text },
                            ]}
                          >
                            {year}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    }).filter(Boolean)}
                  </ScrollView>
                </View>
                
                {/* Month Picker */}
                <View style={styles.yearMonthPickerColumn}>
                  <ThemedText style={[styles.yearMonthPickerLabel, { color: colors.textSecondary }]}>
                    Month
                  </ThemedText>
                  <ScrollView 
                    ref={monthScrollViewRef}
                    style={styles.yearMonthPickerScrollView} 
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles.yearMonthPickerScrollContent}
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      const monthName = new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'long' });
                      const isSelected = calendarViewMonth.getMonth() + 1 === month;
                      const testDate = new Date(calendarViewMonth.getFullYear(), i, 1);
                      const today = new Date();
                      const isDisabled = testDate > today;
                      
                      return (
                        <TouchableOpacity
                          key={month}
                          style={[
                            styles.yearMonthPickerOption,
                            isSelected && !isDisabled && { backgroundColor: colors.tint, borderColor: colors.tint },
                            !isSelected && { borderColor: colors.border },
                            isDisabled && { opacity: 0.4 },
                          ]}
                          onPress={() => {
                            if (isDisabled) return;
                            const newDate = new Date(calendarViewMonth);
                            newDate.setMonth(i);
                            const today = new Date();
                            if (newDate > today) {
                              newDate.setTime(today.getTime());
                            }
                            setCalendarViewMonth(newDate);
                          }}
                          disabled={isDisabled}
                          {...getButtonAccessibilityProps(
                            `Select ${monthName}`,
                            `Double tap to select ${monthName}`,
                            isDisabled
                          )}
                          {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                        >
                          <ThemedText
                            style={[
                              styles.yearMonthPickerOptionText,
                              { color: isSelected && !isDisabled ? '#fff' : colors.text },
                            ]}
                          >
                            {monthName}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
              
              <View style={[styles.datePickerFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.datePickerDoneButton, { backgroundColor: colors.tint }]}
                  onPress={() => setShowYearMonthPicker(false)}
                  {...getButtonAccessibilityProps('Done', 'Double tap to confirm year and month selection')}
                  {...(Platform.OS === 'web' ? getFocusStyle('#fff') : {})}
                >
                  <Text style={styles.datePickerDoneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      
      {/* Date Picker Modal for Step 2 */}
      <Modal
        visible={showDatePickerStep2}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePickerStep2(false)}
      >
        <TouchableOpacity
          style={[styles.datePickerOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setShowDatePickerStep2(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.datePickerModal, { backgroundColor: colors.background }]}>
              <View style={[styles.datePickerHeader, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.datePickerTitle, { color: colors.text }]}>
                  {t('date_picker.select_date_of_birth')}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowDatePickerStep2(false)}
                  style={styles.datePickerCloseButton}
                  {...getButtonAccessibilityProps('Close', 'Double tap to close date picker')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol name="xmark" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              {/* Month/Year Navigation */}
              <View style={[styles.calendarHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => navigateMonthStep2('prev')}
                  {...getButtonAccessibilityProps('Previous month', 'Double tap to go to previous month')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol name="chevron.left" size={24} color={colors.text} />
                </TouchableOpacity>
                <ThemedText style={[styles.calendarMonthYearText, { color: colors.text }]}>
                  {calendarViewMonthStep2.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </ThemedText>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => navigateMonthStep2('next')}
                  disabled={(() => {
                    const nextMonth = new Date(calendarViewMonthStep2);
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    const today = new Date();
                    return nextMonth > today;
                  })()}
                  {...getButtonAccessibilityProps('Next month', 'Double tap to go to next month')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol 
                    name="chevron.right" 
                    size={24} 
                    color={(() => {
                      const nextMonth = new Date(calendarViewMonthStep2);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      const today = new Date();
                      return nextMonth > today ? colors.textSecondary : colors.text;
                    })()} 
                  />
                </TouchableOpacity>
              </View>
              
              {/* Calendar Grid */}
              <View style={styles.calendarBody}>
                {/* Day Headers */}
                <View style={styles.calendarWeekHeader}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <View key={index} style={styles.calendarDayHeader}>
                      <ThemedText style={[styles.calendarDayHeaderText, { color: colors.textSecondary }]}>
                        {day}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                
                {/* Calendar Days */}
                <View style={styles.calendarDays}>
                  {(() => {
                    const daysInMonth = getDaysInMonthStep2(calendarViewMonthStep2);
                    const firstDay = getFirstDayOfMonthStep2(calendarViewMonthStep2);
                    const days: JSX.Element[] = [];
                    
                    for (let i = 0; i < firstDay; i++) {
                      days.push(
                        <View key={`empty-${i}`} style={styles.calendarDayCell} />
                      );
                    }
                    
                    for (let day = 1; day <= daysInMonth; day++) {
                      const isSelected = isDateSelectedStep2(day);
                      const isDisabled = isDateDisabledStep2(day);
                      const date = new Date(calendarViewMonthStep2.getFullYear(), calendarViewMonthStep2.getMonth(), day);
                      const isToday = (() => {
                        const today = new Date();
                        return (
                          date.getDate() === today.getDate() &&
                          date.getMonth() === today.getMonth() &&
                          date.getFullYear() === today.getFullYear()
                        );
                      })();
                      
                      days.push(
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.calendarDayCell,
                            isSelected && { backgroundColor: colors.tint },
                            isDisabled && styles.calendarDayDisabled,
                          ]}
                          onPress={() => !isDisabled && handleDateSelectStep2(day)}
                          disabled={isDisabled}
                          {...getButtonAccessibilityProps(
                            `Select ${day}`,
                            `Double tap to select ${day}`,
                            isDisabled
                          )}
                          {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                        >
                          <ThemedText
                            style={[
                              styles.calendarDayText,
                              {
                                color: isSelected
                                  ? '#fff'
                                  : isDisabled
                                  ? colors.textSecondary
                                  : isToday
                                  ? colors.tint
                                  : colors.text,
                                fontWeight: isToday ? '600' : '400',
                              },
                            ]}
                          >
                            {day}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    }
                    
                    return days;
                  })()}
                </View>
              </View>
              
              <View style={[styles.datePickerFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.datePickerDoneButton, { backgroundColor: colors.tint }]}
                  onPress={() => setShowDatePickerStep2(false)}
                  {...getButtonAccessibilityProps('Done', 'Double tap to confirm date selection')}
                  {...(Platform.OS === 'web' ? getFocusStyle('#fff') : {})}
                >
                  <Text style={styles.datePickerDoneButtonText}>{t('common.done')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: Platform.select({ web: 20, default: 50 }),
    paddingBottom: 32,
  },
  cardContainer: {
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  cardContent: {
    gap: 20,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 4,
  },
  stepContent: {
    gap: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 12,
    marginBottom: 12,
    opacity: 0.7,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 52,
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    fontSize: 16,
  },
  ageDisplay: {
    marginTop: 8,
  },
  ageLabel: {
    fontSize: 14,
  },
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  genderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  goalContainer: {
    gap: 12,
    marginTop: 8,
  },
  goalCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    position: 'relative',
    minHeight: 80,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
  },
  goalCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  goalCardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  goalCardCheckmark: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  summaryBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  advancedGoalLink: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  advancedGoalLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  measurementSection: {
    marginBottom: 20,
    gap: 8,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dualInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dualInputContainer: {
    flex: 1,
    gap: 4,
  },
  unitLabel: {
    fontSize: 12,
    fontWeight: '500',
    paddingLeft: 4,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  datePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerModal: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  datePickerCloseButton: {
    padding: 4,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  calendarNavButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarMonthYear: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  calendarMonthYearText: {
    fontSize: 18,
    fontWeight: '600',
  },
  calendarBody: {
    padding: 16,
  },
  calendarWeekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarDayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 2,
  },
  calendarDayDisabled: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '400',
  },
  datePickerFooter: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  datePickerDoneButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  datePickerDoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  yearMonthPickerModal: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '80%',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  yearMonthPickerBody: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
    maxHeight: 400,
  },
  yearMonthPickerColumn: {
    flex: 1,
    gap: 8,
  },
  yearMonthPickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  yearMonthPickerScrollView: {
    maxHeight: 320,
  },
  yearMonthPickerScrollContent: {
    gap: 4,
    paddingBottom: 8,
  },
  yearMonthPickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  yearMonthPickerOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

