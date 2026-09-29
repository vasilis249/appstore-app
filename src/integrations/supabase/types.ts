export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_posts: {
        Row: {
          audio_path: string
          created_at: string
          duration_ms: number
          id: string
          late: boolean
          mime: string
          moment: string
          user_id: string
        }
        Insert: {
          audio_path: string
          created_at?: string
          duration_ms: number
          id?: string
          late?: boolean
          mime: string
          moment: string
          user_id: string
        }
        Update: {
          audio_path?: string
          created_at?: string
          duration_ms?: number
          id?: string
          late?: boolean
          mime?: string
          moment?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          accepted_at: string | null
          created_at: string
          requested_by: string
          status: string
          user_a: string
          user_b: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          requested_by: string
          status?: string
          user_a: string
          user_b: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          requested_by?: string
          status?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: number
          kind: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: never
          kind: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: never
          kind?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          disabled: boolean
          full_name: string
          id: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          disabled?: boolean
          full_name?: string
          id: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          disabled?: boolean
          full_name?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          kind: string
          reason: string
          reporter_id: string | null
          resolved_at: string | null
          target_id: string | null
          target_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          reason?: string
          reporter_id?: string | null
          resolved_at?: string | null
          target_id?: string | null
          target_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          reason?: string
          reporter_id?: string | null
          resolved_at?: string | null
          target_id?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_messages: {
        Row: {
          created_at: string
          duration_ms: number
          expired_at: string | null
          id: string
          opened_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          duration_ms: number
          expired_at?: string | null
          id?: string
          opened_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          expired_at?: string | null
          id?: string
          opened_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_request: { Args: { p_user: string }; Returns: undefined }
      block_user: { Args: { p_user: string }; Returns: undefined }
      consume_voice_message: {
        Args: { p_id: string }
        Returns: {
          audio_b64: string
          duration_ms: number
          mime: string
        }[]
      }
      feed: {
        Args: never
        Returns: {
          audio_path: string
          avatar_path: string
          created_at: string
          duration_ms: number
          full_name: string
          is_mine: boolean
          late: boolean
          post_id: string
          user_id: string
          username: string
        }[]
      }
      my_blocked: {
        Args: never
        Returns: {
          avatar_path: string
          full_name: string
          id: string
          username: string
        }[]
      }
      my_friends: {
        Args: never
        Returns: {
          avatar_path: string
          full_name: string
          id: string
          relation: string
          since: string
          username: string
        }[]
      }
      my_threads: {
        Args: never
        Returns: {
          avatar_path: string
          full_name: string
          last_at: string
          last_from_me: boolean
          last_state: string
          other_id: string
          unheard: number
          username: string
        }[]
      }
      prompt_schedule: {
        Args: { p_days?: number }
        Returns: {
          moment: string
          prompt_at: string
        }[]
      }
      publish_daily_post: {
        Args: { p_duration_ms: number; p_mime: string; p_path: string }
        Returns: string
      }
      remove_friend: { Args: { p_user: string }; Returns: undefined }
      report_content: {
        Args: { p_kind: string; p_reason?: string; p_target: string }
        Returns: undefined
      }
      search_users: {
        Args: { p_query: string }
        Returns: {
          avatar_path: string
          full_name: string
          id: string
          relation: string
          username: string
        }[]
      }
      send_friend_request: { Args: { p_user: string }; Returns: string }
      send_voice_message: {
        Args: {
          p_audio_b64: string
          p_duration_ms: number
          p_mime: string
          p_to: string
        }
        Returns: string
      }
      today: {
        Args: never
        Returns: {
          moment: string
          my_post_id: string
          next_prompt_at: string
          prompt_at: string
          unlocked: boolean
        }[]
      }
      unblock_user: { Args: { p_user: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
