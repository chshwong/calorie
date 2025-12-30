import { OnboardingPrimaryButton } from '@/components/onboarding/OnboardingPrimaryButton';
import { HeightStep } from '@/components/onboarding/steps/HeightStep';
import { SexStep } from '@/components/onboarding/steps/SexStep';
import { NameDobForm } from '@/components/profile/NameDobForm';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StandardSubheader } from '@/components/navigation/StandardSubheader';
import { POLICY } from '@/constants/constraints';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { useUserConfig } from '@/hooks/use-user-config';
import { getButtonAccessibilityProps } from '@/utils/accessibility';
import { cmToFtIn, convertHeightToCm, roundTo1 } from '@/utils/bodyMetrics';
import { normalizeSpaces } from '@/utils/inputFilters';
import { validateDateOfBirth, validateHeightCm, validatePreferredName, validateSex } from '@/utils/validation';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

/**
 * Edit Profile Screen
 * 
 * Per engineering guidelines:
 * - Uses useUpdateProfile() hook (Guideline 3.1: Data Access Layer - no direct Supabase calls)
 * - Uses useUserConfig() hook (Guideline 5.1-5.2: Shared Data Hooks)
 * - Mutation hook handles cache invalidation automatically (Guideline 4.1-4.2: mutations handle cache updates)
 * - Reuses onboarding components to avoid duplication
 * - One-time init guard prevents refetch from overwriting user edits
 */

// Date of birth min/max date helpers
const getDOBMinDate = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - POLICY.DOB.MAX_AGE_YEARS);
  return date;
};

