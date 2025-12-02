import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

export default function AdminPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isAdmin, loading } = useAuth();

  // Check admin access on focus
  useFocusEffect(
    useCallback(() => {
      if (!loading && !isAdmin) {
        Alert.alert('Access Denied', 'You do not have permission to access this page.');
        router.back();
      }
    }, [isAdmin, loading, router])
  );

  // Don't render content if not admin
  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </ThemedView>
    );
  }

  if (!isAdmin) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            getMinTouchTargetStyle(),
            { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
          ]}
          onPress={() => router.back()}
          activeOpacity={0.6}
          {...getButtonAccessibilityProps(
            'Go back',
            'Double tap to go back to the previous screen'
          )}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Admin
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <ThemedText style={[styles.welcomeText, { color: colors.text }]}>
            Admin Panel
          </ThemedText>
          <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
            This is the admin page. You can add admin functionality here.
          </ThemedText>

          {/* Merge Food Button */}
          <TouchableOpacity
            style={[
              styles.mergeFoodButton,
              getMinTouchTargetStyle(),
              {
                backgroundColor: colors.tint,
                ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
              },
            ]}
            onPress={() => {
              router.push('/merge-food');
            }}
            activeOpacity={0.8}
            {...getButtonAccessibilityProps(
              'Merge Food',
              'Double tap to merge food items'
            )}
          >
            <View style={styles.buttonContent}>
              <IconSymbol name="arrow.left.arrow.right" size={20} color="#fff" decorative={true} />
              <Text style={styles.mergeFoodButtonText}>Merge Food</Text>
            </View>
          </TouchableOpacity>

          {/* User 360 Button */}
          <TouchableOpacity
            style={[
              styles.mergeFoodButton,
              getMinTouchTargetStyle(),
              {
                backgroundColor: colors.tint,
                ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
              },
            ]}
            onPress={() => {
              router.push('/user-360');
            }}
            activeOpacity={0.8}
            {...getButtonAccessibilityProps(
              'User 360',
              'Double tap to view user profile'
            )}
          >
            <View style={styles.buttonContent}>
              <IconSymbol name="person.circle.fill" size={20} color="#fff" decorative={true} />
              <Text style={styles.mergeFoodButtonText}>User 360</Text>
            </View>
          </TouchableOpacity>

          {/* External Cache Food Promotion Button */}
          <TouchableOpacity
            style={[
              styles.mergeFoodButton,
              getMinTouchTargetStyle(),
              {
                backgroundColor: colors.tint,
                ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
              },
            ]}
            onPress={() => {
              router.push('/external-cache-food-promotion');
            }}
            activeOpacity={0.8}
            {...getButtonAccessibilityProps(
              'External Cache Food Promotion',
              'Double tap to promote external cache food items'
            )}
          >
            <View style={styles.buttonContent}>
              <IconSymbol name="arrow.up.circle.fill" size={20} color="#fff" decorative={true} />
              <Text style={styles.mergeFoodButtonText}>External Cache Food Promotion</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Platform.select({ web: 16, default: 16 }),
    paddingTop: Platform.select({ web: 30, default: Platform.OS === 'ios' ? 50 : 30 }),
    paddingBottom: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'var(--background)',
      },
      default: {
        backgroundColor: 'transparent',
      },
    }),
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  headerTitle: {
    fontSize: Platform.select({ web: 20, default: 18 }),
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    ...Platform.select({
      web: {
        minHeight: '100%',
      },
    }),
  },
  content: {
    width: '100%',
    maxWidth: 600,
    padding: Platform.select({ web: 16, default: 16 }),
    paddingTop: 32,
  },
  welcomeText: {
    fontSize: Platform.select({ web: 24, default: 22 }),
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: Platform.select({ web: 14, default: 14 }),
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
    marginBottom: 32,
  },
  mergeFoodButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(10, 126, 164, 0.25)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mergeFoodButtonText: {
    color: '#fff',
    fontSize: Platform.select({ web: 16, default: 16 }),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff0000',
  },
});

