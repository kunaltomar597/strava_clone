import { env } from "./env";

export interface StaticMapOptions {
  width?: number;
  height?: number;
  /** @2x density, per Mapbox's terms for crisp feed thumbnails. */
  retina?: boolean;
  style?: "outdoors-v12" | "dark-v11" | "satellite-streets-v12";
  strokeColor?: string;
  strokeWidth?: number;
}

/**
 * Builds a Mapbox Static Images API URL from an already-encoded (Google
 * polyline format) route. Mapbox's terms require these requests to
 * originate from the device itself and cap client-side caching at 30 days
 * — see FeedMapThumbnail, which is the only place this should be called
 * from, so switching rendering strategies later (section 4's on-device
 * fallback) only touches one component.
 */
export function buildStaticMapUrl(encodedPolyline: string, options: StaticMapOptions = {}): string | null {
  if (!env.mapboxPublicToken || !encodedPolyline) return null;

  const { width = 600, height = 300, retina = true, style = "outdoors-v12", strokeColor = "fc4c02", strokeWidth = 3 } =
    options;

  const overlay = `path-${strokeWidth}+${strokeColor}(${encodeURIComponent(encodedPolyline)})`;
  const density = retina ? "@2x" : "";

  return (
    `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${overlay}/auto/${width}x${height}${density}` +
    `?padding=30&access_token=${env.mapboxPublicToken}`
  );
}
