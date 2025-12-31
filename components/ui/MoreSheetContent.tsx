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
  titleNode?: React.ReactNode;
  items: MoreSheetItem[];
  topAccessory?: React.ReactNode;
  iconColor?: string;
};

export function MoreSheetContent({
  isDark,
  title,
  titleNode,
  items,
  topAccessory,
  iconColor,
}: MoreSheetContentProps) {
  const insets = useSafeAreaInsets();
  const themeKey = isDark ? 'dark' : 'light';
  const t = MoreSheetTokens;
  const iconColorToUse = iconColor ?? t.iconChip.iconColor[themeKey];

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
      {topAccessory ? <View style={styles.topAccessory}>{topAccessory}</View> : null}

      <View style={[styles.headerRow, { marginBottom: t.header.marginBottom }]}>
        {titleNode ? (
          <View style={styles.titleNodeWrap}>{titleNode}</View>
        ) : (
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
        )}
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
                  color={iconColorToUse}
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
  topAccessory: {
    width: '100%',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  title: {
    flex: 1,
  },
  titleNodeWrap: {
    flex: 1,
    alignItems: 'flex-start',
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


