export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      connector_types: {
        Row: {
          description: string | null
          display_name: string
          id: string
        }
        Insert: {
          description?: string | null
          display_name: string
          id: string
        }
        Update: {
          description?: string | null
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      journal_connectors: {
        Row: {
          config: Json
          connector_type_id: string
          created_at: string
          enabled: boolean
          id: string
          journal_id: string
          status: Database["public"]["Enums"]["connector_link_status"]
          updated_at: string
        }
        Insert: {
          config?: Json
          connector_type_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          journal_id: string
          status?: Database["public"]["Enums"]["connector_link_status"]
          updated_at?: string
        }
        Update: {
          config?: Json
          connector_type_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          journal_id?: string
          status?: Database["public"]["Enums"]["connector_link_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_connectors_connector_type_id_fkey"
            columns: ["connector_type_id"]
            isOneToOne: false
            referencedRelation: "connector_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_connectors_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_ical_feed_tokens: {
        Row: {
          created_at: string
          journal_id: string
          token: string
        }
        Insert: {
          created_at?: string
          journal_id: string
          token?: string
        }
        Update: {
          created_at?: string
          journal_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_ical_feed_tokens_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: true
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_invitations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invited_by_user_id: string
          invited_role: Database["public"]["Enums"]["journal_member_role"]
          invitee_email: string
          journal_id: string
          status: Database["public"]["Enums"]["journal_invitation_status"]
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by_user_id: string
          invited_role: Database["public"]["Enums"]["journal_member_role"]
          invitee_email: string
          journal_id: string
          status?: Database["public"]["Enums"]["journal_invitation_status"]
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by_user_id?: string
          invited_role?: Database["public"]["Enums"]["journal_member_role"]
          invitee_email?: string
          journal_id?: string
          status?: Database["public"]["Enums"]["journal_invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_invitations_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_members: {
        Row: {
          created_at: string
          journal_id: string
          role: Database["public"]["Enums"]["journal_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          journal_id: string
          role?: Database["public"]["Enums"]["journal_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          journal_id?: string
          role?: Database["public"]["Enums"]["journal_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_members_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          created_at: string
          created_by_user_id: string
          icon_emoji: string | null
          id: string
          is_personal: boolean
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          icon_emoji?: string | null
          id?: string
          is_personal?: boolean
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          icon_emoji?: string | null
          id?: string
          is_personal?: boolean
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_path: string | null
          body: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          action_path?: string | null
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          action_path?: string | null
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          created_at: string
          id: string
          journal_id: string
          sort_order: number
          storage_path: string | null
          trace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          journal_id: string
          sort_order?: number
          storage_path?: string | null
          trace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          journal_id?: string
          sort_order?: number
          storage_path?: string | null
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "traces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_journal_id: string | null
          display_name: string | null
          id: string
          notification_email_enabled: boolean
          notification_push_enabled: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_journal_id?: string | null
          display_name?: string | null
          id: string
          notification_email_enabled?: boolean
          notification_push_enabled?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_journal_id?: string | null
          display_name?: string | null
          id?: string
          notification_email_enabled?: boolean
          notification_push_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_journal_fk"
            columns: ["default_journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          icon_emoji: string
          id: string
          journal_id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon_emoji?: string
          id?: string
          journal_id: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon_emoji?: string
          id?: string
          journal_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      trace_tags: {
        Row: {
          tag_id: string
          trace_id: string
        }
        Insert: {
          tag_id: string
          trace_id: string
        }
        Update: {
          tag_id?: string
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trace_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trace_tags_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "traces"
            referencedColumns: ["id"]
          },
        ]
      }
      traces: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          date: string | null
          description: string | null
          end_date: string | null
          id: string
          journal_id: string
          lat: number
          lng: number
          location_label: string | null
          modified_by_user_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          date?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          journal_id: string
          lat: number
          lng: number
          location_label?: string | null
          modified_by_user_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          date?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          journal_id?: string
          lat?: number
          lng?: number
          location_label?: string | null
          modified_by_user_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traces_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traces_modified_by_user_id_fkey"
            columns: ["modified_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traces_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_connectors: {
        Row: {
          config: Json
          connector_type_id: string
          created_at: string
          enabled: boolean
          id: string
          status: Database["public"]["Enums"]["connector_link_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          connector_type_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          status?: Database["public"]["Enums"]["connector_link_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          connector_type_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          status?: Database["public"]["Enums"]["connector_link_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_connectors_connector_type_id_fkey"
            columns: ["connector_type_id"]
            isOneToOne: false
            referencedRelation: "connector_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_journal_invitation: { Args: { p_token: string }; Returns: string }
      cancel_journal_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      decline_journal_invitation: {
        Args: { p_token: string }
        Returns: undefined
      }
      invite_journal_member: {
        Args: {
          p_invited_role: Database["public"]["Enums"]["journal_member_role"]
          p_invitee_email: string
          p_journal_id: string
        }
        Returns: string
      }
      is_journal_member: { Args: { p_journal_id: string }; Returns: boolean }
      is_journal_owner: { Args: { p_journal_id: string }; Returns: boolean }
      journal_member_can_edit: {
        Args: { p_journal_id: string }
        Returns: boolean
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_notification_read_by_token: {
        Args: { p_invitation_token: string }
        Returns: undefined
      }
      remove_journal_member: {
        Args: { p_journal_id: string; p_user_id: string }
        Returns: undefined
      }
      trace_journal_id: { Args: { p_trace_id: string }; Returns: string }
      transfer_journal_ownership: {
        Args: { p_journal_id: string; p_new_owner_user_id: string }
        Returns: undefined
      }
      update_journal_member_role: {
        Args: {
          p_journal_id: string
          p_role: Database["public"]["Enums"]["journal_member_role"]
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      connector_link_status: "disabled" | "pending" | "error" | "connected"
      journal_invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "cancelled"
      journal_member_role: "owner" | "editor" | "viewer"
      notification_type:
        | "journal_invitation"
        | "journal_invitation_accepted"
        | "journal_ownership_received"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      connector_link_status: ["disabled", "pending", "error", "connected"],
      journal_invitation_status: [
        "pending",
        "accepted",
        "declined",
        "cancelled",
      ],
      journal_member_role: ["owner", "editor", "viewer"],
      notification_type: [
        "journal_invitation",
        "journal_invitation_accepted",
        "journal_ownership_received",
      ],
    },
  },
} as const

