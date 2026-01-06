import { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, TextInput, Alert, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SurfaceCard } from '@/components/common/surface-card';
import { QuickAddHeading } from '@/components/common/quick-add-heading';
import { QuickAddChip } from '@/components/common/quick-add-chip';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { SummaryCardHeader } from '@/components/layout/summary-card-header';
import { CollapsibleModuleHeader } from '@/components/header/CollapsibleModuleHeader';
import { DatePickerButton } from '@/components/header/DatePickerButton';
import { CloneDayModal } from '@/components/clone-day-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { MultiSelectItem } from '@/components/multi-select-item';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { showAppToast } from '@/components/ui/app-toast';
import { HighlightableRow } from '@/components/common/highlightable-row';
import { useAuth } from '@/contexts/AuthContext';
import { useCloneFromPreviousDay } from '@/hooks/use-clone-from-previous-day';
import { useCloneDayEntriesMutation } from '@/hooks/use-clone-day-entries';
import { useCopyFromYesterday } from '@/hooks/useCopyFromYesterday';
import { useMassDeleteEntriesMutation } from '@/hooks/use-mass-delete-entries';
import { useQueryClient } from '@tanstack/react-query';
import { useMedPreferences, useUpdateMedPreferences } from '@/hooks/use-med-preferences';
import { Colors, Spacing, BorderRadius, Shadows, Layout, FontSize, ModuleThemes } from '@/constants/theme';
import { TEXT_LIMITS, RANGES } from '@/constants/constraints';
import { getLocalDateKey } from '@/utils/dateTime';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedDate } from '@/hooks/use-selected-date';
import { useUserConfig } from '@/hooks/use-user-config';
import {
  useMedLogsForDate,
  useMedSummaryForRecentDays,
  useMedRecentAndFrequent,
  useCreateMedLog,
  useUpdateMedLog,
  useDeleteMedLog,
} from '@/hooks/use-med-logs';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

// Common meds and supplements with icons and i18n keys
// Supplements appear first, then meds (per user requirements)
const COMMON_SUPPS: Array<{ i18nKey: string; icon: string; type: 'supp' }> = [
  { i18nKey: 'meds.quick_add.common_supps_list.creatine', icon: 'sparkles', type: 'supp' },
  { i18nKey: 'meds.quick_add.common_supps_list.zinc', icon: 'sparkles', type: 'supp' },
  { i18nKey: 'meds.quick_add.common_supps_list.calcium', icon: 'sparkles', type: 'supp' },
  { i18nKey: 'meds.quick_add.common_supps_list.vit_b12', icon: 'sparkles', type: 'supp' },
  { i18nKey: 'meds.quick_add.common_supps_list.vit_d', icon: 'sparkles', type: 'supp' },
  { i18nKey: 'meds.quick_add.common_supps_list.vit_c', icon: 'sparkles', type: 'supp' },
  { i18nKey: 'meds.quick_add.common_supps_list.multi', icon: 'sparkles', type: 'supp' },
  { i18nKey: 'meds.quick_add.common_supps_list.fish_oil', icon: 'drop.fill', type: 'supp' },
  { i18nKey: 'meds.quick_add.common_supps_list.magnesium', icon: 'sparkles', type: 'supp' },
  { i18nKey: 'meds.quick_add.common_supps_list.probiotic', icon: 'sparkles', type: 'supp' },
  { i18nKey: 'meds.quick_add.common_supps_list.collagen', icon: 'sparkles', type: 'supp' },
];

const COMMON_MEDS: Array<{ i18nKey: string; icon: string; type: 'med' }> = [
  { i18nKey: 'meds.quick_add.common_meds_list.metformin', icon: 'pills.fill', type: 'med' },
  { i18nKey: 'meds.quick_add.common_meds_list.statin', icon: 'pills.fill', type: 'med' },
  { i18nKey: 'meds.quick_add.common_meds_list.levothyroxine', icon: 'pills.fill', type: 'med' },
  { i18nKey: 'meds.quick_add.common_meds_list.lisinopril', icon: 'pills.fill', type: 'med' },
];


// Presentational component for med row
type MedRowProps = {
  log: { id: string; name: string; type: 'med' | 'supp' | 'other'; dose_amount: number | null; dose_unit: string | null; notes: string | null };
  colors: typeof Colors.light;
  onEdit: () => void;
  onDelete: () => void;
  onDoseUpdate: (logId: string, dose_amount: number | null, dose_unit: string | null) => void;
  isLast: boolean;
  animationValue?: Animated.Value;
  t: (key: string) => string;
};

