import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Platform, ActivityIndicator } from 'react-native';
import { router as appRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import {
  getButtonAccessibilityProps,
  getLinkAccessibilityProps,
  AccessibilityHints,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';
import { ProfileAvatarPicker } from '@/components/profile/ProfileAvatarPicker';
import { openWeightEntryForToday } from '@/lib/navigation/weight';
import { openMyGoalEdit } from '@/lib/navigation/my-goal';
import { deleteUserAccountData } from '@/lib/services/accountDeletion';
import { showAppToast } from '@/components/ui/app-toast';
import { resetTour } from '@/features/tour/storage';
import {
  loadSettingsPreferences,
  saveSettingsPreferences,
  type SettingsPreferences,
} from '@/lib/services/settingsPreferences';

export default function SettingsScreen() {
  const APP_VERSION =
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    // Legacy fallback for older Expo paths / environments
    (Constants as any).manifest?.version ??
    process.env.EXPO_PUBLIC_APP_VERSION ??
    (process.env.NODE_ENV === 'development' ? 'dev' : 'unknown');

  const APP_BUILD =
    Application.nativeBuildVersion ??
    (Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode != null
        ? String(Constants.expoConfig?.android?.versionCode)
        : null);

  const APP_VERSION_LABEL = APP_BUILD ? `${APP_VERSION} (${APP_BUILD})` : APP_VERSION;
  const { t, i18n: i18nInstance } = useTranslation();
  const { signOut, user } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const HANDLE_CLOSE_FALLBACK = '/'; // change if your home route differs

  const handleClose = () => {
    // 1) Prefer router's canGoBack if available
    const canGoBack =
      typeof (appRouter as any).canGoBack === 'function' && (appRouter as any).canGoBack();

    if (canGoBack) {
      appRouter.back();
      return;
    }

    // 2) Web-only: if browser history exists, go back (covers some cases where canGoBack is false)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // If you refreshed / landed directly on /settings, history length is often 1
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
    }

    // 3) Final fallback
    appRouter.replace(HANDLE_CLOSE_FALLBACK);
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

  const firstName =
    (profile?.first_name ?? '').trim() || t('settings.profile_section.user_fallback');
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showRestartTourConfirm, setShowRestartTourConfirm] = useState(false);
  const [restartTourLoading, setRestartTourLoading] = useState(false);
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
    // NOTE: This is local-only UI preference data (not Supabase).
    // Platform storage access is centralized in a service per engineering guidelines.
    const prefs = await loadSettingsPreferences();
    setSettings(prefs);
  };

  const saveSettings = async (newSettings: SettingsPreferences) => {
    setSettings(newSettings);
    try {
      await saveSettingsPreferences(newSettings);
    } catch {
      Alert.alert(t('alerts.error_title'), t('settings.errors.save_preference_failed'));
    }
  };

  const handleRestartTourGuide = () => {
    if (!user?.id) {
      Alert.alert(t('alerts.error_title'), t('edit_profile.error_user_not_authenticated'));
      return;
    }

    setShowRestartTourConfirm(true);
  };

  const confirmRestartTourGuide = async () => {
    if (!user?.id) return;
    if (restartTourLoading) return;

    setRestartTourLoading(true);
    try {
      await Promise.all([
        resetTour('V1_HomePageTour', user.id),
        resetTour('V1_MealtypeLogTour', user.id),
      ]);
      setShowRestartTourConfirm(false);
      // Redirect user to Food Diary home after re-enabling guidance
      appRouter.replace('/');
    } catch (e) {
      Alert.alert(
        t('alerts.error_title'),
        t('common.unexpected_error', { defaultValue: 'Something went wrong.' })
      );
    } finally {
      setRestartTourLoading(false);
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
    // Cross-platform confirm (no window.confirm per engineering guidelines)
    setShowLogoutConfirm(true);
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
      await deleteUserAccountData({ userId: user.id });
      await signOut();
      appRouter.replace('/login');
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error deleting account data:', error);
      }
      Alert.alert(t('alerts.error_title'), t('settings.errors.delete_account_failed'));
    } finally {
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
        AccessibilityHints.NAVIGATE
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
      <ScrollView 
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scrollContent}>
          <View style={[styles.topRowContainer, { paddingTop: insets.top }]}>
            <View style={styles.topRow}>
              {/* left placeholder to keep centered title */}
              <View style={styles.topRowSide} />

              <ThemedText
                style={[styles.topRowTitle, { color: colors.text }]}
                accessibilityRole="header"
                numberOfLines={1}
              >
                {t('settings.greeting', { name: firstName })}
              </ThemedText>

              <View style={styles.topRowSide}>
                <TouchableOpacity
                  style={[
                    styles.topRowCloseButton,
                    getMinTouchTargetStyle(),
                    { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
                  ]}
                  onPress={handleClose}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(t('common.close'), AccessibilityHints.CLOSE)}
                >
                  <IconSymbol name="xmark" size={24} color={colors.text} decorative={true} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* New profile header (replaces logo + old profile card) */}
          <View style={styles.profileHeader}>
            {userConfigLoading && !userConfig ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <>
                <ProfileAvatarPicker
                  avatarUrl={avatarUrl}
                  onAvatarUpdated={setAvatarUrl}
                  size={130}
                  editable={!loading && !userConfigLoading}
                  persistToProfile={true}
                  successToastMessage={t('settings.profile_photo_updated')}
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
              appRouter.push('/settings/my-goal');
            }}
          />
          <SettingItem
            icon={<Ionicons name="walk-outline" size={20} color={colors.tint} />}
            title={t('settings.my_journey.adjust_activity_level')}
            subtitle={t('settings.my_journey.adjust_activity_level_subtitle')}
            onPress={() => {
              openMyGoalEdit(appRouter, 'activity');
            }}
          />
          <SettingItem
            icon={<MaterialCommunityIcons name="scale-bathroom" size={20} color={colors.tint} />}
            title={t('settings.my_journey.my_weight')}
            subtitle={t('settings.my_journey.my_weight_subtitle')}
            onPress={() => {
              openWeightEntryForToday(appRouter);
            }}
          />
          <SettingItem
            icon={<Text style={{ fontSize: 20 }}>💡</Text>}
            title={t('settings.my_journey.restart_tour_guide_title')}
            subtitle={t('settings.my_journey.restart_tour_guide_subtitle')}
            onPress={handleRestartTourGuide}
          />
        </SettingSection>

        {/* Account Management */}
        <SettingSection title={t('settings.account.title')}>
          <SettingItem
            icon="person.fill"
            title={t('settings.account.edit_profile')}
            subtitle={t('settings.account.edit_profile_subtitle')}
            onPress={() => {
              appRouter.push('/edit-profile');
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
        <SettingSection title={t('settings.legal.title')}>
          <SettingItem
            icon="doc.text.fill"
            title={t('onboarding.legal.terms_title')}
            subtitle={getDocVersion('terms') ? t('legal.updated_version', { version: getDocVersion('terms') }) : undefined}
            onPress={() => {
              appRouter.push({ pathname: '/legal/[docType]', params: { docType: 'terms' } });
            }}
          />
          <SettingItem
            icon="hand.raised.fill"
            title={t('onboarding.legal.privacy_title')}
            subtitle={getDocVersion('privacy') ? t('legal.updated_version', { version: getDocVersion('privacy') }) : undefined}
            onPress={() => {
              appRouter.push({ pathname: '/legal/[docType]', params: { docType: 'privacy' } });
            }}
          />
          <SettingItem
            icon={<MaterialCommunityIcons name="heart-pulse" size={20} color={colors.tint} />}
            title={t('onboarding.legal.health_disclaimer_title')}
            subtitle={getDocVersion('health_disclaimer') ? t('legal.updated_version', { version: getDocVersion('health_disclaimer') }) : undefined}
            onPress={() => {
              appRouter.push({ pathname: '/legal/[docType]', params: { docType: 'health' } });
            }}
          />
        </SettingSection>

        {/* About */}
        <SettingSection title={t('settings.about.title')}>
          <SettingItem
            icon="info.circle.fill"
            title={t('settings.about.app_version')}
            subtitle={APP_VERSION_LABEL}
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

      <ConfirmModal
        visible={showLogoutConfirm}
        title={t('settings.logout.confirm_title')}
        message={t('settings.logout.confirm_message')}
        confirmText={t('settings.logout.button')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          try {
            await signOut();
            appRouter.replace('/login');
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('Error logging out:', error);
            }
            Alert.alert(t('alerts.error_title'), t('settings.errors.logout_failed'));
          }
        }}
        onCancel={() => setShowLogoutConfirm(false)}
        confirmButtonStyle={{ backgroundColor: colors.tint }}
        cancelButtonStyle={{ backgroundColor: colors.backgroundSecondary }}
        cancelTextStyle={{ color: colors.text }}
        confirmDisabled={false}
        animationType="fade"
      />

      <ConfirmModal
        visible={showRestartTourConfirm}
        title={t('settings.my_journey.restart_tour_guide_title')}
        message={t('settings.my_journey.restart_tour_guide_confirm_message')}
        confirmText={t('settings.my_journey.restart_tour_guide_confirm_button')}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        onConfirm={confirmRestartTourGuide}
        onCancel={() => setShowRestartTourConfirm(false)}
        confirmButtonStyle={{ backgroundColor: colors.tint }}
        cancelButtonStyle={{ backgroundColor: colors.backgroundSecondary }}
        cancelTextStyle={{ color: colors.text }}
        confirmDisabled={restartTourLoading}
        animationType="fade"
        loading={restartTourLoading}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRowContainer: {
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 16,
  },
  topRowSide: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topRowCloseButton: {
    padding: 4,
  },
  topRowTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
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
        paddingTop: 0,
        paddingBottom: 16,
      },
      default: {
        padding: 16,
        paddingTop: 0,
        paddingBottom: 32,
      },
    }),
  },
  profileHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 10,
    marginBottom: 18,
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

