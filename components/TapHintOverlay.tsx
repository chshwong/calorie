import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type TapHintOverlayProps = {
  visible: boolean;
  targetRect: { x: number; y: number; width: number; height: number } | null;
};

export function TapHintOverlay({ visible, targetRect }: TapHintOverlayProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible || !targetRect) {
      animationRef.current?.stop();
      translateY.setValue(0);
      scale.setValue(1);
      opacity.setValue(0);
      return;
    }

    translateY.setValue(0);
    scale.setValue(1);
    opacity.setValue(0);

    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    const tapLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 8,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.92,
            duration: 220,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(900),
      ]),
      { resetBeforeIteration: true }
    );

    animationRef.current = tapLoop;
    tapLoop.start();

    return () => {
      animationRef.current?.stop();
    };
  }, [opacity, scale, targetRect, translateY, visible]);

  if (!visible || !targetRect) return null;

  const left = targetRect.x + targetRect.width * 0.6;
  const top = targetRect.y + targetRect.height * 0.35;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.tapHint,
          {
            left,
            top,
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <Text style={styles.tapHintIcon}>👆</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tapHint: {
    position: 'absolute',
    zIndex: 10,
  },
  tapHintIcon: {
    fontSize: 24,
  },
});
