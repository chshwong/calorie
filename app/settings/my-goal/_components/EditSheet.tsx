import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DesktopPageContainer } from '@/components/layout/desktop-page-container';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { showAppToast } from '@/components/ui/app-toast';
import { getButtonAccessibilityProps, AccessibilityHints, getIconAccessibilityProps } from '@/utils/accessibility';

interface EditSheetProps {
  title: string;
  children: React.ReactNode;
  hideHeader?: boolean;
  onCancel: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
  showBack?: boolean;
  onBack?: () => void;
  saveButtonText?: string;
  showNext?: boolean;
  onNext?: () => void;
  canSave?: boolean;
  // Bottom bar props
  showBottomBar?: boolean;
  bottomBarCancelText?: string;
  bottomBarPrimaryText?: string;
  // Scroll to top when this key changes (e.g. subStepIndex for multi-step flows)
  scrollToTopKey?: string | number;
}

function EditSheet({
  title,
  children,
  hideHeader = false,
  onCancel,
  onSave,
  saving,
  showBack = false,
  onBack,
  saveButtonText = 'Save',
  showNext = false,
  onNext,
  canSave = true,
  showBottomBar = true,
  bottomBarCancelText = 'Cancel',
  bottomBarPrimaryText,
  scrollToTopKey,
}: EditSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to top on mount and when scrollToTopKey changes
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: false });
    }
  }, [scrollToTopKey]);

  const handleSave = async () => {
    try {
      await onSave();
      onCancel(); // Close modal after successful save
    } catch (error) {
      console.error('Error saving:', error);
      // Error handling is done in the parent component
    }
  };

  return (
    <ThemedView style={styles.container}>
      {!hideHeader && (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {/* Left: X icon */}
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={onCancel}
            disabled={saving}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps('Close', AccessibilityHints.CLOSE, saving)}
          >
            <IconSymbol 
              name="xmark" 
              size={24} 
              color={colors.text}
              {...getIconAccessibilityProps('Close', false)}
            />
          </TouchableOpacity>
          
          {/* Center: Title (truncates) */}
          <View style={styles.headerCenter}>
            <ThemedText 
              type="title" 
              style={[styles.headerTitle, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </ThemedText>
          </View>
          
          {/* Right: Spacer for balance */}
          <View style={styles.headerRight} />
        </View>
      )}

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContentContainer,
          showBottomBar && { paddingBottom: 80 }, // Space for bottom bar
        ]}
        showsVerticalScrollIndicator={false}
      >
        <DesktopPageContainer>
          <View style={styles.contentContainer}>
            {children}
          </View>
        </DesktopPageContainer>
      </ScrollView>

      {/* Bottom Action Bar */}
      {showBottomBar && (
        <View style={[styles.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.bottomBarButton, styles.bottomBarCancel, { borderColor: colors.border }]}
            onPress={onCancel}
            disabled={saving}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(bottomBarCancelText, AccessibilityHints.CLOSE, saving)}
          >
            <ThemedText style={[styles.bottomBarCancelText, { color: colors.text }]}>
              {bottomBarCancelText}
            </ThemedText>
          </TouchableOpacity>

          {showBack && onBack && (
            <TouchableOpacity
              style={[styles.bottomBarButton, styles.bottomBarBack, { borderColor: colors.border }]}
              onPress={onBack}
              disabled={saving}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps('Back', AccessibilityHints.BACK, saving)}
            >
              <ThemedText style={[styles.bottomBarBackText, { color: colors.text }]}>
                Back
              </ThemedText>
            </TouchableOpacity>
          )}

          {showNext && onNext ? (
            <TouchableOpacity
              style={[
                styles.bottomBarButton,
                styles.bottomBarPrimary,
                { backgroundColor: colors.tint },
                (!canSave || saving) && styles.bottomBarButtonDisabled,
              ]}
              onPress={onNext}
              disabled={!canSave || saving}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(bottomBarPrimaryText || 'Next', AccessibilityHints.BUTTON, !canSave || saving)}
            >
              <ThemedText style={[styles.bottomBarPrimaryText, { color: '#fff' }]}>
                {bottomBarPrimaryText || 'Next'}
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.bottomBarButton,
                styles.bottomBarPrimary,
                { backgroundColor: colors.tint },
                (!canSave || saving) && styles.bottomBarButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!canSave || saving}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(bottomBarPrimaryText || saveButtonText, AccessibilityHints.SUBMIT, !canSave || saving)}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={[styles.bottomBarPrimaryText, { color: '#fff' }]}>
                  {bottomBarPrimaryText || saveButtonText}
                </ThemedText>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.select({ web: 20, default: 50 }),
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  headerRight: {
    width: 44, // Fixed width to balance left icon
  },
  content: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    ...Platform.select({
      web: {
        minHeight: '100%',
      },
    }),
  },
  contentContainer: {
    width: '100%',
    paddingTop: Spacing.none,
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.screenPadding,
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 0, // DesktopPageContainer handles horizontal padding
    }),
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Platform.select({ web: Spacing.md, default: Spacing.md + 20 }), // Safe area on mobile
    borderTopWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  bottomBarButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  bottomBarCancel: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  bottomBarBack: {
    borderWidth: 1,
    backgroundColor: 'transparent',
    flex: 0,
  },
  bottomBarPrimary: {
    marginLeft: 'auto',
    flex: 0,
  },
  bottomBarButtonDisabled: {
    opacity: 0.6,
  },
  bottomBarCancelText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  bottomBarBackText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  bottomBarPrimaryText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
});

export default EditSheet;
