import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, BorderRadius, SemanticColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { showAppToast } from '@/components/ui/app-toast';
import type { DailyLogStatus, DailySumConsumed } from '@/utils/types';
import { useDailySumConsumedRange } from '@/hooks/use-daily-sum-consumed-range';
import { useSetDailyConsumedStatus } from '@/hooks/use-set-daily-consumed-status';
import { compareDateKeys } from '@/lib/date-guard';
import { addDays } from '@/utils/dateKey';
import { FOOD_LOG } from '@/constants/constraints';
import {
  getButtonAccessibilityProps,
  getFocusStyle,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';

export const DONE_FOR_TODAY_CTA_HEIGHT = 32;

type Props = {
  /** YYYY-MM-DD currently viewed date */
  selectedDateKey: string;
  /** YYYY-MM-DD */
  todayKey: string;
  /** YYYY-MM-DD */
  yesterdayKey: string;
  /** e.g. "Jan 2" or "Fri, Jan 2" (already formatted by Home) */
  formattedSelectedDate: string;
};

type ModalState = 'none' | 'completionConfirm' | 'fastedSecondaryConfirm' | 'changeStatus';

type ModalAction = {
  label: string;
  onPress: () => void;
  /** If true, pressing this action dismisses the modal (so we should freeze content during fade-out). */
  dismisses: boolean;
};

type ModalContent = {
  title: string;
  message: string;
  primary: ModalAction;
  secondary: ModalAction | null;
};

type FrozenModalRender = {
  title: string;
  message: string;
  primaryText: string;
  secondaryText: string | null;
  cancelText: string;
};

function normalizeStatus(input: string | null | undefined): DailyLogStatus {
  if (input === 'completed' || input === 'fasted' || input === 'unknown') return input;
  return 'unknown';
}

export function DoneForTodayButton({ selectedDateKey, todayKey, yesterdayKey, formattedSelectedDate }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? 'light';
  const colors = Colors[scheme];
  const { user } = useAuth();
  const userId = user?.id;
  const tintOnTintColor = colors.textOnTint;

  const { data: rows = [] } = useDailySumConsumedRange(userId, selectedDateKey, selectedDateKey);
  const todayRow = (rows[0] as DailySumConsumed | undefined) ?? undefined;

  const logStatus = normalizeStatus(todayRow?.log_status);
  const calories = typeof todayRow?.calories === 'number' ? todayRow.calories : 0;

  const setStatusMutation = useSetDailyConsumedStatus();

  const [modal, setModal] = useState<ModalState>('none');
  const [frozenModalRender, setFrozenModalRender] = useState<FrozenModalRender | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUnknown = logStatus === 'unknown';
  const isCompleted = logStatus === 'completed';
  const isFasted = logStatus === 'fasted';

  const isPrimaryFastedAllowedInHighCalories = calories < FOOD_LOG.DONE_MODAL.FASTED_PRIMARY_MAX_CAL_EXCLUSIVE;

  const minAllowedKey = addDays(todayKey, -(FOOD_LOG.DONE_CTA_GRACE_DAYS - 1));
  const isWithinGraceWindow =
    compareDateKeys(selectedDateKey, minAllowedKey) >= 0 && compareDateKeys(selectedDateKey, todayKey) <= 0;

  const isToday = selectedDateKey === todayKey;
  const isYesterday = selectedDateKey === yesterdayKey;

  const ctaLabel = useMemo(() => {
    if (isUnknown) {
      if (isToday) return t('home.done_for_today.cta_today', { defaultValue: 'Done for Today' });
      if (isYesterday) return t('home.done_for_today.cta_yesterday', { defaultValue: 'Done for Yesterday' });
      return t('home.done_for_today.cta_day', { defaultValue: 'Done for the Day' });
    }
    if (isCompleted) return t('home.done_for_today.cta_completed', { defaultValue: 'Completed ✓' });
    return t('home.done_for_today.cta_fasted', { defaultValue: 'Fasted' });
  }, [isCompleted, isToday, isYesterday, isUnknown, t]);

  const doneForDayLabel = useMemo(() => {
    if (isToday) return t('home.done_for_today.action_done_for_today', { defaultValue: 'Done for Today' });
    if (isYesterday) return t('home.done_for_today.action_done_for_yesterday', { defaultValue: 'Done for Yesterday' });
    return t('home.done_for_today.action_done_for_day', { defaultValue: 'Done for the Day' });
  }, [isToday, isYesterday, t]);

  const ctaIconName = useMemo(() => {
    if (isUnknown) return 'checkmark.circle.fill' as const;
    if (isCompleted) return 'checkmark' as const;
    return 'checkmark' as const;
  }, [isCompleted, isUnknown]);

  const open = () => {
    if (setStatusMutation.isPending) {
      showAppToast(t('common.loading', { defaultValue: 'Loading' }));
      return;
    }
    if (!userId) {
      showAppToast(t('home.done_for_today.not_authenticated', { defaultValue: 'Please sign in again.' }));
      return;
    }

    // Ensure stale freeze state can't bleed into a newly opened modal.
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setFrozenModalRender(null);
    setIsDismissing(false);

    if (isUnknown) setModal('completionConfirm');
    else setModal('changeStatus');
  };

  const close = () => setModal('none');

  const applyStatus = (next: DailyLogStatus, toastKey: 'completed' | 'fasted' | 'unknown') => {
    if (!userId) return;

    // Dismiss immediately to avoid the modal briefly re-rendering to the new status
    // due to optimistic cache updates.
    close();

    setStatusMutation
      .mutateAsync({ entryDate: selectedDateKey, status: next })
      .then(() => {
        if (toastKey === 'completed') {
          showAppToast(t('home.done_for_today.toast_completed', { defaultValue: 'Marked done for today.' }));
        } else if (toastKey === 'fasted') {
          showAppToast(t('home.done_for_today.toast_fasted', { defaultValue: 'Marked today as fasted.' }));
        } else {
          showAppToast(t('home.done_for_today.toast_unknown', { defaultValue: 'Reopened today.' }));
        }
      })
      .catch(() => {
        // Toast only; optimistic rollback is handled in the mutation hook.
        showAppToast(t('home.done_for_today.toast_error', { defaultValue: 'Could not update today. Try again.' }));
      });
  };

  if (!isWithinGraceWindow) {
    return null;
  }

  const completionConfirmContent = useMemo<ModalContent>(() => {
    const title = isToday
      ? t('home.done_for_today.confirm_title', { defaultValue: 'Done for Today?' })
      : t('home.done_for_today.confirm_title_for_date', {
          date: formattedSelectedDate,
          defaultValue: 'Done for {{date}}?',
        });

    if (calories === 0) {
      return {
        title,
        message: t('home.done_for_today.confirm_message_zero', {
          defaultValue:
            "You have 0 calories logged for today.\nIf you're fasting, you can mark today as Fasted.\nIf not, you can finish now and come back later to add entries.",
        }),
        primary: {
          label: t('home.done_for_today.action_mark_fasted', { defaultValue: 'Mark as Fasted' }),
          onPress: () => applyStatus('fasted', 'fasted'),
          dismisses: true,
        },
        secondary: {
          label: doneForDayLabel,
          onPress: () => applyStatus('completed', 'completed'),
          dismisses: true,
        },
      };
    }

    if (calories >= 1 && calories <= FOOD_LOG.DONE_MODAL.LOW_CAL_MAX_INCLUSIVE) {
      return {
        title,
        message: t('home.done_for_today.confirm_message_low', {
          calories,
          defaultValue:
            "Today's total is {{calories}} calories, which looks low.\nIf this was a fasting day, you can mark it as Fasted.\nOtherwise, you can finish now and add more later.",
        }),
        primary: {
          label: doneForDayLabel,
          onPress: () => applyStatus('completed', 'completed'),
          dismisses: true,
        },
        secondary: {
          label: t('home.done_for_today.action_mark_fasted', { defaultValue: 'Mark as Fasted' }),
          onPress: () => applyStatus('fasted', 'fasted'),
          dismisses: true,
        },
      };
    }

    // calories >= OK_CAL_MIN_INCLUSIVE
    return {
      title,
      message: t('home.done_for_today.confirm_message_ok', {
        calories,
        defaultValue:
          "You've logged {{calories}} calories today.\nAre you ready to mark today as done?\nYou can change this later if needed.",
      }),
      primary: {
        label: doneForDayLabel,
        onPress: () => applyStatus('completed', 'completed'),
        dismisses: true,
      },
      secondary: isPrimaryFastedAllowedInHighCalories
        ? {
            label: t('home.done_for_today.action_mark_fasted', { defaultValue: 'Mark as Fasted' }),
            onPress: () => setModal('fastedSecondaryConfirm'),
            dismisses: false,
          }
        : null,
    };
  }, [applyStatus, calories, doneForDayLabel, formattedSelectedDate, isPrimaryFastedAllowedInHighCalories, isToday, t]);

  const fastedSecondaryConfirmContent = useMemo<ModalContent>(() => {
    return {
      title: t('home.done_for_today.fasted_secondary_title', { defaultValue: 'Mark as Fasted?' }),
      message: t('home.done_for_today.fasted_secondary_message', {
        calories,
        defaultValue:
          "You've logged {{calories}} calories today.\nFasting is usually associated with very low intake.\nIf this reflects your intention, you can still mark today as Fasted.",
      }),
      primary: {
        label: t('home.done_for_today.action_mark_fasted', { defaultValue: 'Mark as Fasted' }),
        onPress: () => applyStatus('fasted', 'fasted'),
        dismisses: true,
      },
      secondary: {
        label: doneForDayLabel,
        onPress: () => applyStatus('completed', 'completed'),
        dismisses: true,
      },
    };
  }, [applyStatus, calories, doneForDayLabel, t]);

  const changeStatusContent = useMemo<ModalContent>(() => {
    if (isCompleted) {
      return {
        title: t('home.done_for_today.change_completed_title', {
          defaultValue: 'Today is marked as Completed',
        }),
        message: t('home.done_for_today.change_message', {
          defaultValue: 'You can reopen today to keep logging or change how today is marked.',
        }),
        primary: {
          label: t('home.done_for_today.action_reopen_log', { defaultValue: 'Reopen Log' }),
          onPress: () => applyStatus('unknown', 'unknown'),
          dismisses: true,
        },
        secondary: {
          label: t('home.done_for_today.action_mark_fasted', { defaultValue: 'Mark as Fasted' }),
          onPress: () => applyStatus('fasted', 'fasted'),
          dismisses: true,
        },
      };
    }

    // fasted
    return {
      title: t('home.done_for_today.change_fasted_title', {
        defaultValue: 'Today is marked as Fasted',
      }),
      message: t('home.done_for_today.change_message', {
        defaultValue: 'You can reopen today to keep logging or change how today is marked.',
      }),
      primary: {
        label: t('home.done_for_today.action_reopen_log', { defaultValue: 'Reopen Log' }),
        onPress: () => applyStatus('unknown', 'unknown'),
        dismisses: true,
      },
      secondary: {
        label: doneForDayLabel,
        onPress: () => applyStatus('completed', 'completed'),
        dismisses: true,
      },
    };
  }, [applyStatus, doneForDayLabel, isCompleted, t]);

  const buttonStyle = useMemo(() => {
    if (isUnknown) {
      return {
        backgroundColor: colors.tint,
        borderColor: 'transparent',
        labelColor: tintOnTintColor,
        iconColor: tintOnTintColor,
      };
    }
    if (isCompleted) {
      return {
        backgroundColor: SemanticColors.successLight,
        borderColor: colors.border,
        labelColor: colors.text,
        iconColor: SemanticColors.success,
      };
    }
    return {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.border,
      labelColor: colors.text,
      iconColor: colors.textSecondary,
    };
  }, [colors, isCompleted, isUnknown, tintOnTintColor]);

  const showModal =
    modal === 'completionConfirm' || modal === 'fastedSecondaryConfirm' || modal === 'changeStatus';

  const modalContent =
    modal === 'completionConfirm'
      ? completionConfirmContent
      : modal === 'fastedSecondaryConfirm'
      ? fastedSecondaryConfirmContent
      : changeStatusContent;

  const cancelText =
    modal === 'changeStatus'
      ? t('common.close', { defaultValue: 'Close' })
      : t('home.done_for_today.action_keep_logging', { defaultValue: 'Keep Logging' });

  const clearFreeze = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setFrozenModalRender(null);
    setIsDismissing(false);
  };

  // Fallback: some platforms may not reliably fire Modal.onDismiss. Clear after fade duration.
  useEffect(() => {
    if (!showModal && isDismissing) {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        clearFreeze();
      }, 300);
    }
  }, [isDismissing, showModal]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const freezeForDismiss = () => {
    if (isDismissing) return false;

    setFrozenModalRender({
      title: modalContent.title,
      message: modalContent.message,
      primaryText: modalContent.primary.label,
      secondaryText: modalContent.secondary?.label ?? null,
      cancelText,
    });

    setIsDismissing(true);
    return true;
  };

  const primaryHandler = () => {
    if (!modalContent.primary.dismisses) return modalContent.primary.onPress();
    if (!freezeForDismiss()) return;
    modalContent.primary.onPress();
  };

  const secondaryHandler = () => {
    const secondary = modalContent.secondary;
    if (!secondary) return;
    if (!secondary.dismisses) return secondary.onPress();
    if (!freezeForDismiss()) return;
    secondary.onPress();
  };

  const cancelHandler = () => {
    if (!freezeForDismiss()) return;
    close();
  };

  const renderTitle = frozenModalRender?.title ?? modalContent.title;
  const renderMessage = frozenModalRender?.message ?? modalContent.message;
  const renderPrimaryText = frozenModalRender?.primaryText ?? modalContent.primary.label;
  const renderSecondaryText = frozenModalRender?.secondaryText ?? (modalContent.secondary?.label ?? null);
  const renderCancelText = frozenModalRender?.cancelText ?? cancelText;

  return (
    <>
      {/* Keep the CTA visible above the fixed tab bar, but avoid extra blank space. */}
      <View style={[styles.wrap, { marginBottom: 4 }]}>
        <TouchableOpacity
          onPress={open}
          activeOpacity={0.85}
          style={[
            styles.button,
            {
              height: DONE_FOR_TODAY_CTA_HEIGHT,
              backgroundColor: buttonStyle.backgroundColor,
              borderColor: buttonStyle.borderColor,
              opacity: setStatusMutation.isPending ? 0.9 : 1,
            },
            getMinTouchTargetStyle(),
            Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
          ]}
          {...getButtonAccessibilityProps(
            ctaLabel,
            t('home.done_for_today.cta_a11y_hint', { defaultValue: 'Double tap to change today’s status.' })
          )}
        >
          <View style={styles.buttonInner}>
            <IconSymbol name={ctaIconName} size={18} color={buttonStyle.iconColor} decorative={true} />
            <Text style={[styles.buttonLabel, { color: buttonStyle.labelColor }]} numberOfLines={1}>
              {ctaLabel}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ThreeActionModal
        visible={showModal}
        title={renderTitle}
        message={renderMessage}
        primaryText={renderPrimaryText}
        onPrimary={primaryHandler}
        secondaryText={renderSecondaryText}
        onSecondary={renderSecondaryText ? secondaryHandler : undefined}
        cancelText={renderCancelText}
        onCancel={cancelHandler}
        onDismiss={clearFreeze}
        colors={colors}
        tintOnTintColor={tintOnTintColor}
        loading={setStatusMutation.isPending || isDismissing}
      />
    </>
  );
}

