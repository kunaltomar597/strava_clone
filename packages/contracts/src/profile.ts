import { z } from "zod";
import { measurementSystemSchema, mapVisibilitySchema, visibilitySchema } from "./enums.js";
import { usernameSchema } from "./common.js";

export const profileUpdateSchema = z.object({
  username: usernameSchema.optional(),
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(280).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  countryCode: z.string().length(2).optional(),
  isPrivate: z.boolean().optional(),
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const userSettingsUpdateSchema = z.object({
  measurementSystem: measurementSystemSchema.optional(),
  defaultVisibility: visibilitySchema.optional(),
  defaultMapVisibility: mapVisibilitySchema.optional(),
  birthDate: z.string().date().optional(),
  weightKg: z.number().positive().max(400).optional(),
  maxHeartRate: z.number().int().positive().max(250).optional(),
  pushKudos: z.boolean().optional(),
  pushComments: z.boolean().optional(),
  pushFollows: z.boolean().optional(),
});
export type UserSettingsUpdate = z.infer<typeof userSettingsUpdateSchema>;

export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: z.string().min(1).max(60),
  measurementSystem: measurementSystemSchema,
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;
