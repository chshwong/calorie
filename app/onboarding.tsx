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
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { ageFromDob } from '@/utils/calculations';
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

export default function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2; // Only Personal Info and Physical Info
  
  // Step 1: Personal Info (was Step 2 in register)
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
  
  // Step 2: Physical Info (was Step 3 in register)
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLb, setWeightLb] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
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
  
  // Prefill firstName from user's display name (from OAuth provider)
  useEffect(() => {
    if (user && !firstName) {
      // Try to get display name from user metadata (Google OAuth provides full_name or name)
      const displayName = user.user_metadata?.full_name 
        || user.user_metadata?.name 
        || user.user_metadata?.given_name
        || '';
      
      if (displayName) {
        // If it's a full name, take just the first name (first word)
        const firstNameFromDisplay = displayName.split(' ')[0];
        setFirstName(firstNameFromDisplay);
      }
    }
  }, [user]);
  
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
  
  const handleNext = () => {
    setError(null);
    
    if (currentStep === 1) {
      const validationError = validateStep1();
      if (validationError) {
        setError(validationError);
        return;
      }
      setCurrentStep(2);
    }
  };
  
  const handleBack = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleCompleteOnboarding = async () => {
    setError(null);
    
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
        console.log('Attempting to call create_user_profile function for onboarding...');
        const { data: functionData, error: functionError } = await supabase.rpc('create_user_profile', {
          p_user_id: user.id,
          p_first_name: firstName.trim(),
          p_date_of_birth: dateOfBirth,
          p_gender: gender,
          p_height_cm: heightCmValue,
          p_weight_lb: weightLbValue,
          p_height_unit: heightUnit,
          p_weight_unit: weightUnit,
          p_onboarding_complete: true,
        });
        
        if (functionError) {
          console.error('Function error:', functionError);
          profileError = functionError;
        } else {
          console.log('Profile created/updated successfully via function');
          profileSuccess = true;
        }
      } catch (e: any) {
        console.error('Exception calling function:', e);
        profileError = e;
      }
      
      // If function failed, try direct upsert
      if (!profileSuccess) {
        console.log('Attempting direct upsert...');
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
          onboarding_complete: true,
        };
        
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(profileData, { onConflict: 'user_id' });
        
        if (upsertError) {
          console.error('Direct upsert error:', upsertError);
          throw new Error(upsertError.message || 'Failed to save profile');
        } else {
          console.log('Profile saved successfully via direct upsert');
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
  
  const renderStep1 = () => (
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
  
  const renderStep2 = () => (
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
                Complete Setup
              </ThemedText>
              <View style={styles.backButton} />
            </View>
            
            <StepIndicator currentStep={currentStep} totalSteps={totalSteps} colors={colors} />
            
            <View style={styles.cardContent}>
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              
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
                        opacity: loading ? 0.6 : 1,
                        ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                      },
                    ]}
                    onPress={handleNext}
                    disabled={loading}
                    {...getButtonAccessibilityProps('Next', 'Double tap to continue to next step', loading)}
                  >
                    <Text style={styles.buttonText}>Next</Text>
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
                    {...getButtonAccessibilityProps(loading ? 'Completing setup' : 'Complete Setup', 'Double tap to complete your profile setup', loading)}
                  >
                    {loading ? (
                      <View style={styles.buttonLoading}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.buttonText}>Saving...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Complete Setup</Text>
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

