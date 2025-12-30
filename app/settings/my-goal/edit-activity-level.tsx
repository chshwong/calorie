import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';

import { StandardSubheader } from '@/components/navigation/StandardSubheader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AccessibilityHints, getButtonAccessibilityProps, getMinTouchTargetStyle } from '@/utils/accessibility';

import EditGoalScreen from './edit-goal';

export default function EditActivityLevelRoute() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ start?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Ensure we start on the existing Activity step (keeps icon/question/list/bottom buttons unchanged).
  useEffect(() => {
    if (params?.start === 'activity') return;
    router.setParams({ start: 'activity' });
  }, [params?.start, router]);

  const handleClose = () => {
    // Prefer real back whenever possible (dismiss/history); fall back only when there's truly no history.
    // @ts-ignore - canGoBack may exist depending on expo-router version
    if (router.canGoBack?.()) return router.back();
    // @ts-ignore - navigation types can vary
    if ((navigation as any)?.canGoBack?.()) return router.back();
    router.replace('/settings/my-goal');
  };

  return (
    <View style={styles.container}>
      <StandardSubheader
        title="Edit Activity Level"
        onBack={handleClose}
        right={
          <TouchableOpacity
            style={[styles.closeButton, getMinTouchTargetStyle()]}
            onPress={handleClose}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps('Close', AccessibilityHints.CLOSE)}
          >
            <IconSymbol name="xmark" size={20} color={colors.tint} decorative={true} />
          </TouchableOpacity>
        }
      />

      <View style={styles.body}>
        <EditGoalScreen hideHeader={true} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
});


