import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminUpdateCaseStatus, useCaseDetail } from '@/hooks/use-cases';
import { useAdminAddCaseMessage, useCaseMessages } from '@/hooks/use-case-thread';
import { useCaseAttachments, useSignedCaseAttachmentUrl } from '@/hooks/use-case-attachments';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatUTCDate } from '@/utils/calculations';
import { formatDate } from '@/utils/formatters';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { AccessibilityHints, getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { showAppToast } from '@/components/ui/app-toast';
import type { SupportCaseAttachment, SupportCaseStatus } from '@/utils/types';

function AdminAttachmentPreview({ attachment }: { attachment: SupportCaseAttachment }) {
  const { t } = useTranslation();
  const { data: url, isLoading } = useSignedCaseAttachmentUrl(attachment.storage_path);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.attachmentCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
      {isLoading ? (
        <View style={styles.attachmentLoading}>
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      ) : url ? (
        <Image source={{ uri: url }} style={styles.attachmentImage} contentFit="contain" transition={150} />
      ) : (
        <ThemedText style={[styles.emptyInline, { color: colors.textSecondary }]}>
          {t('support.case_detail.attachment_load_failed')}
        </ThemedText>
      )}
    </View>
  );
}

export default function AdminSupportCaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isAdmin, loading } = useAuth();

  const caseId = id;
  const { data: supportCase, isLoading } = useCaseDetail(caseId);
  const { data: messages = [], isLoading: messagesLoading } = useCaseMessages(caseId);
  const { data: attachments = [], isLoading: attachmentsLoading } = useCaseAttachments(caseId);

  const updateStatus = useAdminUpdateCaseStatus();
  const addMessage = useAdminAddCaseMessage();

  const [internalNote, setInternalNote] = useState('');
  const [publicReply, setPublicReply] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!loading && !isAdmin) {
        Alert.alert(t('settings.admin.access_denied_title'), t('settings.admin.access_denied_message'));
        router.back();
      }
    }, [isAdmin, loading, router, t])
  );

  const statusOptions: SupportCaseStatus[] = useMemo(() => ['new', 'in_progress', 'resolved'], []);

  const isBusy = updateStatus.isPending || addMessage.isPending;

  const currentStatus = supportCase?.status ?? 'new';

  useEffect(() => {
    // Clear draft inputs when switching cases
    setInternalNote('');
    setPublicReply('');
  }, [caseId]);

  const handleSetStatus = async (status: SupportCaseStatus) => {
    if (!caseId) return;
    try {
      await updateStatus.mutateAsync({ caseId, status });
      showAppToast(t('support.admin.status_updated'));
    } catch (e: any) {
      Alert.alert(t('support.errors.title'), e?.message ?? t('common.unexpected_error'));
    }
  };

  const handleAddInternalNote = async () => {
    if (!caseId) return;
    const text = internalNote.trim();
    if (!text) return;
    try {
      await addMessage.mutateAsync({ caseId, message: text, isInternal: true, newStatus: null });
      setInternalNote('');
      showAppToast(t('support.admin.note_added'));
    } catch (e: any) {
      Alert.alert(t('support.errors.title'), e?.message ?? t('common.unexpected_error'));
    }
  };

  const handleAddPublicReply = async () => {
    if (!caseId) return;
    const text = publicReply.trim();
    if (!text) return;
    try {
      await addMessage.mutateAsync({ caseId, message: text, isInternal: false, newStatus: null });
      setPublicReply('');
      showAppToast(t('support.admin.reply_sent'));
    } catch (e: any) {
      Alert.alert(t('support.errors.title'), e?.message ?? t('common.unexpected_error'));
    }
  };

  if (loading || isLoading) {
    return (
      <ThemedView style={styles.loadingState}>
        <ActivityIndicator size="small" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!isAdmin) {
    return (
      <ThemedView style={styles.loadingState}>
        <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
          {t('settings.admin.access_denied_title')}
        </ThemedText>
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
          disabled={isBusy}
          {...getButtonAccessibilityProps(t('common.back'), AccessibilityHints.BACK, isBusy)}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {t('support.admin.case_detail_title')}
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
          <ThemedText style={[styles.caseMeta, { color: colors.textTertiary }]}>
            {t('support.admin.created_by')}: {supportCase.created_by}
          </ThemedText>
          <ThemedText style={[styles.caseMessage, { color: colors.text }]}>{supportCase.message}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('support.admin.status')}</ThemedText>
          <View style={styles.statusRow}>
            {statusOptions.map((s) => (
              <Button
                key={s}
                variant={s === currentStatus ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => handleSetStatus(s)}
                disabled={isBusy}
              >
                {t(`support.status.${s}`)}
              </Button>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('support.case_detail.attachments')}</ThemedText>
          {attachmentsLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : attachments.length === 0 ? (
            <ThemedText style={[styles.emptyInline, { color: colors.textSecondary }]}>
              {t('support.case_detail.no_attachments')}
            </ThemedText>
          ) : (
            <View style={styles.attachmentsGrid}>
              {attachments.map((a) => (
                <AdminAttachmentPreview key={a.id} attachment={a} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('support.admin.internal_note')}</ThemedText>
          <TextInput
            value={internalNote}
            onChangeText={setInternalNote}
            editable={!isBusy}
            placeholder={t('support.admin.internal_note_placeholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[
              styles.textArea,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
          />
          <Button variant="secondary" size="md" onPress={handleAddInternalNote} disabled={isBusy || !internalNote.trim()} fullWidth>
            {t('support.admin.add_internal_note')}
          </Button>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('support.admin.public_reply')}</ThemedText>
          <TextInput
            value={publicReply}
            onChangeText={setPublicReply}
            editable={!isBusy}
            placeholder={t('support.admin.public_reply_placeholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[
              styles.textArea,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
          />
          <Button variant="primary" size="md" onPress={handleAddPublicReply} disabled={isBusy || !publicReply.trim()} fullWidth>
            {t('support.admin.send_public_reply')}
          </Button>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('support.admin.thread')}</ThemedText>
          {messagesLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : messages.length === 0 ? (
            <ThemedText style={[styles.emptyInline, { color: colors.textSecondary }]}>{t('support.admin.no_messages')}</ThemedText>
          ) : (
            <View style={styles.messageList}>
              {messages.map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.messageBubble,
                    { backgroundColor: m.is_internal ? colors.backgroundSecondary : colors.tintLight },
                  ]}
                >
                  <ThemedText style={[styles.messageText, { color: colors.text }]}>{m.message}</ThemedText>
                  <ThemedText style={[styles.messageMeta, { color: colors.textTertiary }]}>
                    {m.is_internal ? t('support.admin.internal') : t('support.admin.public')}
                    {' • '}
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
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
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
    gap: Spacing.lg,
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
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  attachmentsGrid: {
    gap: Spacing.md,
  },
  attachmentCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
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

