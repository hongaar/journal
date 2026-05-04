export type JournalMemberRole = "owner" | "editor" | "viewer";
export type ConnectorLinkStatus = "disabled" | "pending" | "error" | "connected";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  default_journal_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Journal = {
  id: string;
  name: string;
  slug: string | null;
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
  lat: number;
  lng: number;
  /** Start calendar day (YYYY-MM-DD). */
  date: string;
  /** Inclusive end day, optional; must be >= date when set. */
  end_date: string | null;
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
};

export type ConnectorType = {
  id: string;
  display_name: string;
  description: string | null;
};

export type JournalConnector = {
  id: string;
  journal_id: string;
  connector_type_id: string;
  enabled: boolean;
  config: Record<string, unknown>;
  status: ConnectorLinkStatus;
  created_at: string;
  updated_at: string;
};

/** Minimal Database typing for Supabase client generics */
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> };
      journals: { Row: Journal; Insert: Partial<Journal> & { name: string; created_by_user_id: string }; Update: Partial<Journal> };
      journal_members: {
        Row: JournalMember;
        Insert: { journal_id: string; user_id: string; role?: JournalMemberRole };
        Update: Partial<JournalMember>;
      };
      traces: {
        Row: Trace;
        Insert: Omit<Trace, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Trace>;
      };
      tags: {
        Row: Tag;
        Insert: Omit<Tag, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Tag>;
      };
      trace_tags: { Row: TraceTagRow; Insert: TraceTagRow; Update: TraceTagRow };
      photos: {
        Row: Photo;
        Insert: Omit<Photo, "id" | "created_at"> & { id?: string };
        Update: Partial<Photo>;
      };
      connector_types: { Row: ConnectorType; Insert: never; Update: never };
      journal_connectors: {
        Row: JournalConnector;
        Insert: Omit<JournalConnector, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<JournalConnector>;
      };
      journal_ical_feed_tokens: {
        Row: JournalIcalFeedToken;
        Insert: { journal_id: string; token?: string };
        Update: Partial<Pick<JournalIcalFeedToken, "token">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      journal_member_role: JournalMemberRole;
      connector_link_status: ConnectorLinkStatus;
    };
  };
};
