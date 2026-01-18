import { useRouter } from "expo-router";
import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLogoNameOnly } from "@/components/brand/BrandLogoNameOnly";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, fontSizes, radius, spacing } from "@/theme/tokens";

type CollapsibleModuleHeaderProps = {
  dateText: string;
  preferredName?: string;
  rightAvatarUri?: string;
  rightAction?: React.ReactNode;
  goBackOneDay?: () => void;
  goForwardOneDay?: () => void;
  isToday?: boolean;
  children: React.ReactNode;
  refreshControl?: React.ReactElement | undefined;
  onScroll?: (event: any) => void;
  scrollEventThrottle?: number;
  scrollViewRef?: React.RefObject<ScrollView | null>;
};

const TOP_CONTENT_HEIGHT = 44;

export function CollapsibleModuleHeader({
  dateText,
  preferredName,
  rightAvatarUri,
  rightAction,
  goBackOneDay,
  goForwardOneDay,
  isToday = false,
  children,
  refreshControl,
  onScroll,
  scrollEventThrottle = 16,
  scrollViewRef,
}: CollapsibleModuleHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const { t } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;

  const topMaxHeight = TOP_CONTENT_HEIGHT;
  const collapseDistance = TOP_CONTENT_HEIGHT;

  const topHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [topMaxHeight, 0],
    extrapolate: "clamp",
  });

  const topOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.85],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const topTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [0, -12],
    extrapolate: "clamp",
  });

  const handleScroll = (event: any) => {
    const scrollEvent = Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: false }
    );
    scrollEvent(event);
    onScroll?.(event);
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { paddingTop: insets.top, backgroundColor: theme.background }]}
      edges={[]}
    >
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      stickyHeaderIndices={[1]}
      scrollEventThrottle={scrollEventThrottle}
      onScroll={handleScroll}
      refreshControl={refreshControl as any}
    >
      <Animated.View
        style={[
          styles.topWrap,
          {
            height: topHeight,
            backgroundColor: theme.background,
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
            <BrandLogoNameOnly textVariant="title" />
            <View style={styles.avatarContainer}>
              {preferredName ? (
                <Text variant="label" style={{ color: theme.text }} numberOfLines={1}>
                  {preferredName}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("settings.title")}
                onPress={() => router.push("/settings")}
                style={styles.avatarPressable}
              >
                {rightAvatarUri ? (
                  <Image source={{ uri: rightAvatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.surface }]} />
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      <View style={[styles.dateBarWrap, { backgroundColor: theme.background }]}>
        <View style={styles.dateBar}>
          <View style={styles.dateNavigation} accessibilityRole="toolbar">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("home.date_picker.previous_day")}
              accessibilityHint={t("accessibility.previous_day")}
              onPress={goBackOneDay}
              disabled={!goBackOneDay}
              style={styles.dateNavButton}
            >
              <Text style={[styles.dateNavButtonText, { color: theme.primary }]}>‹</Text>
            </Pressable>

            <View style={styles.dateDisplay}>
              <Text
                variant="label"
                style={[styles.dateText, { color: theme.text }]}
                numberOfLines={1}
              >
                {dateText}
              </Text>
            </View>

            {rightAction ? <View style={styles.calendarButtonContainer}>{rightAction}</View> : null}

            {!isToday ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.date_picker.next_day")}
                accessibilityHint={t("accessibility.next_day")}
                onPress={goForwardOneDay}
                disabled={!goForwardOneDay}
                style={styles.dateNavButton}
              >
                <Text style={[styles.dateNavButtonText, { color: theme.primary }]}>›</Text>
              </Pressable>
            ) : (
              <View style={styles.dateNavButtonPlaceholder} />
            )}
          </View>
        </View>
      </View>

      <View style={styles.body}>{children}</View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  contentContainer: {
    paddingBottom: spacing.xxl,
  },
  topWrap: {
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    overflow: "hidden",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatarPressable: {
    padding: spacing.xs,
    borderRadius: radius.pill,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  dateBarWrap: {
    width: "100%",
  },
  dateBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.xs,
  },
  dateNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  dateNavButton: {
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  dateNavButtonText: {
    fontSize: fontSizes.title,
    fontWeight: "600",
  },
  dateDisplay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: {
    fontWeight: "700",
  },
  calendarButtonContainer: {
    marginLeft: spacing.xs,
  },
  dateNavButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  body: {
    paddingHorizontal: 0,
    paddingTop: spacing.sm,
  },
});
