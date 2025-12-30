import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { ProfileAvatarPicker } from '@/components/profile/ProfileAvatarPicker';
import { AppearanceCycleRow } from '@/components/onboarding/AppearanceCycleRow';
import { NameDobForm } from '@/components/profile/NameDobForm';
import { Colors, Spacing, Typography } from '@/constants/theme';
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

  // Convert dateOfBirthStep2 to the format expected by NameDobForm (ISO string or null)
  const dobForForm = dateOfBirthStep2 || null;

  // Handler for NameDobForm's onChangeDob
  const handleDobChange = (isoDate: string | null) => {
    if (isoDate) {
      const date = new Date(isoDate + 'T00:00:00');
      onDateChange(date);
    } else {
      // If null, we need to handle this - but in onboarding, dob is required
      // So we'll just update the date picker state
      onDateChange(new Date(1983, 5, 4));
    }
  };

  // Handler for form submission - this will be handled by the parent onboarding flow
  // We'll pass a no-op here since the parent handles the actual submission
  const handleFormSubmit = () => {
    // The actual submission is handled by the parent onboarding flow via handleNext
    // This is just a placeholder to satisfy the NameDobForm interface
  };

  return (
    <View style={styles.stepContent}>
      <ThemedText type="title" style={[styles.stepTitle, { color: colors.text }]}>
        {t('onboarding.name_age.title')}
      </ThemedText>
      
      {/* Avatar picker - kept outside NameDobForm */}
      <View style={styles.avatarContainer}>
        <ProfileAvatarPicker
          avatarUrl={avatarUri}
          onAvatarUpdated={onAvatarChange}
          size={110}
          editable={!loading}
        />
      </View>
      
      {/* Reusable Name/DoB form */}
      <NameDobForm
        preferredName={preferredName}
        dob={dobForForm}
        onChangePreferredName={onPreferredNameChange}
        onChangeDob={handleDobChange}
        mode="onboarding"
        onSubmit={handleFormSubmit}
        submitLabel={t('common.next')}
        isSubmitting={loading}
        errorText={error}
        getDOBMinDate={getDOBMinDate}
        getDOBMaxDate={getDOBMaxDate}
        colors={colors}
      />

      {/* Dark mode UI - kept outside NameDobForm */}
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
  inputContainer: {
    marginBottom: Spacing.xl,
  },
});

