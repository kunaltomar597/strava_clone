import { z } from "zod";

export const sportTypeSchema = z.enum(["run", "ride", "walk", "hike"]);
export type SportType = z.infer<typeof sportTypeSchema>;

export const visibilitySchema = z.enum(["everyone", "followers", "only_me"]);
export type Visibility = z.infer<typeof visibilitySchema>;

export const mapVisibilitySchema = z.enum(["full", "hide_start_end", "hidden"]);
export type MapVisibility = z.infer<typeof mapVisibilitySchema>;

export const followStatusSchema = z.enum(["pending", "accepted"]);
export type FollowStatus = z.infer<typeof followStatusSchema>;

export const activityStatusSchema = z.enum(["processing", "ready", "failed"]);
export type ActivityStatus = z.infer<typeof activityStatusSchema>;

export const activitySourceSchema = z.enum(["ios", "android", "gpx_import", "manual"]);
export type ActivitySource = z.infer<typeof activitySourceSchema>;

export const notificationTypeSchema = z.enum([
  "kudos",
  "comment",
  "follow",
  "follow_request",
  "follow_accepted",
  "personal_record",
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const measurementSystemSchema = z.enum(["metric", "imperial"]);
export type MeasurementSystem = z.infer<typeof measurementSystemSchema>;

export const reportTargetTypeSchema = z.enum(["activity", "comment", "profile", "photo"]);
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;

export const reportStatusSchema = z.enum(["open", "reviewed", "actioned"]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const effortKeySchema = z.enum(["400m", "1k", "1mi", "5k", "10k", "half", "marathon"]);
export type EffortKeyContract = z.infer<typeof effortKeySchema>;
