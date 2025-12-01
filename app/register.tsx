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
  Dimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ensureProfileExists } from '@/lib/services/profileService';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
  getWebAccessibilityProps,
} from '@/utils/accessibility';

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
  // Email & Password only (pure auth)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
  
  const handleRegister = async () => {
    setError(null);
    
    // Validate Step 1 (email/password) only
    const validationError = validateStep1();
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
      
      // Ensure profile exists with onboarding_complete = false
      // This creates a minimal profile that will be completed during onboarding
      await ensureProfileExists(authData.user.id);
      
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
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.push('/login')}
                disabled={loading}
                {...getButtonAccessibilityProps('Back to login', 'Double tap to go back to login')}
                {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
              >
                <IconSymbol name="chevron.left" size={24} color={colors.text} />
              </TouchableOpacity>
              <ThemedText type="title" style={[styles.headerTitle, { color: colors.text }]}>
                Create Account
              </ThemedText>
              <View style={styles.backButton} />
            </View>
            
            <View style={styles.cardContent}>
              {renderStep1()}
              
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
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
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
