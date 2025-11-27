import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatBarcodeForDisplay } from '@/lib/barcode';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

/**
 * Scanned Item page - displays a successfully scanned barcode.
 * 
 * Route params:
 * - barcode: The normalized 13-digit barcode (EAN-13 format)
 * - mealType: The meal type context (breakfast, lunch, dinner, snack)
 * - entryDate: The date for the entry
 */
export default function ScannedItemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    barcode: string;
    mealType: string;
    entryDate: string;
  }>();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { barcode, mealType, entryDate } = params;

  const handleGoBack = () => {
    router.back();
  };

  const handleScanAnother = () => {
    // Go back to meal type log which will allow scanning again
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            getMinTouchTargetStyle(),
            { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
          ]}
          onPress={handleGoBack}
          activeOpacity={0.6}
          {...getButtonAccessibilityProps(
            t('common.go_back', 'Go back'),
            t('common.go_back_hint', 'Double tap to go back to the previous screen')
          )}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>
          {t('scanned_item.title', 'Scanned Item')}
        </ThemedText>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.tint + '20' }]}>
          <IconSymbol name="checkmark.circle.fill" size={64} color={colors.tint} />
        </View>

        {/* Success Message */}
        <ThemedText style={styles.successText}>
          {t('scanned_item.barcode_detected', 'Barcode Detected!')}
        </ThemedText>

        {/* Barcode Display */}
        <View style={[styles.barcodeContainer, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}>
          <ThemedText style={[styles.barcodeLabel, { color: colors.icon }]}>
            {t('scanned_item.ean13_code', 'EAN-13 Code')}
          </ThemedText>
          <ThemedText style={[styles.barcodeValue, { color: colors.text }]}>
            {barcode ? formatBarcodeForDisplay(barcode) : '—'}
          </ThemedText>
          <ThemedText style={[styles.barcodeRaw, { color: colors.icon }]}>
            {barcode || '—'}
          </ThemedText>
        </View>

        {/* Info text */}
        <ThemedText style={[styles.infoText, { color: colors.icon }]}>
          {t('scanned_item.next_step_info', 'This barcode will be used to search for product information.')}
        </ThemedText>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.tint }]}
            onPress={() => {
              // TODO: Next step - search for product info with this barcode
              // For now, just show the barcode
            }}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(
              t('scanned_item.continue', 'Continue'),
              t('scanned_item.continue_hint', 'Search for product information')
            )}
          >
            <ThemedText style={styles.primaryButtonText}>
              {t('scanned_item.continue', 'Continue')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.tint }]}
            onPress={handleScanAnother}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(
              t('scanned_item.scan_another', 'Scan Another'),
              t('scanned_item.scan_another_hint', 'Go back to scan a different barcode')
            )}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: colors.tint }]}>
              {t('scanned_item.scan_another', 'Scan Another')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Context Info */}
        {mealType && (
          <ThemedText style={[styles.contextText, { color: colors.icon }]}>
            {t('scanned_item.adding_to', 'Adding to')}: {mealType} • {entryDate}
          </ThemedText>
        )}
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  barcodeContainer: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  barcodeLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  barcodeValue: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
    marginBottom: 8,
  },
  barcodeRaw: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  contextText: {
    fontSize: 12,
    marginTop: 24,
    textAlign: 'center',
  },
});

