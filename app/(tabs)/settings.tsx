import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setLanguage, languageNames, SupportedLanguage } from '../../i18n';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import {
  getButtonAccessibilityProps,
  getLinkAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

type SettingsPreferences = {
  units: 'metric' | 'imperial';
  notifications: boolean;
};

const SETTINGS_STORAGE_KEY = 'app_settings';

export default function SettingsScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
  const { signOut, user } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Use React Query hooks for profile data (shared cache with Home screen)
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const updateProfileMutation = useUpdateProfile();
  
  // Use i18n's current language as the source of truth
  const currentLanguage = (i18nInstance.language as SupportedLanguage) || 'en';
  
  const [settings, setSettings] = useState<SettingsPreferences>({
    units: 'imperial',
    notifications: true,
  });
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSecondConfirm, setShowDeleteSecondConfirm] = useState(false);
  const [showDeleteThirdConfirm, setShowDeleteThirdConfirm] = useState(false);

  // Load settings from storage
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      if (Platform.OS === 'web') {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({
            units: parsed.units || 'imperial',
            notifications: parsed.notifications !== undefined ? parsed.notifications : true,
          });
        }
      } else {
        const stored = await SecureStore.getItemAsync(SETTINGS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({
            units: parsed.units || 'imperial',
            notifications: parsed.notifications !== undefined ? parsed.notifications : true,
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: SettingsPreferences) => {
    try {
      setSettings(newSettings);
      if (Platform.OS === 'web') {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      } else {
        await SecureStore.setItemAsync(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleLanguageChange = async () => {
    const newLanguage: SupportedLanguage = currentLanguage === 'en' ? 'fr' : 'en';
    await setLanguage(newLanguage);
    
    // Save language preference to database using mutation (updates cache automatically)
    if (user?.id && profile) {
      try {
        await updateProfileMutation.mutateAsync({
          language_preference: newLanguage,
        });
      } catch (err) {
        console.error('Error saving language preference:', err);
        Alert.alert(t('alerts.error_title'), t('settings.errors.save_language_failed'));
      }
    }
    // The UI will update automatically via useTranslation hook
  };

  const handleLogout = async () => {
    try {
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(t('settings.logout.confirm_message'));
        if (!confirmed) {
          return;
        }
        await signOut();
        router.replace('/login');
      } else {
        Alert.alert(
          t('settings.logout.confirm_title'),
          t('settings.logout.confirm_message'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.logout.button'),
              style: 'destructive',
              onPress: async () => {
                await signOut();
                router.replace('/login');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = () => {
    setShowDeleteConfirm(false);
    setShowDeleteSecondConfirm(true);
  };

  const finalConfirmDeleteAccount = () => {
    setShowDeleteSecondConfirm(false);
    setShowDeleteThirdConfirm(true);
  };

  const actuallyDeleteAccount = async () => {
    if (!user?.id) {
      Alert.alert(t('alerts.error_title'), t('edit_profile.error_user_not_authenticated'));
      setShowDeleteThirdConfirm(false);
      return;
    }

    setLoading(true);
    setShowDeleteThirdConfirm(false);

    try {
      // Step 1: Delete calorie entries
      const { error: calorieEntriesError } = await supabase
        .from('calorie_entries')
        .delete()
        .eq('user_id', user.id);

      if (calorieEntriesError) {
        console.error('Error deleting calorie entries:', calorieEntriesError);
        Alert.alert(
          'Error',
          'Failed to delete some account data. Please try again or contact support if the problem persists.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // Step 2: Get all bundle IDs for this user (needed to delete bundle_items)
      const { data: userBundles, error: bundlesFetchError } = await supabase
        .from('bundles')
        .select('id')
        .eq('user_id', user.id);

      if (bundlesFetchError) {
        console.error('Error fetching bundles:', bundlesFetchError);
      }

      const bundleIds = userBundles?.map(b => b.id) || [];

      // Step 3: Delete bundle_items for user's bundles
      if (bundleIds.length > 0) {
        const { error: bundleItemsError } = await supabase
          .from('bundle_items')
          .delete()
          .in('bundle_id', bundleIds);

        if (bundleItemsError) {
          console.error('Error deleting bundle_items:', bundleItemsError);
          // Continue even if this fails - CASCADE might handle it
        }
      }

      // Step 4: Delete bundles
      const { error: bundlesError } = await supabase
        .from('bundles')
        .delete()
        .eq('user_id', user.id);

      if (bundlesError) {
        console.error('Error deleting bundles:', bundlesError);
        Alert.alert(
          'Error',
          'Failed to delete some account data. Please try again or contact support if the problem persists.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // Step 5: Get all custom food_master IDs for this user (needed to delete food_servings)
      const { data: customFoods, error: foodsFetchError } = await supabase
        .from('food_master')
        .select('id')
        .eq('owner_user_id', user.id)
        .eq('is_custom', true);

      if (foodsFetchError) {
        console.error('Error fetching custom foods:', foodsFetchError);
      }

      const foodIds = customFoods?.map(f => f.id) || [];

      // Step 6: Delete food_servings for user's custom foods
      if (foodIds.length > 0) {
        const { error: servingsError } = await supabase
          .from('food_servings')
          .delete()
          .in('food_id', foodIds);

        if (servingsError) {
          console.error('Error deleting food_servings:', servingsError);
          Alert.alert(
            'Error',
            'Failed to delete some account data. Please try again or contact support if the problem persists.',
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }
      }

      // Step 7: Delete custom food_master entries
      const { error: foodMasterError } = await supabase
        .from('food_master')
        .delete()
        .eq('owner_user_id', user.id)
        .eq('is_custom', true);

      if (foodMasterError) {
        console.error('Error deleting food_master:', foodMasterError);
        Alert.alert(
          'Error',
          'Failed to delete some account data. Please try again or contact support if the problem persists.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // Step 8: Delete exercise logs
      const { error: exerciseLogsError } = await supabase
        .from('exercise_log')
        .delete()
        .eq('user_id', user.id);

      if (exerciseLogsError) {
        console.error('Error deleting exercise logs:', exerciseLogsError);
        // Continue even if this fails
      }

      // Step 9: Delete the profile
      const { error: profileDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', user.id);

      if (profileDeleteError) {
        console.error('Error deleting profile:', profileDeleteError);
        Alert.alert(
          'Error',
          'Failed to delete profile. Please try again or contact support if the problem persists.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // Step 10: Delete the auth user using Edge Function
      // This calls the Supabase Edge Function which uses the Admin API
      try {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error('Supabase URL not configured');
        }

        // Get the current session token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No session token available');
        }

        // Call the Edge Function to delete the auth user
        const response = await fetch(`${supabaseUrl}/functions/v1/delete-auth-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to delete auth user: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to delete auth user');
        }
      } catch (error: any) {
        // Log error but don't fail the entire process
        // The profile and all data are already deleted
        console.error('Error deleting auth user (profile and data already deleted):', error.message);
        // Continue - the profile and all data are deleted, auth user deletion is optional
      }

      // Successfully deleted all data and profile, now sign out
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Error deleting account data:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred while deleting your account data. Please contact support.',
        [{ text: 'OK' }]
      );
      setLoading(false);
    }
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightComponent,
    showChevron = true 
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
    showChevron?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.settingItem, 
        getMinTouchTargetStyle(),
        { 
          backgroundColor: colors.card, 
          borderColor: colors.border,
          ...(Platform.OS === 'web' && onPress ? getFocusStyle(colors.tint) : {}),
        }
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      {...(onPress ? getButtonAccessibilityProps(
        subtitle ? `${title}, ${subtitle}` : title,
        `Double tap to ${title.toLowerCase()}`
      ) : {})}
    >
      <View 
        style={[styles.settingIconContainer, { backgroundColor: colors.tint + '15' }]}
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <IconSymbol name={icon as any} size={20} color={colors.tint} decorative={true} />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={[styles.settingTitle, { color: colors.text }]}>{title}</ThemedText>
        {subtitle && (
          <ThemedText style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</ThemedText>
        )}
      </View>
      {rightComponent || (showChevron && onPress && (
        <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} decorative={true} />
      ))}
    </TouchableOpacity>
  );

  const SettingSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</ThemedText>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Remove back button header since this is now a tab */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <ThemedText 
          type="title" 
          style={[styles.headerTitle, { color: colors.text }]}
          accessibilityRole="header"
        >
          {t('settings.title')}
        </ThemedText>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scrollContent}>
        {/* Profile Section */}
        <View style={[styles.profileSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.profileIconContainer, { backgroundColor: colors.tint + '20' }]}>
            <IconSymbol name="person.fill" size={32} color={colors.tint} />
          </View>
          <View style={styles.profileInfo}>
            {profileLoading ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <>
                <ThemedText type="title" style={[styles.profileName, { color: colors.text }]}>
                  {profile?.first_name || t('settings.profile_section.user_fallback')}
                </ThemedText>
                <ThemedText style={[styles.profileEmail, { color: colors.textSecondary }]}>
                  {user?.email || ''}
                </ThemedText>
              </>
            )}
          </View>
        </View>

        {/* My Journey */}
        <SettingSection title={t('settings.my_journey.title')}>
          <SettingItem
            icon="flag.checkered"
            title={t('settings.my_journey.goals')}
            subtitle={t('settings.my_journey.goals_subtitle')}
            onPress={() => {
              router.push('/my-goals');
            }}
          />
        </SettingSection>

        {/* Account Management */}
        <SettingSection title={t('settings.account.title')}>
          <SettingItem
            icon="person.fill"
            title={t('settings.account.edit_profile')}
            subtitle={t('settings.account.edit_profile_subtitle')}
            onPress={() => {
              router.push('/edit-profile');
            }}
          />
          <SettingItem
            icon="lock.fill"
            title={t('settings.account.change_password')}
            onPress={() => {
              // TODO: Navigate to change password screen
              Alert.alert(t('settings.coming_soon'), t('settings.feature_coming_soon', { feature: t('settings.account.change_password') }));
            }}
          />
          <SettingItem
            icon="envelope.fill"
            title={t('settings.account.email_settings')}
            onPress={() => {
              // TODO: Navigate to email settings screen
              Alert.alert(t('settings.coming_soon'), t('settings.feature_coming_soon', { feature: t('settings.account.email_settings') }));
            }}
          />
        </SettingSection>

        {/* Preferences */}
        <SettingSection title={t('settings.preferences.title')}>
          <SettingItem
            icon="globe"
            title={t('settings.preferences.language')}
            subtitle={languageNames[currentLanguage]}
            onPress={handleLanguageChange}
            rightComponent={
              <View style={styles.switchContainer}>
                <Text style={[styles.switchLabel, { color: colors.textSecondary }]}>
                  {languageNames[currentLanguage]}
                </Text>
                <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
              </View>
            }
          />
          <SettingItem
            icon="ruler.fill"
            title={t('settings.preferences.units')}
            subtitle={settings.units === 'metric' ? t('settings.preferences.units_metric') : t('settings.preferences.units_imperial')}
            onPress={() => {
              const newUnits = settings.units === 'metric' ? 'imperial' : 'metric';
              saveSettings({ ...settings, units: newUnits });
            }}
            rightComponent={
              <View style={styles.switchContainer}>
                <Text style={[styles.switchLabel, { color: colors.textSecondary }]}>
                  {settings.units === 'metric' ? 'Metric' : 'Imperial'}
                </Text>
                <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
              </View>
            }
          />
          <SettingItem
            icon={colorScheme === 'dark' ? 'moon.fill' : 'sun.max.fill'}
            title={t('settings.preferences.dark_mode')}
            subtitle={themeMode === 'auto' ? t('settings.preferences.dark_mode_system') : themeMode === 'dark' ? t('settings.preferences.dark_mode_on') : t('settings.preferences.dark_mode_off')}
            onPress={() => {
              // Cycle through: auto -> light -> dark -> auto
              const modes: ('auto' | 'light' | 'dark')[] = ['auto', 'light', 'dark'];
              const currentIndex = modes.indexOf(themeMode);
              const nextMode = modes[(currentIndex + 1) % modes.length];
              setThemeMode(nextMode);
            }}
            rightComponent={
              <Text style={[styles.switchLabel, { color: colors.textSecondary }]}>
                {themeMode === 'auto' ? t('settings.preferences.dark_mode_system') : themeMode === 'dark' ? t('settings.preferences.dark_mode_on') : t('settings.preferences.dark_mode_off')}
              </Text>
            }
          />
          <SettingItem
            icon="bell.fill"
            title={t('settings.preferences.notifications')}
            subtitle={t('settings.preferences.notifications_subtitle')}
            onPress={() => {
              saveSettings({ ...settings, notifications: !settings.notifications });
            }}
            rightComponent={
              <Switch
                value={settings.notifications}
                onValueChange={(value) => saveSettings({ ...settings, notifications: value })}
                trackColor={{ false: colors.border, true: colors.tint + '60' }}
                thumbColor={settings.notifications ? colors.tint : colors.textTertiary}
              />
            }
            showChevron={false}
          />
        </SettingSection>

        {/* Privacy & Security */}
        <SettingSection title={t('settings.privacy.title')}>
          <SettingItem
            icon="arrow.down.doc.fill"
            title={t('settings.privacy.export_data')}
            subtitle={t('settings.privacy.export_data_subtitle')}
            onPress={() => {
              // TODO: Implement data export
              Alert.alert(t('settings.coming_soon'), t('settings.feature_coming_soon', { feature: t('settings.privacy.export_data') }));
            }}
          />
          <SettingItem
            icon="hand.raised.fill"
            title={t('settings.privacy.privacy_policy')}
            onPress={() => {
              // TODO: Navigate to privacy policy
              Alert.alert(t('settings.coming_soon'), t('settings.feature_coming_soon', { feature: t('settings.privacy.privacy_policy') }));
            }}
          />
        </SettingSection>

        {/* About */}
        <SettingSection title={t('settings.about.title')}>
          <SettingItem
            icon="info.circle.fill"
            title={t('settings.about.app_version')}
            subtitle="1.0.0"
            onPress={undefined}
            showChevron={false}
          />
          <SettingItem
            icon="doc.text.fill"
            title={t('settings.about.terms_of_service')}
            onPress={() => {
              // TODO: Navigate to terms
              Alert.alert(t('settings.coming_soon'), t('settings.feature_coming_soon', { feature: t('settings.about.terms_of_service') }));
            }}
          />
          <SettingItem
            icon="questionmark.circle.fill"
            title={t('settings.about.help_support')}
            onPress={() => {
              // TODO: Navigate to support
              Alert.alert(t('settings.coming_soon'), t('settings.feature_coming_soon', { feature: t('settings.about.help_support') }));
            }}
          />
        </SettingSection>

        {/* Danger Zone */}
        <SettingSection title={t('settings.danger_zone.title')}>
          <SettingItem
            icon="trash.fill"
            title={t('settings.danger_zone.delete_account')}
            subtitle={loading ? t('settings.danger_zone.deleting_account') : t('settings.danger_zone.delete_account_subtitle')}
            onPress={loading ? undefined : handleDeleteAccount}
            rightComponent={
              loading ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <IconSymbol name="chevron.right" size={18} color="#EF4444" />
              )
            }
          />
        </SettingSection>

        {/* Logout */}
        <TouchableOpacity
          style={[
            styles.logoutButton, 
            getMinTouchTargetStyle(),
            { 
              backgroundColor: colors.tint,
              ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
            }
          ]}
          onPress={handleLogout}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            t('settings.logout.button'),
            t('settings.logout.button')
          )}
        >
          <IconSymbol name="arrow.right.square.fill" size={20} color="#fff" decorative={true} />
          <Text style={styles.logoutButtonText}>{t('settings.logout.button')}</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showDeleteConfirm}
        title={t('settings.delete_confirm.title')}
        message={t('settings.delete_confirm.message')}
        confirmText={t('settings.delete_confirm.confirm_button')}
        cancelText={t('settings.delete_confirm.cancel_button')}
        onConfirm={confirmDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmButtonStyle={{ backgroundColor: '#EF4444', flex: 0.5 }}
        cancelButtonStyle={{ backgroundColor: '#22C55E' }}
        confirmDisabled={loading}
        animationType="fade"
      />

      <ConfirmModal
        visible={showDeleteSecondConfirm}
        title={t('settings.delete_second_confirm.title')}
        message={t('settings.delete_second_confirm.message')}
        confirmText={t('settings.delete_second_confirm.confirm_button')}
        cancelText={t('settings.delete_second_confirm.cancel_button')}
        onConfirm={finalConfirmDeleteAccount}
        onCancel={() => setShowDeleteSecondConfirm(false)}
        confirmButtonStyle={{ backgroundColor: '#EF4444', flex: 0.5 }}
        cancelButtonStyle={{ backgroundColor: '#22C55E' }}
        confirmDisabled={loading}
        animationType="fade"
      />

      <ConfirmModal
        visible={showDeleteThirdConfirm}
        title=""
        message={t('settings.delete_third_confirm.message')}
        confirmText={t('settings.delete_third_confirm.confirm_button')}
        cancelText={t('settings.delete_third_confirm.cancel_button')}
        onConfirm={actuallyDeleteAccount}
        onCancel={() => setShowDeleteThirdConfirm(false)}
        confirmButtonStyle={{ backgroundColor: '#6B7280', flex: 0.5 }}
        cancelButtonStyle={{ backgroundColor: '#22C55E', flex: 1 }}
        confirmDisabled={loading}
        animationType="fade"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.select({ web: 20, default: 50 }),
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    alignItems: 'center',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 600,
    ...Platform.select({
      web: {
        padding: 16,
        paddingTop: 30,
        paddingBottom: 16,
      },
      default: {
        padding: 16,
        paddingBottom: 32,
      },
    }),
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  profileIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    opacity: 0.7,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionContent: {
    gap: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 20,
  },
});

