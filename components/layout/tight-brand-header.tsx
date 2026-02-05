import BrandLogoFull from '@/components/brand/BrandLogoFull';
import BrandLogoNameOnly from '@/components/brand/BrandLogoNameOnly';
import MascotAvatarFallback from '@/components/brand/MascotAvatarFallback';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUnreadNotificationCount } from '@/hooks/use-notifications';
import { HOME_ROUTE } from '@/lib/navigation/routes';
import {
  AccessibilityHints,
  getButtonAccessibilityProps,
  getFocusStyle,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TightBrandHeaderProps = {
  /** User avatar URL (optional) */
  avatarUrl?: string | null;
  /** Callback when avatar is pressed */
  onPressAvatar?: () => void;
  /** Logo variant: 'nameOnly' (default, shorter) or 'full' (taller) */
  logoVariant?: 'nameOnly' | 'full';
  /** Header height in pixels (default 44) */
  height?: number;
  /** User preferred name to display next to avatar (optional) */
  preferredName?: string | null;
};

/**
 * Tight top header component for Home/Dashboard screen
 * - Very short height (default 44px)
 * - Center: AvoVibe logo (auto light/dark)
 * - Right: User profile picture in a circle (tap target)
 * - Optionally shows preferred name next to avatar
 */
export function TightBrandHeader({
  avatarUrl,
  onPressAvatar,
  logoVariant = 'nameOnly',
  height = 44,
  preferredName,
}: TightBrandHeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const showUnreadBadge = unreadCount > 0;
  
  // Avatar size: use 34px when showing name (matches CollapsibleModuleHeader), 32px otherwise
  const avatarSize = preferredName ? 34 : 32;
  
  // Logo width based on height (proportional scaling)
  // For nameOnly: ~120-140px at 44px height
  const logoWidth = logoVariant === 'full' ? 140 : 130;
  
  return (
    <SafeAreaView 
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={Platform.OS === 'web' ? [] : ['top']}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Left: Logo */}
        <Pressable
          onPress={() => router.push(HOME_ROUTE)}
          style={({ pressed, hovered }: any) => [
            styles.logoPressable,
            getMinTouchTargetStyle(),
            Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
            Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {},
            hovered ? styles.logoHovered : null,
            pressed ? styles.logoPressed : null,
          ]}
          {...getButtonAccessibilityProps('Go to home', AccessibilityHints.NAVIGATE)}
        >
          <View style={styles.logoContainer}>
            {logoVariant === 'full' ? (
              <BrandLogoFull width={logoWidth} />
            ) : (
              <BrandLogoNameOnly width={logoWidth} />
            )}
          </View>
        </Pressable>
        
        {/* Right: Bell + Name + Avatar */}
        <View style={styles.rightActions}>
          {/* Bell Icon */}
          <TouchableOpacity
            style={[
              styles.bellButton,
              getMinTouchTargetStyle(),
              Platform.OS === 'web' ? getFocusStyle(colors.tint) : {},
            ]}
            onPress={() => router.push('/inbox')}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(
              showUnreadBadge
                ? t('inbox.accessibility.unread_messages', { count: unreadCount })
                : t('inbox.accessibility.no_unread_messages'),
              AccessibilityHints.NAVIGATE
            )}
          >
            <View style={styles.bellIconContainer}>
              <IconSymbol name="bell.fill" size={20} color={colors.text} decorative={true} />
              {showUnreadBadge && (
                <View
                  style={[
                    styles.unreadBadge,
                    {
                      backgroundColor: colors.tint,
                      borderColor: colors.background,
                    },
                  ]}
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no-hide-descendants"
                />
              )}
            </View>
          </TouchableOpacity>

          {/* Name + Avatar */}
          <View style={styles.avatarContainer}>
            {preferredName && (
              <Text style={[styles.preferredName, { color: colors.text }]} numberOfLines={1}>
                {preferredName}
              </Text>
            )}
            <Pressable
              onPress={onPressAvatar}
              style={[
                getMinTouchTargetStyle(),
                Platform.OS === 'web' && getFocusStyle(colors.tint),
              ]}
              {...getButtonAccessibilityProps(
                'User profile',
                'Double tap to open user profile'
              )}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={[
                    styles.avatarImage,
                    {
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: avatarSize / 2,
                      borderColor: colors.separator,
                      marginTop: 5,
                    },
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ marginTop: 5 }}>
                  <MascotAvatarFallback
                    size={avatarSize}
                    backgroundColor={colors.backgroundSecondary}
                    borderColor={colors.separator}
                  />
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    width: '100%',
  },
  logoContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logoPressable: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  logoHovered: {
    opacity: 0.92,
  },
  logoPressed: {
    opacity: 0.75,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bellButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  bellIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    zIndex: 1,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  preferredName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    textAlign: 'right',
  },
  avatarImage: {
    borderWidth: 1,
  },
});

