import { z } from "zod";

/** UUIDv7 or v4 — the client generates v7 for time-sortable IDs; Postgres defaults use v4. */
export const uuidSchema = z.string().uuid();

/**
 * A username: 3-30 characters of lowercase letters, digits, underscore and
 * dot, matching the `citext` column's check constraint in `profiles`.
 */
export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_.]+$/, "Usernames may only contain lowercase letters, numbers, underscore and dot.");

export const latSchema = z.number().min(-90).max(90);
export const lngSchema = z.number().min(-180).max(180);

export const latLngSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
});
