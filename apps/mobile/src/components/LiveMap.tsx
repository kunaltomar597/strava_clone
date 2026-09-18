import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import type { LatLng } from "@stride/core";
import { ensureMapboxInitialized } from "@/lib/mapboxSetup";
import { useTheme } from "@/theme/useTheme";

export interface LiveMapProps {
  /** The route so far, in recording order. */
  coordinates: LatLng[];
}

/**
 * The Record screen's live map: native location puck in follow mode, and
 * the route line so far. Section 2 of the master plan is explicit that
 * this should update at most once per second — callers already get that
 * for free, since `coordinates` only changes when a new GPS fix lands
 * (already ~1 Hz), not from any timer of this component's own.
 */
export function LiveMap({ coordinates }: LiveMapProps) {
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

  if (!hasMapbox) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceElevated }]} />;
  }

  return (
    <Mapbox.MapView
      style={StyleSheet.absoluteFill}
      styleURL={name === "dark" ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Outdoors}
      scaleBarEnabled={false}
      logoEnabled={false}
      attributionEnabled={false}
    >
      <Mapbox.Camera followUserLocation followZoomLevel={16} animationMode="linearTo" animationDuration={500} />
      <Mapbox.LocationPuck puckBearingEnabled visible />
      {coordinates.length >= 2 ? (
        <Mapbox.ShapeSource id="live-route-source" shape={geojson}>
          <Mapbox.LineLayer
            id="live-route-line"
            style={{ lineColor: colors.accent, lineWidth: 4, lineCap: "round", lineJoin: "round" }}
          />
        </Mapbox.ShapeSource>
      ) : null}
    </Mapbox.MapView>
  );
}
