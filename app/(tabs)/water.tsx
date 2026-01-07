import { BarChart } from '@/components/charts/bar-chart';
import { CollapsibleModuleHeader } from '@/components/header/CollapsibleModuleHeader';
import { DatePickerButton } from '@/components/header/DatePickerButton';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { SummaryCardHeader } from '@/components/layout/summary-card-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AnimatedWaterIcon } from '@/components/water/animated-water-icon';
import { WaterDropGauge } from '@/components/water/water-drop-gauge';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, ModuleThemes, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedDate } from '@/hooks/use-selected-date';
import { useUserConfig } from '@/hooks/use-user-config';
import { useWaterDaily } from '@/hooks/use-water-logs';
import { useWaterQuickAddPresets } from '@/hooks/use-water-quick-add-presets';
import type { WaterDaily } from '@/lib/services/waterLogs';
import {
    getButtonAccessibilityProps,
    getMinTouchTargetStyle
} from '@/utils/accessibility';
import { addDays, getDateString, getLastNDays } from '@/utils/calculations';
import { formatWaterValue, fromMl, getEffectiveGoal, toMl, WATER_LIMITS, WaterUnit } from '@/utils/waterUnits';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

// ============================================================================
// QUICK ADD ICON LAYOUT CONSTANTS (theme-token based; no magic numbers)
// ============================================================================
// Base icon size was 48dp; increased by ~20% to ~58dp.
// Express ~58dp using theme tokens: 48 (5xl) + 12 (md) - 2 (xxs) = 58.
const QUICK_ADD_ICON_SIZE = Spacing['5xl'] + Spacing.md - Spacing.xxs;
// The 1000ml icon baseline nudge: -(12 - 2) = -10.
const BOTTLE_LARGE_BASELINE_NUDGE_Y = -(Spacing.md - Spacing.xxs);
// Custom “+” overlay position: top = 12 - 2 = 10, left = 12.
const CUSTOM_PLUS_TOP = Spacing.md - Spacing.xxs;
const CUSTOM_PLUS_LEFT = Spacing.md;


