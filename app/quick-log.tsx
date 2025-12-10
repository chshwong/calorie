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
import { View, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';
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

  // Detect desktop for responsive layout
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  const handleClose = () => {
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
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
  scrollContent: {
    flexGrow: 1,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  cardContainer: {
    width: '100%',
    // Card styling is handled by QuickLogForm component
  },
});

