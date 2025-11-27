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
  Animated,
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
import { ageFromDob } from '@/utils/calculations';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
  getWebAccessibilityProps,
} from '@/utils/accessibility';

type Gender = 'male' | 'female' | 'not_telling';

type PasswordValidation = {
  minLength: boolean;
  hasAlphabet: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  noLeadingTrailingSpaces: boolean;
  notMatchesEmail: boolean;
  notCommon: boolean;
};

const COMMON_PASSWORDS = [
  '123456',
  'password',
  '12345678',
  'qwerty',
  'abc123',
  'password123',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  '1234567890',
  'password1',
  'qwerty123',
];

function validatePassword(password: string, email: string): PasswordValidation {
  const trimmed = password.trim();
  const hasRepeatedChars = /(.)\1{2,}/.test(password); // 3+ repeated characters
  
  return {
    minLength: password.length >= 10,
    hasAlphabet: /[a-zA-Z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    noLeadingTrailingSpaces: password === trimmed,
    notMatchesEmail: email ? !password.toLowerCase().includes(email.toLowerCase().split('@')[0]) : true,
    notCommon: !COMMON_PASSWORDS.some(common => password.toLowerCase().includes(common.toLowerCase())) && !hasRepeatedChars,
  };
}

function isPasswordValid(validation: PasswordValidation): boolean {
  return Object.values(validation).every(v => v === true);
}

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

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <View style={styles.passwordRequirement}>
      <IconSymbol
        name={met ? 'checkmark.circle.fill' : 'xmark'}
        size={16}
        color={met ? '#10B981' : colors.icon}
      />
      <Text style={[styles.passwordRequirementText, { color: met ? '#10B981' : colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

export default function RegisterScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  
  // Step 1: Email & Password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Step 2: Personal Info
  const [firstName, setFirstName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => {
    // Default to 25 years ago when first opening
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
      const yearItemHeight = 60; // Approximate height of each year item (44px min height + 4px gap + padding)
      
      setTimeout(() => {
        yearScrollViewRef.current?.scrollTo({
          y: Math.max(0, (yearIndex - 2) * yearItemHeight),
          animated: true,
        });
      }, 100);
    }
  }, [showYearMonthPicker, calendarViewMonth]);
  
  // Step 3: Physical Info
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
  
  const passwordValidation = validatePassword(password, email);
  const isPasswordValidState = isPasswordValid(passwordValidation);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  
  // Convert selectedDate to YYYY-MM-DD format
  const updateDateOfBirth = (date: Date) => {
    setSelectedDate(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setDateOfBirth(`${year}-${month}-${day}`);
  };
  
  // Handle opening date picker - reset to 25 years ago if no date is selected
  const handleOpenDatePicker = () => {
    if (!dateOfBirth) {
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() - 25);
      setCalendarViewMonth(new Date(defaultDate));
      setSelectedDate(defaultDate);
    } else {
      // If date exists, show that month
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
    return firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
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
    
    // Don't allow future dates
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
    if (!email) {
      return 'Email is required';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    
    if (!password) {
      return 'Password is required';
    }
    
    if (!isPasswordValidState) {
      return 'Password does not meet all requirements';
    }
    
    if (!confirmPassword) {
      return 'Please confirm your password';
    }
    
    if (!passwordsMatch) {
      return 'Passwords do not match';
    }
    
    return null;
  };
  
  const validateStep2 = (): string | null => {
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
  
  const validateStep3 = (): string | null => {
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
    } else if (currentStep === 2) {
      const validationError = validateStep2();
      if (validationError) {
        setError(validationError);
        return;
      }
      setCurrentStep(3);
    }
  };
  
  const handleBack = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleRegister = async () => {
    setError(null);
    
    const validationError = validateStep3();
    if (validationError) {
      setError(validationError);
      Alert.alert('Validation Error', validationError);
      return;
    }
    
    // Check if Supabase is configured
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR-PROJECT') || supabaseKey.includes('YOUR-ANON-KEY')) {
      const errorMsg = 'Supabase is not configured. Please check your .env file.';
      setError(errorMsg);
      Alert.alert('Configuration Error', errorMsg);
      return;
    }
    
    setLoading(true);
    
    try {
      // Trim email to avoid whitespace issues
      const trimmedEmail = email.trim().toLowerCase();
      
      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      
      if (authError) {
        let errorMsg = authError.message;
        
        if (authError.status === 429) {
          errorMsg = 'Too many registration attempts. Please wait a few minutes before trying again.';
          setError(errorMsg);
          Alert.alert('Rate Limit Reached', errorMsg);
          setLoading(false);
          return;
        } else if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          errorMsg = 'This email is already registered. Please try logging in instead.';
        } else if (authError.message.includes('Invalid email')) {
          errorMsg = 'Please enter a valid email address.';
        } else if (authError.message.includes('Password')) {
          errorMsg = 'Password does not meet requirements. Please check and try again.';
        }
        
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!authData.user) {
        const errorMsg = 'Failed to create user account. Please try again.';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Wait for session to be established (with retries)
      let sessionEstablished = false;
      let retries = 0;
      const maxRetries = 10;
      
      while (!sessionEstablished && retries < maxRetries) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user.id === authData.user.id) {
          sessionEstablished = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 200));
          retries++;
        }
      }
      
      if (!sessionEstablished) {
        // Even if session isn't established, we can still try to create the profile
        // The function should handle it, or we'll get a clear error
      }
      
      const heightCmValue = convertHeightToCm();
      const weightLbValue = convertWeightToLb();
      
      if (!heightCmValue || !weightLbValue) {
        throw new Error('Height and Weight are required');
      }
      
      // Insert profile
      const profileData = {
        user_id: authData.user.id,
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
      
      // Try using the database function first (if it exists and supports all fields)
      let profileInsertData = null;
      let profileError = null;
      
      try {
        console.log('Attempting to call create_user_profile function...');
        const { data: functionData, error: functionError } = await supabase.rpc('create_user_profile', {
          p_user_id: authData.user.id,
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
          // Check if function doesn't exist
          if (functionError.message?.includes('function') && functionError.message?.includes('does not exist')) {
            console.log('Function does not exist, will try direct insert');
            profileError = functionError;
          } else if (functionError.code === '42501') {
            // Permission denied - function exists but no permission
            console.error('Permission denied to execute function. Function may not have proper grants.');
            profileError = functionError;
          } else {
            profileError = functionError;
          }
        } else {
          console.log('Function succeeded, fetching profile...');
          // Function succeeded, fetch the profile to verify
          const { data: fetchedProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', authData.user.id)
            .single();
          
          if (fetchError) {
            console.error('Error fetching profile after function call:', fetchError);
            // Even if fetch fails, the function succeeded, so profile was created
            // This might be a timing issue - profile exists but not yet readable
            profileInsertData = { success: true };
            console.log('Profile created via function (fetch failed but creation succeeded)');
          } else {
            profileInsertData = fetchedProfile;
            console.log('Profile created successfully via function');
          }
        }
      } catch (e: any) {
        console.error('Exception calling function:', e);
        // Function call failed (might not exist), will try direct insert
        profileError = e;
      }
      
      // If function failed or doesn't exist, try direct insert
      if (!profileInsertData) {
        console.log('Attempting direct insert...');
        const result = await supabase
          .from('profiles')
          .insert(profileData)
          .select();
        profileInsertData = result.data;
        profileError = result.error;
        
        if (result.error) {
          console.error('Direct insert error:', result.error);
        } else {
          console.log('Profile created successfully via direct insert');
        }
      }
      
      if (profileError) {
        // Provide more helpful error message
        let errorMsg = profileError.message || 'Failed to create profile';
        
        if (profileError.message?.includes('row-level security') || profileError.message?.includes('RLS')) {
          // Try one more time with a longer wait
          console.log('RLS error detected, retrying after longer wait...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try direct insert one more time
          const retryResult = await supabase
            .from('profiles')
            .insert(profileData)
            .select();
          
          if (!retryResult.error) {
            profileInsertData = retryResult.data;
            profileError = null;
          } else {
            errorMsg = 'Unable to create profile. The database function may not be set up correctly. Please contact support with this error code: RLS-001';
            console.error('Profile creation failed after retry:', retryResult.error);
          }
        } else if (profileError.message?.includes('duplicate key') || profileError.message?.includes('already exists')) {
          // Profile might already exist, try to fetch it
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', authData.user.id)
            .single();
          
          if (existingProfile) {
            // Profile exists, just update it
            const { error: updateError } = await supabase
              .from('profiles')
              .update(profileData)
              .eq('user_id', authData.user.id);
            
            if (!updateError) {
              profileInsertData = { ...existingProfile, ...profileData };
              profileError = null;
            } else {
              errorMsg = `Failed to update existing profile: ${updateError.message}`;
            }
          } else {
            errorMsg = `Profile may already exist. Please try logging in.`;
          }
        } else if (profileError.message?.includes('function') || profileError.message?.includes('does not exist')) {
          // Function doesn't exist, but direct insert should work
          errorMsg = 'Database function not found. Please ensure the create_user_profile function is set up in your database.';
        } else {
          errorMsg = `Database error: ${errorMsg}. Please try again.`;
        }
        
        if (profileError) {
          setError(errorMsg);
          throw new Error(errorMsg);
        }
      }
      
      // Navigate to confirmation screen
      router.replace('/register-confirmation');
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create account. Please check your connection and try again.';
      setError(errorMessage);
      Alert.alert('Registration Failed', errorMessage);
      setLoading(false);
    }
  };
  
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        Create Your Account
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Let's start with your email and a secure password
      </ThemedText>
      
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Email</ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: error && !email ? '#EF4444' : colors.border,
              color: colors.text,
              backgroundColor: colors.backgroundSecondary,
              ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
            },
          ]}
          placeholder="Enter your email address"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
          {...getInputAccessibilityProps('Email address', 'Enter your email address', error && !email ? error : undefined, true)}
          {...getWebAccessibilityProps('textbox', 'Email address', error && !email ? 'email-error' : undefined, error && !email ? true : undefined, true)}
        />
      </View>
      
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Password</ThemedText>
        <View style={[styles.passwordInputContainer, { borderColor: error && !password ? '#EF4444' : colors.border, backgroundColor: colors.backgroundSecondary }]}>
          <TextInput
            style={[
              styles.passwordInput,
              {
                color: colors.text,
                ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
              },
            ]}
            placeholder="Create a strong password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            editable={!loading}
            {...getInputAccessibilityProps('Password', 'Create a strong password', error && !password ? error : undefined, true)}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
            {...getButtonAccessibilityProps(showPassword ? 'Hide password' : 'Show password', 'Double tap to toggle password visibility')}
          >
            <IconSymbol
              name={showPassword ? 'xmark' : 'lock.fill'}
              size={20}
              color={colors.icon}
            />
          </TouchableOpacity>
        </View>
        
        {password.length > 0 && (
          <View style={[styles.passwordRequirements, { backgroundColor: colors.backgroundSecondary }]}>
            <PasswordRequirement met={passwordValidation.minLength} label="Minimum 10 characters" />
            <PasswordRequirement met={passwordValidation.hasAlphabet} label="At least one letter" />
            <PasswordRequirement met={passwordValidation.hasUppercase} label="At least one uppercase letter" />
            <PasswordRequirement met={passwordValidation.hasLowercase} label="At least one lowercase letter" />
            <PasswordRequirement met={passwordValidation.hasNumber} label="At least one number" />
            <PasswordRequirement met={passwordValidation.hasSpecial} label="At least one special character" />
            <PasswordRequirement met={passwordValidation.noLeadingTrailingSpaces} label="No leading or trailing spaces" />
            <PasswordRequirement met={passwordValidation.notMatchesEmail} label="Doesn't match your email" />
            <PasswordRequirement met={passwordValidation.notCommon} label="Not a common password" />
          </View>
        )}
      </View>
      
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Confirm Password</ThemedText>
        <View style={[styles.passwordInputContainer, { borderColor: error && !passwordsMatch ? '#EF4444' : passwordsMatch ? '#10B981' : colors.border, backgroundColor: colors.backgroundSecondary }]}>
          <TextInput
            style={[
              styles.passwordInput,
              {
                color: colors.text,
                ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
              },
            ]}
            placeholder="Confirm your password"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setError(null);
            }}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            editable={!loading}
            {...getInputAccessibilityProps('Confirm password', 'Re-enter your password to confirm', error && !passwordsMatch ? error : undefined, true)}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            {...getButtonAccessibilityProps(showConfirmPassword ? 'Hide password' : 'Show password', 'Double tap to toggle password visibility')}
          >
            <IconSymbol
              name={showConfirmPassword ? 'xmark' : 'lock.fill'}
              size={20}
              color={colors.icon}
            />
          </TouchableOpacity>
        </View>
        {confirmPassword.length > 0 && passwordsMatch && (
          <View style={styles.passwordMatchIndicator}>
            <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
            <Text style={[styles.passwordMatchText, { color: '#10B981' }]}>Passwords match</Text>
          </View>
        )}
      </View>
    </View>
  );
  
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
            No problem at all. For caloric calculations, we'll use values based on XX-typical physiology. This is only for estimating energy needs and isn't a statement about gender.
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
            {/* Header with Back Button */}
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
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.push('/login')}
                  disabled={loading}
                  {...getButtonAccessibilityProps('Back to login', 'Double tap to go back to login')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol name="chevron.left" size={24} color={colors.text} />
                </TouchableOpacity>
              )}
              <ThemedText type="title" style={[styles.headerTitle, { color: colors.text }]}>
                Create Account
              </ThemedText>
              <View style={styles.backButton} />
            </View>
            
            <StepIndicator currentStep={currentStep} totalSteps={totalSteps} colors={colors} />
            
            <View style={styles.cardContent}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        
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
              onPress={handleRegister}
              disabled={loading}
              {...getButtonAccessibilityProps(loading ? 'Creating account' : 'Create Account', 'Double tap to create your account', loading)}
            >
              {loading ? (
                <View style={styles.buttonLoading}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.buttonText}>Creating...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
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
                    
                    // Empty cells for days before the first day of the month
                    for (let i = 0; i < firstDay; i++) {
                      days.push(
                        <View key={`empty-${i}`} style={styles.calendarDayCell} />
                      );
                    }
                    
                    // Days of the month
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
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 0,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },
  passwordRequirements: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  passwordRequirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordRequirementText: {
    fontSize: 12,
  },
  passwordMatchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  passwordMatchText: {
    fontSize: 12,
    fontWeight: '500',
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
