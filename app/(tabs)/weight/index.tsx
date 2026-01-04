import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CollapsibleModuleHeader } from '@/components/header/CollapsibleModuleHeader';
import { DatePickerButton } from '@/components/header/DatePickerButton';
import {
  useWeightLogs366d,
  getLatestWeightEntry,
  getLatestBodyFatEntry,
} from '@/hooks/use-weight-logs';
import { deriveDailyLatestWeight } from '@/lib/derive/daily-latest-weight';
import { WeightChartCarousel } from '@/components/weight/WeightChartCarousel';
import { useUserConfig } from '@/hooks/use-user-config';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import { Colors, Spacing, BorderRadius, Layout, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { getLocalDateKey } from '@/utils/dateTime';
import { useTranslation } from 'react-i18next';
import { clampDateKey, compareDateKeys, dateKeyToLocalStartOfDay, getMinAllowedDateKeyFromSignupAt } from '@/lib/date-guard';
import { toDateKey } from '@/utils/dateKey';
import { useClampedDateParam } from '@/hooks/use-clamped-date-param';
import { getButtonAccessibilityProps } from '@/utils/accessibility';

export default function WeightHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, profile: authProfile } = useAuth();
  const todayLocal = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [selectedDate, setSelectedDate] = useState<Date>(todayLocal);
  const rawDate = params?.date;
  const hasDateParam = Array.isArray(rawDate) ? typeof rawDate[0] === 'string' : typeof rawDate === 'string';
  const { dateKey: routeDateKey } = useClampedDateParam({ paramKey: 'date', toastOnPreMin: false });

  // If we were navigated here with a ?date= param (e.g., from Day Weight back),
  // honor it once and display that day.
  // Note: the Weight home screen otherwise manages date locally and does not persist it to the URL.
  useEffect(() => {
    if (!hasDateParam) return;
    setSelectedDate(dateKeyToLocalStartOfDay(routeDateKey));
  }, [hasDateParam, routeDateKey]);
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility
  const effectiveProfile = userConfig || authProfile; // For avatar
  const updateProfile = useUpdateProfile();
  const [showMenu, setShowMenu] = useState(false);
  const weight366Query = useWeightLogs366d();
  const rawLogs = weight366Query.data ?? [];
  const dailyLatest = useMemo(() => deriveDailyLatestWeight(rawLogs), [rawLogs]);
  const isLoading = weight366Query.isLoading;
  const isFetching = weight366Query.isFetching;
  const todayKey = getLocalDateKey(todayLocal);
  const isToday = getLocalDateKey(selectedDate) === getLocalDateKey(todayLocal);
  const minDateKey = useMemo(() => {
    const signupAt = user?.created_at;
    if (!signupAt) return toDateKey(todayLocal);
    return getMinAllowedDateKeyFromSignupAt(signupAt);
  }, [todayLocal, user?.created_at]);
  const minDate = useMemo(() => dateKeyToLocalStartOfDay(minDateKey), [minDateKey]);
  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const canGoBack = selectedDateKey > minDateKey;

  const setSelectedDateClamped = (date: Date) => {
    const clampedKey = clampDateKey(toDateKey(date), minDateKey, toDateKey(todayLocal));
    setSelectedDate(dateKeyToLocalStartOfDay(clampedKey));
  };

  const unit: 'kg' | 'lbs' = profile?.weight_unit === 'kg' ? 'kg' : 'lbs';
  const latestEntry = weight366Query.data ? getLatestWeightEntry(weight366Query.data) : null;
  const latestBodyFatEntry = weight366Query.data ? getLatestBodyFatEntry(weight366Query.data) : null;
  const latestWeightValueLb = latestEntry?.weight_lb ?? null;
  const latestWeightDisplay =
    latestWeightValueLb !== null
      ? unit === 'kg'
        ? `${roundTo1(lbToKg(latestWeightValueLb)).toFixed(1)} kg`
        : `${roundTo1(latestWeightValueLb).toFixed(1)} lbs`
      : '—';
  const latestBodyFatDisplay =
    latestBodyFatEntry?.body_fat_percent !== null && latestBodyFatEntry?.body_fat_percent !== undefined
      ? `${roundTo1(latestBodyFatEntry.body_fat_percent).toFixed(1)}%`
      : '—';
  const latestTimestamp = latestEntry ? new Date(latestEntry.weighed_at) : null;

  const days = useMemo(() => {
    return deriveWeightHomeDaysFromLogs({
      rawLogs,
      selectedDate,
      rangeDays: 7,
      fetchWindowDays: 14,
      moduleStartMinDateKey: minDateKey,
      moduleStartUserCreatedAtISO: user?.created_at ?? null,
      todayLocal,
    });
  }, [minDateKey, rawLogs, selectedDate, todayLocal, user?.created_at]);

  const renderWeight = (weightLb: number | null) => {
    if (weightLb === null) return 'No data yet';
    const value = unit === 'kg' ? roundTo1(lbToKg(weightLb)) : roundTo1(weightLb);
    const displayUnit = unit === 'kg' ? 'kg' : 'lbs';
    return `${value.toFixed(1)} ${displayUnit}`;
  };

  // Format date for display (same logic as index.tsx)
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const selectedDateNormalized = new Date(selectedDate);
  selectedDateNormalized.setHours(0, 0, 0, 0);
  const currentYear = todayDate.getFullYear();
  const selectedYear = selectedDate.getFullYear();
  const isCurrentYear = selectedYear === currentYear;
  const dateOptions: Intl.DateTimeFormatOptions = {
    ...(isToday || selectedDateNormalized.getTime() === yesterday.getTime() ? {} : { weekday: 'short' }),
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  };
  const formattedDate = selectedDate.toLocaleDateString('en-US', dateOptions);
  const dateText = isToday
    ? `${t('common.today')}, ${formattedDate}`
    : selectedDateNormalized.getTime() === yesterday.getTime()
    ? `${t('common.yesterday')}, ${formattedDate}`
    : formattedDate;

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <CollapsibleModuleHeader
        dateText={dateText}
        rightAvatarUri={effectiveProfile?.avatar_url ?? undefined}
        preferredName={effectiveProfile?.first_name ?? undefined}
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <DatePickerButton
              selectedDate={selectedDate}
              onDateSelect={setSelectedDateClamped}
              today={todayLocal}
              minimumDate={minDate}
              maximumDate={todayLocal}
            />
            <TouchableOpacity
              style={styles.gearButton}
              onPress={() => setShowMenu((prev) => !prev)}
              activeOpacity={0.7}
              disabled={false}
            >
              <IconSymbol name="gearshape" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        }
        goBackOneDay={
          canGoBack
            ? () => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedDateClamped(newDate);
              }
            : undefined
        }
        goForwardOneDay={() => {
          if (!isToday) {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() + 1);
            setSelectedDateClamped(newDate);
          }
        }}
        isToday={isToday}
        module="weight"
      >
        <DesktopPageContainer>
          <WeightChartCarousel dailyLatest={dailyLatest} selectedDate={selectedDate} todayLocal={todayLocal} unit={unit} />

            <View style={[styles.card, { backgroundColor: colors.card, ...Shadows.md }]}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.tint} />
                </View>
              ) : (
                <View style={{ gap: Spacing.md }}>
                  {days.map((day) => {
                    const dateLabel = formatDateLabel(day.date, todayLocal);
                    const weightDisplay = renderWeight(day.weightLb);
                    const isCarried = day.carriedForward && day.weightLb !== null;
                    const weightColor = day.weightLb === null ? colors.textSecondary : isCarried ? colors.textSecondary : colors.text;
                    return (
                      <TouchableOpacity
                        key={day.date}
                        style={[styles.row, { borderBottomColor: colors.border }]}
                        onPress={() => {
                        if (day.hasEntry && day.entryId) {
                          router.push({
                            pathname: '/weight/entry',
                            params: {
                              date: day.date,
                              weightLb: day.weightLb?.toString() ?? '',
                              bodyFatPercent:
                                day.bodyFatPercent !== null && day.bodyFatPercent !== undefined
                                  ? day.bodyFatPercent.toString()
                                  : '',
                              entryId: day.entryId,
                              weighedAt: day.weighedAt ?? '',
                            },
                          });
                        } else if (day.carriedForward && day.date !== todayKey) {
                          router.push({
                            pathname: '/weight/entry',
                            params: {
                              mode: 'add_for_date',
                              date: day.date,
                            },
                          });
                        } else {
                          router.push({
                            pathname: '/weight/entry',
                            params: { mode: 'add_today' },
                          });
                        }
                        }}
                      >
                        <View style={{ gap: Spacing.xs }}>
                          <ThemedText style={{ color: colors.text, fontWeight: '600' }}>
                            {dateLabel}
                          </ThemedText>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: Spacing.xs }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                            {day.entryCount > 1 && (
                              <TouchableOpacity
                                style={[styles.multiEntryClue, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                                onPress={(e: any) => {
                                  e?.stopPropagation?.();
                                  router.push({
                                    pathname: '/weight/day',
                                    params: { date: day.date, fromDate: selectedDateKey },
                                  });
                                }}
                                onPressIn={(e: any) => {
                                  e?.stopPropagation?.();
                                }}
                                activeOpacity={0.8}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700' }}>
                                  {'📚'} {day.entryCount}
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                            <ThemedText style={{ color: weightColor, fontSize: FontSize.lg, fontWeight: FontWeight.semibold }}>
                              {weightDisplay}
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.sm, textAlign: 'right' }}>
                            {day.bodyFatPercent !== null && day.bodyFatPercent !== undefined
                              ? t('weight.body_fat', { value: roundTo1(day.bodyFatPercent).toFixed(1) })
                              : '—'}
                          </ThemedText>
                          {isCarried && (
                            <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.xs }}>
                              carried forward
                            </ThemedText>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Spacer so the last row can scroll above the floating action button */}
            <View style={{ height: Layout.bottomTabBarHeight + Spacing.md }} />
        </DesktopPageContainer>
      </CollapsibleModuleHeader>

      {/* Floating action button: Log weigh */}
      <View pointerEvents="box-none" style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: colors.tint, opacity: isFetching ? 0.95 : 1 }]}
          onPress={() => router.push('/weight/entry')}
          disabled={isFetching || isLoading}
          activeOpacity={0.85}
          {...getButtonAccessibilityProps(t('weight.fab.log_weight_a11y'))}
        >
          <ThemedText style={[styles.fabButtonText, { color: colors.textInverse }]}>
            {t('weight.fab.log_weight')}
          </ThemedText>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowMenu(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={[styles.menuTitle, { color: colors.textSecondary }]}>
              Weight unit
            </ThemedText>
            <View style={styles.menuOptions}>
              {(['lbs', 'kg'] as const).map((opt) => {
                const isActive = unit === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.menuOption,
                      isActive && { backgroundColor: colors.tint + '15', borderColor: colors.tint },
                    ]}
                    onPress={() => {
                      if (opt !== unit) {
                        updateProfile.mutate({ weight_unit: opt });
                      }
                      setShowMenu(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={{ color: colors.text }}>
                      {opt === 'lbs' ? 'lbs' : 'kg'}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

function formatDateLabel(dateStr: string, today: Date) {
  const date = new Date(`${dateStr}T00:00:00`);
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);

  const todayCopy = new Date(today);
  todayCopy.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayCopy);
  yesterday.setDate(yesterday.getDate() - 1);

  const baseLabel = normalized.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (normalized.getTime() === todayCopy.getTime()) {
    return `Today · ${baseLabel}`;
  }
  if (normalized.getTime() === yesterday.getTime()) {
    return `Yesterday · ${baseLabel}`;
  }
  return baseLabel;
}

type WeightDay = {
  entryId: string | null;
  date: string;
  weightLb: number | null;
  bodyFatPercent: number | null;
  weighedAt?: string | null;
  carriedForward: boolean;
  hasEntry: boolean;
  entryCount: number;
};

function deriveWeightHomeDaysFromLogs(input: {
  rawLogs: Array<{ id: string; weighed_at: string; weight_lb: number; body_fat_percent: number | null }>;
  selectedDate: Date;
  rangeDays: number;
  fetchWindowDays: number;
  moduleStartMinDateKey: string;
  moduleStartUserCreatedAtISO: string | null;
  todayLocal: Date;
}): WeightDay[] {
  const { rawLogs, selectedDate, rangeDays, fetchWindowDays, moduleStartMinDateKey, moduleStartUserCreatedAtISO, todayLocal } = input;

  const today = new Date(selectedDate);
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (fetchWindowDays - 1));
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  // Filter logs to the same window the previous implementation fetched from the DB (14d minimum).
  const windowLogs = rawLogs.filter((log) => {
    const ms = new Date(log.weighed_at).getTime();
    return ms >= startDate.getTime() && ms <= endDate.getTime();
  });

  // Count entries per local day (for multi-entry indicator + day view)
  const countByDate = new Map<string, number>();
  windowLogs.forEach((log) => {
    const key = getLocalDateKey(new Date(log.weighed_at));
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
  });

  // Map latest entry per day
  const latestByDate = new Map<string, (typeof windowLogs)[number]>();
  windowLogs.forEach((log) => {
    const key = getLocalDateKey(new Date(log.weighed_at));
    const existing = latestByDate.get(key);
    if (!existing || new Date(log.weighed_at).getTime() > new Date(existing.weighed_at).getTime()) {
      latestByDate.set(key, log);
    }
  });

  // Determine module start day for filtering/carry-forward:
  // - If the account was created within our 366d fetch window, the earliest log we have is also the earliest possible log.
  // - Otherwise, use the min allowed date key (signup clamp) so we don't incorrectly hide days for long-time users with older logs.
  const startOfFetch = new Date(todayLocal);
  startOfFetch.setDate(startOfFetch.getDate() - 365);
  startOfFetch.setHours(0, 0, 0, 0);
  const createdAtMs = moduleStartUserCreatedAtISO ? new Date(moduleStartUserCreatedAtISO).getTime() : null;
  const canTrustWindowAsFullHistory = createdAtMs !== null && createdAtMs >= startOfFetch.getTime();
  const earliestLogKey = rawLogs.length > 0 ? getLocalDateKey(new Date(rawLogs[0].weighed_at)) : null;
  const firstEntryDateKey = canTrustWindowAsFullHistory && earliestLogKey ? earliestLogKey : moduleStartMinDateKey;

  // Build date list ascending to compute carry-forward correctly
  const allDateKeys: string[] = [];
  for (let i = 0; i < fetchWindowDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    allDateKeys.push(getLocalDateKey(d));
  }

  let lastKnownWeight: number | null = null;
  const timeline: WeightDay[] = allDateKeys.map((dateKey) => {
    const entry = latestByDate.get(dateKey);
    const hasEntry = !!entry;
    const weightFromEntry = entry?.weight_lb ?? null;
    const bodyFatFromEntry = entry?.body_fat_percent ?? null;
    const entryId = entry?.id ?? null;
    const entryCount = countByDate.get(dateKey) ?? 0;

    if (hasEntry && weightFromEntry !== null) {
      lastKnownWeight = weightFromEntry;
    }

    const shouldCarryForward = !hasEntry && lastKnownWeight !== null && dateKey >= firstEntryDateKey;

    return {
      date: dateKey,
      entryId,
      weightLb: hasEntry ? weightFromEntry : shouldCarryForward ? lastKnownWeight : null,
      bodyFatPercent: hasEntry ? bodyFatFromEntry : null,
      weighedAt: entry?.weighed_at ?? null,
      carriedForward: shouldCarryForward && !hasEntry,
      hasEntry,
      entryCount,
    };
  });

  const windowDays = timeline.slice(-rangeDays).reverse(); // Today first

  // Hide days before the first-ever weigh-in day (module start day).
  // NOTE: Without an extra DB call, we cannot know whether a long-time user has weight logs older than the 366d window.
  // This strategy avoids incorrectly hiding days for those users while still hiding pre-first-entry days for new accounts.
  if (canTrustWindowAsFullHistory && earliestLogKey) {
    return windowDays.filter((d) => d.date >= earliestLogKey);
  }

  return windowDays;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    ...Platform.select({
      web: { minHeight: '100%' },
    }),
  },
  scrollContent: {
    width: '100%',
    paddingTop: Spacing.none, // 0px - minimal gap between logo and greeting
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.screenPadding,
    ...(Platform.OS !== 'web' && {
      paddingBottom: 100, // match home mobile bottom padding
    }),
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 0, // DesktopPageContainer handles horizontal padding on web/desktop
    }),
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  chartWrap: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2000,
  },
  loadingContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.none,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  multiEntryClue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  fabContainer: {
    position: 'absolute',
    right: Layout.screenPadding,
    bottom: Layout.bottomTabBarHeight + Spacing.md,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    ...Shadows.md,
  },
  fabButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  gearButton: {
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '90%',
    maxWidth: 320,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  menuTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  menuOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  menuOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});


