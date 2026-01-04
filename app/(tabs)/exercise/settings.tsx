import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SurfaceCard } from '@/components/common/surface-card';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserConfig } from '@/hooks/use-user-config';
import { useUpdateProfile } from '@/hooks/use-profile-mutations';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { showAppToast } from '@/components/ui/app-toast';

export default function ExerciseSettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data: userConfig } = useUserConfig();
  const updateProfileMutation = useUpdateProfile();
  
  const currentDistanceUnit = userConfig?.distance_unit ?? 'km';
  const [selectedUnit, setSelectedUnit] = useState<'km' | 'mi'>(currentDistanceUnit as 'km' | 'mi');

  const handleSave = () => {
    if (selectedUnit === currentDistanceUnit) {
      router.back();
      return;
    }

    updateProfileMutation.mutate(
      { distance_unit: selectedUnit },
      {
        onSuccess: () => {
          showAppToast('Distance unit updated');
          router.back();
        },
        onError: (error: Error) => {
          showAppToast('Failed to update distance unit');
        },
      }
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SurfaceCard module="exercise">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.backgroundSecondary }]}
            {...getButtonAccessibilityProps('Back')}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
            Exercise Settings
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Distance Unit Setting */}
          <View style={styles.settingSection}>
            <ThemedText style={[styles.settingLabel, { color: colors.text }]}>
              Distance Unit
            </ThemedText>
            <ThemedText style={[styles.settingDescription, { color: colors.textSecondary }]}>
              Choose how distance is displayed for cardio exercises
            </ThemedText>
            
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: selectedUnit === 'km' ? colors.tintLight : colors.backgroundSecondary,
                    borderColor: selectedUnit === 'km' ? colors.tint : colors.border,
                  },
                ]}
                onPress={() => setSelectedUnit('km')}
                activeOpacity={0.7}
                {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
                {...getButtonAccessibilityProps('Kilometers')}
              >
                <ThemedText
                  style={[
                    styles.optionText,
                    {
                      color: selectedUnit === 'km' ? colors.tint : colors.text,
                      fontWeight: selectedUnit === 'km' ? '700' : '600',
                    },
                  ]}
                >
                  Kilometers (km)
                </ThemedText>
                {selectedUnit === 'km' && (
                  <IconSymbol name="checkmark" size={20} color={colors.tint} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: selectedUnit === 'mi' ? colors.tintLight : colors.backgroundSecondary,
                    borderColor: selectedUnit === 'mi' ? colors.tint : colors.border,
                  },
                ]}
                onPress={() => setSelectedUnit('mi')}
                activeOpacity={0.7}
                {...(Platform.OS === 'web' && getFocusStyle(colors.tint))}
                {...getButtonAccessibilityProps('Miles')}
              >
                <ThemedText
                  style={[
                    styles.optionText,
                    {
                      color: selectedUnit === 'mi' ? colors.tint : colors.text,
                      fontWeight: selectedUnit === 'mi' ? '700' : '600',
                    },
                  ]}
                >
                  Miles (mi)
                </ThemedText>
                {selectedUnit === 'mi' && (
                  <IconSymbol name="checkmark" size={20} color={colors.tint} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.tint }]}
            onPress={handleSave}
            disabled={updateProfileMutation.isPending}
            activeOpacity={0.7}
            {...(Platform.OS === 'web' && getFocusStyle('#fff'))}
            {...getButtonAccessibilityProps('Save')}
          >
            <ThemedText style={[styles.saveButtonText, { color: colors.textInverse }]}>
              {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </SurfaceCard>
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
    paddingBottom: Spacing.md,
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.separator,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  settingSection: {
    marginBottom: Spacing.xl,
  },
  settingLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  settingDescription: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...getMinTouchTargetStyle(),
  },
  optionText: {
    fontSize: FontSize.base,
  },
  footer: {
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.light.separator,
    marginTop: Spacing.md,
  },
  saveButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
  saveButtonText: {
    fontSize: FontSize.base,
    fontWeight: '700',
  },
});

