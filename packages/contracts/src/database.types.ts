/**
 * Placeholder for Supabase's generated database types.
 *
 * Real content is produced by running, against a running local stack:
 *
 *   pnpm db:types
 *   # -> supabase gen types typescript --local > packages/contracts/src/database.types.ts
 *
 * This file is checked in (not gitignored) so the app and Edge Functions
 * always typecheck against *some* schema snapshot, but it should be
 * regenerated as part of every migration that changes the `public` schema.
 * The `Database` type is intentionally minimal until the first migration
 * (Phase 1) exists to generate it from.
 */
export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
