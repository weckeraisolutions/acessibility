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
      pages: {
        Row: {
          audiobook_audio_duration_seconds: number | null
          audiobook_audio_url: string | null
          audiobook_status: string
          audiobook_style: string | null
          audiobook_text: string | null
          audiobook_voice: string | null
          audiodesc_audio_duration_seconds: number | null
          audiodesc_audio_url: string | null
          audiodesc_status: string
          audiodesc_style: string | null
          audiodesc_text: string | null
          audiodesc_voice: string | null
          created_at: string
          id: string
          image_url: string | null
          page_number: number
          project_id: string
          thumbnail_url: string | null
          updated_at: string
          video_animations: Json | null
          video_clip_url: string | null
          video_regions: Json | null
          video_status: string
          video_timestamps: Json | null
          video_transition: string | null
        }
        Insert: {
          audiobook_audio_duration_seconds?: number | null
          audiobook_audio_url?: string | null
          audiobook_status?: string
          audiobook_style?: string | null
          audiobook_text?: string | null
          audiobook_voice?: string | null
          audiodesc_audio_duration_seconds?: number | null
          audiodesc_audio_url?: string | null
          audiodesc_status?: string
          audiodesc_style?: string | null
          audiodesc_text?: string | null
          audiodesc_voice?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          page_number: number
          project_id: string
          thumbnail_url?: string | null
          updated_at?: string
          video_animations?: Json | null
          video_clip_url?: string | null
          video_regions?: Json | null
          video_status?: string
          video_timestamps?: Json | null
          video_transition?: string | null
        }
        Update: {
          audiobook_audio_duration_seconds?: number | null
          audiobook_audio_url?: string | null
          audiobook_status?: string
          audiobook_style?: string | null
          audiobook_text?: string | null
          audiobook_voice?: string | null
          audiodesc_audio_duration_seconds?: number | null
          audiodesc_audio_url?: string | null
          audiodesc_status?: string
          audiodesc_style?: string | null
          audiodesc_text?: string | null
          audiodesc_voice?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          page_number?: number
          project_id?: string
          thumbnail_url?: string | null
          updated_at?: string
          video_animations?: Json | null
          video_clip_url?: string | null
          video_regions?: Json | null
          video_status?: string
          video_timestamps?: Json | null
          video_transition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          elevenlabs_default_model: string | null
          elevenlabs_default_voice_id: string | null
          email: string
          id: string
          month_reset_at: string
          name: string
          pages_used_month: number
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          use_elevenlabs: boolean | null
        }
        Insert: {
          created_at?: string
          elevenlabs_default_model?: string | null
          elevenlabs_default_voice_id?: string | null
          email: string
          id: string
          month_reset_at?: string
          name: string
          pages_used_month?: number
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          use_elevenlabs?: boolean | null
        }
        Update: {
          created_at?: string
          elevenlabs_default_model?: string | null
          elevenlabs_default_voice_id?: string | null
          email?: string
          id?: string
          month_reset_at?: string
          name?: string
          pages_used_month?: number
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          use_elevenlabs?: boolean | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          audiobook_global_style: string | null
          audiobook_global_voice: string | null
          audiodesc_global_style: string | null
          audiodesc_global_voice: string | null
          book_title: string | null
          book_type: string
          created_at: string
          id: string
          name: string
          pdf_url: string | null
          processing_status: string
          total_pages: number
          updated_at: string
          user_id: string
          videobook_global_transition: string | null
          videobook_global_visual_style: string | null
          videobook_output_format: string | null
          videobook_url: string | null
        }
        Insert: {
          audiobook_global_style?: string | null
          audiobook_global_voice?: string | null
          audiodesc_global_style?: string | null
          audiodesc_global_voice?: string | null
          book_title?: string | null
          book_type?: string
          created_at?: string
          id?: string
          name: string
          pdf_url?: string | null
          processing_status?: string
          total_pages?: number
          updated_at?: string
          user_id: string
          videobook_global_transition?: string | null
          videobook_global_visual_style?: string | null
          videobook_output_format?: string | null
          videobook_url?: string | null
        }
        Update: {
          audiobook_global_style?: string | null
          audiobook_global_voice?: string | null
          audiodesc_global_style?: string | null
          audiodesc_global_voice?: string | null
          book_title?: string | null
          book_type?: string
          created_at?: string
          id?: string
          name?: string
          pdf_url?: string | null
          processing_status?: string
          total_pages?: number
          updated_at?: string
          user_id?: string
          videobook_global_transition?: string | null
          videobook_global_visual_style?: string | null
          videobook_output_format?: string | null
          videobook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
