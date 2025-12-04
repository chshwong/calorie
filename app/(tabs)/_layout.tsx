import { Tabs, useRouter } from 'expo-router';
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Text, Animated, PanResponder, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { HapticTab } from '@/components/haptic-tab';
import { PlusButtonTab } from '@/components/plus-button-tab';
import { MoreButtonTab } from '@/components/more-button-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ConstrainedTabBar } from '@/components/layout/constrained-tab-bar';
import { QuickAddProvider, useQuickAdd } from '@/contexts/quick-add-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import { MODULE_CONFIGS } from '@/utils/moduleConfigs';
import type { FocusModule } from '@/utils/types';
import { getLocalDateString } from '@/utils/calculations';

function TabLayoutContent() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { isQuickAddVisible, setQuickAddVisible } = useQuickAdd();
  const [isMoreMenuVisible, setMoreMenuVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  
  // Get user profile for focus module preferences
  const { data: profile } = useUserProfile();
  const focusModule1: FocusModule = (profile?.focus_module_1) || 'Food';
  const focusModule2: FocusModule = (profile?.focus_module_2) || 'Exercise';
  const focusModule3: FocusModule = (profile?.focus_module_3) || 'Med';
  
  // Compute the remaining module
  const ALL_MODULES: FocusModule[] = ['Food', 'Exercise', 'Med', 'Water'];
  const used = new Set([focusModule1, focusModule2, focusModule3]);
  const remainingModule = ALL_MODULES.find(m => !used.has(m)) || null;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // start responding when there is a noticeable vertical drag
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // only allow dragging down (positive dy)
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 80; // pixels to consider it a dismiss
        if (gestureState.dy > threshold) {
          // animate sheet down and then close, without resetting dragY here
          Animated.timing(dragY, {
            toValue: 300, // larger value so it moves fully off screen
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setQuickAddVisible(false);
            // DO NOT reset dragY here
          });
        } else {
          // not enough drag: spring back to original position
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (isQuickAddVisible) {
      slideAnim.setValue(0);
      dragY.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isQuickAddVisible, slideAnim, dragY]);

  const sheetTranslateY = Animated.add(
    slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [40, 0], // same values you used before
    }),
    dragY
  );

  const handleMoreSettings = () => {
    setMoreMenuVisible(false);
    // Navigate to your existing Settings screen
    router.push('/(tabs)/settings');
  };

  const handleMoreExercise = () => {
    setMoreMenuVisible(false);
    router.push('/(tabs)/exercise');
  };

  const handleMoreMeds = () => {
    setMoreMenuVisible(false);
    router.push('/(tabs)/meds');
  };

  const handleMoreWater = () => {
    setMoreMenuVisible(false);
    router.push('/(tabs)/water');
  };

  // Get module configs
  const module1Config = MODULE_CONFIGS[focusModule1];
  const module2Config = MODULE_CONFIGS[focusModule2];
  const module3Config = MODULE_CONFIGS[focusModule3];
  const remainingModuleConfig = remainingModule ? MODULE_CONFIGS[remainingModule] : null;

  // Helper function to open mealtype-log for current time
  // Reuses the same route and params structure as the old FAB behavior
  // autoScan: if true, automatically opens the barcode scanner when the screen loads
  const openMealTypeLogForNow = (autoScan: boolean = false) => {
    const now = new Date();
    
    // Determine the mealType based on current time
    const minutes = now.getHours() * 60 + now.getMinutes();
    let mealType: string;
    
    // 22:00–04:00 -> Late Night
    // 04:00–11:30 -> Breakfast
    // 11:30–14:00 -> Lunch
    // 14:00–17:00 -> Snack
    // 17:00–22:00 -> Dinner
    if (minutes >= 22 * 60 || minutes < 4 * 60) {
      mealType = 'late_night';
    } else if (minutes >= 4 * 60 && minutes < (11 * 60 + 30)) {
      mealType = 'breakfast';
    } else if (minutes >= (11 * 60 + 30) && minutes < 14 * 60) {
      mealType = 'lunch';
    } else if (minutes >= 14 * 60 && minutes < 17 * 60) {
      mealType = 'afternoon_snack';
    } else {
      mealType = 'dinner';
    }
    
    // Use the same date format and param structure that mealtype-log already expects
    // Reuse getLocalDateString() utility for consistency with FAB behavior
    const todayString = getLocalDateString();
    
    // Build params object
    const params: Record<string, string> = {
      entryDate: todayString,
      mealType: mealType,
      preloadedEntries: JSON.stringify([])
    };
    
    // Add auto-scan param if requested
    if (autoScan) {
      params.openBarcodeScanner = 'true';
    }
    
    // Navigate to mealtype-log with the same params structure as the FAB
    router.push({
      pathname: '/mealtype-log',
      params
    });
  };

  // Helper function to open Exercise screen for today
  // Reuses the same route and params structure as module-fab and dashboard
  // Use replace to ensure params update when already on the same route
  const openExerciseForToday = () => {
    const todayString = getLocalDateString();
    router.replace({
      pathname: '/exercise',
      params: { date: todayString }
    });
  };

  // Helper function to open Meds screen for today
  // Reuses the same route and params structure as module-fab and dashboard
  // Use replace to ensure params update when already on the same route
  const openMedsForToday = () => {
    const todayString = getLocalDateString();
    router.replace({
      pathname: '/meds',
      params: { date: todayString }
    });
  };

  // Helper function to open Water screen for today
  // Reuses the same route and params structure as dashboard
  // Use replace to ensure params update when already on the same route
  const openWaterForToday = () => {
    const todayString = getLocalDateString();
    router.replace({
      pathname: '/water',
      params: { date: todayString }
    });
  };

  const renderQuickAddModuleCard = (config: typeof module1Config) => {
    const moduleIconMap: Record<FocusModule, string> = {
      'Food': '🍽️',
      'Exercise': '🔥',
      'Med': '💊',
      'Water': '💧',
    };

    return (
      <Pressable
        key={config.key}
        style={({ pressed }) => [
          styles.quickAddCard,
          pressed && styles.quickAddCardPressed,
        ]}
        onPress={() => {
          setQuickAddVisible(false);
          if (config.key === 'Food') {
            openMealTypeLogForNow();
          } else if (config.key === 'Exercise') {
            openExerciseForToday();
          } else if (config.key === 'Med') {
            openMedsForToday();
          } else if (config.key === 'Water') {
            openWaterForToday();
          }
        }}
      >
        <View style={styles.quickAddCardIconCircle}>
          <Text style={styles.quickAddCardIconEmoji}>
            {moduleIconMap[config.key] || '•'}
          </Text>
        </View>
        <Text style={styles.quickAddCardLabel}>{config.label}</Text>
      </Pressable>
    );
  };

  const renderQuickAddCard = (label: string) => {
    const iconMap: Record<string, string> = {
      'Enter Weight': '⚖️',
      'Scan Barcode': '📷',
    };

    return (
      <Pressable
        key={label}
        style={({ pressed }) => [
          styles.quickAddCard,
          pressed && styles.quickAddCardPressed,
        ]}
        onPress={() => {
          setQuickAddVisible(false);
          // Handle Scan Barcode card - navigate to mealtype-log with auto-scan
          if (label === 'Scan Barcode') {
            openMealTypeLogForNow(true);
          }
          // Enter Weight and other cards can be handled here in the future
        }}
      >
        <View style={styles.quickAddCardIconCircle}>
          <Text style={styles.quickAddCardIconEmoji}>
            {iconMap[label] || '•'}
          </Text>
        </View>
        <Text style={styles.quickAddCardLabel}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: colors.tint,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBar: (props) => <ConstrainedTabBar {...props} />,
            tabBarStyle: {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              height: 54,
            },
          }}>
        <Tabs.Screen
          name="index"
          options={{
            title: module1Config.label,
            tabBarIcon: ({ color }) => module1Config.icon({ color, size: 28 }),
            listeners: {
              tabPress: (e) => {
                // If focusModule1 is not 'Food', redirect to the correct route
                if (focusModule1 !== 'Food' && module1Config.routeName !== 'index') {
                  e.preventDefault();
                  router.push(`/(tabs)/${module1Config.routeName}` as any);
                }
              },
            },
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
          name="meds"
          options={{
            title: '',
            tabBarButton: (props) => <PlusButtonTab {...props} />,
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="water"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        <Tabs.Screen
          name="exercise"
          options={{
            title: module2Config.label,
            tabBarIcon: ({ color }) => module2Config.icon({ color, size: 28 }),
            listeners: {
              tabPress: (e) => {
                // If focusModule2 is not 'Exercise', redirect to the correct route
                if (focusModule2 !== 'Exercise' && module2Config.routeName !== 'exercise') {
                  e.preventDefault();
                  router.push(`/(tabs)/${module2Config.routeName}` as any);
                }
              },
            },
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.more'),
            tabBarButton: (props) => <MoreButtonTab {...props} onPressCustom={() => setMoreMenuVisible(true)} />,
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
        <Modal
          visible={isQuickAddVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setQuickAddVisible(false)}
        >
          <Pressable
            style={[
              styles.quickAddOverlay,
              Platform.OS === 'web' && {
                pointerEvents: isQuickAddVisible ? 'auto' : 'none' as any,
              }
            ]}
            onPress={() => setQuickAddVisible(false)}
            pointerEvents={isQuickAddVisible ? 'auto' : 'none'}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.quickAddSheet}>
                <Animated.View
                  style={[
                    styles.quickAddSheetInner,
                    {
                      transform: [{ translateY: sheetTranslateY }],
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  {/* drag handle */}
                  <Pressable
                    style={styles.quickAddHandle}
                    onPress={() => setQuickAddVisible(false)}
                  />

                  {/* cards grid */}
                  <View style={styles.quickAddGrid}>
                    {renderQuickAddModuleCard(module1Config)}
                    {renderQuickAddModuleCard(module2Config)}
                    {renderQuickAddCard('Enter Weight')}
                    {renderQuickAddCard('Scan Barcode')}
                    {renderQuickAddModuleCard(module3Config)}
                    {remainingModuleConfig && renderQuickAddModuleCard(remainingModuleConfig)}
                  </View>
                </Animated.View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        <Modal
          visible={isMoreMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMoreMenuVisible(false)}
        >
          <Pressable
            style={[
              styles.moreMenuOverlay,
              Platform.OS === 'web' && {
                pointerEvents: isMoreMenuVisible ? 'auto' : 'none' as any,
              }
            ]}
            onPress={() => setMoreMenuVisible(false)}
            pointerEvents={isMoreMenuVisible ? 'auto' : 'none'}
          >
            <View style={styles.moreMenuSheet}>
              <View style={styles.moreMenuHandle} />

              <Pressable style={styles.moreMenuItem} onPress={handleMoreSettings}>
                <Text style={styles.moreMenuItemText}>Settings</Text>
              </Pressable>

              <Pressable style={styles.moreMenuItem} onPress={handleMoreExercise}>
                <Text style={styles.moreMenuItemText}>Exercise</Text>
              </Pressable>

              <Pressable style={styles.moreMenuItem} onPress={handleMoreMeds}>
                <Text style={styles.moreMenuItemText}>Meds</Text>
              </Pressable>

              <Pressable style={styles.moreMenuItem} onPress={handleMoreWater}>
                <Text style={styles.moreMenuItemText}>Water</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
  );
}

export default function TabLayout() {
  return (
    <QuickAddProvider>
      <TabLayoutContent />
    </QuickAddProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  quickAddOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  quickAddSheet: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 0,
  },
  quickAddSheetInner: {
    width: '100%',
    maxWidth: 1200,
    backgroundColor: 'rgba(255,255,255,0.9)', // softer, modern
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backdropFilter: 'blur(10px)', // web only, ignored on RN, safe to include
  },
  quickAddHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    marginBottom: 12,
  },
  quickAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
    columnGap: 12,
  },
  quickAddCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.85)', // slight frosted feel
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
    // shadows — modern soft look
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  quickAddCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  quickAddCardIconCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickAddCardIconEmoji: {
    fontSize: 32,
  },
  quickAddCardLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
    marginTop: 4,
    textAlign: 'center',
  },
  moreMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  moreMenuSheet: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingBottom: 12,
    paddingTop: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  moreMenuHandle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    marginBottom: 8,
  },
  moreMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  moreMenuItemText: {
    fontSize: 15,
  },
});
