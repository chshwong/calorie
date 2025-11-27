import { View, StyleSheet, TouchableOpacity, Text, ScrollView, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

export default function RegisterConfirmationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.cardContainer, { maxWidth: isDesktop ? 440 : '100%' }]}>
          <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {/* Success Icon */}
            <View style={[styles.iconContainer, { backgroundColor: '#10B981' + '15' }]}>
              <IconSymbol name="checkmark.circle.fill" size={64} color="#10B981" />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <ThemedText 
                type="title" 
                style={[styles.title, { color: colors.text }]}
                accessibilityRole="header"
              >
                {t('auth.register_confirmation.title')}
              </ThemedText>
              <ThemedText 
                style={[styles.message, { color: colors.textSecondary }]}
                accessibilityRole="text"
              >
                {t('auth.register_confirmation.message')}
              </ThemedText>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: colors.tint },
                getMinTouchTargetStyle(),
                ...(Platform.OS === 'web' ? [getFocusStyle('#fff')] : []),
              ]}
              onPress={() => router.replace('/login')}
              {...getButtonAccessibilityProps(
                t('auth.register_confirmation.go_to_login'),
                t('auth.register_confirmation.go_to_login')
              )}
            >
              <Text style={styles.buttonText}>{t('auth.register_confirmation.go_to_login')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    minHeight: '100%',
  },
  cardContainer: {
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderRadius: 24,
    padding: 40,
    borderWidth: 1,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 200,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
