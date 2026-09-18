import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { buildStaticMapUrl } from "@/lib/mapbox";
import { useTheme } from "@/theme/useTheme";
import { radius } from "@/theme/tokens";

export interface FeedMapThumbnailProps {
  summaryPolyline: string | null;
  height?: number;
}

/**
 * The only place that knows feed thumbnails come from Mapbox's Static
 * Images API — swapping to an on-device rendering fallback (section 4's
 * risk mitigation) means changing this component alone.
 */
export function FeedMapThumbnail({ summaryPolyline, height = 160 }: FeedMapThumbnailProps) {
  const { colors } = useTheme();
  const uri = summaryPolyline ? buildStaticMapUrl(summaryPolyline) : null;

  if (!uri) {
    return <View style={[styles.placeholder, { height, backgroundColor: colors.surfaceElevated }]} />;
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, { height }]}
      contentFit="cover"
      cachePolicy="disk"
      // Mapbox's terms cap client-side caching of static images at 30 days.
      recyclingKey={uri}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    borderRadius: radius.md,
  },
  placeholder: {
    width: "100%",
    borderRadius: radius.md,
  },
});
