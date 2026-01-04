import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

import { useTour } from '@/features/tour/TourProvider';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function TourOverlay() {
  const { activeTourId, steps, stepIndex, spotlightRect, back, next, skip, finish } = useTour();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width: screenW, height: screenH } = useWindowDimensions();

  const isVisible = activeTourId != null && steps.length > 0;
  const isLast = stepIndex >= steps.length - 1;
  const step = steps[stepIndex];

  const hole = useMemo(() => {
    if (!spotlightRect) return null;
    // Slightly asymmetric padding to avoid the hole bleeding into the next row (common on stacked cards).
    // `narrow` steps get a tighter frame (especially on the bottom).
    const padX = step?.narrow ? 8 : 10;
    const padTop = step?.narrow ? 8 : 10;
    // Some anchors (like the burned ✏️ tap target) visually relate to a label directly below;
    // give those steps a bit more bottom room so the spotlight covers the full concept.
    // Conversely, the curvy gauge step should stop tight at the divider line (no bleed into the next row).
    const padBottom =
      step?.anchorKey === 'home.curvyGauge'
        ? 0
        : step?.anchorKey === 'home.burnedPencil'
          ? 28
          : step?.narrow
            ? 4
            : 8;

    const x = clamp(spotlightRect.x - padX, 0, screenW);
    const y = clamp(spotlightRect.y - padTop, 0, screenH);
    const w = clamp(spotlightRect.width + padX * 2, 0, screenW - x);
    const h = clamp(spotlightRect.height + padTop + padBottom, 0, screenH - y);
    return { x, y, width: w, height: h };
  }, [screenH, screenW, spotlightRect, step?.narrow]);

  const tooltip = useMemo(() => {
    if (!hole) {
      return {
        top: Math.round(screenH * 0.2),
        left: Spacing.lg,
        maxWidth: screenW - Spacing.lg * 2,
        placement: 'floating' as const,
      };
    }

    const margin = Spacing.lg;
    const maxWidth = screenW - margin * 2;
    const desiredLeft = clamp(hole.x, margin, screenW - margin - Math.min(maxWidth, 360));
    const belowTop = hole.y + hole.height + 12;
    const aboveTop = hole.y - 12; // will subtract card height via transform-ish padding by choosing bottom
    const nearBottom = hole.y + hole.height > screenH * 0.62;

    if (nearBottom) {
      // place above: we don't know card height yet, so use bottom positioning
      const bottom = clamp(screenH - hole.y + 12, margin, screenH - margin);
      return {
        bottom,
        left: desiredLeft,
        maxWidth,
        placement: 'above' as const,
      };
    }

    const top = clamp(belowTop, margin, screenH - margin);
    return {
      top,
      left: desiredLeft,
      maxWidth,
      placement: 'below' as const,
    };
  }, [hole, screenH, screenW]);

  if (!isVisible) return null;

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={skip}
      statusBarTranslucent
    >
      <View style={styles.root} pointerEvents="auto">
        {/* Touch shield */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />

        {/* Dim background + spotlight hole via 4 blocks */}
        {hole ? (
          <>
            <View
              style={[
                styles.dimBlock,
                { backgroundColor: colors.overlay, left: 0, top: 0, right: 0, height: hole.y },
              ]}
            />
            <View
              style={[
                styles.dimBlock,
                {
                  backgroundColor: colors.overlay,
                  left: 0,
                  top: hole.y,
                  width: hole.x,
                  height: hole.height,
                },
              ]}
            />
            <View
              style={[
                styles.dimBlock,
                {
                  backgroundColor: colors.overlay,
                  left: hole.x + hole.width,
                  top: hole.y,
                  right: 0,
                  height: hole.height,
                },
              ]}
            />
            <View
              style={[
                styles.dimBlock,
                {
                  backgroundColor: colors.overlay,
                  left: 0,
                  top: hole.y + hole.height,
                  right: 0,
                  bottom: 0,
                },
              ]}
            />

            {/* Highlight border */}
            <View
              pointerEvents="none"
              style={[
                styles.holeBorder,
                {
                  left: hole.x,
                  top: hole.y,
                  width: hole.width,
                  height: hole.height,
                  borderColor: colors.tint,
                },
              ]}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
        )}

        {/* Tooltip */}
        <View
          style={[
            styles.tooltipCard,
            {
              ...(tooltip as any),
              backgroundColor: colors.card,
              borderColor: colors.border,
              ...(Platform.OS === 'web' ? (getFocusStyle(colors.tint) as any) : null),
              ...Shadows.lg,
            },
          ]}
          pointerEvents="auto"
        >
          <Text style={[styles.tooltipText, { color: colors.text }]}>{step?.message ?? ''}</Text>

          <View style={styles.controlsRow}>
            {stepIndex > 0 ? (
              <Pressable
                onPress={back}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  getMinTouchTargetStyle(),
                  { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                  pressed ? { opacity: 0.85 } : null,
                  Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
                ]}
                {...getButtonAccessibilityProps('Back')}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]} numberOfLines={1}>
                  Back
                </Text>
              </Pressable>
            ) : (
              <View style={{ width: 86 }} />
            )}

            <Pressable
              onPress={isLast ? finish : next}
              style={({ pressed }) => [
                styles.primaryButton,
                getMinTouchTargetStyle(),
                { backgroundColor: colors.tint },
                pressed ? { opacity: 0.85 } : null,
                Platform.OS === 'web' ? getFocusStyle(colors.textOnTint) : null,
              ]}
              {...getButtonAccessibilityProps(isLast ? 'Done' : 'Next')}
            >
              <Text style={[styles.primaryButtonText, { color: colors.textOnTint }]} numberOfLines={1}>
                {isLast ? 'Done' : 'Next'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.bottomRow}>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={skip}
              style={({ pressed }) => [
                styles.skipLink,
                getMinTouchTargetStyle(),
                pressed ? { opacity: 0.8 } : null,
                Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
              ]}
              {...getButtonAccessibilityProps('Skip tour')}
            >
              <Text style={[styles.skipText, { color: colors.textSecondary }]} numberOfLines={1}>
                Skip tour
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dimBlock: {
    position: 'absolute',
  },
  holeBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
  },
  tooltipCard: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxWidth: 420,
  },
  tooltipText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    lineHeight: Math.round(FontSize.base * 1.35),
  },
  controlsRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.sm,
  },
  primaryButton: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  secondaryButton: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minWidth: 86,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  bottomRow: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  skipLink: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  skipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});