export default function WaterScreen() {
  const { t } = useTranslation();
  const { user, profile: authProfile } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Use shared date hook - always derived from URL params
  const {
    selectedDate,
    selectedDateString,
    isToday,
    today,
    minDate,
    canGoBack,
  } = useSelectedDate();
  
  // Calendar view month state removed - now handled by DatePickerButton component
  
  // Helper function to navigate with new date (updates URL param)
  const navigateWithDate = (date: Date) => {
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    router.replace({
      pathname: '/water',
      params: { date: dateString }
    });
  };

  // Get user config for water unit preference
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility
  const effectiveProfile = userConfig || authProfile; // For avatar

  // Get water data (last 14 days for history, using selected date)
  const { todayWater, history, isLoading, addWater, setGoal, setTotal, setTotalForDate, updateUnitAndGoal, isAddingWater, isSettingGoal, isSettingTotal, isUpdatingUnitAndGoal, addWaterError } = useWaterDaily({ 
    daysBack: 14,
    targetDateString: selectedDateString,
  });

  // Determine active water unit: for today use profile, for past dates use water_daily.water_unit
  const activeWaterUnit: WaterUnit = isToday 
    ? ((profile?.water_unit as WaterUnit) || 'ml')
    : ((todayWater?.water_unit as WaterUnit) || (profile?.water_unit as WaterUnit) || 'ml');

  // Get values in active unit
  const total = todayWater?.total || 0;
  
  // Get effective goal for display (with fallback to defaults)
  // For today, use todayWater.goal_ml if available, otherwise use profile goal
  const storedGoalInUnit = todayWater?.goal_ml ? fromMl(todayWater.goal_ml, activeWaterUnit) : null;
  const effectiveGoal = getEffectiveGoal(activeWaterUnit, storedGoalInUnit);
  const goal = effectiveGoal.goalInUnit;
  const goalMl = effectiveGoal.goalMl; // Canonical ml for calculations
  
  // Get profile unit and goal for chart (chart always uses profile settings)
  const profileWaterUnit = (profile?.water_unit as WaterUnit) || (authProfile?.water_unit as WaterUnit) || 'ml';
  const profileGoalMl = profile?.water_goal_ml || authProfile?.water_goal_ml || null;
  const profileGoalInUnit = profileGoalMl ? fromMl(profileGoalMl, profileWaterUnit) : null;
  const profileEffectiveGoal = getEffectiveGoal(profileWaterUnit, profileGoalInUnit);
  const chartGoalMl = profileEffectiveGoal.goalMl; // Profile goal for chart (in ml)

  // Get quick-add presets
  const { presets } = useWaterQuickAddPresets();
  
  // Animation state for quick add chips
  const [animatingChipId, setAnimatingChipId] = useState<string | null>(null);

  // Convert total to ml using the row's water_unit
  const totalMl = todayWater 
    ? toMl(total, todayWater.water_unit as WaterUnit)
    : 0;

  // Water accent color from module theme
  const waterTheme = ModuleThemes.water;
  const accentColor = waterTheme.accent;

  // Custom input modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customInputError, setCustomInputError] = useState('');
  
  // Edit total modal state
  const [showEditTotalModal, setShowEditTotalModal] = useState(false);
  const [editTotalInput, setEditTotalInput] = useState('');
  const [editTotalError, setEditTotalError] = useState('');
  const [editTotalDateString, setEditTotalDateString] = useState<string | null>(null);
  const [editTotalWaterUnit, setEditTotalWaterUnit] = useState<WaterUnit>(profileWaterUnit);
  
  // Error modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  // Open the existing Edit Total modal (reused by the droplet pressable)
  const openEditTotalModal = useCallback(() => {
    setEditTotalDateString(selectedDateString);
    setEditTotalWaterUnit(profileWaterUnit);
    // Convert todayWater.total from its stored unit to profile unit, then format
    const totalInProfileUnit = todayWater?.total 
      ? fromMl(toMl(todayWater.total, todayWater.water_unit as WaterUnit), profileWaterUnit)
      : 0;
    setEditTotalInput(formatValueForInput(totalInProfileUnit, profileWaterUnit));
    setEditTotalError('');
    setShowEditTotalModal(true);
  }, [profileWaterUnit, selectedDateString, todayWater?.total, todayWater?.water_unit]);

  // Handle quick-add preset press
  const handleQuickAddPreset = useCallback((amount: number, unit: WaterUnit, presetId: string) => {
    if (!user?.id) return;
    // Convert amount from preset unit to ml for internal storage
    const deltaMl = toMl(amount, unit);
    
    // Check if adding would exceed max total
    // Use totalMl which is already calculated correctly from todayWater.water_unit
    const newTotalMl = totalMl + deltaMl;
    
    if (newTotalMl > WATER_LIMITS.MAX_TOTAL_ML) {
      setErrorModalTitle(t('water.error.max_total_exceeded_title'));
      setErrorModalMessage(t('water.error.water_too_high'));
      setShowErrorModal(true);
      return;
    }
    
    addWater(deltaMl, goalMl);
    // Trigger animation
    setAnimatingChipId(presetId);
    // Reset animation state after animation completes
    setTimeout(() => setAnimatingChipId(null), 500);
  }, [user?.id, addWater, goalMl, totalMl, t]);
  
  // Handle service-level errors from addWater mutation
  useEffect(() => {
    if (addWaterError) {
      const errorMessage = addWaterError instanceof Error 
        ? addWaterError.message 
        : t('water.error.water_too_high');
      setErrorModalTitle(t('water.error.max_total_exceeded_title'));
      setErrorModalMessage(errorMessage);
      setShowErrorModal(true);
      // Note: The error will be cleared automatically when the next mutation runs
      // or when the component unmounts. React Query handles this.
    }
  }, [addWaterError, t]);

  // Handle custom input (adds to current total)
  const handleCustomInput = () => {
    // Parse input as if it's in the profile unit
    const cleaned = customInput.trim().replace(/[^0-9.]/g, '');
    const numericValue = parseFloat(cleaned);
    
    if (isNaN(numericValue) || numericValue <= 0) {
      setCustomInputError(t('water.custom_input_error_invalid'));
      return;
    }

    // Convert to ml for validation
    const inputMl = toMl(numericValue, profileWaterUnit);
    
    // Validate input amount is 0-MAX_SINGLE_ADD_ML
    if (inputMl < 0 || inputMl > WATER_LIMITS.MAX_SINGLE_ADD_ML) {
      setCustomInputError(t('water.error.water_too_high'));
      return;
    }
    
    // Check if adding would exceed max total
    // Use totalMl which is already calculated correctly
    const newTotalMl = totalMl + inputMl;
    
    if (newTotalMl > WATER_LIMITS.MAX_TOTAL_ML) {
      setErrorModalTitle(t('water.error.max_total_exceeded_title'));
      setErrorModalMessage(t('water.error.water_too_high'));
      setShowErrorModal(true);
      return;
    }
    
    setCustomInputError('');
    addWater(inputMl, goalMl);
    setCustomInput('');
    setShowCustomModal(false);
  };

  // Handle edit total (set absolute value in profile unit)
  const handleEditTotal = () => {
    const dateString = editTotalDateString || selectedDateString;
    // Always use profile unit
    const unitForEdit = profileWaterUnit;

    // Parse input as if it's in the profile unit
    const cleaned = editTotalInput.trim().replace(/[^0-9.]/g, '');
    const numericValue = parseFloat(cleaned);
    
    if (isNaN(numericValue) || numericValue < 0) {
      setEditTotalError(t('water.edit_total.invalid'));
      return;
    }

    // Convert to ml for validation
    const inputMl = toMl(numericValue, unitForEdit);

    // Validate limits (0-MAX_SINGLE_ADD_ML)
    if (inputMl > WATER_LIMITS.MAX_SINGLE_ADD_ML) {
      setEditTotalError(t('water.error.water_too_high'));
      return;
    }

    setEditTotalError('');
    try {
      // Always convert from profile unit to the row's stored unit before saving
      // Get the row's stored unit (for today, it should match profile, but we need to check)
      const water = dateString === selectedDateString ? todayWater : waterDataMap.get(dateString);
      const rowUnit = (water?.water_unit as WaterUnit) || profileWaterUnit;
      
      // Convert value from profile unit to row's stored unit
      const valueInRowUnit = rowUnit === profileWaterUnit 
        ? numericValue 
        : fromMl(toMl(numericValue, profileWaterUnit), rowUnit);
      
      if (dateString === selectedDateString) {
        setTotal(valueInRowUnit);
      } else {
        setTotalForDate(valueInRowUnit, dateString);
      }
      setEditTotalInput('');
      setEditTotalDateString(null);
      setShowEditTotalModal(false);
    } catch (error: unknown) {
      // Error can be from setTotal/setTotalForDate mutations or validation
      // Extract message safely for user display
      const errorMessage = error instanceof Error ? error.message : t('water.edit_total.error');
      setEditTotalError(errorMessage);
    }
  };

  // Settings panel state
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settingsWaterUnit, setSettingsWaterUnit] = useState<WaterUnit>(profileWaterUnit);
  const [settingsGoal, setSettingsGoal] = useState(goal.toString()); // Uses effective goal (with defaults)
  const [settingsGoalError, setSettingsGoalError] = useState('');

  // Helper function to format value for input display based on unit
  const formatValueForInput = (value: number, unit: WaterUnit): string => {
    switch (unit) {
      case 'ml':
        // ML: whole numbers only (0 decimals)
        return Math.round(value).toString();
      case 'floz':
        // floz: 1 decimal max
        const flozValue = Math.round(value * 10) / 10;
        return flozValue % 1 === 0 ? flozValue.toString() : flozValue.toFixed(1).replace(/\.?0+$/, '');
      case 'cup':
        // cups: 2 decimals max
        const cupValue = Math.round(value * 100) / 100;
        return cupValue % 1 === 0 ? cupValue.toString() : cupValue.toFixed(2).replace(/\.?0+$/, '');
      default:
        return value.toString();
    }
  };

  // Helper function to validate and format input text based on unit
  const validateAndFormatInput = (text: string, unit: WaterUnit): string => {
    // Remove any non-numeric characters except decimal point
    let cleaned = text.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit decimal places based on unit
    if (cleaned.includes('.')) {
      const decimalIndex = cleaned.indexOf('.');
      const decimalPart = cleaned.substring(decimalIndex + 1);
      
      switch (unit) {
        case 'ml':
          // ML: no decimals allowed - remove decimal point and everything after
          cleaned = cleaned.substring(0, decimalIndex);
          break;
        case 'floz':
          // floz: max 1 decimal
          if (decimalPart.length > 1) {
            cleaned = cleaned.substring(0, decimalIndex + 2);
          }
          break;
        case 'cup':
          // cups: max 2 decimals
          if (decimalPart.length > 2) {
            cleaned = cleaned.substring(0, decimalIndex + 3);
          }
          break;
      }
    }
    
    return cleaned;
  };

  // Initialize settings when panel opens
  // Always use profile's water_unit and water_goal_ml (not from selected date)
  const handleOpenSettings = () => {
    // Always use profile's water_unit (not activeWaterUnit which can be from past dates)
    const profileWaterUnit = (profile?.water_unit as WaterUnit) || (authProfile?.water_unit as WaterUnit) || 'ml';
    const profileGoalMl = profile?.water_goal_ml || authProfile?.water_goal_ml || null;
    const profileGoalInUnit = profileGoalMl ? fromMl(profileGoalMl, profileWaterUnit) : null;
    const profileEffectiveGoal = getEffectiveGoal(profileWaterUnit, profileGoalInUnit);
    
    setSettingsWaterUnit(profileWaterUnit);
    // Format the value for display based on unit
    setSettingsGoal(formatValueForInput(profileEffectiveGoal.goalInUnit, profileWaterUnit));
    setSettingsGoalError('');
    setShowSettingsPanel(true);
  };


  // Handle save settings
  const handleSaveSettings = () => {
    const goalValue = parseFloat(settingsGoal);
    
    if (isNaN(goalValue) || goalValue <= 0) {
      setSettingsGoalError(t('water.settings.goal_required'));
      return;
    }

    // Format the value before saving to ensure proper decimal precision
    const formattedValue = parseFloat(formatValueForInput(goalValue, settingsWaterUnit));
    
    // Convert to ml for validation
    const goalMl = toMl(formattedValue, settingsWaterUnit);

    // Validate goal limits
    if (goalMl < WATER_LIMITS.MIN_GOAL_ML) {
      setSettingsGoalError(t('water.error.goal_too_low'));
      return;
    }
    if (goalMl > WATER_LIMITS.MAX_GOAL_ML) {
      setSettingsGoalError(t('water.error.water_too_high'));
      return;
    }

    setSettingsGoalError('');
    try {
      updateUnitAndGoal(settingsWaterUnit, formattedValue);
      setShowSettingsPanel(false);
    } catch (error: unknown) {
      // Error can be from updateUnitAndGoal mutation or validation
      // Extract message safely for user display
      const errorMessage = error instanceof Error ? error.message : t('water.set_goal.error');
      setSettingsGoalError(errorMessage);
    }
  };


  // Prepare history data for chart (last 7 calendar days including today)
  // Generate exactly 7 days, ordered oldest to newest (left to right)
  // Use the same date logic as the main "Today's Water" card (local date, not UTC)
  const last7Days = getLastNDays(selectedDate, 7);

  // Create a map of existing water data by date for quick lookup
  // IMPORTANT: Include todayWater in the map so today's value is always included
  const waterDataMap = new Map<string, WaterDaily>();
  // First add today's water (from the same source as the droplet card)
  if (todayWater) {
    waterDataMap.set(todayWater.date, todayWater);
  }
  // Then add history entries
  history.forEach((water) => {
    waterDataMap.set(water.date, water);
  });

  // Build chart data for last 7 days
  // Chart uses ml internally for consistent scaling, but displays values in profile's unit
  const historyData = last7Days.map((dateString) => {
    const water = waterDataMap.get(dateString);
    if (water) {
      const waterUnit = (water.water_unit as WaterUnit) || 'ml';
      const totalMl = toMl(water.total || 0, waterUnit);
      const totalInProfileUnit = fromMl(totalMl, profileWaterUnit);
      const displayValue = formatWaterValue(totalInProfileUnit, profileWaterUnit);
      return {
        date: dateString,
        value: totalMl, // Use ml for chart calculations (consistent scale)
        displayValue, // Formatted string for label in profile's unit
      };
    } else {
      // No data for this day - show 0 but still render bar
      return {
        date: dateString,
        value: 0,
        displayValue: formatWaterValue(0, profileWaterUnit),
      };
    }
  });

  const minAllowedDateString = getDateString(minDate);

  const openEditTotalModalForDate = useCallback(
    (dateString: string) => {
      // Guard against dates before signup/min allowed date (chart may still show placeholders)
      if (dateString < minAllowedDateString) {
        return;
      }

      const water = waterDataMap.get(dateString);
      // Always use profile unit, but convert the stored total from its unit to profile unit
      const totalInProfileUnit = water?.total 
        ? fromMl(toMl(water.total, water.water_unit as WaterUnit), profileWaterUnit)
        : 0;

      setEditTotalDateString(dateString);
      setEditTotalWaterUnit(profileWaterUnit);
      setEditTotalInput(formatValueForInput(totalInProfileUnit, profileWaterUnit));
      setEditTotalError('');
      setShowEditTotalModal(true);
    },
    [profileWaterUnit, minAllowedDateString, waterDataMap]
  );

  // Calculate dynamic y-axis max: align goal line with bars when equal (no extra padding)
  const maxDailyValue = Math.max(...historyData.map(d => d.value), 0);
  const chartMax = Math.max(maxDailyValue, chartGoalMl, 1);

  // Calculate goal display value in profile's unit for reference line label (always use profile unit)
  const chartGoalInProfileUnit = fromMl(chartGoalMl, profileWaterUnit);
  const goalDisplayValue = t('water.chart.goal_label', { 
    value: formatWaterValue(chartGoalInProfileUnit, profileWaterUnit)
  });

  if (!user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  // Format date for display (same logic as index.tsx)
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const currentYear = todayDate.getFullYear();
  const selectedYear = selectedDate.getFullYear();
  const isCurrentYear = selectedYear === currentYear;
  const dateOptions: Intl.DateTimeFormatOptions = {
    ...(isToday || selectedDate.getTime() === yesterday.getTime() ? {} : { weekday: 'short' }),
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  };
  const formattedDate = selectedDate.toLocaleDateString('en-US', dateOptions);
  const dateText = isToday
    ? `${t('common.today')}, ${formattedDate}`
    : selectedDate.getTime() === yesterday.getTime()
    ? `${t('common.yesterday')}, ${formattedDate}`
    : formattedDate;

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <CollapsibleModuleHeader
        dateText={dateText}
        rightAvatarUri={effectiveProfile?.avatar_url ?? undefined}
        preferredName={effectiveProfile?.first_name ?? undefined}
        rightAction={
          <DatePickerButton
            selectedDate={selectedDate}
            onDateSelect={navigateWithDate}
            today={today}
            module="water"
            minimumDate={minDate}
            maximumDate={today}
          />
        }
        goBackOneDay={
          canGoBack
            ? () => {
                navigateWithDate(addDays(selectedDate, -1));
              }
            : undefined
        }
        goForwardOneDay={() => {
          if (!isToday) {
            navigateWithDate(addDays(selectedDate, 1));
          }
        }}
        isToday={isToday}
        module="water"
      >
        {/* Desktop Container for Header and Content */}
        <DesktopPageContainer>

          {/* Today's Water Section - Card */}
          <View style={[styles.card, { backgroundColor: colors.card, ...Shadows.md }]}>
            <SummaryCardHeader
              titleKey="home.summary.title_other"
              icon="drop.fill"
              module="water"
              isLoading={isLoading}
              onPressSettings={handleOpenSettings}
              style={{
                paddingHorizontal: 0,
                borderBottomWidth: 1,
                borderBottomColor: colors.separator,
              }}
            />

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : (
            <>
              {/* Main content: Edit Total + Custom buttons (left) + Droplet (center) */}
              <View style={styles.waterDisplay}>
                {/* Water Drop Gauge - centered */}
                <View style={styles.dropletContainer}>
                  <Pressable
                    onPress={openEditTotalModal}
                    disabled={isAddingWater || isLoading}
                    hitSlop={Spacing.sm}
                    {...getButtonAccessibilityProps(t('water.edit_total.button'))}
                  >
                    <WaterDropGauge
                      totalMl={totalMl}
                      goalMl={goalMl}
                      unitPreference={profileWaterUnit}
                      size="large"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Quick Add Controls - single horizontal row under droplet (4 presets only) */}
              <View style={styles.quickAddControlsRowContainer}>
                <View style={styles.quickAddControlsRow}>
                  {/* 4 Preset Controls - icon + label, no card background */}
                  {/* Icon mapping based on preset index (0-3), same across all units */}
                  {presets.map((preset, index) => {
                    const displayAmount = formatWaterValue(preset.amount, preset.unit);
                    
                    // Icon variant map: same 4 container types across all units
                    // Index 0: glass (small glass) - smallest container
                    // Index 1: cup (standard cup) - base size container
                    // Index 2: bottleSmall (small bottle) - larger container
                    // Index 3: bottleLarge (large bottle) - largest container
                    const iconVariants: ('glass' | 'cup' | 'bottleSmall' | 'bottleLarge')[] = [
                      'glass',      // Index 0: smallest
                      'cup',        // Index 1: base
                      'bottleSmall', // Index 2: larger
                      'bottleLarge', // Index 3: largest
                    ];
                    
                    // Scale map: different sizes to show container volume differences
                    // Index 0: 0.5x (half the height of base - ~50% of 250ml icon)
                    // Index 1: 1.0x (base size - 250ml stays the same)
                    // Index 2: 1.2x (20% larger than base - 500ml)
                    // Index 3: 1.45x (45% larger than base - 1000ml, slightly reduced to prevent bottom cutoff)
                    const BASE_SCALE = 1.0;
                    const scaleMultipliers = [
                      0.5,   // Index 0: smallest (50ml) - half height of base
                      0.75,  // Index 1: base (250ml) - 25% smaller
                      1.2,   // Index 2: larger (500ml) - 20% bigger than base
                      1.45,  // Index 3: largest (1000ml) - 45% bigger than base (reduced from 1.5 to prevent bottom cutoff)
                    ];
                    
                    const iconVariant = iconVariants[index] || 'cup';
                    const iconScale = scaleMultipliers[index] || BASE_SCALE;
                    
                    const isAnimating = animatingChipId === preset.id;
                    
                    return (
                      <Pressable
                        key={preset.id}
                        style={({ pressed }) => [
                          styles.quickAddControl,
                          pressed && styles.quickAddControlPressed,
                        ]}
                        onPress={() => handleQuickAddPreset(preset.amount, preset.unit, preset.id)}
                        disabled={isAddingWater}
                        hitSlop={Spacing.sm} // Ensure minimum 44x44 touch target
                        {...getButtonAccessibilityProps(
                          t('water.quick_presets.add', { amount: displayAmount, label: t(preset.labelKey) })
                        )}
                      >
                        {({ pressed }) => (
                          <View style={styles.quickAddControlContent}>
                            {/* Icon - large, centered with subtle highlight on press */}
                            {/* Icon container uses fixed size; icon scales internally */}
                            <View style={styles.quickAddIconContainer}>
                              {pressed && (
                                <View 
                                  style={[
                                    styles.quickAddIconHighlight,
                                    { backgroundColor: colors.tint + '20' } // 20% opacity tint
                                  ]} 
                                />
                              )}
                              {/* Tiny per-icon baseline nudge: 1000ml icon sits a touch lower due to its path geometry. */}
                              <View
                                style={
                                  index === 3
                                    ? { transform: [{ translateY: BOTTLE_LARGE_BASELINE_NUDGE_Y }] }
                                    : undefined
                                }
                              >
                                <AnimatedWaterIcon
                                  variant={iconVariant}
                                  isAnimating={isAnimating}
                                  size={QUICK_ADD_ICON_SIZE}
                                  baseScale={iconScale} // Apply size multiplier
                                  color={colors.tint}
                                />
                              </View>
                            </View>
                            {/* Label text - directly under icon */}
                            <ThemedText
                              style={[
                                styles.quickAddControlText,
                                { color: pressed ? colors.tint : colors.text }
                              ]}
                              numberOfLines={1}
                            >
                              {displayAmount}
                            </ThemedText>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}

                  {/* Custom (5th button) - opens the custom modal, matches preset style */}
                  <Pressable
                    key="water-custom"
                    style={({ pressed }) => [
                      styles.quickAddControl,
                      pressed && styles.quickAddControlPressed,
                    ]}
                    onPress={() => setShowCustomModal(true)}
                    disabled={isAddingWater}
                    hitSlop={Spacing.sm}
                    {...getButtonAccessibilityProps(t('water.custom_button'))}
                  >
                    {({ pressed }) => (
                      <View style={styles.quickAddControlContent}>
                        <View style={styles.quickAddIconContainer}>
                          {pressed && (
                            <View
                              style={[
                                styles.quickAddIconHighlight,
                                { backgroundColor: colors.tint + '20' },
                              ]}
                            />
                          )}
                          <View
                            style={styles.quickAddCustomIconBox}
                          >
                            <IconSymbol
                              name="drop.fill"
                              size={Math.round(QUICK_ADD_ICON_SIZE * 0.8)}
                              color={waterTheme.accent}
                            />
                            <View
                              style={styles.quickAddCustomPlusOverlay}
                            >
                              <IconSymbol
                                name="plus"
                                size={Math.round(FontSize.sm * 0.9)}
                                color={colors.tint}
                              />
                            </View>
                          </View>
                        </View>
                        <ThemedText
                          style={[
                            styles.quickAddControlText,
                            { color: pressed ? colors.tint : colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {t('water.quick_presets.custom')}
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>

        {/* History Chart Section - Card */}
        <View style={[styles.card, { backgroundColor: colors.card, ...Shadows.md }]}>
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
              {t('water.history_title')}
            </ThemedText>
            <View style={[styles.cardDivider, { backgroundColor: colors.separator }]} />
          </View>
          <View style={styles.chartWrapper}>
            <BarChart
              data={historyData}
              maxValue={chartMax}
              goalValue={chartGoalMl}
              goalDisplayValue={goalDisplayValue}
              selectedDate={selectedDateString}
              todayDateString={getDateString(today)}
              colorScale={() => accentColor}
              onBarPress={openEditTotalModalForDate}
              height={Platform.OS === 'web' ? 240 : 210}
              showLabels={true}
              emptyMessage={t('water.chart.empty_message')}
            />
          </View>
        </View>
        </DesktopPageContainer>
      </CollapsibleModuleHeader>

      {/* Custom Input Modal */}
      <Modal
        visible={showCustomModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={{ color: colors.text }}>
                {t('water.custom_input')}
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowCustomModal(false)}
                style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                {...getButtonAccessibilityProps(t('common.close'))}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                {t('water.custom_input_label', { unit: profileWaterUnit === 'floz' ? 'fl oz' : profileWaterUnit === 'cup' ? 'cups' : 'ml' })}
              </ThemedText>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: customInputError ? colors.error : colors.border,
                  },
                ]}
                value={customInput}
                onChangeText={(text) => {
                  // Validate and format input based on unit's decimal rules
                  const formatted = validateAndFormatInput(text, profileWaterUnit);
                  setCustomInput(formatted);
                  setCustomInputError('');
                }}
                placeholder={profileWaterUnit === 'floz' ? '20' : profileWaterUnit === 'cup' ? '8' : '500'}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                autoFocus
              />
              {customInputError && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {customInputError}
                </ThemedText>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowCustomModal(false);
                    setCustomInput('');
                    setCustomInputError('');
                  }}
                  {...getButtonAccessibilityProps(t('common.cancel'))}
                >
                  <ThemedText style={{ color: colors.text }}>{t('common.cancel')}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.tint }]}
                  onPress={handleCustomInput}
                  disabled={isAddingWater}
                  {...getButtonAccessibilityProps(t('common.add'))}
                >
                  {isAddingWater ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <ThemedText style={[styles.saveButtonText, { color: colors.textInverse }]}>
                      {t('common.add')}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Total Modal */}
      <Modal
        visible={showEditTotalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowEditTotalModal(false);
          setEditTotalDateString(null);
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={{ color: colors.text }}>
                {t('water.edit_total.title')}
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setShowEditTotalModal(false);
                  setEditTotalDateString(null);
                }}
                style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                {...getButtonAccessibilityProps(t('common.close'))}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                {t('water.edit_total.label', { unit: editTotalWaterUnit === 'floz' ? 'fl oz' : editTotalWaterUnit === 'cup' ? 'cups' : 'ml' })}
              </ThemedText>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: editTotalError ? colors.error : colors.border,
                  },
                ]}
                value={editTotalInput}
                onChangeText={(text) => {
                  // Validate and format input based on unit's decimal rules
                  const formatted = validateAndFormatInput(text, profileWaterUnit);
                  setEditTotalInput(formatted);
                  setEditTotalError('');
                }}
                placeholder={editTotalWaterUnit === 'floz' ? '64' : editTotalWaterUnit === 'cup' ? '8' : '2000'}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                autoFocus
              />
              {editTotalError && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {editTotalError}
                </ThemedText>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowEditTotalModal(false);
                    setEditTotalInput('');
                    setEditTotalError('');
                    setEditTotalDateString(null);
                  }}
                  {...getButtonAccessibilityProps(t('common.cancel'))}
                >
                  <ThemedText style={{ color: colors.text }}>{t('common.cancel')}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.tint }]}
                  onPress={handleEditTotal}
                  disabled={isSettingTotal}
                  {...getButtonAccessibilityProps(t('common.save'))}
                >
                  {isSettingTotal ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <ThemedText style={[styles.saveButtonText, { color: colors.textInverse }]}>
                      {t('common.save')}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Panel Modal */}
      <Modal
        visible={showSettingsPanel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettingsPanel(false)}
      >
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <ThemedText type="title" style={{ color: colors.text }}>
                  {t('water.settings.title')}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowSettingsPanel(false)}
                  style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                  {...getButtonAccessibilityProps(t('common.close'))}
                >
                  <IconSymbol name="xmark" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {/* Water Units Row */}
                <View style={styles.settingsRow}>
                  <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                    {t('water.settings.water_units')}
                  </ThemedText>
                  <View style={styles.dropdownContainer}>
                    <TouchableOpacity
                      style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => {
                        // Cycle through units: ml -> floz -> cup -> ml
                        const units: WaterUnit[] = ['ml', 'floz', 'cup'];
                        const currentIndex = units.indexOf(settingsWaterUnit);
                        const nextIndex = (currentIndex + 1) % units.length;
                        const newUnit = units[nextIndex];
                        
                        // Convert goal from current unit to new unit
                        const currentGoalValue = parseFloat(settingsGoal);
                        if (!isNaN(currentGoalValue) && currentGoalValue > 0) {
                          // Convert from current unit to ml, then to new unit
                          const goalMl = toMl(currentGoalValue, settingsWaterUnit);
                          const convertedGoal = fromMl(goalMl, newUnit);
                          // Format based on new unit's decimal rules
                          setSettingsGoal(formatValueForInput(convertedGoal, newUnit));
                        }
                        
                        setSettingsWaterUnit(newUnit);
                      }}
                      {...getButtonAccessibilityProps(t('water.settings.water_units'))}
                    >
                      <ThemedText style={[styles.dropdownText, { color: colors.text }]}>
                        {settingsWaterUnit === 'ml' ? t('water.ml') : settingsWaterUnit === 'floz' ? t('water.floz') : t('water.cup')}
                      </ThemedText>
                      <IconSymbol name="chevron.down" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Goal Row */}
                <View style={styles.settingsRow}>
                  <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                    {t('water.settings.goal')} ({settingsWaterUnit === 'ml' ? t('water.ml') : settingsWaterUnit === 'floz' ? t('water.floz') : t('water.cup')})
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.formInput,
                      {
                        backgroundColor: colors.card,
                        color: colors.text,
                        borderColor: settingsGoalError ? colors.error : colors.border,
                      },
                    ]}
                    value={settingsGoal}
                    onChangeText={(text) => {
                      // Validate and format input based on unit's decimal rules
                      const formatted = validateAndFormatInput(text, settingsWaterUnit);
                      setSettingsGoal(formatted);
                      setSettingsGoalError('');
                    }}
                    placeholder={settingsWaterUnit === 'floz' ? '64' : settingsWaterUnit === 'cup' ? '8' : '2000'}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                  {settingsGoalError && (
                    <ThemedText style={[styles.errorText, { color: colors.error }]}>
                      {settingsGoalError}
                    </ThemedText>
                  )}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                    onPress={() => {
                      setShowSettingsPanel(false);
                      setSettingsGoalError('');
                    }}
                    {...getButtonAccessibilityProps(t('water.settings.cancel'))}
                  >
                    <ThemedText style={{ color: colors.text }}>{t('water.settings.cancel')}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.tint }]}
                    onPress={handleSaveSettings}
                    disabled={isUpdatingUnitAndGoal}
                    {...getButtonAccessibilityProps(t('water.settings.save'))}
                  >
                    {isUpdatingUnitAndGoal ? (
                      <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                      <ThemedText style={[styles.saveButtonText, { color: colors.textInverse }]}>
                        {t('water.settings.save')}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

      {/* Error Modal */}
      <ConfirmModal
        visible={showErrorModal}
        title={errorModalTitle}
        message={errorModalMessage}
        confirmText={t('common.ok')}
        cancelText={null}
        onConfirm={() => setShowErrorModal(false)}
        onCancel={() => setShowErrorModal(false)}
      />
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
  scrollContentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    ...Platform.select({
      web: {
        minHeight: '100%',
      },
    }),
  },
  scrollContent: {
    width: '100%',
    paddingTop: Spacing.none, // 0px - minimal gap between logo and greeting
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.screenPadding,
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 0, // DesktopPageContainer handles horizontal padding
    }),
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg, // Match Exercise/Meds for consistent left margin
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    width: '100%',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  gearButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...getMinTouchTargetStyle(),
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  cardHeader: {
    marginBottom: Spacing.sm,
  },
  cardDivider: {
    height: 1,
    width: '100%',
  },
  chartWrapper: {
    marginTop: Spacing.sm, // Spacing below divider
    overflow: 'hidden', // Prevent chart labels from rendering into the header area
    paddingTop: Spacing.sm, // Ensure chart stays below divider visually
  },
  summary: {
    fontSize: FontSize.sm,
  },
  loadingIndicator: {
    marginVertical: Spacing.sm,
  },
  loadingContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  waterDisplay: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    minHeight: 280, // Ensure enough space for droplet
  },
  customButton: {
    paddingHorizontal: Math.round(Spacing.xs * 0.7), // Reduced by 30%
    paddingVertical: Math.round((Spacing.xs / 4) * 0.7), // Reduced by 30%
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...getMinTouchTargetStyle(),
  },
  customButtonContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Math.round((Spacing.xs / 4) * 0.7), // Reduced by 30% to match button size
  },
  customButtonIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0, // No gap - icons nearly touching, spacing handled by marginLeft on droplet
    padding: 0,
    margin: 0,
  },
  customButtonText: {
    fontSize: Math.round(FontSize.xs * 0.9), // Slightly reduced to match 30% smaller button
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    lineHeight: Math.round(FontSize.xs * 0.9 * 1.5), // Use theme line height
  },
  dropletContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  quickAddControlsRowContainer: {
    width: '100%',
    paddingTop: Spacing.xs, // Small gap from droplet
    paddingBottom: Spacing.xs, // Small bottom padding
  },
  quickAddControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Align from top - bottom alignment handled inside each preset
    gap: Math.round(Spacing.xs / 2), // Tighter spacing so 5 buttons fit on one row
    paddingHorizontal: 0, // Remove extra horizontal padding so 5 buttons fit
  },
  quickAddControl: {
    flex: 1, // Each control takes equal space (4 controls fill the row)
    minWidth: 0, // Allow flex to shrink below content size
    alignItems: 'center',
    justifyContent: 'flex-start', // Column starts from top
    // No background, no border - transparent by default
  },
  quickAddControlPressed: {
    // Subtle press feedback - no visible change, handled by icon animation
  },
  quickAddControlContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start', // Column layout: icon area at top, label below
    width: '100%', // Full width of control
  },
  quickAddIconContainer: {
    // Fixed height icon area - accommodates tallest icon (base QUICK_ADD_ICON_SIZE * max scale ~1.45, plus press pulse)
    // Old: 80dp for 48dp icons. Increase by ~20% to avoid clipping after bumping icon size.
    height: Math.round((Spacing['6xl'] + Spacing.lg) * 1.2), // ~96dp - all icons align at bottom
    width: '100%', // Full width of control
    justifyContent: 'flex-end', // Bottom-align icons within this area
    alignItems: 'center', // Center horizontally
    overflow: 'hidden', // Prevent icons from exceeding bounds
    padding: 0,
    margin: 0,
    position: 'relative', // For highlight positioning
  },
  quickAddIconHighlight: {
    position: 'absolute',
    width: Math.round((Spacing['6xl'] + Spacing.lg + Spacing.sm) * 1.2), // Slightly larger than container for subtle glow
    height: Math.round((Spacing['6xl'] + Spacing.lg + Spacing.sm) * 1.2),
    borderRadius: Math.round((Spacing['6xl'] + Spacing.lg + Spacing.sm) * 1.2) / 2, // Circular highlight
    opacity: 0.3,
  },
  quickAddControlText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.5, // Use theme line height
    marginTop: Spacing.xs, // Fixed gap between icon area and label - prevents overlap
    marginBottom: 0, // No bottom margin
    padding: 0, // No padding
  },
  quickAddCustomIconBox: {
    width: QUICK_ADD_ICON_SIZE,
    height: QUICK_ADD_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  quickAddCustomPlusOverlay: {
    position: 'absolute',
    // Move closer to the droplet so it overlaps more (visual “custom add” mark)
    top: CUSTOM_PLUS_TOP,
    left: CUSTOM_PLUS_LEFT,
  },
  stats: {
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.xs / 2,
  },
  primaryText: {
    fontSize: FontSize.xl,
    fontWeight: '600',
  },
  secondaryText: {
    fontSize: FontSize.sm,
  },
  formHelper: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    maxHeight: '85%',
    width: '100%',
    ...Platform.select({
      web: {
        maxWidth: Layout.desktopMaxWidth,
        alignSelf: 'center',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...getMinTouchTargetStyle(),
  },
  modalBody: {
    gap: Spacing.lg,
  },
  formLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  formInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.md,
  },
  errorText: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    // backgroundColor set inline
  },
  saveButtonText: {
    fontWeight: FontWeight.semibold,
  },
  settingsRow: {
    marginBottom: Spacing.md,
  },
  dropdownContainer: {
    marginTop: Spacing.xs,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...getMinTouchTargetStyle(),
  },
  dropdownText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
});

