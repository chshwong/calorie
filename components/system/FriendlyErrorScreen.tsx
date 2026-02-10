/**
 * AvoVibe-branded "Something went wrong" screen.
 * Uses classifyError for themed messages. Best-effort only; unknown falls back to catch-all.
 */

import BrandLogoMascotOnly from '@/components/brand/BrandLogoMascotOnly';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { classifyError, type ErrorKind } from '@/lib/errors/classifyError';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

import { showAppToast } from '@/components/ui/app-toast';

export interface FriendlyErrorScreenProps {
  title?: string;
  message?: string;
  error?: unknown;
  componentStack?: string | null;
  httpStatus?: number;
  isOfflineHint?: boolean;
  onRetry?: () => void;
  onGoHome?: () => void;
  /** For auth kind: use Sign in CTA that navigates to login */
  onSignIn?: () => void;
}

function safeStringifyError(error: unknown): string {
  if (error instanceof Error) {
    const stack = error.stack ? `\n\n${error.stack}` : '';
    return `${error.name}: ${error.message}${stack}`;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

function getCtaLabel(kind: ErrorKind, t: (key: string) => string): string {
  switch (kind) {
    case 'auth':
      return t('friendly_error.sign_in');
    case 'timeout':
    case 'server':
      return t('friendly_error.try_again');
    default:
      return t('friendly_error.retry');
  }
}

export function FriendlyErrorScreen({
  title: titleOverride,
  message: messageOverride,
  error,
  componentStack,
  httpStatus,
  isOfflineHint,
  onRetry,
  onGoHome,
  onSignIn,
}: FriendlyErrorScreenProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const classified = useMemo(
    () => classifyError({ error, httpStatus, isOfflineHint }),
    [error, httpStatus, isOfflineHint]
  );

  const kind = classified.kind;
  const title = titleOverride ?? t(`friendly_error.${kind}.title`, classified.title);
  const message = messageOverride ?? t(`friendly_error.${kind}.message`, classified.message);

  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const detailsText = [
    error != null ? safeStringifyError(error) : '',
    componentStack ? `\n\nComponent stack:\n${componentStack}` : '',
  ]
    .filter(Boolean)
    .join('');

  const handlePrimaryCta = () => {
    if (kind === 'auth' && onSignIn) {
      onSignIn();
    } else if (onRetry) {
      onRetry();
    }
  };

  const handleCopyDetails = async () => {
    const ok = await copyToClipboard(detailsText);
    if (ok) {
      showAppToast(t('friendly_error.details_copied'));
    } else {
      showAppToast(t('common.unexpected_error'));
    }
  };

  const ctaLabel = getCtaLabel(kind, t);
  const showGoHome = (kind === 'unknown' || kind === 'offline') && onGoHome;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <BrandLogoMascotOnly width={64} height={64} />
          <ThemedText style={[styles.title, { color: colors.text }]}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </ThemedText>

          <View style={styles.actions}>
            <Button
              variant="primary"
              size="lg"
              onPress={handlePrimaryCta}
              style={styles.primaryButton}
            >
              {ctaLabel}
            </Button>
            {showGoHome && (
              <Button
                variant="secondary"
                size="lg"
                onPress={onGoHome}
                style={styles.secondaryButton}
              >
                {t('friendly_error.go_home')}
              </Button>
            )}
          </View>

          {detailsText ? (
            <View style={styles.detailsSection}>
              <Pressable
                onPress={() => setDetailsExpanded((v) => !v)}
                style={styles.detailsHeader}
                accessibilityRole="button"
                accessibilityLabel={t('friendly_error.show_details')}
              >
                <ThemedText style={[styles.detailsHeaderText, { color: colors.textSecondary }]}>
                  {detailsExpanded ? '▼' : '▶'} {t('friendly_error.show_details')}
                </ThemedText>
              </Pressable>
              {detailsExpanded && (
                <View style={[styles.detailsContent, { backgroundColor: colors.backgroundSecondary }]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator
                    nestedScrollEnabled
                    style={styles.detailsScroll}
                  >
                    <ThemedText
                      style={[styles.detailsText, { color: colors.textSecondary }]}
                      selectable
                    >
                      {detailsText}
                    </ThemedText>
                  </ScrollView>
                  {Platform.OS === 'web' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={handleCopyDetails}
                      style={styles.copyButton}
                    >
                      {t('friendly_error.copy_details')}
                    </Button>
                  )}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.5,
    marginBottom: Spacing.xl,
  },
  actions: {
    width: '100%',
    gap: Spacing.md,
  },
  primaryButton: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
  },
  detailsSection: {
    width: '100%',
    marginTop: Spacing.xl,
  },
  detailsHeader: {
    paddingVertical: Spacing.sm,
  },
  detailsHeaderText: {
    fontSize: FontSize.sm,
  },
  detailsContent: {
    padding: Spacing.md,
    borderRadius: 8,
    maxHeight: 160,
  },
  detailsScroll: {
    maxHeight: 120,
  },
  detailsText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: FontSize.xs,
  },
  copyButton: {
    marginTop: Spacing.sm,
  },
});
