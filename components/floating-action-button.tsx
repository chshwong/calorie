import React from 'react';
import { StyleSheet, TouchableOpacity, View, Platform, Text } from 'react-native';
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
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getLocalDateString, getCurrentDateTimeUTC, getMealTypeFromCurrentTime } from '@/utils/calculations';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function FloatingActionButton() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  
  // Animation values
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const shadowOpacity = useSharedValue(0.3);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);
  
  // Animated styles for main button
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { rotate: `${rotation.value}deg` }
      ],
      ...(Platform.OS !== 'web' ? { shadowOpacity: shadowOpacity.value } : {}),
    };
  });

  // Animated styles for ripple effect
  const rippleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: rippleScale.value }],
      opacity: rippleOpacity.value,
    };
  });

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
    // Get current date and time in user's local timezone at the moment of click (live detection)
    // CurrentDateTime represents the user's local time for meal type determination
    const CurrentDateTime = new Date(); // Current date/time in user's local timezone
    const todayString = getLocalDateString(); // YYYY-MM-DD format in user's timezone
    
    // Automatically determine meal type based on current local time
    const mealType = getMealTypeFromCurrentTime();
    
    // Navigate to mealtype-log with current date and auto-selected meal type
    // Note: Time will be stored in UTC when saving, but meal type is determined from local time
    router.push({
      pathname: '/mealtype-log',
      params: {
        entryDate: todayString,
        mealType: mealType, // Auto-select meal type based on current local time
        preloadedEntries: JSON.stringify([])
      }
    });
  };

  // Calculate bottom position: tab bar height (typically ~80-90px) + safe area bottom + some padding
  const bottomPosition = 80 + insets.bottom + 16;

  return (
    <AnimatedTouchableOpacity
      style={[
        styles.fab,
        {
          backgroundColor: colors.tint,
          ...(Platform.OS !== 'web' ? { shadowColor: colors.tint } : {}),
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
            backgroundColor: colors.tint,
          },
          rippleStyle,
        ]}
      />
      <View style={styles.fabContent}>
        <Text style={styles.fabText}>+🍴</Text>
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
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -8,
  },
  ripple: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    opacity: 0,
  },
});

