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
          id: string
          is_personal: boolean
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          is_personal?: boolean
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          is_personal?: boolean
          name?: string
          slug?: string | null
          updated_at?: string
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
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_journal_id?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_journal_id?: string | null
          display_name?: string | null
          id?: string
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
          description: string | null
          id: string
          journal_id: string
          lat: number
          lng: number
          title: string | null
          updated_at: string
          visited_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          journal_id: string
          lat: number
          lng: number
          title?: string | null
          updated_at?: string
          visited_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          journal_id?: string
          lat?: number
          lng?: number
          title?: string | null
          updated_at?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traces_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_journal_member: { Args: { p_journal_id: string }; Returns: boolean }
      trace_journal_id: { Args: { p_trace_id: string }; Returns: string }
    }
    Enums: {
      connector_link_status: "disabled" | "pending" | "error" | "connected"
      journal_member_role: "owner" | "editor" | "viewer"
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
      journal_member_role: ["owner", "editor", "viewer"],
    },
  },
} as const

