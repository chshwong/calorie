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
import { Image } from 'expo-image';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAnnouncementById,
  useCreateAnnouncementDraft,
  useDeleteAnnouncement,
  usePublishAnnouncement,
  useUpdateAnnouncementDraft,
} from '@/hooks/use-announcements';
import { useAddAnnouncementImages, useReorderAnnouncementImages, useRemoveAnnouncementImage } from '@/hooks/use-announcement-images';
import { getAnnouncementImagePublicUrl } from '@/lib/services/announcements';
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
  const deleteAnnouncementMutation = useDeleteAnnouncement();

  const [titleEn, setTitleEn] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [titleFr, setTitleFr] = useState('');
  const [bodyFr, setBodyFr] = useState('');
  const [linkPath, setLinkPath] = useState('');
  const [previewLocale, setPreviewLocale] = useState<'en' | 'fr'>('en');
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imagesError, setImagesError] = useState<string | null>(null);

  const isPublished = announcement?.is_published ?? false;
  const canEdit = !isPublished;
  const announcementId = !isNew && id ? id : null;

  const addImages = useAddAnnouncementImages();
  const removeImage = useRemoveAnnouncementImage();
  const reorderImages = useReorderAnnouncementImages();

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
    setImagePaths(Array.isArray(announcement.image_paths) ? announcement.image_paths.filter((x) => typeof x === 'string') : []);
  }, [announcement]);

  const previewTitle = previewLocale === 'fr' ? titleFr : titleEn;
  const previewBody = previewLocale === 'fr' ? bodyFr : bodyEn;

  const isImagesBusy = addImages.isPending || removeImage.isPending || reorderImages.isPending;
  const isBusy =
    createDraft.isPending ||
    updateDraft.isPending ||
    publishDraft.isPending ||
    deleteAnnouncementMutation.isPending ||
    isImagesBusy;

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

  const pickImagesWeb = async (): Promise<File[]> => {
    if (Platform.OS !== 'web') return [];
    if (typeof document === 'undefined') return [];

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.style.display = 'none';
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        input.remove();
        resolve(files);
      };
      document.body.appendChild(input);
      input.click();
    });
  };

  const handleAddImages = async () => {
    if (Platform.OS !== 'web') {
      showAppToast(t('settings.admin.images_web_only'));
      return;
    }
    if (!announcementId) {
      showAppToast(t('settings.admin.images_save_draft_first'));
      return;
    }
    if (!canEdit) return;

    setImagesError(null);
    const files = await pickImagesWeb();
    if (!files.length) return;

    try {
      const result = await addImages.mutateAsync({
        announcementId,
        existingPaths: imagePaths,
        files,
      });
      const next = Array.isArray(result.updated.image_paths)
        ? result.updated.image_paths.filter((x) => typeof x === 'string')
        : [];
      setImagePaths(next);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.startsWith('settings.')) {
        setImagesError(t(msg));
      } else {
        setImagesError(msg || t('common.unexpected_error'));
      }
    }
  };

  const handleRemoveImage = async (storagePath: string) => {
    if (!announcementId) return;
    if (!canEdit) return;

    setImagesError(null);
    try {
      const result = await removeImage.mutateAsync({
        announcementId,
        existingPaths: imagePaths,
        storagePath,
      });
      const next = Array.isArray(result.updated.image_paths)
        ? result.updated.image_paths.filter((x) => typeof x === 'string')
        : [];
      setImagePaths(next);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.startsWith('settings.')) {
        setImagesError(t(msg));
      } else {
        setImagesError(msg || t('common.unexpected_error'));
      }
    }
  };

  const moveImage = async (from: number, to: number) => {
    if (!announcementId) return;
    if (!canEdit) return;
    if (to < 0 || to >= imagePaths.length) return;

    setImagesError(null);

    const next = [...imagePaths];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setImagePaths(next);

    try {
      const result = await reorderImages.mutateAsync({ announcementId, imagePaths: next });
      const normalized = Array.isArray(result.updated.image_paths)
        ? result.updated.image_paths.filter((x) => typeof x === 'string')
        : [];
      setImagePaths(normalized);
    } catch (e: any) {
      // Revert on failure
      setImagePaths(imagePaths);
      const msg = String(e?.message ?? '');
      if (msg.startsWith('settings.')) {
        setImagesError(t(msg));
      } else {
        setImagesError(msg || t('common.unexpected_error'));
      }
    }
  };

  const renderImagesPreview = (paths: string[]) => {
    if (!paths.length) return null;
    const urls = paths.map((p) => getAnnouncementImagePublicUrl(p)).filter(Boolean);
    if (!urls.length) return null;

    const [first, ...rest] = urls;
    return (
      <View style={styles.imagesPreview}>
        <Image source={{ uri: first }} style={styles.previewHeroImage} contentFit="cover" transition={150} />
        {rest.length > 0 && (
          <View style={styles.previewThumbGrid}>
            {rest.map((u) => (
              <Image key={u} source={{ uri: u }} style={styles.previewThumb} contentFit="cover" transition={150} />
            ))}
          </View>
        )}
      </View>
    );
  };

  const handlePublish = () => {
    if (!id || isNew) {
      return;
    }

    if (!validateDraft()) {
      return;
    }

    setShowPublishConfirm(true);
  };

  const confirmPublish = async () => {
    if (!id || isNew) return;
    setShowPublishConfirm(false);

    try {
      await publishDraft.mutateAsync(id);
      showAppToast(t('settings.admin.published'));
    } catch (error: any) {
      Alert.alert(t('settings.admin.publish_failed_title'), error?.message ?? t('common.unexpected_error'));
    }
  };

  const confirmDelete = async () => {
    if (!announcementId) return;
    setShowDeleteConfirm(false);

    try {
      const result = await deleteAnnouncementMutation.mutateAsync(announcementId);
      if (result.imageDeleteFailed) {
        showAppToast(t('settings.admin.announcement_deleted_images_warning'));
      } else {
        showAppToast(t('settings.admin.announcement_deleted'));
      }
      router.replace('/settings/admin/announcements');
    } catch (error: any) {
      Alert.alert(t('settings.admin.delete_failed_title'), error?.message ?? t('common.unexpected_error'));
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

        <View style={styles.fieldGroup}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>{t('settings.admin.images_label')}</ThemedText>
          <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
            {t('settings.admin.images_helper')}
          </ThemedText>

          {!!imagesError && (
            <ThemedText style={[styles.errorText, { color: colors.error }]}>{imagesError}</ThemedText>
          )}

          <View style={styles.imagesActionRow}>
            <Button
              variant="secondary"
              size="md"
              onPress={handleAddImages}
              disabled={!canEdit || isBusy}
              fullWidth
            >
              {t('settings.admin.images_add')}
            </Button>
          </View>

          {imagePaths.length > 0 && (
            <View style={styles.imagesGrid}>
              {imagePaths.map((p, idx) => {
                const url = getAnnouncementImagePublicUrl(p);
                return (
                  <View key={p} style={[styles.imageTile, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    {!!url && <Image source={{ uri: url }} style={styles.imageThumb} contentFit="cover" transition={150} />}
                    <View style={styles.imageTileActions}>
                      <TouchableOpacity
                        style={[
                          styles.iconButton,
                          Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                        ]}
                        onPress={() => moveImage(idx, idx - 1)}
                        disabled={!canEdit || isBusy || idx === 0}
                        {...getButtonAccessibilityProps(t('settings.admin.images_move_left'), AccessibilityHints.BUTTON)}
                      >
                        <IconSymbol name="chevron.left" size={18} color={colors.textSecondary} decorative={true} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.iconButton,
                          Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                        ]}
                        onPress={() => moveImage(idx, idx + 1)}
                        disabled={!canEdit || isBusy || idx === imagePaths.length - 1}
                        {...getButtonAccessibilityProps(t('settings.admin.images_move_right'), AccessibilityHints.BUTTON)}
                      >
                        <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} decorative={true} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.iconButton,
                          Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                        ]}
                        onPress={() => handleRemoveImage(p)}
                        disabled={!canEdit || isBusy}
                        {...getButtonAccessibilityProps(t('settings.admin.images_remove'), AccessibilityHints.BUTTON)}
                      >
                        <IconSymbol name="xmark" size={18} color={colors.textSecondary} decorative={true} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
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
          {renderImagesPreview(imagePaths)}
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
          {!isNew && !!announcementId && (
            <Button
              variant="danger"
              size="md"
              onPress={() => setShowDeleteConfirm(true)}
              loading={deleteAnnouncementMutation.isPending}
              fullWidth
              disabled={isBusy}
            >
              {t('settings.admin.delete_announcement')}
            </Button>
          )}
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

      <ConfirmModal
        visible={showDeleteConfirm}
        title={isPublished ? t('settings.admin.delete_published_title') : t('settings.admin.delete_draft_title')}
        message={isPublished ? t('settings.admin.delete_published_body') : t('settings.admin.delete_draft_body')}
        confirmText={t('settings.admin.delete_confirm')}
        cancelText={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
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
  helperText: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  imagesActionRow: {
    marginTop: Spacing.xs,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  imageTile: {
    width: '31%',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  imageThumb: {
    width: '100%',
    height: 90,
  },
  imageTileActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagesPreview: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  previewHeroImage: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  previewThumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  previewThumb: {
    width: '31%',
    height: 90,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
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
