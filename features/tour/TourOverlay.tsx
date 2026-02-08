import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';

import { BorderRadius, Colors, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

import BrandLogoMascotOnly from '@/components/brand/BrandLogoMascotOnly';
import { useTour } from '@/features/tour/TourProvider';
import { useTranslation } from 'react-i18next';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function TourOverlay() {
  const { activeTourId, steps, stepIndex, spotlightRect, back, next, skip, finish } = useTour();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width: screenW, height: screenH } = useWindowDimensions();

  const isVisible = activeTourId != null && steps.length > 0;
  const isLast = stepIndex >= steps.length - 1;
  const step = steps[stepIndex];
  const showSpotlight = step?.spotlight !== false;
  const overlayOpacity = step?.overlayOpacity ?? 1;
  const [tooltipHeight, setTooltipHeight] = useState<number>(0);
  const stepMessage = step?.messageKey ? t(step.messageKey) : '';

  const containerType =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? String((window as any).__AVOVIBE_CONTAINER__?.type ?? '')
      : '';
  const isNativeWrapperWeb = Platform.OS === 'web' && (containerType === 'native' || containerType === 'native_onboarding');

  useEffect(() => {
    if (!isNativeWrapperWeb || typeof window === 'undefined') return;
    (window as any).ReactNativeWebView?.postMessage?.(
      JSON.stringify({ type: 'TOUR_ACTIVE', active: isVisible })
    );
  }, [isNativeWrapperWeb, isVisible]);

  useEffect(() => {
    if (!isNativeWrapperWeb || typeof window === 'undefined') return;

    const handleMessage = (event: any) => {
      const raw = event?.data != null ? String(event.data) : '';
      if (!raw) return;
      let msg: any = null;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg?.type === 'NATIVE_TOUR_BACK') {
        if (!isVisible || stepIndex <= 0) {
          (window as any).ReactNativeWebView?.postMessage?.(
            JSON.stringify({ type: 'NATIVE_TOUR_BACK_RESULT', handled: false })
          );
          return;
        }

        back();
        (window as any).ReactNativeWebView?.postMessage?.(
          JSON.stringify({ type: 'NATIVE_TOUR_BACK_RESULT', handled: true })
        );
        return;
      }

      if (msg?.type === 'NATIVE_TOUR_EXIT') {
        skip();
        (window as any).ReactNativeWebView?.postMessage?.(
          JSON.stringify({ type: 'TOUR_ACTIVE', active: false })
        );
      }
    };

    window.addEventListener('message', handleMessage);
    if (typeof document !== 'undefined') {
      document.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (typeof document !== 'undefined') {
        document.removeEventListener('message', handleMessage);
      }
    };
  }, [back, isNativeWrapperWeb, isVisible, skip, stepIndex]);

  // Subtle "breathing" pulse for the spotlight border (visual-only; does not affect measurement).
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isVisible) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isVisible, pulse]);

  const borderOpacity = useMemo(
    () => pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
    [pulse]
  );
  const borderScale = useMemo(
    () => pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }),
    [pulse]
  );

  const hole = useMemo(() => {
    // Centered steps intentionally have no spotlight.
    if (step?.placement === 'center') return null;
    if (!spotlightRect) return null;
    // Slightly asymmetric padding to avoid the hole bleeding into the next row (common on stacked cards).
    // `narrow` steps get a tighter frame (especially on the bottom).
    const padX =
      step?.anchorKey === 'home.burnedPencil'
        ? 18
        : step?.anchorKey === 'mealtype.quickLogTab'
          ? 16
          : step?.narrow
            ? 8
            : 10;
    const padTop =
      step?.anchorKey === 'mealtype.quickLogPanel'
        ? 68
        : step?.narrow
          ? 8
          : 10;
    // Some anchors (like the burned ✏️ tap target) visually relate to a label directly below;
    // give those steps a bit more bottom room so the spotlight covers the full concept.
    // Conversely, the curvy gauge step should stop tight at the divider line (no bleed into the next row).
    const padBottom =
      step?.anchorKey === 'home.curvyGauge'
        ? 0
        : step?.anchorKey === 'home.burnedPencil'
          ? 44
          : step?.anchorKey === 'mealtype.quickLogTab'
            ? 16
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
    const margin = Spacing.lg;
    const maxWidth = screenW - margin * 2;
    const cardH = tooltipHeight > 0 ? tooltipHeight : 220; // conservative fallback before first layout
    const offsetY = step?.offsetY ?? 0;

    if (step?.placement === 'center') {
      const top = clamp(Math.round(screenH / 2 - cardH / 2), margin, screenH - margin - cardH);
      return {
        top,
        left: margin,
        maxWidth,
        placement: 'center' as const,
      };
    }

    if (!hole) {
      return {
        top: Math.round(screenH * 0.2),
        left: Spacing.lg,
        maxWidth: screenW - Spacing.lg * 2,
        placement: 'floating' as const,
      };
    }

    const desiredLeft = clamp(hole.x, margin, screenW - margin - Math.min(maxWidth, 360));
    const belowTop = hole.y + hole.height + 12;
    const nearBottom = hole.y + hole.height > screenH * 0.62;

    if (step?.placement === 'bottom') {
      const top = clamp(belowTop + offsetY, margin, screenH - margin - cardH);
      return {
        top,
        left: desiredLeft,
        maxWidth,
        placement: 'below' as const,
      };
    }

    if (step?.placement === 'top') {
      const top = clamp(hole.y - 12 - cardH + offsetY, margin, screenH - margin - cardH);
      return {
        top,
        left: desiredLeft,
        maxWidth,
        placement: 'above' as const,
      };
    }

    // Special-case: Mealtype log anchors can be very tall, which tends to push the tooltip above
    // and block key UI. Force a stable mid/lower placement and keep the caret pointing upward.
    if (activeTourId === 'V1_MealtypeLogTour' && step?.anchorKey === 'mealtype.root') {
      const top = clamp(Math.round(screenH * 0.44), margin, screenH - margin - cardH);
      return {
        top,
        left: desiredLeft,
        maxWidth,
        placement: 'below' as const,
      };
    }

    if (activeTourId === 'V1_MealtypeLogTour' && step?.anchorKey === 'mealtype.tabsAndList') {
      const top = clamp(Math.round(screenH * 0.58), margin, screenH - margin - cardH);
      return {
        top,
        left: desiredLeft,
        maxWidth,
        placement: 'below' as const,
      };
    }

    if (nearBottom) {
      // place above: clamp using measured card height so it never renders off-screen
      const top = clamp(hole.y - 12 - cardH, margin, screenH - margin - cardH);
      return {
        top,
        left: desiredLeft,
        maxWidth,
        placement: 'above' as const,
      };
    }

    const top = clamp(belowTop + offsetY, margin, screenH - margin - cardH);
    return {
      top,
      left: desiredLeft,
      maxWidth,
      placement: 'below' as const,
    };
  }, [activeTourId, hole, screenH, screenW, step?.anchorKey, step?.offsetY, step?.placement, tooltipHeight]);

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

        {/* Dim background + spotlight hole via 4 blocks (skipped for centered steps) */}
        {hole && showSpotlight ? (
          <>
            <View
              style={[
                styles.dimBlock,
                { backgroundColor: colors.overlay, left: 0, top: 0, right: 0, height: hole.y, opacity: overlayOpacity },
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
                  opacity: overlayOpacity,
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
                  opacity: overlayOpacity,
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
                  opacity: overlayOpacity,
                },
              ]}
            />

            {/* Highlight border */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.holeBorder,
                {
                  left: hole.x,
                  top: hole.y,
                  width: hole.width,
                  height: hole.height,
                  borderColor: colors.tint,
                  opacity: borderOpacity,
                  transform: [{ scale: borderScale }],
                },
              ]}
            />
          </>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.overlay, opacity: overlayOpacity },
            ]}
          />
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
          onLayout={(e) => {
            const h = e?.nativeEvent?.layout?.height ?? 0;
            if (h > 0 && Math.abs(h - tooltipHeight) > 1) setTooltipHeight(h);
          }}
        >
          {/* Caret pointer */}
          {tooltip.placement === 'below' ? (
            <View style={[styles.caret, styles.caretTop, { backgroundColor: colors.card }]} />
          ) : tooltip.placement === 'above' ? (
            <View style={[styles.caret, styles.caretBottom, { backgroundColor: colors.card }]} />
          ) : null}

          {/* Header + step progress */}
          <View style={styles.tooltipHeader}>
            <View
              style={styles.tooltipHeaderMascot}
              accessibilityElementsHidden={true}
              importantForAccessibility="no-hide-descendants"
            >
              <BrandLogoMascotOnly width={36} height={36} />
            </View>
            <Text style={[styles.tooltipHeaderTitle, { color: colors.text }]} numberOfLines={1}>
              {t('tour.overlay.title')}
            </Text>
            <Text style={[styles.tooltipHeaderCounter, { color: colors.textSecondary }]} numberOfLines={1}>
              {stepIndex + 1} / {steps.length}
            </Text>
          </View>

          <Text style={[styles.tooltipText, { color: colors.text }]}>{stepMessage}</Text>

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
                {...getButtonAccessibilityProps(t('common.back'))}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]} numberOfLines={1}>
                  {t('common.back')}
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
              {...getButtonAccessibilityProps(isLast ? t('common.done') : t('common.next'))}
            >
              <Text style={[styles.primaryButtonText, { color: colors.textOnTint }]} numberOfLines={1}>
                {isLast ? t('common.done') : t('common.next')}
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
              {...getButtonAccessibilityProps(t('tour.overlay.skip'))}
            >
              <Text style={[styles.skipText, { color: colors.textSecondary }]} numberOfLines={1}>
                {t('tour.overlay.skip')}
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
    backgroundColor: 'transparent',
  },
  tooltipCard: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxWidth: 420,
    overflow: 'visible',
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tooltipHeaderIcon: {
    fontSize: FontSize.base,
    marginRight: 4,
  },
  tooltipHeaderMascot: {
    marginRight: 6,
  },
  tooltipHeaderTitle: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  tooltipHeaderCounter: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  tooltipText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    lineHeight: Math.round(FontSize.base * 1.35),
  },
  caret: {
    position: 'absolute',
    width: 12,
    height: 12,
    left: '50%',
    marginLeft: -6,
    transform: [{ rotate: '45deg' }],
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 6,
      },
    }),
  },
  caretTop: {
    top: -6,
  },
  caretBottom: {
    bottom: -6,
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


