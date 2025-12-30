import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Platform, ActivityIndicator } from 'react-native';
import { router, useRouter, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { setLanguage, languageNames, SupportedLanguage } from '../i18n';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserConfig } from '@/hooks/use-user-config';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { useLegalDocuments } from '@/hooks/use-legal-documents';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import {
  getButtonAccessibilityProps,
  getLinkAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';
import { ProfileAvatarPicker } from '@/components/profile/ProfileAvatarPicker';
import { openWeightEntryForToday } from '@/lib/navigation/weight';
import { openMyGoalEdit } from '@/lib/navigation/my-goal';

type SettingsPreferences = {
  notifications: boolean;
};

const SETTINGS_STORAGE_KEY = 'app_settings';

export default function SettingsScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
  const { signOut, user } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Safe back handler to prevent "GO_BACK" error on web refresh/direct entry
  const handleBack = () => {
    // @ts-ignore - canGoBack exists on navigation but types can vary
    const canGoBack = typeof (navigation as any)?.canGoBack === 'function'
      ? (navigation as any).canGoBack()
      : false;

    if (canGoBack) {
      router.back();
      return;
    }

    // Fallback when no history (web refresh / direct URL)
    router.replace('/(tabs)');
  };
  
  // Use React Query hooks for user config data (shared cache with Home screen)
  const { data: userConfig, isLoading: userConfigLoading } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility in this file
  const updateProfileMutation = useUpdateProfile();
  
  // Fetch legal documents for version display
  const { data: legalDocuments = [] } = useLegalDocuments();
  
  // Get version for each document type
  const getDocVersion = (docType: 'terms' | 'privacy' | 'health_disclaimer'): string | null => {
    const doc = legalDocuments.find((d) => d.doc_type === docType);
    return doc?.version ?? null;
  };

  const firstName = (profile?.first_name ?? '').trim() || 'there';
  const email = profile?.email || user?.email || '';
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  useEffect(() => {
    setAvatarUrl(profile?.avatar_url ?? null);
  }, [profile?.avatar_url]);
  
  // Use i18n's current language as the source of truth
  const currentLanguage = (i18nInstance.language as SupportedLanguage) || 'en';
  
  const [settings, setSettings] = useState<SettingsPreferences>({
    notifications: true,
  });
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSecondConfirm, setShowDeleteSecondConfirm] = useState(false);
  const [showDeleteThirdConfirm, setShowDeleteThirdConfirm] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Always reset scroll position when returning to Settings
  useFocusEffect(
    useCallback(() => {
      const rafId = requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
      return () => cancelAnimationFrame(rafId);
    }, [])
  );

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
            notifications: parsed.notifications !== undefined ? parsed.notifications : true,
          });
        }
      } else {
        const stored = await SecureStore.getItemAsync(SETTINGS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({
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

      // Step 8: Delete the profile
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

      // Step 9: Delete the auth user using Edge Function
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
    icon: string | React.ReactNode;
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
        {typeof icon === 'string' ? (
          <IconSymbol name={icon as any} size={20} color={colors.tint} decorative={true} />
        ) : (
          icon
        )}
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
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            getMinTouchTargetStyle(),
            { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
          ]}
          onPress={handleBack}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            'Back',
            'Double tap to go back'
          )}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText 
          type="title" 
          style={[styles.headerTitle, { color: colors.text }]}
          accessibilityRole="header"
        >
          {t('settings.title')}
        </ThemedText>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scrollContent}>
          {/* New profile header (replaces logo + old profile card) */}
          <View style={styles.profileHeader}>
            {userConfigLoading && !userConfig ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <>
                <ThemedText type="title" style={[styles.helloTitle, { color: colors.text }]}>
                  {`Hello ${firstName}!`}
                </ThemedText>
                <ProfileAvatarPicker
                  avatarUrl={avatarUrl}
                  onAvatarUpdated={setAvatarUrl}
                  size={130}
                  editable={!loading && !userConfigLoading}
                  persistToProfile={true}
                  successToastMessage="Profile photo updated."
                />
                {!!email && (
                  <ThemedText style={[styles.emailText, { color: colors.textSecondary }]}>
                    {email}
                  </ThemedText>
                )}
              </>
            )}
          </View>

        {/* My Journey */}
        <SettingSection title={t('settings.my_journey.title')}>
          <SettingItem
            icon="flag.checkered"
            title={t('settings.my_journey.goals')}
            subtitle={t('settings.my_journey.goals_subtitle')}
            onPress={() => {
              router.push('/settings/my-goal');
            }}
          />
          <SettingItem
            icon={<Ionicons name="walk-outline" size={20} color={colors.tint} />}
            title="Adjust Activity Level"
            subtitle="Update your daily activity setting"
            onPress={() => {
              openMyGoalEdit(router, 'activity');
            }}
          />
          <SettingItem
            icon={<MaterialCommunityIcons name="scale-bathroom" size={20} color={colors.tint} />}
            title="My Weight"
            subtitle="Log or review your weight entries"
            onPress={() => {
              openWeightEntryForToday(router);
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

        {/* Legal */}
        <SettingSection title="LEGAL">
          <SettingItem
            icon="doc.text.fill"
            title={t('onboarding.legal.terms_title')}
            subtitle={getDocVersion('terms') ? `Version: ${getDocVersion('terms')}` : undefined}
            onPress={() => {
              router.push('/legal/terms');
            }}
          />
          <SettingItem
            icon="hand.raised.fill"
            title={t('onboarding.legal.privacy_title')}
            subtitle={getDocVersion('privacy') ? `Version: ${getDocVersion('privacy')}` : undefined}
            onPress={() => {
              router.push('/legal/privacy');
            }}
          />
          <SettingItem
            icon={<MaterialCommunityIcons name="heart-pulse" size={20} color={colors.tint} />}
            title={t('onboarding.legal.health_disclaimer_title')}
            subtitle={getDocVersion('health_disclaimer') ? `Version: ${getDocVersion('health_disclaimer')}` : undefined}
            onPress={() => {
              router.push('/legal/health');
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.select({ web: 20, default: 50 }),
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
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
  profileHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 18,
    paddingBottom: 10,
    marginBottom: 18,
  },
  helloTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: -8,
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

