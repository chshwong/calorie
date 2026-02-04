import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../theme/tokens";
import { useColorScheme } from "../useColorScheme";

type StepIndicatorProps = {
  activeStep: number;
  totalSteps: number;
};

export function StepIndicator({ activeStep, totalSteps }: StepIndicatorProps) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const steps = Array.from({ length: totalSteps }, (_, idx) => idx + 1);

  return (
    <View style={styles.container}>
      {steps.map((step) => {
        const isActive = step === activeStep;
        return (
          <View
            key={step}
            style={[
              styles.dot,
              {
                backgroundColor: isActive ? theme.primary : theme.border,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
