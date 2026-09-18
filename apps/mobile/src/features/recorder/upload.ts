import pako from "pako";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type { SportType } from "@stride/core";
import type { RecordingEventContract } from "@stride/contracts";
import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";
import { loadFixes } from "./pointWriter";

export interface SaveActivityInput {
  activityId: string;
  sport: SportType;
  name: string;
  description?: string;
  visibility: "everyone" | "followers" | "only_me";
  mapVisibility: "full" | "hide_start_end" | "hidden";
  startedAt: string;
  startTimezone: string;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The outbox's single upload step: local (fixes already on disk) -> raw
 * file uploaded -> ingest called. Each step is idempotent — a retry after
 * any failure just re-does that step with the same activity ID and
 * storage path, per the master plan's "every step is idempotent" principle.
 */
export async function saveAndUploadActivity(input: SaveActivityInput, events: RecordingEventContract[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const fixes = await loadFixes(input.activityId);
  if (fixes.length === 0) throw new Error("No GPS fixes recorded for this activity");

  const payload = {
    activityId: input.activityId,
    fixes,
    events,
    device: {
      platform: Platform.OS === "ios" ? ("ios" as const) : ("android" as const),
      osVersion: String(Platform.Version),
      appVersion: Constants.expoConfig?.version ?? "unknown",
      deviceModel: Device.modelName ?? "unknown",
    },
  };

  const json = JSON.stringify(payload);
  const compressed = pako.gzip(json);
  const checksumBuffer = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, toArrayBuffer(compressed));
  const checksum = bytesToHex(checksumBuffer);

  const path = `${user.id}/${input.activityId}.json.gz`;
  const { error: uploadError } = await supabase.storage.from("activity-raw").upload(path, toArrayBuffer(compressed), {
    contentType: "application/gzip",
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const response = await fetch(`${env.supabaseUrl}/functions/v1/ingest-activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      activityId: input.activityId,
      sport: input.sport,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      mapVisibility: input.mapVisibility,
      source: Platform.OS === "ios" ? "ios" : "android",
      startedAt: input.startedAt,
      startTimezone: input.startTimezone,
      checksum,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ingest-activity failed: ${response.status} ${body}`);
  }
}
