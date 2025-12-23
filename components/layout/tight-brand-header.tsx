import React from 'react';
import { View, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import BrandLogoNameOnly from '@/components/brand/BrandLogoNameOnly';
import BrandLogoFull from '@/components/brand/BrandLogoFull';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

type TightBrandHeaderProps = {
  /** User avatar URL (optional) */
  avatarUrl?: string | null;
  /** Callback when avatar is pressed */
  onPressAvatar?: () => void;
  /** Logo variant: 'nameOnly' (default, shorter) or 'full' (taller) */
  logoVariant?: 'nameOnly' | 'full';
  /** Header height in pixels (default 44) */
  height?: number;
};

/**
 * Tight top header component for Home/Dashboard screen
 * - Very short height (default 44px)
 * - Center: AvoVibe logo (auto light/dark)
 * - Right: User profile picture in a circle (tap target)
 * - Bottom divider line
 */
export function TightBrandHeader({
  avatarUrl,
  onPressAvatar,
  logoVariant = 'nameOnly',
  height = 44,
}: TightBrandHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Avatar size (32 or 34, using 32 for tight fit)
  const avatarSize = 32;
  
  // Logo width based on height (proportional scaling)
  // For nameOnly: ~120-140px at 44px height
  const logoWidth = logoVariant === 'full' ? 140 : 130;
  
  return (
    <SafeAreaView 
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View style={[styles.container, { height, backgroundColor: colors.background }]}>
        {/* Left spacer to balance avatar on right */}
        <View style={[styles.spacer, { width: avatarSize + Spacing.xs }]} />
        
        {/* Center logo */}
        <View style={styles.logoContainer}>
          {logoVariant === 'full' ? (
            <BrandLogoFull width={logoWidth} />
          ) : (
            <BrandLogoNameOnly width={logoWidth} />
          )}
        </View>
        
        {/* Right avatar */}
        <Pressable
          onPress={onPressAvatar}
          style={[
            styles.avatarContainer,
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
                { width: avatarSize, height: avatarSize, borderColor: colors.separator },
              ]}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                {
                  width: avatarSize,
                  height: avatarSize,
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.separator,
                },
              ]}
            >
              <IconSymbol
                name="person.fill"
                size={avatarSize * 0.6}
                color={colors.textSecondary}
                decorative={true}
              />
            </View>
          )}
        </Pressable>
      </View>
      
      {/* Bottom divider */}
      <View style={[styles.divider, { backgroundColor: colors.separator }]} />
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
    paddingHorizontal: Spacing.md, // 12px
    width: '100%',
  },
  spacer: {
    // Left spacer to balance avatar on right, keeping logo centered
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  avatarImage: {
    borderRadius: 16, // Half of 32
    borderWidth: 1,
  },
  avatarFallback: {
    borderRadius: 16, // Half of 32
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth, // 1px hairline
    width: '100%',
  },
});

