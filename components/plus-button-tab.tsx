/**
 * PlusButtonTab - Custom tab button that renders as a + button instead of a normal tab
 *
 * Used for the meds/Supps tab to transform it into a + button.
 * [Web only] Session-limited double-pulse animation (max 2 events per session, respects reduced motion).
 */

import PitDarkPng from '@/assets/brand/Logo_DarkMode_PitwithPlus.png';
import PitDarkSvg from '@/assets/brand/Logo_DarkMode_PitwithPlus.svg';
import PitLightPng from '@/assets/brand/Logo_LightMode_PitwithPLUS.png';
import PitLightSvg from '@/assets/brand/Logo_LightMode_PitwithPlus.svg';
import { Colors } from '@/constants/theme';
import { useQuickAdd } from '@/contexts/quick-add-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getFocusStyle } from '@/utils/accessibility';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

const FAB_SIZE = 52;
const FAB_PULSE_STORAGE_KEY = 'avovibe_fab_pulse_count_v1';
const PULSE_CLASS = 'avovibeFabPulse';
const PULSE_ANIMATION_MS = 2000; // ~2 seconds per pulse
const PULSE_CLASS_REMOVE_MS = 1650;

/** Web only: prefers-reduced-motion media query. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduced(mq.matches);
    const listener = () => setReduced(mq.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  return reduced;
}

/** Web only: inject FAB double-pulse keyframes into document head. */
function useInjectFabPulseStyles(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'avovibe-fab-pulse-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
@keyframes avovibeFabDoublePulse {
  0%   { transform: translateZ(0) scale(1); }
  12%  { transform: translateZ(0) scale(1.06); }
  24%  { transform: translateZ(0) scale(1); }
  40%  { transform: translateZ(0) scale(1.045); }
  52%  { transform: translateZ(0) scale(1); }
  100% { transform: translateZ(0) scale(1); }
}
.${PULSE_CLASS} {
  animation: avovibeFabDoublePulse ${PULSE_ANIMATION_MS}ms ease-out 0s 1;
  transform-origin: center;
  will-change: transform;
}
`;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(id);
      if (el?.parentNode) el.parentNode.removeChild(el);
    };
  }, []);
}

type Props = BottomTabBarButtonProps & {
  tourAnchorRef?: React.Ref<any>;
};

export function PlusButtonTab(props: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const activeColor = colors.tint;
  const { setQuickAddVisible } = useQuickAdd();
  const isDark = colorScheme === 'dark';

  const fabRef = useRef<View>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useInjectFabPulseStyles();

  useEffect(() => {
    if (Platform.OS !== 'web' || prefersReducedMotion) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;

    const getCount = () => Number(window.sessionStorage.getItem(FAB_PULSE_STORAGE_KEY) || '0');
    const setCount = (n: number) => window.sessionStorage.setItem(FAB_PULSE_STORAGE_KEY, String(n));
    const randomDelayMs = () => 3000 + Math.floor(Math.random() * 5000); // 5–10 s

    const triggerPulse = () => {
      const count = getCount();
      if (count >= 2) return;
      // react-native-web forwards ref to the host DOM element (the div for View).
      const el = fabRef.current as unknown as HTMLElement | null;
      if (!el?.classList) return;

      el.classList.remove(PULSE_CLASS);
      void el.offsetWidth;
      el.classList.add(PULSE_CLASS);
      window.setTimeout(() => el.classList.remove(PULSE_CLASS), PULSE_CLASS_REMOVE_MS);

      const nextCount = count + 1;
      setCount(nextCount);
      if (nextCount < 2) {
        pulseTimerRef.current = window.setTimeout(triggerPulse, randomDelayMs());
      }
    };

    pulseTimerRef.current = window.setTimeout(triggerPulse, randomDelayMs());

    return () => {
      if (pulseTimerRef.current) {
        window.clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    };
  }, [prefersReducedMotion]);

  // Select the correct mascot asset based on theme
  const PitSvg = isDark ? PitDarkSvg : PitLightSvg;
  const pitPng = isDark ? PitDarkPng : PitLightPng;

  return (
    <Pressable
      onPress={() => setQuickAddVisible(true)}
      ref={props.tourAnchorRef}
      style={({ pressed }) => [
        styles.plusButtonContainer,
        pressed && styles.plusButtonPressed,
        Platform.OS === 'web' && getFocusStyle(activeColor),
      ]}
      {...getButtonAccessibilityProps(
        'Add',
        'Double tap to add new item',
        false
      )}
    >
      <View
        ref={fabRef}
        style={[styles.plusButton, { backgroundColor: activeColor }]}
        pointerEvents="box-none"
      >
        {Platform.OS !== 'web' || true ? (
          <PitSvg width={FAB_SIZE} height={FAB_SIZE} />
        ) : (
          <Image source={pitPng} style={{ width: FAB_SIZE, height: FAB_SIZE }} resizeMode="contain" />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plusButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 13,
    paddingHorizontal: 4,
    minHeight: 60,
  },
  plusButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  plusButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    overflow: 'hidden',
  },
});

