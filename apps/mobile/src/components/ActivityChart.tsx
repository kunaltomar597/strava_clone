import { useState } from "react";
import { Text, View } from "react-native";
import { Circle } from "@shopify/react-native-skia";
import { CartesianChart, Line, useChartPressState } from "victory-native";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { useTheme } from "@/theme/useTheme";
import { typeScale } from "@/theme/tokens";
import { formatElevation, formatPace } from "@/lib/format";

export interface ActivityChartPoint extends Record<string, number> {
  distanceKm: number;
  elevationM: number;
  paceMps: number;
}

export interface ActivityChartProps {
  data: ActivityChartPoint[];
  metric: "elevation" | "pace";
  height?: number;
}

/**
 * A single scrubbable chart (elevation or pace vs. distance), per Phase 5's
 * "pace and elevation charts with scrubbing". The touch dot itself is pure
 * Skia (no JS thread involved); the numeric readout above the chart uses
 * `useAnimatedReaction` + `runOnJS` to mirror the touched point into React
 * state only when it actually changes, which is the standard way to bridge
 * a Reanimated shared value into a text label without re-rendering per frame.
 *
 * Both y keys are always tracked (rather than swapping the pressed key by
 * `metric`) so `useChartPressState`'s generic type stays a single fixed
 * shape — simpler and more type-safe than trying to key it dynamically.
 */
export function ActivityChart({ data, metric, height = 180 }: ActivityChartProps) {
  const { colors } = useTheme();
  const { state, isActive } = useChartPressState({ x: 0, y: { elevationM: 0, paceMps: 0 } });
  const [label, setLabel] = useState<string | null>(null);

  useAnimatedReaction(
    () => ({
      active: isActive,
      distanceKm: state.x.value.value,
      elevationM: state.y.elevationM.value.value,
      paceMps: state.y.paceMps.value.value,
    }),
    (current) => {
      if (!current.active) {
        runOnJS(setLabel)(null);
        return;
      }
      const text =
        metric === "elevation"
          ? `${current.distanceKm.toFixed(2)} km — ${formatElevation(current.elevationM, "metric")}`
          : `${current.distanceKm.toFixed(2)} km — ${formatPace(current.paceMps, "metric")}`;
      runOnJS(setLabel)(text);
    },
    [metric],
  );

  if (data.length < 2) return null;

  return (
    <View>
      <Text style={[typeScale.caption, { color: colors.textSecondary, height: 16 }]}>
        {label ?? (metric === "elevation" ? "Elevation" : "Pace")}
      </Text>
      <View style={{ height }}>
        <CartesianChart
          data={data}
          xKey="distanceKm"
          yKeys={["elevationM", "paceMps"]}
          chartPressState={state}
          axisOptions={{ labelColor: colors.textSecondary, lineColor: colors.border }}
        >
          {({ points }) =>
            metric === "elevation" ? (
              <>
                <Line points={points.elevationM} color={colors.accent} strokeWidth={2} curveType="natural" />
                {isActive ? (
                  <Circle cx={state.x.position} cy={state.y.elevationM.position} r={5} color={colors.accent} />
                ) : null}
              </>
            ) : (
              <>
                <Line points={points.paceMps} color={colors.accent} strokeWidth={2} curveType="natural" />
                {isActive ? (
                  <Circle cx={state.x.position} cy={state.y.paceMps.position} r={5} color={colors.accent} />
                ) : null}
              </>
            )
          }
        </CartesianChart>
      </View>
    </View>
  );
}
