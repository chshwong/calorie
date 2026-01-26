import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

type Props = {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  isSaving?: boolean;
  disableSave?: boolean;
};

/**
 * Weight module settings modal shell.
 *
 * UI-only: callers own business logic and draft state.
 */
export function WeightSettingsModal({
  visible,
  title,
  children,
  onClose,
  onSave,
  isSaving = false,
  disableSave = false,
}: Props) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

  const [bodyHeight, setBodyHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const shouldScroll = useMemo(() => {
    if (!bodyHeight) return false;
    if (!contentHeight) return false;
    return contentHeight > bodyHeight;
  }, [bodyHeight, contentHeight]);

  const handleBodyLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== bodyHeight) setBodyHeight(h);
  };

  const handleContentLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== contentHeight) setContentHeight(h);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        {/* Backdrop layer (must NOT wrap buttons on web) */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          disabled={isSaving}
          accessibilityRole="button"
          {...getButtonAccessibilityProps(t('common.close'), t('common.close_hint'))}
        />

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.separator }]}>
            <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
            <TouchableOpacity
              style={[styles.iconBtn, getMinTouchTargetStyle(), Platform.OS === 'web' && getFocusStyle(colors.tint)]}
              onPress={onClose}
              disabled={isSaving}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(t('common.close'))}
            >
              <IconSymbol name="xmark" size={18} color={colors.text} decorative />
            </TouchableOpacity>
          </View>

          <ThemedView style={styles.body} onLayout={handleBodyLayout}>
            {shouldScroll ? (
              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={styles.bodyScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View onLayout={handleContentLayout}>{children}</View>
              </ScrollView>
            ) : (
              <View onLayout={handleContentLayout} style={styles.bodyScrollContent}>
                {children}
              </View>
            )}
          </ThemedView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: isSaving ? 0.6 : 1 },
                getMinTouchTargetStyle(),
                Platform.OS === 'web' && getFocusStyle(colors.tint),
              ]}
              onPress={onClose}
              disabled={isSaving}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(t('common.cancel'))}
            >
              <ThemedText style={[styles.cancelText, { color: colors.text }]}>{t('common.cancel')}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: colors.tint, opacity: isSaving || disableSave ? 0.6 : 1 },
                getMinTouchTargetStyle(),
                Platform.OS === 'web' && getFocusStyle('#fff'),
              ]}
              onPress={onSave}
              disabled={isSaving || disableSave}
              activeOpacity={0.85}
              {...getButtonAccessibilityProps(t('common.save'), t('common.save_hint'))}
            >
              <ThemedText style={[styles.saveText, { color: colors.textInverse }]}>{t('common.save')}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  iconBtn: {
    padding: Spacing.xs,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyScrollContent: {
    gap: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});

