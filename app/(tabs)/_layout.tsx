import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.log'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="exercise"
          options={{
            title: t('tabs.exercise'),
            tabBarIcon: ({ color }) => <MaterialCommunityIcons name="heart-pulse" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="meds"
          options={{
            title: t('tabs.meds'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="pills.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="water"
          options={{
            title: t('tabs.water'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="drop.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t('tabs.dashboard'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.more'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="ellipsis.circle.fill" color={color} />,
          }}
        />
        {/* Hide explore tab - keeping it for backward compatibility but not showing in tab bar */}
        <Tabs.Screen
          name="explore"
          options={{
            href: null, // Hide from tab bar
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
