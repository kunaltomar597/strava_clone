// Phase 0's "prove code sharing" checkpoint: this Edge Function imports
// straight from packages/core and runs the exact same haversine
// implementation used on-device and in the ingest pipeline. If this
// function returns the right distance, `packages/core` genuinely runs
// unmodified on both Hermes (the phone) and Deno (the server).
import { haversineDistanceM } from "@stride/core";

Deno.serve((_req) => {
  // Roughly one degree of latitude, ~111.2km — a fixed, checkable value.
  const distanceM = haversineDistanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });

  return new Response(
    JSON.stringify({
      message: "packages/core is running inside a Deno Edge Function.",
      distanceM,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
