import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { boundingBoxOf, type LatLng } from "@stride/core";
import { ensureMapboxInitialized } from "@/lib/mapboxSetup";
import { useTheme } from "@/theme/useTheme";
import { radius } from "@/theme/tokens";

export interface RouteMapProps {
  /** Already privacy-trimmed — from a decoded summary_polyline or activity_streams. */
  coordinates: LatLng[];
  height?: number;
}

/**
 * The activity-detail map: draws the privacy-window route with start/finish
 * markers and fits the camera to it. Falls back to an empty placeholder
 * without a Mapbox token (no account was available while building this —
 * see docs/release-checklist.md), so the rest of the screen still renders.
 */
export function RouteMap({ coordinates, height = 220 }: RouteMapProps) {
  const { colors, name } = useTheme();
  const hasMapbox = ensureMapboxInitialized();

  const geojson = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: coordinates.map((c) => [c.lng, c.lat]),
      },
    }),
    [coordinates],
  );

  const bounds = useMemo(() => {
    const box = boundingBoxOf(coordinates);
    if (!box) return null;
    return {
      ne: [box.maxLng, box.maxLat] as [number, number],
      sw: [box.minLng, box.minLat] as [number, number],
      paddingTop: 40,
      paddingBottom: 40,
      paddingLeft: 40,
      paddingRight: 40,
    };
  }, [coordinates]);

  if (!hasMapbox || coordinates.length < 2 || !bounds) {
    return <View style={[styles.placeholder, { height, backgroundColor: colors.surfaceElevated, borderRadius: radius.md }]} />;
  }

  const start = coordinates[0]!;
  const end = coordinates[coordinates.length - 1]!;

  return (
    <View style={[styles.container, { height, borderRadius: radius.md }]}>
      <Mapbox.MapView
        style={StyleSheet.absoluteFill}
        styleURL={name === "dark" ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Outdoors}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Mapbox.Camera bounds={bounds} animationMode="none" />
        <Mapbox.ShapeSource id="route-source" shape={geojson}>
          <Mapbox.LineLayer
            id="route-line"
            style={{ lineColor: colors.accent, lineWidth: 3, lineCap: "round", lineJoin: "round" }}
          />
        </Mapbox.ShapeSource>
        <Mapbox.PointAnnotation id="route-start" coordinate={[start.lng, start.lat]}>
          <View style={[styles.marker, { backgroundColor: colors.success }]} />
        </Mapbox.PointAnnotation>
        <Mapbox.PointAnnotation id="route-end" coordinate={[end.lng, end.lat]}>
          <View style={[styles.marker, { backgroundColor: colors.danger }]} />
        </Mapbox.PointAnnotation>
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
  },
  placeholder: {
    width: "100%",
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "white",
  },
});
