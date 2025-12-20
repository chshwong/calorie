import React from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingForm } from '@/hooks/useOnboardingForm';
import { onboardingStyles } from '@/theme/onboardingStyles';
import { filterNumericInput } from '@/utils/inputFilters';
import {
  NameStep,
  SexStep,
  HeightStep,
  ActivityStep,
  CurrentWeightStep,
  GoalStep,
  GoalWeightStep,
  DailyCalorieTargetStep,
  DailyFocusTargetsStep,
} from '@/components/onboarding/steps';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { OnboardingPrimaryButton } from '@/components/onboarding/OnboardingPrimaryButton';
import { OnboardingErrorBox } from '@/components/onboarding/OnboardingErrorBox';
import {
  getButtonAccessibilityProps,
  getFocusStyle,
} from '@/utils/accessibility';
import { kgToLb } from '@/lib/domain/weight-constants';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
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
    timelineOption,
    setTimelineOption,
    customTargetDate,
    setCustomTargetDate,
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
    loading,
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
    shouldDisableNext,
    goalWeightSuggestion,
  } = useOnboardingForm();
  
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
        goalType={goal}
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
        goalType={goal}
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
          console.log('onCalorieTargetChange', target);
          setCalorieTarget(target.calorieTarget);
          setMaintenanceCalories(target.maintenanceCalories);
          setCaloriePlan(target.caloriePlan);
          setCalorieExecutionMode(target.executionMode);
        }}
        onErrorClear={clearErrors}
        loading={loading}
        colors={colors}
      />
    ),
    9: (
      <DailyFocusTargetsStep
        goalType={goal}
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
                  disabled={loading}
                  {...getButtonAccessibilityProps('Back', 'Double tap to go back to previous step')}
                  {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
                >
                  <IconSymbol name="chevron.left" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <View style={onboardingStyles.backButton} />
              )}
              <ThemedText type="title" style={[onboardingStyles.headerTitle, { color: colors.tint }]}>
                {t('onboarding.title')}
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
                  <OnboardingPrimaryButton
                    label={loading ? t('onboarding.saving') : t('onboarding.complete_button')}
                    onPress={handleCompleteOnboarding}
                    disabled={false}
                    loading={loading}
                    testID="onboarding-complete-button"
                  />
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      
    </ThemedView>
  );
}

