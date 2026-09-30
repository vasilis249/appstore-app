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
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_requests: {
        Row: {
          created_at: string
          group_id: string
          invited_by: string | null
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          invited_by?: string | null
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          invited_by?: string | null
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_requests_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string
          id: string
          last_post_at: string | null
          members_count: number
          name: string
          posts_count: number
          privacy: string
          section_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          last_post_at?: string | null
          members_count?: number
          name: string
          posts_count?: number
          privacy: string
          section_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          last_post_at?: string | null
          members_count?: number
          name?: string
          posts_count?: number
          privacy?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          group_id: string | null
          id: number
          kind: string
          post_id: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          group_id?: string | null
          id?: never
          kind: string
          post_id?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          group_id?: string | null
          id?: never
          kind?: string
          post_id?: string | null
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
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
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
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_listens: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_listens_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_listens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          audio_path: string | null
          author_id: string | null
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          group_id: string | null
          hidden: boolean
          id: string
          likes_count: number
          listens_count: number
          mime: string | null
          replies_count: number
          reply_to: string | null
          repost_of: string | null
          reposts_count: number
          section_id: string | null
          title: string | null
          topic_id: string | null
        }
        Insert: {
          audio_path?: string | null
          author_id?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          group_id?: string | null
          hidden?: boolean
          id?: string
          likes_count?: number
          listens_count?: number
          mime?: string | null
          replies_count?: number
          reply_to?: string | null
          repost_of?: string | null
          reposts_count?: number
          section_id?: string | null
          title?: string | null
          topic_id?: string | null
        }
        Update: {
          audio_path?: string | null
          author_id?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          group_id?: string | null
          hidden?: boolean
          id?: string
          likes_count?: number
          listens_count?: number
          mime?: string | null
          replies_count?: number
          reply_to?: string | null
          repost_of?: string | null
          reposts_count?: number
          section_id?: string | null
          title?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_repost_of_fkey"
            columns: ["repost_of"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
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
          action: string | null
          created_at: string
          id: string
          kind: string
          reason: string
          reporter_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          target_id: string | null
          target_user_id: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          id?: string
          kind: string
          reason?: string
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          target_id?: string | null
          target_user_id: string
        }
        Update: {
          action?: string | null
          created_at?: string
          id?: string
          kind?: string
          reason?: string
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
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
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
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
      sections: {
        Row: {
          icon: string
          id: string
          name_el: string
          name_en: string
          position: number
        }
        Insert: {
          icon: string
          id: string
          name_el: string
          name_en: string
          position: number
        }
        Update: {
          icon?: string
          id?: string
          name_el?: string
          name_en?: string
          position?: number
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          created_by: string | null
          daily_date: string | null
          external_id: string | null
          hidden: boolean
          id: string
          image_url: string | null
          kind: string
          last_post_at: string | null
          pinned: boolean
          posts_count: number
          section_id: string
          source_name: string | null
          source_url: string | null
          summary: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_date?: string | null
          external_id?: string | null
          hidden?: boolean
          id?: string
          image_url?: string | null
          kind?: string
          last_post_at?: string | null
          pinned?: boolean
          posts_count?: number
          section_id: string
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_date?: string | null
          external_id?: string | null
          hidden?: boolean
          id?: string
          image_url?: string | null
          kind?: string
          last_post_at?: string | null
          pinned?: boolean
          posts_count?: number
          section_id?: string
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
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
      admin_create_topic: {
        Args: {
          p_daily_date?: string
          p_section: string
          p_source_name?: string
          p_source_url?: string
          p_summary?: string
          p_title: string
        }
        Returns: string
      }
      admin_feeds: {
        Args: never
        Returns: {
          enabled: boolean
          id: number
          last_added: number
          last_error: string
          last_fetched_at: string
          name: string
          section_id: string
          url: string
        }[]
      }
      admin_open_reports: { Args: never; Returns: number }
      admin_refresh_news: { Args: never; Returns: number }
      admin_reports: {
        Args: { p_limit?: number; p_open?: boolean }
        Returns: {
          action: string
          created_at: string
          group_exists: boolean
          group_name: string
          id: string
          kind: string
          post_audio_path: string
          post_duration_ms: number
          post_exists: boolean
          post_hidden: boolean
          post_title: string
          reason: string
          reporter_username: string
          reports_on_target: number
          resolved_at: string
          target_avatar: string
          target_disabled: boolean
          target_id: string
          target_is_admin: boolean
          target_name: string
          target_user_id: string
          target_username: string
        }[]
      }
      admin_resolve_report: {
        Args: { p_action: string; p_report: string }
        Returns: number
      }
      admin_set_feed: {
        Args: { p_enabled: boolean; p_feed: number }
        Returns: undefined
      }
      admin_set_post_hidden: {
        Args: { p_hidden: boolean; p_post: string }
        Returns: undefined
      }
      admin_set_user_disabled: {
        Args: { p_disabled: boolean; p_user: string }
        Returns: undefined
      }
      admin_topics: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          daily_date: string
          hidden: boolean
          id: string
          kind: string
          pinned: boolean
          posts_count: number
          section_id: string
          source_name: string
          source_url: string
          title: string
        }[]
      }
      admin_update_topic: {
        Args: { p_hidden?: boolean; p_pinned?: boolean; p_topic: string }
        Returns: undefined
      }
      am_i_admin: { Args: never; Returns: boolean }
      block_user: { Args: { p_user: string }; Returns: undefined }
      consume_voice_message: {
        Args: { p_id: string }
        Returns: {
          audio_b64: string
          duration_ms: number
          mime: string
        }[]
      }
      create_group: {
        Args: {
          p_description?: string
          p_name: string
          p_privacy: string
          p_section: string
        }
        Returns: string
      }
      create_post: {
        Args: {
          p_duration_ms?: number
          p_group?: string
          p_mime?: string
          p_path?: string
          p_reply_to?: string
          p_repost_of?: string
          p_section?: string
          p_title?: string
          p_topic?: string
        }
        Returns: string
      }
      delete_group: { Args: { p_group: string }; Returns: undefined }
      delete_post: { Args: { p_post: string }; Returns: undefined }
      discover_groups: {
        Args: { p_limit?: number; p_query?: string; p_section?: string }
        Returns: {
          description: string
          id: string
          members_count: number
          my_pending: string
          my_role: string
          name: string
          posts_count: number
          privacy: string
          section_id: string
        }[]
      }
      feed_posts: {
        Args: {
          p_author?: string
          p_before?: string
          p_group?: string
          p_ids?: string[]
          p_limit?: number
          p_offset?: number
          p_parent?: string
          p_scope: string
          p_section?: string
          p_topic?: string
        }
        Returns: {
          audio_path: string
          author_avatar: string
          author_id: string
          author_name: string
          author_username: string
          created_at: string
          deleted: boolean
          duration_ms: number
          group_id: string
          group_name: string
          is_mine: boolean
          liked: boolean
          likes_count: number
          listens_count: number
          orig_audio_path: string
          orig_author_avatar: string
          orig_author_id: string
          orig_author_name: string
          orig_author_username: string
          orig_created_at: string
          orig_deleted: boolean
          orig_duration_ms: number
          orig_likes_count: number
          orig_listens_count: number
          orig_replies_count: number
          orig_reposts_count: number
          orig_title: string
          post_id: string
          replies_count: number
          reply_to: string
          reply_to_username: string
          repost_of: string
          reposted: boolean
          reposts_count: number
          section_id: string
          title: string
          topic_id: string
          topic_title: string
        }[]
      }
      follow_list: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_user: string
          p_which: string
        }
        Returns: {
          avatar_path: string
          follows_me: boolean
          full_name: string
          i_follow: boolean
          id: string
          username: string
        }[]
      }
      follow_user: { Args: { p_user: string }; Returns: undefined }
      group_detail: {
        Args: { p_group: string }
        Returns: {
          created_at: string
          description: string
          id: string
          invited_by_name: string
          members_count: number
          my_pending: string
          my_role: string
          name: string
          pending_requests: number
          posts_count: number
          privacy: string
          section_id: string
        }[]
      }
      group_members_list: {
        Args: { p_group: string; p_limit?: number; p_offset?: number }
        Returns: {
          avatar_path: string
          full_name: string
          joined_at: string
          role: string
          user_id: string
          username: string
        }[]
      }
      group_requests_list: {
        Args: { p_group: string }
        Returns: {
          avatar_path: string
          created_at: string
          full_name: string
          user_id: string
          username: string
        }[]
      }
      invite_to_group: {
        Args: { p_group: string; p_user: string }
        Returns: undefined
      }
      join_group: { Args: { p_group: string }; Returns: string }
      leave_group: { Args: { p_group: string }; Returns: undefined }
      like_post: { Args: { p_post: string }; Returns: undefined }
      my_blocked: {
        Args: never
        Returns: {
          avatar_path: string
          full_name: string
          id: string
          username: string
        }[]
      }
      my_group_invites: {
        Args: never
        Returns: {
          created_at: string
          id: string
          invited_by_name: string
          invited_by_username: string
          members_count: number
          name: string
          privacy: string
          section_id: string
        }[]
      }
      my_groups: {
        Args: never
        Returns: {
          id: string
          last_post_at: string
          members_count: number
          my_role: string
          name: string
          pending_requests: number
          posts_count: number
          privacy: string
          section_id: string
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
      news_topics: {
        Args: { p_limit?: number; p_offset?: number; p_section?: string }
        Returns: {
          created_at: string
          id: string
          image_url: string
          kind: string
          last_post_at: string
          posts_count: number
          section_id: string
          source_name: string
          source_url: string
          speakers: Json
          speakers_count: number
          title: string
        }[]
      }
      orphan_voice_files: { Args: { p_limit?: number }; Returns: string[] }
      post_ancestors: { Args: { p_post: string }; Returns: string[] }
      profile_stats: {
        Args: { p_user: string }
        Returns: {
          followers: number
          following: number
          follows_me: boolean
          i_follow: boolean
          posts: number
        }[]
      }
      prompt_schedule: {
        Args: { p_days?: number }
        Returns: {
          moment: string
          prompt_at: string
        }[]
      }
      record_listen: { Args: { p_post: string }; Returns: undefined }
      remove_follower: { Args: { p_user: string }; Returns: undefined }
      remove_group_member: {
        Args: { p_group: string; p_user: string }
        Returns: undefined
      }
      report_content: {
        Args: { p_kind: string; p_reason?: string; p_target: string }
        Returns: undefined
      }
      respond_group_request: {
        Args: { p_accept: boolean; p_group: string; p_user: string }
        Returns: undefined
      }
      search_users: {
        Args: { p_query: string }
        Returns: {
          avatar_path: string
          follows_me: boolean
          full_name: string
          i_follow: boolean
          id: string
          username: string
        }[]
      }
      send_voice_message: {
        Args: {
          p_audio_b64: string
          p_duration_ms: number
          p_mime: string
          p_to: string
        }
        Returns: string
      }
      set_group_role: {
        Args: { p_group: string; p_role: string; p_user: string }
        Returns: undefined
      }
      suggested_people: {
        Args: { p_limit?: number }
        Returns: {
          avatar_path: string
          follows_me: boolean
          full_name: string
          i_follow: boolean
          id: string
          username: string
        }[]
      }
      today: {
        Args: never
        Returns: {
          moment: string
          next_prompt_at: string
          prompt_at: string
          topic_id: string
          topic_is_pick: boolean
          topic_section: string
          topic_title: string
        }[]
      }
      trending_topics: {
        Args: { p_limit?: number; p_section?: string }
        Returns: {
          created_at: string
          id: string
          kind: string
          posts_count: number
          recent_posts: number
          section_id: string
          source_name: string
          source_url: string
          title: string
        }[]
      }
      unblock_user: { Args: { p_user: string }; Returns: undefined }
      unfollow_user: { Args: { p_user: string }; Returns: undefined }
      unlike_post: { Args: { p_post: string }; Returns: undefined }
      unrepost: { Args: { p_post: string }; Returns: undefined }
      update_group: {
        Args: {
          p_description?: string
          p_group: string
          p_name: string
          p_privacy: string
          p_section: string
        }
        Returns: undefined
      }
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
