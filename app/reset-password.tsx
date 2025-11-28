import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getLinkAccessibilityProps,
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

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  // Get password validation
  const passwordValidation = validatePassword(password, userEmail);
  const isPasswordValidValue = isPasswordValid(passwordValidation);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    // Check if user is authenticated (should be after clicking reset link)
    // Also handle URL parameters if coming from Supabase redirect
    const checkAuth = async () => {
      try {
        // Check if we have URL parameters indicating password recovery
        const hasRecoveryParams = params.token || params.type === 'recovery';
        
        // If there are URL parameters (token, type), Supabase will handle them automatically
        // We just need to check if we have a session
        let { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!session) {
          // Wait a bit for Supabase to process the token if it's in the URL
          if (hasRecoveryParams) {
            // Give Supabase time to process the token (reduced from 1500ms to 1000ms)
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryResult = await supabase.auth.getSession();
            session = retryResult.data.session;
            if (!session) {
              setCheckingAuth(false);
              Alert.alert(
                'Invalid Link',
                'This password reset link is invalid or has expired. Please request a new one.',
                [{ text: 'OK', onPress: () => router.replace('/forgot-password') }]
              );
              return;
            }
          } else {
            setCheckingAuth(false);
            Alert.alert(
              'Authentication Required',
              'You must click the password reset link from your email to access this page.',
              [{ text: 'OK', onPress: () => router.replace('/forgot-password') }]
            );
            return;
          }
        }
        
        // User is authenticated - they can stay on this page to reset password
        // If they came from a recovery link, we need to ensure they stay here
        if (hasRecoveryParams || session) {
          // Set a flag in session storage to prevent redirects
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            sessionStorage.setItem('password_recovery_mode', 'true');
          }
          // Get user email for password validation
          if (session?.user?.email) {
            setUserEmail(session.user.email);
          }
        }
        
        setCheckingAuth(false);
      } catch (err) {
        console.error('Auth check error:', err);
        setCheckingAuth(false);
        Alert.alert(
          'Error',
          'An error occurred while verifying your session. Please try again.',
          [{ text: 'OK', onPress: () => router.replace('/forgot-password') }]
        );
      }
    };

    checkAuth();
  }, [router, params]);

  const handleResetPassword = async () => {
    setError(null);

    if (!password || !confirmPassword) {
      const errorMsg = 'Please fill in all fields';
      setError(errorMsg);
      Alert.alert('Validation Error', errorMsg);
      return;
    }

    if (password !== confirmPassword) {
      const errorMsg = 'Passwords do not match';
      setError(errorMsg);
      Alert.alert('Validation Error', errorMsg);
      return;
    }

    // Validate password using the same rules as registration
    if (!isPasswordValidValue) {
      const errorMsg = 'Password does not meet all requirements. Please check the requirements below.';
      setError(errorMsg);
      Alert.alert('Validation Error', errorMsg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a timeout that can be cleared
      let timeoutId: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          console.error('Password update timeout after 15 seconds');
          reject(new Error('Password update timed out. Please check your connection and try again.'));
        }, 15000); // 15 second timeout
      });

      const updatePromise = supabase.auth.updateUser({
        password: password,
      });

      let result;
      try {
        // Wrap updatePromise to clear timeout on success
        const updateWithCleanup = updatePromise.then((res) => {
          // Clear timeout immediately when update succeeds
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          return res;
        });
        
        result = await Promise.race([updateWithCleanup, timeoutPromise]);
      } catch (timeoutError: any) {
        // Clear timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        // Timeout occurred
        console.error('Password update timeout:', timeoutError);
        const errorMsg = timeoutError.message || 'Password update timed out. Please check your connection and try again.';
        setError(errorMsg);
        setLoading(false);
        Alert.alert('Timeout Error', errorMsg);
        return;
      }
      
      // Ensure timeout is cleared (should already be cleared, but just in case)
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const { error: updateError, data } = result;

      if (updateError) {
        let errorMsg = 'Failed to update password';
        
        console.error('Password update error:', updateError);
        
        if (updateError.message.includes('same as')) {
          errorMsg = 'New password must be different from your current password.';
        } else if (updateError.message.includes('weak')) {
          errorMsg = 'Password is too weak. Please choose a stronger password.';
        } else if (updateError.message.includes('timeout') || updateError.message.includes('network')) {
          errorMsg = 'Connection timeout. Please check your internet connection and try again.';
        } else {
          errorMsg = updateError.message || 'Failed to update password. Please try again.';
        }
        
        setError(errorMsg);
        setLoading(false);
        Alert.alert('Error', errorMsg);
        return; // Exit early on error
      } else {
        // Password updated successfully - clear password recovery flag and redirect to login
        
        // Clear the recovery mode flag from sessionStorage FIRST
        // This must happen before navigation to prevent redirect loops
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          sessionStorage.removeItem('password_recovery_mode');
          // Force a small delay to ensure sessionStorage is cleared
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Sign out the user (they need to log in with their new password)
        await supabase.auth.signOut();
        
        // Clear loading state
        setLoading(false);
        
        // Redirect to login screen so user can log in with their new password
        router.replace('/login');
      }
    } catch (error: any) {
      console.error('Password update exception:', error);
      const errorMsg = error.message || 'An unexpected error occurred. Please try again.';
      setError(errorMsg);
      setLoading(false);
      Alert.alert('Error', errorMsg);
    }
  };

  if (checkingAuth) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            Verifying reset link...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        {...getWebAccessibilityProps()}
      >
        <View style={[styles.cardContainer, isDesktop && styles.cardContainerDesktop]}>
          <View style={styles.header}>
            <IconSymbol name="lock.rotation" size={48} color={colors.tint} />
            <ThemedText type="title" style={styles.title}>
              Reset Password
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              Please enter your new password below.
            </ThemedText>
          </View>

          {error && (
            <View style={[styles.errorContainer, { backgroundColor: colors.errorBackground }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.error} />
              <ThemedText style={[styles.errorText, { color: colors.error }]}>
                {error}
              </ThemedText>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                New Password
              </ThemedText>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: error && !isPasswordValidValue ? colors.error : isPasswordValidValue && password.length > 0 ? '#10B981' : colors.border,
                    },
                    Platform.OS === 'web' && getFocusStyle(colors),
                  ]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  onSubmitEditing={() => {
                    // Focus on confirm password field when Enter is pressed
                    // We'll handle submission on confirm password field
                  }}
                  returnKeyType="next"
                  placeholder="Enter new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  {...getInputAccessibilityProps('New password input field')}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  {...getButtonAccessibilityProps('Toggle password visibility')}
                >
                  <IconSymbol
                    name={showPassword ? 'eye.slash' : 'eye'}
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
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Confirm Password
              </ThemedText>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: error && !passwordsMatch ? colors.error : passwordsMatch ? '#10B981' : colors.border,
                    },
                    Platform.OS === 'web' && getFocusStyle(colors),
                  ]}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setError(null);
                  }}
                  onSubmitEditing={handleResetPassword}
                  returnKeyType="go"
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  {...getInputAccessibilityProps('Confirm new password input field')}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                  {...getButtonAccessibilityProps('Toggle confirm password visibility')}
                >
                  <IconSymbol
                    name={showConfirmPassword ? 'eye.slash' : 'eye'}
                    size={20}
                    color={colors.icon}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: colors.tint,
                  opacity: loading || !isPasswordValidValue || !passwordsMatch ? 0.6 : 1,
                },
                getMinTouchTargetStyle(),
                Platform.OS === 'web' && getFocusStyle(colors),
              ]}
              onPress={handleResetPassword}
              disabled={loading || !isPasswordValidValue || !passwordsMatch}
              {...getButtonAccessibilityProps('Update password')}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Update Password</ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/login')}
              disabled={loading}
              {...getLinkAccessibilityProps('Back to login')}
            >
              <ThemedText style={[styles.backButtonText, { color: colors.tint }]}>
                Back to Login
              </ThemedText>
            </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: '100%',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'transparent',
  },
  cardContainerDesktop: {
    padding: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordInputWrapper: {
    position: 'relative',
  },
  input: {
    width: '100%',
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 8,
    zIndex: 10,
    ...getMinTouchTargetStyle(),
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    padding: 12,
    ...getMinTouchTargetStyle(),
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 8,
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
});

