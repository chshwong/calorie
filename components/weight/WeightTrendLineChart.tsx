import { ThemedText } from '@/components/themed-text';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  values: number[]; // NaN = missing
  labelIndices: number[]; // indices into values to label
  getLabel: (index: number) => string;
  height?: number;
};

export function WeightTrendLineChart({ values, labelIndices, getLabel, height = 200 }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [width, setWidth] = useState(0);

  const chart = useMemo(() => {
    const DOT_R = 5;
    const PAD_X = DOT_R + 2;
    const PAD_Y_TOP = DOT_R + 2;
    const PAD_Y_BOTTOM = DOT_R + 10;

    const n = values.length;
    const denom = Math.max(1, n - 1);

    const finite = values.filter((v) => Number.isFinite(v));
    if (finite.length < 2) {
      return {
        hasSufficientPoints: false,
        DOT_R,
        PAD_X,
        PAD_Y_TOP,
        PAD_Y_BOTTOM,
        minY: 0,
        maxY: 1,
        pathD: '',
        points: [] as Array<{ x: number; y: number }>,
      };
    }

    const minY = Math.min(...finite);
    const maxY = Math.max(...finite);
    const span = Math.max(1e-6, maxY - minY);

    const usableWidth = Math.max(0, width - PAD_X * 2);
    const usableHeight = Math.max(0, height - PAD_Y_TOP - PAD_Y_BOTTOM);

    const points = values
      .map((v, i) => {
        if (!Number.isFinite(v)) return null;
        const x = PAD_X + (i / denom) * usableWidth;
        const y = PAD_Y_TOP + ((maxY - v) / span) * usableHeight;
        return { x, y };
      })
      .filter((p): p is { x: number; y: number } => p !== null);

    const pathD =
      points.length > 0 ? points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : '';

    return {
      hasSufficientPoints: true,
      DOT_R,
      PAD_X,
      PAD_Y_TOP,
      PAD_Y_BOTTOM,
      minY,
      maxY,
      pathD,
      points,
    };
  }, [height, values, width]);

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w && Number.isFinite(w)) setWidth(w);
      }}
    >
      {width > 0 && chart.hasSufficientPoints ? (
        <>
          <Svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            // Allow horizontal swipes on the carousel to pass through the SVG on web + native.
            pointerEvents="none"
          >
            <Path d={chart.pathD} fill="none" stroke={colors.tint} strokeWidth={2} />
            {chart.points.map((p, idx) => (
              <Circle key={idx} cx={p.x} cy={p.y} r={chart.DOT_R} stroke={colors.tint} strokeWidth={2} fill={colors.tint} />
            ))}
          </Svg>

          <View
            style={[styles.labelsLayer, { width }]}
            // Allow horizontal swipes on the carousel to pass through the label layer too.
            pointerEvents="none"
          >
            {labelIndices.map((idx) => {
              if (idx < 0 || idx >= values.length) return null;
              const x =
                values.length <= 1
                  ? 0
                  : chart.PAD_X + (idx / Math.max(1, values.length - 1)) * Math.max(0, width - chart.PAD_X * 2);
              const text = getLabel(idx);
              if (!text) return null;
              return (
                <View key={idx} style={[styles.labelItem, { left: x }]}>
                  <ThemedText style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>{text}</ThemedText>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <ThemedText style={{ color: colors.textSecondary }}>Add at least 2 weigh-ins to see a trend.</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  labelsLayer: {
    position: 'relative',
    height: FontSize.sm + Spacing.sm,
    marginTop: Spacing.xs,
  },
  labelItem: {
    position: 'absolute',
    bottom: 0,
    transform: [{ translateX: -6 }],
  },
});


