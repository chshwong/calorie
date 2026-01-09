import React, { useMemo, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View, Text, Image, RefreshControl, TouchableOpacity, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, ModuleThemes, Spacing, FontSize, BorderRadius, type ModuleType } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from 'react-i18next';
import BrandLogoNameOnly from '@/components/brand/BrandLogoNameOnly';
import { useRouter } from 'expo-router';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

type Props = {
  appTitle?: string;
  greetingText?: string; // Optional - not displayed, kept for API compatibility
  dateText: string;
  rightAvatarUri?: string;
  preferredName?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  refreshControl?: React.ReactElement | undefined;
  onScroll?: (event: any) => void; // Event handler type from React Native ScrollView
  scrollEventThrottle?: number;
  scrollViewRef?: React.RefObject<ScrollView | null>;
  // Date navigation props
  goBackOneDay?: () => void;
  goForwardOneDay?: () => void;
  isToday?: boolean;
  module?: ModuleType;
};

// Logo height matches TightBrandHeader default height
const TOP_CONTENT_HEIGHT = 44; // logo only (not including safe area, no greeting)
const TOP_MAX_HEIGHT_FALLBACK = TOP_CONTENT_HEIGHT;

export function CollapsibleModuleHeader({
  appTitle = 'AvoVibe',
  greetingText, // Not used anymore, kept for API compatibility
  dateText,
  rightAvatarUri,
  preferredName,
  rightAction,
  children,
  refreshControl,
  onScroll,
  scrollEventThrottle = 16,
  scrollViewRef,
  goBackOneDay,
  goForwardOneDay,
  isToday = false,
  module,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useTranslation();
  const moduleAccent = module && ModuleThemes[module] ? ModuleThemes[module].accent : colors.tint;
  const scrollY = useRef(new Animated.Value(0)).current;

  const topMaxHeight = useMemo(() => {
    // total height for collapsible block including safe-area
    return insets.top + TOP_MAX_HEIGHT_FALLBACK;
  }, [insets.top]);

  const collapseDistance = TOP_MAX_HEIGHT_FALLBACK;

  const topHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [topMaxHeight, insets.top], // collapse down to just safe-area space
    extrapolate: 'clamp',
  });

  const topOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.85],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const topTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [0, -12], // Custom translate value for collapse animation effect
    extrapolate: 'clamp',
  });

  const handleScroll = (event: any) => {
    // event: any - React Native ScrollView scroll event type varies by platform
    const scrollEvent = Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: false } // height animation needs false
    );
    scrollEvent(event);
    onScroll?.(event);
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      stickyHeaderIndices={[1]}
      scrollEventThrottle={scrollEventThrottle}
      onScroll={handleScroll}
      refreshControl={refreshControl as any} // Type assertion needed due to React Native ScrollView type mismatch between RefreshControl component and element types
    >
      {/* 0) Collapsible top area */}
      <Animated.View
        style={[
          styles.topWrap,
          {
            height: topHeight,
            paddingTop: insets.top,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Animated.View
          style={{
            opacity: topOpacity,
            transform: [{ translateY: topTranslateY }],
          }}
        >
          <View style={styles.brandRow}>
            <View style={styles.logoContainer}>
              <BrandLogoNameOnly width={130} />
            </View>
            <View style={styles.avatarContainer}>
              {preferredName && (
                <Text style={[styles.preferredName, { color: colors.text }]} numberOfLines={1}>
                  {preferredName}
                </Text>
              )}
              <Pressable
                onPress={() => router.push('/settings')}
                style={[
                  getMinTouchTargetStyle(),
                  Platform.OS === 'web' ? getFocusStyle(moduleAccent) : {},
                ]}
                {...getButtonAccessibilityProps(t('settings.title'), t('settings.title'))}
              >
                {rightAvatarUri ? (
                  <Image source={{ uri: rightAvatarUri }} style={styles.avatar} />
                ) : (
                  <View
                    style={[
                      styles.avatarPlaceholder,
                      { backgroundColor: colors.backgroundSecondary },
                    ]}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* 1) Sticky date bar */}
      <View
        style={[
          styles.dateBar,
            {
              paddingTop: Spacing.none,
              backgroundColor: colors.background,
            },
        ]}
      >
        <View style={styles.dateNavigation} accessibilityRole="toolbar">
          {/* Left arrow button */}
          <TouchableOpacity
            onPress={goBackOneDay || undefined}
            activeOpacity={0.6}
            disabled={!goBackOneDay}
            style={[
              styles.dateNavButtonSimple,
              getMinTouchTargetStyle(),
              { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
              Platform.OS === 'web' && {
                zIndex: 10,
              },
            ]}
            {...getButtonAccessibilityProps(
              t('home.date_picker.previous_day'),
              t('accessibility.previous_day')
            )}
          >
            <View style={styles.dateNavIconContainer}>
              <Text style={[styles.dateNavButtonText, { color: moduleAccent }]}>‹</Text>
            </View>
          </TouchableOpacity>

          {/* Date text - center */}
          <View style={styles.dateDisplay}>
            <Text style={[styles.dateText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {dateText}
            </Text>
          </View>

          {/* Calendar button */}
          {rightAction && (
            <View style={styles.calendarButtonContainer}>
              {rightAction}
            </View>
          )}

          {/* Right arrow button (only show when not today) */}
          {!isToday && (
            <TouchableOpacity
              onPress={goForwardOneDay || undefined}
              activeOpacity={0.6}
              disabled={!goForwardOneDay}
              style={[
                styles.dateNavButtonSimple,
                getMinTouchTargetStyle(),
                { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
                Platform.OS === 'web' && {
                  zIndex: 10,
                },
              ]}
              {...getButtonAccessibilityProps(
                t('home.date_picker.next_day'),
                t('accessibility.next_day')
              )}
            >
              <View style={styles.dateNavIconContainer}>
                <Text style={[styles.dateNavButtonText, { color: moduleAccent }]}>›</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Placeholder when today (to keep layout balanced) */}
          {isToday && <View style={styles.dateNavButtonPlaceholder} />}
        </View>
      </View>

      {/* 2) Module content */}
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: {
    paddingBottom: Spacing['2xl'],
  },

  topWrap: {
    paddingHorizontal: Spacing.lg,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingBottom: Spacing.none,
    paddingTop: Spacing.none,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
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
  avatar: {
    width: 34, // Standard header avatar size (larger than TightBrandHeader's 32px for better visibility)
    height: 34,
    borderRadius: 17, // Half of width/height for perfect circle (34/2 = 17)
    marginTop: 5, // Lower avatar slightly to avoid touching top edge
  },
  avatarPlaceholder: {
    width: 34, // Standard header avatar size (larger than TightBrandHeader's 32px for better visibility)
    height: 34,
    borderRadius: 17, // Half of width/height for perfect circle (34/2 = 17)
    marginTop: 5, // Lower avatar slightly to avoid touching top edge
  },

  dateBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs, // Reduced spacing below date bar
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Platform.select({ web: Spacing.sm, default: Spacing.xs }),
    ...Platform.select({
      web: {
        zIndex: 10,
        position: 'relative' as any, // Type assertion needed for React Native web position type compatibility
      },
    }),
  },
  dateNavButtonSimple: {
    // Touch target handled by getMinTouchTargetStyle
  },
  dateNavIconContainer: {
    width: 32, // Touch target size for date navigation buttons
    height: 32,
    borderRadius: BorderRadius.card, // 18px - matches standard card radius
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavButtonText: {
    fontSize: FontSize['2xl'],
    fontWeight: '600',
    lineHeight: 28, // Custom line height for arrow character alignment
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  dateText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  calendarButtonContainer: {
    marginLeft: Spacing.xs,
  },
  dateNavButtonPlaceholder: {
    width: 32, // Matches dateNavIconContainer size for layout balance
    height: 32,
  },

  body: {
    paddingHorizontal: Spacing.none,
    paddingTop: Spacing.sm, // Reduced spacing above content
  },
});

