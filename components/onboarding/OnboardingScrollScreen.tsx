import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

type Props = ViewProps & {
  children: React.ReactNode;
  stepKey?: string | number; // Kept for API compatibility, but not used since parent ScrollView handles scrolling
  contentContainerStyle?: ViewProps['style'];
};

/**
 * OnboardingScrollScreen - Wrapper component for onboarding step content
 * 
 * Note: The parent ScrollView in app/onboarding.tsx handles all scrolling.
 * This component is now just a View wrapper for consistency and potential future use.
 */
export function OnboardingScrollScreen({ children, contentContainerStyle, style, ...rest }: Props) {
  return (
    <View
      style={[styles.container, contentContainerStyle, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // No default styles - parent handles layout
  },
});

