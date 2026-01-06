import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps } from '@/utils/accessibility';
import { WeightPortionPage } from '@/components/portion-guide/WeightPortionPage';
import { VolumePortionPage } from '@/components/portion-guide/VolumePortionPage';
import type { SegmentedTabItem } from '@/components/SegmentedTabs';
import { Modal } from 'react-native';
import { useTranslation } from 'react-i18next';

export type PortionGuideTabKey = 'weight' | 'volume';

type PortionGuideSheetProps = {
  visible: boolean;
  onClose: () => void;
  defaultTab: PortionGuideTabKey;
};

export function PortionGuideSheet({ visible, onClose, defaultTab }: PortionGuideSheetProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';

  const [activeTab, setActiveTab] = useState<PortionGuideTabKey>(defaultTab);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  const sheetHeight = useMemo(() => {
    const h = Dimensions.get('window').height;
    return Math.round(h * 0.7);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setActiveTab(defaultTab);
  }, [visible, defaultTab]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const tabs: SegmentedTabItem[] = useMemo(
    () => [
      {
        key: 'weight',
        label: t('mealtype_log.portion_guide.tabs.weight'),
        accessibilityLabel: t('mealtype_log.portion_guide.tabs.weight_accessibility'),
      },
      {
        key: 'volume',
        label: t('mealtype_log.portion_guide.tabs.volume'),
        accessibilityLabel: t('mealtype_log.portion_guide.tabs.volume_accessibility'),
      },
    ],
    [t]
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: slideAnim }],
              height: sheetHeight,
            },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBar}>
            <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
          </View>

          <ScrollView
            stickyHeaderIndices={[0]}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
            nestedScrollEnabled={true}
          >
            {/* Sticky header */}
            <View
              style={[
                styles.header,
                {
                  backgroundColor: colors.background,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              {/* First row: Title and Close button */}
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <ThemedText
                    style={[styles.headerIcon, { color: colors.text }]}
                    accessibilityLabel={t('mealtype_log.portion_guide.title')}
                  >
                    ⚖️
                  </ThemedText>
                  <ThemedText style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                    {t('mealtype_log.portion_guide.title')}
                  </ThemedText>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.closeButton,
                    { backgroundColor: isDark ? colors.backgroundSecondary : colors.card },
                  ]}
                  {...getButtonAccessibilityProps(t('mealtype_log.portion_guide.close_button'))}
                >
                  <IconSymbol name="xmark" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Second row: Segmented tabs */}
              <View style={styles.tabsRow}>
                <View style={styles.segmentedContainer}>
                  <SegmentedTabs
                    items={tabs}
                    activeKey={activeTab}
                    onChange={(key) => setActiveTab(key as PortionGuideTabKey)}
                    style={styles.segmentedWrap}
                  />
                </View>
              </View>
            </View>

            {/* Pages */}
            {activeTab === 'weight' ? <WeightPortionPage /> : <VolumePortionPage />}
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.50)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    overflow: 'hidden',
    flex: 1,
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    flex: 1,
  },
  headerIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  segmentedContainer: {
    transform: [{ scale: 0.85 }],
  },
  segmentedWrap: {
    flexShrink: 0,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


