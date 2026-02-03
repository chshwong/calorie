/**
 * Popover - Reusable anchored overlay
 *
 * Renders children in an overlay, positioned relative to an anchor element.
 * Click outside or ESC closes. Use for emoji pickers, dropdown menus, etc.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getMinTouchTargetStyle } from '@/utils/accessibility';

export type PopoverPlacement = 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';

export type PopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<View | null>;
  children: React.ReactNode;
  placement?: PopoverPlacement;
};

export function Popover({
  isOpen,
  onClose,
  anchorRef,
  children,
  placement = 'bottom-end',
}: PopoverProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [anchorRect, setAnchorRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const popoverRef = useRef<View>(null);

  const measureAnchor = useCallback(() => {
    if (!anchorRef.current || !isOpen) return;
    anchorRef.current.measureInWindow((x, y, width, height) => {
      setAnchorRect({ x, y, width, height });
    });
  }, [anchorRef, isOpen]);

  useEffect(() => {
    if (isOpen) {
      measureAnchor();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
      }
    } else {
      setAnchorRect(null);
    }
  }, [isOpen, onClose, measureAnchor]);

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleBackdropPress}
        accessibilityRole="button"
        accessibilityLabel="Close"
        accessibilityElementsHidden={false}
      />
      {anchorRect && (
        <View
          ref={popoverRef}
          style={[
            styles.popover,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              ...getPopoverPosition(anchorRect, placement),
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {children}
        </View>
      )}
    </Modal>
  );
}

function getPopoverPosition(
  anchor: { x: number; y: number; width: number; height: number },
  placement: PopoverPlacement
): { top: number; left?: number; right?: number } {
  const gap = 4;
  const [vertical, horizontal] = placement.split('-');
  const screenWidth = Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerWidth : Dimensions.get('window').width;

  let top: number;
  if (vertical === 'bottom') {
    top = anchor.y + anchor.height + gap;
  } else {
    top = anchor.y - 100 - gap; // Approximate popover height
  }

  let left: number | undefined;
  let right: number | undefined;
  if (horizontal === 'end') {
    right = Math.max(8, screenWidth - (anchor.x + anchor.width));
  } else {
    left = Math.max(8, anchor.x);
  }

  return { top, left, right };
}

const styles = StyleSheet.create({
  popover: {
    position: 'absolute',
    minWidth: 120,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.sm,
    ...Shadows.medium,
    zIndex: 9999,
  },
});
