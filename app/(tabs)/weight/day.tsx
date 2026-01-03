import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { StandardSubheader } from '@/components/navigation/StandardSubheader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, Layout, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserConfig } from '@/hooks/use-user-config';
import { useClampedDateParam } from '@/hooks/use-clamped-date-param';
import { clampDateKey, dateKeyToLocalStartOfDay } from '@/lib/date-guard';
import { useWeightLogsRange } from '@/hooks/use-weight-logs';
import { lbToKg, roundTo1 } from '@/utils/bodyMetrics';
import { formatLocalTime } from '@/utils/dateTime';
import { toDateKey } from '@/utils/dateKey';

export default function WeightDayScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data: userConfig } = useUserConfig();
  const unit: 'kg' | 'lbs' = userConfig?.weight_unit === 'kg' ? 'kg' : 'lbs';

  const params = useLocalSearchParams<{ fromDate?: string }>();
  const rawFromDate = (Array.isArray(params?.fromDate) ? params.fromDate[0] : params?.fromDate) as string | undefined;

  const { dateKey, today, minDateKey, todayKey } = useClampedDateParam({ paramKey: 'date' });

  const fromDateKey = useMemo(() => {
    if (!rawFromDate) return null;
    const requested = toDateKey(rawFromDate);
    return clampDateKey(requested, minDateKey, todayKey);
  }, [minDateKey, rawFromDate, todayKey]);

  const dayStart = useMemo(() => dateKeyToLocalStartOfDay(dateKey), [dateKey]);
  const dayEnd = useMemo(() => {
    const d = new Date(dayStart);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [dayStart]);

  const rangeQuery = useWeightLogsRange(dayStart, dayEnd);

  const entries = useMemo(() => {
    const rows = rangeQuery.data ?? [];
    return [...rows].sort((a, b) => new Date(b.weighed_at).getTime() - new Date(a.weighed_at).getTime());
  }, [rangeQuery.data]);

  const formattedDate = useMemo(() => {
    const d = new Date(dayStart);
    const isToday = d.getTime() === today.getTime();
    const baseLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return isToday ? `${t('common.today')} · ${baseLabel}` : baseLabel;
  }, [dayStart, t, today]);

  const renderWeight = useCallback(
    (weightLb: number) => {
      const value = unit === 'kg' ? roundTo1(lbToKg(weightLb)) : roundTo1(weightLb);
      const displayUnit = unit === 'kg' ? 'kg' : 'lbs';
      return `${value.toFixed(1)} ${displayUnit}`;
    },
    [unit]
  );

  const handleHeaderBack = useCallback(() => {
    // Always route back to Weight (never Home/Index). On web, browser history can be unreliable
    // (e.g., deep links, refreshes), so we intentionally avoid router.back() here.
    //
    // If the user navigated here from the Weight list while viewing a different selected date,
    // we preserve that as `fromDate` so "Back" returns to the originating Weight screen date.
    if (fromDateKey) {
      router.replace({ pathname: '/weight', params: { date: fromDateKey } } as any);
      return;
    }
    router.replace('/weight' as any);
  }, [fromDateKey, router]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <StandardSubheader title={t('weight.day.title')} onBack={handleHeaderBack} />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Layout.screenPadding * 2 }]} showsVerticalScrollIndicator={false}>
        <DesktopPageContainer>
          <View style={{ height: Spacing.lg }} />

          <View style={{ gap: Spacing.xs, marginBottom: Spacing.md, paddingLeft: Spacing.lg }}>
            <ThemedText style={{ color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.semibold }}>
              {formattedDate}
            </ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              {t('weight.day.entries', {
                count: entries.length,
                entries: entries.length === 1 ? t('weight.day.entry_one') : t('weight.day.entry_other'),
              })}
            </ThemedText>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, ...Shadows.md }]}>
            {rangeQuery.isLoading ? (
              <View style={{ paddingVertical: Spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.tint} />
              </View>
            ) : entries.length === 0 ? (
              <ThemedText style={{ color: colors.textSecondary }}>{t('weight.day.no_entries')}</ThemedText>
            ) : (
              <View style={{ gap: Spacing.md }}>
                {entries.map((e) => {
                  const ts = new Date(e.weighed_at);
                  const timeLabel = formatLocalTime(ts);
                  const bodyFat =
                    e.body_fat_percent !== null && e.body_fat_percent !== undefined
                      ? `${roundTo1(e.body_fat_percent).toFixed(1)}%`
                      : null;
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={[styles.row, { borderBottomColor: colors.border }]}
                      activeOpacity={0.8}
                      onPress={() => {
                        router.push({
                          pathname: '/weight/entry',
                          params: {
                            date: dateKey,
                            entryId: e.id,
                            weighedAt: e.weighed_at,
                            weightLb: e.weight_lb?.toString?.() ?? String(e.weight_lb ?? ''),
                            bodyFatPercent: bodyFat ? String(e.body_fat_percent) : '',
                            returnTo: 'day',
                            returnDate: dateKey,
                            ...(fromDateKey ? { fromDate: fromDateKey } : {}),
                          },
                        });
                      }}
                    >
                      <View style={{ gap: Spacing.xs }}>
                        <ThemedText style={{ color: colors.text, fontWeight: '600' }}>{timeLabel}</ThemedText>
                        <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>
                          {bodyFat ?? '—'}
                        </ThemedText>
                      </View>
                      <ThemedText style={{ color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.semibold }}>
                        {renderWeight(e.weight_lb)}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.tint, opacity: rangeQuery.isFetching ? 0.9 : 1 }]}
              onPress={() => {
                router.push({
                  pathname: '/weight/entry',
                  params: {
                    mode: 'add_for_date',
                    date: dateKey,
                    returnTo: 'day',
                    returnDate: dateKey,
                    ...(fromDateKey ? { fromDate: fromDateKey } : {}),
                  },
                });
              }}
              disabled={rangeQuery.isFetching || rangeQuery.isLoading}
              activeOpacity={0.85}
            >
              <IconSymbol name="plus" size={18} color={colors.textInverse} />
              <ThemedText style={[styles.addButtonText, { color: colors.textInverse }]}>
                {t('weight.day.add_weigh_in')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </DesktopPageContainer>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    width: '100%',
    paddingTop: Spacing.none,
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.screenPadding,
    ...(Platform.OS !== 'web' && {
      paddingBottom: 100,
    }),
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 0,
    }),
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.lg,
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
});


