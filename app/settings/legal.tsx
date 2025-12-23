import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import {
  getActiveLegalDocuments,
  getLatestAcceptancesMap,
  getUserLegalAcceptances,
  type UserLegalAcceptance,
} from '@/lib/services/legal';
import { type LegalDocType, type LegalDocument } from '@/legal/legal-documents';
import { useAuth } from '@/contexts/AuthContext';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

const DEFAULT_EXPANDED: Record<LegalDocType, boolean> = {
  terms: false,
  privacy: false,
  health_disclaimer: true,
};

export default function LegalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();

  const [legalDocs, setLegalDocs] = useState<LegalDocument[]>([]);
  const [acceptances, setAcceptances] = useState<Record<LegalDocType, UserLegalAcceptance>>(
    {} as Record<LegalDocType, UserLegalAcceptance>
  );
  const [expanded, setExpanded] = useState<Record<LegalDocType, boolean>>(DEFAULT_EXPANDED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortedDocs = useMemo(() => {
    const docOrder: LegalDocType[] = ['terms', 'privacy', 'health_disclaimer'];
    return [...legalDocs].sort(
      (a, b) => docOrder.indexOf(a.docType) - docOrder.indexOf(b.docType)
    );
  }, [legalDocs]);

  const load = async () => {
    if (!user) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [docs, userAcceptances] = await Promise.all([
        getActiveLegalDocuments(),
        getUserLegalAcceptances(user.id),
      ]);

      setLegalDocs(docs);
      setAcceptances(getLatestAcceptancesMap(userAcceptances));
    } catch (err) {
      console.error('[legal-settings] Failed to load legal docs', err);
      setError(t('legal.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const toggleExpanded = (docType: LegalDocType) => {
    setExpanded((prev) => ({
      ...prev,
      [docType]: !prev[docType],
    }));
  };

  const renderDocumentCard = (doc: LegalDocument) => {
    const isExpanded = expanded[doc.docType];
    const acceptance = acceptances[doc.docType];
    const isCurrent = acceptance?.version === doc.version;

    return (
      <View
        key={doc.docType}
        style={[
          styles.card,
          { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
        ]}
      >
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggleExpanded(doc.docType)}
          {...getButtonAccessibilityProps(
            doc.title,
            isExpanded ? t('legal.collapse_section') : t('legal.expand_section')
          )}
          {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
        >
          <View style={styles.cardHeaderLeft}>
            <ThemedText type="subtitle">{doc.title}</ThemedText>
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {t('legal.updated_version', { version: doc.version })}
            </Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <View style={[styles.badge, { backgroundColor: colors.tint + '20' }]}>
              <Text style={[styles.badgeText, { color: colors.tint }]}>
                {acceptance
                  ? isCurrent
                    ? t('legal.acceptance_badge', {
                        date: new Date(acceptance.acceptedAt).toLocaleDateString(),
                      })
                    : `${t('legal.acceptance_badge', {
                        date: new Date(acceptance.acceptedAt).toLocaleDateString(),
                      })} · v${acceptance.version}`
                  : t('legal.view_only')}
              </Text>
            </View>
            <IconSymbol
              name={isExpanded ? 'chevron.up' : 'chevron.down'}
              size={18}
              color={colors.text}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardBody}>
            <Text style={[styles.cardContent, { color: colors.text }]}>{doc.contentMd}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          {...getButtonAccessibilityProps(t('common.back'), t('common.back'))}
          {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <ThemedText type="title" style={[styles.headerTitle, { color: colors.text }]}>
            {t('legal.settings_title')}
          </ThemedText>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('legal.subtitle_settings')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={load}
          disabled={loading}
          {...getButtonAccessibilityProps(t('legal.refresh'), t('legal.refresh'), loading)}
          {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
        >
          {loading ? (
            <ActivityIndicator color={colors.textSecondary} size="small" />
          ) : (
            <IconSymbol name="arrow.down.doc.fill" size={18} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: colors.border }]}>
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('legal.loading_docs')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
          showsVerticalScrollIndicator={false}
        >
          {sortedDocs.map(renderDocumentCard)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.4,
  },
  refreshButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardBody: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    borderTopColor: '#00000012',
  },
  cardContent: {
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.5,
  },
  metaText: {
    fontSize: FontSize.sm,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginHorizontal: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.md,
  },
});

