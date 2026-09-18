import Mapbox from "@rnmapbox/maps";
import { env } from "./env";

let initialized = false;

/** Call once, before any Mapbox component renders. No-ops without a token (see LiveMap/RouteMap). */
export function ensureMapboxInitialized(): boolean {
  if (!env.mapboxPublicToken) return false;
  if (!initialized) {
    Mapbox.setAccessToken(env.mapboxPublicToken);
    initialized = true;
  }
  return true;
}
