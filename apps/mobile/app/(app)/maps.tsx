import { useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import Mapbox from "@rnmapbox/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ensureMapboxInitialized } from "@/lib/mapboxSetup";
import { useTheme } from "@/theme/useTheme";
import { spacing } from "@/theme/tokens";

type MapStyle = "outdoors" | "satellite";

export default function MapsScreen() {
  const { colors, name } = useTheme();
  const insets = useSafeAreaInsets();
  const hasMapbox = ensureMapboxInitialized();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [following, setFollowing] = useState(true);
  const [mapStyle, setMapStyle] = useState<MapStyle>("outdoors");

  async function requestPermission() {
    const result = await Location.requestForegroundPermissionsAsync();
    setPermissionGranted(result.status === Location.PermissionStatus.GRANTED);
  }

  if (!hasMapbox) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <EmptyState
          title="Maps unavailable"
          message="No Mapbox token is configured (EXPO_PUBLIC_MAPBOX_TOKEN) — see docs/release-checklist.md."
        />
      </View>
    );
  }

  if (!permissionGranted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background, paddingTop: insets.top + spacing.lg }]}>
        <EmptyState
          title="Enable location"
          message="Stride uses your location to show where you are on the map. This is used only while the app is open or you're recording."
        />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Button label="Enable location" onPress={requestPermission} />
        </View>
      </View>
    );
  }

  const styleURL = mapStyle === "satellite" ? Mapbox.StyleURL.SatelliteStreet : name === "dark" ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Outdoors;

  return (
    <View style={{ flex: 1 }}>
      <Mapbox.MapView
        style={StyleSheet.absoluteFill}
        styleURL={styleURL}
        scaleBarEnabled={false}
        // Best-effort "stop following once the user pans": MapView's pan/zoom
        // gestures are handled natively, so it's not verified whether this
        // RN touch prop actually fires for them without a device to test on.
        // The explicit Recenter button below is the reliable path either way.
        onTouchMove={() => setFollowing(false)}
      >
        <Mapbox.Camera followUserLocation={following} followZoomLevel={15} />
        <Mapbox.LocationPuck puckBearingEnabled visible />
      </Mapbox.MapView>

      <View style={[styles.controls, { top: insets.top + spacing.md }]}>
        <Button
          label={mapStyle === "outdoors" ? "Satellite" : "Outdoors"}
          variant="secondary"
          fullWidth={false}
          onPress={() => setMapStyle((s) => (s === "outdoors" ? "satellite" : "outdoors"))}
        />
      </View>

      <View style={[styles.recenter, { bottom: insets.bottom + spacing.lg }]}>
        <Button label="Recenter" variant="secondary" fullWidth={false} onPress={() => setFollowing(true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionContainer: {
    flex: 1,
  },
  controls: {
    position: "absolute",
    right: spacing.md,
  },
  recenter: {
    position: "absolute",
    right: spacing.md,
  },
});
