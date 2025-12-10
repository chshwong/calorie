/**
 * Quick Log Screen - Dedicated screen for Quick Log entry/edit
 * 
 * This screen displays the Quick Log form in a centered card layout.
 * It can be launched from:
 * - Home page meal-type card 3-dot menu
 * - Mealtype-log 3-dot menu
 * - Quick Log tab in mealtype-log
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { QuickLogForm } from '@/components/QuickLogForm';
import { getLocalDateString } from '@/utils/calculations';
import { Spacing } from '@/constants/theme';

type QuickLogRouteParams = {
  date?: string;
  mealType?: string;
  quickLogId?: string;
};

export default function QuickLogScreen() {
  const params = useLocalSearchParams<QuickLogRouteParams>();
  const router = useRouter();

  // Fallbacks: if params are missing, use today and a default mealType
  const date = params.date ?? getLocalDateString();
  const mealType = params.mealType ?? 'breakfast';

  const handleClose = () => {
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cardContainer}>
          <QuickLogForm
            date={date}
            mealType={mealType}
            quickLogId={params.quickLogId}
            onCancel={handleClose}
            onSaved={handleClose}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  cardContainer: {
    // Card styling is handled by QuickLogForm component
  },
});

