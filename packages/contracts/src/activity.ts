import { z } from "zod";
import { activitySourceSchema, mapVisibilitySchema, sportTypeSchema, visibilitySchema } from "./enums.js";
import { uuidSchema } from "./common.js";

/** Server-enforced limits from the security section of the master plan. */
export const INGEST_LIMITS = {
  maxCompressedBytes: 5 * 1024 * 1024,
  maxDurationS: 24 * 60 * 60,
  maxPoints: 100_000,
} as const;

/** One raw GPS fix, as columnar JSON inside the gzipped raw-track upload. */
export const rawFixSchema = z.object({
  ts: z.number().int().nonnegative(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  alt: z.number().nullable().optional(),
  hAcc: z.number().nonnegative().nullable().optional(),
  vAcc: z.number().nonnegative().nullable().optional(),
  speed: z.number().nullable().optional(),
  course: z.number().nullable().optional(),
  hr: z.number().int().nonnegative().nullable().optional(),
  cadence: z.number().int().nonnegative().nullable().optional(),
  segment: z.number().int().nonnegative(),
});
export type RawFixContract = z.infer<typeof rawFixSchema>;

/** One state-machine transition, from the on-device `recording_events` table. */
export const recordingEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  ts: z.number().int().nonnegative(),
  type: z.enum(["start", "pause", "resume", "auto_pause", "auto_resume", "lap", "gap", "stop"]),
});
export type RecordingEventContract = z.infer<typeof recordingEventSchema>;

export const deviceMetaSchema = z.object({
  platform: z.enum(["ios", "android"]),
  osVersion: z.string(),
  appVersion: z.string(),
  deviceModel: z.string(),
  recorderSdkVersion: z.string().optional(),
});
export type DeviceMeta = z.infer<typeof deviceMetaSchema>;

/**
 * The gzipped JSON body uploaded to `activity-raw/{user_id}/{activity_id}.json.gz`.
 * This is the immutable source of truth for an activity's raw track.
 */
export const rawTrackUploadSchema = z.object({
  activityId: uuidSchema,
  fixes: z.array(rawFixSchema).max(INGEST_LIMITS.maxPoints),
  events: z.array(recordingEventSchema),
  device: deviceMetaSchema,
});
export type RawTrackUpload = z.infer<typeof rawTrackUploadSchema>;

/**
 * Parameters the app sends to the `ingest-activity` Edge Function after the
 * raw track has been uploaded to Storage. The function re-downloads and
 * validates the file itself rather than trusting anything here except the
 * pointer and the user-editable metadata.
 */
export const ingestActivityRequestSchema = z.object({
  activityId: uuidSchema,
  sport: sportTypeSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  visibility: visibilitySchema,
  mapVisibility: mapVisibilitySchema,
  source: activitySourceSchema,
  startedAt: z.string().datetime(),
  startTimezone: z.string(),
  /** SHA-256 hex digest of the uploaded gzip file, so the function can detect a corrupt/partial upload. */
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type IngestActivityRequest = z.infer<typeof ingestActivityRequestSchema>;

export const activityPhotoUploadSchema = z.object({
  id: uuidSchema,
  activityId: uuidSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurhash: z.string(),
  caption: z.string().max(500).optional(),
  takenAt: z.string().datetime().optional(),
  sortOrder: z.number().int().nonnegative(),
});
export type ActivityPhotoUpload = z.infer<typeof activityPhotoUploadSchema>;
