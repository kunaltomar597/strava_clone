/**
 * Hand-authored Supabase database types, written directly from this repo's
 * own migrations (supabase/migrations/*.sql) rather than generated, because
 * `supabase gen types typescript` needs either a running local Docker-based
 * stack or a linked hosted project — neither was available in the
 * environment this was built in.
 *
 * Regenerate for real once either is available:
 *
 *   supabase gen types typescript --local > packages/contracts/src/database.types.ts
 *
 * and re-check this file against the diff; treat this version as a
 * best-effort snapshot, accurate as of the migrations in this repo, not a
 * substitute for the real generator.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export type SportTypeEnum = "run" | "ride" | "walk" | "hike";
export type VisibilityEnum = "everyone" | "followers" | "only_me";
export type MapVisibilityEnum = "full" | "hide_start_end" | "hidden";
export type FollowStatusEnum = "pending" | "accepted";
export type ActivityStatusEnum = "processing" | "ready" | "failed";
export type ActivitySourceEnum = "ios" | "android" | "gpx_import" | "manual";
export type NotificationTypeEnum =
  | "kudos"
  | "comment"
  | "follow"
  | "follow_request"
  | "follow_accepted"
  | "personal_record";
export type MeasurementSystemEnum = "metric" | "imperial";
export type ReportTargetTypeEnum = "activity" | "comment" | "profile" | "photo";
export type ReportStatusEnum = "open" | "reviewed" | "actioned";
export type EffortKeyEnum = "400m" | "1k" | "1mi" | "5k" | "10k" | "half" | "marathon";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_path: string | null;
          bio: string | null;
          city: string | null;
          region: string | null;
          country_code: string | null;
          is_private: boolean;
          followers_count: number;
          following_count: number;
          activity_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // rows are created only by the handle_new_user trigger
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["profiles"]["Row"],
            "username" | "display_name" | "avatar_path" | "bio" | "city" | "region" | "country_code" | "is_private"
          >
        >;
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          measurement_system: MeasurementSystemEnum;
          default_visibility: VisibilityEnum;
          default_map_visibility: MapVisibilityEnum;
          birth_date: string | null;
          weight_kg: number | null;
          max_heart_rate: number | null;
          push_kudos: boolean;
          push_comments: boolean;
          push_follows: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // rows are created only by the handle_new_user trigger
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["user_settings"]["Row"],
            | "measurement_system"
            | "default_visibility"
            | "default_map_visibility"
            | "birth_date"
            | "weight_kg"
            | "max_heart_rate"
            | "push_kudos"
            | "push_comments"
            | "push_follows"
          >
        >;
        Relationships: [];
      };
      privacy_zones: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          center: GeoPoint;
          radius_m: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          center: GeoPoint;
          radius_m: number;
        };
        Update: Partial<Database["public"]["Tables"]["privacy_zones"]["Insert"]>;
        Relationships: [];
      };
      follows: {
        Row: {
          follower_id: string;
          followee_id: string;
          status: FollowStatusEnum;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          follower_id: string;
          followee_id: string;
        };
        Update: {
          status?: FollowStatusEnum;
        };
        Relationships: [];
      };
      blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
        };
        Update: never;
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: "ios" | "android";
          app_version: string | null;
          last_seen_at: string;
          disabled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: "ios" | "android";
          app_version?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["push_tokens"]["Insert"]>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          sport_type: SportTypeEnum;
          name: string;
          description: string | null;
          visibility: VisibilityEnum;
          map_visibility: MapVisibilityEnum;
          status: ActivityStatusEnum;
          processing_version: number;
          source: ActivitySourceEnum;
          started_at: string;
          start_timezone: string;
          elapsed_time_s: number;
          moving_time_s: number;
          distance_m: number;
          elevation_gain_m: number | null;
          elev_high_m: number | null;
          elev_low_m: number | null;
          avg_speed_mps: number | null;
          max_speed_mps: number | null;
          avg_heartrate: number | null;
          max_heartrate: number | null;
          avg_cadence: number | null;
          calories: number | null;
          summary_polyline: string | null;
          start_latlng: GeoPoint | null;
          end_latlng: GeoPoint | null;
          min_lat: number | null;
          min_lng: number | null;
          max_lat: number | null;
          max_lng: number | null;
          splits_metric: Json | null;
          splits_imperial: Json | null;
          gear_id: string | null;
          kudos_count: number;
          comment_count: number;
          photo_count: number;
          client_meta: Json;
          created_at: string;
          updated_at: string;
        };
        // Written only by upsert_processed_activity() under the service role.
        Insert: never;
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["activities"]["Row"],
            "name" | "description" | "sport_type" | "visibility" | "map_visibility" | "gear_id"
          >
        >;
        Relationships: [];
      };
      activity_photos: {
        Row: {
          id: string;
          activity_id: string;
          user_id: string;
          storage_path: string;
          width: number;
          height: number;
          blurhash: string;
          caption: string | null;
          taken_at: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          user_id: string;
          storage_path: string;
          width: number;
          height: number;
          blurhash: string;
          caption?: string | null;
          taken_at?: string | null;
          sort_order?: number;
        };
        Update: never;
        Relationships: [];
      };
      best_efforts: {
        Row: {
          id: number;
          activity_id: string;
          user_id: string;
          effort_key: EffortKeyEnum;
          elapsed_time_s: number;
          start_idx: number;
          end_idx: number;
          pr_rank: number | null;
        };
        Insert: never; // written only by upsert_processed_activity()
        Update: never;
        Relationships: [];
      };
      kudos: {
        Row: {
          activity_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          activity_id: string;
          user_id: string;
        };
        Update: never;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          activity_id: string;
          user_id: string;
          body: string;
          created_at: string;
          updated_at: string;
          edited_at: string | null;
        };
        Insert: {
          id: string;
          activity_id: string;
          user_id: string;
          body: string;
        };
        Update: {
          body?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string;
          type: NotificationTypeEnum;
          activity_id: string | null;
          comment_id: string | null;
          data: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: never; // inserted only by trigger functions
        Update: {
          read_at?: string | null;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: ReportTargetTypeEnum;
          target_id: string;
          reason: string;
          details: string | null;
          status: ReportStatusEnum;
          created_at: string;
        };
        Insert: {
          reporter_id: string;
          target_type: ReportTargetTypeEnum;
          target_id: string;
          reason: string;
          details?: string | null;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_username_available: {
        Args: { check_username: string };
        Returns: boolean;
      };
      can_view_activity: {
        Args: { activity_id: string };
        Returns: boolean;
      };
      is_blocked: {
        Args: { a: string; b: string };
        Returns: boolean;
      };
      is_follower: {
        Args: { viewer: string; owner: string };
        Returns: boolean;
      };
      get_activity_streams: {
        Args: { p_activity_id: string };
        Returns: {
          point_count: number;
          time_s: number[];
          lat_e7: number[];
          lng_e7: number[];
          altitude_m: number[];
          distance_m: number[];
          speed_mps: number[];
          heartrate: (number | null)[];
          cadence: (number | null)[];
          moving: boolean[];
        }[];
      };
      get_home_feed: {
        Args: { before_ts?: string | null; before_id?: string | null; result_limit?: number };
        Returns: {
          id: string;
          user_id: string;
          username: string;
          display_name: string;
          avatar_path: string | null;
          sport_type: SportTypeEnum;
          name: string;
          started_at: string;
          distance_m: number;
          elapsed_time_s: number;
          moving_time_s: number;
          elevation_gain_m: number | null;
          summary_polyline: string | null;
          min_lat: number | null;
          min_lng: number | null;
          max_lat: number | null;
          max_lng: number | null;
          kudos_count: number;
          comment_count: number;
          has_kudoed: boolean;
          photo_paths: string[];
        }[];
      };
      get_profile_totals: {
        Args: { p_user_id: string; p_period: "week" | "month" | "year"; p_buckets?: number };
        Returns: {
          bucket_start: string;
          activity_count: number;
          distance_m: number;
          moving_time_s: number;
          elevation_gain_m: number;
        }[];
      };
      search_users: {
        Args: { p_query: string; result_limit?: number };
        Returns: {
          id: string;
          username: string;
          display_name: string;
          avatar_path: string | null;
          is_private: boolean;
        }[];
      };
    };
    Enums: {
      sport_type: SportTypeEnum;
      visibility: VisibilityEnum;
      map_visibility: MapVisibilityEnum;
      follow_status: FollowStatusEnum;
      activity_status: ActivityStatusEnum;
      activity_source: ActivitySourceEnum;
      notification_type: NotificationTypeEnum;
      measurement_system: MeasurementSystemEnum;
      report_target_type: ReportTargetTypeEnum;
      report_status: ReportStatusEnum;
      effort_key: EffortKeyEnum;
    };
  };
}
