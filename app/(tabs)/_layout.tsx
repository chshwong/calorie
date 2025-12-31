import { Tabs, useRouter, useSegments } from 'expo-router';
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Text, Animated, PanResponder, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { PlusButtonTab } from '@/components/plus-button-tab';
import { MoreButtonTab } from '@/components/more-button-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MoreSheetContent } from '@/components/ui/MoreSheetContent';
import { BigCircleMenuTokens, Colors, FontSize, FontWeight, Layout, MoreSheetTokens } from '@/constants/theme';
import BrandLogoMascotOnly from '@/components/brand/BrandLogoMascotOnly';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ConstrainedTabBar } from '@/components/layout/constrained-tab-bar';
import { QuickAddProvider, useQuickAdd } from '@/contexts/quick-add-context';
import { useUserConfig } from '@/hooks/use-user-config';
import { MODULE_CONFIGS } from '@/utils/moduleConfigs';
import type { FocusModule } from '@/utils/types';
import { getLocalDateString } from '@/utils/calculations';
import { useAuth } from '@/contexts/AuthContext';
import { openWeightEntryForToday as openWeightEntryForTodayNav } from '@/lib/navigation/weight';
import { getBigCircleMenuColors } from '@/theme/getBigCircleMenuColors';

function TabLayoutContent() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const themeKey = (colorScheme ?? 'light') as 'light' | 'dark';
  const colors = Colors[themeKey];
  const isDark = themeKey === 'dark';
  const insets = useSafeAreaInsets();
  const bigCircleColors = getBigCircleMenuColors(themeKey);
  const router = useRouter();
  const segments = useSegments();
  const { user, profile: authProfile, loading: authLoading } = useAuth();
  const { isQuickAddVisible, setQuickAddVisible } = useQuickAdd();
  const [isMoreMenuVisible, setMoreMenuVisible] = useState(false);
  const [quickAddSheetWidth, setQuickAddSheetWidth] = useState<number | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const isDismissingRef = useRef(false);
  const sheetHeightRef = useRef(0);

  // More sheet (separate animation state so it never fights QuickAdd)
  const moreSlideAnim = useRef(new Animated.Value(0)).current;
  const moreDragY = useRef(new Animated.Value(0)).current;
  const moreIsDismissingRef = useRef(false);
  const moreSheetHeightRef = useRef(0);
  
  // Get user config for focus module preferences
  const { data: userConfig, isLoading: userConfigLoading } = useUserConfig();
  const effectiveProfile = userConfig || authProfile;
  const focusModule1: FocusModule = (effectiveProfile?.focus_module_1) || 'Food';
  const focusModule2: FocusModule = (effectiveProfile?.focus_module_2) || 'Exercise';
  const focusModule3: FocusModule = (effectiveProfile?.focus_module_3) || 'Med';

  // Centralized onboarding redirect logic
  // This ensures users with onboarding_complete = false always stay on /onboarding
  useEffect(() => {
    // Wait for auth and profile to load
    if (authLoading || userConfigLoading) {
      return;
    }

    // If we have a user and profile, check onboarding status
    if (user && effectiveProfile) {
      const onboardingComplete = effectiveProfile.onboarding_complete ?? false;
      
      // If onboarding is not complete, redirect to onboarding
      // This protects the tabs area - if user tries to access tabs without completing onboarding, they get redirected
      if (!onboardingComplete) {
        router.replace('/onboarding');
      }
    }
  }, [authLoading, userConfigLoading, user, effectiveProfile, router]);
  
  // Compute the remaining module
  const ALL_MODULES: FocusModule[] = ['Food', 'Exercise', 'Med', 'Water'];
  const used = new Set([focusModule1, focusModule2, focusModule3]);
  const remainingModule = ALL_MODULES.find(m => !used.has(m)) || null;

  const closeQuickAdd = (mode: 'tap' | 'drag') => {
    if (isDismissingRef.current) return;

    isDismissingRef.current = true;

    // Avoid competing animations as we transition to a stable "closed" state.
    dragY.stopAnimation();
    slideAnim.stopAnimation();

    const offscreenY =
      (sheetHeightRef.current || 300) + Math.max(insets.bottom, 0) + 40;

    Animated.parallel([
      Animated.timing(dragY, {
        toValue: mode === 'drag' ? offscreenY : 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setQuickAddVisible(false);
      dragY.setValue(0);
      slideAnim.setValue(0);
      isDismissingRef.current = false;
    });
  };

  const closeMore = (mode: 'tap' | 'drag') => {
    if (moreIsDismissingRef.current) return;

    moreIsDismissingRef.current = true;

    moreDragY.stopAnimation();
    moreSlideAnim.stopAnimation();

    const offscreenY =
      (moreSheetHeightRef.current || 260) + Math.max(insets.bottom, 0) + 40;

    Animated.parallel([
      Animated.timing(moreDragY, {
        toValue: mode === 'drag' ? offscreenY : 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(moreSlideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMoreMenuVisible(false);
      moreDragY.setValue(0);
      moreSlideAnim.setValue(0);
      moreIsDismissingRef.current = false;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isDismissingRef.current) return false;
        // start responding when there is a noticeable vertical drag
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (isDismissingRef.current) return;
        // only allow dragging down (positive dy)
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isDismissingRef.current) return;

        const threshold = 80; // pixels to consider it a dismiss
        if (gestureState.dy > threshold) {
          closeQuickAdd('drag');
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
      isDismissingRef.current = false;
      slideAnim.setValue(0);
      dragY.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isQuickAddVisible, slideAnim, dragY]);

  useEffect(() => {
    if (isMoreMenuVisible) {
      moreIsDismissingRef.current = false;
      moreSlideAnim.setValue(0);
      moreDragY.setValue(0);
      Animated.timing(moreSlideAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isMoreMenuVisible, moreSlideAnim, moreDragY]);

  const sheetTranslateY = Animated.add(
    slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [40, 0], // same values you used before
    }),
    dragY
  );

  const moreSheetTranslateY = Animated.add(
    moreSlideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [40, 0],
    }),
    moreDragY
  );

  const morePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (moreIsDismissingRef.current) return false;
        return Math.abs(gestureState.dy) > 5;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (moreIsDismissingRef.current) return false;
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (moreIsDismissingRef.current) return;
        if (gestureState.dy > 0) {
          moreDragY.setValue(gestureState.dy);
        }
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderRelease: (_, gestureState) => {
        if (moreIsDismissingRef.current) return;

        const threshold = 80;
        if (gestureState.dy > threshold) {
          closeMore('drag');
        } else {
          Animated.spring(moreDragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleMoreSettings = () => {
    setMoreMenuVisible(false);
    // Navigate to your existing Settings screen
    router.push('/settings');
  };

  const handleMoreExercise = () => {
    setMoreMenuVisible(false);
    router.push('/(tabs)/exercise');
  };

  const handleMoreMeds = () => {
    setMoreMenuVisible(false);
    router.push('/(tabs)/meds');
  };

  const handleMoreWeight = () => {
    setMoreMenuVisible(false);
    router.push('/(tabs)/weight');
  };

  const handleMoreWater = () => {
    setMoreMenuVisible(false);
    router.push('/(tabs)/water');
  };

  const moreSheetItems = [
    {
      key: 'settings',
      label: t('settings.title'),
      icon: 'settings-outline' as const,
      onPress: handleMoreSettings,
    },
    {
      key: 'exercise',
      label: t('tabs.exercise'),
      icon: 'barbell-outline' as const,
      onPress: handleMoreExercise,
    },
    {
      key: 'weight',
      label: t('tabs.weight'),
      icon: 'scale-outline' as const,
      onPress: handleMoreWeight,
    },
    {
      key: 'meds',
      label: t('tabs.meds'),
      icon: 'nutrition-outline' as const,
      onPress: handleMoreMeds,
    },
    {
      key: 'water',
      label: t('tabs.water'),
      icon: 'water-outline' as const,
      onPress: handleMoreWater,
    },
  ];

  // Get module configs
  const module1Config = MODULE_CONFIGS[focusModule1];
  const module2Config = MODULE_CONFIGS[focusModule2];
  const module3Config = MODULE_CONFIGS[focusModule3];
  const remainingModuleConfig = remainingModule ? MODULE_CONFIGS[remainingModule] : null;

  const moduleRouteHref = {
    index: '/(tabs)',
    exercise: '/(tabs)/exercise',
    meds: '/(tabs)/meds',
    water: '/(tabs)/water',
  } as const;

  // Helper function to open mealtype-log for current time
  // Reuses the same route and params structure as the old FAB behavior
  // autoScan: if true, automatically opens the barcode scanner when the screen loads
  const openMealTypeLogForNow = (autoScan: boolean = false) => {
    const now = new Date();
    
    // Determine the mealType based on current time
    const minutes = now.getHours() * 60 + now.getMinutes();
    let mealType: string;
    
    // 22:00–04:00 -> Snack
    // 04:00–11:30 -> Breakfast
    // 11:30–14:00 -> Lunch
    // 14:00–17:00 -> Snack
    // 17:00–22:00 -> Dinner
    if (minutes >= 22 * 60 || minutes < 4 * 60) {
      mealType = 'afternoon_snack';
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
      pathname: '/(tabs)/mealtype-log',
      params
    });
  };

  // Helper function to open Exercise screen for today
  // Reuses the same route and params structure as module-fab and dashboard
  // Use replace to ensure params update when already on the same route
  const openExerciseForToday = () => {
    const todayString = getLocalDateString();
    router.replace({
      pathname: '/(tabs)/exercise',
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

  const openWeightEntryForToday = () => {
    openWeightEntryForTodayNav(router);
  };

  const getBigCircleMenuModuleLabel = (moduleKey: FocusModule, fallback: string) => {
    switch (moduleKey) {
      case 'Food':
        return t('quick_add.log_food');
      case 'Exercise':
        return t('quick_add.log_exercise');
      case 'Med':
        return t('quick_add.log_med_supp');
      case 'Water':
        return t('quick_add.log_water');
      default:
        return fallback;
    }
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
          {
            width:
              quickAddSheetWidth != null
                ? (quickAddSheetWidth - BigCircleMenuTokens.container.paddingHorizontal[themeKey] * 2 - BigCircleMenuTokens.grid.gap[themeKey].column) / 2
                : '48%',
            backgroundColor: BigCircleMenuTokens.tile.backgroundColor[themeKey],
            borderWidth: BigCircleMenuTokens.tile.borderWidth[themeKey],
            borderColor: BigCircleMenuTokens.tile.borderColor[themeKey],
            shadowColor: BigCircleMenuTokens.tile.iosShadow[themeKey].color,
            shadowOpacity: BigCircleMenuTokens.tile.iosShadow[themeKey].opacity,
            shadowOffset: { width: 0, height: BigCircleMenuTokens.tile.iosShadow[themeKey].offsetY },
            shadowRadius: BigCircleMenuTokens.tile.iosShadow[themeKey].radius,
            elevation: BigCircleMenuTokens.tile.androidElevation[themeKey],
          },
          themeKey === 'dark' && Platform.OS === 'android' ? { overflow: 'hidden' } : null,
          pressed && themeKey === 'light' ? styles.quickAddCardPressed : null,
          pressed && themeKey === 'dark' && Platform.OS === 'ios' ? { opacity: 0.75 } : null,
        ]}
        android_ripple={
          themeKey === 'dark'
            ? {
                color: bigCircleColors.ripple,
              }
            : undefined
        }
        onPress={() => {
          closeQuickAdd('tap');
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
        {themeKey === 'dark' ? (
          <View style={styles.quickAddIconRowDark}>
            <Text
              style={[
                styles.quickAddCardIconEmoji,
                {
                  fontSize: BigCircleMenuTokens.tile.iconChip.emojiSize[themeKey],
                },
              ]}
            >
              {moduleIconMap[config.key] || '•'}
            </Text>
          </View>
        ) : (
          <View style={styles.quickAddCardIconCircle}>
            <Text
              style={[
                styles.quickAddCardIconEmoji,
                {
                  fontSize: BigCircleMenuTokens.tile.iconChip.emojiSize[themeKey],
                },
              ]}
            >
              {moduleIconMap[config.key] || '•'}
            </Text>
          </View>
        )}
        <Text
          style={[
            styles.quickAddCardLabel,
            {
              fontSize: BigCircleMenuTokens.tile.label.fontSize[themeKey],
              fontWeight: BigCircleMenuTokens.tile.label.fontWeight[themeKey],
              color: BigCircleMenuTokens.tile.label.color[themeKey],
              marginTop: BigCircleMenuTokens.tile.label.marginTop[themeKey],
            },
          ]}
        >
          {getBigCircleMenuModuleLabel(config.key, config.label)}
        </Text>
      </Pressable>
    );
  };

  const renderQuickAddCard = (params: {
    key: 'enter_weight' | 'scan_barcode';
    label: string;
    emoji?: string;
    iconName?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    onPress: () => void;
  }) => {
    const iconVisualSize = BigCircleMenuTokens.tile.iconChip.emojiSize[themeKey];
    // Emojis typically render with extra line-height/vertical padding compared to vector icons.
    // Give icon-based tiles a consistent "icon box" height so the label aligns with emoji-based tiles.
    const iconBoxHeight = Math.round(
      iconVisualSize * BigCircleMenuTokens.tile.iconChip.iconBoxHeightMultiplier[themeKey]
    );

    return (
      <Pressable
        key={params.key}
        style={({ pressed }) => [
          styles.quickAddCard,
          {
            width:
              quickAddSheetWidth != null
                ? (quickAddSheetWidth - BigCircleMenuTokens.container.paddingHorizontal[themeKey] * 2 - BigCircleMenuTokens.grid.gap[themeKey].column) / 2
                : '48%',
            backgroundColor: BigCircleMenuTokens.tile.backgroundColor[themeKey],
            borderWidth: BigCircleMenuTokens.tile.borderWidth[themeKey],
            borderColor: BigCircleMenuTokens.tile.borderColor[themeKey],
            shadowColor: BigCircleMenuTokens.tile.iosShadow[themeKey].color,
            shadowOpacity: BigCircleMenuTokens.tile.iosShadow[themeKey].opacity,
            shadowOffset: { width: 0, height: BigCircleMenuTokens.tile.iosShadow[themeKey].offsetY },
            shadowRadius: BigCircleMenuTokens.tile.iosShadow[themeKey].radius,
            elevation: BigCircleMenuTokens.tile.androidElevation[themeKey],
          },
          themeKey === 'dark' && Platform.OS === 'android' ? { overflow: 'hidden' } : null,
          pressed && themeKey === 'light' ? styles.quickAddCardPressed : null,
          pressed && themeKey === 'dark' && Platform.OS === 'ios' ? { opacity: 0.75 } : null,
        ]}
        android_ripple={
          themeKey === 'dark'
            ? {
                color: bigCircleColors.ripple,
              }
            : undefined
        }
        onPress={() => {
          closeQuickAdd('tap');
          params.onPress();
        }}
      >
        {themeKey === 'dark' ? (
          <View style={styles.quickAddIconRowDark}>
            {params.iconName ? (
              <View style={{ height: iconBoxHeight, justifyContent: 'center' }}>
                <MaterialCommunityIcons
                  name={params.iconName}
                  size={iconVisualSize}
                  color={BigCircleMenuTokens.tile.label.color[themeKey]}
                />
              </View>
            ) : (
              <Text
                style={[
                  styles.quickAddCardIconEmoji,
                  {
                    fontSize: iconVisualSize,
                  },
                ]}
              >
                {params.emoji}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.quickAddCardIconCircle}>
            {params.iconName ? (
              <View style={{ height: iconBoxHeight, justifyContent: 'center' }}>
                <MaterialCommunityIcons
                  name={params.iconName}
                  size={iconVisualSize}
                  color={BigCircleMenuTokens.tile.label.color[themeKey]}
                />
              </View>
            ) : (
              <Text
                style={[
                  styles.quickAddCardIconEmoji,
                  {
                    fontSize: iconVisualSize,
                  },
                ]}
              >
                {params.emoji}
              </Text>
            )}
          </View>
        )}
        <Text
          style={[
            styles.quickAddCardLabel,
            {
              fontSize: BigCircleMenuTokens.tile.label.fontSize[themeKey],
              fontWeight: BigCircleMenuTokens.tile.label.fontWeight[themeKey],
              color: BigCircleMenuTokens.tile.label.color[themeKey],
              marginTop: BigCircleMenuTokens.tile.label.marginTop[themeKey],
            },
          ]}
        >
          {params.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
        <Tabs
          tabBar={(props: BottomTabBarProps) => <ConstrainedTabBar {...props} />}
          screenOptions={{
            tabBarActiveTintColor: colors.tint,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarStyle: [
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                borderTopWidth: 0,
                height: 54,
                zIndex: 9999,
              },
              Platform.select({
                web: {
                  position: 'fixed',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  paddingBottom: 0,
                  marginBottom: 0,
                },
                default: {
                  position: 'absolute',
                  bottom: 0,
                },
              }),
            ],
            tabBarLabelStyle: {
              fontSize: FontSize.sm, // increased by ~2 points from default
            },
          }}>
        <Tabs.Screen
          name="index"
          listeners={{
            tabPress: (e: { preventDefault: () => void }) => {
              // If focusModule1 is not 'Food', redirect to the correct route
              if (focusModule1 !== 'Food' && module1Config.routeName !== 'index') {
                e.preventDefault();
                router.push(moduleRouteHref[module1Config.routeName]);
              }
            },
          }}
          options={{
            title: module1Config.label,
            tabBarIcon: ({ color }) => module1Config.icon({ color, size: 28 }),
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
          name="mealtype-log"
          options={{
            href: null, // Hide from tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="weight/index"
          options={{
            href: null, // Hide weight home from tab bar
          }}
        />
        <Tabs.Screen
          name="weight/entry"
          options={{
            href: null, // Hide weight entry from tab bar
          }}
        />
        <Tabs.Screen
          name="exercise"
          listeners={{
            tabPress: (e: { preventDefault: () => void }) => {
              // If focusModule2 is not 'Exercise', redirect to the correct route
              if (focusModule2 !== 'Exercise' && module2Config.routeName !== 'exercise') {
                e.preventDefault();
                router.push(moduleRouteHref[module2Config.routeName]);
              }
            },
          }}
          options={{
            title: module2Config.label,
            tabBarIcon: ({ color }) => module2Config.icon({ color, size: 28 }),
          }}
        />
        <Tabs.Screen
          name="more"
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
          animationType="none"
          onRequestClose={() => closeQuickAdd('tap')}
        >
          <Pressable
            style={[
              styles.quickAddOverlay,
              {
                pointerEvents: isQuickAddVisible ? 'auto' : 'none',
              },
            ]}
            onPress={() => closeQuickAdd('tap')}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: BigCircleMenuTokens.backdrop.color[themeKey], opacity: slideAnim },
              ]}
            />
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.quickAddSheet}>
                <Animated.View
                  style={[
                    styles.quickAddSheetInner,
                    {
                      transform: [{ translateY: sheetTranslateY }],
                      maxWidth: BigCircleMenuTokens.container.maxWidth,
                      backgroundColor: BigCircleMenuTokens.sheet.backgroundColor[themeKey],
                      paddingHorizontal: BigCircleMenuTokens.container.paddingHorizontal[themeKey],
                      paddingTop: BigCircleMenuTokens.container.paddingTop[themeKey],
                      paddingBottom:
                        BigCircleMenuTokens.container.paddingBottomBase[themeKey] +
                        (themeKey === 'dark' ? Math.max(insets.bottom, 0) : 0),
                      borderTopLeftRadius: BigCircleMenuTokens.container.borderTopRadius[themeKey],
                      borderTopRightRadius: BigCircleMenuTokens.container.borderTopRadius[themeKey],
                    },
                    themeKey === 'light' ? { backdropFilter: 'blur(10px)' } : null,
                  ]}
                  {...panResponder.panHandlers}
                  onLayout={(e) => {
                    setQuickAddSheetWidth(e.nativeEvent.layout.width);
                    sheetHeightRef.current = e.nativeEvent.layout.height;
                  }}
                >
                  {/* drag handle */}
                  <Pressable
                    style={[
                      styles.quickAddHandle,
                      {
                        width: BigCircleMenuTokens.handle.width[themeKey],
                        height: BigCircleMenuTokens.handle.height[themeKey],
                        borderRadius: BigCircleMenuTokens.handle.borderRadius[themeKey],
                        backgroundColor: BigCircleMenuTokens.handle.color[themeKey],
                        marginBottom: BigCircleMenuTokens.handle.marginBottom,
                      },
                    ]}
                    onPress={() => closeQuickAdd('tap')}
                  />

                  <View style={styles.quickAddTitleRow}>
                    <Text
                      style={[
                        styles.quickAddTitleText,
                        {
                          color: BigCircleMenuTokens.tile.label.color[themeKey],
                          fontSize: FontSize.lg,
                          fontWeight: FontWeight.bold,
                        },
                      ]}
                    >
                      {t('quick_add.log_now', { defaultValue: 'Log Now' })}
                    </Text>
                    <IconSymbol
                      name="plus"
                      size={FontSize.lg}
                      color={BigCircleMenuTokens.tile.label.color[themeKey]}
                      decorative
                    />
                  </View>

                  {/* cards grid */}
                  <View
                    style={[
                      styles.quickAddGrid,
                      {
                        rowGap: BigCircleMenuTokens.grid.gap[themeKey].row,
                        columnGap: BigCircleMenuTokens.grid.gap[themeKey].column,
                      },
                    ]}
                  >
                    {renderQuickAddModuleCard(module1Config)}
                    {renderQuickAddModuleCard(module2Config)}
                    {renderQuickAddCard({
                      key: 'enter_weight',
                      label: t('quick_add.enter_weight'),
                      emoji: '⚖️',
                      onPress: openWeightEntryForToday,
                    })}
                    {renderQuickAddCard({
                      key: 'scan_barcode',
                      label: t('quick_add.scan_barcode'),
                      iconName: 'barcode-scan',
                      onPress: () => openMealTypeLogForNow(true),
                    })}
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
          animationType="none"
          onRequestClose={() => closeMore('tap')}
        >
          <View
            style={[styles.moreMenuOverlay, { pointerEvents: isMoreMenuVisible ? 'auto' : 'none' }]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: MoreSheetTokens.backdrop.color[themeKey], opacity: moreSlideAnim },
              ]}
            />

            {/* Backdrop tap target */}
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMore('tap')} />

            {/* Sheet container (not pressable) */}
            <View style={styles.moreMenuSheetContainer} pointerEvents="box-none">
            <Animated.View
              {...morePanResponder.panHandlers}
              style={{ width: '100%', transform: [{ translateY: moreSheetTranslateY }] }}
              onLayout={(e) => {
                moreSheetHeightRef.current = e.nativeEvent.layout.height;
              }}
            >
                <MoreSheetContent
                  isDark={isDark}
                  title={t('tabs.more')}
                  titleNode={
                    <BrandLogoMascotOnly
                      width={MoreSheetTokens.header.logoWidth}
                      accessibilityLabel={t('tabs.more')}
                    />
                  }
                  items={moreSheetItems}
                  iconColor={colors.tint}
                  topAccessory={
                    <View
                      style={{
                        paddingTop: MoreSheetTokens.handle.paddingTop,
                        paddingBottom: MoreSheetTokens.handle.paddingBottom,
                        width: '100%',
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: MoreSheetTokens.handle.width,
                          height: MoreSheetTokens.handle.height,
                          borderRadius: MoreSheetTokens.handle.borderRadius,
                          backgroundColor: MoreSheetTokens.handle.color[themeKey],
                        }}
                      />
                    </View>
                  }
                  
                />
              </Animated.View>
            </View>
          </View>
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
    justifyContent: 'flex-end',
  },
  quickAddSheet: {
    width: '100%',
    alignItems: 'center',
  },
  quickAddSheetInner: {
    width: '100%',
  },
  quickAddHandle: {
    alignSelf: 'center',
  },
  quickAddTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.cardInnerPaddingCompact,
  },
  quickAddTitleText: {
    marginRight: Layout.titleGapCompact,
  },
  quickAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAddCard: {
    borderRadius: BigCircleMenuTokens.tile.borderRadius,
    paddingVertical: BigCircleMenuTokens.tile.paddingVertical,
    paddingHorizontal: BigCircleMenuTokens.tile.paddingHorizontal,
  },
  quickAddCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  quickAddCardIconCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    // Engineering guideline #11: spacing via tokens (10 is spec-driven compact spacing)
    marginBottom: Layout.cardInnerPaddingCompact,
  },
  quickAddCardIconEmoji: {
  },
  quickAddIconRowDark: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddCardLabel: {
    textAlign: 'center',
  },
  moreMenuOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  moreMenuSheetContainer: {
    width: '100%',
    maxWidth: Layout.desktopMaxWidth, // Match DesktopPageContainer max-width (same as main content)
    alignSelf: 'center',
    alignItems: 'center',
  },
});
