import React from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TightBrandHeader } from '@/components/layout/tight-brand-header';
import { useAuth } from '@/contexts/AuthContext';
import { useUserConfig } from '@/hooks/use-user-config';
import { useAnnouncementById } from '@/hooks/use-announcements';
import { getAnnouncementImagePublicUrl } from '@/lib/services/announcements';
import { pickI18n } from '@/utils/i18n';
import { formatUTCDate } from '@/utils/calculations';
import { formatDate } from '@/utils/formatters';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BorderRadius, Colors, FontSize, FontWeight, Layout, Spacing } from '@/constants/theme';
import { AccessibilityHints, getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const { data: userConfig } = useUserConfig();
  const profile = userConfig;
  const avatarUrl = profile?.avatar_url ?? null;
  const preferredName = profile?.first_name ?? null;

  const { data: announcement, isLoading } = useAnnouncementById(id);

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingState}>
        <ActivityIndicator size="small" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!announcement) {
    return (
      <ThemedView style={styles.loadingState}>
        <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
          {t('inbox.announcement_not_found')}
        </ThemedText>
      </ThemedView>
    );
  }

  const title = pickI18n(announcement.title_i18n, locale);
  const body = pickI18n(announcement.body_i18n, locale);
  const dateLabel = formatDate(formatUTCDate(announcement.published_at ?? announcement.created_at), t);
  const linkPath = announcement.link_path;
  const imagePaths = Array.isArray(announcement.image_paths) ? announcement.image_paths.filter((x) => typeof x === 'string') : [];
  const imageUrls = imagePaths.map((p) => getAnnouncementImagePublicUrl(p)).filter(Boolean);
  const [heroUrl, ...thumbUrls] = imageUrls;

  return (
    <ThemedView style={styles.container}>
      <TightBrandHeader
        avatarUrl={avatarUrl}
        preferredName={preferredName}
        onPressAvatar={() => router.push('/settings')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[
            styles.backLink,
            getMinTouchTargetStyle(),
            Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
          ]}
          onPress={() => router.replace('/inbox')}
          {...getButtonAccessibilityProps(t('common.back'), AccessibilityHints.BACK)}
        >
          <IconSymbol name="chevron.left" size={18} color={colors.textSecondary} decorative={true} />
          <ThemedText style={[styles.backLinkText, { color: colors.textSecondary }]}>
            {t('common.back')}
          </ThemedText>
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {title}
          </ThemedText>
          <ThemedText style={[styles.date, { color: colors.textSecondary }]}>{dateLabel}</ThemedText>
          <ThemedText style={[styles.body, { color: colors.text }]}>{body}</ThemedText>

          {imageUrls.length > 0 && (
            <View style={styles.imagesSection}>
              {!!heroUrl && (
                <TouchableOpacity
                  style={styles.heroImageWrap}
                  onPress={() => {
                    if (heroUrl) Linking.openURL(heroUrl);
                  }}
                  accessibilityRole="button"
                >
                  <Image source={{ uri: heroUrl }} style={styles.heroImage} contentFit="cover" transition={150} />
                </TouchableOpacity>
              )}
              {thumbUrls.length > 0 && (
                <View style={styles.thumbGrid}>
                  {thumbUrls.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={styles.thumbWrap}
                      onPress={() => Linking.openURL(u)}
                      accessibilityRole="button"
                    >
                      <Image source={{ uri: u }} style={styles.thumb} contentFit="cover" transition={150} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {!!linkPath && (
            <View style={styles.ctaRow}>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onPress={() => router.push(linkPath)}
                {...getButtonAccessibilityProps(t('inbox.view_update'), AccessibilityHints.NAVIGATE)}
              >
                {t('inbox.view_update')}
              </Button>
            </View>
          )}
        </View>

        <View style={styles.footerSpacer}>
          <IconSymbol name="sparkles" size={18} color={colors.textTertiary} decorative={true} />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  backLinkText: {
    fontSize: FontSize.sm,
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
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  date: {
    fontSize: FontSize.sm,
  },
  body: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  ctaRow: {
    marginTop: Spacing.sm,
  },
  imagesSection: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  heroImageWrap: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 320,
  },
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  thumbWrap: {
    width: '31%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: 90,
  },
  footerSpacer: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
});
