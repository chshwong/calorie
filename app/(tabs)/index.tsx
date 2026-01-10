import { BurnedCaloriesModal } from '@/components/burned/BurnedCaloriesModal';
import { CalorieCurvyGauge } from '@/components/CalorieCurvyGauge';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import type { TransferMode } from '@/components/copy-mealtype-modal';
import { CopyMealtypeModal } from '@/components/copy-mealtype-modal';
import { DoneForTodayButton } from '@/components/DoneForTodayButton';
import { CollapsibleModuleHeader } from '@/components/header/CollapsibleModuleHeader';
import { DatePickerButton } from '@/components/header/DatePickerButton';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { SummaryCardHeader } from '@/components/layout/summary-card-header';
import { MacroGauge } from '@/components/MacroGauge';
import { NoteEditor } from '@/components/note-editor';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showAppToast } from '@/components/ui/app-toast';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MiniRingGauge } from '@/components/ui/mini-ring-gauge';
import { FOOD_LOG } from '@/constants/constraints';
import { NUTRIENT_LIMITS } from '@/constants/nutrient-limits';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Nudge, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isTourCompleted, isTourWelcomeShown, setTourWelcomeShown } from '@/features/tour/storage';
import { useTour } from '@/features/tour/TourProvider';
import { V1_HOMEPAGE_TOUR_STEPS } from '@/features/tour/tourSteps';
import { useTourAnchor } from '@/features/tour/useTourAnchor';
import { useCloneMealTypeFromPreviousDay } from '@/hooks/use-clone-meal-type-from-previous-day';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCopyMealtypeEntries } from '@/hooks/use-copy-mealtype-entries';
import { useDailyEntries } from '@/hooks/use-daily-entries';
import { useDailySumBurned } from '@/hooks/use-daily-sum-burned';
import { useMealtypeMeta } from '@/hooks/use-mealtype-meta';
import { useSelectedDate } from '@/hooks/use-selected-date';
import { useTransferMealtypeEntries } from '@/hooks/use-transfer-mealtype-entries';
import { useUpsertMealtypeMeta } from '@/hooks/use-upsert-mealtype-meta';
import { userConfigQueryKey, useUserConfig } from '@/hooks/use-user-config';
import { useCopyFromYesterday } from '@/hooks/useCopyFromYesterday';
import { compareDateKeys, minDateKey } from '@/lib/date-guard';
import { calculateNetCalories } from '@/lib/domain/burned/netCalories';
import { getPersistentCache } from '@/lib/persistentCache';
import { fetchBundles } from '@/lib/services/bundles';
import { getEntriesForDate } from '@/lib/services/calorieEntries';
import { getMealtypeMetaByDate } from '@/lib/services/calories-entries-mealtype-meta';
import { fetchCustomFoods } from '@/lib/services/customFoods';
import { fetchFrequentFoods } from '@/lib/services/frequentFoods';
import { fetchRecentFoods } from '@/lib/services/recentFoods';
import { ensureContrast } from '@/theme/contrast';
import {
  getButtonAccessibilityProps,
  getFocusStyle,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';
import { getGreetingKey } from '@/utils/bmi';
import { calculateDailyTotals, groupEntriesByMealType } from '@/utils/dailyTotals';
import { addDays, toDateKey } from '@/utils/dateKey';
import { getLocalDateKey } from '@/utils/dateTime';
import { MEAL_TYPE_ORDER, type CalorieEntry } from '@/utils/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScrollView } from 'react-native';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Component for copy from yesterday button on meal type chip
type MealTypeCopyButtonProps = {
  mealType: string;
  mealTypeLabel: string;
  selectedDate: Date;
  isToday: boolean;
  colors: typeof Colors.light | typeof Colors.dark;
  t: (key: string, options?: any) => string;
};

function MealTypeCopyButton({ mealType, mealTypeLabel, selectedDate, isToday, colors, t }: MealTypeCopyButtonProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isCopyingFromYesterday, runCopyFromYesterday } = useCopyFromYesterday();
  const [isTemporarilyDisabled, setIsTemporarilyDisabled] = useState(false);
  
  const { cloneMealTypeFromPreviousDay, isLoading } = useCloneMealTypeFromPreviousDay({
    currentDate: selectedDate,
    mealType,
    onSuccess: (result) => {
      if (result.totalCount > 0) {
        showAppToast(t('home.previous_day_copy.success_message', {
          count: result.totalCount,
          items: result.totalCount === 1 ? t('home.previous_day_copy.item_one') : t('home.previous_day_copy.item_other'),
        }));
      }
    },
    onError: (error: Error) => {
      // Handle nothing to copy error
      if (error.message === 'NOTHING_TO_COPY') {
        showAppToast(t('home.previous_day_copy.nothing_to_copy'));
        return;
      }
      // Handle same-date error specifically
      if (error.message === 'SAME_DATE' || error.message?.includes('same date')) {
        Alert.alert(
          t('home.previous_day_copy.error_title'),
          t('home.previous_day_copy.same_date_error')
        );
      } else {
        Alert.alert(
          t('home.previous_day_copy.error_title'),
          t('home.previous_day_copy.error_message', {
            error: error.message || t('common.unexpected_error'),
          })
        );
      }
    },
  });

  // Check cache for previous day data (best effort, no DB call)
  // Only show button if cache indicates there's data to copy
  const hasPreviousDayData = useMemo(() => {
    if (!user?.id) return false;
    
    const previousDay = new Date(selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDateKey = toDateKey(previousDay);
    
    // Check entries cache
    const previousDayQueryKey = ['entries', user.id, previousDateKey];
    const cachedPreviousDayEntries = queryClient.getQueryData<CalorieEntry[]>(previousDayQueryKey);
    
    // Check meta cache
    const previousDayMetaQueryKey = ['mealtypeMeta', user.id, previousDateKey];
    const cachedPreviousDayMeta = queryClient.getQueryData<any[]>(previousDayMetaQueryKey);
    
    // Only show button if we have positive evidence of data in cache
    // If cache is undefined (not loaded yet), hide button (best effort - no DB call)
    // If cache exists and has data, show button
    // If cache exists and is empty, hide button
    
    // Check entries
    if (cachedPreviousDayEntries !== undefined) {
      if (cachedPreviousDayEntries !== null && cachedPreviousDayEntries.length > 0) {
        const mealTypeEntries = cachedPreviousDayEntries.filter(entry => 
          entry.meal_type?.toLowerCase() === mealType.toLowerCase()
        );
        if (mealTypeEntries.length > 0) {
          return true;
        }
      }
    }
    
    // Check notes from meta
    if (cachedPreviousDayMeta !== undefined && cachedPreviousDayMeta !== null) {
      const mealTypeMeta = cachedPreviousDayMeta.find(meta => 
        meta.meal_type?.toLowerCase() === mealType.toLowerCase()
      );
      if (mealTypeMeta && mealTypeMeta.note != null && mealTypeMeta.note.trim().length > 0) {
        return true;
      }
    }
    
    // No positive evidence of data - hide button
    return false;
  }, [user?.id, selectedDate, mealType, queryClient]);

  const handleCopy = () => {
    // Check cache for previous day before cloning
    const previousDay = new Date(selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDateString = toDateKey(previousDay);
    
    // Use React Query cache to check if previous day has entries or notes for this meal type
    const previousDayQueryKey = ['entries', user?.id, previousDateString];
    const cachedPreviousDayEntries = queryClient.getQueryData<any[]>(previousDayQueryKey);
    const previousDayMetaQueryKey = ['mealtypeMeta', user?.id, previousDateString];
    const cachedPreviousDayMeta = queryClient.getQueryData<any[]>(previousDayMetaQueryKey);
    
    // Check if there's anything to copy: entries or notes
    let hasEntries = false;
    let hasNotes = false;
    
    // Check entries
    if (cachedPreviousDayEntries !== undefined) {
      if (cachedPreviousDayEntries !== null && cachedPreviousDayEntries.length > 0) {
        const mealTypeEntries = cachedPreviousDayEntries.filter(entry => 
          entry.meal_type?.toLowerCase() === mealType.toLowerCase()
        );
        hasEntries = mealTypeEntries.length > 0;
      }
    }
    
    // Check notes from meta
    if (cachedPreviousDayMeta !== undefined && cachedPreviousDayMeta !== null) {
      const mealTypeMeta = cachedPreviousDayMeta.find(meta => 
        meta.meal_type?.toLowerCase() === mealType.toLowerCase()
      );
      if (mealTypeMeta) {
        hasNotes = mealTypeMeta.note != null && mealTypeMeta.note.trim().length > 0;
      }
    }
    
    // If cache exists and there's nothing to copy, show message and skip DB call
    if (cachedPreviousDayEntries !== undefined && cachedPreviousDayMeta !== undefined) {
      if (!hasEntries && !hasNotes) {
        showAppToast(t('home.previous_day_copy.nothing_to_copy'));
        return;
      }
    }
    
    // Disable button for 3 seconds to prevent multiple clicks
    setIsTemporarilyDisabled(true);
    setTimeout(() => {
      setIsTemporarilyDisabled(false);
    }, 3000);
    
    runCopyFromYesterday(() => cloneMealTypeFromPreviousDay());
  };

  // Don't render if cache shows no data from previous day
  if (!hasPreviousDayData) {
    return null;
  }

  return (
    <View style={styles.copyFromYesterdayButton}>
      {isCopyingFromYesterday ? (
        <ActivityIndicator size="small" color={colors.tint} />
      ) : (
        <>
          <TouchableOpacity
            onPress={handleCopy}
            activeOpacity={0.7}
            disabled={isCopyingFromYesterday || isTemporarilyDisabled}
            {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
            {...getButtonAccessibilityProps(
              isToday 
                ? t('home.previous_day_copy.accessibility_label_yesterday', { mealType: mealTypeLabel })
                : t('home.previous_day_copy.accessibility_label_previous', { mealType: mealTypeLabel })
            )}
          >
            <IconSymbol name="doc.on.doc" size={19} color={isTemporarilyDisabled ? colors.textSecondary : colors.tint} />
          </TouchableOpacity>
          <ThemedText style={[styles.copyFromYesterdayButtonText, { color: colors.tint }]}>
            {isToday 
              ? t('home.previous_day_copy.label_yesterday')
              : t('home.previous_day_copy.label_previous')}
          </ThemedText>
        </>
      )}
    </View>
  );
}

/**
 * Format a single meal entry for display on home page meal cards
 * Manual entries (food_id is null/undefined) are formatted as "⚡Food-Name"
 * Non-manual entries use the standard format: "qty x unit food-name"
 */
function formatMealEntryLabel(entry: CalorieEntry): string {
  // Manual entries have no food_id
  if (!entry.food_id) {
    return `⚡${entry.item_name}`;
  }
  
  // Non-manual entries: "qty x unit food-name"
  const quantity = Math.round(entry.quantity) === entry.quantity 
    ? entry.quantity.toString() 
    : entry.quantity.toFixed(1);
  return `${quantity} x ${entry.unit} ${entry.item_name}`;
}

function formatWholeNumber(n: number): string {
  // Match existing Day Summary style: whole numbers, commas, no decimals.
  return Math.round(n).toLocaleString('en-US');
}

function EnergyBalanceBlock(props: {
  burnedCal: number | null;
  eatenCal: number;
  goalType: 'lose' | 'maintain' | 'recomp' | 'gain';
  colors: typeof Colors.light | typeof Colors.dark;
  t: (key: string, options?: any) => string;
  onEditBurned?: () => void;
  tourContainerRef?: React.RefObject<any>;
  tourBurnedPencilRef?: React.RefObject<any>;
}) {
  const { burnedCal, eatenCal, goalType, colors, t, onEditBurned, tourContainerRef, tourBurnedPencilRef } = props;
  const [isBurnedHover, setIsBurnedHover] = useState(false);
  const scheme = useColorScheme();
  const modeKey = (scheme ?? 'light') as 'light' | 'dark';

  const net = burnedCal == null ? null : burnedCal - eatenCal;
  const netAbs = net == null ? null : Math.abs(net);
  const isDeficit = net == null ? true : net >= 0;

  const netColorRaw = (() => {
    if (net == null) return colors.text;
    if (goalType !== 'lose') return colors.text;

    if (net >= 200) return colors.chartGreen;
    if (net >= 0) return colors.chartOrange;
    if (net > -500) return colors.chartPink;
    return colors.chartRed;
  })();

  // Match charts: ensure text color meets WCAG contrast.
  // Light mode => darken; Dark mode => lighten.
  const netColor = ensureContrast(netColorRaw, colors.card, modeKey, 4.5);

  // Show checkmark only when the net label is in the "green" state.
  const showCheckmark = goalType === 'lose' && net != null && net >= 200;

  const netLabel = isDeficit ? t('burned.energy_balance.labels.deficit') : t('burned.energy_balance.labels.surplus');

  const burnedPressableProps = onEditBurned
    ? {
        onPress: onEditBurned,
        activeOpacity: 0.8,
        hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
        ...getButtonAccessibilityProps(t('burned.energy_balance.accessibility.edit_burned')),
        onHoverIn: () => setIsBurnedHover(true),
        onHoverOut: () => setIsBurnedHover(false),
      }
    : {};

  return (
    <View
      ref={tourContainerRef as any}
      style={[styles.energyBalanceWrap, { borderTopColor: colors.separator, borderBottomColor: colors.separator }]}
    >
      {/* Row 1: Equation */}
      <View style={styles.energyBalanceRowNumbers}>
        <View style={styles.energyBalanceCol}>
          <TouchableOpacity
            ref={tourBurnedPencilRef as any}
            style={[
              styles.energyBalanceBurnedTapTarget,
              Platform.OS === 'web' && onEditBurned ? ({ cursor: 'pointer' } as any) : null,
              Platform.OS === 'web' && onEditBurned ? getFocusStyle(colors.tint) : null,
            ]}
            {...burnedPressableProps}
          >
            <View style={styles.energyBalanceBurnedNumberRow}>
              <ThemedText
                style={[
                  styles.energyBalanceNumber,
                  { color: colors.text },
                  Platform.OS === 'web' && isBurnedHover ? styles.energyBalanceUnderline : null,
                ]}
                numberOfLines={1}
              >
                {burnedCal == null ? t('burned.week.placeholder') : formatWholeNumber(burnedCal)}
              </ThemedText>
              <Text style={styles.energyBalanceEmoji} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">
                ✏️
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <ThemedText style={[styles.energyBalanceOp, { color: colors.textSecondary }]} numberOfLines={1}>
          –
        </ThemedText>

        <View style={styles.energyBalanceCol}>
          <ThemedText style={[styles.energyBalanceNumber, { color: colors.text }]} numberOfLines={1}>
            {formatWholeNumber(eatenCal)}
          </ThemedText>
        </View>

        <ThemedText style={[styles.energyBalanceOp, { color: colors.textSecondary }]} numberOfLines={1}>
          =
        </ThemedText>

        <View style={styles.energyBalanceCol}>
          <ThemedText style={[styles.energyBalanceNumber, { color: netColor }]} numberOfLines={1}>
            {netAbs == null ? t('burned.week.placeholder') : formatWholeNumber(netAbs)}
          </ThemedText>
        </View>
      </View>

      {/* Row 2: Labels */}
      <View style={styles.energyBalanceRowLabels}>
        <View style={styles.energyBalanceCol}>
          <TouchableOpacity
            style={[
              styles.energyBalanceBurnedTapTarget,
              Platform.OS === 'web' && onEditBurned ? ({ cursor: 'pointer' } as any) : null,
              Platform.OS === 'web' && onEditBurned ? getFocusStyle(colors.tint) : null,
            ]}
            {...burnedPressableProps}
          >
            <ThemedText style={[styles.energyBalanceLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('burned.energy_balance.labels.burned')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedText style={[styles.energyBalanceOp, { color: colors.textSecondary }]} numberOfLines={1}>
          {' '}
        </ThemedText>

        <View style={styles.energyBalanceCol}>
          <ThemedText style={[styles.energyBalanceLabel, { color: colors.textSecondary }]} numberOfLines={1}>
            <Text style={styles.energyBalanceEmojiInline} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">
              🍴
            </Text>{' '}
            {t('burned.energy_balance.words.eaten')}
          </ThemedText>
        </View>

        <ThemedText style={[styles.energyBalanceOp, { color: colors.textSecondary }]} numberOfLines={1}>
          {' '}
        </ThemedText>

        <View style={styles.energyBalanceCol}>
          <ThemedText style={[styles.energyBalanceLabel, { color: netColor }]} numberOfLines={1}>
            {showCheckmark ? (
              <>
                <Text
                  style={styles.energyBalanceEmojiInline}
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no-hide-descendants"
                >
                  ✅
                </Text>{' '}
              </>
            ) : null}
            {netLabel}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

type MealViewMode = 'collapsed' | 'semi' | 'expanded';
const DEFAULT_MEAL_VIEW_MODE: MealViewMode = 'semi';
const CAL_COL_WIDTH = 72; // Fixed width for calorie column alignment
const MEAL_VIEW_MODE_KEY = 'home.mealViewMode.v1';

// Unified async storage wrapper (localStorage on web, AsyncStorage on native)
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return await AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
};

export default function FoodLogHomeScreen() {
  const { t } = useTranslation();
  const { signOut, loading, retrying, user, profile: authProfile } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [refreshing, setRefreshing] = useState(false);

  // Tour wiring (Home tour)
  const { startTour, registerScrollContainer, activeTourId, registerOnStepChange, requestRemeasure } = useTour();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const didInitTourScrollRef = useRef(false);

  const tourCurvyGaugeRef = useTourAnchor('home.curvyGauge');
  const tourBurnedEatenNetRef = useTourAnchor('home.burnedEatenNet');
  const tourBurnedPencilRef = useTourAnchor('home.burnedPencil');
  const tourMacrosAndOtherLimitsRef = useTourAnchor('home.macrosAndOtherLimits');
  const tourMealLogRef = useTourAnchor('home.mealLog');
  const tourMealSnackRef = useTourAnchor('home.mealSnack');
  const tourCallItADayRef = useTourAnchor('home.callItADay');

  const [welcomeConfettiVisible, setWelcomeConfettiVisible] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const isCheckingTourRef = useRef(false);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Menu state for meal type options
  const [threeDotMealMenuVisible, setThreeDotMealMenuVisible] = useState<{ mealType: string | null }>({ mealType: null });
  
  // Meal view mode state (collapsed/semi/expanded per meal)
  const [mealViewModes, setMealViewModes] = useState<Record<string, MealViewMode>>({
    breakfast: DEFAULT_MEAL_VIEW_MODE,
    lunch: DEFAULT_MEAL_VIEW_MODE,
    snack: DEFAULT_MEAL_VIEW_MODE,
    dinner: DEFAULT_MEAL_VIEW_MODE,
  });

  // Load meal view modes from storage on mount
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await storage.getItem(MEAL_VIEW_MODE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setMealViewModes(parsed);
        }
      } catch (error) {
        // Silently fail if storage read fails
        console.warn('Failed to load meal view modes from storage:', error);
      }
    };
    load();
  }, []);

  // Persist meal view modes to storage whenever they change
  useEffect(() => {
    const save = async () => {
      try {
        await storage.setItem(MEAL_VIEW_MODE_KEY, JSON.stringify(mealViewModes));
      } catch (error) {
        // Silently fail if storage write fails
        console.warn('Failed to save meal view modes to storage:', error);
      }
    };
    save();
  }, [mealViewModes]);
  
  // Note editor state
  const [noteEditor, setNoteEditor] = useState<{ visible: boolean; mealType: string | null }>({ visible: false, mealType: null });
  
  // Transfer mealtype modal state (copy or move)
  const [transferMealtypeModal, setTransferMealtypeModal] = useState<{ 
    visible: boolean; 
    mealType: string | null;
    mode: TransferMode;
  }>({ visible: false, mealType: null, mode: 'copy' });

  const [burnedModalVisible, setBurnedModalVisible] = useState(false);
  
  // Mini gauges section collapse state
  const [isMiniGaugesCollapsed, setIsMiniGaugesCollapsed] = useState(false);

  // Password recovery UI is not supported (passwordless-only).
  // If Supabase ever enters PASSWORD_RECOVERY mode, we intentionally do nothing here.
  
  // Pull-to-refresh state for web
  const [pullToRefreshDistance, setPullToRefreshDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const pullDistance = useRef<number>(0);
  
  // Use shared date hook
  const {
    selectedDate,
    selectedDateString,
    isToday,
    today,
    minDate,
    minDateKey: userSignupDateKey,
    canGoBack,
  } = useSelectedDate();

  const queryClient = useQueryClient();

  // Fetch mealtype meta
  const { dataByMealType } = useMealtypeMeta(selectedDateString);
  
  // Mutation for upserting mealtype meta
  const upsertMealtypeMetaMutation = useUpsertMealtypeMeta();
  
  // Mutation for copying mealtype entries (legacy, kept for backward compatibility)
  const copyMealtypeMutation = useCopyMealtypeEntries();
  
  // Mutation for transferring mealtype entries (copy or move)
  const transferMealtypeMutation = useTransferMealtypeEntries();


  const prefetchDateData = useCallback(
    (dateString: string) => {
      if (!user?.id) return;
      const entriesKey = ['entries', user.id, dateString];
      if (!queryClient.getQueryData(entriesKey)) {
        queryClient.prefetchQuery({
          queryKey: entriesKey,
          queryFn: () => getEntriesForDate(user.id, dateString),
          staleTime: 10 * 60 * 1000,
          gcTime: 24 * 60 * 60 * 1000,
        });
      }

      const metaKey = ['mealtypeMeta', user.id, dateString];
      if (!queryClient.getQueryData(metaKey)) {
        queryClient.prefetchQuery({
          queryKey: metaKey,
          queryFn: () => getMealtypeMetaByDate(user.id!, dateString),
          staleTime: 10 * 60 * 1000,
          gcTime: 24 * 60 * 60 * 1000,
        });
      }
    },
    [queryClient, user?.id]
  );

  // Helper function to navigate with new date (updates URL param)
  const navigateWithDate = useCallback(
    (date: Date | string) => {
      const dateKey = toDateKey(date);
      prefetchDateData(dateKey);
      router.replace({
        pathname: '/',
        params: { date: dateKey }
      });
    },
    [prefetchDateData, router]
  );


  const { data: userConfig, isLoading: userConfigLoading } = useUserConfig();

  const {
    data: calorieEntries,
    isLoading: entriesLoading,
    isFetching: entriesFetching,
    refetch: refetchEntries,
  } = useDailyEntries(selectedDateString);

  // Entries: use cache immediately - also check persistent cache directly as fallback
  // This ensures we have data even if React Query cache hasn't rehydrated yet
  const persistentEntries = useMemo(() => {
    if (!user?.id || !selectedDateString) return null;
    const cacheKey = `dailyEntries:${user.id}:${selectedDateString}`;
    return getPersistentCache<CalorieEntry[]>(cacheKey, 120 * 24 * 60 * 60 * 1000);
  }, [user?.id, selectedDateString]);
  
  const entries = calorieEntries ?? persistentEntries ?? [];
  const hasFoodEntries = entries.length > 0;
  
  // Only show loading spinner if we're doing initial load AND have no data at all (including persistent cache)
  // placeholderData should provide cached data immediately, so if we have no data from any source,
  // it means there's truly no cached data and we're doing a fresh fetch
  const showLoadingSpinner =
    entriesLoading && 
    entries.length === 0 && 
    calorieEntries === undefined &&
    persistentEntries === null;

  // UserConfig: use cache immediately - use canonical query key
  const cachedUserConfig =
    userConfig ?? queryClient.getQueryData(userConfigQueryKey(user?.id ?? null));
  const isUserConfigLoading = userConfigLoading && !cachedUserConfig;
  
  // Get effective profile (from useUserConfig hook or AuthContext fallback)
  const effectiveProfile = cachedUserConfig ?? authProfile;

  // Burned daily cache (lazy create on day view open per spec).
  const { data: dailyBurned } = useDailySumBurned(selectedDateString, { enabled: !!user?.id });

  // Prefetch adjacent dates for instant navigation
  useEffect(() => {
    if (!user?.id || !selectedDateString) return;

    // Calculate previous and next dates using canonical dateKey utility
    const prevDateKey = addDays(selectedDateString, -1);
    const nextDateKey = addDays(selectedDateString, 1);

    // Prefetch previous day
    const prevEntriesKey = ['entries', user.id, prevDateKey];
    if (!queryClient.getQueryData(prevEntriesKey)) {
      // Silently prefetch (removed verbose logging)
      queryClient.prefetchQuery({
        queryKey: prevEntriesKey,
        queryFn: () => getEntriesForDate(user.id, prevDateKey),
        staleTime: 10 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
      });
    }

    const prevMetaKey = ['mealtypeMeta', user.id, prevDateKey];
    if (!queryClient.getQueryData(prevMetaKey)) {
      queryClient.prefetchQuery({
        queryKey: prevMetaKey,
        queryFn: () => getMealtypeMetaByDate(user.id, prevDateKey),
        staleTime: 10 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
      });
    }

    // Prefetch next day (only if not today)
    if (!isToday) {
      const nextEntriesKey = ['entries', user.id, nextDateKey];
      if (!queryClient.getQueryData(nextEntriesKey)) {
        // Silently prefetch (removed verbose logging)
        queryClient.prefetchQuery({
          queryKey: nextEntriesKey,
          queryFn: () => getEntriesForDate(user.id, nextDateKey),
          staleTime: 10 * 60 * 1000,
          gcTime: 24 * 60 * 60 * 1000,
        });
      }

      const nextMetaKey = ['mealtypeMeta', user.id, nextDateKey];
      if (!queryClient.getQueryData(nextMetaKey)) {
        queryClient.prefetchQuery({
          queryKey: nextMetaKey,
          queryFn: () => getMealtypeMetaByDate(user.id, nextDateKey),
          staleTime: 10 * 60 * 1000,
          gcTime: 24 * 60 * 60 * 1000,
        });
      }
    }
  }, [user?.id, selectedDateString, isToday, queryClient]);

  // Background prefetch for mealtype-log tab data (after Home data is ready)
  // Use a stable default meal type for background prefetching
  const defaultMealType = 'dinner';
  useEffect(() => {
    // Only wait for initial load if there's no cached data
    // If entries exist in cache, we can proceed with prefetching
    if (!user?.id) return;
    
    // Silently prefetch tab data in the background, but only if not already cached
    const frequentFoodsKey = ['frequentFoods', user.id, defaultMealType];
    if (!queryClient.getQueryData(frequentFoodsKey)) {
      queryClient.prefetchQuery({
        queryKey: frequentFoodsKey,
        queryFn: () => fetchFrequentFoods(user.id, defaultMealType),
      });
    }
    
    const recentFoodsKey = ['recentFoods', user.id, defaultMealType];
    if (!queryClient.getQueryData(recentFoodsKey)) {
      queryClient.prefetchQuery({
        queryKey: recentFoodsKey,
        queryFn: () => fetchRecentFoods(user.id, defaultMealType),
      });
    }
    
    const customFoodsKey = ['customFoods', user.id];
    if (!queryClient.getQueryData(customFoodsKey)) {
      queryClient.prefetchQuery({
        queryKey: customFoodsKey,
        queryFn: () => fetchCustomFoods(user.id),
      });
    }
    
    const bundlesKey = ['bundles', user.id];
    if (!queryClient.getQueryData(bundlesKey)) {
      queryClient.prefetchQuery({
        queryKey: bundlesKey,
        queryFn: () => fetchBundles(user.id),
      });
    }
  }, [user?.id, queryClient]);


  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    if (refreshing) return; // Prevent multiple simultaneous refreshes
    setRefreshing(true);
    await refetchEntries();
    setRefreshing(false);
  }, [refetchEntries, refreshing]);

  // Web-specific pull-to-refresh using scroll position detection
  // For web, we'll use onScroll to detect when user scrolls past top and trigger refresh
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWebScroll = useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    
    const scrollY = e.nativeEvent.contentOffset?.y || 0;
    setScrollPosition(scrollY);
    
    // Detect pull-to-refresh: when scrollY is negative (scrolled past top)
    if (scrollY < -60 && !refreshing && !isPulling) {
      setIsPulling(true);
      setPullToRefreshDistance(Math.abs(scrollY));
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Trigger refresh after a brief moment
      scrollTimeoutRef.current = setTimeout(async () => {
        if (scrollY < -60) {
          await onRefresh();
        }
        setIsPulling(false);
        setPullToRefreshDistance(0);
      }, 200);
    } else if (scrollY >= 0 && isPulling) {
      // Reset if scrolled back up
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      setIsPulling(false);
      setPullToRefreshDistance(0);
    }
  }, [refreshing, isPulling, onRefresh]);

  // Register scroll container for tour scrolling/measurement once.
  useEffect(() => {
    if (didInitTourScrollRef.current) return;
    didInitTourScrollRef.current = true;
    registerScrollContainer({
      ref: scrollViewRef,
      getScrollOffset: () => scrollOffsetRef.current,
    });
    return () => {
      registerScrollContainer(null);
    };
  }, [registerScrollContainer]);



  // Refresh entries when page comes into focus (e.g., returning from mealtype-log page)
  const isInitialMount = useRef(true);
  useFocusEffect(
    useCallback(() => {
      // Skip on initial mount since React Query handles initial fetch
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      // Small delay to ensure database writes are committed
      const timer = setTimeout(() => {
        if (user?.id) {
          refetchEntries();
        }
      }, 300);
      return () => clearTimeout(timer);
    }, [user?.id, refetchEntries])
  );

  const profileNotFound = !cachedUserConfig && !isUserConfigLoading && !loading && !retrying && user;

  // Disabled: showLoadingModal blocks the page. Instead, render with neutral values if userConfig is missing.
  // const showLoadingModal = !cachedUserConfig && isUserConfigLoading;

  const { dailyTotals, groupedEntries } = useMemo(() => {
    const totals = calculateDailyTotals(entries, dataByMealType);
    const grouped = groupEntriesByMealType(entries, dataByMealType);
    return { dailyTotals: totals, groupedEntries: grouped };
  }, [dataByMealType, entries, selectedDateString]);

  const proteinConsumed = Number(dailyTotals?.protein ?? 0);
  // AUTHORITATIVE: onboarding target column only (no legacy fallbacks)
  // NOTE: effectiveProfile typing is behind current DB schema; remove this cast once profile types are regenerated.
  const profileGoals = effectiveProfile as unknown as {
    protein_g_min?: number | null;
    fiber_g_min?: number | null;
    carbs_g_max?: number | null;
    daily_calorie_target?: number | null;
    goal_type?: 'lose' | 'maintain' | 'recomp' | 'gain' | null;
  };
  const proteinTarget = Number(profileGoals?.protein_g_min ?? 0);

  const fiberConsumed = Number(dailyTotals?.fiber ?? 0);
  const fiberTarget = Number(profileGoals?.fiber_g_min ?? 0);

  const carbsConsumed = Number(dailyTotals?.carbs ?? 0);
  const carbsMax = Number(profileGoals?.carbs_g_max ?? 0);

  const calorieConsumed = Number(dailyTotals?.calories ?? 0);
  const calorieTarget = Number(profileGoals?.daily_calorie_target ?? 0);
  const goalType = (profileGoals?.goal_type ?? 'maintain') as 'lose' | 'maintain' | 'recomp' | 'gain';

  // Mini gauge values (Sugar, Sodium, Sat Fat, Trans Fat)
  const sodiumConsumedMg = Number(
    (dailyTotals as unknown as { sodium_mg?: number | null })?.sodium_mg ?? dailyTotals?.sodium ?? 0
  );
  const sodiumMaxMg = Number((effectiveProfile as unknown as { sodium_mg_max?: number | null })?.sodium_mg_max ?? 0);
  const sugarConsumedG = Number(
    (dailyTotals as unknown as { sugar_g?: number | null })?.sugar_g ?? dailyTotals?.sugar ?? 0
  );
  const sugarMaxG = Number((effectiveProfile as unknown as { sugar_g_max?: number | null })?.sugar_g_max ?? 0);
  const satFatConsumedG = Number(
    (dailyTotals as unknown as { sat_fat_g?: number | null })?.sat_fat_g ??
      (dailyTotals as unknown as { sat_fat?: number | null })?.sat_fat ??
      (dailyTotals as unknown as { saturated_fat?: number | null })?.saturated_fat ??
      dailyTotals?.saturatedFat ??
      0
  );
  const satFatLimitG = NUTRIENT_LIMITS.satFatG;
  // IMPORTANT: Trans Fat should not be integer-rounded (MiniRingGauge will ceil to nearest 0.1 for display).
  // Prefer summing from raw entries (may include decimals), then fall back to totals if needed.
  const transFatConsumedG = useMemo(() => {
    const raw = entries.reduce((sum, entry) => sum + (entry.trans_fat_g ?? 0), 0);
    if (Number.isFinite(raw)) return raw;

    return Number(
      (dailyTotals as unknown as { trans_fat_g?: number | null })?.trans_fat_g ??
        (dailyTotals as unknown as { trans_fat?: number | null })?.trans_fat ??
        (dailyTotals as unknown as { transfat?: number | null })?.transfat ??
        dailyTotals?.transFat ??
        0
    );
  }, [dailyTotals, entries]);
  const transFatLimitG = NUTRIENT_LIMITS.transFatG;

  // Net calories remain available for other modules (e.g. week overview); UI formatting lives in EnergyBalanceBlock.
  const netCalories = useMemo(() => {
    if (dailyBurned?.tdee_cal == null) return null;
    return calculateNetCalories({ burnedTdeeCal: dailyBurned.tdee_cal, eatenCalories: calorieConsumed });
  }, [dailyBurned?.tdee_cal, calorieConsumed]);

  // Week section removed per spec (v1 only needed in earlier iteration).

  // DEV ONLY: bust caches once so new profile columns show up immediately
  const didInvalidateProfileQueriesRef = useRef(false);
  useEffect(() => {
    if (!__DEV__) return;
    if (didInvalidateProfileQueriesRef.current) return;
    if (!user?.id) return;
    didInvalidateProfileQueriesRef.current = true;

    // userConfig is the primary cache that backs effectiveProfile on Home
    queryClient.invalidateQueries({ queryKey: ['userConfig', user.id] });
    // userProfile is used elsewhere (onboarding/profile screens)
    queryClient.invalidateQueries({ queryKey: ['userProfile', user.id] });
  }, [queryClient, user?.id]);

  // Use meal type order from shared types
  const sortedMealTypes = MEAL_TYPE_ORDER;


  // Handlers for Notes
  const handleNotes = (mealType: string) => {
    setThreeDotMealMenuVisible({ mealType: null });
    setNoteEditor({ visible: true, mealType });
  };

  const handleNoteSave = (mealType: string, note: string | null) => {
    upsertMealtypeMetaMutation.mutate(
      {
        entryDate: selectedDateString,
        mealType,
        note,
      },
      {
        onSuccess: () => {
          setNoteEditor({ visible: false, mealType: null });
        },
        onError: (error) => {
          console.error('Error saving note:', error);
          Alert.alert(t('common.error'), t('food.note.save_error'));
        },
      }
    );
  };

  const handleQuickLog = (mealType: string) => {
    setThreeDotMealMenuVisible({ mealType: null });
    // Navigate to dedicated Quick Log screen
    router.push({
      pathname: '/quick-log',
      params: {
        date: selectedDateString,
        mealType: mealType,
      }
    });
  };

  const handleCopyTo = (mealType: string) => {
    setThreeDotMealMenuVisible({ mealType: null });
    setTransferMealtypeModal({ visible: true, mealType, mode: 'copy' });
  };

  const handleMoveTo = (mealType: string) => {
    setThreeDotMealMenuVisible({ mealType: null });
    setTransferMealtypeModal({ visible: true, mealType, mode: 'move' });
  };

  const handleTransferConfirm = (mealType: string, targetDate: Date, targetMealType: string, includeNotes: boolean, mode: TransferMode) => {
    const targetDateString = getLocalDateKey(targetDate);
    
    // Helper to check if two dates are the same day
    const isSameDay = (date1: string, date2: string): boolean => {
      return date1 === date2;
    };
    
    // Prevent copying to the same meal type on the same date
    const sameDay = isSameDay(selectedDateString, targetDateString);
    const sameMealType = mealType.toLowerCase() === targetMealType.toLowerCase();
    
    if (sameDay && sameMealType) {
      const errorKey = mode === 'move' ? 'food.move.same_meal_error' : 'food.copy.same_meal_error';
      showAppToast(t(errorKey));
      return; // Don't proceed with the transfer
    }
    
    // Convert includeNotes boolean to NotesMode
    const notesMode = includeNotes ? 'override' : 'exclude';
    
    transferMealtypeMutation.mutate(
      {
        sourceDate: selectedDateString,
        sourceMealType: mealType,
        targetDate: targetDateString,
        targetMealType,
        mode,
        notesMode,
      },
      {
        onSuccess: (result) => {
          setTransferMealtypeModal({ visible: false, mealType: null, mode: 'copy' });
          const mealTypeLabel = t(`home.meal_types.${targetMealType}`);
          const dateLabel = targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          
          // Calculate total count: entries + notes (1 if copied)
          let totalCount = result.entriesCloned;
          if (result.notesCopied) {
            totalCount += 1;
          }
          
          const successKey = mode === 'move' ? 'food.move.success_toast' : 'food.copy.success_toast';
          showAppToast(
            t(successKey, {
              count: totalCount,
              mealType: mealTypeLabel,
              date: dateLabel,
            })
          );
        },
        onError: (error: Error) => {
          setTransferMealtypeModal({ visible: false, mealType: null, mode: 'copy' });
          if (error.message === 'SAME_DATE') {
            const sameDateKey = mode === 'move' ? 'food.move.same_date_error' : 'food.copy.same_date_error';
            showAppToast(t(sameDateKey));
          } else {
            const errorKey = mode === 'move' ? 'food.move.error_message' : 'food.copy.error_message';
            showAppToast(t(errorKey));
          }
        },
      }
    );
  };

  // Cycle meal view mode helper
  const cycleMealViewMode = useCallback((mealType: string) => {
    setMealViewModes(prev => {
      const cur = prev[mealType] ?? DEFAULT_MEAL_VIEW_MODE;
      const next =
        cur === 'collapsed' ? 'semi' :
        cur === 'semi' ? 'expanded' :
        'collapsed';
      return { ...prev, [mealType]: next };
    });
  }, []);

  // Render meal view toggle
  const renderMealViewToggle = useCallback((mealType: string, mode: MealViewMode) => {
    const icon =
      mode === 'collapsed' ? '▢' :
      mode === 'semi' ? '≡' :
      '☰';

    const a11y =
      mode === 'collapsed' ? 'Show summary' :
      mode === 'semi' ? 'Show details' :
      'Collapse meal';

    const toggleColor = colorScheme === 'dark' ? '#FFFFFF' : colors.textSecondary;

    return (
      <Pressable
        onPress={() => cycleMealViewMode(mealType)}
        hitSlop={10}
        style={[
          styles.mealViewToggle,
          colorScheme === 'dark' ? { backgroundColor: 'rgba(255,255,255,0.08)' } : { backgroundColor: 'transparent' },
        ]}
        accessibilityRole="button"
        accessibilityLabel={a11y}
      >
        <View style={styles.mealViewToggleInner}>
          <Text style={[styles.mealViewToggleIcon, { color: toggleColor }]}>{icon}</Text>
          <IconSymbol
            name={mode === 'expanded' ? 'chevron.up' : 'chevron.down'}
            size={16}
            color={toggleColor}
            decorative
          />
        </View>
      </Pressable>
    );
  }, [cycleMealViewMode, colorScheme, colors.textSecondary]);

  // Construct greeting text
  const hour = new Date().getHours();
  const greetingKey = getGreetingKey(hour);
  const greeting = t(greetingKey);
  const greetingText = `${greeting}, ${effectiveProfile?.first_name || ''}!`;

  // Construct date text
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
    ...(isCurrentYear ? {} : { year: 'numeric' })
  };
  const formattedDate = selectedDate.toLocaleDateString('en-US', dateOptions);
  const dateText = isToday
    ? `${t('common.today')}, ${formattedDate}`
    : selectedDate.getTime() === yesterday.getTime()
    ? `${t('common.yesterday')}, ${formattedDate}`
    : formattedDate;

  // Done CTA: within last N days (today + previous N-1 days)
  // Grace window starts from the earlier of: (today - graceDays) or user's signup date
  const todayKey = toDateKey(new Date());
  const yesterdayKey = addDays(todayKey, -1);
  const calculatedMinDoneCtaKey = addDays(todayKey, -(FOOD_LOG.DONE_CTA_GRACE_DAYS - 1));
  // Use the earlier date: ensure signup date is always included in grace window
  const minDoneCtaKey = minDateKey(calculatedMinDoneCtaKey, userSignupDateKey);
  const shouldShowDoneCta =
    compareDateKeys(selectedDateString, minDoneCtaKey) >= 0 && compareDateKeys(selectedDateString, todayKey) <= 0;

  const maybeStartHomeTour = useCallback(async () => {
    const userId = user?.id;
    const onboardingComplete = (effectiveProfile?.onboarding_complete ?? false) === true;
    if (!userId || !onboardingComplete) return;
    if (activeTourId) return; // already running
    if (isCheckingTourRef.current) return;

    isCheckingTourRef.current = true;
    try {
      const completed = await isTourCompleted('V1_HomePageTour', userId);
      if (completed) return;

      const welcomeShown = await isTourWelcomeShown('V1_HomePageTour', userId);
      if (!welcomeShown) {
        setWelcomeConfettiVisible(true);
        setShowWelcomeModal(true);
        await setTourWelcomeShown('V1_HomePageTour', userId);
        return;
      }

      void startTour('V1_HomePageTour', V1_HOMEPAGE_TOUR_STEPS);
    } finally {
      isCheckingTourRef.current = false;
    }
  }, [activeTourId, effectiveProfile?.onboarding_complete, startTour, user?.id]);

  // First-run welcome + tour start (per account on this device)
  useEffect(() => {
    void maybeStartHomeTour();
    return () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
    };
  }, [maybeStartHomeTour]);

  // Re-check on focus so resetting flags in Settings takes effect immediately.
  useFocusEffect(
    useCallback(() => {
      void maybeStartHomeTour();
      return () => {};
    }, [maybeStartHomeTour])
  );

  // Handle welcome modal "Get started" button click
  const handleWelcomeModalConfirm = useCallback(() => {
    setShowWelcomeModal(false);
    void startTour('V1_HomePageTour', V1_HOMEPAGE_TOUR_STEPS);
  }, [startTour]);

  // Drive UI on step start: expand "Other limits" section on step 4/9 (home-macros)
  useEffect(() => {
    const unsubscribe = registerOnStepChange((tourId, step) => {
      if (tourId !== 'V1_HomePageTour') return;
      
      if (step.id === 'home-macros') {
        // Expand "Other limits" section if it's collapsed, then re-measure to include mini gauges
        if (isMiniGaugesCollapsed) {
          setIsMiniGaugesCollapsed(false);
          // Wait for expansion animation to complete before re-measuring
          setTimeout(() => {
            requestRemeasure();
          }, 250);
        } else {
          // Already expanded, just re-measure to ensure spotlight includes mini gauges
          requestRemeasure();
        }
      }
    });
    return unsubscribe;
  }, [isMiniGaugesCollapsed, registerOnStepChange, requestRemeasure]);

  return (
    <ThemedView style={styles.container}>
      <ConfettiBurst visible={welcomeConfettiVisible} onDone={() => setWelcomeConfettiVisible(false)} />
      <ConfirmModal
        visible={showWelcomeModal}
        title={t('tour.home_welcome.title')}
        message={t('tour.home_welcome.message') + ' Let\'s take a quick tour to get you started.'}
        confirmText={t('tour.welcome.get_started')}
        cancelText={null}
        onConfirm={handleWelcomeModalConfirm}
        onCancel={handleWelcomeModalConfirm}
        animationType="fade"
      />
      <OfflineBanner />
      <CollapsibleModuleHeader
        greetingText={greetingText}
        dateText={dateText}
        rightAvatarUri={effectiveProfile?.avatar_url ?? undefined}
        preferredName={effectiveProfile?.first_name ?? undefined}
        rightAction={
          <DatePickerButton
            selectedDate={selectedDate}
            onDateSelect={navigateWithDate}
            today={today}
            minimumDate={minDate}
            maximumDate={today}
            module="food"
          />
        }
        goBackOneDay={
          canGoBack
            ? () => {
                const prevDateKey = addDays(selectedDateString, -1);
                navigateWithDate(prevDateKey);
              }
            : undefined
        }
        goForwardOneDay={() => {
          if (!isToday) {
            const nextDateKey = addDays(selectedDateString, 1);
            navigateWithDate(nextDateKey);
          }
        }}
        isToday={isToday}
        module="food"
        scrollViewRef={scrollViewRef}
        refreshControl={
          Platform.OS !== 'web' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Platform.OS === 'ios' ? colors.tint : undefined}
              colors={Platform.OS === 'android' ? [colors.tint] : undefined}
              progressBackgroundColor={Platform.OS === 'android' ? colors.background : undefined}
            />
          ) : undefined
        }
        onScroll={(e) => {
          scrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
          if (Platform.OS === 'web') handleWebScroll(e);
        }}
        scrollEventThrottle={16}
      >
        {/* Desktop Container for Header and Content */}
        <DesktopPageContainer>

            {/* Daily Totals Summary */}
            <View style={[styles.dailyTotalsCard, { backgroundColor: colors.card }]}>
              <SummaryCardHeader
                titleKey="home.summary.title_other"
                icon="fork.knife"
                isLoading={showLoadingSpinner}
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: colors.separator,
                  paddingHorizontal: 0,
                  paddingBottom: 2,
                }}
              />

              <View ref={tourCurvyGaugeRef as any} style={styles.calorieGaugeWrap}>
                <CalorieCurvyGauge consumed={calorieConsumed} target={calorieTarget} goalType={goalType} />

                <TouchableOpacity
                  style={[
                    styles.calorieTargetsGearButtonAbsolute,
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                  ]}
                  onPress={() => router.push('/settings/my-goal/edit-calories?from=home')}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  {...getButtonAccessibilityProps(
                    t('settings.my_goal.a11y.edit_calories'),
                    t('settings.my_goal.a11y.navigate_to_edit')
                  )}
                >
                  <IconSymbol name="gearshape" size={18} color={colors.textSecondary} decorative={true} />
                </TouchableOpacity>
              </View>
            
            {(entries.length > 0 || !showLoadingSpinner) && (
              <View style={styles.dailyTotalsContent}>
                <EnergyBalanceBlock
                  burnedCal={dailyBurned?.tdee_cal ?? null}
                  eatenCal={calorieConsumed}
                  goalType={goalType}
                  colors={colors}
                  t={t}
                  onEditBurned={() => setBurnedModalVisible(true)}
                  tourContainerRef={tourBurnedEatenNetRef}
                  tourBurnedPencilRef={tourBurnedPencilRef}
                />

                {/* Macro Gauges block (tour: home.macrosAndOtherLimits) */}
                <View ref={tourMacrosAndOtherLimitsRef as any}>
                  {/* Macro Gauges Row */}
                  <View style={styles.macroGaugeRowWrap}>
                    <View style={styles.macroGaugeRow}>
                      <View style={styles.macroGaugeRowGauges}>
                        <View
                          style={[
                            { flexDirection: 'row' },
                            // RN style types don't include web-only `columnGap`, so we cast for web-only usage.
                            Platform.OS === 'web' ? ({ columnGap: 4 } as any) : null,
                          ]}
                        >
                          {/* Protein */}
                          <View style={{ flex: 1, ...(Platform.OS !== 'web' ? { marginRight: 4 } : {}) }}>
                            <MacroGauge label={t('home.summary.protein')} value={proteinConsumed} target={proteinTarget} unit="g" size="sm" mode="min" />
                          </View>

                          {/* Fiber */}
                          <View style={{ flex: 1, ...(Platform.OS !== 'web' ? { marginRight: 4 } : {}) }}>
                            <MacroGauge label={t('home.summary.fiber')} value={fiberConsumed} target={fiberTarget} unit="g" size="sm" mode="min" />
                          </View>

                          {/* Carbs */}
                          <View style={{ flex: 1 }}>
                            <MacroGauge label={t('home.summary.carbs')} value={carbsConsumed} target={carbsMax} unit="g" size="sm" mode="max" />
                          </View>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.macroTargetsGearButtonAbsolute,
                        getMinTouchTargetStyle(),
                        Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                      ]}
                      onPress={() => router.push('/settings/my-goal/edit-targets?from=home')}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      {...getButtonAccessibilityProps(
                        t('settings.my_goal.a11y.edit_targets'),
                        t('settings.my_goal.a11y.navigate_to_edit')
                      )}
                    >
                      <IconSymbol name="gearshape" size={18} color={colors.textSecondary} decorative={true} />
                    </TouchableOpacity>
                  </View>

                  {/* Mini Gauges Section - Collapsible */}
                  <CollapsibleSection
                  title={t('home.summary.other_limits')}
                  isCollapsed={isMiniGaugesCollapsed}
                  onToggle={() => setIsMiniGaugesCollapsed(!isMiniGaugesCollapsed)}
                  accessibilityLabel={t('home.summary.toggle_other_limits')}
                  titlePosition="right"
                  headerStyle={{
                    borderBottomWidth: 0,
                    paddingVertical: Spacing.xxs,
                    paddingTop: Spacing.xxs,
                    paddingBottom: Spacing.xxs,
                    minHeight: 32,
                  }}
                  titleStyle={{
                    fontSize: FontSize.sm,
                    fontWeight: FontWeight.regular,
                  }}
                  contentStyle={{
                    paddingTop: Spacing.none,
                    paddingBottom: Spacing.none,
                  }}
                >
                  <View style={styles.miniGaugeRow}>
                    <View style={[styles.miniGaugeItem, styles.miniGaugeItemSpaced]}>
                      <MiniRingGauge
                        label={t('home.summary.sugar')}
                        value={sugarConsumedG}
                        target={sugarMaxG}
                        unit={t('units.g')}
                        size="xs"
                      />
                    </View>

                    <View style={[styles.miniGaugeItem, styles.miniGaugeItemSpaced]}>
                      <MiniRingGauge
                        label={t('home.summary.sodium')}
                        value={sodiumConsumedMg}
                        target={sodiumMaxMg}
                        unit={t('units.mg')}
                        size="xs"
                      />
                    </View>

                    <View style={[styles.miniGaugeItem, styles.miniGaugeItemSpaced]}>
                      <MiniRingGauge
                        label={t('home.summary.saturated_fat')}
                        value={satFatConsumedG}
                        target={satFatLimitG}
                        unit={t('units.g')}
                        size="xs"
                      />
                    </View>

                    <View style={styles.miniGaugeItem}>
                      <MiniRingGauge
                        label={t('home.summary.trans_fat')}
                        value={transFatConsumedG}
                        target={transFatLimitG}
                        unit={t('units.g')}
                        size="xs"
                        valueFormat="ceilToTenth"
                      />
                    </View>
                  </View>
                </CollapsibleSection>
                </View>
              </View>
            )}
          </View>

          {/* Today's Calorie Entries */}
          <View ref={tourMealLogRef as any} style={[styles.entriesSectionCard, { backgroundColor: colors.card }]}>
            <View style={styles.entriesSection}>
              {showLoadingSpinner ? (
                <View style={[styles.emptyState, { backgroundColor: 'transparent' }]}>
                  <ActivityIndicator size="small" color={colors.tint} />
                  <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    {t('home.summary.loading_entries')}
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.entriesList}>
                {sortedMealTypes.map((mealType, index) => {
                  const group = groupedEntries[mealType];
                  // Use i18n for meal type labels
                  const mealTypeLabel = t(`home.meal_types.${mealType}`);
                  // Check if mealtype_meta has meaningful data (notes)
                  // Only hide the "Copy from yesterday" button if there's actual data, not just an empty row
                  const meta = dataByMealType[mealType];
                  const hasNotes = meta?.note != null && meta.note.trim().length > 0;
                  const isLast = index === sortedMealTypes.length - 1;
                  
                  return (
                    <View key={mealType}>
                      <View 
                        ref={mealType === 'afternoon_snack' ? (tourMealSnackRef as any) : undefined}
                        style={styles.mealGroupContainer}
                      >
                      {/* Meal Type Header with Totals and Log Food Button */}
                      <View style={styles.mealGroupHeader}>
                        <View style={styles.mealGroupHeaderLeft}>
                          <TouchableOpacity
                            style={[
                              styles.mealTypeBadge, 
                              getMinTouchTargetStyle(),
                              { 
                                backgroundColor: colorScheme === 'dark' ? colors.tint + '25' : colors.tint + '12',
                                ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                              }
                            ]}
                            onPress={() => {
                              // Filter entries for this meal type and date (may be empty array if no entries)
                              const mealTypeEntries = group.entries.filter(entry => 
                                entry.meal_type.toLowerCase() === mealType.toLowerCase() &&
                                entry.entry_date === selectedDateString
                              );
                              // Always go to mealtype-log page (whether entries exist or not)
                              router.push({
                                pathname: '/(tabs)/mealtype-log',
                                params: { 
                                  mealType: mealType,
                                  entryDate: selectedDateString,
                                  preloadedEntries: JSON.stringify(mealTypeEntries)
                                }
                              });
                            }}
                            activeOpacity={0.7}
                            {...getButtonAccessibilityProps(
                              `Log food for ${mealTypeLabel}`,
                              t('home.accessibility.log_food_hint', { mealType: mealTypeLabel })
                            )}
                          >
                            <View style={styles.mealTypeBadgeContent}>
                              <ThemedText style={[styles.mealTypeText, { color: colors.tint }]}>
                                {mealTypeLabel}
                              </ThemedText>
                              <View 
                                style={styles.mealTypeEditIcons}
                                accessibilityElementsHidden={true}
                                importantForAccessibility="no-hide-descendants"
                              >
                                <IconSymbol name="pencil" size={12} color={colors.tint} decorative={true} />
                                <IconSymbol name="fork.knife" size={12} color={colors.tint} decorative={true} />
                              </View>
                            </View>
                          </TouchableOpacity>
                          {/* Show toggle when entries exist, "← Log Food" when no entries */}
                          {group.entries.length > 0 
                            ? renderMealViewToggle(mealType, mealViewModes[mealType] ?? DEFAULT_MEAL_VIEW_MODE)
                            : (
                              <TouchableOpacity
                                style={[
                                  styles.addFoodPrompt,
                                  getMinTouchTargetStyle(),
                                  Platform.OS === 'web' && getFocusStyle(colors.tint),
                                ]}
                                onPress={() => {
                                  // Filter entries for this meal type and date (may be empty array if no entries)
                                  const mealTypeEntries = group.entries.filter(entry => 
                                    entry.meal_type.toLowerCase() === mealType.toLowerCase() &&
                                    entry.entry_date === selectedDateString
                                  );
                                  // Always go to mealtype-log page (whether entries exist or not)
                                  router.push({
                                    pathname: '/(tabs)/mealtype-log',
                                    params: { 
                                      mealType: mealType,
                                      entryDate: selectedDateString,
                                      preloadedEntries: JSON.stringify(mealTypeEntries)
                                    }
                                  });
                                }}
                                activeOpacity={0.7}
                                {...getButtonAccessibilityProps(
                                  `Log food for ${mealTypeLabel}`,
                                  t('home.accessibility.log_food_hint', { mealType: mealTypeLabel })
                                )}
                              >
                                <ThemedText style={[styles.addFoodPromptText, { color: colors.tint }]}>
                                  {t('home.food_log.log_food_prompt')}
                                </ThemedText>
                              </TouchableOpacity>
                            )
                          }
                        </View>
                        <View style={styles.mealGroupHeaderRight}>
                          {/* Show calories when there are entries - wrap in fixed-width container for alignment */}
                          {group.entries.length > 0 && (
                            <View style={[styles.calCol, { width: CAL_COL_WIDTH }]}>
                              <TouchableOpacity
                                style={[
                                  styles.mealGroupCalories,
                                  getMinTouchTargetStyle(),
                                  Platform.OS === 'web' && getFocusStyle(colors.tint),
                                ]}
                                onPress={() => {
                                  // Filter entries for this meal type and date (may be empty array if no entries)
                                  const mealTypeEntries = group.entries.filter(entry => 
                                    entry.meal_type.toLowerCase() === mealType.toLowerCase() &&
                                    entry.entry_date === selectedDateString
                                  );
                                  // Always go to mealtype-log page (whether entries exist or not)
                                  router.push({
                                    pathname: '/(tabs)/mealtype-log',
                                    params: { 
                                      mealType: mealType,
                                      entryDate: selectedDateString,
                                      preloadedEntries: JSON.stringify(mealTypeEntries)
                                    }
                                  });
                                }}
                                activeOpacity={0.7}
                                {...getButtonAccessibilityProps(
                                  `Log food for ${mealTypeLabel}`,
                                  t('home.accessibility.log_food_hint', { mealType: mealTypeLabel })
                                )}
                              >
                                <ThemedText style={[styles.mealGroupCaloriesValue, { color: colors.tint }]}>
                                  {Math.round(group.totalCalories)} {t('home.food_log.kcal')}
                                </ThemedText>
                              </TouchableOpacity>
                            </View>
                          )}
                          {/* 3-dot menu button */}
                          <TouchableOpacity
                            style={[
                              styles.mealMoreButton,
                              getMinTouchTargetStyle(),
                              Platform.OS === 'web' && getFocusStyle(colors.tint),
                            ]}
                            onPress={() => {
                              setThreeDotMealMenuVisible({ mealType });
                            }}
                            activeOpacity={0.7}
                            {...getButtonAccessibilityProps(
                              `More options for ${mealTypeLabel}`,
                              `Open menu for ${mealTypeLabel}`
                            )}
                          >
                            <IconSymbol name="ellipsis" size={20} color={colors.textSecondary} decorative />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Copy from yesterday button - only show when no entries AND no notes */}
                      {group.entries.length === 0 && !hasNotes && (
                        <View style={styles.copyFromYesterdayContainer}>
                          <MealTypeCopyButton
                            mealType={mealType}
                            mealTypeLabel={mealTypeLabel}
                            selectedDate={selectedDate}
                            isToday={isToday}
                            colors={colors}
                            t={t}
                          />
                        </View>
                      )}

                      {/* Conditional rendering based on view mode (only when entries exist) */}
                      {group.entries.length > 0 && (() => {
                        const mode = mealViewModes[mealType] ?? DEFAULT_MEAL_VIEW_MODE;
                        
                        // Collapsed: render nothing below header
                        if (mode === 'collapsed') {
                          return null;
                        }
                        
                        // Semi: consolidated view (existing behavior)
                        if (mode === 'semi') {
                          const consolidatedItems = group.entries
                            .map(entry => formatMealEntryLabel(entry))
                            .join(', ');
                          
                          return (
                            <>
                              <View style={styles.mealGroupItems}>
                                <TouchableOpacity
                                  key={`items-${mealType}`}
                                  style={[
                                    styles.mealGroupItem,
                                    getMinTouchTargetStyle(),
                                    { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) }
                                  ]}
                                  onPress={() => {
                                    // Filter entries for this meal type and date (may be empty array if no entries)
                                    const mealTypeEntries = group.entries.filter(entry => 
                                      entry.meal_type.toLowerCase() === mealType.toLowerCase() &&
                                      entry.entry_date === selectedDateString
                                    );
                                    // Always go to mealtype-log page (whether entries exist or not)
                                    router.push({
                                      pathname: '/(tabs)/mealtype-log',
                                      params: { 
                                        mealType: mealType,
                                        entryDate: selectedDateString,
                                        preloadedEntries: JSON.stringify(mealTypeEntries)
                                      }
                                    });
                                  }}
                                  activeOpacity={0.7}
                                  {...getButtonAccessibilityProps(
                                    `Log food for ${mealTypeLabel}`,
                                    t('home.accessibility.log_food_hint', { mealType: mealTypeLabel })
                                  )}
                                >
                                  <View style={styles.mealGroupItemLeft}>
                                    <ThemedText 
                                      style={[styles.mealGroupItemName, { color: colors.text }]}
                                      numberOfLines={6}
                                      ellipsizeMode="tail"
                                    >
                                      {consolidatedItems}
                                    </ThemedText>
                                  </View>
                                </TouchableOpacity>
                              </View>
                              {/* Notes row - visible in semi mode */}
                              {dataByMealType[mealType]?.note && dataByMealType[mealType].note.trim().length > 0 && (
                                <TouchableOpacity
                                  style={[
                                    styles.noteRow,
                                    getMinTouchTargetStyle(),
                                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                                  ]}
                                  onPress={() => {
                                    setNoteEditor({ visible: true, mealType });
                                  }}
                                  activeOpacity={0.7}
                                  {...getButtonAccessibilityProps(
                                    t('food.note.edit', { mealType: mealTypeLabel })
                                  )}
                                >
                                  <ThemedText
                                    style={[styles.noteRowText, { color: colors.text }]}
                                    numberOfLines={2}
                                    ellipsizeMode="tail"
                                  >
                                    📝 {dataByMealType[mealType].note}
                                  </ThemedText>
                                </TouchableOpacity>
                              )}
                            </>
                          );
                        }
                        
                        // Expanded: individual rows for each entry
                        const mealTypeEntries = group.entries.filter(entry => 
                          entry.meal_type.toLowerCase() === mealType.toLowerCase() &&
                          entry.entry_date === selectedDateString
                        );
                        
                        return (
                          <>
                            <View style={styles.mealExpandedContainer}>
                              {mealTypeEntries.map((entry, idx) => (
                                <View key={entry.id ?? idx}>
                                  <TouchableOpacity
                                    style={[
                                      styles.mealItemRow,
                                      getMinTouchTargetStyle(),
                                      Platform.OS === 'web' && getFocusStyle(colors.tint),
                                    ]}
                                    onPress={() => {
                                      // Navigate to mealtype-log page
                                      router.push({
                                        pathname: '/(tabs)/mealtype-log',
                                        params: { 
                                          mealType: mealType,
                                          entryDate: selectedDateString,
                                          preloadedEntries: JSON.stringify(mealTypeEntries)
                                        }
                                      });
                                    }}
                                    activeOpacity={0.7}
                                    {...getButtonAccessibilityProps(
                                      `View ${entry.item_name}`,
                                      t('home.accessibility.log_food_hint', { mealType: mealTypeLabel })
                                    )}
                                  >
                                    <View style={styles.mealItemNameContainer}>
                                      <ThemedText style={[styles.mealItemName, { color: colors.text }]} numberOfLines={1}>
                                        {entry.item_name}
                                      </ThemedText>
                                      {entry.food_id && (
                                        <ThemedText style={[styles.mealItemAmount, { color: colors.textSecondary }]} numberOfLines={1}>
                                          {Math.round(entry.quantity) === entry.quantity 
                                            ? entry.quantity.toString() 
                                            : entry.quantity.toFixed(1)} x {entry.unit}
                                        </ThemedText>
                                      )}
                                    </View>
                                    <View style={[styles.calCol, { width: CAL_COL_WIDTH }]}>
                                      <ThemedText style={[styles.mealItemCalories, { color: colors.text }]}>
                                        {Math.round(entry.calories_kcal)} {t('home.food_log.kcal')}
                                      </ThemedText>
                                    </View>
                                  </TouchableOpacity>
                                  {idx < mealTypeEntries.length - 1 && (
                                    <View style={[styles.mealItemDivider, { backgroundColor: colors.separator }]} />
                                  )}
                                </View>
                              ))}
                            </View>
                            {/* Notes row - visible in expanded mode */}
                            {dataByMealType[mealType]?.note && dataByMealType[mealType].note.trim().length > 0 && (
                              <TouchableOpacity
                                style={[
                                  styles.noteRow,
                                  getMinTouchTargetStyle(),
                                  Platform.OS === 'web' && getFocusStyle(colors.tint),
                                ]}
                                onPress={() => {
                                  setNoteEditor({ visible: true, mealType });
                                }}
                                activeOpacity={0.7}
                                {...getButtonAccessibilityProps(
                                  t('food.note.edit', { mealType: mealTypeLabel })
                                )}
                              >
                                <ThemedText
                                  style={[styles.noteRowText, { color: colors.text }]}
                                  numberOfLines={2}
                                  ellipsizeMode="tail"
                                >
                                  📝 {dataByMealType[mealType].note}
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                          </>
                        );
                      })()}
                      </View>
                      {!isLast && (
                        <View style={[styles.mealTypeDivider, { backgroundColor: colors.separator }]} />
                      )}
                    </View>
                  );
                })}
                </View>
              )}
            </View>

            {/* Done CTA (within grace window) - acts on the currently viewed date */}
            {shouldShowDoneCta && (
              <DoneForTodayButton
                selectedDateKey={selectedDateString}
                todayKey={todayKey}
                yesterdayKey={yesterdayKey}
                formattedSelectedDate={formattedDate}
                tourAnchorRef={tourCallItADayRef}
              />
            )}
          </View>
          </DesktopPageContainer>
      </CollapsibleModuleHeader>

      {/* Meal Type Options Menu Modal */}
      <Modal
        visible={threeDotMealMenuVisible.mealType !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setThreeDotMealMenuVisible({ mealType: null })}
      >
        {/* Use a non-button overlay container to avoid nested <button> on web (AODA/WCAG + hydration-safe). */}
        <View
          style={[styles.threeDotMealMenuOverlay, { backgroundColor: colors.overlay }]}
          accessible={false}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => setThreeDotMealMenuVisible({ mealType: null })}
        >
          {/* Stop outside-click closing when interacting with the menu content */}
          <View
            accessibilityViewIsModal={true}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.threeDotMealMenuContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Close button header */}
              <View style={styles.threeDotMealMenuHeader}>
                <TouchableOpacity
                  style={[
                    styles.threeDotMealMenuCloseButton,
                    getMinTouchTargetStyle(),
                    Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                  ]}
                  onPress={() => setThreeDotMealMenuVisible({ mealType: null })}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(t('common.close'), t('common.close_hint'))}
                >
                  <IconSymbol name="xmark" size={20} color={colors.textSecondary} decorative />
                </TouchableOpacity>
              </View>
              {threeDotMealMenuVisible.mealType && (() => {
                // Calculate if there's anything to copy for this meal type
                const currentMealType = threeDotMealMenuVisible.mealType;
                const mealTypeEntries = groupedEntries[currentMealType as keyof typeof groupedEntries]?.entries ?? [];
                const mealMeta = dataByMealType[currentMealType];
                const hasAnythingToCopy =
                  mealTypeEntries.length > 0 || (mealMeta?.note?.trim()?.length ?? 0) > 0;

                return (
                  <>
                    <TouchableOpacity
                      style={styles.threeDotMealMenuItem}
                      onPress={() => handleQuickLog(threeDotMealMenuVisible.mealType!)}
                      activeOpacity={0.7}
                      {...getButtonAccessibilityProps(
                        t('home.meal_menu.quick_log_a11y_label', {
                          mealType: t(`home.meal_types.${threeDotMealMenuVisible.mealType}`),
                        }),
                        t('home.meal_menu.quick_log_a11y_hint', {
                          mealType: t(`home.meal_types.${threeDotMealMenuVisible.mealType}`),
                        })
                      )}
                    >
                      <ThemedText style={[styles.threeDotMealMenuItemText, { color: colors.text }]}>
                        ⚡ {t('home.meal_menu.quick_log')}
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.threeDotMealMenuItem}
                      onPress={() => {
                        if (hasAnythingToCopy) {
                          handleCopyTo(threeDotMealMenuVisible.mealType!);
                        }
                      }}
                      activeOpacity={hasAnythingToCopy ? 0.7 : 1}
                      disabled={!hasAnythingToCopy}
                      {...getButtonAccessibilityProps(
                        t('home.meal_menu.copy_to_another_date_a11y', {
                          mealType: t(`home.meal_types.${threeDotMealMenuVisible.mealType}`),
                        }),
                        t('home.meal_menu.copy_to_another_date_a11y', {
                          mealType: t(`home.meal_types.${threeDotMealMenuVisible.mealType}`),
                        })
                      )}
                    >
                      <View style={styles.threeDotMealMenuItemWithIcon}>
                        <IconSymbol
                          name="doc.on.doc"
                          size={16}
                          color={hasAnythingToCopy ? colors.text : colors.textSecondary}
                          decorative
                        />
                        <ThemedText
                          style={[
                            styles.threeDotMealMenuItemText,
                            {
                              color: hasAnythingToCopy ? colors.text : colors.textSecondary,
                              marginLeft: Spacing.sm,
                              opacity: hasAnythingToCopy ? 1 : 0.5,
                            },
                          ]}
                        >
                          {t('food.menu.copy_to')}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.threeDotMealMenuItem}
                      onPress={() => {
                        if (hasAnythingToCopy) {
                          handleMoveTo(threeDotMealMenuVisible.mealType!);
                        }
                      }}
                      activeOpacity={hasAnythingToCopy ? 0.7 : 1}
                      disabled={!hasAnythingToCopy}
                      {...getButtonAccessibilityProps(
                        t('home.meal_menu.move_to_another_date_a11y', {
                          mealType: t(`home.meal_types.${threeDotMealMenuVisible.mealType}`),
                        }),
                        t('home.meal_menu.move_to_another_date_a11y', {
                          mealType: t(`home.meal_types.${threeDotMealMenuVisible.mealType}`),
                        })
                      )}
                    >
                      <View style={styles.threeDotMealMenuItemWithIcon}>
                        <IconSymbol
                          name="doc.on.doc"
                          size={16}
                          color={hasAnythingToCopy ? colors.text : colors.textSecondary}
                          decorative
                        />
                        <ThemedText
                          style={[
                            styles.threeDotMealMenuItemText,
                            {
                              color: hasAnythingToCopy ? colors.text : colors.textSecondary,
                              marginLeft: Spacing.sm,
                              opacity: hasAnythingToCopy ? 1 : 0.5,
                            },
                          ]}
                        >
                          {t('food.menu.move_to')}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.threeDotMealMenuItem}
                      onPress={() => handleNotes(threeDotMealMenuVisible.mealType!)}
                      activeOpacity={0.7}
                      {...getButtonAccessibilityProps(
                        t('home.meal_menu.notes_a11y_label', {
                          mealType: t(`home.meal_types.${threeDotMealMenuVisible.mealType}`),
                        }),
                        t('home.meal_menu.notes_a11y_hint', {
                          mealType: t(`home.meal_types.${threeDotMealMenuVisible.mealType}`),
                        })
                      )}
                    >
                      <ThemedText style={[styles.threeDotMealMenuItemText, { color: colors.text }]}>
                        📝 {t('food.menu.notes')}
                      </ThemedText>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </View>
        </View>
      </Modal>


      {/* Note Editor */}
      {noteEditor.mealType && (
        <NoteEditor
          visible={noteEditor.visible}
          onClose={() => setNoteEditor({ visible: false, mealType: null })}
          onSave={(note) => handleNoteSave(noteEditor.mealType!, note)}
          initialNote={dataByMealType[noteEditor.mealType]?.note ?? null}
          mealTypeLabel={t(`home.meal_types.${noteEditor.mealType}`)}
          isLoading={upsertMealtypeMetaMutation.isPending}
        />
      )}

      {/* Transfer Mealtype Modal (Copy or Move) */}
      {transferMealtypeModal.mealType && (
        <CopyMealtypeModal
          visible={transferMealtypeModal.visible}
          onClose={() => setTransferMealtypeModal({ visible: false, mealType: null, mode: 'copy' })}
          onConfirm={(targetDate, targetMealType, includeNotes) => handleTransferConfirm(
            transferMealtypeModal.mealType!, 
            targetDate, 
            targetMealType, 
            includeNotes, 
            transferMealtypeModal.mode
          )}
          sourceDate={selectedDate}
          minimumDate={minDate}
          maximumDate={today}
          sourceMealType={transferMealtypeModal.mealType}
          isLoading={transferMealtypeMutation.isPending}
          mode={transferMealtypeModal.mode}
        />
      )}

      <BurnedCaloriesModal
        visible={burnedModalVisible}
        onClose={() => setBurnedModalVisible(false)}
        entryDate={selectedDateString}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calorieGaugeWrap: {
    paddingHorizontal: 0, // card already has left/right padding
    // Keep content clearly below the header separator line (avoid overlap with settings gear)
    marginTop: Spacing.none,
    marginBottom: -18, // pull macro gauges up under the curve
    position: 'relative',
  },
  calorieTargetsGearButtonAbsolute: {
    position: 'absolute',
    right: 0,
    // Anchor just below the nearest separator line
    top: Spacing.xxs,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  macroGaugeRowWrap: {
    // Keep content clearly below the Energy Balance separator line (avoid overlap with settings gear)
    marginTop: Spacing.none,
    position: 'relative',
  },
  macroGaugeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  macroGaugeRowGauges: {
    flex: 1,
    minWidth: 0,
    // Reserve space for the gear button while keeping gauges centered
    paddingLeft: 0,
    paddingRight: 0,
  },
  macroTargetsGearButtonAbsolute: {
    position: 'absolute',
    // Anchor just below the nearest separator line
    top: Nudge.none,
    right: 0,
    padding: 4,
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
    ...(Platform.OS !== 'web' && {
      paddingBottom: 100, // Extra padding for FAB on mobile
    }),
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
    minWidth: 0, // Allow text to wrap
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  greeting: {
    fontSize: Platform.select({ web: 11, default: 12 }),
    opacity: 0.8,
    fontWeight: '500',
    marginRight: 4,
  },
  welcomeText: {
    fontSize: Platform.select({ web: 18, default: 16 }),
    fontWeight: 'bold',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  profileIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  refreshIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: Platform.select({ web: 8, default: 4 }),
    paddingHorizontal: 0,
  },
  dateNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  dateNavButtonSimple: {
    paddingHorizontal: Platform.select({ web: 4, default: 4 }),
    paddingVertical: Platform.select({ web: 4, default: 4 }),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44, // Better touch target
    minHeight: 44,
  },
  dateNavIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  dateNavButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  todayButton: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dateNavButtonText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    flexShrink: 1,
    paddingHorizontal: Platform.select({ web: 4, default: 2 }),
  },
  dateDisplayText: {
    fontSize: Platform.select({ web: 14, default: 13 }),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
    paddingHorizontal: 0,
    flexShrink: 1,
  },
  dailyTotalsCard: {
    paddingVertical: Platform.select({ web: 14, default: 12 }),
    paddingHorizontal: Spacing.lg, // Match Exercise/Meds for consistent left margin (16px)
    borderRadius: Platform.select({ web: 16, default: 14 }),
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
        transition: 'box-shadow 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  energyBalanceWrap: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    // Keep layout tight without pulling the next section into the separator line
    marginBottom: Spacing.xs,
  },
  energyBalanceRowNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  energyBalanceRowLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  energyBalanceCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  energyBalanceOp: {
    width: 16,
    textAlign: 'center',
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
    fontWeight: '600',
  },
  energyBalanceNumber: {
    fontSize: Platform.select({ web: FontSize.lg, default: FontSize.md }),
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  energyBalanceUnderline: {
    textDecorationLine: 'underline',
  },
  energyBalanceBurnedTapTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyBalanceBurnedNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyBalanceEmoji: {
    marginLeft: 5,
    fontSize: 13,
    ...Platform.select({
      // Ensure colored emoji rendering on web/Windows (app default font is Inter).
      web: {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji',
      },
      default: {},
    }),
  },
  energyBalanceEmojiInline: {
    fontSize: 12,
    ...Platform.select({
      web: {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji',
      },
      default: {},
    }),
  },
  energyBalanceLabel: {
    fontSize: Platform.select({ web: FontSize.sm, default: FontSize.xs }),
    fontWeight: '500',
  },
  miniGaugeSection: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  miniGaugeRow: {
    flexDirection: 'row',
    paddingTop: Spacing.none,
    paddingBottom: Spacing.none,
  },
  miniGaugeItem: {
    flex: 1,
  },
  miniGaugeItemSpaced: {
    marginRight: Spacing.sm,
  },
  dailyTotalsContent: {
    gap: 0,
  },
  dailyTotalsMainRow: {
    flexDirection: Platform.select({ web: 'row', default: 'column' }),
    justifyContent: 'space-between',
    alignItems: Platform.select({ web: 'flex-start', default: 'stretch' }),
    gap: Platform.select({ web: 24, default: 16 }),
  },
  dailyTotalItem: {
    flexDirection: 'column',
    flexShrink: 0,
    minWidth: Platform.select({ web: 160, default: undefined }),
    maxWidth: Platform.select({ web: undefined, default: '100%' }),
  },
  dailyTotalLabel: {
    fontSize: Platform.select({ web: 10, default: 11 }),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '500',
    marginBottom: 6,
    lineHeight: Platform.select({ web: 14, default: 15 }),
  },
  dailyTotalValue: {
    fontSize: Platform.select({ web: 28, default: 24 }),
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: Platform.select({ web: 34, default: 30 }),
    flexShrink: 0,
  },
  dailyMacrosContainer: {
    flex: Platform.select({ web: 1, default: 0 }),
    alignItems: Platform.select({ web: 'flex-end', default: 'flex-start' }),
    justifyContent: 'flex-start',
    width: Platform.select({ web: 'auto', default: '100%' }),
    minWidth: 0,
  },
  macroGaugeBar: {
    flexDirection: 'row',
    width: '100%',
    height: Platform.select({ web: 10, default: 8 }),
    overflow: 'hidden',
    marginBottom: 6,
  },
  macroGaugeSegment: {
    minWidth: 2,
  },
  macroLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.select({ web: 12, default: 10 }),
    justifyContent: Platform.select({ web: 'flex-end', default: 'flex-start' }),
    alignItems: 'center',
  },
  macroLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  macroLegendText: {
    fontSize: Platform.select({ web: 10, default: 11 }),
    fontWeight: '500',
    lineHeight: Platform.select({ web: 14, default: 15 }),
  },
  dailyMacrosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.select({ web: 24, default: 20 }),
    justifyContent: Platform.select({ web: 'flex-end', default: 'flex-start' }),
    alignItems: 'flex-start',
  },
  dailyMacroItem: {
    alignItems: 'flex-start',
    minWidth: Platform.select({ web: 65, default: 70 }),
  },
  dailyMacroLabel: {
    fontSize: Platform.select({ web: 10, default: 11 }),
    fontWeight: '500',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: Platform.select({ web: 14, default: 15 }),
  },
  dailyMacroValue: {
    fontSize: Platform.select({ web: 16, default: 17 }),
    fontWeight: '600',
    lineHeight: Platform.select({ web: 22, default: 24 }),
  },
  subFatsSection: {
    marginTop: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderTopWidth: 1,
  },
  subFatsHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 0,
    paddingVertical: 0,
  },
  subFatsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subFatsTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  subFatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    justifyContent: 'flex-start',
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  subFatItem: {
    alignItems: 'flex-start',
    minWidth: Platform.select({ web: 80, default: 70 }),
    marginVertical: 0,
    paddingVertical: 0,
  },
  subFatLabel: {
    fontSize: Platform.select({ web: 9, default: 10 }),
    fontWeight: '500',
    marginBottom: 0,
    marginTop: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  subFatValue: {
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '600',
  },
  entriesSectionCard: {
    padding: Platform.select({ web: 16, default: 18 }),
    borderRadius: 16,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
        transition: 'box-shadow 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
      },
    }),
  },
  entriesSection: {
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    paddingBottom: 2,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: Platform.select({ web: 18, default: 20 }),
    fontWeight: 'bold',
    letterSpacing: -0.2,
  },
  entryCount: {
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '600',
  },
  entriesList: {
    gap: 0,
  },
  mealGroupContainer: {
    width: '100%',
    marginBottom: Platform.select({ web: 6, default: 8 }),
  },
  mealTypeDivider: {
    height: 2,
    width: '100%',
    marginTop: Platform.select({ web: 0, default: 0 }),
    marginBottom: Platform.select({ web: 0, default: 0 }),
    opacity: 0.6,
  },
  mealGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    flexWrap: 'wrap',
    gap: Platform.select({ web: 4, default: 4 }),
  },
  mealGroupDivider: {
    height: 1,
    width: '100%',
    marginBottom: Platform.select({ web: 0, default: 0 }),
  },
  mealGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ web: 10, default: 8 }),
    flex: Platform.select({ web: 1, default: 1 }),
    flexShrink: 1,
    minWidth: 0,
  },
  mealGroupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  copyFromYesterdayContainer: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    alignItems: 'flex-start',
  },
  copyFromYesterdayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: (44 - 16) / 2, // Ensure minimum touch target
    paddingHorizontal: 0,
    gap: Spacing.xs,
    ...getMinTouchTargetStyle(),
  },
  copyFromYesterdayButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  mealTypeBadge: {
    paddingHorizontal: Platform.select({ web: 14, default: 16 }),
    paddingTop: Platform.select({ web: 0, default: 0 }),
    paddingBottom: Platform.select({ web: 0, default: 0 }),
    borderRadius: 12,
    minHeight: 44, // Better touch target
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  mealTypeBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mealTypeText: {
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    lineHeight: Platform.select({ web: 12, default: 13 }),
    marginBottom: Platform.select({ web: 0, default: 0 }),
    paddingBottom: 0,
    ...Platform.select({
      android: {
        includeFontPadding: false,
        textAlignVertical: 'center',
      },
    }),
  },
  mealTypeEditIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  mealGroupItemCount: {
    fontSize: Platform.select({ web: 11, default: 12 }),
    opacity: 1.0,
    fontWeight: '500',
  },
  mealGroupTotals: {
    alignItems: 'flex-end',
  },
  mealGroupTotalsRow: {
    flexDirection: Platform.select({ web: 'row', default: 'column' }),
    alignItems: Platform.select({ web: 'center', default: 'flex-end' }),
    gap: Platform.select({ web: 12, default: 6 }),
  },
  mealGroupCalories: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 0,
  },
  mealGroupCaloriesValue: {
    fontSize: Platform.select({ web: 15, default: 16 }),
    fontWeight: '600',
    lineHeight: Platform.select({ web: 18, default: 20 }),
    marginTop: 0,
  },
  mealGroupCaloriesLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  addFoodPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  addFoodPromptText: {
    fontSize: Platform.select({ web: 13, default: 13 }),
    fontWeight: '600',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  mealGroupMacrosGrid: {
    flexDirection: 'column',
    gap: Platform.select({ web: 4, default: 1 }),
  },
  mealGroupMacrosRow: {
    flexDirection: 'row',
    gap: Platform.select({ web: 10, default: 2 }),
  },
  mealGroupMacros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: Platform.select({ web: 4, default: 2 }), // Minimal spacing under calories
    width: '100%',
  },
  mealGroupMacroItem: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: Platform.select({ web: 1, default: 0 }), // No vertical spacing
    minWidth: 0, // No minWidth
    paddingHorizontal: Platform.select({ web: 0, default: 0 }), // No horizontal padding
    marginHorizontal: Platform.select({ web: 0, default: 0 }), // No horizontal margin
  },
  mealGroupMacroLabel: {
    fontSize: Platform.select({ web: 9, default: 8 }),
    fontWeight: '600',
    opacity: 1.0,
    margin: 0,
    padding: 0,
    lineHeight: Platform.select({ web: 12, default: 10 }),
  },
  mealGroupMacroValue: {
    fontSize: Platform.select({ web: 10, default: 9 }),
    fontWeight: '600',
    margin: 0,
    padding: 0,
    lineHeight: Platform.select({ web: 12, default: 10 }),
  },
  mealGroupItems: {
    gap: 1,
  },
  mealGroupItemsEmpty: {
    gap: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  mealGroupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.select({ web: 4, default: 6 }),
    paddingHorizontal: 0,
  },
  mealGroupItemEmpty: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  mealGroupItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  mealGroupItemName: {
    fontSize: Platform.select({ web: 13, default: 14 }),
    fontWeight: '500',
    marginBottom: 0,
    opacity: 0.9,
    lineHeight: Platform.select({ web: undefined, default: 20 }),
  },
  mealGroupItemNameEmpty: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 0,
    opacity: 0.6,
  },
  mealGroupItemTime: {
    fontSize: 10,
    opacity: 0.6,
    fontWeight: '400',
  },
  mealGroupItemRight: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  mealGroupItemQuantity: {
    fontSize: 10,
    opacity: 1.0,
    marginBottom: 0,
  },
  mealGroupItemCalories: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  emptyStateText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.7,
    lineHeight: 18,
  },
  loadingModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModalContent: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  logFoodButtonInline: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  logFoodButtonIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calendarButton: {
    width: Platform.select({ web: 44, default: 44 }),
    height: Platform.select({ web: 44, default: 44 }),
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(10, 126, 164, 0.25)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        backdropFilter: 'blur(10px)',
      },
      default: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  datePickerCloseButton: {
    padding: 4,
  },
  datePickerSelectedDateContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  datePickerSelectedDate: {
    fontSize: 24,
    fontWeight: '600',
  },
  datePickerBody: {
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarNavButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarNavArrow: {
    fontSize: 20,
    fontWeight: '600',
  },
  calendarMonthYear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calendarMonthYearText: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarWeekDayText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '400',
  },
  calendarDayTextSelected: {
    fontWeight: '600',
    color: '#fff',
  },
  datePickerFooter: {
    padding: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  datePickerCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerTodayButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 44,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(10, 126, 164, 0.25)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  datePickerTodayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorLogoutButton: {
    paddingHorizontal: Platform.select({ web: 14, default: 16 }),
    paddingVertical: Platform.select({ web: 8, default: 10 }),
    borderRadius: 8,
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  errorLogoutButtonText: {
    color: '#fff',
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  webRefreshIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    ...Platform.select({
      web: {
        transition: 'transform 0.2s ease, opacity 0.2s ease',
      },
    }),
  },
  webRefreshIconContainer: {
    marginBottom: 8,
  },
  webRefreshText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mealMoreButton: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 0,
    marginLeft: Spacing.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealViewToggle: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealViewToggleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  mealViewToggleIcon: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
    ...Platform.select({
      web: { fontFamily: 'ui-sans-serif, system-ui' }, // avoid emoji font fallback on web
      default: {},
    }),
  },
  mealViewToggleText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.85,
  },
  calCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  mealExpandedContainer: {
    paddingTop: 2,
  },
  mealItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    minHeight: 0,
  },
  mealItemNameContainer: {
    flex: 1,
    paddingRight: 10,
  },
  mealItemName: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 0,
  },
  mealItemAmount: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 0,
    opacity: 0.7,
  },
  mealItemCalories: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 0,
    marginBottom: 0,
  },
  mealItemDivider: {
    height: 1,
    marginVertical: 2,
    opacity: 0.25,
  },
  threeDotMealMenuOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threeDotMealMenuContent: {
    minWidth: 200,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  threeDotMealMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  threeDotMealMenuCloseButton: {
    padding: Spacing.xs,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threeDotMealMenuItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  threeDotMealMenuItemWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  threeDotMealMenuItemText: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  quickLogRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: Platform.select({ web: 6, default: 8 }),
    paddingHorizontal: 0,
  },
  quickLogRowText: {
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '500',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Platform.select({ web: 0, default: 0 }),
    paddingHorizontal: 0,
    marginTop: Spacing.none,
  },
  noteRowText: {
    flex: 1,
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '400',
  },
});
