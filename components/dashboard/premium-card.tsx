/**
 * Premium Card Component for Dashboard
 * 
 * Reusable card with premium shadow, radius, and styling
 */

import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Shadows, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type PremiumCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  asymmetricBottom?: boolean;
};

export function PremiumCard({ children, style, asymmetricBottom = false }: PremiumCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: asymmetricBottom ? BorderRadius.card : BorderRadius.card,
          borderBottomLeftRadius: asymmetricBottom ? BorderRadius.cardBottomExtra : BorderRadius.card,
          borderBottomRightRadius: asymmetricBottom ? BorderRadius.cardBottomExtra : BorderRadius.card,
          ...Shadows.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Layout.cardInnerPadding,
    overflow: 'hidden',
    width: '100%',
  },
});

