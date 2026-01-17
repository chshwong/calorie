import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Platform, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, LineHeight, Shadows, SemanticColors } from '@/constants/theme';
import { onboardingColors } from '@/theme/onboardingTheme';
import { getButtonAccessibilityProps } from '@/utils/accessibility';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type LegalDocumentRow } from '@/lib/legal/legal-db';
import { useLegalDocuments } from '@/hooks/use-legal-documents';
import { useColorScheme } from '@/hooks/use-color-scheme';


interface LegalAgreementStepProps {
  legalAgreeTerms: boolean;
  legalAgreePrivacy: boolean;
  legalAcknowledgeRisk: boolean;
  onLegalAgreeTermsChange: (value: boolean) => void;
  onLegalAgreePrivacyChange: (value: boolean) => void;
  onLegalAcknowledgeRiskChange: (value: boolean) => void;
  loading: boolean;
  colors: typeof Colors.light;
}


export const LegalAgreementStep: React.FC<LegalAgreementStepProps> = ({
  legalAgreeTerms,
  legalAgreePrivacy,
  legalAcknowledgeRisk,
  onLegalAgreeTermsChange,
  onLegalAgreePrivacyChange,
  onLegalAcknowledgeRiskChange,
  loading,
  colors,
}) => {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { data: documents = [], isLoading: loadingDocs, error: queryError, refetch } = useLegalDocuments();
  const [openDocKey, setOpenDocKey] = useState<string | null>(null);

  const openDoc = documents.find(d => `${d.doc_type}:${d.version}` === openDocKey) ?? null;
  // Error handling: extract error message safely
  // Using 'any' here because React Query error types can vary (Error, string, object, etc.)
  // and we need to safely extract a message for display
  const loadError = queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null;

  const getDocTitle = (docType: string): string => {
    switch (docType) {
      case 'terms':
        return t('onboarding.legal.terms_title');
      case 'privacy':
        return t('onboarding.legal.privacy_title');
      case 'health_disclaimer':
        return t('onboarding.legal.health_disclaimer_title');
      default:
        return docType;
    }
  };

  const getCheckboxLabel = (docType: string): string => {
    switch (docType) {
      case 'terms':
        return t('onboarding.legal.agree_terms');
      case 'privacy':
        return t('onboarding.legal.agree_privacy');
      case 'health_disclaimer':
        return t('onboarding.legal.acknowledge_risk');
      default:
        return '';
    }
  };

  const getCheckboxValue = (docType: string): boolean => {
    switch (docType) {
      case 'terms':
        return legalAgreeTerms;
      case 'privacy':
        return legalAgreePrivacy;
      case 'health_disclaimer':
        return legalAcknowledgeRisk;
      default:
        return false;
    }
  };

  const handleCheckboxChange = (docType: string, value: boolean) => {
    switch (docType) {
      case 'terms':
        onLegalAgreeTermsChange(value);
        break;
      case 'privacy':
        onLegalAgreePrivacyChange(value);
        break;
      case 'health_disclaimer':
        onLegalAcknowledgeRiskChange(value);
        break;
    }
  };

  const handleOpenModal = (docKey: string) => {
    setOpenDocKey(docKey);
  };

  return (
    <View style={styles.stepContentAnimated}>
      {/* Illustration */}
      <View style={styles.stepIllustration}>
        <View style={styles.illustrationOuter}>
          <View
            style={[
              styles.illustrationInner,
              {
                // Decorative hero surface: reduce glare in dark mode (do NOT use for inputs/toggles/buttons)
                backgroundColor: isDark ? colors.illustrationSurfaceDim : colors.background,
                borderColor: isDark ? colors.strokeOnSoftStrong : `${onboardingColors.primary}50`,
              },
            ]}
          >
            {/* Icon size 100px is illustration-specific, not typography (per guidelines 8.1) */}
            <MaterialCommunityIcons name="file-document-outline" size={100} color={onboardingColors.primary} />
          </View>
        </View>
      </View>

      {/* Title */}
      <ThemedText type="title" style={[styles.stepTitleModern, { color: colors.text }]}>
        {t('onboarding.legal.title')}
      </ThemedText>
      <ThemedText style={[styles.stepSubtitleModern, { color: colors.textSecondary }]}>
        {t('onboarding.legal.subtitle')}
      </ThemedText>

      {loadError && (
        <View style={styles.errorContainer}>
          <ThemedText style={[styles.errorText, { color: SemanticColors.error }]}>
            {t('onboarding.legal.error_prefix')} {loadError}
          </ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: onboardingColors.primary }]}
            onPress={() => {
              // React Query refetch on error retry
              refetch();
            }}
            disabled={loadingDocs}
            {...getButtonAccessibilityProps(
              t('onboarding.legal.retry'),
              t('onboarding.legal.double_tap_retry'),
              loadingDocs
            )}
          >
            <Text style={[styles.retryButtonText, { color: Colors.light.textInverse }]}>
              {t('onboarding.legal.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loadingDocs ? (
        <View style={styles.loadingContainer}>
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('onboarding.legal.loading')}
          </ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.documentsContainer} showsVerticalScrollIndicator={true}>
          {documents.map((doc) => {
            const docKey = `${doc.doc_type}:${doc.version}`;
            const isChecked = getCheckboxValue(doc.doc_type);
            const checkboxLabel = getCheckboxLabel(doc.doc_type);
            return (
              <View
                key={docKey}
                style={[
                  styles.documentCard,
                  { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                ]}
              >
                {/* Compact Card Row */}
                <View style={styles.documentRow}>
                  {/* Checkbox Area - Separate Pressable */}
                  <TouchableOpacity
                    style={styles.checkboxArea}
                    onPress={() => handleCheckboxChange(doc.doc_type, !isChecked)}
                    disabled={loading}
                    hitSlop={10}
                    {...getButtonAccessibilityProps(
                      checkboxLabel,
                      t('onboarding.legal.double_tap_check', { action: isChecked ? 'uncheck' : 'check', label: checkboxLabel }),
                      loading
                    )}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isChecked ? onboardingColors.primary : colors.border,
                          backgroundColor: isChecked ? onboardingColors.primary : colors.background,
                        },
                      ]}
                    >
                      {isChecked && (
                        <IconSymbol name="checkmark" size={16} color={Colors.light.textInverse} />
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Document Content - Clickable to Open Modal */}
                  <TouchableOpacity
                    style={styles.docContentPressable}
                    onPress={() => handleOpenModal(docKey)}
                    disabled={loading}
                    {...getButtonAccessibilityProps(
                      `Open ${getDocTitle(doc.doc_type)}`,
                      t('onboarding.legal.double_tap_open', { title: getDocTitle(doc.doc_type) }),
                      loading
                    )}
                  >
                    <View style={styles.docTextBlock}>
                      {/* Consent Statement */}
                      <Text
                        style={[
                          styles.checkboxLabel,
                          { color: colors.text },
                        ]}
                        numberOfLines={3}
                      >
                        {checkboxLabel}
                      </Text>
                      {/* Document Title */}
                      <Text style={[styles.documentTitleSecondary, { color: colors.tint }]}>
                        {getDocTitle(doc.doc_type)}
                      </Text>
                      {/* Version */}
                      <Text style={[styles.documentVersionSecondary, { color: colors.textSecondary }]}>
                        {t('onboarding.legal.version')}: {doc.version}
                      </Text>
                    </View>

                    {/* Chevron Icon */}
                    <View style={styles.chevronArea}>
                      <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Document Modal */}
      <Modal
        visible={!!openDoc}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOpenDocKey(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text variant="h3" style={[styles.modalTitle, { color: colors.text }]}>
                {openDoc ? getDocTitle(openDoc.doc_type) : ''}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setOpenDocKey(null)}
                {...getButtonAccessibilityProps(
                  t('onboarding.legal.close'),
                  t('onboarding.legal.double_tap_close'),
                  false
                )}
              >
                <IconSymbol name="xmark" size={FontSize['2xl']} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Modal ScrollView */}
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <ThemedText style={[styles.modalDocumentText, { color: colors.textSecondary }]}>
                {openDoc?.content_md ?? ''}
              </ThemedText>
              <View style={styles.modalDocumentSpacer} />
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalDoneButton,
                  {
                    backgroundColor: onboardingColors.primary,
                  },
                ]}
                onPress={() => setOpenDocKey(null)}
                {...getButtonAccessibilityProps(
                  t('onboarding.legal.done'),
                  t('onboarding.legal.double_tap_close'),
                  false
                )}
              >
                <Text style={[styles.modalDoneButtonText, { color: Colors.light.textInverse }]}>
                  {t('onboarding.legal.done')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  stepContentAnimated: {
    gap: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.sm,
    ...Platform.select({
      web: {
        animationKeyframes: {
          from: { opacity: 0, transform: `translateY(${Spacing.md}px)` },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        animationDuration: '0.3s',
        animationTimingFunction: 'ease',
        animationFillMode: 'both',
      },
      default: {
        opacity: 1,
      },
    }),
  },
  stepIllustration: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  illustrationOuter: {
    width: 172,
    height: 172,
    borderRadius: BorderRadius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${onboardingColors.primary}0F`,
    ...Shadows.md,
  },
  illustrationInner: {
    width: 148,
    height: 148,
    borderRadius: BorderRadius['3xl'],
    // Base (light mode) decorative surface; dark mode override is applied at render-time via theme tokens.
    backgroundColor: Colors.light.surfaceSoft2,
    borderWidth: Spacing.xs,
    borderColor: `${onboardingColors.primary}50`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitleModern: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepSubtitleModern: {
    fontSize: FontSize.md,
    marginBottom: Spacing.sm,
    textAlign: 'center',
    lineHeight: FontSize.md * LineHeight.normal,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSize.base,
  },
  documentsContainer: {
    maxHeight: 500,
    marginTop: Spacing.md,
  },
  documentCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  checkboxArea: {
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  checkbox: {
    width: Spacing['2xl'],
    height: Spacing['2xl'],
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: Spacing.xxs, // Align with first line of text
  },
  docContentPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  docTextBlock: {
    flex: 1,
    gap: Spacing.xs / 2,
  },
  checkboxLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.base * LineHeight.normal,
  },
  chevronArea: {
    padding: Spacing.xs,
    flexShrink: 0,
  },
  documentTitleSecondary: {
    fontSize: FontSize.sm + 4, // 4 points larger than sm (12 + 4 = 16)
    fontWeight: FontWeight.bold,
  },
  documentVersionSecondary: {
    fontSize: FontSize.xs,
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: SemanticColors.errorLight,
    borderWidth: 1,
    borderColor: SemanticColors.error,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  retryButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  retryButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.light.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    ...Platform.select({
      web: {
        padding: Spacing.xl,
      },
      default: {},
    }),
  },
  modalCard: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    borderRadius: BorderRadius.xl,
    ...Platform.select({
      web: {
        // Using theme shadow color for consistency (per guidelines 8.1)
        boxShadow: `0 ${Spacing.lg}px ${Spacing['3xl']}px ${Colors.light.shadow}`,
      },
      default: {
        ...Shadows.lg,
      },
    }),
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  modalCloseButton: {
    padding: Spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  modalDocumentText: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.relaxed,
  },
  modalFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: Spacing.md,
  },
  modalHint: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  modalDoneButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  modalDoneButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  modalDocumentSpacer: {
    height: Spacing['2xl'],
  },
});
