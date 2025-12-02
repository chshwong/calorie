/**
 * Module Floating Action Button - FAB with module-specific accent colors
 * 
 * A floating action button that uses module accent colors for visual differentiation.
 * Used on Exercise and Meds pages to reinforce module identity.
 * 
 * Per engineering guidelines:
 * - Uses theme tokens for all styling
 * - Module-aware accent colors
 * - Theme-aware (dark/light mode)
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Platform, Text, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withSequence,
  withTiming
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, ModuleThemes, type ModuleType } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getLocalDateString, getMealTypeFromCurrentTime } from '@/utils/calculations';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

type ModuleFABProps = {
  module: ModuleType;
  onPress?: () => void;
  icon?: string;
  iconText?: string;
};

export function ModuleFAB({ module, onPress, icon, iconText }: ModuleFABProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  
  // Hide FAB on desktop/large screens (>= 768px)
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isDesktop = screenWidth >= 768;
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);
  
  const moduleTheme = ModuleThemes[module];
  const fabColor = moduleTheme.accent;
  const iconColor = '#FFFFFF'; // White icon on colored background
  
  // Animation values - MUST be called before any conditional returns
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const shadowOpacity = useSharedValue(0.3);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);
  
  // Animated styles for main button - MUST be called before any conditional returns
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { rotate: `${rotation.value}deg` }
      ],
      ...(Platform.OS !== 'web' ? { shadowColor: fabColor, shadowOpacity: shadowOpacity.value } : {}),
    };
  });

  // Animated styles for ripple effect - MUST be called before any conditional returns
  const rippleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: rippleScale.value }],
      opacity: rippleOpacity.value,
    };
  });
  
  // Don't render FAB on desktop/large screens (>= 768px) - AFTER all hooks
  if (isDesktop) {
    return null;
  }

  const handlePressIn = () => {
    // Haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Scale down animation
    scale.value = withSpring(0.92, {
      damping: 15,
      stiffness: 400,
    });
    
    // Subtle rotation on press
    rotation.value = withSequence(
      withSpring(90, { damping: 20, stiffness: 400 }),
      withSpring(0, { damping: 20, stiffness: 400 })
    );
    
    // Increase shadow on press
    shadowOpacity.value = withSpring(0.5, {
      damping: 15,
      stiffness: 300,
    });

    // Ripple effect
    rippleScale.value = 0;
    rippleOpacity.value = 0.4;
    rippleScale.value = withTiming(1.5, { duration: 400 });
    rippleOpacity.value = withTiming(0, { duration: 400 });
  };

  const handlePressOut = () => {
    // Scale back up
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400,
    });
    
    // Reset shadow
    shadowOpacity.value = withSpring(0.3, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    
    // Default behavior: navigate to appropriate page based on module
    const todayString = getLocalDateString();
    
    if (module === 'exercise') {
      router.push(`/exercise?date=${todayString}`);
    } else if (module === 'meds') {
      router.push(`/meds?date=${todayString}`);
    } else if (module === 'food') {
      const mealType = getMealTypeFromCurrentTime();
      router.push({
        pathname: '/mealtype-log',
        params: {
          entryDate: todayString,
          mealType: mealType,
          preloadedEntries: JSON.stringify([])
        }
      });
    }
  };

  // Calculate bottom position: tab bar height (typically ~80-90px) + safe area bottom + some padding
  const bottomPosition = 80 + insets.bottom + 16;

  return (
    <AnimatedTouchableOpacity
      style={[
        styles.fab,
        {
          backgroundColor: fabColor,
          bottom: bottomPosition,
        },
        animatedStyle,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      {/* Ripple effect layer */}
      <Animated.View
        style={[
          styles.ripple,
          {
            backgroundColor: fabColor,
          },
          rippleStyle,
        ]}
      />
      <View style={styles.fabContent}>
        {icon ? (
          <IconSymbol name={icon as any} size={24} color={iconColor} />
        ) : iconText ? (
          <Text style={[styles.fabText, { color: iconColor }]}>{iconText}</Text>
        ) : (
          <Text style={[styles.fabText, { color: iconColor }]}>+</Text>
        )}
      </View>
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    overflow: 'visible',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      },
      default: {
        elevation: 8,
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowRadius: 8,
      },
    }),
  },
  fabContent: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  fabText: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
  },
  ripple: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    opacity: 0,
  },
});

