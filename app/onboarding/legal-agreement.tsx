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
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BlockingBrandedLoader } from '@/components/system/BlockingBrandedLoader';
import { OnboardingPrimaryButton } from '@/components/onboarding/OnboardingPrimaryButton';
import { showAppToast } from '@/components/ui/app-toast';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { userConfigQueryKey } from '@/hooks/use-user-config';
import { setPersistentCache } from '@/lib/persistentCache';
import { onboardingFlagStore } from '@/lib/onboardingFlagStore';
import {
  getActiveLegalDocuments,
  getLatestAcceptancesMap,
  getUserLegalAcceptances,
  insertUserLegalAcceptances,
  type UserLegalAcceptance,
} from '@/lib/services/legal';
import { updateProfile } from '@/lib/services/profileService';
import { type LegalDocument, type LegalDocType } from '@/legal/legal-documents';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';

type CheckboxState = Record<LegalDocType, boolean>;

const DEFAULT_EXPANDED: Record<LegalDocType, boolean> = {
  terms: false,
  privacy: false,
  health_disclaimer: true,
};

export default function LegalAgreementScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, refreshProfile, profile } = useAuth();
  const queryClient = useQueryClient();

  const [legalDocs, setLegalDocs] = useState<LegalDocument[]>([]);
  const [acceptances, setAcceptances] = useState<Record<LegalDocType, UserLegalAcceptance>>(
    {} as Record<LegalDocType, UserLegalAcceptance>
  );
  const [expanded, setExpanded] = useState<Record<LegalDocType, boolean>>(DEFAULT_EXPANDED);
  const [checkboxes, setCheckboxes] = useState<CheckboxState>({
    terms: false,
    privacy: false,
    health_disclaimer: false,
  });
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoUpToDate, setAutoUpToDate] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        router.replace('/login');
        return;
      }

      setInitializing(true);
      setLoadError(null);

      try {
        const [docs, userAcceptances] = await Promise.all([
          getActiveLegalDocuments(),
          getUserLegalAcceptances(user.id),
        ]);

        const latestAcceptanceMap = getLatestAcceptancesMap(userAcceptances);
        setLegalDocs(docs);
        setAcceptances(latestAcceptanceMap);

        const allAccepted = docs.every(
          (doc) => latestAcceptanceMap[doc.docType]?.version === doc.version
        );

        setAutoUpToDate(allAccepted);
        setCheckboxes({
          terms: allAccepted,
          privacy: allAccepted,
          health_disclaimer: allAccepted,
        });
      } catch (err) {
        console.error('[legal] Failed to load legal data:', err);
        setLoadError(t('legal.error_loading'));
      } finally {
        setInitializing(false);
      }
    };

    load();
  }, [router, t, user]);

  const sortedDocs = useMemo(() => {
    const docOrder: LegalDocType[] = ['terms', 'privacy', 'health_disclaimer'];
    return [...legalDocs].sort(
      (a, b) => docOrder.indexOf(a.docType) - docOrder.indexOf(b.docType)
    );
  }, [legalDocs]);

  const toggleExpanded = (docType: LegalDocType) => {
    setExpanded((prev) => ({
      ...prev,
      [docType]: !prev[docType],
    }));
  };

  const handleCheckboxToggle = (docType: LegalDocType) => {
    if (autoUpToDate || loading) return;
    setCheckboxes((prev) => ({ ...prev, [docType]: !prev[docType] }));
  };

  const allChecked =
    autoUpToDate ||
    (checkboxes.terms && checkboxes.privacy && checkboxes.health_disclaimer);

  const handleAccept = async () => {
    if (!user) {
      router.replace('/login');
      return;
    }

    if (!allChecked) {
      setLoadError(t('legal.error_checkboxes'));
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      // Insert a new acceptance row for each active doc (audit trail)
      await insertUserLegalAcceptances(user.id, sortedDocs);

      // Mark onboarding complete after logging acceptance
      const updatedProfile = await updateProfile(user.id, {
        onboarding_complete: true,
      });

      if (!updatedProfile) {
        throw new Error('Failed to update profile');
      }

      // After DB update succeeds, update caches/stores (best-effort, no awaits required)
      const queryKey = userConfigQueryKey(user.id);
      const cacheKey = `userConfig:${user.id}`;
      
      // Update React Query cache (best-effort)
      try {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) {
            return { onboarding_complete: true };
          }
          return { ...old, onboarding_complete: true };
        });
      } catch (e) {
        // Ignore cache update errors
      }

      // Update persistent cache (best-effort)
      try {
        const updatedCache = queryClient.getQueryData(queryKey);
        if (updatedCache) {
          setPersistentCache(cacheKey, { ...updatedCache, onboarding_complete: true });
        } else {
          setPersistentCache(cacheKey, { onboarding_complete: true });
        }
      } catch (e) {
        // Ignore persistent cache errors
      }

      // Write to onboardingFlagStore (best-effort)
      try {
        if (Platform.OS === 'web') {
          // Web can use sync write if available
          onboardingFlagStore.write(user.id, true).catch(() => {
            // Ignore write errors
          });
        } else {
          onboardingFlagStore.write(user.id, true).catch(() => {
            // Ignore write errors
          });
        }
      } catch (e) {
        // Ignore flag store errors
      }

      // Navigate after DB save succeeded
      // Engineering guideline #14: avoid window.location.* navigation.
      // StartupGate already re-evaluates from persisted sources without requiring a full page reload.
      router.replace('/(tabs)');
    } catch (err: any) {
      const errorMessage = err?.message || t('legal.error_loading');
      showAppToast('Failed to save. Please try again.');
      setLoadError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderCheckbox = (docType: LegalDocType, label: string) => (
    <TouchableOpacity
      key={docType}
      style={styles.checkboxRow}
      onPress={() => handleCheckboxToggle(docType)}
      disabled={loading || autoUpToDate}
      {...getButtonAccessibilityProps(label, label, loading || autoUpToDate)}
      {...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {})}
    >
      <View
        style={[
          styles.checkboxBox,
          {
            borderColor: colors.border,
            backgroundColor: checkboxes[docType] ? colors.tint : 'transparent',
          },
        ]}
      >
        {checkboxes[docType] && <IconSymbol name="checkmark" size={14} color="#fff" />}
      </View>
      <Text style={[styles.checkboxLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderDocumentCard = (doc: LegalDocument) => {
    const isExpanded = expanded[doc.docType];
    const acceptance = acceptances[doc.docType];

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
          disabled={loading}
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
            {acceptance ? (
              <View style={[styles.badge, { backgroundColor: colors.tint + '20' }]}>
                <Text style={[styles.badgeText, { color: colors.tint }]}>
                  {t('legal.acceptance_badge', {
                    date: new Date(acceptance.acceptedAt).toLocaleDateString(),
                  })}
                </Text>
              </View>
            ) : null}
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
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={[styles.headerTitle, { color: colors.tint }]}>
            {t('legal.title')}
          </ThemedText>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('legal.subtitle')}
          </Text>
        </View>

        {initializing ? (
          <BlockingBrandedLoader enabled={true} timeoutMs={5000} />
        ) : (
          <>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                { backgroundColor: colors.background },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {loadError ? (
                <View style={[styles.errorBox, { borderColor: colors.border }]}>
                  <Text style={[styles.errorText, { color: colors.text }]}>{loadError}</Text>
                </View>
              ) : null}

              {autoUpToDate ? (
                <View style={[styles.infoBox, { borderColor: colors.border }]}>
                  <IconSymbol name='checkmark.circle.fill' size={18} color={colors.tint} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    {t('legal.already_up_to_date')}
                  </Text>
                </View>
              ) : null}

              {sortedDocs.map(renderDocumentCard)}

              <View style={styles.checkboxContainer}>
                {renderCheckbox('terms', t('legal.checkbox_terms'))}
                {renderCheckbox('privacy', t('legal.checkbox_privacy'))}
                {renderCheckbox('health_disclaimer', t('legal.checkbox_health'))}
              </View>
            </ScrollView>

            <View
              style={[
                styles.footer,
                { borderTopColor: colors.border, backgroundColor: colors.background },
              ]}
            >
              <OnboardingPrimaryButton
                label={autoUpToDate ? t('legal.continue') : t('legal.cta')}
                onPress={handleAccept}
                disabled={!allChecked || loading}
                loading={loading}
                fullWidth
              />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.4,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
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
  checkboxContainer: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.4,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    backgroundColor: '#FFFFFFEE',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.sm,
  },
  infoBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoText: {
    fontSize: FontSize.sm,
    flex: 1,
  },
});
