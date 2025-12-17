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
import { AvatarUploader } from '@/components/AvatarUploader';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { Colors } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { ageFromDob, dobFromAge, ActivityLevel, calculateBMR, calculateTDEE, calculateRequiredDailyCalorieDiff, calculateSafeCalorieTarget } from '@/utils/calculations';
import { 
  validatePreferredName, 
  validateDateOfBirth, 
  validateHeightCm as validateHeightCmUtil, 
  validateActivityLevel as validateActivityLevelUtil, 
  validateWeightKg as validateWeightKgUtil, 
  validateBodyFatPercent as validateBodyFatPercentUtil,
  validateGoalWeight as validateGoalWeightUtil, 
  validateTimeline as validateTimelineUtil, 
  validateSex as validateSexUtil, 
  validateGoal as validateGoalUtil 
} from '@/utils/validation';
import { POLICY } from '@/constants/constraints';
import { 
  convertHeightToCm, 
  ftInToCm, 
  cmToFtIn, 
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
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';
import { insertWeightLogAndUpdateProfile } from '@/lib/services/weightLog';

type Gender = 'male' | 'female' | 'not_telling';

function StepIndicator({ currentStep, totalSteps, colors }: { currentStep: number; totalSteps: number; colors: any }) {
  const screenWidth = Dimensions.get('window').width;
  
  // Mobile-responsive logic: scale down on narrow screens
  const isMobile = screenWidth < 600;
  const isVeryNarrow = screenWidth < 480;
  const scaleFactor = isVeryNarrow ? 0.65 : isMobile ? 0.75 : 1;
  
  // Calculate responsive sizing based on screen width
  const isNarrow = screenWidth < 375;
  const dotSize = isVeryNarrow ? 8 : isNarrow ? 10 : 12;
  const lineWidth = isVeryNarrow ? 20 : isNarrow ? 28 : 40;
  const lineMargin = isVeryNarrow ? 2 : isNarrow ? 3 : 4;
  const containerPadding = isVeryNarrow ? 8 : isNarrow ? 16 : 40;
  
  return (
    <View style={styles.stepIndicatorWrapper}>
      <View
        style={[
          styles.stepIndicatorContainer,
          {
            paddingHorizontal: containerPadding,
            transform: [{ scale: scaleFactor }],
            transformOrigin: 'center',
          },
          Platform.select({
            web: {
              transformOrigin: 'center',
            },
            default: {},
          }),
        ]}
      >
      {Array.from({ length: totalSteps }, (_, i) => (
        <View key={i} style={styles.stepIndicatorRow}>
          <View
            style={[
              styles.stepDot,
              {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: i < currentStep ? onboardingColors.primary : colors.border,
                  borderColor: i === currentStep ? onboardingColors.primary : colors.border,
              },
            ]}
          />
          {i < totalSteps - 1 && (
            <View
              style={[
                styles.stepLine,
                {
                    width: lineWidth,
                    height: isVeryNarrow ? 1.5 : 2,
                    marginHorizontal: lineMargin,
                    backgroundColor: i < currentStep ? onboardingColors.primary : colors.border,
                },
              ]}
            />
          )}
        </View>
      ))}
      </View>
    </View>
  );
}

type GoalType = 'lose' | 'maintain' | 'gain' | 'recomp';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { user, refreshProfile, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 8; // Step 1: Name & Age, Step 2: Sex, Step 3: Height, Step 4: Activity, Step 5: Current Weight, Step 6: Goal, Step 7: Goal Weight, Step 8: Timeline (more steps coming later)
  
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
  const weightsPrefilledRef = useRef(false);
  
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
  
  // Step 8: Timeline
  const [timelineOption, setTimelineOption] = useState<'3_months' | '6_months' | '12_months' | 'no_deadline' | 'custom_date' | ''>('');
  const [customTargetDate, setCustomTargetDate] = useState<string | null>(null);
  
  // Legacy state for old steps (will be reorganized later)
  const [weightLb, setWeightLb] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');
  
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
    setWeightUnit(preferredUnit);

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
  
  // Conversion helper functions using utilities
  const getHeightInCm = (): number | null => {
    return convertHeightToCm(heightUnit, heightCm, heightFt, heightIn);
  };
  
  const getWeightInKg = (unit: 'kg' | 'lb', kgValue: string, lbValue: string): number | null => {
    const raw = unit === 'kg' ? parseFloat(kgValue) : parseFloat(lbValue);
    if (isNaN(raw) || raw <= 0) return null;
    return unit === 'kg' ? raw : lbToKg(raw);
  };
  
  const getWeightInLbs = (unit: 'kg' | 'lb', kgValue: string, lbValue: string): number | null => {
    const raw = unit === 'kg' ? parseFloat(kgValue) : parseFloat(lbValue);
    if (isNaN(raw) || raw <= 0) return null;
    return unit === 'kg' ? kgToLb(raw) : raw;
  };

  const limitToOneDecimal = (text: string): string => {
    const filtered = filterNumericInput(text);
    const parts = filtered.split('.');
    if (parts.length <= 1) return filtered;
    return `${parts[0]}.${parts[1].slice(0, 1)}`;
  };

  const limitWeightInput = (text: string): string => {
    const oneDecimal = limitToOneDecimal(text);
    const [intPart, decPart] = oneDecimal.split('.');
    const limitedInt = intPart.slice(0, 3); // max 3 digits before decimal
    return decPart !== undefined ? `${limitedInt}.${decPart}` : limitedInt;
  };

  const limitBodyFatInput = (text: string): string => {
    const oneDecimal = limitToOneDecimal(text);
    const [intPart, decPart] = oneDecimal.split('.');
    const limitedInt = intPart.slice(0, 2); // max 2 digits before decimal
    return decPart !== undefined ? `${limitedInt}.${decPart}` : limitedInt;
  };

  // Decorative scale icon for weight step (fallback-friendly on native & web)

  const GenderIllustration = () => (
    <View
      style={{
        width: 172,
        height: 172,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${onboardingColors.primary}0F`,
        shadowColor: '#000',
        shadowOpacity: Platform.OS === 'web' ? 0 : 0.08,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <View
        style={{
          width: 148,
          height: 148,
          borderRadius: 24,
          backgroundColor: '#fff',
          borderWidth: 2,
          borderColor: `${onboardingColors.primary}50`,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
          paddingVertical: 16,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'center', width: '88%', gap: 14 }}>
          {[
            { bg: `${onboardingColors.primary}12`, color: onboardingColors.primary, symbol: '♀' },
            { bg: `${onboardingColors.primary}10`, color: onboardingColors.primaryDark, symbol: '♂' },
          ].map((item, idx) => (
            <View
              key={idx}
              style={{
                width: 60,
                height: 96,
                borderRadius: 18,
                backgroundColor: item.bg,
                borderWidth: 2,
                borderColor: `${onboardingColors.primary}40`,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 32,
                  color: item.color,
                  lineHeight: 38,
                  fontWeight: '600',
                }}
              >
                {item.symbol}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const HeightIllustration = () => (
    <View
      style={{
        width: 172,
        height: 172,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${onboardingColors.primary}0F`,
        shadowColor: '#000',
        shadowOpacity: Platform.OS === 'web' ? 0 : 0.08,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <View
        style={{
          width: 148,
          height: 148,
          borderRadius: 24,
          backgroundColor: '#fff',
          borderWidth: 2,
          borderColor: `${onboardingColors.primary}50`,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
        }}
      >
        {/* Ruler */}
        <View
          style={{
            width: 16,
            height: 118,
            borderRadius: 10,
            backgroundColor: `${onboardingColors.primary}12`,
            borderWidth: 2,
            borderColor: `${onboardingColors.primary}60`,
            marginRight: 16,
            justifyContent: 'space-between',
            paddingVertical: 10,
            paddingHorizontal: 4,
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={{
                height: 2,
                backgroundColor: onboardingColors.primary,
                opacity: i % 2 === 0 ? 0.9 : 0.6,
              }}
            />
          ))}
        </View>

        {/* Person silhouette */}
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: 82,
            height: 118,
            position: 'relative',
          }}
        >
          {/* Head */}
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: onboardingColors.primary,
              marginBottom: 6,
            }}
          />
          {/* Torso */}
          <View
            style={{
              width: 14,
              height: 44,
              borderRadius: 10,
              backgroundColor: onboardingColors.primary,
            }}
          />
          {/* Arms */}
          <View
            style={{
              position: 'absolute',
              top: 44,
              width: 72,
              height: 12,
              borderRadius: 10,
              backgroundColor: `${onboardingColors.primary}85`,
              transform: [{ rotate: '-10deg' }],
            }}
          />
          {/* Legs */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: 62,
            }}
          >
            {[0, 1].map((i) => (
              <View
                key={i}
                style={{
                  width: 14,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: i === 0 ? onboardingColors.primary : `${onboardingColors.primary}75`,
                  transform: [{ rotate: i === 0 ? 6 : -6 }],
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  const ActivityIllustration = () => (
    <View
      style={{
        width: 172,
        height: 172,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${onboardingColors.primary}0F`,
        shadowColor: '#000',
        shadowOpacity: Platform.OS === 'web' ? 0 : 0.08,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <View
        style={{
          width: 148,
          height: 148,
          borderRadius: 24,
          backgroundColor: '#fff',
          borderWidth: 2,
          borderColor: `${onboardingColors.primary}50`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Head */}
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: onboardingColors.primary,
            marginBottom: 6,
          }}
        />
        {/* Torso */}
        <View
          style={{
            width: 10,
            height: 40,
            borderRadius: 8,
            backgroundColor: onboardingColors.primary,
            transform: [{ rotate: '-5deg' }],
          }}
        />
        {/* Arms */}
        <View
          style={{
            position: 'absolute',
            top: 70,
            width: 60,
            height: 10,
            borderRadius: 8,
            backgroundColor: `${onboardingColors.primary}90`,
            transform: [{ rotate: '-20deg' }],
          }}
        />
        {/* Front Leg */}
        <View
          style={{
            position: 'absolute',
            bottom: 34,
            left: 70,
            width: 14,
            height: 54,
            borderRadius: 10,
            backgroundColor: onboardingColors.primary,
            transform: [{ rotate: 22 }],
          }}
        />
        {/* Back Leg */}
        <View
          style={{
            position: 'absolute',
            bottom: 28,
            right: 66,
            width: 12,
            height: 46,
            borderRadius: 10,
            backgroundColor: `${onboardingColors.primary}70`,
            transform: [{ rotate: -18 }],
          }}
        />
        {/* Ground */}
        <View
          style={{
            position: 'absolute',
            bottom: 18,
            width: 96,
            height: 8,
            borderRadius: 6,
            backgroundColor: `${onboardingColors.primary}12`,
          }}
        />
      </View>
    </View>
  );
  
  const validateStep1 = (): string | null => {
    const trimmed = firstName.trim();
    if (!trimmed) {
      return 'Preferred Name is required';
    }

    if (trimmed.length > POLICY.NAME.MAX_LEN) {
      return `Preferred Name must be ${POLICY.NAME.MAX_LEN} characters or less`;
    }

    const nameValidation = validatePreferredName(trimmed);
    if (!nameValidation.valid) {
      return nameValidation.error || 'Preferred Name is invalid';
    }

    if (!dateOfBirth) {
      return 'Date of birth is required';
    }

    const dobError = validateDateOfBirth(dateOfBirth, POLICY.DOB.MIN_AGE_YEARS, POLICY.DOB.MAX_AGE_YEARS);
    if (dobError) {
      // Map error keys to simple strings used in legacy Step1 path
      if (dobError === 'onboarding.name_age.error_dob_format') return 'Date of birth must be in YYYY-MM-DD format';
      if (dobError === 'onboarding.name_age.error_dob_future') return 'Date of birth cannot be in the future';
      if (dobError === 'onboarding.name_age.error_age_minimum') return `You must be at least ${POLICY.DOB.MIN_AGE_YEARS} years old`;
      if (dobError === 'onboarding.name_age.error_age_maximum') return `Date of birth cannot be more than ${POLICY.DOB.MAX_AGE_YEARS} years ago`;
      return dobError;
    }

    return null;
  };
  
  const validateStep2 = (): string | null => {
    const heightCmValue = getHeightInCm();
    const heightError = validateHeightCmUtil(heightCmValue);
    if (heightError) {
      return t(heightError);
    }
    
    const weightKgValue = getWeightInKg(weightUnit, weightKg, weightLb);
    const weightError = validateWeightKgUtil(weightKgValue);
    if (weightError) {
      return t(weightError);
    }
    
    return null;
  };
  
  
  const handlePreferredNameChange = (text: string) => {
    const filtered = filterPreferredNameInput(preferredName, text);
    setPreferredName(filtered);
    // Clear error when user types (errors only show on submit)
    if (error && (error.includes('name') || error.includes('Name'))) {
      setError(null);
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
    // Preferred Name validation using strict rules
    // Normalize spaces before validation
    if (preferredName) {
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
    const weightKgValue = getWeightInKg(currentWeightUnit, currentWeightKg, currentWeightLb);
    const errorKey = validateWeightKgUtil(weightKgValue);
    if (errorKey) return t(errorKey);

    const bf = currentBodyFatPercent.trim().length > 0 ? parseFloat(currentBodyFatPercent) : null;
    const bfError = validateBodyFatPercentUtil(bf);
    if (bfError) return bfError;

    return null;
  };
  
  const validateGoalWeight = (): string | null => {
    const goalWeightKgValue = getWeightInKg(goalWeightUnit, goalWeightKg, goalWeightLb);
    const currentWeightKgValue = getWeightInKg(currentWeightUnit, currentWeightKg, currentWeightLb);
    const errorKey = validateGoalWeightUtil(goalWeightKgValue, currentWeightKgValue, goal || null);
    return errorKey ? t(errorKey) : null;
  };
  
  const validateTimeline = (): string | null => {
    const errorKey = validateTimelineUtil(timelineOption, customTargetDate || null);
    return errorKey ? t(errorKey) : null;
  };
  
  const validateGoal = (): string | null => {
    const errorKey = validateGoalUtil(goal);
    return errorKey ? t(errorKey) : null;
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
      setCurrentStep(7);
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
      // Upload avatar if one was chosen
      if (avatarUri && user) {
        try {
          const { cacheBustedUrl } = await uploadUserAvatar({ userId: user.id, sourceUri: avatarUri });
          await setProfileAvatarUrl({ userId: user.id, avatarUrl: cacheBustedUrl });
        } catch (error) {
          console.error('Failed to upload avatar', error);
          // Do not block onboarding if avatar upload fails
        }
      }

      const updateData: any = {};
      if (preferredName) {
        // Normalize spaces before saving
        const normalized = normalizeSpaces(preferredName);
        if (normalized) {
          updateData.first_name = normalized;
        }
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
      setCurrentStep(2);
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
      setCurrentStep(3);
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
      
      // Convert 'ft/in' to 'ft' for database storage
      const dbHeightUnit = heightUnit === 'ft/in' ? 'ft' : heightUnit;
      
      const updatedProfile = await updateProfile(user.id, {
        height_cm: heightCmValue,
        height_unit: dbHeightUnit,
      });
      
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
      setCurrentStep(5);
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
    
    // Convert weight to lb and save via weight log
    setLoading(true);
    try {
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

      try {
        await insertWeightLogAndUpdateProfile({
          userId: user.id,
          weighedAt: new Date(),
          weightLb: storedWeightLb,
          bodyFatPercent: storedBodyFat,
          weightUnit: currentWeightUnit,
        });
      } catch (logError) {
        console.error('Weight log insert failed, falling back to direct profile update', logError);
        const fallbackUpdates: Record<string, any> = {
          weight_lb: storedWeightLb,
          weight_unit: currentWeightUnit === 'lb' ? 'lbs' : 'kg',
        };
        if (storedBodyFat !== null) {
          fallbackUpdates.body_fat_percent = storedBodyFat;
        }
        const updatedProfile = await updateProfile(user.id, fallbackUpdates);
        if (!updatedProfile) {
          throw new Error('Failed to save profile');
        }
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
      let goalWeightLbValue: number;
      
      if (goalWeightUnit === 'kg') {
        const kg = parseFloat(goalWeightKg);
        goalWeightLbValue = kgToLb(kg);
      } else {
        goalWeightLbValue = parseFloat(goalWeightLb);
      }

      const storedGoalWeightLb = roundTo3(goalWeightLbValue);
      
      const updatedProfile = await updateProfile(user.id, {
        goal_weight_lb: storedGoalWeightLb,
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
      // Timeline step - handled by handleCompleteOnboarding
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
        return isNaN(cm) || cm <= 0 || cm < 120 || cm > 230;
      } else {
        const ft = parseFloat(heightFt);
        const inches = parseFloat(heightIn);
        if (isNaN(ft) || isNaN(inches) || ft <= 0) return true;
        const totalInches = ft * 12 + inches;
        const cmValue = totalInches * 2.54;
        return cmValue < 120 || cmValue > 230;
      }
    } else if (currentStep === 4) {
      return !activityLevel || (activityLevel !== 'sedentary' && activityLevel !== 'light' && activityLevel !== 'moderate' && activityLevel !== 'high' && activityLevel !== 'very_high');
    } else if (currentStep === 5) {
      // Check if current weight is valid
      if (currentWeightUnit === 'kg') {
        const kg = parseFloat(currentWeightKg);
        return isNaN(kg) || kg <= 0 || kg < 35 || kg > 250;
      } else {
        const lbs = parseFloat(currentWeightLb);
        if (isNaN(lbs) || lbs <= 0) return true;
        const kgValue = lbToKg(lbs);
        return kgValue < 35 || kgValue > 250;
      }

      if (currentBodyFatPercent) {
        const bf = parseFloat(currentBodyFatPercent);
        if (isNaN(bf) || bf <= 0 || bf > 80) return true;
      }
    } else if (currentStep === 6) {
      return !goal;
    } else if (currentStep === 7) {
      // Check if goal weight is valid (basic validation, detailed validation happens on submit)
      if (goalWeightUnit === 'kg') {
        const kg = parseFloat(goalWeightKg);
        return isNaN(kg) || kg <= 0 || kg < 35 || kg > 250;
      } else {
        const lbs = parseFloat(goalWeightLb);
        if (isNaN(lbs) || lbs <= 0) return true;
        const kgValue = lbToKg(lbs);
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
        currentWeightKgValue = lbToKg(parseFloat(currentWeightLb));
      }
      
      if (goalWeightUnit === 'kg') {
        goalWeightKgValue = parseFloat(goalWeightKg);
      } else {
        goalWeightKgValue = lbToKg(parseFloat(goalWeightLb));
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
      const heightCmValue = getHeightInCm();
      const weightLbValue = getWeightInLbs(weightUnit, weightKg, weightLb);
      const storedWeightLb = typeof weightLbValue === 'number' ? roundTo3(weightLbValue) : null;
      
      if (!heightCmValue || !storedWeightLb) {
        throw new Error('Height and Weight are required');
      }
      
      // Convert 'ft/in' to 'ft' for database storage
      const dbHeightUnit = heightUnit === 'ft/in' ? 'ft' : heightUnit;
      
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
          p_weight_lb: storedWeightLb,
          p_height_unit: dbHeightUnit,
          p_weight_unit: weightUnit === 'lb' ? 'lbs' : 'kg',
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
          weight_lb: storedWeightLb,
          height_unit: dbHeightUnit,
          weight_unit: weightUnit === 'lb' ? 'lbs' : 'kg',
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
          {allGoals.map((goalOption) => {
            const selected = goal === goalOption.value;
            const pressed = pressedCard === goalOption.value;
            
            return (
              <TouchableOpacity
                key={goalOption.value}
                style={[
                  styles.goalCard,
                  {
                    borderColor: selected ? 'transparent' : colors.border,
                    backgroundColor: selected ? undefined : colors.background,
                    borderWidth: selected ? 0 : 1,
                    borderRadius: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    transform: [{ scale: selected ? 1.02 : pressed ? 0.97 : 1 }],
                    opacity: pressed ? 0.96 : 1,
                  },
                  !selected && {
                    ...Platform.select({
                      web: {
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s ease',
                      },
                      default: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3,
                        elevation: 2,
                      },
                    }),
                  },
                  selected && {
                    ...Platform.select({
                      web: {
                        background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        transition: 'all 0.2s ease',
                      },
                      default: {
                        backgroundColor: onboardingColors.primary,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12,
                        shadowRadius: 12,
                        elevation: 4,
                      },
                    }),
                  },
                  Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
                ]}
                onPress={() => {
                  setGoal(goalOption.value);
                  setError(null);
                }}
                onPressIn={() => setPressedCard(goalOption.value)}
                onPressOut={() => setPressedCard(null)}
                disabled={loading}
                {...getButtonAccessibilityProps(
                  `${t(goalOption.labelKey)}${selected ? ' selected' : ''}`,
                  `Double tap to select ${t(goalOption.labelKey)}`,
                  loading
                )}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={{ flex: 1, paddingRight: selected ? 40 : 0 }}>
                  <Text style={[styles.goalCardTitle, { color: selected ? '#fff' : colors.text }]}>
                    {t(goalOption.labelKey)}
                  </Text>
                  <Text style={[styles.goalCardDescription, { color: selected ? 'rgba(255,255,255,0.9)' : colors.textSecondary }]}>
                    {t(goalOption.descriptionKey)}
                  </Text>
                </View>
                {selected && (
                  <View style={styles.goalCardCheckmark}>
                    <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
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
            <ThemedText style={[styles.advancedGoalLinkText, { color: onboardingColors.primary }]}>
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
      
      <AvatarUploader
        value={avatarUri}
        onChange={setAvatarUri}
        size={110}
        disabled={loading}
      />
      
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>
          {t('onboarding.name_age.preferred_name_label')}
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: error && (error.includes('name') || error.includes('Name') || error.includes('emoji') || error.includes('different name')) ? '#EF4444' : colors.border,
              color: colors.text,
              backgroundColor: colors.backgroundSecondary,
              ...(Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {}),
            },
          ]}
          placeholder={t('onboarding.name_age.preferred_name_placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={preferredName}
          onChangeText={handlePreferredNameChange}
          onBlur={handlePreferredNameBlur}
          maxLength={30}
          autoCapitalize="words"
          autoComplete="given-name"
          editable={!loading}
          {...getInputAccessibilityProps(
            t('onboarding.name_age.preferred_name_label'),
            t('onboarding.name_age.preferred_name_placeholder'),
            error && (error.includes('name') || error.includes('Name') || error.includes('emoji') || error.includes('different name')) ? error : undefined,
            false
          )}
        />
        <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
          Allowed: letters, numbers, spaces, and ' - . One emoji max.
        </ThemedText>
        {error && (error.includes('name') || error.includes('Name') || error.includes('emoji') || error.includes('different name')) && (
          <ThemedText style={[styles.errorText, { color: '#EF4444' }]}>
            {error}
          </ThemedText>
        )}
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
        
        <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
          {t('onboarding.name_age.subtitle')}
        </ThemedText>
        
        {/* Shared AppDatePicker for DOB */}
        <AppDatePicker
          value={selectedDateStep2}
          onChange={handleDateOfBirthChange}
          minimumDate={getDOBMinDate()}
          maximumDate={getDOBMaxDate()}
          visible={showDatePickerStep2}
          onClose={() => setShowDatePickerStep2(false)}
          title={t('date_picker.select_date_of_birth')}
        />
      </View>
    </View>
  );
  
  const [pressedCard, setPressedCard] = useState<string | null>(null);
  
  const renderSexStep = () => {
    const isSelected = (value: string) => sex === value;
    
    return (
      <View style={styles.stepContentAnimated}>
        {/* SVG Illustration */}
        <View style={styles.stepIllustration}>
          <GenderIllustration />
        </View>
        
        {/* Title */}
        <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
          {t('onboarding.sex.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
          {t('onboarding.sex.subtitle')}
        </ThemedText>
        
        <View style={styles.goalContainer}>
          {[
            { value: 'male' as const, labelKey: 'onboarding.sex.male' },
            { value: 'female' as const, labelKey: 'onboarding.sex.female' },
          ].map((sexOption) => {
            const selected = isSelected(sexOption.value);
            const pressed = pressedCard === sexOption.value;
            
            return (
              <TouchableOpacity
                key={sexOption.value}
                style={[
                  styles.goalCard,
                  {
                    borderColor: selected ? 'transparent' : colors.border,
                    backgroundColor: selected ? undefined : colors.background,
                    borderWidth: selected ? 0 : 1,
                    borderRadius: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    transform: [{ scale: selected ? 1.02 : pressed ? 0.97 : 1 }],
                    opacity: pressed ? 0.96 : 1,
                  },
                  !selected && {
                    ...Platform.select({
                      web: {
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s ease',
                      },
                      default: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3,
                        elevation: 2,
                      },
                    }),
                  },
                  selected && {
                    ...Platform.select({
                      web: {
                        background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        transition: 'all 0.2s ease',
                      },
                      default: {
                        backgroundColor: onboardingColors.primary,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12,
                        shadowRadius: 12,
                        elevation: 4,
                      },
                    }),
                  },
                  Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
                ]}
                onPress={() => {
                  setSex(sexOption.value);
                  setError(null);
                }}
                onPressIn={() => setPressedCard(sexOption.value)}
                onPressOut={() => setPressedCard(null)}
                disabled={loading}
                {...getButtonAccessibilityProps(
                  `${t(sexOption.labelKey)}${selected ? ' selected' : ''}`,
                  `Double tap to select ${t(sexOption.labelKey)}`,
                  loading
                )}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={{ flex: 1, paddingRight: selected ? 40 : 0 }}>
                  <Text style={[styles.goalCardTitle, { color: selected ? '#fff' : colors.text }]}>
                    {t(sexOption.labelKey)}
                  </Text>
                </View>
                {selected && (
                  <View style={styles.goalCardCheckmark}>
                    <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };
  
  const renderHeightStep = () => {
    const isSelected = (value: string) => heightUnit === value;
    
    return (
      <View style={styles.stepContentAnimated}>
        {/* SVG Illustration */}
        <View style={styles.stepIllustration}>
          <HeightIllustration />
        </View>
        
        {/* Title */}
        <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
          {t('onboarding.height.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
          {t('onboarding.height.subtitle')}
        </ThemedText>
        
        {/* Unit Toggle - Modern Pill Style */}
        <View style={styles.unitToggleModern}>
          {[
            { value: 'cm', label: 'cm' },
            { value: 'ft/in', label: 'ft/in' },
          ].map((unitOption) => {
            const selected = isSelected(unitOption.value);
            
            return (
              <TouchableOpacity
                key={unitOption.value}
                style={[
                  styles.unitPill,
                  selected ? styles.unitPillSelected : styles.unitPillUnselected,
                  {
                    transform: [{ scale: selected ? 1.02 : 1 }],
                  },
                  selected && {
                    ...Platform.select({
                      web: {
                        background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                        boxShadow: `0 4px 12px ${onboardingColors.primary}40`,
                      },
                      default: {
                        backgroundColor: onboardingColors.primary,
                        shadowColor: onboardingColors.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 12,
                        elevation: 4,
                      },
                    }),
                  },
                  !selected && Platform.select({
                    web: {
                      background: '#FFFFFF',
                      borderColor: '#E5E7EB',
                      boxShadow: 'none',
                    },
                    default: {
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E5E7EB',
                    },
                  }),
                  Platform.select({
                    web: {
                      transition: 'all 0.2s ease',
                    },
                    default: {},
                  }),
                ]}
                onPress={() => {
                  if (unitOption.value === 'cm') {
                    setHeightUnit('cm');
                    if (heightFt && heightIn) {
                      const totalInches = parseFloat(heightFt) * 12 + parseFloat(heightIn);
                      const cm = totalInches * 2.54;
                      setHeightCm(cm.toFixed(1));
                    }
                  } else {
                    setHeightUnit('ft/in');
                    if (heightCm) {
                      const totalInches = parseFloat(heightCm) / 2.54;
                      const feet = Math.floor(totalInches / 12);
                      const inches = Math.round(totalInches % 12);
                      setHeightFt(feet.toString());
                      setHeightIn(inches.toString());
                    }
                  }
                  setError(null);
                }}
                disabled={loading}
                {...getButtonAccessibilityProps(
                  `${unitOption.label}${selected ? ' selected' : ''}`,
                  `Double tap to select ${unitOption.label}`,
                  loading
                )}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.unitPillText,
                    { color: selected ? '#FFFFFF' : onboardingColors.primary },
                  ]}
                >
                  {unitOption.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Height Inputs */}
        <View style={styles.heightInputContainer}>
          {heightUnit === 'cm' ? (
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.inputModern,
                  {
                    borderColor: error && !heightCm ? '#EF4444' : '#E5E7EB',
                    color: colors.text,
                    backgroundColor: '#FFFFFF',
                  },
                  Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
                ]}
                placeholder={t('onboarding.height.height_cm_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={heightCm}
                onChangeText={(text) => {
                  setHeightCm(filterNumericInput(text));
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
              <Text style={[styles.inputUnitLabel, { color: '#404040' }]}>cm</Text>
            </View>
          ) : (
            <View style={styles.dualInputRowModern}>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <TextInput
                  style={[
                    styles.inputModern,
                    {
                      borderColor: error && !heightFt ? '#EF4444' : '#E5E7EB',
                      color: colors.text,
                      backgroundColor: '#FFFFFF',
                    },
                    Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
                  ]}
                  placeholder={t('onboarding.height.height_ft_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={heightFt}
                  onChangeText={(text) => {
                    setHeightFt(filterNumericInput(text));
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
                <Text style={[styles.inputUnitLabel, { color: '#404040' }]}>ft</Text>
              </View>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <TextInput
                  style={[
                    styles.inputModern,
                    {
                      borderColor: error && !heightIn ? '#EF4444' : '#E5E7EB',
                      color: colors.text,
                      backgroundColor: '#FFFFFF',
                    },
                    Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
                  ]}
                  placeholder={t('onboarding.height.height_in_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={heightIn}
                  onChangeText={(text) => {
                    setHeightIn(filterNumericInput(text));
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
                <Text style={[styles.inputUnitLabel, { color: '#404040' }]}>in</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };
  
  const renderActivityStep = () => (
    <View style={styles.stepContentAnimated}>
      {/* SVG Illustration */}
      <View style={styles.stepIllustration}>
        <ActivityIllustration />
      </View>
      
      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
        {t('onboarding.activity.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
        {t('onboarding.activity.subtitle')}
      </ThemedText>
      
      <View style={styles.goalContainer}>
        {[
          { value: 'sedentary' as const, labelKey: 'onboarding.activity.sedentary.label', descriptionKey: 'onboarding.activity.sedentary.description' },
          { value: 'light' as const, labelKey: 'onboarding.activity.light.label', descriptionKey: 'onboarding.activity.light.description' },
          { value: 'moderate' as const, labelKey: 'onboarding.activity.moderate.label', descriptionKey: 'onboarding.activity.moderate.description' },
          { value: 'high' as const, labelKey: 'onboarding.activity.high.label', descriptionKey: 'onboarding.activity.high.description' },
          { value: 'very_high' as const, labelKey: 'onboarding.activity.very_high.label', descriptionKey: 'onboarding.activity.very_high.description' },
        ].map((activity) => {
          const selected = activityLevel === activity.value;
          const pressed = pressedCard === activity.value;
          
          return (
            <TouchableOpacity
              key={activity.value}
              style={[
                styles.goalCard,
                {
                  borderColor: selected ? 'transparent' : colors.border,
                  backgroundColor: selected ? undefined : colors.background,
                  borderWidth: selected ? 0 : 1,
                  borderRadius: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  transform: [{ scale: selected ? 1.02 : pressed ? 0.97 : 1 }],
                  opacity: pressed ? 0.96 : 1,
                },
                !selected && {
                  ...Platform.select({
                    web: {
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      transition: 'all 0.2s ease',
                    },
                    default: {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                      elevation: 2,
                    },
                  }),
                },
                selected && {
                  ...Platform.select({
                    web: {
                      background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      transition: 'all 0.2s ease',
                    },
                    default: {
                      backgroundColor: onboardingColors.primary,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.12,
                      shadowRadius: 12,
                      elevation: 4,
                    },
                  }),
                },
                Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
              ]}
              onPress={() => {
                setActivityLevel(activity.value);
                setError(null);
              }}
              onPressIn={() => setPressedCard(activity.value)}
              onPressOut={() => setPressedCard(null)}
              disabled={loading}
              {...getButtonAccessibilityProps(
                `${t(activity.labelKey)}${selected ? ' selected' : ''}`,
                `Double tap to select ${t(activity.labelKey)}`,
                loading
              )}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={{ flex: 1, paddingRight: selected ? 40 : 0 }}>
                <Text style={[styles.goalCardTitle, { color: selected ? '#fff' : colors.text }]}>
                  {t(activity.labelKey)}
                </Text>
                <Text style={[styles.goalCardDescription, { color: selected ? 'rgba(255,255,255,0.9)' : colors.textSecondary }]}>
                  {t(activity.descriptionKey)}
                </Text>
              </View>
              {selected && (
                <View style={styles.goalCardCheckmark}>
                  <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
  
  const renderCurrentWeightStep = () => {
    return (
      <View style={styles.stepContentAnimated}>
        {/* SVG Illustration */}
        <View style={styles.stepIllustration}>
          <View
            style={{
              width: 172,
              height: 172,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${onboardingColors.primary}0F`,
              shadowColor: '#000',
              shadowOpacity: Platform.OS === 'web' ? 0 : 0.08,
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            <View
              style={{
                width: 148,
                height: 148,
                borderRadius: 24,
                backgroundColor: '#fff',
                borderWidth: 2,
                borderColor: `${onboardingColors.primary}50`,
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 18,
                overflow: 'hidden',
              }}
            >
              {/* Scale window */}
              <View
                style={{
                  width: 96,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: `${onboardingColors.primary}12`,
                  borderWidth: 2,
                  borderColor: `${onboardingColors.primary}50`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 70,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: `${onboardingColors.primary}30`,
                    position: 'absolute',
                    top: 10,
                  }}
                />
                <View
                  style={{
                    width: 2,
                    height: 22,
                    backgroundColor: onboardingColors.primary,
                    borderRadius: 2,
                    transform: [{ rotate: '-8deg' }],
                  }}
                />
              </View>

              {/* Foot pads */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  width: '72%',
                  marginTop: 22,
                }}
              >
                {[0, 1].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 46,
                      height: 62,
                      borderRadius: 18,
                      backgroundColor: `${onboardingColors.primary}14`,
                      borderWidth: 1.5,
                      borderColor: `${onboardingColors.primary}30`,
                      shadowColor: '#000',
                      shadowOpacity: Platform.OS === 'web' ? 0 : 0.05,
                      shadowOffset: { width: 0, height: 4 },
                      shadowRadius: 6,
                      elevation: 2,
                    }}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
        
        {/* Title */}
        <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
          {t('onboarding.current_weight.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
          {t('onboarding.current_weight.subtitle')}
        </ThemedText>
        
        {/* Unit Toggle - Modern Pill Style */}
        <View style={styles.unitToggleModern}>
          {[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lbs' },
          ].map((unitOption) => {
            const selected = currentWeightUnit === unitOption.value;
            
            return (
              <TouchableOpacity
                key={unitOption.value}
                style={[
                  styles.unitPill,
                  selected ? styles.unitPillSelected : styles.unitPillUnselected,
                  {
                    transform: [{ scale: selected ? 1.02 : 1 }],
                  },
                  selected && {
                    ...Platform.select({
                      web: {
                        background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                        boxShadow: `0 4px 12px ${onboardingColors.primary}40`,
                      },
                      default: {
                        backgroundColor: onboardingColors.primary,
                      },
                    }),
                  },
                  Platform.select({
                    web: {
                      transition: 'all 0.2s ease',
                    },
                    default: {},
                  }),
                ]}
                onPress={() => {
                  if (unitOption.value === 'kg') {
                    setCurrentWeightUnit('kg');
                    if (currentWeightLb) {
                      const kg = roundTo1(lbToKg(parseFloat(currentWeightLb)));
                      setCurrentWeightKg(kg.toString());
                    }
                  } else {
                    setCurrentWeightUnit('lb');
                    if (currentWeightKg) {
                      const lbs = roundTo1(kgToLb(parseFloat(currentWeightKg)));
                      setCurrentWeightLb(lbs.toString());
                    }
                  }
                  setError(null);
                }}
                disabled={loading}
                {...getButtonAccessibilityProps(
                  `${unitOption.label}${selected ? ' selected' : ''}`,
                  `Double tap to select ${unitOption.label}`,
                  loading
                )}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.unitPillText,
                    { color: selected ? '#FFFFFF' : onboardingColors.primary },
                  ]}
                >
                  {unitOption.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Weight Input */}
        <View style={styles.heightInputContainer}>
          <View style={styles.inputWrapper}>
            {currentWeightUnit === 'kg' ? (
              <TextInput
                style={[
                  styles.inputModern,
                  {
                    borderColor: error && !currentWeightKg ? '#EF4444' : '#E5E7EB',
                    color: colors.text,
                    backgroundColor: '#FFFFFF',
                  },
                  Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
                ]}
                placeholder={t('onboarding.current_weight.weight_kg_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={currentWeightKg}
                onChangeText={(text) => {
                  setCurrentWeightKg(limitWeightInput(text));
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
                  styles.inputModern,
                  {
                    borderColor: error && !currentWeightLb ? '#EF4444' : '#E5E7EB',
                    color: colors.text,
                    backgroundColor: '#FFFFFF',
                  },
                  Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
                ]}
                placeholder={t('onboarding.current_weight.weight_lb_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={currentWeightLb}
                onChangeText={(text) => {
                  setCurrentWeightLb(limitWeightInput(text));
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
            <Text style={[styles.inputUnitLabel, { color: '#404040' }]}>
              {currentWeightUnit}
            </Text>
        </View>

        {/* Body Fat % (optional) */}
        <View style={{ width: '100%', marginTop: 16 }}>
          <ThemedText style={[styles.label, { color: colors.text, marginBottom: 8 }]}>
            Body Fat % (optional)
          </ThemedText>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.inputModern,
                {
                  borderColor:
                    error && currentBodyFatPercent && (parseFloat(currentBodyFatPercent) <= 0 || parseFloat(currentBodyFatPercent) > 80)
                      ? '#EF4444'
                      : '#E5E7EB',
                  color: colors.text,
                  backgroundColor: '#FFFFFF',
                },
                Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
              ]}
              placeholder="Optional (e.g., 18.5)"
              placeholderTextColor={colors.textSecondary}
              value={currentBodyFatPercent}
              onChangeText={(text) => {
                setCurrentBodyFatPercent(limitBodyFatInput(text));
                setError(null);
              }}
              maxLength={4}
              keyboardType="numeric"
              editable={!loading}
              {...getInputAccessibilityProps(
                'Body fat percentage',
                'Enter your body fat percentage',
                undefined,
                false
              )}
            />
            <Text style={[styles.inputUnitLabel, { color: '#404040' }]}>%</Text>
          </View>
        </View>
      </View>
    </View>
  );
};
  
  const renderGoalWeightStep = () => {
    return (
      <View style={styles.stepContentAnimated}>
        {/* SVG Illustration */}
        <View style={styles.stepIllustration}>
          {Platform.OS === 'web' ? (
            <View
              style={{
                width: 48,
                height: 48,
              }}
              // @ts-ignore - web-specific prop
              dangerouslySetInnerHTML={{
                __html: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${onboardingColors.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
              }}
            />
          ) : (
            <IconSymbol name="target" size={48} color={onboardingColors.primary} />
          )}
        </View>
        
        {/* Title */}
        <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
          {t('onboarding.goal_weight.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
          {t('onboarding.goal_weight.subtitle')}
        </ThemedText>
        
        {/* Unit Toggle - Modern Pill Style */}
        <View style={styles.unitToggleModern}>
          {[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lbs' },
          ].map((unitOption) => {
            const selected = goalWeightUnit === unitOption.value;
            
            return (
              <TouchableOpacity
                key={unitOption.value}
                style={[
                  styles.unitPill,
                  selected ? styles.unitPillSelected : styles.unitPillUnselected,
                  {
                    transform: [{ scale: selected ? 1.02 : 1 }],
                  },
                  selected && {
                    ...Platform.select({
                      web: {
                        background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                        boxShadow: `0 4px 12px ${onboardingColors.primary}40`,
                      },
                      default: {
                        backgroundColor: onboardingColors.primary,
                      },
                    }),
                  },
                  Platform.select({
                    web: {
                      transition: 'all 0.2s ease',
                    },
                    default: {},
                  }),
                ]}
                onPress={() => {
                  if (unitOption.value === 'kg') {
                    setGoalWeightUnit('kg');
                    if (goalWeightLb) {
                      const kg = roundTo1(lbToKg(parseFloat(goalWeightLb)));
                      setGoalWeightKg(kg.toString());
                    }
                  } else {
                    setGoalWeightUnit('lb');
                    if (goalWeightKg) {
                      const lbs = roundTo1(kgToLb(parseFloat(goalWeightKg)));
                      setGoalWeightLb(lbs.toString());
                    }
                  }
                  setError(null);
                }}
                disabled={loading}
                {...getButtonAccessibilityProps(
                  `${unitOption.label}${selected ? ' selected' : ''}`,
                  `Double tap to select ${unitOption.label}`,
                  loading
                )}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.unitPillText,
                    { color: selected ? '#FFFFFF' : onboardingColors.primary },
                  ]}
                >
                  {unitOption.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Weight Input */}
        <View style={styles.heightInputContainer}>
          <View style={styles.inputWrapper}>
            {goalWeightUnit === 'kg' ? (
              <TextInput
                style={[
                  styles.inputModern,
                  {
                    borderColor: error && !goalWeightKg ? '#EF4444' : '#E5E7EB',
                    color: colors.text,
                    backgroundColor: '#FFFFFF',
                  },
                  Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
                ]}
                placeholder={t('onboarding.goal_weight.weight_kg_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={goalWeightKg}
                onChangeText={(text) => {
                  setGoalWeightKg(limitWeightInput(text));
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
                  styles.inputModern,
                  {
                    borderColor: error && !goalWeightLb ? '#EF4444' : '#E5E7EB',
                    color: colors.text,
                    backgroundColor: '#FFFFFF',
                  },
                  Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {},
                ]}
                placeholder={t('onboarding.goal_weight.weight_lb_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={goalWeightLb}
                onChangeText={(text) => {
                  setGoalWeightLb(limitWeightInput(text));
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
            <Text style={[styles.inputUnitLabel, { color: '#404040' }]}>
              {goalWeightUnit}
            </Text>
          </View>
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
    } else if (currentWeightUnit === 'lb' && currentWeightLb) {
      currentWeightDisplay = `${currentWeightLb} lb`;
    }
    
    if (goalWeightUnit === 'kg' && goalWeightKg) {
      goalWeightDisplay = `${goalWeightKg} kg`;
    } else if (goalWeightUnit === 'lb' && goalWeightLb) {
      goalWeightDisplay = `${goalWeightLb} lb`;
    }
    
    return (
      <View style={styles.stepContentAnimated}>
        {/* SVG Illustration */}
        <View style={styles.stepIllustration}>
          {Platform.OS === 'web' ? (
            <View
              style={{
                width: 48,
                height: 48,
              }}
              // @ts-ignore - web-specific prop
              dangerouslySetInnerHTML={{
                __html: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${onboardingColors.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
              }}
            />
          ) : (
            <IconSymbol name="clock" size={48} color={onboardingColors.primary} />
          )}
        </View>
        
        {/* Title */}
        <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
          {t('onboarding.timeline.title')}
        </ThemedText>
        <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
          {t('onboarding.timeline.subtitle')}
        </ThemedText>
        
        {/* Trajectory Summary Box - Neutral Style */}
        {currentWeightDisplay && goalWeightDisplay && (
          <View style={styles.trajectorySummaryBox}>
            <Text style={styles.trajectorySummaryLabel}>
              {t('onboarding.timeline.summary_label')}
            </Text>
            <Text style={styles.trajectorySummaryValue}>
              From {currentWeightDisplay} to {goalWeightDisplay}
            </Text>
          </View>
        )}
        
        {/* Timeline Options */}
        <View style={styles.goalContainer}>
          {[
            { value: '3_months' as const, labelKey: 'onboarding.timeline.three_months' },
            { value: '6_months' as const, labelKey: 'onboarding.timeline.six_months' },
            { value: '12_months' as const, labelKey: 'onboarding.timeline.twelve_months' },
            { value: 'no_deadline' as const, labelKey: 'onboarding.timeline.no_deadline' },
          ].map((timeline) => {
            const selected = timelineOption === timeline.value;
            const pressed = pressedCard === timeline.value;
            
            return (
              <TouchableOpacity
                key={timeline.value}
                style={[
                  styles.goalCard,
                  {
                    borderColor: selected ? 'transparent' : colors.border,
                    backgroundColor: selected ? undefined : colors.background,
                    borderWidth: selected ? 0 : 1,
                    borderRadius: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    transform: [{ scale: selected ? 1.02 : pressed ? 0.97 : 1 }],
                    opacity: pressed ? 0.96 : 1,
                  },
                  !selected && {
                    ...Platform.select({
                      web: {
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s ease',
                      },
                      default: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3,
                        elevation: 2,
                      },
                    }),
                  },
                  selected && {
                    ...Platform.select({
                      web: {
                        background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        transition: 'all 0.2s ease',
                      },
                      default: {
                        backgroundColor: onboardingColors.primary,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12,
                        shadowRadius: 12,
                        elevation: 4,
                      },
                    }),
                  },
                  Platform.OS === 'web' && getFocusStyle(onboardingColors.primary),
                ]}
                onPress={() => {
                  setTimelineOption(timeline.value);
                  setCustomTargetDate(null);
                  setError(null);
                }}
                onPressIn={() => setPressedCard(timeline.value)}
                onPressOut={() => setPressedCard(null)}
                disabled={loading}
                {...getButtonAccessibilityProps(
                  `${t(timeline.labelKey)}${selected ? ' selected' : ''}`,
                  `Double tap to select ${t(timeline.labelKey)}`,
                  loading
                )}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={{ flex: 1, paddingRight: selected ? 40 : 0 }}>
                  <Text style={[styles.goalCardTitle, { color: selected ? '#fff' : colors.text }]}>
                    {t(timeline.labelKey)}
                  </Text>
                </View>
                {selected && (
                  <View style={styles.goalCardCheckmark}>
                    <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
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
              ...(Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {}),
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
                  gender === g && { backgroundColor: onboardingColors.primary, borderColor: onboardingColors.primary },
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
                heightUnit === 'cm' && { backgroundColor: onboardingColors.primary, borderColor: onboardingColors.primary },
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
                heightUnit === 'ft/in' && { backgroundColor: onboardingColors.primary, borderColor: onboardingColors.primary },
              ]}
              onPress={() => {
                setHeightUnit('ft/in');
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
              <Text style={[styles.unitButtonText, { color: heightUnit === 'ft/in' ? '#fff' : colors.text }]}>
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
                ...(Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {}),
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
                    ...(Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {}),
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
                    ...(Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {}),
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
              weightUnit === 'lb' && { backgroundColor: onboardingColors.primary, borderColor: onboardingColors.primary },
              ]}
              onPress={() => {
              setWeightUnit('lb');
                if (weightKg) {
                const lbs = roundTo1(kgToLb(parseFloat(weightKg)));
                setWeightLb(lbs.toString());
                }
              }}
              disabled={loading}
            >
            <Text style={[styles.unitButtonText, { color: weightUnit === 'lb' ? '#fff' : colors.text }]}>
                lbs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.unitButton,
                { borderColor: colors.border },
                weightUnit === 'kg' && { backgroundColor: onboardingColors.primary, borderColor: onboardingColors.primary },
              ]}
              onPress={() => {
                setWeightUnit('kg');
                if (weightLb) {
                const kg = roundTo1(lbToKg(parseFloat(weightLb)));
                setWeightKg(kg.toString());
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
      {weightUnit === 'lb' ? (
          <TextInput
            style={[
              styles.input,
              {
                borderColor: error && !weightLb ? '#EF4444' : colors.border,
                color: colors.text,
                backgroundColor: colors.backgroundSecondary,
                ...(Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {}),
              },
            ]}
            placeholder="45 to 1200"
            placeholderTextColor={colors.textSecondary}
            value={weightLb}
            onChangeText={(text) => setWeightLb(limitWeightInput(text))}
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
                ...(Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {}),
              },
            ]}
            placeholder="20 to 544"
            placeholderTextColor={colors.textSecondary}
            value={weightKg}
            onChangeText={(text) => setWeightKg(limitWeightInput(text))}
            keyboardType="numeric"
            editable={!loading}
            {...getInputAccessibilityProps('Weight in kilograms', 'Enter your weight in kilograms', error && !weightKg ? error : undefined, true)}
          />
        )}
      </View>
    </View>
  );
  
  return (
    <ThemedView style={[
      styles.container,
      Platform.select({
        web: {
          background: `radial-gradient(circle at top right, ${onboardingColors.primary}1F, transparent 60%)`,
        },
        default: {
          backgroundColor: colors.background,
        },
      }),
    ]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.cardContainer, { maxWidth: isDesktop ? 520 : '100%' }]}>
          <View style={[
            styles.card,
            styles.cardModern,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}>
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
                {t('onboarding.title')}
              </ThemedText>
              <View style={styles.backButton} />
            </View>
            
            <StepIndicator currentStep={currentStep} totalSteps={totalSteps} colors={colors} />
            
            <View style={styles.cardContent}>
              {currentStep === 1 && renderNameAgeStep()}
              {currentStep === 2 && renderSexStep()}
              {currentStep === 3 && renderHeightStep()}
              {currentStep === 4 && renderActivityStep()}
              {currentStep === 5 && renderCurrentWeightStep()}
              {currentStep === 6 && renderGoalStep()}
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
              
              <View style={styles.buttonContainerModern}>
                {currentStep < totalSteps ? (
                  <TouchableOpacity
                    style={[
                      styles.buttonModern,
                      getMinTouchTargetStyle(),
                      {
                        opacity: (loading || shouldDisableNext()) ? 0.6 : 1,
                        ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                        ...Platform.select({
                          web: {
                            background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 12px rgba(22, 161, 184, 0.3)',
                          },
                          default: {
                            backgroundColor: onboardingColors.primary,
                            shadowColor: onboardingColors.primary,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 12,
                            elevation: 4,
                          },
                        }),
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
                        backgroundColor: onboardingColors.primary,
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
                  style={[styles.datePickerDoneButton, { backgroundColor: onboardingColors.primary }]}
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
                            isSelected && { backgroundColor: onboardingColors.primary, borderColor: onboardingColors.primary },
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
                            isSelected && !isDisabled && { backgroundColor: onboardingColors.primary, borderColor: onboardingColors.primary },
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
                  style={[styles.datePickerDoneButton, { backgroundColor: onboardingColors.primary }]}
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
  cardModern: {
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 6,
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
  stepIndicatorWrapper: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    // paddingHorizontal is now set dynamically in the component
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
  stepContentAnimated: {
    gap: 20,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        animation: 'fadeUp 0.3s ease',
        '@keyframes fadeUp': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
      default: {
        opacity: 1,
      },
    }),
  },
  stepIllustration: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepTitleModern: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepCaption: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  stepSubtitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  stepSubtitleModern: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
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
  goalCardModern: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 2,
    position: 'relative',
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {},
    }),
  },
  goalCardSelected: {
    borderWidth: 3,
  },
  goalCardUnselected: {
    borderWidth: 2,
  },
  goalCardPressed: {
    ...Platform.select({
      web: {
        transition: 'transform 0.15s ease, opacity 0.15s ease',
      },
      default: {},
    }),
  },
  goalCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  goalCardTitleModern: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
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
  goalCardCheckmarkModern: {
    marginLeft: 12,
    ...Platform.select({
      web: {
        transition: 'opacity 0.15s ease',
      },
      default: {},
    }),
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
  trajectorySummaryBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  trajectorySummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    color: '#6B7280',
  },
  trajectorySummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
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
  unitToggleModern: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
  unitPill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  unitPillSelected: {
    borderWidth: 0,
  },
  unitPillUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  unitPillText: {
    fontSize: 15,
    fontWeight: '600',
  },
  heightInputContainer: {
    marginTop: 12,
    gap: 12,
    width: '100%',
    maxWidth: '100%',
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
    minWidth: 0, // Allow flex items to shrink below their content size
    flexShrink: 1, // Allow shrinking in flex containers
  },
  inputModern: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    minHeight: 52,
    width: '100%',
    maxWidth: '100%', // Prevent overflow
    ...Platform.select({
      web: {
        outline: 'none',
        boxSizing: 'border-box', // Include padding in width calculation
      },
      default: {},
    }),
  },
  inputUnitLabel: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
    fontSize: 14,
    fontWeight: '600',
  },
  dualInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dualInputRowModern: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    minWidth: 0, // Allow flex items to shrink
    alignItems: 'stretch',
    flexShrink: 1, // Allow the row to shrink if needed
    maxWidth: '100%', // Prevent overflow
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
  helperText: {
    fontSize: 12,
    marginTop: 4,
    paddingLeft: 4,
  },
  buttonContainer: {
    marginTop: 20,
  },
  buttonContainerModern: {
    marginTop: 16,
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonModern: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
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

