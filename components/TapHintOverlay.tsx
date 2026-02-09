import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type TapHintOverlayProps = {
  visible: boolean;
  targetRect: { x: number; y: number; width: number; height: number } | null;
  durationMs?: number;
};

export function TapHintOverlay({ visible, targetRect, durationMs }: TapHintOverlayProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    if (!visible || !targetRect) {
      animationRef.current?.stop();
      translateY.setValue(0);
      scale.setValue(1);
      opacity.setValue(0);
      setIsTimedOut(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    translateY.setValue(0);
    scale.setValue(1);
    opacity.setValue(0);
    setIsTimedOut(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

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

    if (typeof durationMs === 'number' && durationMs > 0) {
      timeoutRef.current = setTimeout(() => {
        animationRef.current?.stop();
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setIsTimedOut(true);
        });
      }, durationMs);
    }

    return () => {
      animationRef.current?.stop();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [durationMs, opacity, scale, targetRect, translateY, visible]);

  if (!visible || !targetRect || isTimedOut) return null;

  const left = targetRect.x + targetRect.width * 0.6;
  const top = targetRect.y + targetRect.height * 0.55;

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
