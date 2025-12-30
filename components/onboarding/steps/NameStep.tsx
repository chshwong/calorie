import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { ProfileAvatarPicker } from '@/components/profile/ProfileAvatarPicker';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppearanceCycleRow } from '@/components/onboarding/AppearanceCycleRow';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Layout, Typography } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { ageFromDob } from '@/utils/calculations';
import { validatePreferredName, isNameValidationError } from '@/utils/validation';
import { filterPreferredNameInput, normalizeSpaces } from '@/utils/inputFilters';
import { checkProfanity } from '@/utils/profanity';
import { POLICY } from '@/constants/constraints';
import { getInputAccessibilityProps, getButtonAccessibilityProps, getFocusStyle, getWebAccessibilityProps } from '@/utils/accessibility';
import { useTheme } from '@/contexts/ThemeContext';

interface NameStepProps {
  preferredName: string;
  onPreferredNameChange: (text: string) => void;
  onPreferredNameBlur: () => void;
  avatarUri: string | null;
  onAvatarChange: (uri: string | null) => void;
  dateOfBirthStep2: string;
  selectedDateStep2: Date;
  showDatePickerStep2: boolean;
  onOpenDatePicker: () => void;
  onDateChange: (date: Date) => void;
  onCloseDatePicker: () => void;
  getDOBMinDate: () => Date;
  getDOBMaxDate: () => Date;
  error: string | null;
  loading: boolean;
  colors: typeof Colors.light;
}

export const NameStep: React.FC<NameStepProps> = ({
  preferredName,
  onPreferredNameChange,
  onPreferredNameBlur,
  avatarUri,
  onAvatarChange,
  dateOfBirthStep2,
  selectedDateStep2,
  showDatePickerStep2,
  onOpenDatePicker,
  onDateChange,
  onCloseDatePicker,
  getDOBMinDate,
  getDOBMaxDate,
  error,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const { themeMode, setThemeMode } = useTheme();

  const cycleThemeMode = () => {
    const currentMode = themeMode ?? 'auto';
    const nextMode = currentMode === 'auto' ? 'light' : currentMode === 'light' ? 'dark' : 'auto';
    void setThemeMode(nextMode);
  };

  return (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.name_age.title')}
      </ThemedText>
      
      <View style={styles.avatarContainer}>
        <ProfileAvatarPicker
          avatarUrl={avatarUri}
          onAvatarUpdated={onAvatarChange}
          size={110} // Avatar size - standard profile picture size, not a theme token
          editable={!loading}
        />
      </View>
      
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>
          {t('onboarding.name_age.preferred_name_label')} *
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: error && isNameValidationError(error) ? colors.error : colors.border,
              color: colors.text,
              backgroundColor: colors.backgroundSecondary,
              ...(Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {}),
            },
          ]}
          placeholder={t('onboarding.name_age.preferred_name_placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={preferredName}
          onChangeText={onPreferredNameChange}
          onBlur={onPreferredNameBlur}
          maxLength={POLICY.NAME.MAX_LEN}
          autoCapitalize="words"
          autoComplete="given-name"
          editable={!loading}
          {...getInputAccessibilityProps(
            `${t('onboarding.name_age.preferred_name_label')}, required`,
            t('onboarding.name_age.preferred_name_placeholder'),
            error && isNameValidationError(error) ? error : undefined,
            true // Preferred name is required
          )}
          {...(Platform.OS === 'web' ? getWebAccessibilityProps('textbox', `${t('onboarding.name_age.preferred_name_label')}, required`, undefined, error && isNameValidationError(error) ? true : undefined, true) : {})}
        />
        <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
          {t('onboarding.name_age.preferred_name_helper')}
        </ThemedText>
        {error && isNameValidationError(error) && (
          <ThemedText
            style={[styles.errorText, { color: colors.error }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            {...(Platform.OS === 'web' ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
          >
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
              borderColor: error && !dateOfBirthStep2 ? colors.error : colors.border,
              backgroundColor: colors.backgroundSecondary,
            },
          ]}
          onPress={onOpenDatePicker}
          disabled={loading}
          {...getButtonAccessibilityProps(
            `${t('onboarding.name_age.dob_label')}, required`,
            t('onboarding.name_age.dob_accessibility_hint')
          )}
          {...(Platform.OS === 'web' ? getWebAccessibilityProps('button', `${t('onboarding.name_age.dob_label')}, required`, undefined, error && !dateOfBirthStep2 ? true : undefined, true) : {})}
        >
          <ThemedText style={[styles.dateInputText, { color: dateOfBirthStep2 ? colors.text : colors.textSecondary }]}>
            {dateOfBirthStep2 || t('onboarding.name_age.dob_placeholder')}
          </ThemedText>
          <IconSymbol name="calendar" size={FontSize.xl} color={colors.icon} decorative={true} />
        </TouchableOpacity>
        
        {error && !dateOfBirthStep2 && (
          <ThemedText
            style={[styles.errorText, { color: colors.error }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            {...(Platform.OS === 'web' ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
          >
            {error}
          </ThemedText>
        )}
        
        {dateOfBirthStep2 && (
          <View style={styles.ageDisplay}>
            <ThemedText style={[styles.ageLabel, { color: colors.textSecondary }]}>
              {t('onboarding.name_age.age_display', { age: ageFromDob(dateOfBirthStep2) })}
            </ThemedText>
          </View>
        )}
        
        <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          {t('onboarding.name_age.subtitle')}
        </ThemedText>
        
        {/* Shared AppDatePicker for DOB */}
        <AppDatePicker
          value={selectedDateStep2}
          onChange={onDateChange}
          minimumDate={getDOBMinDate()}
          maximumDate={getDOBMaxDate()}
          visible={showDatePickerStep2}
          onClose={onCloseDatePicker}
          title={t('date_picker.select_date_of_birth')}
        />
      </View>

      <View style={styles.inputContainer}>
        <AppearanceCycleRow mode={(themeMode ?? 'auto') as 'auto' | 'light' | 'dark'} onPress={cycleThemeMode} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stepContent: {
    gap: Spacing.xl,
  },
  stepTitle: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  avatarContainer: {
    marginBottom: -Spacing.xl, // Counteract the gap from stepContent
  },
  stepSubtitle: {
    ...Typography.bodyLarge,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  inputContainer: {
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.labelLarge,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1.5, // Standard input border width - not a theme token
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSize.md,
    minHeight: Layout.minTouchTarget, // WCAG 2.0 AA: minimum 44x44 touch target
  },
  dateInput: {
    borderWidth: 1, // Standard border width - not a theme token
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSize.md,
    minHeight: Layout.minTouchTarget, // WCAG 2.0 AA: minimum 44x44 touch target
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    ...Typography.bodyLarge,
  },
  ageDisplay: {
    marginTop: Spacing.sm,
  },
  ageLabel: {
    ...Typography.body,
  },
  helperText: {
    ...Typography.bodyLarge,
    marginTop: Spacing.xs,
    paddingLeft: Spacing.xs,
  },
  errorText: {
    ...Typography.body,
    marginTop: Spacing.xs,
  },
});

