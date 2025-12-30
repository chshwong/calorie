import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { OnboardingPrimaryButton } from '@/components/onboarding/OnboardingPrimaryButton';
import { Colors, FontSize, BorderRadius, Spacing, Layout, Typography } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { ageFromDob } from '@/utils/calculations';
import { validatePreferredName, isNameValidationError } from '@/utils/validation';
import { filterPreferredNameInput, normalizeSpaces } from '@/utils/inputFilters';
import { POLICY } from '@/constants/constraints';
import { getInputAccessibilityProps, getButtonAccessibilityProps, getFocusStyle, getWebAccessibilityProps } from '@/utils/accessibility';

export type NameDobFormProps = {
  preferredName: string;
  dob: string | null; // ISO date "YYYY-MM-DD" or null
  onChangePreferredName: (v: string) => void;
  onChangeDob: (isoDate: string | null) => void;

  mode: 'onboarding' | 'edit';

  onSubmit: () => void | Promise<void>;
  submitLabel?: string; // default "Continue" for onboarding, "Save" for edit

  onBack?: () => void; // for edit screen, or onboarding if needed
  isSubmitting?: boolean;
  errorText?: string | null; // optional inline error area
  
  // Internal state management for date picker
  getDOBMinDate: () => Date;
  getDOBMaxDate: () => Date;
  colors: typeof Colors.light;
};

export const NameDobForm: React.FC<NameDobFormProps> = ({
  preferredName,
  dob,
  onChangePreferredName,
  onChangeDob,
  mode,
  onSubmit,
  submitLabel,
  onBack,
  isSubmitting = false,
  errorText,
  getDOBMinDate,
  getDOBMaxDate,
  colors,
}) => {
  const { t } = useTranslation();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (dob) {
      const dobDate = new Date(dob + 'T00:00:00');
      if (!isNaN(dobDate.getTime())) {
        return dobDate;
      }
    }
    // Default to June 4, 1983
    return new Date(1983, 5, 4);
  });

  const handlePreferredNameBlur = () => {
    const normalized = normalizeSpaces(preferredName);
    if (normalized !== preferredName) {
      onChangePreferredName(normalized);
    }
  };

  const handleOpenDatePicker = () => {
    if (!dob) {
      setSelectedDate(new Date(1983, 5, 4));
    } else {
      const existingDate = new Date(dob + 'T00:00:00');
      if (!isNaN(existingDate.getTime())) {
        setSelectedDate(existingDate);
      }
    }
    setShowDatePicker(true);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    onChangeDob(dateString);
  };

  const handleDatePickerClose = () => {
    setShowDatePicker(false);
  };

  const defaultSubmitLabel = mode === 'edit' ? t('common.save') : t('common.next');

  return (
    <View style={styles.formContent}>
      {/* Preferred Name Input */}
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>
          {t('onboarding.name_age.preferred_name_label')} *
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: errorText && isNameValidationError(errorText) ? colors.error : colors.border,
              color: colors.text,
              backgroundColor: colors.backgroundSecondary,
              ...(Platform.OS === 'web' ? getFocusStyle(onboardingColors.primary) : {}),
            },
          ]}
          placeholder={t('onboarding.name_age.preferred_name_placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={preferredName}
          onChangeText={(text) => {
            const filtered = filterPreferredNameInput(preferredName, text);
            onChangePreferredName(filtered);
          }}
          onBlur={handlePreferredNameBlur}
          maxLength={POLICY.NAME.MAX_LEN}
          autoCapitalize="words"
          autoComplete="given-name"
          editable={!isSubmitting}
          {...getInputAccessibilityProps(
            `${t('onboarding.name_age.preferred_name_label')}, required`,
            t('onboarding.name_age.preferred_name_placeholder'),
            errorText && isNameValidationError(errorText) ? errorText : undefined,
            true
          )}
          {...(Platform.OS === 'web' ? getWebAccessibilityProps('textbox', `${t('onboarding.name_age.preferred_name_label')}, required`, undefined, errorText && isNameValidationError(errorText) ? true : undefined, true) : {})}
        />
        <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
          {t('onboarding.name_age.preferred_name_helper')}
        </ThemedText>
        {errorText && isNameValidationError(errorText) && (
          <ThemedText
            style={[styles.errorText, { color: colors.error }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            {...(Platform.OS === 'web' ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
          >
            {errorText}
          </ThemedText>
        )}
      </View>

      {/* Date of Birth Input */}
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: colors.text }]}>
          {t('onboarding.name_age.dob_label')} *
        </ThemedText>
        <TouchableOpacity
          style={[
            styles.dateInput,
            {
              borderColor: errorText && !dob ? colors.error : colors.border,
              backgroundColor: colors.backgroundSecondary,
            },
          ]}
          onPress={handleOpenDatePicker}
          disabled={isSubmitting}
          {...getButtonAccessibilityProps(
            `${t('onboarding.name_age.dob_label')}, required`,
            t('onboarding.name_age.dob_accessibility_hint')
          )}
          {...(Platform.OS === 'web' ? getWebAccessibilityProps('button', `${t('onboarding.name_age.dob_label')}, required`, undefined, errorText && !dob ? true : undefined, true) : {})}
        >
          <ThemedText style={[styles.dateInputText, { color: dob ? colors.text : colors.textSecondary }]}>
            {dob || t('onboarding.name_age.dob_placeholder')}
          </ThemedText>
          <IconSymbol name="calendar" size={FontSize.xl} color={colors.icon} decorative={true} />
        </TouchableOpacity>

        {errorText && !dob && !isNameValidationError(errorText) && (
          <ThemedText
            style={[styles.errorText, { color: colors.error }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            {...(Platform.OS === 'web' ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
          >
            {errorText}
          </ThemedText>
        )}

        {dob && (
          <View style={styles.ageDisplay}>
            <ThemedText style={[styles.ageLabel, { color: colors.textSecondary }]}>
              {t('onboarding.name_age.age_display', { age: ageFromDob(dob) })}
            </ThemedText>
          </View>
        )}

        <ThemedText style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          {t('onboarding.name_age.subtitle')}
        </ThemedText>

        {/* Date Picker */}
        <AppDatePicker
          value={selectedDate}
          onChange={handleDateChange}
          minimumDate={getDOBMinDate()}
          maximumDate={getDOBMaxDate()}
          visible={showDatePicker}
          onClose={handleDatePickerClose}
          title={t('date_picker.select_date_of_birth')}
        />
      </View>

      {/* Submit Button - only show in edit mode (onboarding handles its own button) */}
      {mode === 'edit' && (
        <View style={styles.buttonContainer}>
          <OnboardingPrimaryButton
            label={submitLabel || defaultSubmitLabel}
            onPress={onSubmit}
            disabled={isSubmitting}
            loading={isSubmitting}
            testID={`name-dob-form-${mode}-submit`}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  formContent: {
    gap: Spacing.xl,
  },
  inputContainer: {
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.labelLarge,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSize.md,
    minHeight: Layout.minTouchTarget,
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSize.md,
    minHeight: Layout.minTouchTarget,
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
  stepSubtitle: {
    ...Typography.bodyLarge,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  buttonContainer: {
    marginTop: Spacing.md,
  },
});

