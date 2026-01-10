import React from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';
import type { Colors } from '@/constants/theme';

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
  return (
    <View style={[styles.emptyState, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}>
      <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary, fontWeight: '600', marginBottom: 4 }]}>
        Log your first entry for this meal!
      </ThemedText>
      <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary }]}>
        Search for your food above.
      </ThemedText>
      <TouchableOpacity
        style={[styles.barcodeButton, { 
          backgroundColor: colors.tint + '15', 
          borderColor: colors.tint + '40',
          marginTop: 16,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }]}
        onPress={onAiCamera}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        {...getButtonAccessibilityProps(
          t('mealtype_log.ai_camera.accessibility_label'),
          t('mealtype_log.ai_camera.accessibility_hint')
        )}
      >
        <IconSymbol 
          name="camera.fill" 
          size={24} 
          color={colors.tint}
        />
        <ThemedText style={[styles.emptyStateText, { color: colors.tint, flex: 1 }]}>
          {t('mealtype_log.ai_camera.title')}
        </ThemedText>
        <View
          style={{
            backgroundColor: colors.tint + '30',
            borderColor: colors.tint + '60',
            borderWidth: 1,
            borderRadius: 4,
            paddingHorizontal: 4,
            paddingVertical: 2,
          }}
        >
          <ThemedText style={{ fontSize: 9, fontWeight: '700', color: colors.tint, textTransform: 'uppercase' }}>
            {t('mealtype_log.ai_camera.new_badge')}
          </ThemedText>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.barcodeButton, { 
          backgroundColor: colors.tint + '15', 
          borderColor: colors.tint + '40',
          marginTop: 12,
          flexDirection: 'row',
          gap: 8,
        }]}
        onPress={onScanPress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        {...getButtonAccessibilityProps(
          'Scan barcode',
          'Double tap to scan a barcode'
        )}
      >
        <IconSymbol 
          name="barcode.viewfinder" 
          size={24} 
          color={colors.tint}
          accessibilityLabel={t('mealtype_log.accessibility.scan_barcode')}
        />
        <ThemedText style={[styles.emptyStateText, { color: colors.tint }]}>
          {t('mealtype_log.scanner.title', 'Scan Barcode')}
        </ThemedText>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.barcodeButton, { 
          backgroundColor: colors.tint + '15', 
          borderColor: colors.tint + '40',
          marginTop: 12,
          flexDirection: 'row',
          gap: 8,
        }]}
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
        {isCopying ? (
          <ActivityIndicator size="small" color={colors.tint} />
        ) : (
          <IconSymbol 
            name="doc.on.doc" 
            size={24} 
            color={colors.tint}
          />
        )}
        <ThemedText style={[styles.emptyStateText, { color: colors.tint }]}>
          {isToday 
            ? t('home.previous_day_copy.label_yesterday')
            : t('home.previous_day_copy.label_previous')}
        </ThemedText>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.barcodeButton, { 
          backgroundColor: colors.tint + '15', 
          borderColor: colors.tint + '40',
          marginTop: 12,
          flexDirection: 'row',
          gap: 8,
        }]}
        onPress={onQuickLog}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        {...getButtonAccessibilityProps(
          `⚡Quick Log for ${mealTypeLabel}`,
          `Add quick log for ${mealTypeLabel}`
        )}
      >
        <ThemedText style={[styles.emptyStateText, { color: colors.tint, fontSize: 20 }]}>
          ⚡
        </ThemedText>
        <ThemedText style={[styles.emptyStateText, { color: colors.tint }]}>
          Quick Log
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

