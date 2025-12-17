import React from 'react';
import { Animated, Easing } from 'react-native';
import { ThemedText } from '@/components/themed-text';

type TapToExpandHintProps = {
  text: string;
  textColor: string;
};

export function TapToExpandHint({ text, textColor }: TapToExpandHintProps) {
  const translateY = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -4, // move up a bit
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0, // return to original position
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [translateY]);

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <ThemedText
        style={{
          textAlign: 'center',
          color: textColor,
          fontSize: 11,
          marginRight: 6,
        }}
      >
        {text}
      </ThemedText>
    </Animated.View>
  );
}

