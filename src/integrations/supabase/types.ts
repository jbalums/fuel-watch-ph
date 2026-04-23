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
          city_municipality_code: string | null
          created_at: string
          fuel_availability: Json | null
          fuel_type: string | null
          id: string
          lat: number | null
          lgu_verified_at: string | null
          lgu_verified_by: string | null
          lgu_verified_role: Database["public"]["Enums"]["app_role"] | null
          lng: number | null
          photo_filename: string | null
          photo_path: string | null
          price: number | null
          prices: Json | null
          province_code: string | null
          reported_address: string | null
          is_lgu_verified: boolean
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          station_id: string | null
          station_name: string | null
          status: string | null
          submission_mode: string
          user_id: string | null
        }
        Insert: {
          applied_station_id?: string | null
          city_municipality_code?: string | null
          created_at?: string
          fuel_availability?: Json | null
          fuel_type?: string | null
          id?: string
          lat?: number | null
          lgu_verified_at?: string | null
          lgu_verified_by?: string | null
          lgu_verified_role?: Database["public"]["Enums"]["app_role"] | null
          lng?: number | null
          photo_filename?: string | null
          photo_path?: string | null
          price?: number | null
          prices?: Json | null
          province_code?: string | null
          reported_address?: string | null
          is_lgu_verified?: boolean
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          station_id?: string | null
          station_name?: string | null
          status?: string | null
          submission_mode?: string
          user_id?: string | null
        }
        Update: {
          applied_station_id?: string | null
          city_municipality_code?: string | null
          created_at?: string
          fuel_availability?: Json | null
          fuel_type?: string | null
          id?: string
          lat?: number | null
          lgu_verified_at?: string | null
          lgu_verified_by?: string | null
          lgu_verified_role?: Database["public"]["Enums"]["app_role"] | null
          lng?: number | null
          photo_filename?: string | null
          photo_path?: string | null
          price?: number | null
          prices?: Json | null
          province_code?: string | null
          reported_address?: string | null
          is_lgu_verified?: boolean
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          station_id?: string | null
          station_name?: string | null
          status?: string | null
          submission_mode?: string
          user_id?: string | null
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
          city_municipality_code: string | null
          created_at: string
          fuel_availability: Json
          fuel_type: string | null
          google_place_id: string | null
          id: string
          is_lgu_verified: boolean
          is_verified: boolean
          lat: number
          lgu_verified_at: string | null
          lgu_verified_by: string | null
          lgu_verified_role: Database["public"]["Enums"]["app_role"] | null
          lng: number
          manager_user_id: string | null
          name: string
          price_per_liter: number
          previous_prices: Json
          prices: Json
          price_trends: Json
          province_code: string | null
          report_count: number
          station_brand_logo_id: string | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          address: string
          city_municipality_code?: string | null
          created_at?: string
          fuel_availability?: Json
          fuel_type?: string | null
          google_place_id?: string | null
          id?: string
          is_lgu_verified?: boolean
          is_verified?: boolean
          lat: number
          lgu_verified_at?: string | null
          lgu_verified_by?: string | null
          lgu_verified_role?: Database["public"]["Enums"]["app_role"] | null
          lng: number
          manager_user_id?: string | null
          name: string
          price_per_liter?: number
          previous_prices?: Json
          prices?: Json
          price_trends?: Json
          province_code?: string | null
          report_count?: number
          station_brand_logo_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          address?: string
          city_municipality_code?: string | null
          created_at?: string
          fuel_availability?: Json
          fuel_type?: string | null
          google_place_id?: string | null
          id?: string
          is_lgu_verified?: boolean
          is_verified?: boolean
          lat?: number
          lgu_verified_at?: string | null
          lgu_verified_by?: string | null
          lgu_verified_role?: Database["public"]["Enums"]["app_role"] | null
          lng?: number
          manager_user_id?: string | null
          name?: string
          price_per_liter?: number
          previous_prices?: Json
          prices?: Json
          price_trends?: Json
          province_code?: string | null
          report_count?: number
          station_brand_logo_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      station_brand_logos: {
        Row: {
          brand_name: string
          created_at: string
          id: string
          is_active: boolean
          logo_path: string
          match_keywords: string[]
          updated_at: string
        }
        Insert: {
          brand_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_path: string
          match_keywords?: string[]
          updated_at?: string
        }
        Update: {
          brand_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_path?: string
          match_keywords?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      system_feature_flags: {
        Row: {
          created_at: string
          description: string
          feature_key: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          feature_key: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          feature_key?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      donation_gateways: {
        Row: {
          account_name: string | null
          account_number: string | null
          created_at: string
          gateway_name: string
          id: string
          is_active: boolean
          qr_image_path: string | null
          sort_order: number
          updated_at: string
          wallet_details: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          gateway_name: string
          id?: string
          is_active?: boolean
          qr_image_path?: string | null
          sort_order?: number
          updated_at?: string
          wallet_details?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          gateway_name?: string
          id?: string
          is_active?: boolean
          qr_image_path?: string | null
          sort_order?: number
          updated_at?: string
          wallet_details?: string | null
        }
        Relationships: []
      }
      station_experiences: {
        Row: {
          city_municipality_code: string | null
          created_at: string
          experience_text: string
          external_id: string | null
          id: string
          lat: number | null
          lng: number | null
          photo_filenames: string[]
          photo_paths: string[]
          province_code: string | null
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sentiment: string
          source: string | null
          station_address: string
          station_id: string | null
          station_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city_municipality_code?: string | null
          created_at?: string
          experience_text: string
          external_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          photo_filenames?: string[]
          photo_paths?: string[]
          province_code?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sentiment: string
          source?: string | null
          station_address: string
          station_id?: string | null
          station_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city_municipality_code?: string | null
          created_at?: string
          experience_text?: string
          external_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          photo_filenames?: string[]
          photo_paths?: string[]
          province_code?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sentiment?: string
          source?: string | null
          station_address?: string
          station_id?: string | null
          station_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_experiences_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "gas_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_access_requests: {
        Row: {
          city_municipality_code: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          mobile_number: string
          office_name: string
          position_title: string
          province_code: string
          reason: string
          requested_role: Database["public"]["Enums"]["app_role"]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          city_municipality_code?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          mobile_number: string
          office_name: string
          position_title: string
          province_code: string
          reason: string
          requested_role: Database["public"]["Enums"]["app_role"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          city_municipality_code?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          mobile_number?: string
          office_name?: string
          position_title?: string
          province_code?: string
          reason?: string
          requested_role?: Database["public"]["Enums"]["app_role"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_invites: {
        Row: {
          access_request_id: string | null
          city_municipality_code: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          province_code: string
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          access_request_id?: string | null
          city_municipality_code?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at: string
          full_name?: string | null
          id?: string
          province_code: string
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          access_request_id?: string | null
          city_municipality_code?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          province_code?: string
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      geo_cities_municipalities: {
        Row: {
          code: string
          created_at: string
          name: string
          province_code: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
          province_code: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
          province_code?: string
        }
        Relationships: []
      }
      geo_provinces: {
        Row: {
          code: string
          created_at: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
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
          username: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
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
      user_scopes: {
        Row: {
          city_municipality_code: string | null
          created_at: string
          id: string
          province_code: string
          scope_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city_municipality_code?: string | null
          created_at?: string
          id?: string
          province_code: string
          scope_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city_municipality_code?: string | null
          created_at?: string
          id?: string
          province_code?: string
          scope_type?: string
          updated_at?: string
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
      approve_easy_fuel_report: {
        Args: {
          _city_municipality_code?: string | null
          _fuel_availability?: Json | null
          _prices?: Json | null
          _province_code?: string | null
          _report_id: string
          _reported_address?: string | null
          _station_id?: string | null
          _station_name: string
        }
        Returns: string
      }
      submit_map_fuel_report: {
        Args: {
          _city_municipality_code?: string | null
          _fuel_availability?: Json | null
          _lat?: number | null
          _lng?: number | null
          _photo_filename?: string | null
          _photo_path?: string | null
          _prices?: Json | null
          _province_code?: string | null
          _reported_address?: string | null
          _station_id?: string | null
          _station_name?: string | null
        }
        Returns: string
      }
      approve_admin_access_request: {
        Args: {
          _approved_role: Database["public"]["Enums"]["app_role"]
          _city_municipality_code: string
          _expires_in_days?: number
          _province_code: string
          _request_id: string
          _review_notes: string
        }
        Returns: {
          expires_at: string
          invite_id: string
          invite_token: string
          request_id: string
        }[]
      }
      can_manage_geo_scope: {
        Args: {
          _city_municipality_code: string
          _province_code: string
          _user_id: string
        }
        Returns: boolean
      }
      consume_admin_invite: {
        Args: {
          _full_name: string
          _token: string
          _username: string
        }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_admin_access_request: {
        Args: {
          _request_id: string
        }
        Returns: {
          city_municipality_code: string | null
          city_municipality_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          mobile_number: string
          office_name: string
          position_title: string
          province_code: string
          province_name: string
          reason: string
          requested_role: Database["public"]["Enums"]["app_role"]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          updated_at: string
        }[]
      }
      get_current_user_scope: {
        Args: Record<PropertyKey, never>
        Returns: {
          city_municipality_code: string | null
          city_municipality_name: string | null
          province_code: string
          province_name: string
          scope_type: string
        }[]
      }
      get_public_station_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          average_diesel: number | null
          average_kerosene: number | null
          average_premium_diesel: number | null
          average_premium: number | null
          average_unleaded: number | null
          total_stations: number | null
        }[]
      }
      get_scoped_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          pending_reports: number
          reviewed_reports: number
          total_reports: number
          total_stations: number
        }[]
      }
      get_user_scope: {
        Args: {
          _user_id: string
        }
        Returns: {
          city_municipality_code: string | null
          city_municipality_name: string | null
          province_code: string
          province_name: string
          scope_type: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_legacy_admin: {
        Args: {
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: {
        Args: {
          _user_id: string
        }
        Returns: boolean
      }
      issue_admin_invite_for_request: {
        Args: {
          _expires_in_days?: number
          _request_id: string
        }
        Returns: {
          expires_at: string
          invite_id: string
          invite_token: string
        }[]
      }
      issue_lgu_staff_invite: {
        Args: {
          _email: string
          _expires_in_days?: number
          _full_name?: string
        }
        Returns: {
          expires_at: string
          invite_id: string
          invite_token: string
        }[]
      }
      list_admin_access_requests: {
        Args: Record<PropertyKey, never>
        Returns: {
          city_municipality_code: string | null
          city_municipality_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          mobile_number: string
          office_name: string
          position_title: string
          province_code: string
          province_name: string
          reason: string
          requested_role: Database["public"]["Enums"]["app_role"]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          updated_at: string
        }[]
      }
      list_admin_lgu_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string | null
          city_municipality_code: string | null
          city_municipality_name: string | null
          created_at: string
          display_name: string | null
          email: string | null
          invited_by: string | null
          invited_by_name: string | null
          last_login_at: string | null
          province_code: string
          province_name: string
          role: Database["public"]["Enums"]["app_role"]
          scope_type: string
          user_id: string
          username: string | null
        }[]
      }
      list_admin_invites: {
        Args: Record<PropertyKey, never>
        Returns: {
          access_request_id: string | null
          city_municipality_code: string | null
          city_municipality_name: string | null
          created_at: string
          created_by: string
          created_by_name: string | null
          email: string
          expires_at: string
          full_name: string | null
          id: string
          province_code: string
          province_name: string
          role: Database["public"]["Enums"]["app_role"]
          used_at: string | null
          used_by: string | null
          used_by_name: string | null
        }[]
      }
      list_public_gas_stations: {
        Args: {
          _city_municipality_code?: string | null
          _fuel_filter?: string | null
          _page?: number | null
          _page_size?: number | null
          _province_code?: string | null
          _search?: string | null
          _sort_by?: string | null
          _status_filter?: string | null
          _exclude_unpriced?: boolean | null
          _user_lat?: number | null
          _user_lng?: number | null
        }
        Returns: {
          address: string | null
          city_municipality_code: string | null
          created_at: string | null
          fuel_availability: Json | null
          fuel_type: string | null
          google_place_id: string | null
          id: string | null
          is_lgu_verified: boolean | null
          is_verified: boolean | null
          lat: number | null
          lgu_verified_at: string | null
          lgu_verified_by: string | null
          lgu_verified_role: Database["public"]["Enums"]["app_role"] | null
          lng: number | null
          manager_user_id: string | null
          name: string | null
          price_per_liter: number | null
          previous_prices: Json | null
          prices: Json | null
          price_trends: Json | null
          province_code: string | null
          report_count: number | null
          status: string | null
          total_count: number | null
          updated_at: string | null
          verified_at: string | null
        }[]
      }
      list_scoped_fuel_reports: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["fuel_reports"]["Row"][]
      }
      list_scoped_gas_stations: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["gas_stations"]["Row"][]
      }
      list_manageable_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          access_level: Database["public"]["Enums"]["app_role"]
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          last_login_at: string | null
          user_id: string
        }[]
      }
      list_lgu_scope_members: {
        Args: Record<PropertyKey, never>
        Returns: {
          city_municipality_code: string | null
          city_municipality_name: string | null
          created_at: string
          display_name: string | null
          email: string
          invited_by: string | null
          invited_by_name: string | null
          province_code: string
          province_name: string
          role: Database["public"]["Enums"]["app_role"]
          scope_type: string
          user_id: string
          username: string | null
        }[]
      }
      list_lgu_staff_invites: {
        Args: Record<PropertyKey, never>
        Returns: {
          city_municipality_code: string | null
          city_municipality_name: string | null
          created_at: string
          created_by: string
          created_by_name: string | null
          email: string
          expires_at: string
          full_name: string | null
          id: string
          province_code: string
          province_name: string
          used_at: string | null
          used_by: string | null
          used_by_name: string | null
        }[]
      }
      reject_fuel_report: {
        Args: {
          _report_id: string
        }
        Returns: string
      }
      reject_admin_access_request: {
        Args: {
          _request_id: string
          _review_notes: string
        }
        Returns: string
      }
      reject_station_claim: {
        Args: {
          _claim_id: string
        }
        Returns: string
      }
      revoke_lgu_staff_access: {
        Args: {
          _target_user_id: string
        }
        Returns: string
      }
      set_user_access_level: {
        Args: {
          _access_level: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      submit_admin_access_request: {
        Args: {
          _city_municipality_code: string
          _email: string
          _full_name: string
          _mobile_number: string
          _office_name: string
          _position_title: string
          _province_code: string
          _reason: string
          _requested_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      validate_admin_invite: {
        Args: {
          _token: string
        }
        Returns: {
          city_municipality_code: string | null
          city_municipality_name: string | null
          email: string
          expires_at: string
          full_name: string | null
          invite_id: string
          province_code: string
          province_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      update_managed_station: {
        Args: {
          _address: string
          _fuel_availability: Json
          _fuel_type: string
          _prices: Json
          _station_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "super_admin"
        | "province_admin"
        | "city_admin"
        | "lgu_staff"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "super_admin",
        "province_admin",
        "city_admin",
        "lgu_staff",
      ],
    },
  },
} as const
