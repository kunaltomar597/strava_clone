// Downloads the raw track a client already uploaded to Storage, validates
// and processes it with the exact same packages/core pipeline the phone
// runs, then writes the result with upsert_processed_activity(). Re-running
// with the same activityId (a retried upload, or a future reprocess) is
// safe: everything downstream is an upsert keyed on that ID.
import { createClient } from "@supabase/supabase-js";
import { INGEST_LIMITS, ingestActivityRequestSchema, rawTrackUploadSchema } from "@stride/contracts";
import { processActivity, type PrivacyZone, type RawFix } from "@stride/core";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Per-user, per-day cap on ingested activities — the "uploads per day" limit from the security section. */
const MAX_ACTIVITIES_PER_DAY = 20;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** A definite `ArrayBuffer` copy, since a `Uint8Array`'s own `.buffer` can be typed as `ArrayBufferLike`. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const parsedRequest = ingestActivityRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return jsonResponse({ error: "Invalid request", details: parsedRequest.error.flatten() }, 400);
  }
  const request = parsedRequest.data;

  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Invalid session" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { count: todaysActivityCount } = await admin
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if ((todaysActivityCount ?? 0) >= MAX_ACTIVITIES_PER_DAY) {
    return jsonResponse({ error: "Daily upload limit reached" }, 429);
  }

  const rawPath = `${user.id}/${request.activityId}.json.gz`;
  const { data: rawFile, error: downloadError } = await admin.storage.from("activity-raw").download(rawPath);
  if (downloadError || !rawFile) {
    return jsonResponse({ error: "Raw track upload not found; upload it before calling ingest" }, 404);
  }

  const compressedBytes = new Uint8Array(await rawFile.arrayBuffer());
  if (compressedBytes.byteLength > INGEST_LIMITS.maxCompressedBytes) {
    return jsonResponse({ error: "Uploaded file exceeds the size limit" }, 413);
  }

  const actualChecksum = await sha256Hex(compressedBytes);
  if (actualChecksum !== request.checksum) {
    return jsonResponse({ error: "Checksum mismatch; the upload may be corrupt or partial" }, 400);
  }

  let track: ReturnType<typeof rawTrackUploadSchema.parse>;
  try {
    const decompressed = await gunzip(compressedBytes);
    const json = JSON.parse(new TextDecoder().decode(decompressed));
    track = rawTrackUploadSchema.parse(json);
  } catch (err) {
    return jsonResponse({ error: "Failed to parse raw track", details: String(err) }, 400);
  }

  if (track.activityId !== request.activityId) {
    return jsonResponse({ error: "activityId mismatch between request and uploaded track" }, 400);
  }

  const fixes = track.fixes as RawFix[];
  if (fixes.length === 0) {
    return jsonResponse({ error: "Track has no GPS fixes" }, 400);
  }
  const durationS = (fixes[fixes.length - 1]!.ts - fixes[0]!.ts) / 1000;
  if (durationS > INGEST_LIMITS.maxDurationS) {
    return jsonResponse({ error: "Activity exceeds the maximum duration" }, 400);
  }

  const [{ data: settings }, { data: zoneRows }] = await Promise.all([
    admin.from("user_settings").select("weight_kg").eq("user_id", user.id).maybeSingle(),
    admin.from("privacy_zones").select("center, radius_m").eq("user_id", user.id),
  ]);

  const privacyZones: PrivacyZone[] = (zoneRows ?? []).map((z: { center: unknown; radius_m: number }) => {
    // PostGIS geography(Point) comes back from PostgREST as GeoJSON: {type: "Point", coordinates: [lng, lat]}.
    const geo = z.center as { coordinates: [number, number] };
    return { center: { lat: geo.coordinates[1], lng: geo.coordinates[0] }, radiusM: z.radius_m };
  });

  const result = processActivity({
    activityId: request.activityId,
    sport: request.sport,
    fixes,
    privacyZones,
    weightKg: settings?.weight_kg ?? null,
  });

  const { error: rpcError } = await admin.rpc("upsert_processed_activity", {
    payload: {
      activityId: request.activityId,
      userId: user.id,
      sport: request.sport,
      name: request.name,
      description: request.description ?? null,
      visibility: request.visibility,
      mapVisibility: request.mapVisibility,
      source: request.source,
      startedAt: request.startedAt,
      startTimezone: request.startTimezone,
      stats: result.stats,
      splitsMetric: result.splitsMetric,
      splitsImperial: result.splitsImperial,
      bestEfforts: result.bestEfforts,
      summaryPolyline: result.summaryPolyline,
      startLatLng: result.startLatLng,
      endLatLng: result.endLatLng,
      boundingBox: result.boundingBox,
      streams: result.streams,
      visibleFromIdx: result.visibleFromIdx,
      visibleToIdx: result.visibleToIdx,
      clientMeta: {
        device: track.device,
        fixCount: fixes.length,
        gapCount: result.gapCount,
        longestGapS: result.longestGapS,
      },
    },
  });

  if (rpcError) {
    console.error("upsert_processed_activity failed:", rpcError.message);
    return jsonResponse({ error: "Failed to save processed activity" }, 500);
  }

  return jsonResponse({
    activityId: request.activityId,
    status: "ready",
    stats: result.stats,
  });
});
