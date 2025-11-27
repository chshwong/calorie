import { useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
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

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  const handleResetPassword = async () => {
    setError(null);
    setSuccess(false);

    if (!email) {
      const errorMsg = t('auth.forgot_password.error_email_required');
      setError(errorMsg);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const errorMsg = t('auth.forgot_password.error_invalid_email');
      setError(errorMsg);
      return;
    }

    setLoading(true);

    try {
      // Get the base URL for redirect
      let redirectUrl: string;
      if (Platform.OS === 'web') {
        // For web, use the current origin (works in both dev and production)
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        redirectUrl = `${origin}/reset-password`;
      } else {
        // For native, use the app scheme for deep linking
        // This will work in both development and production
        const scheme = Constants.expoConfig?.scheme || 'calorietracker';
        // Use Linking to build the proper deep link URL
        redirectUrl = `${scheme}://reset-password`;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      
      // CRITICAL: Verify no session was created/restored after sending reset email
      // Wait a moment for any async operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      const { data: { session: afterResetSession } } = await supabase.auth.getSession();
      if (afterResetSession) {
        // Session appeared - this shouldn't happen, clear it immediately
        console.warn('SECURITY: Session detected after resetPasswordForEmail, clearing it');
        await supabase.auth.signOut();
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.includes('supabase') || key.includes('sb-')) {
              localStorage.removeItem(key);
            }
          });
        }
      }

      if (resetError) {
        let errorMsg = t('alerts.error_title');
        
        if (resetError.message.includes('rate limit')) {
          errorMsg = t('auth.forgot_password.error_rate_limit');
        } else if (resetError.message.includes('not found')) {
          // Don't reveal if email exists for security
          errorMsg = t('auth.forgot_password.success_alert_message');
        } else {
          errorMsg = resetError.message || t('alerts.error_title');
        }
        
        setError(errorMsg);
        Alert.alert(t('alerts.error_title'), errorMsg);
      } else {
        setSuccess(true);
        Alert.alert(
          t('auth.forgot_password.success_alert_title'),
          t('auth.forgot_password.success_alert_message'),
          [{ text: t('common.ok'), onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      const errorMsg = error.message || t('alerts.error_title');
      setError(errorMsg);
      Alert.alert(t('alerts.error_title'), errorMsg);
    } finally {
      setLoading(false);
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
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              disabled={loading}
              {...getButtonAccessibilityProps(t('auth.forgot_password.accessibility_back'), t('auth.forgot_password.accessibility_back'))}
              {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
            >
              <IconSymbol name="chevron.left" size={24} color={colors.text} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: colors.tint + '15' }]}>
                <IconSymbol name="lock.fill" size={32} color={colors.tint} />
              </View>
              <ThemedText 
                type="title" 
                style={[styles.title, { color: colors.text }]}
                accessibilityRole="header"
              >
                {t('auth.forgot_password.title')}
              </ThemedText>
              <ThemedText 
                style={[styles.description, { color: colors.textSecondary }]}
                accessibilityRole="text"
              >
                {t('auth.forgot_password.description')}
              </ThemedText>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: colors.text }]}>
                  {t('auth.forgot_password.email_label')}
                </ThemedText>
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
                  placeholder={t('auth.forgot_password.email_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                    setSuccess(false);
                  }}
                  onSubmitEditing={handleResetPassword}
                  returnKeyType="go"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!loading}
                  {...getInputAccessibilityProps(
                    t('accessibility.email_address'),
                    t('auth.forgot_password.email_placeholder'),
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

              {error && (
                <View 
                  style={[styles.errorContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444' }]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  {...(Platform.OS === 'web' ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
                >
                  <IconSymbol name="info.circle.fill" size={18} color="#EF4444" />
                  <ThemedText style={[styles.errorText, { color: '#EF4444' }]}>{error}</ThemedText>
                </View>
              )}

              {success && (
                <View 
                  style={[styles.successContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10B981' }]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  {...(Platform.OS === 'web' ? { role: 'status', 'aria-live': 'polite' as const } : {})}
                >
                  <IconSymbol name="checkmark.circle.fill" size={18} color="#10B981" />
                  <ThemedText style={[styles.successText, { color: '#10B981' }]}>
                    {t('auth.forgot_password.success_message')}
                  </ThemedText>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  getMinTouchTargetStyle(),
                  {
                    backgroundColor: loading ? colors.icon : colors.tint,
                    opacity: loading ? 0.6 : 1,
                    ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                  },
                ]}
                onPress={handleResetPassword}
                disabled={loading}
                {...getButtonAccessibilityProps(
                  loading ? t('auth.forgot_password.sending') : t('auth.forgot_password.send_button'),
                  t('auth.forgot_password.send_button'),
                  loading
                )}
              >
                {loading ? (
                  <View style={styles.buttonLoading} accessibilityElementsHidden={true}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.buttonText}>{t('auth.forgot_password.sending')}</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>{t('auth.forgot_password.send_button')}</Text>
                )}
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
    position: 'relative',
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
  backButton: {
    position: 'absolute',
    top: 24,
    left: 24,
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  header: {
    marginTop: 8,
    marginBottom: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
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
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  successText: {
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
});
