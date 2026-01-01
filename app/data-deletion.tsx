/**
 * Public User Data Deletion Instructions
 *
 * Route:
 * - /data-deletion
 *
 * This page is intentionally public (no auth required) so it can be used as a
 * "Data deletion instructions URL" for platform compliance.
 */

import React, { useCallback } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { ThemedText } from '@/components/themed-text';
import { StandardSubheader } from '@/components/navigation/StandardSubheader';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from '@/constants/links';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AccessibilityHints,
  getButtonAccessibilityProps,
  getFocusStyle,
  getLinkAccessibilityProps,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';

export default function DataDeletionInstructionsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const openSupportEmail = useCallback(async () => {
    try {
      await Linking.openURL(SUPPORT_EMAIL_MAILTO);
    } catch {
      // No-op: if mail client can't open, user can still copy the email from the page.
    }
  }, []);

  const openPrivacyPolicy = useCallback(() => {
    router.push({ pathname: '/legal/[docType]', params: { docType: 'privacy' } });
  }, [router]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView
        edges={['left', 'right', 'bottom']}
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <View style={styles.container}>
          <StandardSubheader title="User Data Deletion" />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            contentInsetAdjustmentBehavior="never"
            showsVerticalScrollIndicator={true}
          >
            <ThemedText style={[styles.title, { color: colors.text }]}>
              How to delete your account
            </ThemedText>

            <ThemedText style={[styles.paragraph, { color: colors.textSecondary }]}>
              You can permanently delete your account and associated data directly in the app.
            </ThemedText>

            <Section title="In-app deletion steps" colors={colors}>
              <Bullet colors={colors} text="Open the app and sign in to your account." />
              <Bullet colors={colors} text="Tap your avatar (top area) to open the Settings screen." />
              <Bullet colors={colors} text="Scroll to the “Danger Zone” section." />
              <Bullet colors={colors} text="Tap “Delete Account”." />
              <Bullet colors={colors} text="Confirm the deletion prompts to complete the process." />
            </Section>

            <Section title="What happens when you delete" colors={colors}>
              <ThemedText style={[styles.paragraph, { color: colors.textSecondary }]}>
                Account deletion is intended to be permanent. Once completed, you will be signed out and your
                account will no longer be accessible.
              </ThemedText>
            </Section>

            <Section title="Need help?" colors={colors}>
              <ThemedText style={[styles.paragraph, { color: colors.textSecondary }]}>
                If you can’t access the app to delete your account (for example, you lost access), contact us and
                we can help.
              </ThemedText>

              <TouchableOpacity
                style={[
                  styles.linkRow,
                  getMinTouchTargetStyle(),
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                  },
                ]}
                onPress={openSupportEmail}
                activeOpacity={0.7}
                {...getLinkAccessibilityProps(
                  `Email support at ${SUPPORT_EMAIL}`,
                  AccessibilityHints.LINK
                )}
              >
                <ThemedText type="link" style={styles.linkText}>
                  {SUPPORT_EMAIL}
                </ThemedText>
                <ThemedText style={[styles.linkHint, { color: colors.textSecondary }]}>
                  Tap to email
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  getMinTouchTargetStyle(),
                  {
                    borderColor: colors.border,
                    ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}),
                  },
                ]}
                onPress={openPrivacyPolicy}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps('Open Privacy Policy', AccessibilityHints.NAVIGATE)}
              >
                <ThemedText type="link">Open Privacy Policy</ThemedText>
              </TouchableOpacity>
            </Section>

            <View style={{ height: Spacing['2xl'] }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
}

type ThemeColors = (typeof Colors)[keyof typeof Colors];

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{title}</ThemedText>
      <View style={{ gap: Spacing.sm }}>{children}</View>
    </View>
  );
}

function Bullet({ text, colors }: { text: string; colors: ThemeColors }) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: colors.tint }]} />
      <ThemedText style={[styles.bulletText, { color: colors.textSecondary }]}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  paragraph: {
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.6,
  },
  section: {
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.6,
  },
  linkRow: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  linkText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  linkHint: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  secondaryButton: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
});


