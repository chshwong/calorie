/**
 * Quick Log Screen - Dedicated screen for Quick Log entry/edit
 * 
 * This screen displays the Quick Log form in a centered card layout.
 * It can be launched from:
 * - Home page meal-type card 3-dot menu
 * - Mealtype-log 3-dot menu
 * - Quick Log tab in mealtype-log
 */

import { QuickLogForm, type QuickLogFieldApi } from '@/components/QuickLogForm';
import { SegmentedTabs, type SegmentedTabItem } from '@/components/SegmentedTabs';
import { AIQuickLogTab } from '@/components/quick-log/AIQuickLogTab';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useClampedDateParam } from '@/hooks/use-clamped-date-param';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AIQuickLogParsed } from '@/lib/ai/aiQuickLogParser';
import { clampDateKey } from '@/lib/date-guard';
import { getWebAccessibilityProps } from '@/utils/accessibility';
import { getLocalDateString } from '@/utils/calculations';
import { toDateKey } from '@/utils/dateKey';
import type { CalorieEntry } from '@/utils/types';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type QuickLogRouteParams = {
  date?: string;
  mealType?: string;
  quickLogId?: string;
  entryPayload?: string;
  tab?: string;
};

// Hide default Expo Router header - we use custom header instead
export const options = {
  headerShown: false,
};

type QuickLogTabKey = 'quick-log' | 'ai';

