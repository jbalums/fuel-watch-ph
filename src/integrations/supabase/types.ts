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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      fuel_reports: {
        Row: {
          applied_station_id: string | null
          created_at: string
          fuel_type: string
          id: string
          lat: number | null
          lng: number | null
          photo_filename: string | null
          photo_path: string | null
          price: number
          prices: Json | null
          reported_address: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          station_id: string | null
          station_name: string
          status: string
          user_id: string
        }
        Insert: {
          applied_station_id?: string | null
          created_at?: string
          fuel_type: string
          id?: string
          lat?: number | null
          lng?: number | null
          photo_filename?: string | null
          photo_path?: string | null
          price: number
          prices?: Json | null
          reported_address?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          station_id?: string | null
          station_name: string
          status?: string
          user_id: string
        }
        Update: {
          applied_station_id?: string | null
          created_at?: string
          fuel_type?: string
          id?: string
          lat?: number | null
          lng?: number | null
          photo_filename?: string | null
          photo_path?: string | null
          price?: number
          prices?: Json | null
          reported_address?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          station_id?: string | null
          station_name?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_reports_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "gas_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_reports_applied_station_id_fkey"
            columns: ["applied_station_id"]
            isOneToOne: false
            referencedRelation: "gas_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      gas_stations: {
        Row: {
          address: string
          created_at: string
          fuel_type: string
          id: string
          is_verified: boolean
          lat: number
          lng: number
          manager_user_id: string | null
          name: string
          price_per_liter: number
          prices: Json
          report_count: number
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          address: string
          created_at?: string
          fuel_type?: string
          id?: string
          is_verified?: boolean
          lat: number
          lng: number
          manager_user_id?: string | null
          name: string
          price_per_liter?: number
          prices?: Json
          report_count?: number
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          fuel_type?: string
          id?: string
          is_verified?: boolean
          lat?: number
          lng?: number
          manager_user_id?: string | null
          name?: string
          price_per_liter?: number
          prices?: Json
          report_count?: number
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      station_claim_requests: {
        Row: {
          business_name: string
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          notes: string | null
          proof_document_filename: string | null
          proof_document_path: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          station_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name: string
          contact_name: string
          contact_phone: string
          created_at?: string
          id?: string
          notes?: string | null
          proof_document_filename?: string | null
          proof_document_path?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          station_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          notes?: string | null
          proof_document_filename?: string | null
          proof_document_path?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          station_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_claim_requests_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "gas_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_station_claim: {
        Args: {
          _claim_id: string
        }
        Returns: string
      }
      approve_fuel_report: {
        Args: {
          _report_id: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reject_fuel_report: {
        Args: {
          _report_id: string
        }
        Returns: string
      }
      reject_station_claim: {
        Args: {
          _claim_id: string
        }
        Returns: string
      }
      update_managed_station: {
        Args: {
          _address: string
          _fuel_type: string
          _prices: Json
          _station_id: string
          _status: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
