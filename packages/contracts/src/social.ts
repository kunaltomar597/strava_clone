import { z } from "zod";
import { reportTargetTypeSchema } from "./enums.js";
import { uuidSchema } from "./common.js";

export const commentBodySchema = z.object({
  id: uuidSchema,
  activityId: uuidSchema,
  body: z.string().min(1).max(1000),
});
export type CommentBodyInput = z.infer<typeof commentBodySchema>;

export const reportSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: uuidSchema,
  reason: z.string().min(1).max(100),
  details: z.string().max(2000).optional(),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const privacyZoneSchema = z.object({
  label: z.string().max(60),
  center: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  radiusM: z.number().int().min(200).max(1600),
});
export type PrivacyZoneInput = z.infer<typeof privacyZoneSchema>;
