import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, Layout, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DailyLatestWeightRow } from '@/lib/derive/daily-latest-weight';
import { buildWeightSeriesForDayKeys } from '@/lib/derive/weight-chart-series';
import { toDateKey } from '@/utils/dateKey';
import { buildDayKeysInclusive, pickSparseLabelIndices, subtractMonthsClamped, subtractYearsClamped } from '@/utils/dateRangeMath';
import { getTodayKey, getYesterdayKey } from '@/utils/dateTime';
import React, { memo, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { WeightTrendLineChart } from './WeightTrendLineChart';

type Unit = 'kg' | 'lbs';

type CardId = '7d' | '1m' | '3m' | '6m' | '1y';

type CardDef = {
  id: CardId;
  title: string;
  getRange: () => { start: Date; end: Date };
  labelSpec:
    | { kind: '7d' }
    | { kind: 'weekly' } // 1M
    | { kind: 'monthly'; stepMonths: number }; // 3M/6M/1Y
};

type Props = {
  dailyLatest: DailyLatestWeightRow[];
  selectedDate: Date;
  todayLocal: Date; // local midnight
  unit: Unit;
  /** Optional right-side slot in the 7-day card header (e.g., wearable Sync). */
  headerRightSlot?: React.ReactNode;
};

export const WeightChartCarousel = memo(function WeightChartCarousel({ dailyLatest, selectedDate, todayLocal, unit, headerRightSlot }: Props) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Calculate today and yesterday date strings
  const todayDateString = useMemo(() => getTodayKey(), []);
  const yesterdayDateString = useMemo(() => getYesterdayKey(), []);
  const selectedDateString = useMemo(() => toDateKey(selectedDate), [selectedDate]);

  const [pageWidth, setPageWidth] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<any>(null);
  const scrollOffsetRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const dailyMap = useMemo(() => {
    const m = new Map<string, DailyLatestWeightRow>();
    for (const d of dailyLatest) {
      m.set(d.date_key, d);
    }
    return m;
  }, [dailyLatest]);

  const cards: CardDef[] = useMemo(() => {
    return [
      {
        id: '7d',
        title: 'Weight – Last 7 Days',
        getRange: () => {
          const end = new Date(selectedDate);
          end.setHours(0, 0, 0, 0);
          const start = new Date(end);
          start.setDate(start.getDate() - 6);
          return { start, end };
        },
        labelSpec: { kind: '7d' },
      },
      {
        id: '1m',
        title: 'Weight – Last Month',
        getRange: () => {
          const end = new Date(todayLocal);
          end.setHours(0, 0, 0, 0);
          const start = subtractMonthsClamped(end, 1);
          start.setHours(0, 0, 0, 0);
          return { start, end };
        },
        labelSpec: { kind: 'weekly' },
      },
      {
        id: '3m',
        title: 'Weight – Last 3 Months',
        getRange: () => {
          const end = new Date(todayLocal);
          end.setHours(0, 0, 0, 0);
          const start = subtractMonthsClamped(end, 3);
          start.setHours(0, 0, 0, 0);
          return { start, end };
        },
        labelSpec: { kind: 'monthly', stepMonths: 1 },
      },
      {
        id: '6m',
        title: 'Weight – Last 6 Months',
        getRange: () => {
          const end = new Date(todayLocal);
          end.setHours(0, 0, 0, 0);
          const start = subtractMonthsClamped(end, 6);
          start.setHours(0, 0, 0, 0);
          return { start, end };
        },
        labelSpec: { kind: 'monthly', stepMonths: 2 },
      },
      {
        id: '1y',
        title: 'Weight – Last Year',
        getRange: () => {
          const end = new Date(todayLocal);
          end.setHours(0, 0, 0, 0);
          const start = subtractYearsClamped(end, 1);
          start.setHours(0, 0, 0, 0);
          return { start, end };
        },
        labelSpec: { kind: 'monthly', stepMonths: 2 },
      },
    ];
  }, [selectedDate, todayLocal]);

  const datasetsById = useMemo(() => {
    const out: Record<CardId, { start: Date; end: Date; dayKeys: string[]; values: number[]; labelIndices: number[]; getLabel: (idx: number) => string }> =
      {} as any;

    for (const card of cards) {
      const { start, end } = card.getRange();
      const dayKeys = buildDayKeysInclusive(start, end);

      const values = buildWeightSeriesForDayKeys({ dayKeys, dailyMap, unit });

      let labelIndices: number[] = [];
      if (card.labelSpec.kind === '7d') {
        labelIndices = dayKeys.map((_, idx) => idx);
      } else if (card.labelSpec.kind === 'weekly') {
        labelIndices = pickSparseLabelIndices(dayKeys, { type: 'weekly', stepDays: 7 }, 6);
      } else {
        labelIndices = pickSparseLabelIndices(dayKeys, { type: 'monthly', stepMonths: card.labelSpec.stepMonths }, 6);
      }

      const startIdx = 0;
      const endIdx = dayKeys.length - 1;

      const getLabel = (idx: number) => {
        const key = dayKeys[idx];
        if (!key) return '';

        const d = new Date(`${key}T00:00:00`);

        if (card.id === '7d') {
          // Use Today/Yesterday/weekday for 7-day card
          if (key === todayDateString) {
            return t('common.today');
          }
          if (key === yesterdayDateString) {
            return t('common.yesterday');
          }
          return d.toLocaleDateString('en-US', { weekday: 'short' });
        }

        const isStartOrEnd = idx === startIdx || idx === endIdx;
        if (card.id === '1m') {
          // Weekly ticks: show M/D, always include start/end.
          const mm = d.getMonth() + 1;
          const dd = d.getDate();
          return `${mm}/${dd}`;
        }

        // Month-based ticks: show month; for start/end include day for clarity.
        if (isStartOrEnd) {
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        return d.toLocaleDateString('en-US', { month: 'short' });
      };

      out[card.id] = { start, end, dayKeys, values, labelIndices, getLabel };
    }

    return out;
  }, [cards, dailyMap, unit, todayDateString, yesterdayDateString, t]);

  const formatRange = (start: Date, end: Date) => {
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${s} – ${e}`;
  };

  const canNavigate = pageWidth > 0 && cards.length > 1;
  const scrollTo = (index: number) => {
    if (!canNavigate) return;
    const next = Math.max(0, Math.min(cards.length - 1, index));
    setActiveIndex(next);
    listRef.current?.scrollToOffset?.({ offset: next * pageWidth, animated: true });
  };

  return (
    <View
      style={{ width: '100%' }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w && Number.isFinite(w)) setPageWidth(w);
      }}
      {...(Platform.OS === 'web'
        ? {
            onWheel: (e: any) => {
              if (!canNavigate) return;
              // Trackpads often send vertical wheel deltas; map them to horizontal paging.
              const dy = typeof e?.deltaY === 'number' ? e.deltaY : 0;
              const dx = typeof e?.deltaX === 'number' ? e.deltaX : 0;
              if (Math.abs(dx) > Math.abs(dy)) return;

              const nextOffset = Math.max(0, Math.min((cards.length - 1) * pageWidth, scrollOffsetRef.current + dy));
              scrollOffsetRef.current = nextOffset;
              listRef.current?.scrollToOffset?.({ offset: nextOffset, animated: false });

              // Snap to nearest page on wheel end-ish: approximate by updating active index.
              const idx = pageWidth > 0 ? Math.round(nextOffset / pageWidth) : 0;
              setActiveIndex(Math.max(0, Math.min(cards.length - 1, idx)));
            },
          }
        : null)}
    >
      <Animated.FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        data={cards}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={pageWidth || undefined}
        decelerationRate={Platform.OS === 'web' ? undefined : 'fast'}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
          listener: (ev: any) => {
            scrollOffsetRef.current = ev?.nativeEvent?.contentOffset?.x ?? 0;
          },
        })}
        onMomentumScrollEnd={(e) => {
          const x = e?.nativeEvent?.contentOffset?.x ?? 0;
          if (pageWidth > 0) {
            const idx = Math.round(x / pageWidth);
            setActiveIndex(Math.max(0, Math.min(cards.length - 1, idx)));
          }
        }}
        scrollEventThrottle={16}
        renderItem={({ item }) => {
          const ds = datasetsById[item.id];
          return (
            <View style={[styles.page, pageWidth > 0 && { width: pageWidth }]}>
              <View style={[styles.card, { backgroundColor: colors.card, ...Shadows.md }]}>
                <View style={styles.headerRow}>
                  <View style={{ gap: Spacing.xs, flex: 1, minWidth: 0 }}>
                    <ThemedText style={{ color: colors.text, fontWeight: '600' }}>{item.title}</ThemedText>
                    <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>
                      {formatRange(ds.start, ds.end)}
                    </ThemedText>
                  </View>
                  {item.id === '7d' && headerRightSlot ? (
                    <View style={styles.headerRight} pointerEvents="box-none">
                      {headerRightSlot}
                    </View>
                  ) : null}
                </View>

                <WeightTrendLineChart 
                  values={ds.values} 
                  labelIndices={ds.labelIndices} 
                  getLabel={ds.getLabel} 
                  height={200}
                  // Pass new props for 7-day card only
                  {...(item.id === '7d' ? {
                    dayKeys: ds.dayKeys,
                    todayDateString,
                    yesterdayDateString,
                    selectedDateString,
                    dailyMap,
                    unit,
                  } : {})}
                />
              </View>
            </View>
          );
        }}
      />

      {/* Desktop navigation affordances (web): explicit arrows + clickable dots */}
      {Platform.OS === 'web' && canNavigate && (
        <View pointerEvents="box-none" style={styles.desktopNav}>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: activeIndex <= 0 ? 0.35 : 1 }]}
            onPress={() => scrollTo(activeIndex - 1)}
            disabled={activeIndex <= 0}
            activeOpacity={0.8}
          >
            <IconSymbol name="chevron.left" size={18} color={colors.text} decorative />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: activeIndex >= cards.length - 1 ? 0.35 : 1 }]}
            onPress={() => scrollTo(activeIndex + 1)}
            disabled={activeIndex >= cards.length - 1}
            activeOpacity={0.8}
          >
            <IconSymbol name="chevron.right" size={18} color={colors.text} decorative />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.dotsRow}>
        {cards.map((c, i) => {
          const inputRange = [Math.max(0, i - 1) * pageWidth, i * pageWidth, (i + 1) * pageWidth];
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.35, 1, 0.35],
            extrapolate: 'clamp',
          });
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [1, 1.25, 1],
            extrapolate: 'clamp',
          });

          return (
            <TouchableOpacity
              key={c.id}
              onPress={() => scrollTo(i)}
              activeOpacity={0.8}
              style={styles.dotHit}
            >
              <Animated.View
                style={[
                  styles.dot,
                  { backgroundColor: colors.textSecondary, opacity, transform: [{ scale }] },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  page: {
    width: '100%',
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.lg,
    marginHorizontal: Platform.OS === 'web' ? 0 : 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 1, // aligns with title baseline (no visual redesign)
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Layout.screenPadding,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  dotHit: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  desktopNav: {
    position: 'absolute',
    left: Spacing.sm,
    right: Spacing.sm,
    top: 110,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


