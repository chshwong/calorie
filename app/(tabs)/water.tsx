import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable, ScrollView, Modal, TextInput, Platform, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { DateHeader } from '@/components/date-header';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { WaterDropGauge } from '@/components/water/water-drop-gauge';
import { BarChart } from '@/components/charts/bar-chart';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Shadows, Layout, FontSize, FontWeight, ModuleThemes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedDate } from '@/hooks/use-selected-date';
import { useWaterDaily } from '@/hooks/use-water-logs';
import type { WaterDaily } from '@/lib/services/waterLogs';
import { useUserProfile } from '@/hooks/use-user-profile';
import { formatWaterDisplay, formatWaterValue, parseWaterInput, toMl, fromMl, WaterUnit, getEffectiveGoal } from '@/utils/waterUnits';
import { useWaterQuickAddPresets } from '@/hooks/use-water-quick-add-presets';
import { AnimatedWaterIcon } from '@/components/water/animated-water-icon';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';


export default function WaterScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Use shared date hook
  const {
    selectedDate,
    setSelectedDate,
    selectedDateString,
    isToday,
    today,
    calendarViewMonth,
    setCalendarViewMonth,
  } = useSelectedDate();

  // Get profile for water unit preference
  const { data: profile } = useUserProfile();

  // Get water data (last 14 days for history, using selected date)
  const { todayWater, history, isLoading, addWater, setGoal, setTotal, updateUnitAndGoal, isAddingWater, isSettingGoal, isSettingTotal, isUpdatingUnitAndGoal, addWaterError } = useWaterDaily({ 
    daysBack: 14,
    targetDateString: selectedDateString,
  });

  // Determine active water unit: for today use profile, for past dates use water_daily.water_unit
  const activeWaterUnit: WaterUnit = isToday 
    ? ((profile?.water_unit as WaterUnit) || 'ml')
    : ((todayWater?.water_unit as WaterUnit) || (profile?.water_unit as WaterUnit) || 'ml');

  // Get values in active unit
  const total = todayWater?.total || 0;
  
  // Get effective goal (with fallback to defaults)
  const storedGoalInUnit = todayWater?.goal || (todayWater?.goal_ml ? fromMl(todayWater.goal_ml, activeWaterUnit) : null);
  const effectiveGoal = getEffectiveGoal(activeWaterUnit, storedGoalInUnit);
  const goal = effectiveGoal.goalInUnit;
  const goalMl = effectiveGoal.goalMl; // Canonical ml for calculations

  // Get quick-add presets
  const { presets, activeWaterUnit: presetsUnit } = useWaterQuickAddPresets();
  
  // Animation state for quick add chips
  const [animatingChipId, setAnimatingChipId] = useState<string | null>(null);

  // Format display (for secondary/cups line)
  // Convert total to ml using the row's water_unit, not activeWaterUnit
  const totalMl = todayWater 
    ? toMl(total, todayWater.water_unit as WaterUnit)
    : 0;
  const display = formatWaterDisplay(totalMl, activeWaterUnit === 'floz' ? 'imperial' : 'metric');

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
  
  // Error modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  // Handle quick-add preset press
  const handleQuickAddPreset = useCallback((amount: number, unit: WaterUnit, presetId: string) => {
    if (!user?.id) return;
    // Convert amount from preset unit to ml for internal storage
    const deltaMl = toMl(amount, unit);
    
    // Check if adding would exceed 6000ml total
    // Use totalMl which is already calculated correctly from todayWater.water_unit
    const newTotalMl = totalMl + deltaMl;
    
    if (newTotalMl > 6000) {
      setErrorModalTitle(t('water.error.max_total_exceeded_title'));
      setErrorModalMessage(t('water.error.max_total_exceeded_message', { max: 6000 }));
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
        : t('water.error.max_total_exceeded_message', { max: 6000 });
      setErrorModalTitle(t('water.error.max_total_exceeded_title'));
      setErrorModalMessage(errorMessage);
      setShowErrorModal(true);
      // Note: The error will be cleared automatically when the next mutation runs
      // or when the component unmounts. React Query handles this.
    }
  }, [addWaterError, t]);

  // Handle custom input (adds to current total)
  const handleCustomInput = () => {
    // Parse input as if it's in the active unit
    const cleaned = customInput.trim().replace(/[^0-9.]/g, '');
    const numericValue = parseFloat(cleaned);
    
    if (isNaN(numericValue) || numericValue <= 0) {
      setCustomInputError(t('water.custom_input_error_invalid'));
      return;
    }

    // Convert to ml for validation
    const inputMl = toMl(numericValue, activeWaterUnit);
    
    // Validate input amount is 0-5000ml
    if (inputMl < 0 || inputMl > 5000) {
      // Convert max to user's active unit for friendly error message
      const maxInActiveUnit = fromMl(5000, activeWaterUnit);
      const unitLabel = activeWaterUnit === 'floz' ? t('water.floz') : activeWaterUnit === 'cup' ? t('water.cup') : t('water.ml');
      setCustomInputError(t('water.custom_input_error_range', { max: Math.round(maxInActiveUnit), unit: unitLabel }));
      return;
    }
    
    // Check if adding would exceed 6000ml total
    // Use totalMl which is already calculated correctly
    const newTotalMl = totalMl + inputMl;
    
    if (newTotalMl > 6000) {
      setCustomInputError(t('water.error.max_total_exceeded_message', { max: 6000 }));
      return;
    }
    
    setCustomInputError('');
    addWater(inputMl, goalMl);
    setCustomInput('');
    setShowCustomModal(false);
  };

  // Handle edit total (set absolute value in active unit)
  const handleEditTotal = () => {
    // Parse input as if it's in the active unit
    const cleaned = editTotalInput.trim().replace(/[^0-9.]/g, '');
    const numericValue = parseFloat(cleaned);
    
    if (isNaN(numericValue) || numericValue < 0) {
      setEditTotalError(t('water.edit_total.invalid'));
      return;
    }

    // Convert to ml for validation
    const inputMl = toMl(numericValue, activeWaterUnit);

    // Validate limits (0-5000ml)
    if (inputMl > 5000) {
      setEditTotalError(t('water.edit_total.max_limit', { max: 5000 }));
      return;
    }

    setEditTotalError('');
    try {
      // setTotal expects value in the row's water_unit
      setTotal(numericValue);
      setEditTotalInput('');
      setShowEditTotalModal(false);
    } catch (error: any) {
      setEditTotalError(error.message || t('water.edit_total.error'));
    }
  };

  // Settings panel state
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settingsWaterUnit, setSettingsWaterUnit] = useState<WaterUnit>(activeWaterUnit);
  const [settingsGoal, setSettingsGoal] = useState(goal.toString()); // Uses effective goal (with defaults)
  const [settingsGoalError, setSettingsGoalError] = useState('');

  // Initialize settings when panel opens
  const handleOpenSettings = () => {
    setSettingsWaterUnit(activeWaterUnit);
    setSettingsGoal(goal.toString());
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

    // Convert to ml for validation
    const goalMl = toMl(goalValue, settingsWaterUnit);

    // Validate goal limits (480-5000ml)
    if (goalMl < 480 || goalMl > 5000) {
      setSettingsGoalError(t('water.settings.goal_out_of_range', { min: 480, max: 5000 }));
      return;
    }

    setSettingsGoalError('');
    try {
      updateUnitAndGoal(settingsWaterUnit, goalValue);
      setShowSettingsPanel(false);
    } catch (error: any) {
      setSettingsGoalError(error.message || t('water.set_goal.error'));
    }
  };


  // Prepare history data for chart (last 7 calendar days including today)
  // Generate exactly 7 days, ordered oldest to newest (left to right)
  const last7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    last7Days.push(dateString);
  }

  // Create a map of existing water data by date for quick lookup
  const waterDataMap = new Map<string, WaterDaily>();
  history.forEach((water) => {
    waterDataMap.set(water.date, water);
  });

  // Build chart data for last 7 days
  // Chart uses ml internally for consistent scaling, but displays values in active unit
  const historyData = last7Days.map((dateString) => {
    const water = waterDataMap.get(dateString);
    if (water) {
      const waterUnit = (water.water_unit as WaterUnit) || 'ml';
      const totalMl = toMl(water.total || 0, waterUnit);
      const totalInActiveUnit = fromMl(totalMl, activeWaterUnit);
      const displayValue = formatWaterValue(totalInActiveUnit, activeWaterUnit);
      return {
        date: dateString,
        value: totalMl, // Use ml for chart calculations (consistent scale)
        displayValue, // Formatted string for label in active unit
      };
    } else {
      // No data for this day - show 0 but still render bar
      return {
        date: dateString,
        value: 0,
        displayValue: formatWaterValue(0, activeWaterUnit),
      };
    }
  });

  // Calculate goal display value in active unit for reference line label
  const goalInActiveUnit = fromMl(goalMl, activeWaterUnit);
  const goalDisplayValue = t('water.chart.goal_label', { 
    value: formatWaterValue(goalInActiveUnit, activeWaterUnit)
  });

  if (!user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Layout.screenPadding + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Desktop Container for Header and Content */}
        <DesktopPageContainer>
          {/* Date Header */}
          <DateHeader
          showGreeting={true}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedDateString={selectedDateString}
          isToday={isToday}
          getDisplayDate={(t) => {
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            const yesterday = new Date(todayDate);
            yesterday.setDate(yesterday.getDate() - 1);
            const formattedDate = selectedDate.toLocaleDateString('en-US', {
              ...(selectedDate.getTime() === todayDate.getTime() || selectedDate.getTime() === yesterday.getTime() ? {} : { weekday: 'short' }),
              month: 'short',
              day: 'numeric',
            });
            if (selectedDate.getTime() === todayDate.getTime()) {
              return `${t('common.today')}, ${formattedDate}`;
            } else if (selectedDate.getTime() === yesterday.getTime()) {
              return `${t('common.yesterday')}, ${formattedDate}`;
            }
            return formattedDate;
          }}
          goBackOneDay={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() - 1);
            setSelectedDate(newDate);
          }}
          goForwardOneDay={() => {
            if (!isToday) {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate);
            }
          }}
          calendarViewMonth={calendarViewMonth}
          setCalendarViewMonth={setCalendarViewMonth}
          today={today}
        />

        {/* Today's Water Section - Card */}
        <View style={[styles.card, { backgroundColor: colors.card, ...Shadows.md }]}>
          <View style={[styles.cardHeader, { borderBottomColor: colors.separator }]}>
            <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
              {isToday ? t('water.today_title') : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </ThemedText>
            <View style={styles.headerRight}>
              {isLoading && (
                <ActivityIndicator size="small" color={colors.tint} style={styles.loadingIndicator} />
              )}
              {isToday && (
                <TouchableOpacity
                  onPress={handleOpenSettings}
                  style={[styles.gearButton, { backgroundColor: colors.backgroundSecondary }]}
                  {...getButtonAccessibilityProps(t('water.settings.title'))}
                >
                  <IconSymbol name="gearshape" size={FontSize.lg} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : (
            <>
              {/* Main content: Edit Total + Custom buttons (left) + Droplet (center) */}
              <View style={styles.waterDisplay}>
                {/* Edit Total + Custom buttons - stacked vertically on left */}
                <View style={styles.editTotalButtonContainer}>
                  <TouchableOpacity
                    style={[styles.editTotalCompactButton, { 
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: colors.border,
                    }]}
                    onPress={() => {
                      setEditTotalInput(total.toString());
                      setEditTotalError('');
                      setShowEditTotalModal(true);
                    }}
                    activeOpacity={0.7}
                    {...getButtonAccessibilityProps(t('water.edit_total.button'))}
                  >
                    <ThemedText style={[styles.editTotalCompactButtonText, { color: colors.text }]}>
                      {t('water.edit_total.button')}
                    </ThemedText>
                  </TouchableOpacity>
                  
                  {/* Custom button - directly under Edit Total */}
                  <TouchableOpacity
                    style={[styles.customButton, { 
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: colors.border,
                    }]}
                    onPress={() => setShowCustomModal(true)}
                    disabled={isAddingWater}
                    activeOpacity={0.7}
                    {...getButtonAccessibilityProps(t('water.custom_button'))}
                  >
                    <View style={styles.customButtonContent}>
                      {/* Icon row: plus + droplet - droplet is main visual */}
                      <View style={styles.customButtonIconRow}>
                        <IconSymbol
                          name="plus"
                          size={FontSize.md} // Reduced by 1 step for proportion (was lg)
                          color={colors.tint}
                        />
                        <IconSymbol
                          name="drop.fill"
                          size={Math.round(FontSize['4xl'] * 1.175)} // Increased by ~17.5% (36 * 1.175 = 42.3 → 42dp)
                          color={waterTheme.accent}
                          style={{ marginLeft: 0 }} // No spacing - icons touching
                        />
                      </View>
                      {/* Label text */}
                      <ThemedText style={[styles.customButtonText, { color: colors.text }]}>
                        {t('water.quick_presets.custom')}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                </View>
                
                {/* Water Drop Gauge - centered */}
                <View style={styles.dropletContainer}>
                  <WaterDropGauge
                    totalMl={totalMl}
                    goalMl={goalMl}
                    unitPreference={activeWaterUnit}
                    size="large"
                  />
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
                      BASE_SCALE, // Index 1: base (250ml) - unchanged
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
                              {/* Wrap 1000ml icon in View with translateY to raise it and prevent bottom cutoff */}
                              <View style={index === 3 ? { transform: [{ translateY: -8 }] } : undefined}>
                                <AnimatedWaterIcon
                                  variant={iconVariant}
                                  isAnimating={isAnimating}
                                  size={48} // Base icon size (40-48 dp range)
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
                </View>
              </View>
            </>
          )}
        </View>

        {/* History Chart Section - Card */}
        <View style={[styles.card, { backgroundColor: colors.card, ...Shadows.md }]}>
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
            {t('water.history_title')}
          </ThemedText>
          <View style={styles.chartWrapper}>
            <BarChart
              data={historyData}
              maxValue={goalMl}
              goalValue={goalMl}
              goalDisplayValue={goalDisplayValue}
              selectedDate={selectedDateString}
              colorScale={(value, max) => {
                const ratio = value / max;
                if (ratio < 0.5) return colors.infoLight;
                if (ratio < 0.8) return colors.info;
                return accentColor;
              }}
              height={140}
              showLabels={true}
              emptyMessage={t('water.chart.empty_message')}
            />
          </View>
        </View>
        </DesktopPageContainer>
      </ScrollView>

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
                {t('water.custom_input_label', { unit: activeWaterUnit === 'floz' ? 'fl oz' : activeWaterUnit === 'cup' ? 'cups' : 'ml' })}
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
                  setCustomInput(text);
                  setCustomInputError('');
                }}
                placeholder={activeWaterUnit === 'floz' ? '20' : activeWaterUnit === 'cup' ? '8' : '500'}
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
        onRequestClose={() => setShowEditTotalModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={{ color: colors.text }}>
                {t('water.edit_total.title')}
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowEditTotalModal(false)}
                style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                {...getButtonAccessibilityProps(t('common.close'))}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                {t('water.edit_total.label', { unit: activeWaterUnit === 'floz' ? 'fl oz' : activeWaterUnit === 'cup' ? 'cups' : 'ml' })}
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
                  setEditTotalInput(text);
                  setEditTotalError('');
                }}
                placeholder={activeWaterUnit === 'floz' ? '64' : activeWaterUnit === 'cup' ? '8' : '2000'}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                autoFocus
              />
              {editTotalError && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {editTotalError}
                </ThemedText>
              )}
              <ThemedText style={[styles.formHelper, { color: colors.textSecondary }]}>
                {t('water.edit_total.helper', { max: 5000 })}
              </ThemedText>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowEditTotalModal(false);
                    setEditTotalInput('');
                    setEditTotalError('');
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
      {isToday && (
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
                          // Round to 1 decimal place for display
                          const roundedGoal = Math.round(convertedGoal * 10) / 10;
                          setSettingsGoal(roundedGoal.toString());
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
                      setSettingsGoal(text);
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
      )}

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
  scrollContent: {
    padding: Layout.screenPadding,
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 0, // DesktopPageContainer handles horizontal padding
    }),
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md, // Reduced from lg to tighten spacing
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs, // Reduced from sm to tighten spacing
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
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
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  chartWrapper: {
    marginTop: Spacing.sm, // Add spacing between title and chart
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
  editTotalButtonContainer: {
    position: 'absolute',
    top: Spacing.xs,
    left: 0,
    zIndex: 10,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  editTotalCompactButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...getMinTouchTargetStyle(),
  },
  editTotalCompactButtonText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    lineHeight: FontSize.xs * 1.5, // Use theme line height
  },
  customButton: {
    paddingHorizontal: Spacing.xs, // Reduced by one size step (was sm)
    paddingVertical: Spacing.xs / 4, // Reduced vertical padding further
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
    gap: Spacing.xs / 4, // Minimal gap between graphic and text - maintained for consistency
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
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    lineHeight: FontSize.xs * 1.5, // Use theme line height
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
    gap: Spacing.sm, // Use gap-based spacing for even distribution
    paddingHorizontal: Spacing.xs, // Small horizontal padding
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
    // Fixed height icon area - accommodates tallest icon (1.5x scale = 72dp)
    // Base icon size 48dp * max scale 1.5 = 72dp, using 80dp for safety margin
    height: Spacing['6xl'] + Spacing.lg, // Fixed height: 80dp - all icons align at bottom
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
    width: Spacing['6xl'] + Spacing.lg + Spacing.sm, // Slightly larger than container for subtle glow
    height: Spacing['6xl'] + Spacing.lg + Spacing.sm,
    borderRadius: (Spacing['6xl'] + Spacing.lg + Spacing.sm) / 2, // Circular highlight
    opacity: 0.3,
  },
  quickAddControlText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    lineHeight: FontSize.xs * 1.5, // Use theme line height
    marginTop: Spacing.xs, // Fixed gap between icon area and label - prevents overlap
    marginBottom: 0, // No bottom margin
    padding: 0, // No padding
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
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    ...getMinTouchTargetStyle(),
  },
  customButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '500',
  },
});

