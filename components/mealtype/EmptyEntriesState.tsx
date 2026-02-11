import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Colors } from '@/constants/theme';
import { BorderRadius, Spacing } from '@/constants/theme';
import { getButtonAccessibilityProps } from '@/utils/accessibility';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

type EmptyEntriesStateProps = {
  onScanPress: () => void;
  onCopyFromYesterday: () => void;
  onQuickLog: () => void;
  onAiCamera: () => void;
  isCopying: boolean;
  isToday: boolean;
  mealTypeLabel: string;
  colors: typeof Colors.light | typeof Colors.dark;
  t: (key: string) => string;
  styles: any;
};

export function EmptyEntriesState({
  onScanPress,
  onCopyFromYesterday,
  onQuickLog,
  onAiCamera,
  isCopying,
  isToday,
  mealTypeLabel,
  colors,
  t,
  styles,
}: EmptyEntriesStateProps) {
  const cardStyle = {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.icon + '15',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center' as const,
  };
  const actionBtnSurfaceStyle = {
    backgroundColor: colors.background,
    borderColor: colors.icon + '25',
  };

  return (
    <View style={[styles.emptyState, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}>
      <View style={[cardStyle, styles.emptyStateCardShadow]}>
        <Text style={{ fontSize: 24, marginBottom: 8 }}>🥑</Text>
        <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary, fontWeight: '600', marginBottom: 4, textAlign: 'center' }]}>
          Log your first entry for this meal!
        </ThemedText>
        <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary, textAlign: 'center' }]}>
          Search for your food above.
        </ThemedText>

        <View style={styles.actionsGrid}>
          <View style={styles.gridBtn}>
            <TouchableOpacity
              style={[styles.actionBtn, actionBtnSurfaceStyle]}
              onPress={onScanPress}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              {...getButtonAccessibilityProps(
                'Scan barcode',
                'Double tap to scan a barcode'
              )}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconSymbol name="barcode.viewfinder" size={22} color={colors.text} accessibilityLabel={t('mealtype_log.accessibility.scan_barcode')} />
                <ThemedText style={[styles.actionBtnText, { color: colors.text, marginLeft: 6 }]} numberOfLines={1}>
                  {t('mealtype_log.scanner.title', 'Scan Barcode')}
                </ThemedText>
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.gridBtn}>
            <TouchableOpacity
              style={[styles.actionBtn, actionBtnSurfaceStyle]}
              onPress={onAiCamera}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              {...getButtonAccessibilityProps(
                t('mealtype_log.ai_camera.accessibility_label'),
                t('mealtype_log.ai_camera.accessibility_hint')
              )}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ThemedText style={[styles.actionBtnText, { color: colors.text }]} numberOfLines={1}>
                  {t('mealtype_log.ai_camera.title')}
                </ThemedText>
                <View style={{ backgroundColor: colors.tint + '30', borderColor: colors.tint + '60', borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginLeft: 4 }}>
                  <ThemedText style={{ fontSize: 9, fontWeight: '700', color: colors.tint, textTransform: 'uppercase' }}>{t('mealtype_log.ai_camera.new_badge')}</ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.gridBtn}>
            <TouchableOpacity
              style={[styles.actionBtn, actionBtnSurfaceStyle]}
              onPress={onCopyFromYesterday}
              activeOpacity={0.7}
              disabled={isCopying}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              {...getButtonAccessibilityProps(
                isToday
                  ? t('home.previous_day_copy.accessibility_label_yesterday', { mealType: mealTypeLabel })
                  : t('home.previous_day_copy.accessibility_label_previous', { mealType: mealTypeLabel }),
                'Double tap to copy entries from previous day'
              )}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isCopying ? (
                  <ActivityIndicator size="small" color={colors.tint} />
                ) : (
                  <IconSymbol name="doc.on.doc" size={20} color={colors.text} />
                )}
                <ThemedText style={[styles.actionBtnText, { color: colors.text, marginLeft: 6 }]} numberOfLines={1}>
                  {isToday ? t('home.previous_day_copy.label_yesterday') : t('home.previous_day_copy.label_previous')}
                </ThemedText>
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.gridBtn}>
            <TouchableOpacity
              style={[styles.actionBtn, actionBtnSurfaceStyle]}
              onPress={onQuickLog}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              {...getButtonAccessibilityProps(
                `⚡Quick Log for ${mealTypeLabel}`,
                `Add quick log for ${mealTypeLabel}`
              )}
            >
              <ThemedText style={[styles.actionBtnText, { color: colors.text }]}>⚡ Quick Log</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

