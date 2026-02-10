import { ColoredBrandName } from '@/components/brand/ColoredBrandName';
import { OnboardingErrorBox } from '@/components/onboarding/OnboardingErrorBox';
import { OnboardingPrimaryButton } from '@/components/onboarding/OnboardingPrimaryButton';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import {
    ActivityStep,
    CurrentWeightStep,
    DailyCalorieTargetStep,
    DailyFocusTargetsStep,
    GoalStep,
    GoalWeightStep,
    HeightStep,
    LegalAgreementStep,
    ModulePreferencesStep,
    NameStep,
    PlanStep,
    SexStep,
} from '@/components/onboarding/steps';
import { BlockingBrandedLoader } from '@/components/system/BlockingBrandedLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingForm } from '@/hooks/useOnboardingForm';
import { kgToLb } from '@/lib/domain/weight-constants';
import { onboardingStyles } from '@/theme/onboardingStyles';
import { onboardingColors } from '@/theme/onboardingTheme';
import {
    getButtonAccessibilityProps,
    getFocusStyle,
} from '@/utils/accessibility';
import { filterNumericInput } from '@/utils/inputFilters';
import { Redirect } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Platform,
    ScrollView,
    TouchableOpacity,
    View,
} from 'react-native';

export default function OnboardingScreen() {
  const { user, loading: authLoading, onboardingComplete } = useAuth();

  const containerType =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? String((window as any).__AVOVIBE_CONTAINER__?.type ?? '')
      : '';
  const isNativeWrapperWeb = Platform.OS === 'web' && (containerType === 'native' || containerType === 'native_onboarding');
  const isNativeOnboardingWrapper = isNativeWrapperWeb && containerType === 'native_onboarding';

  // Wrapped-native mode: never show web onboarding inside the native WebView.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && containerType === 'native') {
    (window as any).ReactNativeWebView?.postMessage?.('NEED_POST_LOGIN_GATE');
    return <BlockingBrandedLoader enabled timeoutMs={6000} overlay={false} />;
  }

  // Wrapped-native onboarding mode: wait for the bridged native session instead of bouncing to web /login.
  // This prevents rapid route churn (/onboarding <-> /login) while the auth bridge is applying.
  if (isNativeWrapperWeb && (authLoading || !user)) {
    (window as any).ReactNativeWebView?.postMessage?.('REQUEST_NATIVE_SESSION');
    return <BlockingBrandedLoader enabled timeoutMs={8000} overlay={false} />;
  }

  // Web: if authenticated and onboarding already complete, do not allow staying on /onboarding — go to Food Diary.
  if (Platform.OS === 'web' && !isNativeWrapperWeb && !authLoading && user && onboardingComplete) {
    return <Redirect href="/(tabs)" />;
  }

  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  // Many onboarding step components currently type `colors` as `typeof Colors.light`.
  // At runtime we pass either light/dark; this cast keeps TS happy without changing behavior.
  const colors = Colors[colorScheme] as typeof Colors.light;
  
  const {
    // State
    currentStep,
    totalSteps,
    goal,
    setGoal,
    showAdvancedGoals,
    setShowAdvancedGoals,
    avatarUri,
    setAvatarUri,
    preferredName,
    dateOfBirthStep2,
    selectedDateStep2,
    showDatePickerStep2,
    setShowDatePickerStep2,
    sex,
    setSex,
    heightCm,
    setHeightCm,
    heightFt,
    setHeightFt,
    heightIn,
    setHeightIn,
    heightUnit,
    activityLevel,
    setActivityLevel,
    currentWeightKg,
    setCurrentWeightKg,
    currentWeightLb,
    setCurrentWeightLb,
    currentWeightUnit,
    currentBodyFatPercent,
    setCurrentBodyFatPercent,
    goalWeightKg,
    setGoalWeightKg,
    goalWeightLb,
    setGoalWeightLb,
    goalWeightUnit,
    calorieTarget,
    maintenanceCalories,
    caloriePlan,
    calorieExecutionMode,
    setCalorieTarget,
    setMaintenanceCalories,
    setCaloriePlan,
    setCalorieExecutionMode,
    dailyTargets,
    setDailyTargets,
    modulePreferences,
    setModulePreferences,
    selectedPlan,
    setSelectedPlan,
    premiumInsisted,
    setPremiumInsisted,
    legalAgreeTerms,
    setLegalAgreeTerms,
    legalAgreePrivacy,
    setLegalAgreePrivacy,
    legalAcknowledgeRisk,
    setLegalAcknowledgeRisk,
    loading,
    isSubmitting,
    errorText,
    errorKey,
    errorParams,
    isDesktop,
    
    // Error handlers
    setErrorText,
    setErrorI18n,
    clearErrors,
    
    // Unit conversion setters
    setWeightUnit,
    setHeightUnitWithConversion,
    
    // Display getters
    getCurrentWeightDisplay,
    getGoalWeightDisplay,
    
    // Handlers
    handlePreferredNameChange,
    handlePreferredNameBlur,
    handleOpenDatePickerStep2,
    handleDateOfBirthChange,
    getDOBMinDate,
    getDOBMaxDate,
    handleNext,
    handleBack,
    handleCompleteOnboarding,
    handleProceedToLegal,
    shouldDisableNext,
    goalWeightSuggestion,
  } = useOnboardingForm();

  useEffect(() => {
    if (!isNativeOnboardingWrapper || typeof window === 'undefined') return;

    const handleMessage = (event: any) => {
      const raw = event?.data != null ? String(event.data) : '';
      if (!raw) return;
      let msg: any = null;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg?.type !== 'NATIVE_ONBOARDING_BACK') return;

      const canGoBack = currentStep > 1;
      if (canGoBack) {
        handleBack();
      }

      (window as any).ReactNativeWebView?.postMessage?.(
        JSON.stringify({ type: 'NATIVE_ONBOARDING_BACK_RESULT', handled: canGoBack })
      );
    };

    window.addEventListener('message', handleMessage);
    if (typeof document !== 'undefined') {
      document.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (typeof document !== 'undefined') {
        document.removeEventListener('message', handleMessage);
      }
    };
  }, [currentStep, handleBack, isNativeOnboardingWrapper]);
  
  // Scroll to top when step changes
  const scrollViewRef = useRef<ScrollView>(null);
  useEffect(() => {
    // Scroll parent ScrollView to top when step changes
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
    });
  }, [currentStep]);
  
  // Step map for cleaner rendering
  const stepScreens: Record<number, React.ReactNode> = {
    1: (
      <NameStep
        preferredName={preferredName}
        onPreferredNameChange={handlePreferredNameChange}
        onPreferredNameBlur={handlePreferredNameBlur}
        avatarUri={avatarUri}
        onAvatarChange={setAvatarUri}
        dateOfBirthStep2={dateOfBirthStep2}
        selectedDateStep2={selectedDateStep2}
        showDatePickerStep2={showDatePickerStep2}
        onOpenDatePicker={handleOpenDatePickerStep2}
        onDateChange={handleDateOfBirthChange}
        onCloseDatePicker={() => setShowDatePickerStep2(false)}
        getDOBMinDate={getDOBMinDate}
        getDOBMaxDate={getDOBMaxDate}
        error={errorText}
        loading={loading}
        colors={colors}
      />
    ),
    2: (
      <SexStep
        sex={sex}
        onSexChange={(s) => {
          setSex(s);
          clearErrors();
        }}
        onErrorClear={clearErrors}
        loading={loading}
        colors={colors}
      />
    ),
    3: (
      <HeightStep
        heightCm={heightCm}
        heightFt={heightFt}
        heightIn={heightIn}
        heightUnit={heightUnit}
        onHeightCmChange={(text) => {
          setHeightCm(filterNumericInput(text));
          clearErrors();
        }}
        onHeightFtChange={(text) => {
          setHeightFt(filterNumericInput(text));
          clearErrors();
        }}
        onHeightInChange={(text) => {
          setHeightIn(filterNumericInput(text));
          clearErrors();
        }}
        onHeightUnitChange={setHeightUnitWithConversion}
        onErrorClear={clearErrors}
        error={errorText}
        loading={loading}
        colors={colors}
      />
    ),
    4: (
      <ActivityStep
        activityLevel={activityLevel}
        onActivityLevelChange={(level) => {
          setActivityLevel(level);
          clearErrors();
        }}
        onErrorClear={clearErrors}
        loading={loading}
        colors={colors}
      />
    ),
    5: (
      <CurrentWeightStep
        currentWeightKg={currentWeightKg}
        currentWeightLb={currentWeightLb}
        currentWeightUnit={currentWeightUnit}
        currentBodyFatPercent={currentBodyFatPercent}
        dobISO={dateOfBirthStep2 || null}
        sexAtBirth={sex}
        onCurrentWeightKgChange={(text) => {
          setCurrentWeightKg(text);
          clearErrors();
        }}
        onCurrentWeightLbChange={(text) => {
          setCurrentWeightLb(text);
          clearErrors();
        }}
        onCurrentWeightUnitChange={setWeightUnit}
        onCurrentBodyFatPercentChange={(text) => {
          setCurrentBodyFatPercent(text);
          clearErrors();
        }}
        onErrorClear={clearErrors}
        error={errorText}
        loading={loading}
        colors={colors}
      />
    ),
    6: (
      <GoalStep
        goal={goal}
        showAdvancedGoals={showAdvancedGoals}
        onGoalChange={(g) => {
          setGoal(g);
          clearErrors();
        }}
        onShowAdvancedGoals={() => setShowAdvancedGoals(true)}
        onErrorClear={clearErrors}
        loading={loading}
        colors={colors}
      />
    ),
    7: (
      <GoalWeightStep
        goalWeightKg={goalWeightKg}
        goalWeightLb={goalWeightLb}
        currentWeightUnit={currentWeightUnit}
        goalType={goal ? goal : null}
        currentWeightLb={currentWeightLb ? parseFloat(currentWeightLb) : null}
        heightCm={heightCm ? parseFloat(heightCm.toString()) : null}
        sexAtBirth={sex}
        dobISO={dateOfBirthStep2 || null}
        goalWeightSuggestion={goalWeightSuggestion}
        onGoalWeightKgChange={(text) => {
          setGoalWeightKg(text);
          clearErrors();
        }}
        onGoalWeightLbChange={(text) => {
          setGoalWeightLb(text);
          clearErrors();
        }}
        onErrorClear={clearErrors}
        error={errorText}
        errorKey={errorKey}
        loading={loading}
        colors={colors}
      />
    ),
    8: (
      <DailyCalorieTargetStep
        goalType={goal ? goal : null}
        currentWeightLb={currentWeightLb ? parseFloat(currentWeightLb) : null}
        targetWeightLb={goalWeightLb ? parseFloat(goalWeightLb) : (goalWeightKg ? kgToLb(parseFloat(goalWeightKg)) : null)}
        heightCm={heightCm ? parseFloat(heightCm.toString()) : null}
        sexAtBirth={sex}
        activityLevel={activityLevel}
        dobISO={dateOfBirthStep2 || null}
        bodyFatPercent={currentBodyFatPercent ? parseFloat(currentBodyFatPercent) : null}
        weightUnit={currentWeightUnit}
        heightUnit={heightUnit}
        firstName={preferredName || null}
        onCalorieTargetChange={(target) => {
          setCalorieTarget(target.calorieTarget);
          setMaintenanceCalories(target.maintenanceCalories);
          setCaloriePlan(target.caloriePlan);
          setCalorieExecutionMode(target.executionMode);
        }}
        onActivityLevelChange={(level) => {
          setActivityLevel(level);
          clearErrors();
        }}
        onErrorClear={clearErrors}
        loading={loading}
        colors={colors}
      />
    ),
    9: (
      <DailyFocusTargetsStep
        goalType={goal ? goal : null}
        currentWeightLb={currentWeightLb ? parseFloat(currentWeightLb) : null}
        targetWeightLb={goalWeightLb ? parseFloat(goalWeightLb) : (goalWeightKg ? kgToLb(parseFloat(goalWeightKg)) : null)}
        heightCm={heightCm ? parseFloat(heightCm.toString()) : null}
        sexAtBirth={sex}
        activityLevel={activityLevel}
        weightUnit={currentWeightUnit}
        calorieTarget={calorieTarget}
        onTargetChange={setDailyTargets}
        onErrorClear={clearErrors}
        loading={loading}
        colors={colors}
        stepKey={currentStep}
      />
    ),
    10: (
      <ModulePreferencesStep
        selectedModules={modulePreferences}
        onSelectedModulesChange={setModulePreferences}
        loading={loading}
        colors={colors}
      />
    ),
    11: (
      <PlanStep
        selectedPlan={selectedPlan}
        onSelectedPlanChange={setSelectedPlan}
        onPremiumInsist={() => setPremiumInsisted(true)}
        loading={loading}
        colors={colors}
      />
    ),
    12: (
      <LegalAgreementStep
        legalAgreeTerms={legalAgreeTerms}
        legalAgreePrivacy={legalAgreePrivacy}
        legalAcknowledgeRisk={legalAcknowledgeRisk}
        onLegalAgreeTermsChange={setLegalAgreeTerms}
        onLegalAgreePrivacyChange={setLegalAgreePrivacy}
        onLegalAcknowledgeRiskChange={setLegalAcknowledgeRisk}
        loading={loading}
        colors={colors}
      />
    ),
  };
  
  return (
    <ThemedView style={[
      onboardingStyles.container,
      Platform.select({
        web: {
          background: `radial-gradient(circle at top right, ${onboardingColors.primary}1F, transparent 60%)`,
        },
        default: {
          backgroundColor: colors.background,
        },
      }),
    ]}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={onboardingStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[onboardingStyles.cardContainer, { maxWidth: isDesktop ? 520 : '100%' }]}>
          <View style={[
            onboardingStyles.card,
            onboardingStyles.cardModern,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}>
            {/* Header */}
            <View style={onboardingStyles.cardHeader}>
              {currentStep > 1 ? (
                <TouchableOpacity
                  style={onboardingStyles.backButton}
                  onPress={handleBack}
                  disabled={loading || isSubmitting}
                  {...getButtonAccessibilityProps('Back', 'Double tap to go back to previous step')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol name="chevron.left" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <View style={onboardingStyles.backButton} />
              )}
              <ThemedText type="title" style={onboardingStyles.headerTitle}>
                {t('onboarding.header_prefix')}
                <ColoredBrandName />
              </ThemedText>
              <View style={onboardingStyles.backButton} />
            </View>
            
            {/* Step Indicator - Right under the title */}
            <View style={[onboardingStyles.stepIndicatorTopContainer, { backgroundColor: colors.background }]}>
              <StepIndicator currentStep={currentStep} totalSteps={totalSteps} colors={colors} />
            </View>
            
            <View style={onboardingStyles.cardContent}>
              {stepScreens[currentStep] ?? null}
              
              <OnboardingErrorBox
                errorKey={errorKey}
                errorParams={errorParams}
                errorText={errorText}
              />
              
              {/* CTA button inside content column for all steps */}
              <View style={onboardingStyles.buttonContainerModern}>
                {currentStep < totalSteps ? (
                  <OnboardingPrimaryButton
                    label={t('common.next')}
                    onPress={handleNext}
                    disabled={shouldDisableNext()}
                    loading={loading}
                    testID="onboarding-next-button"
                  />
                ) : (
                  <>
                    <OnboardingPrimaryButton
                      label={loading || isSubmitting ? t('onboarding.saving') : t('onboarding.legal_agree_cta')}
                      onPress={async () => {
                        // Ensure handler is properly awaited
                        await handleCompleteOnboarding({
                          markComplete: true,
                          navigateTo: '/(tabs)',
                        });
                      }}
                      disabled={shouldDisableNext() || isSubmitting}
                      loading={loading || isSubmitting}
                      testID="onboarding-legal-agree-button"
                    />
                    <ThemedText style={[onboardingStyles.legalCaption, { color: colors.textSecondary }]}>
                      {t('onboarding.legal.confirmation_caption')}
                    </ThemedText>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      
    </ThemedView>
  );
}

