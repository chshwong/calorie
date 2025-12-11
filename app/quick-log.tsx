/**
 * Quick Log Screen - Dedicated screen for Quick Log entry/edit
 * 
 * This screen displays the Quick Log form in a centered card layout.
 * It can be launched from:
 * - Home page meal-type card 3-dot menu
 * - Mealtype-log 3-dot menu
 * - Quick Log tab in mealtype-log
 */

import React, { useRef } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { QuickLogForm } from '@/components/QuickLogForm';
import { getLocalDateString } from '@/utils/calculations';
import { Spacing, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type QuickLogRouteParams = {
  date?: string;
  mealType?: string;
  quickLogId?: string;
};

// Hide default Expo Router header - we use custom header instead
export const options = {
  headerShown: false,
};

export default function QuickLogScreen() {
  const params = useLocalSearchParams<QuickLogRouteParams>();
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Fallbacks: if params are missing, use today and a default mealType
  const date = params.date ?? getLocalDateString();
  const mealType = params.mealType ?? 'breakfast';

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
      'late_night': t('mealtype_log.meal_types.late_night'),
    };
    return labels[type.toLowerCase()] || t('mealtype_log.meal_types.late_night');
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
          <View style={[styles.cardContainer, { maxWidth: isDesktop ? 480 : '100%' }]}>
            <QuickLogForm
              date={date}
              mealType={mealType}
              quickLogId={params.quickLogId}
              onCancel={handleClose}
              onSaved={handleClose}
              registerSubmit={(fn) => { submitRef.current = fn; }}
            />
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
});