export default function QuickLogScreen() {
  const params = useLocalSearchParams<QuickLogRouteParams>();
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<QuickLogTabKey>('quick-log');
  const [announcement, setAnnouncement] = useState<string>('');
  const [pendingAiFill, setPendingAiFill] = useState<{ parsed: AIQuickLogParsed; rawText: string } | null>(null);

  const fieldApiRef = useRef<QuickLogFieldApi | null>(null);

  const entryPayloadParam = Array.isArray(params.entryPayload) ? params.entryPayload[0] : params.entryPayload;

  const initialEntry = useMemo<CalorieEntry | null>(() => {
    if (!entryPayloadParam) return null;
    try {
      return JSON.parse(entryPayloadParam) as CalorieEntry;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Failed to parse entry payload for quick-log:', error);
      }
      return null;
    }
  }, [entryPayloadParam]);

  // Fallbacks: if params are missing, use today and a default mealType
  const dateParam = Array.isArray(params.date) ? params.date[0] : params.date;
  const mealTypeParam = Array.isArray(params.mealType) ? params.mealType[0] : params.mealType;
  const quickLogId = Array.isArray(params.quickLogId) ? params.quickLogId[0] : params.quickLogId;
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  const { dateKey: routeDateKey, minDateKey, todayKey } = useClampedDateParam({ paramKey: 'date' });
  const hasRouteDateParam = !!dateParam;
  const dateRaw = hasRouteDateParam ? routeDateKey : (initialEntry?.entry_date ?? getLocalDateString());
  const date = clampDateKey(toDateKey(dateRaw), minDateKey, todayKey);
  const mealType = mealTypeParam ?? initialEntry?.meal_type ?? 'breakfast';

  // Set active tab from route param if provided
  useEffect(() => {
    if (tabParam === 'ai') {
      setActiveTab('ai');
    }
  }, [tabParam]);

  // Seed the entries cache so the form can hydrate instantly from cache
  useEffect(() => {
    if (!user?.id || !initialEntry) return;
    const cacheKey: [string, string, string] = ['entries', user.id, initialEntry.entry_date];
    queryClient.setQueryData<CalorieEntry[]>(cacheKey, (existing) => {
      if (!existing || existing.length === 0) {
        return [initialEntry];
      }
      const hasEntry = existing.some((e) => e.id === initialEntry.id);
      if (hasEntry) {
        return existing.map((e) => (e.id === initialEntry.id ? initialEntry : e));
      }
      return [...existing, initialEntry];
    });
  }, [initialEntry, queryClient, user?.id]);

  // Apply pending AI fill once QuickLogForm has registered the field API
  useEffect(() => {
    if (!pendingAiFill || activeTab !== 'quick-log') return;

    // Wait for API to be registered (QuickLogForm registers on mount)
    // Use setTimeout to ensure QuickLogForm's useEffect has run after tab switch
    const timeoutId = setTimeout(() => {
      const api = fieldApiRef.current;
      if (!api) {
        // If API still not ready, the form hasn't mounted/registered yet
        // This should be rare, but we'll just skip and let it retry on next effect run
        if (process.env.NODE_ENV !== 'production') {
          console.warn('AI fill pending but QuickLogForm API not yet registered');
        }
        return;
      }

      const { parsed, rawText } = pendingAiFill;

      api.setFoodName(parsed.foodName);
      api.setCaloriesKcal(String(parsed.totalKcal));

      if (parsed.proteinG != null) api.setProteinG(String(parsed.proteinG));
      if (parsed.carbsG != null) api.setCarbsG(String(parsed.carbsG));
      if (parsed.fatG != null) api.setFatG(String(parsed.fatG));
      if (parsed.fibreG != null) api.setFibreG(String(parsed.fibreG));
      if (parsed.saturatedFatG != null) api.setSaturatedFatG(String(parsed.saturatedFatG));
      if (parsed.transFatG != null) api.setTransFatG(String(parsed.transFatG));
      if (parsed.totalSugarG != null) api.setTotalSugarG(String(parsed.totalSugarG));
      if (parsed.sodiumMg != null) api.setSodiumMg(String(parsed.sodiumMg));

      api.setAiProvenance({
        source: 'ai',
        aiRawText: rawText,
        aiConfidence: parsed.confidence ?? null,
      });

      setAnnouncement(t('quick_log.ai.parse_success_announcement'));
      setPendingAiFill(null);

      setTimeout(() => api.focusCalories?.(), 0);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [pendingAiFill, t, activeTab]);

  // Detect desktop for responsive layout
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  // Ref for triggering form submit from the header save/check button
  const submitRef = useRef<(() => void) | null>(null);

  // Map meal type keys to display labels (using i18n)
  const getMealTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'breakfast': t('mealtype_log.meal_types.breakfast'),
      'lunch': t('mealtype_log.meal_types.lunch'),
      'dinner': t('mealtype_log.meal_types.dinner'),
      'afternoon_snack': t('mealtype_log.meal_types.snack'),
    };
    return labels[type.toLowerCase()] || type;
  };

  // Format date for display (using i18n)
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      
      // Check if it's today
      if (dateOnly.getTime() === today.getTime()) {
        return t('mealtype_log.calendar.today');
      }
      
      // Check if it's yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (dateOnly.getTime() === yesterday.getTime()) {
        return t('mealtype_log.calendar.yesterday');
      }
      
      // Format as "Mon DD" or "MMM DD" depending on locale
      const monthNames = [
        t('mealtype_log.calendar.months.jan'), t('mealtype_log.calendar.months.feb'),
        t('mealtype_log.calendar.months.mar'), t('mealtype_log.calendar.months.apr'),
        t('mealtype_log.calendar.months.may'), t('mealtype_log.calendar.months.jun'),
        t('mealtype_log.calendar.months.jul'), t('mealtype_log.calendar.months.aug'),
        t('mealtype_log.calendar.months.sep'), t('mealtype_log.calendar.months.oct'),
        t('mealtype_log.calendar.months.nov'), t('mealtype_log.calendar.months.dec'),
      ];
      const month = monthNames[date.getMonth()];
      const day = date.getDate();
      return `${month} ${day}`;
    } catch {
      return dateString;
    }
  };

  const mealTypeLabel = getMealTypeLabel(mealType);
  const dateLabel = formatDate(date);

  const handleClose = () => {
    router.back();
  };

  const tabs: SegmentedTabItem[] = useMemo(
    () => [
      { key: 'quick-log', label: t('quick_log.tabs.quick_log') },
      { key: 'ai', label: t('quick_log.tabs.ai_photo') },
    ],
    [t]
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ThemedText style={[styles.backButtonText, { color: colors.tint }]}>←</ThemedText>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <ThemedText style={[styles.title, { color: colors.text }]}>
            {t('quick_log.header_title')}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            {mealTypeLabel} · {dateLabel}
          </ThemedText>
        </View>
        <TouchableOpacity
          style={[
            styles.checkmarkButton,
            {
              opacity: 1,
            }
          ]}
          onPress={() => submitRef.current?.()}
          activeOpacity={0.7}
        >
          <IconSymbol 
            name="checkmark" 
            size={24} 
            color={colors.tint}
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.centeredContainer}>
          {/* Screen-level live region announcements (web + native) */}
          <Text
            accessibilityLiveRegion="polite"
            style={styles.srOnly}
            {...getWebAccessibilityProps('status')}
          >
            {announcement}
          </Text>

          <View style={[styles.segmentedContainer, { maxWidth: isDesktop ? 480 : '100%' }]}>
            <SegmentedTabs
              items={tabs}
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as QuickLogTabKey)}
            />
          </View>

          <View style={[styles.cardContainer, { maxWidth: isDesktop ? 480 : '100%' }]}>
            {activeTab === 'quick-log' ? (
              <QuickLogForm
                date={date}
                mealType={mealType}
                quickLogId={quickLogId}
                initialEntry={initialEntry ?? undefined}
                onCancel={handleClose}
                onSaved={handleClose}
                registerSubmit={(fn) => { submitRef.current = fn; }}
                // registerFieldApi will be implemented in QuickLogForm; safe no-op if not provided
                registerFieldApi={(api: QuickLogFieldApi) => {
                  fieldApiRef.current = api;
                }}
              />
            ) : (
              <AIQuickLogTab
                onApplyParsed={(input: { parsed: AIQuickLogParsed; rawText: string }) => {
                  setPendingAiFill(input);
                  setActiveTab('quick-log');
                }}
                onClearAi={() => {
                  fieldApiRef.current?.setAiProvenance({ source: 'manual', aiRawText: null, aiConfidence: null });
                  setAnnouncement(t('quick_log.ai.cleared_announcement'));
                }}
                onParseErrorAnnouncement={(msg) => setAnnouncement(msg)}
              />
            )}
          </View>
        </View>
      </ScrollView>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,              // tighter gap below header
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: Spacing.md,
    minHeight: 64,
  },
  backButton: {
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 2,
    opacity: 0.7,
  },
  checkmarkButton: {
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',         // keep card centered horizontally
    paddingHorizontal: Spacing.md,
    paddingTop: 4,                // small gap between header and card
    paddingBottom: Spacing.lg,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  cardContainer: {
    width: '100%',
    // Card styling is handled by QuickLogForm component
  },
  segmentedContainer: {
    width: '100%',
    paddingHorizontal: 2,
    marginBottom: Spacing.sm,
  },
  srOnly: Platform.select({
    web: {
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0,0,0,0)',
      whiteSpace: 'nowrap',
      borderWidth: 0,
    },
    default: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
    },
  }),
});


