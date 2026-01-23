import React from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCaseDetail } from '@/hooks/use-cases';
import { useCaseMessages } from '@/hooks/use-case-thread';
import { useCaseAttachments, useSignedCaseAttachmentUrl } from '@/hooks/use-case-attachments';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatUTCDate } from '@/utils/calculations';
import { formatDate } from '@/utils/formatters';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { AccessibilityHints, getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import type { SupportCaseAttachment } from '@/utils/types';
import { useAuth } from '@/contexts/AuthContext';

function AttachmentPreview({ attachment }: { attachment: SupportCaseAttachment }) {
  const { t } = useTranslation();
  const { data: url, isLoading } = useSignedCaseAttachmentUrl(attachment.storage_path);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.attachmentCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <ThemedText style={[styles.attachmentLabel, { color: colors.textSecondary }]}>
        {attachment.content_type ?? 'image'}
      </ThemedText>
      {isLoading ? (
        <View style={styles.attachmentLoading}>
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      ) : url ? (
        <Image
          source={{ uri: url }}
          style={styles.attachmentImage}
          contentFit="contain"
          transition={150}
          accessibilityLabel={t('support.case_detail.attachment_a11y')}
        />
      ) : (
        <ThemedText style={[styles.attachmentError, { color: colors.textTertiary }]}>
          {t('support.case_detail.attachment_load_failed')}
        </ThemedText>
      )}
    </View>
  );
}

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const caseId = id;
  const { data: supportCase, isLoading } = useCaseDetail(caseId);
  const { data: messages = [], isLoading: messagesLoading } = useCaseMessages(caseId);
  const { data: attachments = [], isLoading: attachmentsLoading } = useCaseAttachments(caseId);

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingState}>
        <ActivityIndicator size="small" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!supportCase) {
    return (
      <ThemedView style={styles.loadingState}>
        <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>{t('support.case_detail.not_found')}</ThemedText>
      </ThemedView>
    );
  }

  const createdLabel = formatDate(formatUTCDate(supportCase.created_at), t);
  const statusLabel = t(`support.status.${supportCase.status}`);
  const categoryLabel = t(`support.categories.${supportCase.category}`);
  const visibleMessages = isAdmin ? messages : messages.filter((m) => !m.is_internal);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[
            styles.backButton,
            getMinTouchTargetStyle(),
            Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
          ]}
          onPress={() => router.back()}
          {...getButtonAccessibilityProps(t('common.back'), AccessibilityHints.BACK)}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {t('support.case_detail.title')}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText style={[styles.caseTitle, { color: colors.text }]}>
            {supportCase.subject?.trim() ? supportCase.subject : categoryLabel}
          </ThemedText>
          <ThemedText style={[styles.caseMeta, { color: colors.textSecondary }]}>
            {categoryLabel} • {statusLabel} • {createdLabel}
          </ThemedText>
          <ThemedText style={[styles.caseMessage, { color: colors.text }]}>{supportCase.message}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('support.case_detail.attachments')}</ThemedText>
          {attachmentsLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : attachments.length === 0 ? (
            <ThemedText style={[styles.emptyInline, { color: colors.textSecondary }]}>{t('support.case_detail.no_attachments')}</ThemedText>
          ) : (
            <View style={styles.attachmentsGrid}>
              {attachments.map((a) => (
                <AttachmentPreview key={a.id} attachment={a} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('support.case_detail.replies')}</ThemedText>
          {messagesLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : visibleMessages.length === 0 ? (
            <ThemedText style={[styles.emptyInline, { color: colors.textSecondary }]}>{t('support.case_detail.no_replies')}</ThemedText>
          ) : (
            <View style={styles.messageList}>
              {visibleMessages.map((m) => (
                <View key={m.id} style={[styles.messageBubble, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.messageText, { color: colors.text }]}>{m.message}</ThemedText>
                  <ThemedText style={[styles.messageMeta, { color: colors.textTertiary }]}>
                    {formatDate(formatUTCDate(m.created_at), t)}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  caseTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  caseMeta: {
    fontSize: FontSize.sm,
  },
  caseMessage: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
  inlineLoading: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  emptyInline: {
    fontSize: FontSize.sm,
  },
  attachmentsGrid: {
    gap: Spacing.md,
  },
  attachmentCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  attachmentLabel: {
    fontSize: FontSize.xs,
  },
  attachmentLoading: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentImage: {
    width: '100%',
    height: 240,
    borderRadius: BorderRadius.md,
    backgroundColor: 'transparent',
  },
  attachmentError: {
    fontSize: FontSize.sm,
  },
  messageList: {
    gap: Spacing.sm,
  },
  messageBubble: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  messageMeta: {
    fontSize: FontSize.xs,
  },
});

