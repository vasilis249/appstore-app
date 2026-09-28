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
      booking_equipment: {
        Row: {
          booking_id: string
          created_at: string
          equipment_id: string | null
          id: string
          name: string
          price: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          equipment_id?: string | null
          id?: string
          name: string
          price?: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          equipment_id?: string | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_equipment_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "venue_equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancelled_at: string | null
          court_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          date: string
          duration_hours: number
          id: string
          payment_method: string | null
          player_id: string | null
          price: number
          series_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          type: Database["public"]["Enums"]["booking_type"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          cancelled_at?: string | null
          court_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          date: string
          duration_hours?: number
          id?: string
          payment_method?: string | null
          player_id?: string | null
          price?: number
          series_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          type?: Database["public"]["Enums"]["booking_type"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          cancelled_at?: string | null
          court_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          date?: string
          duration_hours?: number
          id?: string
          payment_method?: string | null
          player_id?: string | null
          price?: number
          series_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          type?: Database["public"]["Enums"]["booking_type"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          accepted: boolean
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          accepted?: boolean
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          accepted?: boolean
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          title: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string | null
          type?: string
        }
        Relationships: []
      }
      court_closures: {
        Row: {
          court_id: string
          created_at: string
          date: string | null
          end_time: string
          id: string
          reason: string | null
          start_time: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          court_id: string
          created_at?: string
          date?: string | null
          end_time: string
          id?: string
          reason?: string | null
          start_time: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          court_id?: string
          created_at?: string
          date?: string | null
          end_time?: string
          id?: string
          reason?: string | null
          start_time?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "court_closures_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      court_pricing: {
        Row: {
          court_id: string
          created_at: string
          days_mask: number
          end_hour: number
          id: string
          label: string
          price_per_hour: number
          start_hour: number
          updated_at: string
        }
        Insert: {
          court_id: string
          created_at?: string
          days_mask?: number
          end_hour: number
          id?: string
          label?: string
          price_per_hour: number
          start_hour: number
          updated_at?: string
        }
        Update: {
          court_id?: string
          created_at?: string
          days_mask?: number
          end_hour?: number
          id?: string
          label?: string
          price_per_hour?: number
          start_hour?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_pricing_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      court_slots: {
        Row: {
          court_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          court_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          court_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_slots_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          created_at: string
          id: string
          name: string
          sport: Database["public"]["Enums"]["sport"]
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sport: Database["public"]["Enums"]["sport"]
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sport?: Database["public"]["Enums"]["sport"]
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          accepted_at: string | null
          created_at: string
          follower_id: string
          following_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          follower_id: string
          following_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          follower_id?: string
          following_id?: string
          status?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      message_reports: {
        Row: {
          action: string | null
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          reason: string | null
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          action?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          reason?: string | null
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          action?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          reason?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          post_id: string | null
          story_id: string | null
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          sender_id: string | null
        }
        Insert: {
          post_id?: string | null
          story_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          sender_id?: string | null
        }
        Update: {
          post_id?: string | null
          story_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      open_game_players: {
        Row: {
          id: string
          joined_at: string
          open_game_id: string
          player_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          open_game_id: string
          player_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          open_game_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_game_players_open_game_id_fkey"
            columns: ["open_game_id"]
            isOneToOne: false
            referencedRelation: "open_games"
            referencedColumns: ["id"]
          },
        ]
      }
      open_games: {
        Row: {
          booking_id: string | null
          created_at: string
          date: string
          host_id: string
          id: string
          level: Database["public"]["Enums"]["player_level"] | null
          max_players: number
          notes: string | null
          sport: Database["public"]["Enums"]["sport"]
          start_time: string
          venue_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          date: string
          host_id: string
          id?: string
          level?: Database["public"]["Enums"]["player_level"] | null
          max_players?: number
          notes?: string | null
          sport: Database["public"]["Enums"]["sport"]
          start_time: string
          venue_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          date?: string
          host_id?: string
          id?: string
          level?: Database["public"]["Enums"]["player_level"] | null
          max_players?: number
          notes?: string | null
          sport?: Database["public"]["Enums"]["sport"]
          start_time?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_games_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_games_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      player_contact_info: {
        Row: {
          created_at: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: []
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
        Relationships: []
      }
      post_saves: {
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
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string
          booking_id: string | null
          caption: string | null
          comment_count: number
          created_at: string
          id: string
          kind: string
          like_count: number
          media: string[]
          open_game_id: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          author_id: string
          booking_id?: string | null
          caption?: string | null
          comment_count?: number
          created_at?: string
          id?: string
          kind?: string
          like_count?: number
          media?: string[]
          open_game_id?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          author_id?: string
          booking_id?: string | null
          caption?: string | null
          comment_count?: number
          created_at?: string
          id?: string
          kind?: string
          like_count?: number
          media?: string[]
          open_game_id?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          is_private: boolean
          username: string
          created_at: string
          disabled: boolean
          discoverable: boolean
          full_name: string | null
          games_played: number
          id: string
          level: Database["public"]["Enums"]["player_level"] | null
          locale: string
          photo_url: string | null
          rating: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          is_private?: boolean
          username?: string
          created_at?: string
          disabled?: boolean
          discoverable?: boolean
          full_name?: string | null
          games_played?: number
          id?: string
          level?: Database["public"]["Enums"]["player_level"] | null
          locale?: string
          photo_url?: string | null
          rating?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          is_private?: boolean
          username?: string
          created_at?: string
          disabled?: boolean
          discoverable?: boolean
          full_name?: string | null
          games_played?: number
          id?: string
          level?: Database["public"]["Enums"]["player_level"] | null
          locale?: string
          photo_url?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          open_game_id: string | null
          rating: number
          reviewer_id: string
          target_player_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          open_game_id?: string | null
          rating: number
          reviewer_id: string
          target_player_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          open_game_id?: string | null
          rating?: number
          reviewer_id?: string
          target_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_open_game_id_fkey"
            columns: ["open_game_id"]
            isOneToOne: false
            referencedRelation: "open_games"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          author_id: string
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_path: string
        }
        Insert: {
          author_id: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_path: string
        }
        Update: {
          author_id?: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_path?: string
        }
        Relationships: []
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: []
      }
      translations_cache: {
        Row: {
          created_at: string
          id: string
          source_hash: string
          source_lang: string
          source_text: string
          target_lang: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_hash: string
          source_lang: string
          source_text: string
          target_lang: string
          translated_text: string
        }
        Update: {
          created_at?: string
          id?: string
          source_hash?: string
          source_lang?: string
          source_text?: string
          target_lang?: string
          translated_text?: string
        }
        Relationships: []
      }
      user_blocks: {
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
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venue_equipment: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          price: number
          sort_order: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_equipment_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_photos: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          storage_path: string
          url: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          storage_path: string
          url: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          storage_path?: string
          url?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_photos_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          amenities: string[]
          approved: boolean
          area: string
          base_price_per_hour: number
          courts_count: number
          created_at: string
          formatted_address: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          owner_id: string | null
          photo_url: string | null
          place_id: string | null
          rating: number | null
          rejection_reason: string | null
          reviews_count: number
          slot_price: number
          sport: Database["public"]["Enums"]["sport"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: string[]
          approved?: boolean
          area: string
          base_price_per_hour?: number
          courts_count?: number
          created_at?: string
          formatted_address?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          owner_id?: string | null
          photo_url?: string | null
          place_id?: string | null
          rating?: number | null
          rejection_reason?: string | null
          reviews_count?: number
          slot_price?: number
          sport: Database["public"]["Enums"]["sport"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: string[]
          approved?: boolean
          area?: string
          base_price_per_hour?: number
          courts_count?: number
          created_at?: string
          formatted_address?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          owner_id?: string | null
          photo_url?: string | null
          place_id?: string | null
          rating?: number | null
          rejection_reason?: string | null
          reviews_count?: number
          slot_price?: number
          sport?: Database["public"]["Enums"]["sport"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      explore_posts: {
        Args: { _before?: string; _limit?: number }
        Returns: {
            author_id: string
            booking_id: string | null
            caption: string | null
            comment_count: number
            created_at: string
            id: string
            kind: string
            like_count: number
            media: string[]
            open_game_id: string | null
            updated_at: string
            venue_id: string | null
          }[]
      }
      feed_posts: {
        Args: { _before?: string; _limit?: number }
        Returns: {
            author_id: string
            booking_id: string | null
            caption: string | null
            comment_count: number
            created_at: string
            id: string
            kind: string
            like_count: number
            media: string[]
            open_game_id: string | null
            updated_at: string
            venue_id: string | null
          }[]
      }
      story_tray: {
        Args: Record<PropertyKey, never>
        Returns: { author_id: string; has_unseen: boolean; latest_at: string; story_count: number }[]
      }
      accept_follow_request: { Args: { _follower: string }; Returns: undefined }
      can_view_profile: { Args: { _target: string; _viewer: string }; Returns: boolean }
      follow_user: { Args: { _target: string }; Returns: string }
      player_match_stats: {
        Args: { _user: string }
        Returns: { matches: number; sport: Database["public"]["Enums"]["sport"] }[]
      }
      remove_follower: { Args: { _follower: string }; Returns: undefined }
      unfollow_user: { Args: { _target: string }; Returns: undefined }
      create_slot_booking: {
        Args: {
          _court_id?: string
          _date: string
          _duration: number
          _max_players: number
          _start: string
          _venue: string
        }
        Returns: Json
      }
      create_whole_booking: {
        Args: {
          _court_id?: string
          _date: string
          _duration: number
          _start: string
          _venue: string
        }
        Returns: Json
      }
      get_owner_player_profile: {
        Args: { _player_id: string }
        Returns: {
          full_name: string
          has_active_booking: boolean
          level: string
          phone: string
          photo_url: string
          player_id: string
          rating: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_admin: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      join_open_game: { Args: { _open_game_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "owner" | "coach" | "player"
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      booking_type: "online" | "phone" | "closed"
      player_level: "beginner" | "intermediate" | "advanced"
      sport:
        | "padel"
        | "tennis"
        | "basketball"
        | "football"
        | "volleyball"
        | "beach_volley"
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
  public: {
    Enums: {
      app_role: ["admin", "owner", "coach", "player"],
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
      booking_type: ["online", "phone", "closed"],
      player_level: ["beginner", "intermediate", "advanced"],
      sport: [
        "padel",
        "tennis",
        "basketball",
        "football",
        "volleyball",
        "beach_volley",
      ],
    },
  },
} as const
