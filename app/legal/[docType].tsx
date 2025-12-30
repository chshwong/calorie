/**
 * Legal Document Viewer Route
 * 
 * Displays a single legal document (terms, privacy, or health_disclaimer)
 * Reuses the same document fetching logic as onboarding
 * 
 * Routes:
 * - /legal/terms
 * - /legal/privacy
 * - /legal/health
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { StandardSubheader } from '@/components/navigation/StandardSubheader';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLegalDocuments } from '@/hooks/use-legal-documents';
import { type LegalDocType } from '@/legal/legal-documents';

const DOC_TYPE_MAP: Record<string, LegalDocType> = {
  terms: 'terms',
  privacy: 'privacy',
  health: 'health_disclaimer',
};

export default function LegalDocumentViewer() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ docType: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data: documents = [], isLoading, error } = useLegalDocuments();

  // Map route param to doc_type
  const docType = useMemo(() => {
    const param = params.docType?.toLowerCase();
    return DOC_TYPE_MAP[param] || null;
  }, [params.docType]);

  // Get the active document for this type
  const document = useMemo(() => {
    if (!docType) return null;
    return documents.find((d) => d.doc_type === docType) ?? null;
  }, [documents, docType]);

  // Title for StandardSubheader (explicit per Settings → Legal requirements)
  const headerTitle = useMemo(() => {
    switch (docType) {
      case 'terms':
        return 'Terms of Service';
      case 'privacy':
        return 'Privacy Policy';
      case 'health_disclaimer':
        return 'Health Disclaimer';
      default:
        return t('legal.title');
    }
  }, [docType, t]);

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
          <StandardSubheader title={headerTitle} />
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.tint} size="large" />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('legal.loading_docs')}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: colors.text }]}>
                {t('legal.error_loading')}
              </Text>
            </View>
          ) : !document ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: colors.text }]}>
                {t('legal.error_loading')}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              contentInsetAdjustmentBehavior="never"
              showsVerticalScrollIndicator={true}
            >
              {document.version && (
                <View style={[styles.versionBadge, { backgroundColor: colors.tint + '20' }]}>
                  <Text style={[styles.versionText, { color: colors.tint }]}>
                    {t('legal.updated_version', { version: document.version })}
                  </Text>
                </View>
              )}
              <ThemedText style={[styles.documentTitle, { color: colors.text }]}>
                {document.title}
              </ThemedText>
              <ThemedText style={[styles.documentContent, { color: colors.text }]}>
                {document.content_md}
              </ThemedText>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  versionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  versionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  documentTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  documentContent: {
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.6,
  },
});