const getDOBMaxDate = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - POLICY.DOB.MIN_AGE_YEARS);
  return date;
};

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserConfig();
  const updateProfileMutation = useUpdateProfile();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [stepIndex, setStepIndex] = useState<0 | 1 | 2>(0);
  
  // Draft state for all 4 fields
  const [preferredName, setPreferredName] = useState('');
  const [dob, setDob] = useState<string | null>(null);
  const [sexAtBirth, setSexAtBirth] = useState<'male' | 'female' | ''>('');
  
  // Height state (stored as cm internally, but displayed in user's preferred unit)
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft/in'>('cm');
  
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // One-time init guard to prevent refetch from overwriting user-edited state
  const didInit = useRef(false);

  // Initialize from profile when loaded (one-time only)
  useEffect(() => {
    if (!profile || profileLoading) return;
    if (didInit.current) return; // Prevent refetch from overwriting user edits
    
    didInit.current = true;
    
    setPreferredName(profile.first_name ?? '');
    setDob(profile.date_of_birth ?? null);
    setSexAtBirth((profile.gender as 'male' | 'female' | '') ?? '');
    
    // Initialize height from profile
    // DB stores 'ft' for ft/in preference, UI uses 'ft/in'
    if (profile.height_cm) {
      const cm = profile.height_cm;
      setHeightCm(roundTo1(cm).toString());
      const ftIn = cmToFtIn(cm);
      if (ftIn) {
        setHeightFt(ftIn.feet.toString());
        setHeightIn(ftIn.inches.toString());
      }
      // DB stores 'ft' or 'cm', UI uses 'ft/in' or 'cm'
      // Convert DB value 'ft' to UI value 'ft/in'
      setHeightUnit(profile.height_unit === 'ft' ? 'ft/in' : 'cm');
    }
  }, [profile, profileLoading]);

  // Redirect if not logged in
  useEffect(() => {
    if (!profileLoading && !user) {
      router.replace('/login');
    }
  }, [user, profileLoading, router]);

  const handlePreferredNameChange = (value: string) => {
    setPreferredName(value);
    setErrorText(null);
  };

  const handleDobChange = (isoDate: string | null) => {
    setDob(isoDate);
    setErrorText(null);
  };

  const handleNameDobNext = () => {
    // Validate name and DoB before proceeding
    const normalizedName = normalizeSpaces(preferredName);
    const nameValidation = validatePreferredName(normalizedName);
    if (!nameValidation.valid) {
      setErrorText(nameValidation.error || 'Please enter a valid name.');
      return;
    }

    if (!dob) {
      setErrorText(t('onboarding.name_age.error_dob_required'));
      return;
    }

    const dobErrorKey = validateDateOfBirth(dob);
    if (dobErrorKey) {
      setErrorText(t(dobErrorKey));
      return;
    }

    // Clear error and proceed to step 2
    setErrorText(null);
    setStepIndex(1);
  };

  const handleSexNext = (sex: 'male' | 'female') => {
    setSexAtBirth(sex);
    setErrorText(null);
    setStepIndex(2);
  };

  const handleHeightNext = async (heightCmValue: number) => {
    // Height is already stored in state, just validate and save
    const heightErrorKey = validateHeightCm(heightCmValue);
    if (heightErrorKey) {
      setErrorText(t(heightErrorKey));
      return;
    }

    // Save all fields
    await handleSave();
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert(t('alerts.error_title'), t('edit_profile.error_user_not_authenticated'));
      return;
    }

    // Final validation
    const normalizedName = normalizeSpaces(preferredName);
    const nameValidation = validatePreferredName(normalizedName);
    if (!nameValidation.valid) {
      setErrorText(nameValidation.error || 'Please enter a valid name.');
      return;
    }

    if (!dob) {
      setErrorText(t('onboarding.name_age.error_dob_required'));
      return;
    }

    const dobErrorKey = validateDateOfBirth(dob);
    if (dobErrorKey) {
      setErrorText(t(dobErrorKey));
      return;
    }

    const sexErrorKey = validateSex(sexAtBirth);
    if (sexErrorKey) {
      setErrorText(t(sexErrorKey));
      return;
    }

    const heightCmValue = convertHeightToCm(heightUnit, heightCm, heightFt, heightIn);
    if (!heightCmValue) {
      setErrorText(t('onboarding.height.error_height_required'));
      return;
    }

    const heightErrorKey = validateHeightCm(heightCmValue);
    if (heightErrorKey) {
      setErrorText(t(heightErrorKey));
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);

    try {
      // Update profile with all 4 fields
      // DB constraint only allows 'ft' or 'cm', convert UI 'ft/in' to DB 'ft'
      await updateProfileMutation.mutateAsync({
        first_name: normalizedName || null,
        date_of_birth: dob || null,
        gender: sexAtBirth || null,
        height_cm: heightCmValue || null,
        height_unit: heightUnit === 'ft/in' ? 'ft' : 'cm',
      });

      // Note: useUpdateProfile hook already invalidates queries and refreshes auth context in onSuccess
      // No need to manually invalidate here (per Guideline 4.1-4.2: mutations handle cache updates)
      
      // Also refresh auth context profile (hook does this too, but explicit for clarity)
      await refreshProfile();

      // Navigate back to settings
      router.replace('/settings');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      const errorMessage = error.message || t('settings.errors.save_preference_failed');
      setErrorText(errorMessage);
      Alert.alert(t('alerts.error_title'), errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      router.replace('/settings');
    } else {
      setStepIndex((stepIndex - 1) as 0 | 1);
      setErrorText(null);
    }
  };

  if (profileLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('common.loading')}
        </ThemedText>
      </ThemedView>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <StandardSubheader title="Edit Profile" onBack={handleBack} />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Step 1: Name + DoB */}
          {stepIndex === 0 && (
            <NameDobForm
              preferredName={preferredName}
              dob={dob}
              onChangePreferredName={handlePreferredNameChange}
              onChangeDob={handleDobChange}
              mode="edit"
              onSubmit={handleNameDobNext}
              submitLabel={t('common.next')}
              onBack={handleBack}
              isSubmitting={isSubmitting}
              errorText={errorText}
              getDOBMinDate={getDOBMinDate}
              getDOBMaxDate={getDOBMaxDate}
              colors={colors}
            />
          )}

          {/* Step 2: Sex at Birth */}
          {stepIndex === 1 && (
            <>
              <SexStep
                sex={sexAtBirth}
                onSexChange={(s) => {
                  setSexAtBirth(s);
                  setErrorText(null);
                }}
                onErrorClear={() => setErrorText(null)}
                loading={isSubmitting}
                colors={colors}
              />
              <View style={styles.buttonContainer}>
                <OnboardingPrimaryButton
                  label={t('common.next')}
                  onPress={() => {
                    if (sexAtBirth) {
                      handleSexNext(sexAtBirth as 'male' | 'female');
                    }
                  }}
                  disabled={!sexAtBirth || isSubmitting}
                  loading={isSubmitting}
                  testID="edit-profile-sex-next"
                />
              </View>
            </>
          )}

          {/* Step 3: Height */}
          {stepIndex === 2 && (
            <>
              <HeightStep
                heightCm={heightCm}
                heightFt={heightFt}
                heightIn={heightIn}
                heightUnit={heightUnit}
                onHeightCmChange={setHeightCm}
                onHeightFtChange={setHeightFt}
                onHeightInChange={setHeightIn}
                onHeightUnitChange={setHeightUnit}
                onErrorClear={() => setErrorText(null)}
                error={errorText}
                loading={isSubmitting}
                colors={colors}
              />
              <View style={styles.buttonContainer}>
                <OnboardingPrimaryButton
                  label={t('common.save')}
                  onPress={async () => {
                    const heightCmValue = convertHeightToCm(heightUnit, heightCm, heightFt, heightIn);
                    if (heightCmValue) {
                      await handleHeightNext(heightCmValue);
                    }
                  }}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  testID="edit-profile-height-save"
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});