function ThreeActionModal(props: {
  visible: boolean;
  title: string;
  message: string;
  primaryText: string;
  onPrimary: () => void;
  secondaryText: string | null;
  onSecondary?: () => void;
  cancelText: string;
  onCancel: () => void;
  onDismiss?: () => void;
  colors: typeof Colors.light | typeof Colors.dark;
  tintOnTintColor: string;
  loading?: boolean;
}) {
  const {
    visible,
    title,
    message,
    primaryText,
    onPrimary,
    secondaryText,
    onSecondary,
    cancelText,
    onCancel,
    onDismiss,
    colors,
    tintOnTintColor,
    loading,
  } = props;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
      onDismiss={onDismiss}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={onCancel}
            disabled={loading}
            style={[styles.modalCloseButton, getMinTouchTargetStyle()]}
            {...getButtonAccessibilityProps(cancelText, cancelText)}
          >
            <IconSymbol name="xmark" size={18} color={colors.textSecondary} decorative={true} />
          </TouchableOpacity>

          <ThemedText type="title" style={styles.modalTitle}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.modalMessage, { color: colors.text }]}>{message}</ThemedText>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              onPress={onPrimary}
              disabled={loading}
              activeOpacity={0.8}
              style={[
                styles.modalButton,
                styles.modalButtonPrimary,
                { backgroundColor: colors.tint, opacity: loading ? 0.6 : 1 },
                getMinTouchTargetStyle(),
                Platform.OS === 'web' ? getFocusStyle('#fff') : null,
              ]}
              {...getButtonAccessibilityProps(primaryText, primaryText)}
            >
              <Text style={[styles.modalButtonText, { color: tintOnTintColor }]}>{primaryText}</Text>
            </TouchableOpacity>

            {secondaryText && onSecondary && (
              <TouchableOpacity
                onPress={onSecondary}
                disabled={loading}
                activeOpacity={0.8}
                style={[
                  styles.modalButton,
                  styles.modalButtonSecondary,
                  { borderColor: colors.border, opacity: loading ? 0.6 : 1 },
                  getMinTouchTargetStyle(),
                  Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                ]}
                {...getButtonAccessibilityProps(secondaryText, secondaryText)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>{secondaryText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.8}
              style={[
                styles.modalButton,
                styles.modalButtonCancel,
                { borderColor: colors.border, opacity: loading ? 0.6 : 1 },
                getMinTouchTargetStyle(),
                Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
              ]}
              {...getButtonAccessibilityProps(cancelText, cancelText)}
            >
              <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>{cancelText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: Spacing.lg,
  },
  button: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.10)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  modalCloseButton: {
    position: 'absolute',
    left: -Spacing.sm,
    top: -Spacing.sm,
    zIndex: 1,
  },
  modalTitle: {
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  modalMessage: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    gap: Spacing.sm,
  },
  modalButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonPrimary: {},
  modalButtonSecondary: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  modalButtonCancel: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});


