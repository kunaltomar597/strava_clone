import { z } from "zod";
import { uuidSchema } from "./common.js";

export const homeFeedParamsSchema = z.object({
  beforeTs: z.string().datetime().optional(),
  beforeId: uuidSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type HomeFeedParams = z.infer<typeof homeFeedParamsSchema>;

export const profileTotalsPeriodSchema = z.enum(["week", "month", "year"]);
export type ProfileTotalsPeriod = z.infer<typeof profileTotalsPeriodSchema>;

export const profileTotalsParamsSchema = z.object({
  userId: uuidSchema,
  period: profileTotalsPeriodSchema,
});
export type ProfileTotalsParams = z.infer<typeof profileTotalsParamsSchema>;

export const searchUsersParamsSchema = z.object({
  query: z.string().min(1).max(60),
  limit: z.number().int().min(1).max(50).default(20),
});
export type SearchUsersParams = z.infer<typeof searchUsersParamsSchema>;
