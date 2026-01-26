import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

export interface ConfirmModalProps {
  /**
   * Controls the visibility of the modal
   */
  visible: boolean;
  
  /**
   * Title text displayed at the top of the modal
   */
  title: string;
  
  /**
   * Message text or custom body content displayed in the modal
   */
  message: React.ReactNode;
  
  /**
   * Text for the confirm/primary button (default: "Yes")
   */
  confirmText?: string;
  
  /**
   * Text for the cancel/secondary button (default: "No")
   * Set to empty string or null to hide the cancel button (single-button mode)
   */
  cancelText?: string | null;
  
  /**
   * Callback function when the confirm button is pressed
   */
  onConfirm: () => void;
  
  /**
   * Callback function when the cancel button is pressed or modal is dismissed
   */
  onCancel: () => void;
  
  /**
   * Optional: Custom confirm button style
   */
  confirmButtonStyle?: object;
  
  /**
   * Optional: Custom cancel button style
   */
  cancelButtonStyle?: object;

  /**
   * Optional: Custom cancel button text style (useful when cancelButtonStyle sets a light background)
   */
  cancelTextStyle?: StyleProp<TextStyle>;
  
  /**
   * Optional: Whether the confirm button is disabled
   */
  confirmDisabled?: boolean;
  
  /**
   * Optional: Animation type for modal (default: "fade")
   */
  animationType?: 'none' | 'slide' | 'fade';
}

/**
 * Reusable confirmation modal component for the app.
 * Provides a consistent pop-up dialog for confirmations across the application.
 * Works seamlessly on web, iOS, and Android.
 * 
 * @example
 * ```tsx
 * const [showConfirm, setShowConfirm] = useState(false);
 * 
 * <ConfirmModal
 *   visible={showConfirm}
 *   title="Delete Item"
 *   message="Are you sure you want to delete this item?"
 *   confirmText="Delete"
 *   cancelText="Cancel"
 *   onConfirm={() => {
 *     // Handle confirmation
 *     setShowConfirm(false);
 *   }}
 *   onCancel={() => setShowConfirm(false)}
 * />
 * ```
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Yes',
  cancelText = 'No',
  onConfirm,
  onCancel,
  confirmButtonStyle,
  cancelButtonStyle,
  cancelTextStyle,
  confirmDisabled = false,
  animationType = 'fade',
}: ConfirmModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType={animationType}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        {/* Backdrop layer (sibling, avoids nested <button> on web) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} disabled={confirmDisabled} accessible={false} />

        <TouchableWithoutFeedback>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ThemedText type="title" style={styles.modalTitle}>
              {title}
            </ThemedText>
            {typeof message === 'string' ? (
              <ThemedText style={[styles.modalMessage, { color: colors.text }]}>
                {message}
              </ThemedText>
            ) : (
              <View style={styles.modalMessageContainer}>{message}</View>
            )}
            <View style={styles.modalButtons}>
              {cancelText && (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonCancel,
                    { borderColor: colors.border },
                    getMinTouchTargetStyle(),
                    cancelButtonStyle,
                    ...(Platform.OS === 'web' ? [getFocusStyle(colors.tint)] : []),
                  ]}
                  onPress={onCancel}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(
                    cancelText,
                    `Cancel ${title.toLowerCase()}`
                  )}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      {
                        color: cancelButtonStyle?.backgroundColor ? '#fff' : colors.text,
                      },
                      cancelTextStyle,
                    ]}
                  >
                    {cancelText}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  {
                    backgroundColor: colors.tint,
                    opacity: confirmDisabled ? 0.6 : 1,
                    ...(cancelText ? {} : { flex: 1 }), // Full width if no cancel button
                  },
                  getMinTouchTargetStyle(),
                  confirmButtonStyle,
                  ...(Platform.OS === 'web' ? [getFocusStyle('#fff')] : []),
                ]}
                onPress={onConfirm}
                disabled={confirmDisabled}
                activeOpacity={0.7}
                {...getButtonAccessibilityProps(
                  confirmText,
                  `Confirm ${title.toLowerCase()}`
                )}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalMessageContainer: {
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      },
    }),
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  modalButtonConfirm: {
    // backgroundColor set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#fff',
  },
});

