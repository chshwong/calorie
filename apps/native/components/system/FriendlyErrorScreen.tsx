/**
 * AvoVibe-branded "Something went wrong" screen for native WebView wrapper.
 */

import { useColorScheme } from '@/components/useColorScheme';
import { classifyError, type ErrorKind } from '@/lib/errors/classifyError';
import { colors, radius, spacing } from '@/theme/tokens';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

export interface FriendlyErrorScreenProps {
  title?: string;
  message?: string;
  error?: unknown;
  httpStatus?: number;
  isOfflineHint?: boolean;
  onRetry?: () => void;
  onGoHome?: () => void;
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
  httpStatus,
  isOfflineHint,
  onRetry,
  onGoHome,
}: FriendlyErrorScreenProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? 'light';
  const theme = colors[scheme];

  const classified = useMemo(
    () => classifyError({ error, httpStatus, isOfflineHint }),
    [error, httpStatus, isOfflineHint]
  );

  const kind = classified.kind;
  const title = titleOverride ?? t(`friendly_error.${kind}.title`, classified.title);
  const message = messageOverride ?? t(`friendly_error.${kind}.message`, classified.message);

  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const detailsText = error != null ? safeStringifyError(error) : '';

  const ctaLabel = getCtaLabel(kind, t);
  const showGoHome = (kind === 'unknown' || kind === 'offline') && onGoHome;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Image
            source={require('@/assets/images/brand/Logo_MascotOnly.png')}
            style={styles.mascot}
            resizeMode="contain"
            accessibilityLabel="AvoVibe mascot"
          />
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>

          <View style={styles.actions}>
            <Button
              variant="primary"
              title={ctaLabel}
              onPress={onRetry}
              style={styles.primaryButton}
            />
            {showGoHome && (
              <Button
                variant="secondary"
                title={t('friendly_error.go_home')}
                onPress={onGoHome}
                style={styles.secondaryButton}
              />
            )}
          </View>

          {detailsText ? (
            <View style={styles.detailsSection}>
              <Pressable
                onPress={() => setDetailsExpanded((v) => !v)}
                style={styles.detailsHeader}
              >
                <Text style={[styles.detailsHeaderText, { color: theme.textMuted }]}>
                  {detailsExpanded ? '▼' : '▶'} {t('friendly_error.show_details')}
                </Text>
              </Pressable>
              {detailsExpanded && (
                <View style={[styles.detailsContent, { backgroundColor: theme.surface }]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator
                    nestedScrollEnabled
                    style={styles.detailsScroll}
                  >
                    <Text
                      style={[styles.detailsText, { color: theme.textMuted }]}
                      selectable
                    >
                      {detailsText}
                    </Text>
                  </ScrollView>
                </View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
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
    padding: spacing.lg,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  mascot: {
    width: 64,
    height: 64,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
  primaryButton: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
  },
  detailsSection: {
    width: '100%',
    marginTop: spacing.lg,
  },
  detailsHeader: {
    paddingVertical: spacing.sm,
  },
  detailsHeaderText: {
    fontSize: 14,
  },
  detailsContent: {
    padding: spacing.md,
    borderRadius: radius.md,
    maxHeight: 160,
  },
  detailsScroll: {
    maxHeight: 120,
  },
  detailsText: {
    fontSize: 12,
  },
});
