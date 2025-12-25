import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CollapsibleModuleHeader } from '@/components/header/CollapsibleModuleHeader';
import { DatePickerButton } from '@/components/header/DatePickerButton';
import {
  useWeightHomeData,
  useWeightLogs180d,
  getLatestWeightEntry,
  getLatestBodyFatEntry,
} from '@/hooks/use-weight-logs';
import { useUserConfig } from '@/hooks/use-user-config';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import { Colors, Spacing, BorderRadius, Layout, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { formatLocalTime, getLocalDateKey } from '@/utils/dateTime';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Circle } from 'react-native-svg';

export default function WeightHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { profile: authProfile } = useAuth();
  const todayLocal = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [selectedDate, setSelectedDate] = useState<Date>(todayLocal);
  const [chartWidth, setChartWidth] = useState<number>(0);
  const { data: userConfig } = useUserConfig();
  const profile = userConfig; // Alias for backward compatibility
  const effectiveProfile = userConfig || authProfile; // For avatar
  const updateProfile = useUpdateProfile();
  const [showMenu, setShowMenu] = useState(false);
  const { days, isLoading, isFetching } = useWeightHomeData(7, selectedDate);
  const weight180Query = useWeightLogs180d();
  const todayKey = getLocalDateKey(todayLocal);
  const isToday = getLocalDateKey(selectedDate) === getLocalDateKey(todayLocal);

  const unit: 'kg' | 'lbs' = profile?.weight_unit === 'kg' ? 'kg' : 'lbs';
  const latestEntry = weight180Query.data ? getLatestWeightEntry(weight180Query.data) : null;
  const latestBodyFatEntry = weight180Query.data ? getLatestBodyFatEntry(weight180Query.data) : null;
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

  const { chartLabels, chartData, hasSufficientPoints, chartPadding } = useMemo(() => {
    const DOT_R = 5;
    const PAD_X = DOT_R + 2;
    const PAD_Y_TOP = DOT_R + 2;
    const PAD_Y_BOTTOM = DOT_R + 10;

    const end = new Date(selectedDate);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const keys: string[] = [];
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      keys.push(getLocalDateKey(d));
      labels.push(
        d.toLocaleDateString('en-US', {
          weekday: 'short',
        })[0]
      );
    }

    const logs = weight180Query.data ?? [];
    // Build daily averages map
    const sums = new Map<string, { sum: number; count: number }>();
    logs.forEach((log) => {
      const key = getLocalDateKey(new Date(log.weighed_at));
      if (!sums.has(key)) sums.set(key, { sum: 0, count: 0 });
      const bucket = sums.get(key)!;
      bucket.sum += log.weight_lb ?? 0;
      bucket.count += 1;
    });
    const dayAvg = new Map<string, number>();
    sums.forEach((v, k) => {
      if (v.count > 0) {
        const avgLb = v.sum / v.count;
        dayAvg.set(k, unit === 'kg' ? roundTo1(lbToKg(avgLb)) : roundTo1(avgLb));
      }
    });

    // Find latest weight before the start of window for initial carry
    let initialCarry: number | null = null;
    const startKey = getLocalDateKey(start);
    let latestPriorTime = -Infinity;
    logs.forEach((log) => {
      const t = new Date(log.weighed_at).getTime();
      const key = getLocalDateKey(new Date(log.weighed_at));
      if (key < startKey && t > latestPriorTime && log.weight_lb !== null && log.weight_lb !== undefined) {
        latestPriorTime = t;
        const lb = log.weight_lb;
        initialCarry = unit === 'kg' ? roundTo1(lbToKg(lb)) : roundTo1(lb);
      }
    });

    const values: Array<number | null> = [];
    let lastKnown: number | null = initialCarry;
    let firstKnown: number | null = initialCarry;

    keys.forEach((k) => {
      const avg = dayAvg.get(k);
      if (typeof avg === 'number' && Number.isFinite(avg)) {
        values.push(avg);
        lastKnown = avg;
        if (firstKnown === null) firstKnown = avg;
      } else if (lastKnown !== null) {
        values.push(lastKnown);
      } else {
        values.push(null);
      }
    });

    const filledValues =
      firstKnown !== null
        ? values.map((v) => (v === null ? firstKnown! : v))
        : values;

    const numericValues = filledValues.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const hasSufficient = numericValues.length >= 2;

    return {
      chartLabels: labels,
      chartData: filledValues.map((v) => (typeof v === 'number' ? v : NaN)),
      hasSufficientPoints: hasSufficient,
      chartPadding: { DOT_R, PAD_X, PAD_Y_TOP, PAD_Y_BOTTOM },
    };
  }, [unit, weight180Query.data, selectedDate]);

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
              onDateSelect={setSelectedDate}
              today={todayLocal}
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
        isToday={isToday}
        module="weight"
      >
        <DesktopPageContainer>
          {/* Latest weight info line */}
          <View style={{ marginTop: Spacing.sm, marginBottom: Spacing.md }}>
            <ThemedText style={{ color: colors.textSecondary }}>
              Latest: {latestWeightDisplay} • {latestBodyFatDisplay}
              {latestTimestamp ? ` · ${formatLocalTime(latestTimestamp)}` : ''}
            </ThemedText>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, ...Shadows.md }]}>
            <View style={{ marginBottom: Spacing.sm, gap: Spacing.xs }}>
              <ThemedText style={{ color: colors.text, fontWeight: '600' }}>
                Weight – Last 7 Days
              </ThemedText>
              <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>
                Avg per day
              </ThemedText>
            </View>

            {hasSufficientPoints ? (
              <View
                style={styles.chartWrap}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  if (w && Number.isFinite(w)) {
                    setChartWidth(w);
                  }
                }}
              >
                {chartWidth > 0 && (
                  <>
                    <Svg
                      width={chartWidth}
                      height={200}
                      viewBox={`0 0 ${chartWidth} 200`}
                      preserveAspectRatio="none"
                    >
                      {(() => {
                        const h = 200;
                        const n = chartData.length;
                        const denom = Math.max(1, n - 1);
                        const { PAD_X, PAD_Y_TOP, PAD_Y_BOTTOM, DOT_R } = chartPadding;
                        const usableWidth = Math.max(0, chartWidth - PAD_X * 2);
                        const minY = Math.min(...chartData);
                        const maxY = Math.max(...chartData);
                        const span = Math.max(1e-6, maxY - minY);
                        const usableHeight = Math.max(0, h - PAD_Y_TOP - PAD_Y_BOTTOM);
                        const points = chartData.map((v, i) => {
                          const x = PAD_X + (i / denom) * usableWidth;
                          const y = PAD_Y_TOP + ((maxY - v) / span) * usableHeight;
                          return { x, y, v };
                        });
                        const pathD =
                          points.length > 0
                            ? points
                                .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                                .join(' ')
                            : '';
                        return (
                          <>
                            <Path
                              d={pathD}
                              fill="none"
                              stroke={colors.tint}
                              strokeWidth={2}
                            />
                            {points.map((p, idx) => (
                              <Circle
                                key={idx}
                                cx={p.x}
                                cy={p.y}
                                r={DOT_R}
                                stroke={colors.tint}
                                strokeWidth={2}
                                fill={colors.tint}
                              />
                            ))}
                          </>
                        );
                      })()}
                    </Svg>
                    <View style={[styles.chartLabels, { width: chartWidth }]}>
                      {chartLabels.map((lbl, idx) => (
                        <ThemedText
                          key={idx}
                          style={{ color: colors.textSecondary, fontSize: FontSize.sm }}
                        >
                          {lbl}
                        </ThemedText>
                      ))}
                    </View>
                  </>
                )}
              </View>
            ) : (
              <ThemedText style={{ color: colors.textSecondary }}>
                Add at least 2 weigh-ins to see a trend.
              </ThemedText>
            )}
          </View>

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
                          <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>
                            {day.bodyFatPercent !== null ? `${roundTo1(day.bodyFatPercent).toFixed(1)}% body fat` : '—'}
                          </ThemedText>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: Spacing.xs }}>
                          <ThemedText style={{ color: weightColor, fontSize: FontSize.lg, fontWeight: FontWeight.semibold }}>
                            {weightDisplay}
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

              <TouchableOpacity
                style={[
                  styles.addButton,
                  { backgroundColor: colors.tint, opacity: isFetching ? 0.9 : 1 },
                ]}
                onPress={() => router.push('/weight/entry')}
                disabled={isFetching || isLoading}
              >
                <IconSymbol name="plus" size={18} color={colors.textInverse} />
                <ThemedText style={[styles.addButtonText, { color: colors.textInverse }]}>
                  Add weight
                </ThemedText>
              </TouchableOpacity>
            </View>
        </DesktopPageContainer>
      </CollapsibleModuleHeader>

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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    fontSize: FontSize.md,
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


