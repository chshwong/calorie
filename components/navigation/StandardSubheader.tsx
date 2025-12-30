import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, FontSize, FontWeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AccessibilityHints,
  getButtonAccessibilityProps,
  getFocusStyle,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';

type StandardSubheaderProps = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  showBack?: boolean;
  testID?: string;
};

export function StandardSubheader({
  title,
  onBack,
  right,
  showBack = true,
  testID,
}: StandardSubheaderProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    // Default behavior:
    // - Prefer router.back() when there is a history stack
    // - Fall back to /(tabs) for direct-entry / deeplink edge cases
    // @ts-ignore - canGoBack exists on navigation but types can vary
    const canGoBack = typeof (navigation as any)?.canGoBack === 'function'
      ? (navigation as any).canGoBack()
      : false;

    if (canGoBack) {
      router.back();
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { paddingTop: insets.top } as ViewStyle,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.side}>
          {showBack ? (
            <TouchableOpacity
              style={[
                styles.backButton,
                getMinTouchTargetStyle(),
                { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
              ]}
              onPress={handleBack}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps('Back', AccessibilityHints.BACK)}
            >
              <Ionicons name="arrow-back" size={24} color={colors.tint} />
            </TouchableOpacity>
          ) : (
            <View style={styles.sidePlaceholder} />
          )}
        </View>

        <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </ThemedText>

        <View style={styles.side}>
          {right ?? <View style={styles.sidePlaceholder} />}
        </View>
      </View>
    </View>
  );
}

const SIDE_WIDTH = 48;
const ROW_HEIGHT = 48;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.none,
    height: ROW_HEIGHT,
  },
  side: {
    width: SIDE_WIDTH,
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidePlaceholder: {
    width: SIDE_WIDTH,
    height: ROW_HEIGHT,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    lineHeight: 24,
  },
});


