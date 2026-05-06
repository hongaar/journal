export type JournalMemberRole = "owner" | "editor" | "viewer";
export type JournalInvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled";
export type NotificationType =
  | "journal_invitation"
  | "journal_invitation_accepted"
  | "journal_ownership_received";
export type PluginLinkStatus = "disabled" | "pending" | "error" | "connected";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  default_journal_id: string | null;
  notification_email_enabled: boolean;
  notification_push_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type Journal = {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  /** When null, UI uses defaultJournalIcon(is_personal). */
  icon_emoji: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type JournalMember = {
  journal_id: string;
  user_id: string;
  role: JournalMemberRole;
  created_at: string;
};

export type Trace = {
  id: string;
  journal_id: string;
  title: string | null;
  description: string | null;
  /** Friendly place text from reverse geocoding (optional). */
  location_label: string | null;
  lat: number;
  lng: number;
  /** Start calendar day (YYYY-MM-DD), optional. */
  date: string | null;
  /** Inclusive end day, optional; must be >= date when both are set. */
  end_date: string | null;
  /** User who created this trace (insert). */
  created_by_user_id: string | null;
  /** User who last updated this trace. */
  modified_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type JournalIcalFeedToken = {
  journal_id: string;
  token: string;
  created_at: string;
};

export type Tag = {
  id: string;
  journal_id: string;
  name: string;
  /** URL-safe slug, unique within the journal. */
  slug: string;
  color: string;
  icon_emoji: string;
  created_at: string;
  updated_at: string;
};

export type TraceTagRow = {
  trace_id: string;
  tag_id: string;
};

export type Photo = {
  id: string;
  journal_id: string;
  trace_id: string;
  storage_path: string | null;
  sort_order: number;
  created_at: string;
  source_plugin_id: string | null;
  external_ref: Record<string, unknown> | null;
  captured_at: string | null;
};

export type PluginType = {
  id: string;
  display_name: string;
  description: string | null;
};

export type JournalPlugin = {
  id: string;
  journal_id: string;
  plugin_type_id: string;
  enabled: boolean;
  config: Record<string, unknown>;
  status: PluginLinkStatus;
  created_at: string;
  updated_at: string;
};

/** Account-wide plugin toggle and credentials (`user_plugins`). */
export type UserPlugin = {
  id: string;
  user_id: string;
  plugin_type_id: string;
  enabled: boolean;
  config: Record<string, unknown>;
  status: PluginLinkStatus;
  created_at: string;
  updated_at: string;
};

export type JournalInvitation = {
  id: string;
  journal_id: string;
  invitee_email: string;
  invited_role: JournalMemberRole;
  invited_by_user_id: string;
  token: string;
  status: JournalInvitationStatus;
  created_at: string;
  expires_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  action_path: string | null;
  read_at: string | null;
  created_at: string;
};

/** Minimal Database typing for Supabase client generics */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      };
      journals: {
        Row: Journal;
        Insert: Partial<Journal> & { name: string; created_by_user_id: string };
        Update: Partial<Journal>;
      };
      journal_members: {
        Row: JournalMember;
        Insert: {
          journal_id: string;
          user_id: string;
          role?: JournalMemberRole;
        };
        Update: Partial<JournalMember>;
      };
      traces: {
        Row: Trace;
        Insert: Omit<
          Trace,
          | "id"
          | "created_at"
          | "updated_at"
          | "created_by_user_id"
          | "modified_by_user_id"
        > & {
          id?: string;
          created_by_user_id?: string | null;
          modified_by_user_id?: string | null;
        };
        Update: Partial<Trace>;
      };
      tags: {
        Row: Tag;
        Insert: Omit<Tag, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Tag>;
      };
      trace_tags: {
        Row: TraceTagRow;
        Insert: TraceTagRow;
        Update: TraceTagRow;
      };
      photos: {
        Row: Photo;
        Insert: Omit<Photo, "id" | "created_at"> & { id?: string };
        Update: Partial<Photo>;
      };
      plugin_types: { Row: PluginType; Insert: never; Update: never };
      journal_plugins: {
        Row: JournalPlugin;
        Insert: Omit<JournalPlugin, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<JournalPlugin>;
      };
      user_plugins: {
        Row: UserPlugin;
        Insert: Omit<UserPlugin, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<UserPlugin>;
      };
      journal_ical_feed_tokens: {
        Row: JournalIcalFeedToken;
        Insert: { journal_id: string; token?: string };
        Update: Partial<Pick<JournalIcalFeedToken, "token">>;
      };
      journal_invitations: {
        Row: JournalInvitation;
        Insert: never;
        Update: Partial<Pick<JournalInvitation, "status">>;
      };
      notifications: {
        Row: AppNotification;
        Insert: never;
        Update: Partial<Pick<AppNotification, "read_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      journal_member_role: JournalMemberRole;
      journal_invitation_status: JournalInvitationStatus;
      notification_type: NotificationType;
      plugin_link_status: PluginLinkStatus;
    };
  };
};