function MedRow({ log, colors, onEdit, onDelete, onDoseUpdate, isLast, animationValue, t, disabled = false }: MedRowProps) {
  const [deleteHovered, setDeleteHovered] = useState(false);
  const [isEditingDose, setIsEditingDose] = useState(false);
  const [doseAmountInput, setDoseAmountInput] = useState(log.dose_amount?.toString() || '');
  const [doseUnitInput, setDoseUnitInput] = useState(log.dose_unit || '');
  const [doseInputError, setDoseInputError] = useState(false);
  const doseAmountInputRef = useRef<TextInput>(null);
  const doseUnitInputRef = useRef<TextInput>(null);
  const isSavingRef = useRef(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Handle dose amount input change - only allow integers within configured range
  const handleDoseAmountInputChange = (text: string) => {
    const numericOnly = text.replace(/[^0-9]/g, '');
    
    if (numericOnly === '') {
      setDoseAmountInput('');
      setDoseInputError(false);
      return;
    }
    
    const numValue = parseInt(numericOnly, 10);
    
    if (!isNaN(numValue) && numValue >= RANGES.MED_DOSE_AMOUNT.MIN && numValue <= RANGES.MED_DOSE_AMOUNT.MAX) {
      setDoseAmountInput(numericOnly);
      setDoseInputError(false);
    } else if (!isNaN(numValue) && numValue > RANGES.MED_DOSE_AMOUNT.MAX) {
      setDoseAmountInput(RANGES.MED_DOSE_AMOUNT.MAX.toString());
      setDoseInputError(false);
    }
  };

  // Start inline editing for dose
  const startEditingDose = () => {
    setIsEditingDose(true);
    setDoseAmountInput(log.dose_amount?.toString() || '');
    setDoseUnitInput(log.dose_unit || '');
    setDoseInputError(false);
    
    // Animate in
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
        damping: 15,
        stiffness: 300,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // Focus input after animation
    setTimeout(() => {
      doseAmountInputRef.current?.focus();
    }, 100);
  };

  // Save dose inline
  const saveDose = () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    const amountValue = doseAmountInput.trim();
    const amount = amountValue ? parseInt(amountValue, 10) : null;
    const unit = doseUnitInput.trim() || null;

    // Validate
    if (amountValue && (isNaN(amount!) || amount! < RANGES.MED_DOSE_AMOUNT.MIN || amount! > RANGES.MED_DOSE_AMOUNT.MAX)) {
      setDoseInputError(true);
      isSavingRef.current = false;
      return;
    }

    // Animate out
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        damping: 15,
        stiffness: 300,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setIsEditingDose(false);
      isSavingRef.current = false;
    });

    // Update if changed
    if (amount !== log.dose_amount || unit !== log.dose_unit) {
      onDoseUpdate(log.id, amount, unit);
    }
  };

  // Handle blur - only save if neither input is focused
  const handleAmountBlur = () => {
    // Small delay to check if unit input gets focus
    setTimeout(() => {
      if (!doseUnitInputRef.current?.isFocused() && !isSavingRef.current) {
        saveDose();
      }
    }, 100);
  };

  const handleUnitBlur = () => {
    // Small delay to check if amount input gets focus
    setTimeout(() => {
      if (!doseAmountInputRef.current?.isFocused() && !isSavingRef.current) {
        saveDose();
      }
    }, 100);
  };

  // Cancel inline editing
  const cancelDoseEdit = () => {
    setDoseAmountInput(log.dose_amount?.toString() || '');
    setDoseUnitInput(log.dose_unit || '');
    setDoseInputError(false);
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        damping: 15,
        stiffness: 300,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setIsEditingDose(false);
    });
  };

  const formatDose = () => {
    if (log.dose_amount !== null && log.dose_amount !== undefined && log.dose_unit) {
      return `${log.dose_amount} ${log.dose_unit}`;
    }
    return null;
  };

  const doseText = formatDose();
  // Display legacy 'other' type as 'med'
  const displayType = log.type === 'other' ? 'med' : log.type;
  const typeLabel = displayType === 'med' ? t('meds.form.type_med') : t('meds.form.type_supp');
  
  const rowStyle = animationValue
    ? {
        opacity: animationValue,
        transform: [
          {
            translateY: animationValue.interpolate({
              inputRange: [0, 1],
              outputRange: [4, 0],
            }),
          },
        ],
      }
    : {};

  return (
    <Animated.View style={rowStyle}>
      <View
        style={[
          styles.medRow,
          !isLast && { borderBottomWidth: 1, borderBottomColor: colors.separator },
        ]}
      >
        <TouchableOpacity
          style={[styles.medRowContent, Platform.OS === 'web' && getFocusStyle(colors.tint), disabled && { opacity: 0.6 }]}
          onPress={onEdit}
          activeOpacity={0.6}
          disabled={disabled}
          {...getButtonAccessibilityProps('Edit med')}
        >
          <View style={styles.medRowLeft}>
            <ThemedText style={[styles.medName, { color: colors.text }]}>
              {log.name}
            </ThemedText>
            {(log.notes || log.type) && (
              <ThemedText
                style={[styles.medMeta, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {typeLabel}{log.notes ? ` · ${log.notes}` : ''}
              </ThemedText>
            )}
          </View>
        </TouchableOpacity>

        {/* Right side: Dose badge and Delete button */}
        <View style={styles.medRowRight}>
          {/* Dose badge or inline editor */}
          {isEditingDose ? (
            <Animated.View
              style={[
                styles.doseEditorContainer,
                {
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <TextInput
                ref={doseAmountInputRef}
                style={[
                  styles.doseEditorInput,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: doseInputError ? colors.error : colors.border,
                  },
                ]}
                value={doseAmountInput}
                onChangeText={handleDoseAmountInputChange}
                onBlur={handleAmountBlur}
                onSubmitEditing={() => {
                  doseUnitInputRef.current?.focus();
                }}
                keyboardType="number-pad"
                maxLength={RANGES.MED_DOSE_AMOUNT.MAX.toString().length}
                selectTextOnFocus
                placeholder={t('meds.form.dose_amount_placeholder')}
              />
              <TextInput
                ref={doseUnitInputRef}
                style={[
                  styles.doseEditorUnitInput,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={doseUnitInput}
                onChangeText={setDoseUnitInput}
                onBlur={handleUnitBlur}
                onSubmitEditing={saveDose}
                placeholder={t('meds.form.dose_unit_placeholder')}
                maxLength={TEXT_LIMITS.MED_DOSE_UNIT_MAX_LEN}
              />
              <TouchableOpacity
                onPress={saveDose}
                style={[styles.doseEditorButton, { backgroundColor: colors.tint, marginLeft: Spacing.xs }]}
                {...getButtonAccessibilityProps('Save dose')}
              >
                <IconSymbol name="checkmark" size={14} color={colors.textInverse} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={cancelDoseEdit}
                style={[styles.doseEditorButton, { backgroundColor: colors.backgroundSecondary, marginLeft: Spacing.xs }]}
                {...getButtonAccessibilityProps('Cancel')}
              >
                <IconSymbol name="xmark" size={14} color={colors.text} />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity
              onPress={startEditingDose}
              style={[styles.doseBadge, { backgroundColor: colors.infoLight, borderColor: colors.info }]}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps('Edit dose')}
            >
              <ThemedText style={[styles.doseBadgeText, { color: colors.info }]}>
                {doseText || t('meds.form.dose_add')}
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* Delete button */}
          <TouchableOpacity
            onPress={onDelete}
            disabled={disabled}
            style={[
              styles.deleteButtonGhost,
              {
                borderColor: colors.separator,
                backgroundColor: deleteHovered ? colors.errorLight : 'transparent',
                opacity: disabled ? 0.4 : 1,
              },
            ]}
            activeOpacity={0.7}
            onPressIn={() => setDeleteHovered(true)}
            onPressOut={() => setDeleteHovered(false)}
            {...(Platform.OS === 'web' && {
              onMouseEnter: () => setDeleteHovered(true),
              onMouseLeave: () => setDeleteHovered(false),
            })}
            {...getButtonAccessibilityProps('Delete med')}
          >
            <IconSymbol name="trash.fill" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// Responsive container component for med sections
type MedSectionContainerProps = {
  children: React.ReactNode;
  style?: any;
};

function MedSectionContainer({ children, style }: MedSectionContainerProps) {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isLargeScreen = screenWidth >= 768;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });

    return () => subscription?.remove();
  }, []);

  return (
    <View
      style={[
        styles.responsiveContainer,
        isLargeScreen && styles.responsiveContainerLarge,
        style,
      ]}
    >
      {children}
    </View>
  );
}


export default function MedsHomeScreen() {
  const { t } = useTranslation();
  const { user, profile: authProfile } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Get user config for avatar
  const { data: userConfig } = useUserConfig();
  const effectiveProfile = userConfig || authProfile;

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
      pathname: '/meds',
      params: { date: dateString }
    });
  };

  // Format date for display with full weekday (used in Recent Days section)
  const formatDateForDisplay = (date: Date): string => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.getTime() === todayDate.getTime()) {
      return t('common.today');
    } else if (date.getTime() === yesterday.getTime()) {
      return t('common.yesterday');
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Data fetching hooks
  const queryClient = useQueryClient();
  const { data: medLogs = [], isLoading: logsLoading, refetch: refetchLogs } = useMedLogsForDate(selectedDateString);
  const { data: recentDaysSummary = [] } = useMedSummaryForRecentDays(7);
  const { data: recentAndFrequentMeds = [], isLoading: isLoadingRecentFrequent } = useMedRecentAndFrequent(60);
  
  // Preferences
  const { data: medPrefs = { primarySection: 'med', hideMedWhenEmpty: false, hideSuppWhenEmpty: false, collapsedMedSection: false, collapsedSuppSection: false } } = useMedPreferences();
  const updatePrefsMutation = useUpdateMedPreferences();
  
  // Local collapsed state (synced with preferences)
  const [isMedCollapsed, setIsMedCollapsed] = useState(medPrefs.collapsedMedSection ?? false);
  const [isSuppCollapsed, setIsSuppCollapsed] = useState(medPrefs.collapsedSuppSection ?? false);
  const [isTemporarilyDisabled, setIsTemporarilyDisabled] = useState(false);
  const [disabledChips, setDisabledChips] = useState<Set<string>>(new Set());
  
  // Sync local state with preferences when they load
  useEffect(() => {
    setIsMedCollapsed(medPrefs.collapsedMedSection ?? false);
    setIsSuppCollapsed(medPrefs.collapsedSuppSection ?? false);
  }, [medPrefs.collapsedMedSection, medPrefs.collapsedSuppSection]);
  
  // Handlers to toggle and persist collapsed state
  const handleToggleMedSection = () => {
    const newValue = !isMedCollapsed;
    setIsMedCollapsed(newValue);
    updatePrefsMutation.mutate({ collapsedMedSection: newValue });
  };
  
  const handleToggleSuppSection = () => {
    const newValue = !isSuppCollapsed;
    setIsSuppCollapsed(newValue);
    updatePrefsMutation.mutate({ collapsedSuppSection: newValue });
  };

  // Mutations
  const createMutation = useCreateMedLog();
  const updateMutation = useUpdateMedLog();
  const deleteMutation = useDeleteMedLog();

  // Animation refs for newly added rows
  const animationRefs = useRef<Map<string, Animated.Value>>(new Map());
  
  // Track newly added entry ID for highlight animation
  const [newEntryId, setNewEntryId] = useState<string | null>(null);

  // Modal state for custom med form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingLog, setEditingLog] = useState<{ id: string; name: string; type: 'med' | 'supp' | 'other'; dose_amount: number | null; dose_unit: string | null; notes: string | null } | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'med' | 'supp'>('med');
  const [formDoseAmount, setFormDoseAmount] = useState('');
  const [formDoseUnit, setFormDoseUnit] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  
  // Clone modal state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const cloneMutation = useCloneDayEntriesMutation('pill_intake');
  const massDeleteMutation = useMassDeleteEntriesMutation('pill_intake');
  
  // Mass delete confirmation modal state
  const [showMassDeleteConfirm, setShowMassDeleteConfirm] = useState(false);
  
  // Shared edit mode state (for both clone and delete)
  const [editMode, setEditMode] = useState(false);
  
  // Multi-select for edit mode
  const {
    isSelected: isEntrySelected,
    toggleSelection: toggleEntrySelection,
    selectAll: selectAllEntries,
    deselectAll: deselectAllEntries,
    areAllSelected: areAllEntriesSelected,
    selectedIds: selectedEntryIds,
    hasSelection: hasEntrySelection,
    clearSelection: clearEntrySelection,
  } = useMultiSelect<{ id: string }>({ enabled: editMode });
  
  // Initialize all entries as selected when entering edit mode
  useEffect(() => {
    if (editMode && medLogs.length > 0) {
      // Select all entries when entering edit mode
      selectAllEntries(medLogs, (log) => log.id);
    } else if (!editMode) {
      // Clear selection when exiting edit mode
      clearEntrySelection();
    }
  }, [editMode]); // Only trigger when edit mode changes
  
  // Reset selection when entries change while in edit mode
  useEffect(() => {
    if (editMode && medLogs.length > 0) {
      // Re-select all entries if we're in edit mode and entries changed
      selectAllEntries(medLogs, (log) => log.id);
    }
  }, [medLogs.length]); // Only depend on length to avoid re-running on every render
  
  // Reset edit mode when date changes
  useEffect(() => {
    setEditMode(false);
    clearEntrySelection();
  }, [selectedDateString]);
  
  // Mass delete handlers
  const handleMassDelete = useCallback(() => {
    if (hasEntrySelection && selectedEntryIds.size > 0) {
      setShowMassDeleteConfirm(true);
    }
  }, [hasEntrySelection, selectedEntryIds.size]);
  
  const handleMassDeleteConfirm = useCallback(async () => {
    setShowMassDeleteConfirm(false);
    if (selectedEntryIds.size === 0) return;
    
    const entryIdsArray = Array.from(selectedEntryIds);
    massDeleteMutation.mutate(
      { entryIds: entryIdsArray },
      {
        onSuccess: (deletedCount) => {
          // Exit edit mode after successful delete
          setEditMode(false);
          clearEntrySelection();
          
          if (deletedCount > 0) {
            showAppToast(t('meds.clone.mass_delete.success_message', {
              count: deletedCount,
              items: deletedCount === 1 ? t('meds.clone.mass_delete.item_one') : t('meds.clone.mass_delete.item_other'),
            }));
          }
        },
        onError: (error: Error) => {
          Alert.alert(
            t('meds.clone.mass_delete.error_title'),
            t('meds.clone.mass_delete.error_message', {
              error: error.message || t('common.unexpected_error'),
            })
          );
        },
      }
    );
  }, [selectedEntryIds, massDeleteMutation, t]);
  
  const handleMassDeleteCancel = useCallback(() => {
    setShowMassDeleteConfirm(false);
  }, []);
  
  // Previous day copy hook - reusable pattern
  const { cloneFromPreviousDay, isLoading: isCloningFromPreviousDay } = useCloneFromPreviousDay({
    entityType: 'pill_intake',
    currentDate: selectedDate,
    onSuccess: (clonedCount) => {
      if (clonedCount > 0) {
        showAppToast(t('meds.previous_day_copy.success_message', {
          count: clonedCount,
          items: clonedCount === 1 ? t('meds.clone.item_one') : t('meds.clone.item_other'),
        }));
      }
    },
    onError: (error: Error) => {
      // Handle nothing to copy error
      if (error.message === 'NOTHING_TO_COPY') {
        showAppToast(t('meds.previous_day_copy.nothing_to_copy'));
        return;
      }
      // Handle same-date error specifically
      if (error.message === 'SAME_DATE' || error.message?.includes('same date')) {
        Alert.alert(
          t('meds.clone.error_title'),
          t('meds.clone.same_date_error')
        );
      } else {
        Alert.alert(
          t('meds.clone.error_title'),
          t('meds.clone.error_message', {
            error: error.message || t('common.unexpected_error'),
          })
        );
      }
    },
  });

  // Centralized copy from yesterday hook
  const { isCopyingFromYesterday, runCopyFromYesterday } = useCopyFromYesterday();

  // Calculate totals for selected date
  const totalItems = medLogs.length;
  // Split logs by type (treat legacy 'other' as 'med')
  const medLogsFiltered = medLogs.filter(log => {
    const normalizedType = log.type === 'other' ? 'med' : log.type;
    return normalizedType === 'med';
  });
  const suppLogsFiltered = medLogs.filter(log => {
    const normalizedType = log.type === 'other' ? 'med' : log.type;
    return normalizedType === 'supp';
  });
  const medCount = medLogsFiltered.length;
  const suppCount = suppLogsFiltered.length;
  
  // Determine section order based on preferences
  const primarySection = medPrefs.primarySection || 'med';
  const showMedSection = !medPrefs.hideMedWhenEmpty || medCount > 0;
  const showSuppSection = !medPrefs.hideSuppWhenEmpty || suppCount > 0;

  // Animate newly added med
  useEffect(() => {
    if (medLogs.length > 0) {
      const lastLog = medLogs[medLogs.length - 1];
      if (!animationRefs.current.has(lastLog.id)) {
        const animValue = new Animated.Value(0);
        animationRefs.current.set(lastLog.id, animValue);
        Animated.timing(animValue, {
          toValue: 1,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
    }
  }, [medLogs]);

  // Handle quick add from chip
  const handleQuickAdd = (name: string, type: 'med' | 'supp' | 'other', dose_amount: number | null = null, dose_unit: string | null = null) => {
    if (!user?.id) return;

    // Create unique key for this chip
    const chipKey = `${name}-${type}-${dose_amount}-${dose_unit}`;
    
    // Disable chip for 3 seconds to prevent multiple clicks
    setDisabledChips(prev => new Set(prev).add(chipKey));
    setTimeout(() => {
      setDisabledChips(prev => {
        const next = new Set(prev);
        next.delete(chipKey);
        return next;
      });
    }, 3000);

    createMutation.mutate(
      {
        user_id: user.id,
        date: selectedDateString,
        name: name.trim(),
        type,
        dose_amount,
        dose_unit,
        notes: null,
      },
      {
        onSuccess: (data) => {
          if (data?.id) {
            setNewEntryId(data.id);
          }
        },
        onError: (error: any) => {
          Alert.alert(t('meds.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
        },
      }
    );
  };

  // Handle custom med form
  const openCustomForm = () => {
    setEditingLog(null);
    setFormName('');
    setFormType('med');
    setFormDoseAmount('');
    setFormDoseUnit('');
    setFormNotes('');
    setShowCustomForm(true);
  };

  const openEditForm = (log: { id: string; name: string; type: 'med' | 'supp' | 'other'; dose_amount: number | null; dose_unit: string | null; notes: string | null }) => {
    setEditingLog(log);
    setFormName(log.name);
    // Convert legacy 'other' type to 'med' for editing
    setFormType(log.type === 'other' ? 'med' : (log.type === 'med' || log.type === 'supp' ? log.type : 'med'));
    setFormDoseAmount(log.dose_amount?.toString() || '');
    setFormDoseUnit(log.dose_unit || '');
    setFormNotes(log.notes || '');
    setShowCustomForm(true);
  };

  const closeCustomForm = () => {
    setShowCustomForm(false);
    setEditingLog(null);
    setFormName('');
    setFormType('med');
    setFormDoseAmount('');
    setFormDoseUnit('');
    setFormNotes('');
  };

  // Handle form save
  const handleSaveMed = () => {
    // Prevent multiple submissions
    if (createMutation.isPending || updateMutation.isPending) {
      return;
    }

    if (!formName.trim()) {
      Alert.alert(t('meds.form.name_required'));
      return;
    }

    if (formName.trim().length > TEXT_LIMITS.MED_NAME_MAX_LEN) {
      Alert.alert(t('meds.form.name_max_length'));
      return;
    }

    const doseAmount = formDoseAmount.trim() ? parseInt(formDoseAmount.trim(), 10) : null;
    if (doseAmount !== null && (isNaN(doseAmount) || doseAmount < RANGES.MED_DOSE_AMOUNT.MIN || doseAmount > RANGES.MED_DOSE_AMOUNT.MAX)) {
      Alert.alert(t('meds.form.dose_amount_range'));
      return;
    }

    if (formNotes.length > TEXT_LIMITS.NOTES_MAX_LEN) {
      Alert.alert(t('meds.form.notes_max_length'));
      return;
    }

    if (!user?.id) return;

    if (editingLog) {
      // Update existing
      // Ensure type is 'med' or 'supp' (never 'other')
      const updateType: 'med' | 'supp' = formType === 'med' || formType === 'supp' ? formType : 'med';
      updateMutation.mutate(
        {
          logId: editingLog.id,
          updates: {
            name: formName.trim(),
            type: updateType,
            dose_amount: doseAmount,
            dose_unit: formDoseUnit.trim() || null,
            notes: formNotes.trim() || null,
          },
        },
        {
          onSuccess: () => {
            closeCustomForm();
          },
          onError: (error: any) => {
            Alert.alert(t('meds.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
          },
        }
      );
    } else {
      // Create new
      // Ensure type is 'med' or 'supp' (never 'other')
      const createType: 'med' | 'supp' = formType === 'med' || formType === 'supp' ? formType : 'med';
      createMutation.mutate(
        {
          user_id: user.id,
          date: selectedDateString,
          name: formName.trim(),
          type: createType,
          dose_amount: doseAmount,
          dose_unit: formDoseUnit.trim() || null,
          notes: formNotes.trim() || null,
        },
        {
          onSuccess: (data) => {
            if (data?.id) {
              setNewEntryId(data.id);
            }
            closeCustomForm();
          },
          onError: (error: any) => {
            Alert.alert(t('meds.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
          },
        }
      );
    }
  };

  // Handle delete - show confirmation modal
  const handleDelete = (logId: string, logName: string) => {
    setDeleteTarget({ id: logId, name: logName });
    setShowDeleteConfirm(true);
  };

  // Confirm delete action
  const confirmDelete = () => {
    if (!deleteTarget) return;
    
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        const deletedName = deleteTarget.name;
        setDeleteTarget(null);
        showAppToast(t('meds.delete.success_single', { name: deletedName }));
      },
      onError: (error: any) => {
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
        Alert.alert(t('meds.delete.error', { error: error.message || t('common.unexpected_error') }));
      },
    });
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  // Handle inline dose update
  const handleDoseUpdate = (logId: string, dose_amount: number | null, dose_unit: string | null) => {
    updateMutation.mutate(
      {
        logId,
        updates: { dose_amount, dose_unit },
      },
      {
        onError: (error: any) => {
          Alert.alert(t('meds.form.error_save_failed', { error: error.message || t('common.unexpected_error') }));
        },
      }
    );
  };

  // Handle date selection from recent days
  const handleDateSelect = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      navigateWithDate(date);
    }
  };

  // Format recent days summary
  const formatRecentDay = (summary: { date: string; item_count: number }) => {
    const date = new Date(summary.date + 'T00:00:00');
    const dayLabel = formatDateForDisplay(date);
    const count = summary.item_count;

    if (count === 0) {
      return t('meds.recent_days.format_no_meds', { day: dayLabel });
    }

    return t('meds.recent_days.format', {
      day: dayLabel,
      count,
      items: count === 1 ? t('meds.recent_days.item_one') : t('meds.recent_days.item_other'),
    });
  };

  // Handle dose amount input change in form
  const handleDoseAmountChange = (text: string) => {
    const numericOnly = text.replace(/[^0-9]/g, '');
    
    if (numericOnly === '') {
      setFormDoseAmount('');
      return;
    }
    
    const numValue = parseInt(numericOnly, 10);
    
    if (!isNaN(numValue) && numValue >= RANGES.MED_DOSE_AMOUNT.MIN && numValue <= RANGES.MED_DOSE_AMOUNT.MAX) {
      setFormDoseAmount(numericOnly);
    } else if (!isNaN(numValue) && numValue > RANGES.MED_DOSE_AMOUNT.MAX) {
      setFormDoseAmount(RANGES.MED_DOSE_AMOUNT.MAX.toString());
    }
  };

  if (!user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  // Recent and frequent meds (already combined and limited to 10)
  const hasRecentFrequent = recentAndFrequentMeds.length > 0;

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
            module="meds"
            minimumDate={minDate}
            maximumDate={today}
          />
        }
        goBackOneDay={
          canGoBack
            ? () => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                navigateWithDate(newDate);
              }
            : undefined
        }
        goForwardOneDay={() => {
          if (!isToday) {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() + 1);
            navigateWithDate(newDate);
          }
        }}
        isToday={isToday}
        module="meds"
      >
        {/* Desktop Container for Header and Content */}
        <DesktopPageContainer>

          {/* Today's Meds Section - Card */}
          <MedSectionContainer>
            <SurfaceCard module="meds">
              {/* Standardized Summary Card Header */}
              <SummaryCardHeader
                titleKey="home.summary.title_other"
                materialIcon="pill"
                module="meds"
                isLoading={logsLoading}
                subtitle={
                  !logsLoading && totalItems > 0
                    ? t('meds.summary.total', {
                        count: totalItems,
                        items: totalItems === 1 ? t('meds.summary.item_one') : t('meds.summary.item_other'),
                        med_count: medCount,
                        med: medCount === 1 ? t('meds.summary.med_one') : t('meds.summary.med_other'),
                        supp_count: suppCount,
                        supp: suppCount === 1 ? t('meds.summary.supp_one') : t('meds.summary.supp_other'),
                      })
                    : undefined
                }
                rightContent={
                  !logsLoading && (
                    <View style={styles.headerButtons}>
                      {!editMode ? (
                        <>
                          {/* Clone button */}
                          <TouchableOpacity
                            onPress={() => {
                              if (!medLogs || medLogs.length === 0) {
                                showAppToast(t('meds.clone.nothing_to_copy'));
                                return;
                              }
                              setEditMode(true);
                            }}
                            disabled={!medLogs || medLogs.length === 0}
                            style={[
                              styles.cloneButton,
                              (!medLogs || medLogs.length === 0) && { opacity: 0.4 },
                            ]}
                            activeOpacity={0.7}
                            {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
                            {...getButtonAccessibilityProps(t('meds.clone.edit_mode.enter_edit_mode'))}
                          >
                            <IconSymbol name="doc.on.doc" size={20} color={colors.tint} />
                          </TouchableOpacity>
                          
                          {/* Delete button */}
                          <TouchableOpacity
                            onPress={() => {
                              if (!medLogs || medLogs.length === 0) {
                                return;
                              }
                              setEditMode(true);
                            }}
                            disabled={!medLogs || medLogs.length === 0}
                            style={[
                              styles.deleteButton,
                              (!medLogs || medLogs.length === 0) && { opacity: 0.4 },
                            ]}
                            activeOpacity={0.7}
                            {...(Platform.OS === 'web' && getFocusStyle('#EF4444'))}
                            {...getButtonAccessibilityProps(t('meds.clone.edit_mode.enter_edit_mode'))}
                          >
                            <IconSymbol name="trash.fill" size={20} color="#EF4444" />
                          </TouchableOpacity>
                        </>
                      ) : (
                        /* Exit edit mode button */
                        <TouchableOpacity
                          onPress={() => {
                            setEditMode(false);
                            clearEntrySelection();
                          }}
                          style={[
                            styles.cloneButton,
                            {
                              backgroundColor: '#10B981' + '20',
                              borderColor: '#10B981' + '40',
                            },
                          ]}
                          activeOpacity={0.7}
                          {...(Platform.OS === 'web' && getFocusStyle('#10B981'))}
                          {...getButtonAccessibilityProps(t('meds.clone.edit_mode.exit_edit_mode'))}
                        >
                          <IconSymbol name="checkmark" size={20} color="#10B981" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                }
                style={{ borderBottomWidth: 1, borderBottomColor: colors.separator }}
              />

          {logsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : (
            <>
              {totalItems === 0 ? (
                <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('meds.summary.no_meds')}
                </ThemedText>
              ) : (
                <View style={styles.sectionsContainer}>
                  {/* Select All Row - Only shown in edit mode */}
                  {editMode && medLogs.length > 0 && (
                    <View style={[styles.selectAllRow, { backgroundColor: colors.background, borderBottomColor: colors.separator }]}>
                      <MultiSelectItem
                        isSelected={areAllEntriesSelected(medLogs, (log) => log.id)}
                        onToggle={() => {
                          if (areAllEntriesSelected(medLogs, (log) => log.id)) {
                            deselectAllEntries();
                          } else {
                            selectAllEntries(medLogs, (log) => log.id);
                          }
                        }}
                        style={{ paddingVertical: 12, paddingHorizontal: 16 }}
                      >
                        <View style={styles.selectAllRowContent}>
                          <ThemedText style={[styles.selectAllText, { color: colors.text }]}>
                            {t('meds.clone.edit_mode.select_all')}
                          </ThemedText>
                          <View style={styles.selectAllActions}>
                            <TouchableOpacity
                              onPress={() => {
                                const selectedIds = Array.from(selectedEntryIds);
                                if (selectedIds.length === 0) {
                                  showAppToast(t('meds.clone.nothing_to_copy'));
                                  return;
                                }
                                setShowCloneModal(true);
                              }}
                              disabled={!hasEntrySelection}
                              style={[
                                styles.iconButtonInRow,
                                { backgroundColor: colors.tint + '20', borderColor: colors.tint + '40', borderWidth: 1 },
                                !hasEntrySelection && { opacity: 0.5 },
                              ]}
                              activeOpacity={0.7}
                              {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
                              {...getButtonAccessibilityProps(t('meds.clone.edit_mode.clone_button'))}
                            >
                              <IconSymbol name="doc.on.doc" size={20} color={colors.tint} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={handleMassDelete}
                              disabled={!hasEntrySelection}
                              style={[
                                styles.iconButtonInRow,
                                { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' + '40', borderWidth: 1 },
                                !hasEntrySelection && { opacity: 0.5 },
                              ]}
                              activeOpacity={0.7}
                              {...(Platform.OS === 'web' && getFocusStyle('#EF4444'))}
                              {...getButtonAccessibilityProps(t('meds.clone.edit_mode.delete_button'))}
                            >
                              <IconSymbol name="trash.fill" size={20} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </MultiSelectItem>
                    </View>
                  )}
                  
                  {/* Render sections based on primarySection preference */}
                  {primarySection === 'med' ? (
                    <>
                      {/* Med Section First */}
                      {showMedSection && (
                        <CollapsibleSection
                          title={t('meds.form.type_med')}
                          summary={
                            medCount > 0
                              ? `${medCount} ${medCount === 1 ? t('meds.summary.item_one') : t('meds.summary.item_other')}`
                              : t('meds.summary.none')
                          }
                          isCollapsed={isMedCollapsed}
                          onToggle={handleToggleMedSection}
                          accessibilityLabel={t('meds.section.toggle_med')}
                        >
                          {medCount > 0 ? (
                            <View style={styles.medList}>
                              {medLogsFiltered.map((log, index) => {
                                const rowContent = (
                                  <HighlightableRow
                                    key={log.id}
                                    isNew={log.id === newEntryId}
                                  >
                                    <MedRow
                                      log={log}
                                      colors={colors}
                                      onEdit={() => {
                                        if (!editMode) {
                                          openEditForm({ id: log.id, name: log.name, type: log.type, dose_amount: log.dose_amount, dose_unit: log.dose_unit, notes: log.notes });
                                        }
                                      }}
                                      onDelete={() => {
                                        if (!editMode) {
                                          handleDelete(log.id, log.name);
                                        }
                                      }}
                                      onDoseUpdate={handleDoseUpdate}
                                      isLast={index === medLogsFiltered.length - 1 && (!showSuppSection || suppCount === 0)}
                                      animationValue={animationRefs.current.get(log.id)}
                                      t={t}
                                      disabled={editMode}
                                    />
                                  </HighlightableRow>
                                );
                                
                                if (editMode) {
                                  return (
                                    <MultiSelectItem
                                      key={log.id}
                                      isSelected={isEntrySelected(log.id)}
                                      onToggle={() => toggleEntrySelection(log.id)}
                                    >
                                      {rowContent}
                                    </MultiSelectItem>
                                  );
                                }
                                
                                return rowContent;
                              })}
                            </View>
                          ) : (
                            <ThemedText style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                              {t('meds.summary.none')}
                            </ThemedText>
                          )}
                        </CollapsibleSection>
                      )}

                      {/* Divider between sections */}
                      {showMedSection && showSuppSection && medCount > 0 && suppCount > 0 && !isMedCollapsed && !isSuppCollapsed && (
                        <View style={[styles.sectionDivider, { backgroundColor: colors.separator }]} />
                      )}

                      {/* Supp Section Second */}
                      {showSuppSection && (
                        <CollapsibleSection
                          title={t('meds.form.type_supp')}
                          summary={
                            suppCount > 0
                              ? `${suppCount} ${suppCount === 1 ? t('meds.summary.item_one') : t('meds.summary.item_other')}`
                              : t('meds.summary.none')
                          }
                          isCollapsed={isSuppCollapsed}
                          onToggle={handleToggleSuppSection}
                          accessibilityLabel={t('meds.section.toggle_supp')}
                        >
                          {suppCount > 0 ? (
                            <View style={styles.medList}>
                              {suppLogsFiltered.map((log, index) => {
                                const rowContent = (
                                  <HighlightableRow
                                    key={log.id}
                                    isNew={log.id === newEntryId}
                                  >
                                    <MedRow
                                      log={log}
                                      colors={colors}
                                      onEdit={() => {
                                        if (!editMode) {
                                          openEditForm({ id: log.id, name: log.name, type: log.type, dose_amount: log.dose_amount, dose_unit: log.dose_unit, notes: log.notes });
                                        }
                                      }}
                                      onDelete={() => {
                                        if (!editMode) {
                                          handleDelete(log.id, log.name);
                                        }
                                      }}
                                      onDoseUpdate={handleDoseUpdate}
                                      isLast={index === suppLogsFiltered.length - 1}
                                      animationValue={animationRefs.current.get(log.id)}
                                      t={t}
                                      disabled={editMode}
                                    />
                                  </HighlightableRow>
                                );
                                
                                if (editMode) {
                                  return (
                                    <MultiSelectItem
                                      key={log.id}
                                      isSelected={isEntrySelected(log.id)}
                                      onToggle={() => toggleEntrySelection(log.id)}
                                    >
                                      {rowContent}
                                    </MultiSelectItem>
                                  );
                                }
                                
                                return rowContent;
                              })}
                            </View>
                          ) : (
                            <ThemedText style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                              {t('meds.summary.none')}
                            </ThemedText>
                          )}
                        </CollapsibleSection>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Supp Section First */}
                      {showSuppSection && (
                        <CollapsibleSection
                          title={t('meds.form.type_supp')}
                          summary={
                            suppCount > 0
                              ? `${suppCount} ${suppCount === 1 ? t('meds.summary.item_one') : t('meds.summary.item_other')}`
                              : t('meds.summary.none')
                          }
                          isCollapsed={isSuppCollapsed}
                          onToggle={handleToggleSuppSection}
                          accessibilityLabel={t('meds.section.toggle_supp')}
                        >
                          {suppCount > 0 ? (
                            <View style={styles.medList}>
                              {suppLogsFiltered.map((log, index) => {
                                const rowContent = (
                                  <MedRow
                                    key={log.id}
                                    log={log}
                                    colors={colors}
                                    onEdit={() => {
                                      if (!editMode) {
                                        openEditForm({ id: log.id, name: log.name, type: log.type, dose_amount: log.dose_amount, dose_unit: log.dose_unit, notes: log.notes });
                                      }
                                    }}
                                    onDelete={() => {
                                      if (!editMode) {
                                        handleDelete(log.id, log.name);
                                      }
                                    }}
                                    onDoseUpdate={handleDoseUpdate}
                                    isLast={index === suppLogsFiltered.length - 1 && (!showMedSection || medCount === 0)}
                                    animationValue={animationRefs.current.get(log.id)}
                                    t={t}
                                    disabled={editMode}
                                  />
                                );
                                
                                if (editMode) {
                                  return (
                                    <MultiSelectItem
                                      key={log.id}
                                      isSelected={isEntrySelected(log.id)}
                                      onToggle={() => toggleEntrySelection(log.id)}
                                    >
                                      {rowContent}
                                    </MultiSelectItem>
                                  );
                                }
                                
                                return rowContent;
                              })}
                            </View>
                          ) : (
                            <ThemedText style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                              {t('meds.summary.none')}
                            </ThemedText>
                          )}
                        </CollapsibleSection>
                      )}

                      {/* Divider between sections */}
                      {showMedSection && showSuppSection && medCount > 0 && suppCount > 0 && !isMedCollapsed && !isSuppCollapsed && (
                        <View style={[styles.sectionDivider, { backgroundColor: colors.separator }]} />
                      )}

                      {/* Med Section Second */}
                      {showMedSection && (
                        <CollapsibleSection
                          title={t('meds.form.type_med')}
                          summary={
                            medCount > 0
                              ? `${medCount} ${medCount === 1 ? t('meds.summary.item_one') : t('meds.summary.item_other')}`
                              : t('meds.summary.none')
                          }
                          isCollapsed={isMedCollapsed}
                          onToggle={handleToggleMedSection}
                          accessibilityLabel={t('meds.section.toggle_med')}
                        >
                          {medCount > 0 ? (
                            <View style={styles.medList}>
                              {medLogsFiltered.map((log, index) => {
                                const rowContent = (
                                  <HighlightableRow
                                    key={log.id}
                                    isNew={log.id === newEntryId}
                                  >
                                    <MedRow
                                      log={log}
                                      colors={colors}
                                      onEdit={() => {
                                        if (!editMode) {
                                          openEditForm({ id: log.id, name: log.name, type: log.type, dose_amount: log.dose_amount, dose_unit: log.dose_unit, notes: log.notes });
                                        }
                                      }}
                                      onDelete={() => {
                                        if (!editMode) {
                                          handleDelete(log.id, log.name);
                                        }
                                      }}
                                      onDoseUpdate={handleDoseUpdate}
                                      isLast={index === medLogsFiltered.length - 1}
                                      animationValue={animationRefs.current.get(log.id)}
                                      t={t}
                                      disabled={editMode}
                                    />
                                  </HighlightableRow>
                                );
                                
                                if (editMode) {
                                  return (
                                    <MultiSelectItem
                                      key={log.id}
                                      isSelected={isEntrySelected(log.id)}
                                      onToggle={() => toggleEntrySelection(log.id)}
                                    >
                                      {rowContent}
                                    </MultiSelectItem>
                                  );
                                }
                                
                                return rowContent;
                              })}
                            </View>
                          ) : (
                            <ThemedText style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                              {t('meds.summary.none')}
                            </ThemedText>
                          )}
                        </CollapsibleSection>
                      )}
                    </>
                  )}
                </View>
              )}
            </>
          )}
          </SurfaceCard>
        </MedSectionContainer>

        {/* Quick Add Section - Card */}
        <MedSectionContainer>
          <SurfaceCard module="meds">
          <View style={styles.quickAddHeader}>
            <ThemedText type="subtitle" style={[styles.quickAddTitle, { color: colors.text }]}>
              {t('meds.quick_add_title')}
            </ThemedText>
            <TouchableOpacity
              onPress={() => {
                // Disable button for 3 seconds to prevent multiple clicks
                setIsTemporarilyDisabled(true);
                setTimeout(() => {
                  setIsTemporarilyDisabled(false);
                }, 3000);
                
                // Check cache for previous day before cloning
                const previousDay = new Date(selectedDate);
                previousDay.setDate(previousDay.getDate() - 1);
                const previousDateString = getLocalDateKey(previousDay);
                
                // Use React Query cache to check if previous day has entries
                const previousDayQueryKey = ['medLogs', user?.id, previousDateString];
                const cachedPreviousDayLogs = queryClient.getQueryData<any[]>(previousDayQueryKey);
                
                // If cache exists and is empty, show message and skip DB call
                if (cachedPreviousDayLogs !== undefined && (cachedPreviousDayLogs === null || cachedPreviousDayLogs.length === 0)) {
                  showAppToast(t('meds.previous_day_copy.nothing_to_copy'));
                  return;
                }
                
                runCopyFromYesterday(() => cloneFromPreviousDay());
              }}
              style={styles.previousDayButton}
              activeOpacity={0.7}
              disabled={isCopyingFromYesterday || isTemporarilyDisabled}
              {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
              {...getButtonAccessibilityProps(
                isToday 
                  ? t('meds.previous_day_copy.accessibility_label_yesterday')
                  : t('meds.previous_day_copy.accessibility_label_previous')
              )}
            >
              {isCopyingFromYesterday ? (
                <ActivityIndicator size="small" color={colors.tint} />
              ) : (
                <>
                  <IconSymbol name="doc.on.doc" size={16} color={isTemporarilyDisabled ? colors.textSecondary : colors.tint} />
                  <ThemedText style={[styles.previousDayButtonText, { color: isTemporarilyDisabled ? colors.textSecondary : colors.tint }]}>
                    {isToday 
                      ? t('meds.previous_day_copy.label_yesterday')
                      : t('meds.previous_day_copy.label_previous')}
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Recent/Frequent Meds */}
          {hasRecentFrequent && (
            <>
              <QuickAddHeading 
                labelKey="meds.quick_add.recent_freq"
                module="meds"
                icon="pill.fill"
              />
              <ScrollView
                style={styles.chipsScrollContainer}
                contentContainerStyle={styles.chipsWrapContainer}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {recentAndFrequentMeds.map((med, index) => {
                  const doseText = med.dose_amount !== null && med.dose_unit ? `${med.dose_amount} ${med.dose_unit}` : null;
                  const chipKey = `${med.name}-${med.type}-${med.dose_amount}-${med.dose_unit}`;
                  return (
                    <QuickAddChip
                      key={`recent-${index}-${med.name}-${med.type}-${med.dose_amount}-${med.dose_unit}`}
                      label={med.name}
                      metadata={doseText}
                      colors={colors}
                      onPress={() => handleQuickAdd(med.name, med.type, med.dose_amount, med.dose_unit)}
                      disabled={disabledChips.has(chipKey)}
                    />
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Custom Med Button */}
          <TouchableOpacity
            style={[styles.customButton, { backgroundColor: colors.tintLight, borderColor: colors.tint }]}
            onPress={openCustomForm}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(t('meds.quick_add.add_custom'))}
          >
            <IconSymbol name="plus.circle.fill" size={18} color={colors.tint} />
            <ThemedText style={[styles.customButtonText, { color: colors.tint }]}>
              {t('meds.quick_add.add_custom')}
            </ThemedText>
          </TouchableOpacity>

          {/* Static Common Meds */}
          <QuickAddHeading 
            labelKey="meds.quick_add.common"
            module="meds"
            icon="pills.fill"
          />
          <ScrollView
            style={styles.chipsScrollContainer}
            contentContainerStyle={styles.chipsWrapContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {/* Supplements first, then meds */}
            {COMMON_SUPPS.map((supp) => {
              const translatedName = t(supp.i18nKey);
              const chipKey = `${translatedName}-${supp.type}-null-null`;
              return (
                <QuickAddChip
                  key={`supp-${supp.i18nKey}`}
                  label={translatedName}
                  icon={supp.icon}
                  colors={colors}
                  onPress={() => handleQuickAdd(translatedName, supp.type)}
                  disabled={disabledChips.has(chipKey)}
                />
              );
            })}
            {COMMON_MEDS.map((med) => {
              const translatedName = t(med.i18nKey);
              const chipKey = `${translatedName}-${med.type}-null-null`;
              return (
                <QuickAddChip
                  key={`med-${med.i18nKey}`}
                  label={translatedName}
                  icon={med.icon}
                  colors={colors}
                  onPress={() => handleQuickAdd(translatedName, med.type)}
                  disabled={disabledChips.has(chipKey)}
                />
              );
            })}
          </ScrollView>
          </SurfaceCard>
        </MedSectionContainer>

        {/* Recent Days Section - Lighter Card */}
        <MedSectionContainer>
          <View style={[styles.recentDaysCard, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText type="subtitle" style={[styles.recentDaysTitle, { color: colors.text }]}>
            {t('meds.recent_days_title')}
          </ThemedText>

          {recentDaysSummary.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('meds.summary.no_meds')}
            </ThemedText>
          ) : (
            <View style={styles.recentDaysList}>
              {recentDaysSummary.map((summary, index) => (
                <TouchableOpacity
                  key={summary.date}
                  style={[
                    styles.recentDayRow,
                    index < recentDaysSummary.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.separator },
                    Platform.OS === 'web' && getFocusStyle(colors.tint),
                  ]}
                  onPress={() => handleDateSelect(summary.date)}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(formatRecentDay(summary))}
                >
                  <ThemedText style={[styles.recentDayDate, { color: colors.text }]}>
                    {formatDateForDisplay(new Date(summary.date + 'T00:00:00'))}
                  </ThemedText>
                  <ThemedText style={[styles.recentDayStats, { color: colors.textSecondary }]}>
                    {summary.item_count} {summary.item_count === 1 ? t('meds.recent_days.item_one') : t('meds.recent_days.item_other')}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
          </View>
        </MedSectionContainer>
        </DesktopPageContainer>
      </CollapsibleModuleHeader>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.confirmModalContent, { backgroundColor: colors.background }]}>
            <ThemedText type="title" style={[styles.confirmModalTitle, { color: colors.text }]}>
              {t('meds.delete.title')}
            </ThemedText>
            <ThemedText style={[styles.confirmModalMessage, { color: colors.textSecondary }]}>
              {deleteTarget ? t('meds.delete.message', { name: deleteTarget.name }) : t('meds.delete.message_generic')}
            </ThemedText>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={cancelDelete}
                {...getButtonAccessibilityProps(t('meds.delete.cancel'))}
              >
                <ThemedText style={{ color: colors.text }}>{t('meds.delete.cancel')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.deleteConfirmButton, { backgroundColor: colors.error }]}
                onPress={confirmDelete}
                disabled={deleteMutation.isPending}
                {...getButtonAccessibilityProps(t('meds.delete.confirm'))}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <ThemedText style={{ color: colors.textInverse }}>{t('meds.delete.confirm')}</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Med Form Modal */}
      <Modal
        visible={showCustomForm}
        transparent={true}
        animationType="slide"
        onRequestClose={closeCustomForm}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: Platform.OS === 'web' ? Spacing.lg : insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={{ color: colors.text }}>
                {editingLog ? t('meds.form.title_edit') : t('meds.form.title')}
              </ThemedText>
              <TouchableOpacity
                onPress={closeCustomForm}
                style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                {...getButtonAccessibilityProps(t('common.close'))}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.formContent}>
                <View>
                  <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                    {t('meds.form.name_label')}
                  </ThemedText>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder={t('meds.form.name_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    maxLength={TEXT_LIMITS.MED_NAME_MAX_LEN}
                    autoFocus
                  />
                </View>

                <View>
                  <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                    {t('meds.form.type_label')}
                  </ThemedText>
                  <View style={[styles.typeSelector, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={[
                        styles.typeOption,
                        formType === 'med' && { backgroundColor: colors.tintLight, borderColor: colors.tint },
                      ]}
                      onPress={() => setFormType('med')}
                      {...getButtonAccessibilityProps(t('meds.form.type_med'))}
                    >
                      <ThemedText style={{ color: formType === 'med' ? colors.tint : colors.text }}>
                        {t('meds.form.type_med')}
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeOption,
                        formType === 'supp' && { backgroundColor: colors.tintLight, borderColor: colors.tint },
                      ]}
                      onPress={() => setFormType('supp')}
                      {...getButtonAccessibilityProps(t('meds.form.type_supp'))}
                    >
                      <ThemedText style={{ color: formType === 'supp' ? colors.tint : colors.text }}>
                        {t('meds.form.type_supp')}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                <View>
                  <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                    {t('meds.form.dose_label')}
                  </ThemedText>
                  <View style={styles.doseInputRow}>
                    <TextInput
                      style={[styles.doseAmountInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      value={formDoseAmount}
                      onChangeText={handleDoseAmountChange}
                      placeholder={t('meds.form.dose_amount_placeholder')}
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                      maxLength={RANGES.MED_DOSE_AMOUNT.MAX.toString().length}
                    />
                    <TextInput
                      style={[styles.doseUnitInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      value={formDoseUnit}
                      onChangeText={setFormDoseUnit}
                      placeholder={t('meds.form.dose_unit_placeholder')}
                      placeholderTextColor={colors.textSecondary}
                      maxLength={TEXT_LIMITS.MED_DOSE_UNIT_MAX_LEN}
                    />
                  </View>
                  <ThemedText style={[styles.formHelper, { color: colors.textSecondary }]}>
                    {t('meds.form.dose_amount_range')}
                  </ThemedText>
                </View>

                <View>
                  <ThemedText style={[styles.formLabel, { color: colors.text }]}>
                    {t('meds.form.notes_label')}
                  </ThemedText>
                  <TextInput
                    style={[styles.formTextArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    value={formNotes}
                    onChangeText={setFormNotes}
                    placeholder={t('meds.form.notes_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    maxLength={TEXT_LIMITS.NOTES_MAX_LEN}
                    textAlignVertical="top"
                  />
                  <ThemedText style={[styles.formHelper, { color: colors.textSecondary }]}>
                    {t('meds.form.notes_helper')}
                  </ThemedText>
                </View>

                <View style={styles.formButtons}>
                  <TouchableOpacity
                    style={[styles.formButton, styles.cancelButton, { borderColor: colors.border }]}
                    onPress={closeCustomForm}
                    {...getButtonAccessibilityProps(t('common.cancel'))}
                  >
                    <ThemedText style={{ color: colors.text }}>{t('common.cancel')}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formButton, styles.saveButton, { backgroundColor: colors.tint }]}
                    onPress={handleSaveMed}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    {...getButtonAccessibilityProps(t('common.save'))}
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                      <ThemedText style={[styles.saveButtonText, { color: colors.textInverse }]}>
                        {t('common.save')}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Clone Day Modal */}
      <CloneDayModal
        visible={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        sourceDate={selectedDate}
        minimumDate={minDate}
        maximumDate={today}
        title={t('meds.clone.title')}
        subtitle={t('meds.clone.subtitle')}
        onConfirm={(targetDate) => {
          // Get selected entry IDs if in edit mode, otherwise clone all
          const entryIdsToClone = editMode ? Array.from(selectedEntryIds) : undefined;
          
          // Check cache before cloning - if no entries selected, show message and skip DB work
          if (editMode) {
            if (entryIdsToClone && entryIdsToClone.length === 0) {
              showAppToast(t('meds.clone.nothing_to_copy'));
              setShowCloneModal(false);
              return;
            }
          } else {
            if (!medLogs || medLogs.length === 0) {
              showAppToast(t('meds.clone.nothing_to_copy'));
              setShowCloneModal(false);
              return;
            }
          }
          
          showAppToast(t('meds.clone.toast_cloning'));
          const targetDateString = getLocalDateKey(targetDate);
          cloneMutation.mutate(
            {
              sourceDate: selectedDateString,
              targetDate: targetDateString,
              entryIds: entryIdsToClone,
            },
            {
              onSuccess: (clonedCount) => {
                setShowCloneModal(false);
                // Exit edit mode after successful clone
                if (editMode) {
                  setEditMode(false);
                  clearEntrySelection();
                }
                if (clonedCount > 0) {
                  const formattedDate = targetDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  showAppToast(t('meds.clone.success_toast', {
                    count: clonedCount,
                    items: clonedCount === 1 ? t('meds.clone.item_one') : t('meds.clone.item_other'),
                    date: formattedDate,
                  }));
                }
              },
              onError: (error: any) => {
                // Handle same-date error specifically
                if (error.message === 'SAME_DATE' || error.message?.includes('same date')) {
                  Alert.alert(
                    t('meds.clone.error_title'),
                    t('meds.clone.same_date_error')
                  );
                } else {
                  Alert.alert(
                    t('meds.clone.error_title'),
                    t('meds.clone.error_message', {
                      error: error.message || t('common.unexpected_error'),
                    })
                  );
                }
              },
            }
          );
        }}
        isLoading={cloneMutation.isPending}
      />

      {/* Mass Delete Confirmation Modal */}
      <ConfirmModal
        visible={showMassDeleteConfirm}
        title={t('meds.clone.mass_delete.title')}
        message={t('meds.clone.mass_delete.message', {
          count: selectedEntryIds.size,
          items: selectedEntryIds.size === 1 ? t('meds.clone.mass_delete.item_one') : t('meds.clone.mass_delete.item_other'),
        })}
        confirmText={t('meds.clone.mass_delete.confirm')}
        cancelText={t('meds.clone.mass_delete.cancel')}
        onConfirm={handleMassDeleteConfirm}
        onCancel={handleMassDeleteCancel}
        confirmButtonStyle={{ backgroundColor: '#EF4444' }}
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
  scrollView: {
    flex: 1,
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
  // Responsive container for med sections
  responsiveContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  responsiveContainerLarge: {
    maxWidth: 900,
    alignSelf: 'center',
  },
  // Card styles
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    width: '100%',
  },
  cardHeader: {
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    // Background inherits from parent SurfaceCard
    // Sticky positioning for web (optional)
    ...(Platform.OS === 'web' && {
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }),
  },
  cardHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cloneButton: {
    // Transparent background - icon sits directly on card background
    backgroundColor: 'transparent',
    // Proper touch target via padding (icon is 20px, so padding ensures 44x44 minimum)
    padding: (44 - 20) / 2, // (minTouchTarget - iconSize) / 2 = 12px padding
    alignItems: 'center',
    justifyContent: 'center',
    // Ensure minimum touch target size
    ...getMinTouchTargetStyle(),
  },
  quickAddHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  previousDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: (44 - 16) / 2, // Ensure minimum touch target
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
    ...getMinTouchTargetStyle(),
  },
  previousDayButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  quickAddTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  summary: {
    fontSize: FontSize.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  loadingContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  loadingIndicator: {
    marginVertical: Spacing.sm,
  },
  // Med list styles
  medList: {
    marginTop: Spacing.xs,
  },
  // Sections container for Med/Supp split
  sectionsContainer: {
    marginTop: Spacing.xs,
  },
  typeSection: {
    marginBottom: Spacing.sm,
  },
  typeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  typeSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  typeSectionCount: {
    fontSize: FontSize.xs,
  },
  sectionDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  emptySectionText: {
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.xs,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  medRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medRowLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  medRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  medName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  medMeta: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.3,
  },
  doseBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginLeft: Spacing.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  doseBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  // Inline dose editor styles
  doseEditorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  doseEditorInput: {
    width: 60,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  doseEditorUnitInput: {
    width: 50,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: Spacing.xs,
  },
  doseEditorButton: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  deleteButtonGhost: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
    backgroundColor: 'transparent',
    ...getMinTouchTargetStyle(),
  },
  // Quick Add chip styles
  chipSectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chipsScrollContainer: {
    // Constrain to 2.5 rows: chip height (44px min touch target) + marginBottom (8px) = 52px per row
    // 2.5 rows = 2.5 * 52px = 130px
    maxHeight: 130,
    marginBottom: Spacing.sm,
    ...(Platform.OS === 'web' && {
      overflowY: 'auto',
      overflowX: 'hidden',
    }),
  },
  chipsWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: Spacing.xs,
  },
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing.md,
    ...getMinTouchTargetStyle(),
  },
  customButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  // Clone edit mode styles
  selectAllRow: {
    borderBottomWidth: 1,
    paddingVertical: 0,
  },
  selectAllRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  selectAllText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderColor: '#EF4444' + '40',
    ...getMinTouchTargetStyle(),
  },
  actionButtonInRow: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    ...getMinTouchTargetStyle(),
  },
  iconButtonInRow: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  selectAllActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  // Recent Days styles
  recentDaysCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
  },
  recentDaysTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  recentDaysList: {
    gap: 0,
  },
  recentDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  recentDayDate: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  recentDayStats: {
    fontSize: FontSize.base,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' && {
      justifyContent: 'center',
      alignItems: 'center',
    }),
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    paddingTop: Spacing.lg,
    maxHeight: Platform.select({ web: '85%', default: '90%' }),
    width: '100%',
    ...(Platform.OS === 'web' && {
      width: '90%',
      maxWidth: 500,
      borderBottomLeftRadius: BorderRadius['2xl'],
      borderBottomRightRadius: BorderRadius['2xl'],
      paddingBottom: Spacing.lg,
    }),
    ...Shadows.lg,
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
  formScrollView: {
    flex: 1,
  },
  formContent: {
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
  formTextArea: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.md,
    minHeight: 100,
  },
  formHelper: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  typeSelector: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  typeOption: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    borderColor: 'transparent',
    ...getMinTouchTargetStyle(),
  },
  doseInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  doseAmountInput: {
    flex: 2,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.md,
  },
  doseUnitInput: {
    width: 100,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.md,
  },
  formButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  formButton: {
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
  // Delete confirmation modal styles
  confirmModalContent: {
    borderRadius: BorderRadius.xl,
    padding: Spacing['2xl'],
    margin: Spacing.lg,
    maxWidth: 400,
    width: '90%',
    ...Shadows.lg,
  },
  confirmModalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  confirmModalMessage: {
    fontSize: FontSize.base,
    marginBottom: Spacing['2xl'],
    lineHeight: FontSize.base * 1.5,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  confirmModalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  deleteConfirmButton: {
    // backgroundColor set inline
  },
  // Preferences modal styles
  prefsToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...getMinTouchTargetStyle(),
  },
  prefsToggleLabel: {
    fontSize: FontSize.base,
    flex: 1,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignSelf: 'flex-end',
  },
});

