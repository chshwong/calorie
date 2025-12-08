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
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getLinkAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
  getWebAccessibilityProps,
} from '@/utils/accessibility';

const REMEMBERED_EMAIL_KEY = 'remembered_email';

// Storage utility functions
const saveEmail = async (email: string) => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      await SecureStore.setItemAsync(REMEMBERED_EMAIL_KEY, email);
    }
  } catch (error) {
    // Error saving email
  }
};

const loadEmail = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(REMEMBERED_EMAIL_KEY);
    } else {
      return await SecureStore.getItemAsync(REMEMBERED_EMAIL_KEY);
    }
  } catch (error) {
    return null;
  }
};

const clearEmail = async () => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } else {
      await SecureStore.deleteItemAsync(REMEMBERED_EMAIL_KEY);
    }
  } catch (error) {
    // Error clearing email
  }
};

export default function LoginScreen() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/(tabs)');
    }
  }, [authLoading, user, router]);

  // Load remembered email on mount
  // NOTE: We do NOT clear recovery mode here - it should only be cleared after password reset
  // This prevents users from bypassing password reset by just visiting login page
  useEffect(() => {
    loadEmail().then((savedEmail) => {
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    });
  }, []);

  // Show brief spinner only while auth is initializing
  if (authLoading) {
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  // If user is logged in, return null (redirect is handled in useEffect)
  if (user) {
    return null;
  }

  const handleLogin = async () => {
    // Prevent multiple submissions
    if (loading) {
      return;
    }

    setError(null);
    
    // Check if Supabase is configured
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR-PROJECT') || supabaseKey.includes('YOUR-ANON-KEY')) {
      const errorMsg = t('auth.login.error_supabase_not_configured');
      setError(errorMsg);
      Alert.alert(t('alerts.configuration_error'), errorMsg);
      return;
    }

    // Validate inputs
    if (!email || !password) {
      const errorMsg = t('auth.login.error_fill_all_fields');
      setError(errorMsg);
      Alert.alert(t('alerts.validation_error'), errorMsg);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const errorMsg = t('auth.login.error_invalid_email');
      setError(errorMsg);
      Alert.alert(t('alerts.validation_error'), errorMsg);
      return;
    }

    setLoading(true);
    
    try {
      // Trim email and password to avoid whitespace issues
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password;
      
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (loginError) {
        let errorMsg = t('alerts.login_failed');
        
        // Provide user-friendly error messages
        if (loginError.message.includes('Invalid login credentials') || 
            loginError.message.includes('Invalid credentials') ||
            loginError.status === 400) {
          errorMsg = t('auth.login.error_invalid_credentials');
          
          // Additional helpful message
          if (loginError.message.includes('Email not confirmed')) {
            errorMsg = t('auth.login.error_email_not_confirmed');
          }
        } else if (loginError.message.includes('Email not confirmed') || loginError.message.includes('email_not_confirmed')) {
          errorMsg = t('auth.login.error_email_not_confirmed');
        } else if (loginError.message.includes('Too many requests') || loginError.status === 429) {
          errorMsg = t('auth.login.error_too_many_requests');
        } else if (loginError.message.includes('User not found')) {
          errorMsg = t('auth.login.error_user_not_found');
        } else {
          errorMsg = loginError.message || t('alerts.login_failed');
        }
        
        setError(errorMsg);
        Alert.alert(t('alerts.login_failed'), errorMsg);
        throw new Error(errorMsg);
      }

      // Check if user account is active IMMEDIATELY after sign in, before any navigation
      if (data?.user?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('user_id', data.user.id)
          .single();

        if (profileError) {
          // If profile doesn't exist, allow login (user might be registering)
        } else if (profileData && (profileData.is_active === false || profileData.is_active === null)) {
          // User account is inactive - sign out immediately and prevent navigation
          // Sign out synchronously to prevent any navigation
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) {
            console.error('Error signing out inactive user:', signOutError);
          }
          
          // Clear any session data immediately
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
              if (key.includes('supabase') || key.includes('sb-')) {
                localStorage.removeItem(key);
              }
            });
          }
          
          const errorMsg = t('auth.login.error_account_removed');
          setError(errorMsg);
          setLoading(false);
          
          // Don't navigate - stay on login page
          // The index.tsx will handle redirecting to /login when it sees no session
          return;
        }
      }

      // Save or clear email based on remember checkbox
      if (rememberEmail) {
        await saveEmail(email);
      } else {
        await clearEmail();
      }
      
      // Clear password recovery mode ONLY after successful login with credentials
      // This ensures recovery sessions can't be used to access the app
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        sessionStorage.removeItem('password_recovery_mode');
      }
      
      router.replace('/(tabs)');
    } catch (error: any) {
      // Error already set above, just make sure loading is reset
      if (!error.message || !error.message.includes('Invalid') && !error.message.includes('Failed')) {
        const errorMsg = error.message || t('common.unexpected_error');
        setError(errorMsg);
        Alert.alert(t('alerts.login_failed'), errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Redirect back to where the app is now (web only)
        redirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
      },
    });
    if (error) {
      console.error(error);
      setGoogleError(t('auth.login.error_google_sign_in_failed'));
      setGoogleLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.cardContainer, { maxWidth: isDesktop ? 440 : '100%' }]}>
          <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.header}>
              <ThemedText 
                type="title" 
                style={[styles.title, { color: colors.text }]}
                accessibilityRole="header"
              >
                {t('auth.login.title')}
              </ThemedText>
              <ThemedText 
                style={[styles.subtitle, { color: colors.textSecondary }]}
                accessibilityRole="text"
              >
                {t('auth.login.subtitle')}
              </ThemedText>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <ThemedText 
                  style={[styles.label, { color: colors.text }]}
                  accessibilityRole="text"
                >
                  {t('auth.login.email_label')}
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      borderColor: error && !email ? '#EF4444' : colors.border,
                      color: colors.text,
                      backgroundColor: colors.backgroundSecondary,
                      ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                    }
                  ]}
                  placeholder={t('auth.login.email_placeholder')}
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
                  {...getInputAccessibilityProps(
                    t('accessibility.email_address'),
                    t('auth.login.email_placeholder'),
                    error && !email ? error : undefined,
                    true
                  )}
                  {...getWebAccessibilityProps(
                    'textbox',
                    t('accessibility.email_address'),
                    error && !email ? 'email-error' : undefined,
                    error && !email ? true : undefined,
                    true
                  )}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText 
                  style={[styles.label, { color: colors.text }]}
                  accessibilityRole="text"
                >
                  {t('auth.login.password_label')}
                </ThemedText>
                <View style={[styles.passwordContainer, { borderColor: error && !password ? '#EF4444' : colors.border, backgroundColor: colors.backgroundSecondary }]}>
                  <TextInput
                    style={[
                      styles.passwordInput,
                      { 
                        color: colors.text,
                        ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                      }
                    ]}
                    placeholder={t('auth.login.password_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  onSubmitEditing={handleLogin}
                  returnKeyType="go"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!loading}
                    {...getInputAccessibilityProps(
                      t('accessibility.password'),
                      t('auth.login.password_placeholder'),
                      error && !password ? error : undefined,
                      true
                    )}
                    {...getWebAccessibilityProps(
                      'textbox',
                      t('accessibility.password'),
                      error && !password ? 'password-error' : undefined,
                      error && !password ? true : undefined,
                      true
                    )}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    {...getButtonAccessibilityProps(
                      showPassword ? t('accessibility.hide_password') : t('accessibility.show_password'),
                      t('accessibility.toggle_password_visibility')
                    )}
                  >
                    <IconSymbol
                      name={showPassword ? 'xmark' : 'lock.fill'}
                      size={20}
                      color={colors.icon}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember Email & Forgot Password Row */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={[styles.checkboxContainer, getMinTouchTargetStyle()]}
                  onPress={() => setRememberEmail(!rememberEmail)}
                  disabled={loading}
                  {...getButtonAccessibilityProps(
                    rememberEmail ? `${t('auth.login.remember_email')} ${t('accessibility.checkbox_checked')}` : `${t('auth.login.remember_email')} ${t('accessibility.checkbox_unchecked')}`,
                    t('auth.login.remember_email'),
                    loading
                  )}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberEmail }}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: rememberEmail ? colors.tint : colors.border,
                        backgroundColor: rememberEmail ? colors.tint : 'transparent',
                      },
                    ]}
                    accessibilityElementsHidden={true}
                    importantForAccessibility="no-hide-descendants"
                  >
                    {rememberEmail && (
                      <IconSymbol name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <ThemedText style={[styles.checkboxLabel, { color: colors.text }]}>
                    {t('auth.login.remember_email')}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.forgotPasswordLink, getMinTouchTargetStyle()]}
                  onPress={() => router.push('/forgot-password')}
                  disabled={loading}
                  {...getLinkAccessibilityProps(
                    t('auth.login.forgot_password'),
                    t('auth.login.forgot_password')
                  )}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <ThemedText style={[styles.linkText, { color: colors.tint }]}>
                    {t('auth.login.forgot_password')}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {error && (
                <View 
                  style={[styles.errorContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444' }]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  {...(Platform.OS === 'web' ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
                >
                  <IconSymbol name="info.circle.fill" size={18} color="#EF4444" />
                  <ThemedText style={[styles.errorText, { color: '#EF4444' }]}>
                    {error}
                  </ThemedText>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  getMinTouchTargetStyle(),
                  { 
                    backgroundColor: loading ? colors.textSecondary : colors.tint,
                    opacity: loading ? 0.6 : 1,
                    ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                  }
                ]}
                onPress={handleLogin}
                disabled={loading}
                {...getButtonAccessibilityProps(
                  loading ? t('auth.login.logging_in') : t('auth.login.sign_in_button'),
                  t('auth.login.sign_in_button'),
                  loading
                )}
              >
                {loading ? (
                  <View style={styles.buttonLoading} accessibilityElementsHidden={true}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.buttonText}>{t('auth.login.logging_in')}</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>{t('auth.login.sign_in_button')}</Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <ThemedText style={[styles.dividerText, { color: colors.textSecondary }]}>
                  {t('common.or')}
                </ThemedText>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              {/* Google Sign-In Error */}
              {googleError && (
                <View 
                  style={[styles.errorContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444' }]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  {...(Platform.OS === 'web' ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
                >
                  <IconSymbol name="info.circle.fill" size={18} color="#EF4444" />
                  <ThemedText style={[styles.errorText, { color: '#EF4444' }]}>
                    {googleError}
                  </ThemedText>
                </View>
              )}

              {/* Google Sign-In Button */}
              <TouchableOpacity
                style={[
                  styles.googleButton,
                  getMinTouchTargetStyle(),
                  { 
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                    opacity: googleLoading ? 0.6 : 1,
                    ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                  }
                ]}
                onPress={handleGoogleLogin}
                disabled={googleLoading || loading}
                {...getButtonAccessibilityProps(
                  googleLoading ? t('auth.login.signing_in_google') : t('auth.login.google_sign_in'),
                  t('auth.login.google_sign_in'),
                  googleLoading || loading
                )}
              >
                {googleLoading ? (
                  <View style={styles.buttonLoading} accessibilityElementsHidden={true}>
                    <ActivityIndicator color={colors.text} size="small" />
                    <Text style={[styles.googleButtonText, { color: colors.text }]}>{t('auth.login.signing_in_google')}</Text>
                  </View>
                ) : (
                  <View style={styles.googleButtonContent}>
                    <View style={styles.googleIconContainer}>
                      <Text style={styles.googleIcon}>G</Text>
                    </View>
                    <Text style={[styles.googleButtonText, { color: colors.text }]}>{t('auth.login.google_sign_in')}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <ThemedText style={[styles.footerText, { color: colors.textSecondary }]}>
                {t('auth.login.no_account')}{' '}
              </ThemedText>
              <TouchableOpacity
                onPress={() => router.push('/register')}
                disabled={loading}
                {...getLinkAccessibilityProps(
                  t('auth.login.sign_up'),
                  t('auth.login.sign_up')
                )}
                {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
              >
                <ThemedText style={[styles.footerLink, { color: colors.tint }]}>
                  {t('auth.login.sign_up')}
                </ThemedText>
              </TouchableOpacity>
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
    justifyContent: 'center',
    padding: 20,
    minHeight: '100%',
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
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 52,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  forgotPasswordLink: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  googleButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderWidth: 1.5,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  googleIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
  },
});
