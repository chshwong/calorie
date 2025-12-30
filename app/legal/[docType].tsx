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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLegalDocuments } from '@/hooks/use-legal-documents';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { type LegalDocType } from '@/legal/legal-documents';

const DOC_TYPE_MAP: Record<string, LegalDocType> = {
  terms: 'terms',
  privacy: 'privacy',
  health: 'health_disclaimer',
};

export default function LegalDocumentViewer() {
  const { t } = useTranslation();
  const router = useRouter();
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

  // Get title for header
  const title = useMemo(() => {
    if (!docType) return t('legal.title');
    switch (docType) {
      case 'terms':
        return t('onboarding.legal.terms_title');
      case 'privacy':
        return t('onboarding.legal.privacy_title');
      case 'health_disclaimer':
        return t('onboarding.legal.health_disclaimer_title');
      default:
        return t('legal.title');
    }
  }, [docType, t]);

  if (!docType) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              {...getButtonAccessibilityProps(t('common.back'), t('common.back'))}
              {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
            >
              <IconSymbol name="chevron.left" size={22} color={colors.text} />
            </TouchableOpacity>
            <ThemedText type="title" style={[styles.headerTitle, { color: colors.text }]}>
              {t('legal.title')}
            </ThemedText>
            <View style={styles.headerRight} />
          </View>
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.text }]}>
              {t('legal.error_loading')}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerBackTitleVisible: false,
          headerTitleAlign: 'center',
        }}
      />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.select({ web: 20, default: 10 }),
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent', // Handled by Stack header
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
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

