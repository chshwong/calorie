import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenshotPicker } from '@/components/support/ScreenshotPicker';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSubmitSupportCase } from '@/hooks/use-submit-support-case';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { AccessibilityHints, getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import type { SupportCaseCategory } from '@/utils/types';
import { validateSupportCaseSubmission } from '@/utils/validation';
import {
  isSupportSubmitError,
  type SupportSubmitErrorKind,
} from '@/lib/services/supportSubmitErrors';

type CategoryOption = { value: SupportCaseCategory; labelKey: string };

function getAppVersionLabel(): string | null {
  const version =
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    (Constants as any).manifest?.version ??
    process.env.EXPO_PUBLIC_APP_VERSION ??
    null;
  const build =
    Application.nativeBuildVersion ??
    (Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode != null
        ? String(Constants.expoConfig?.android?.versionCode)
        : null);
  if (!version) return null;
  return build ? `${version} (${build})` : String(version);
}

export default function SupportNewCaseScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const submit = useSubmitSupportCase();

  const categories: CategoryOption[] = useMemo(
    () => [
      { value: 'bug', labelKey: 'support.categories.bug' },
      { value: 'feature_request', labelKey: 'support.categories.feature_request' },
      { value: 'improvement', labelKey: 'support.categories.improvement' },
      { value: 'food_addition', labelKey: 'support.categories.food_addition' },
      { value: 'appreciation', labelKey: 'support.categories.appreciation' },
      { value: 'other', labelKey: 'support.categories.other' },
    ],
    []
  );

  const [category, setCategory] = useState<SupportCaseCategory>('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [successCaseId, setSuccessCaseId] = useState<string | null>(null);
  const [submitErrorKind, setSubmitErrorKind] = useState<SupportSubmitErrorKind | null>(null);
  const [submitErrorOverrideKey, setSubmitErrorOverrideKey] = useState<string | null>(null);

  const appVersion = getAppVersionLabel();
  const userAgent = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : null;
  const pagePath = pathname ?? null;

  const isBusy = submit.isPending;

  const SETTINGS_ROUTE = '/settings';

  const handleBack = useCallback(() => {
    // Prefer router's canGoBack() when available
    try {
      if (typeof router.canGoBack === 'function' && router.canGoBack()) {
        router.back();
        return;
      }
    } catch {
      // Fall through to web history check / fallback route
    }

    // Web-only: if browser history exists, go back (covers direct loads where canGoBack is false)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
    }

    // Deterministic fallback after hard refresh/direct entry
    router.replace(SETTINGS_ROUTE);
  }, [router]);

  const handleSubmit = async () => {
    setSubmitErrorKind(null);
    setSubmitErrorOverrideKey(null);

    const trimmedMessage = message.trim();
    const v = validateSupportCaseSubmission({ message: trimmedMessage });
    if (!v.valid) {
      setSubmitErrorKind('unknown');
      setSubmitErrorOverrideKey(v.errorKey ?? 'support.errors.unknown_body');
      return;
    }

    try {
      const result = await submit.mutateAsync({
        category,
        subject: subject.trim() ? subject.trim() : null,
        message: trimmedMessage,
        pagePath,
        userAgent,
        appVersion,
        screenshotFile,
      });
      setSuccessCaseId(result.caseId);
    } catch (e: any) {
      if (isSupportSubmitError(e)) {
        setSubmitErrorKind(e.kind);
        if (e.kind === 'rate_limit' && process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('Rate limit hit');
        }
        return;
      }

      // Support screenshot/compression errors propagate as i18n keys.
      const msg = typeof e?.message === 'string' ? e.message : '';
      if (msg.startsWith('support.')) {
        setSubmitErrorKind('unknown');
        setSubmitErrorOverrideKey(msg);
        return;
      }

      setSubmitErrorKind('unknown');
    }
  };

  if (successCaseId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <ThemedText style={[styles.successTitle, { color: colors.text }]} accessibilityRole="header">
            {t('support.success.title')}
          </ThemedText>
          <ThemedText style={[styles.successBody, { color: colors.textSecondary }]}>{t('support.success.body')}</ThemedText>

          <View style={styles.actionRow}>
            <Button variant="primary" size="md" onPress={() => router.replace('/support/cases')} fullWidth>
              {t('support.success.primary')}
            </Button>
            <Button variant="secondary" size="md" onPress={() => router.replace('/')} fullWidth>
              {t('support.success.secondary')}
            </Button>
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[
            styles.backButton,
            getMinTouchTargetStyle(),
            Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
          ]}
          onPress={handleBack}
          disabled={isBusy}
          {...getButtonAccessibilityProps(t('common.back'), AccessibilityHints.BACK, isBusy)}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {t('support.title')}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>{t('support.subtitle')}</ThemedText>

        <View style={styles.fieldGroup}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>{t('support.form.category_label')}</ThemedText>
          <View style={styles.categoryGrid}>
            {categories.map((c) => {
              const selected = c.value === category;
              return (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: selected ? colors.tintLight : colors.backgroundSecondary,
                      borderColor: selected ? colors.tint : colors.border,
                    },
                    Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                  ]}
                  onPress={() => setCategory(c.value)}
                  disabled={isBusy}
                  {...getButtonAccessibilityProps(t(c.labelKey), AccessibilityHints.BUTTON, isBusy)}
                >
                  <ThemedText style={[styles.categoryText, { color: selected ? colors.tint : colors.textSecondary }]}>
                    {t(c.labelKey)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>{t('support.form.subject_label')}</ThemedText>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder={t('support.form.subject_placeholder')}
            placeholderTextColor={colors.textTertiary}
            editable={!isBusy}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>{t('support.form.message_label')}</ThemedText>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t('support.form.message_placeholder')}
            placeholderTextColor={colors.textTertiary}
            editable={!isBusy}
            multiline
            style={[
              styles.textArea,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
          />
        </View>

        <ScreenshotPicker value={screenshotFile} onChange={setScreenshotFile} disabled={isBusy} />

        {(submitErrorKind || submitErrorOverrideKey) && (
          <View style={[styles.errorBanner, { borderColor: colors.error, backgroundColor: colors.errorLight }]}>
            <ThemedText style={[styles.errorTitle, { color: colors.error }]}>
              {t(`support.errors.${submitErrorKind ?? 'unknown'}_title`)}
            </ThemedText>
            <ThemedText style={[styles.errorBody, { color: colors.textSecondary }]}>
              {submitErrorOverrideKey ? t(submitErrorOverrideKey) : t(`support.errors.${submitErrorKind ?? 'unknown'}_body`)}
            </ThemedText>
          </View>
        )}

        <View style={styles.actionRow}>
          <Button variant="primary" size="md" onPress={handleSubmit} loading={isBusy} fullWidth>
            {t('support.form.submit')}
          </Button>
        </View>

        {isBusy && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.tint} />
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: Layout.desktopMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryPill: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  categoryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  actionRow: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  loadingRow: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  errorTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  errorBody: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  successBody: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    textAlign: 'center',
  },
});

