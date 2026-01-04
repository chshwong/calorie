import React, { useEffect } from 'react';
import { Modal, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

// Conditional import for confetti (native only)
let ConfettiCannon: any = null;
if (Platform.OS !== 'web') {
  try {
    ConfettiCannon = require('react-native-confetti-cannon').default;
  } catch (e) {
    // Package not installed or unavailable; handled gracefully.
  }
}

type Props = {
  /** Toggle this true to fire once; parent should turn it back off. */
  visible: boolean;
  onDone: () => void;
};

export function ConfettiBurst({ visible, onDone }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    if (!visible) return;

    if (Platform.OS === 'web') {
      (async () => {
        try {
          const confettiModule = await import('canvas-confetti');
          const confettiFn = confettiModule.default || confettiModule;
          if (typeof confettiFn === 'function') {
            confettiFn({ particleCount: 70, spread: 70, origin: { y: 0.25 } });
            setTimeout(() => {
              confettiFn({ particleCount: 45, spread: 90, origin: { y: 0.25 } });
            }, 220);
          }
        } catch (e) {
          // canvas-confetti not available; skip quietly
        } finally {
          setTimeout(onDone, 650);
        }
      })();
      return;
    }

    // Native: let the cannon run briefly, then dismiss.
    const timer = setTimeout(onDone, 900);
    return () => clearTimeout(timer);
  }, [onDone, visible]);

  if (!visible) return null;

  // Native-only visual: web uses canvas-confetti.
  if (Platform.OS === 'web' || !ConfettiCannon) {
    return null;
  }

  return (
    <Modal visible={true} transparent animationType="none" onRequestClose={() => {}}>
      <View style={styles.container} pointerEvents="none">
        <ConfettiCannon
          count={160}
          origin={{ x: screenWidth / 2, y: 0 }}
          fadeOut={true}
          autoStart={true}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    pointerEvents: 'none',
  },
});


