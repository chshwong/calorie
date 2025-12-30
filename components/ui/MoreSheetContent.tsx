import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { MoreSheetTokens } from '@/constants/theme';

export type MoreSheetItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

type MoreSheetContentProps = {
  isDark: boolean;
  title: string;
  closeLabel: string;
  items: MoreSheetItem[];
  onClose: () => void;
};

export function MoreSheetContent({
  isDark,
  title,
  closeLabel,
  items,
  onClose,
}: MoreSheetContentProps) {
  const insets = useSafeAreaInsets();
  const themeKey = isDark ? 'dark' : 'light';
  const t = MoreSheetTokens;

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: t.sheet.backgroundColor[themeKey],
          paddingHorizontal: t.container.paddingHorizontal,
          paddingTop: t.container.paddingTop,
          paddingBottom: t.container.paddingBottomBase + Math.max(insets.bottom, 0),
          borderTopLeftRadius: t.container.borderTopRadius,
          borderTopRightRadius: t.container.borderTopRadius,
        },
      ]}
    >
      <View
        style={[
          styles.handle,
          {
            width: t.handle.width,
            height: t.handle.height,
            borderRadius: t.handle.borderRadius,
            backgroundColor: t.handle.color[themeKey],
            marginBottom: t.handle.marginBottom,
          },
        ]}
      />

      <View style={[styles.headerRow, { marginBottom: t.header.marginBottom }]}>
        <Text
          style={[
            styles.title,
            {
              fontSize: t.header.title.fontSize,
              fontWeight: t.header.title.fontWeight,
              color: t.header.title.color[themeKey],
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={({ pressed }) => [
            styles.closeButton,
            {
              width: t.header.closeButton.size,
              height: t.header.closeButton.size,
              borderRadius: t.header.closeButton.borderRadius,
              backgroundColor: t.header.closeButton.backgroundColor[themeKey],
            },
            pressed && Platform.OS === 'ios' ? { opacity: 0.75 } : null,
          ]}
          android_ripple={{
            color: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            borderless: true,
          }}
          hitSlop={8}
        >
          <Ionicons
            name="close"
            size={t.header.closeButton.iconSize}
            color={t.header.closeButton.iconColor[themeKey]}
          />
        </Pressable>
      </View>

      <View>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              onPressIn={() => {
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  height: t.row.height,
                  paddingHorizontal: t.row.paddingHorizontal,
                  borderRadius: t.row.borderRadius,
                  borderWidth: t.row.borderWidth,
                  backgroundColor: t.row.backgroundColor[themeKey],
                  borderColor: t.row.borderColor[themeKey],
                },
                pressed && Platform.OS === 'ios' ? { opacity: 0.75 } : null,
                !isLast ? { marginBottom: t.row.gap } : null,
              ]}
              android_ripple={{
                color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }}
            >
              <View
                style={[
                  styles.leftChip,
                  {
                    width: t.iconChip.size,
                    height: t.iconChip.size,
                    borderRadius: t.iconChip.borderRadius,
                    backgroundColor: t.iconChip.backgroundColor[themeKey],
                    marginRight: t.iconChip.marginRight,
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={t.iconChip.iconSize}
                  color={t.iconChip.iconColor[themeKey]}
                />
              </View>

              <Text
                style={[
                  styles.label,
                  {
                    fontSize: t.row.label.fontSize,
                    fontWeight: t.row.label.fontWeight,
                    color: t.row.label.color[themeKey],
                  },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>

              <Ionicons
                name="chevron-forward"
                size={t.row.chevron.size}
                color={t.row.chevron.color[themeKey]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    paddingRight: 8,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftChip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
});


