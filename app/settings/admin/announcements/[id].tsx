import React, { useEffect, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAnnouncementById,
  useCreateAnnouncementDraft,
  usePublishAnnouncement,
  useUpdateAnnouncementDraft,
} from '@/hooks/use-announcements';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { AccessibilityHints, getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import { showAppToast } from '@/components/ui/app-toast';
import { validateAnnouncementDraft } from '@/utils/validation';

export default function AdminAnnouncementEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isAdmin, loading } = useAuth();

  const isNew = id === 'new' || !id;
  const { data: announcement, isLoading } = useAnnouncementById(isNew ? undefined : id);

  const createDraft = useCreateAnnouncementDraft();
  const updateDraft = useUpdateAnnouncementDraft();
  const publishDraft = usePublishAnnouncement();

  const [titleEn, setTitleEn] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [titleFr, setTitleFr] = useState('');
  const [bodyFr, setBodyFr] = useState('');
  const [linkPath, setLinkPath] = useState('');
  const [previewLocale, setPreviewLocale] = useState<'en' | 'fr'>('en');
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const isPublished = announcement?.is_published ?? false;
  const canEdit = !isPublished;

  useFocusEffect(
    useCallback(() => {
      if (!loading && !isAdmin) {
        Alert.alert(t('settings.admin.access_denied_title'), t('settings.admin.access_denied_message'));
        router.back();
      }
    }, [isAdmin, loading, router, t])
  );

  useEffect(() => {
    if (!announcement) return;
    setTitleEn(announcement.title_i18n?.en ?? '');
    setBodyEn(announcement.body_i18n?.en ?? '');
    setTitleFr(announcement.title_i18n?.fr ?? '');
    setBodyFr(announcement.body_i18n?.fr ?? '');
    setLinkPath(announcement.link_path ?? '');
  }, [announcement]);

  const previewTitle = previewLocale === 'fr' ? titleFr : titleEn;
  const previewBody = previewLocale === 'fr' ? bodyFr : bodyEn;

  const isBusy = createDraft.isPending || updateDraft.isPending || publishDraft.isPending;

  const validateDraft = () => {
    const result = validateAnnouncementDraft({ titleEn, bodyEn, linkPath });
    if (!result.valid) {
      Alert.alert(t('settings.admin.validation_title'), t(result.errorKey ?? 'common.unexpected_error'));
    }
    return result.valid;
  };

  const buildI18nPayload = useCallback(() => {
    const payload: Record<string, string> = { en: titleEn.trim() };
    if (titleFr.trim()) payload.fr = titleFr.trim();
    return payload;
  }, [titleEn, titleFr]);

  const buildBodyPayload = useCallback(() => {
    const payload: Record<string, string> = { en: bodyEn.trim() };
    if (bodyFr.trim()) payload.fr = bodyFr.trim();
    return payload;
  }, [bodyEn, bodyFr]);

  const handleSaveDraft = async () => {
    if (!validateDraft()) return;

    try {
      if (isNew) {
        const created = await createDraft.mutateAsync({
          title_i18n: buildI18nPayload(),
          body_i18n: buildBodyPayload(),
          link_path: linkPath.trim() ? linkPath.trim() : null,
        });
        showAppToast(t('settings.admin.draft_saved'));
        router.replace(`/settings/admin/announcements/${created.id}`);
      } else if (id) {
        await updateDraft.mutateAsync({
          id,
          updates: {
            title_i18n: buildI18nPayload(),
            body_i18n: buildBodyPayload(),
            link_path: linkPath.trim() ? linkPath.trim() : null,
          },
        });
        showAppToast(t('settings.admin.draft_saved'));
      }
    } catch (error: any) {
      Alert.alert(t('settings.admin.save_failed_title'), error?.message ?? t('common.unexpected_error'));
    }
  };

  const handlePublish = () => {
    console.log('Publish button clicked:', { id, isNew, canEdit, isPublished });
    
    if (!id || isNew) {
      console.log('Publish blocked: missing id or isNew');
      return;
    }

    if (!validateDraft()) {
      console.log('Publish blocked: validation failed');
      return;
    }

    console.log('Showing publish confirmation modal');
    setShowPublishConfirm(true);
  };

  const confirmPublish = async () => {
    if (!id || isNew) return;
    setShowPublishConfirm(false);

    try {
      console.log('Publishing announcement:', id);
      await publishDraft.mutateAsync(id);
      showAppToast(t('settings.admin.published'));
    } catch (error: any) {
      console.error('Publish error:', error);
      Alert.alert(t('settings.admin.publish_failed_title'), error?.message ?? t('common.unexpected_error'));
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
          {t('settings.admin.editor_title')}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {!canEdit && (
        <View style={[styles.readOnlyBanner, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText style={[styles.readOnlyText, { color: colors.textSecondary }]}>
            {t('settings.admin.locked_after_publish')}
          </ThemedText>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.fieldGroup}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>{t('settings.admin.title_en')}</ThemedText>
          <TextInput
            value={titleEn}
            onChangeText={setTitleEn}
            placeholder={t('settings.admin.title_placeholder')}
            placeholderTextColor={colors.textTertiary}
            editable={canEdit}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>{t('settings.admin.body_en')}</ThemedText>
          <TextInput
            value={bodyEn}
            onChangeText={setBodyEn}
            placeholder={t('settings.admin.body_placeholder')}
            placeholderTextColor={colors.textTertiary}
            editable={canEdit}
            multiline
            style={[
              styles.textArea,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>{t('settings.admin.title_fr')}</ThemedText>
          <TextInput
            value={titleFr}
            onChangeText={setTitleFr}
            placeholder={t('settings.admin.title_placeholder')}
            placeholderTextColor={colors.textTertiary}
            editable={canEdit}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>{t('settings.admin.body_fr')}</ThemedText>
          <TextInput
            value={bodyFr}
            onChangeText={setBodyFr}
            placeholder={t('settings.admin.body_placeholder')}
            placeholderTextColor={colors.textTertiary}
            editable={canEdit}
            multiline
            style={[
              styles.textArea,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>{t('settings.admin.link_path')}</ThemedText>
          <TextInput
            value={linkPath}
            onChangeText={setLinkPath}
            placeholder={t('settings.admin.link_path_placeholder')}
            placeholderTextColor={colors.textTertiary}
            editable={canEdit}
            autoCapitalize="none"
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
          />
        </View>

        <View style={styles.previewHeader}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>{t('settings.admin.preview')}</ThemedText>
          <View style={styles.previewToggle}>
            {(['en', 'fr'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.previewToggleButton,
                  previewLocale === lang && { backgroundColor: colors.tint },
                ]}
                onPress={() => setPreviewLocale(lang)}
                disabled={previewLocale === lang}
              >
                <ThemedText
                  style={[
                    styles.previewToggleText,
                    { color: previewLocale === lang ? colors.textOnTint : colors.textSecondary },
                  ]}
                >
                  {lang.toUpperCase()}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText style={[styles.previewTitle, { color: colors.text }]}>
            {previewTitle || t('settings.admin.preview_placeholder_title')}
          </ThemedText>
          <ThemedText style={[styles.previewBody, { color: colors.textSecondary }]}>
            {previewBody || t('settings.admin.preview_placeholder_body')}
          </ThemedText>
        </View>

        <View style={styles.actionRow}>
          <Button variant="secondary" size="md" onPress={handleSaveDraft} loading={isBusy} fullWidth>
            {t('settings.admin.save_draft')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onPress={handlePublish}
            loading={publishDraft.isPending}
            fullWidth
            disabled={isNew || !canEdit}
          >
            {t('settings.admin.publish_action')}
          </Button>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showPublishConfirm}
        title={t('settings.admin.publish_title')}
        message={t('settings.admin.publish_confirm')}
        confirmText={t('settings.admin.publish_action')}
        cancelText={t('common.cancel')}
        onConfirm={confirmPublish}
        onCancel={() => setShowPublishConfirm(false)}
        confirmButtonStyle={{ backgroundColor: colors.error }}
      />
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
  readOnlyBanner: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  readOnlyText: {
    fontSize: FontSize.sm,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
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
    minHeight: 120,
    textAlignVertical: 'top',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewToggle: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  previewToggleButton: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: 'transparent',
  },
  previewToggleText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
  },
  previewCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  previewTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  previewBody: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  actionRow: {
    gap: Spacing.sm,
  },
});
