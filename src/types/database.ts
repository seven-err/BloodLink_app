export type UserRole = 'donor' | 'recipient' | 'bloodbank' | 'admin';

export type BloodType =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';

export type BloodRequestStatus =
  | 'draft'
  | 'open'
  | 'matched'
  | 'fulfilled'
  | 'cancelled'
  | 'expired';

export type BloodRequestUrgency = 'normal' | 'urgent' | 'critical';

export type DonorVerificationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

export type BloodbankVerificationStatus = 'pending' | 'approved' | 'rejected';

export type OnboardingRole = Extract<UserRole, 'donor' | 'recipient'>;

export type DonorMatchStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed';

export type DonationStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type NotificationType =
  | 'blood_request'
  | 'donor_match'
  | 'donation'
  | 'verification'
  | 'system';

export type MessageStatus = 'sent' | 'read' | 'archived';

export type AvailabilityStatus = 'available' | 'unavailable' | 'scheduled';

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export type ReportType =
  | 'user'
  | 'blood_request'
  | 'message'
  | 'donation'
  | 'system';

export type ReportModerationActionType =
  | 'review'
  | 'resolve'
  | 'dismiss'
  | 'warn';

export type AnalyticsEventType =
  | 'screen_view'
  | 'auth'
  | 'blood_request'
  | 'donation'
  | 'matching'
  | 'notification'
  | 'system';

export type InventoryStockStatus = 'stable' | 'low' | 'critical';

export type DonorPreScreeningStatus = 'completed' | 'reviewed';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          phone: string | null;
          blood_type: BloodType | null;
          birthdate: string | null;
          weight_kg: number | null;
          last_donation_at: string | null;
          organization_name: string | null;
          avatar_path: string | null;
          latitude: number | null;
          longitude: number | null;
          location: unknown | null;
          address: string | null;
          is_available: boolean;
          visible_on_map: boolean;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name: string;
          phone?: string | null;
          blood_type?: BloodType | null;
          birthdate?: string | null;
          weight_kg?: number | null;
          last_donation_at?: string | null;
          organization_name?: string | null;
          avatar_path?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          address?: string | null;
          is_available?: boolean;
          visible_on_map?: boolean;
          onboarding_completed?: boolean;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      donor_verifications: {
        Row: {
          id: string;
          donor_id: string;
          status: DonorVerificationStatus;
          document_path: string;
          notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          donor_id: string;
          status?: DonorVerificationStatus;
          document_path: string;
          notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          expires_at?: string | null;
        };
        Update: Partial<
          Database['public']['Tables']['donor_verifications']['Insert']
        >;
        Relationships: [];
      };
      donor_pre_screenings: {
        Row: {
          id: string;
          donor_id: string;
          questionnaire_version: string;
          responses: Json;
          requires_staff_review: boolean;
          acknowledged_at: string;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          donor_id: string;
          questionnaire_version: string;
          responses: Json;
          requires_staff_review?: boolean;
          acknowledged_at?: string;
          completed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['donor_pre_screenings']['Insert']>;
        Relationships: [];
      };
      donor_pre_screening_reviews: {
        Row: {
          id: string;
          pre_screening_id: string;
          donation_id: string;
          reviewer_id: string;
          review_status: 'reviewed';
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pre_screening_id: string;
          donation_id: string;
          reviewer_id: string;
          review_status?: 'reviewed';
          notes?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      bloodbank_verifications: {
        Row: {
          id: string;
          profile_id: string;
          status: BloodbankVerificationStatus;
          position: string;
          employee_id: string;
          hospital_name: string;
          branch_location: string;
          work_email: string;
          work_phone: string;
          document_paths: string[];
          notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          status?: BloodbankVerificationStatus;
          position: string;
          employee_id: string;
          hospital_name: string;
          branch_location: string;
          work_email: string;
          work_phone: string;
          document_paths: string[];
          notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Update: Partial<
          Database['public']['Tables']['bloodbank_verifications']['Insert']
        >;
        Relationships: [];
      };
      blood_requests: {
        Row: {
          id: string;
          requester_id: string;
          blood_type: BloodType;
          units_needed: number;
          status: BloodRequestStatus;
          urgency: BloodRequestUrgency;
          patient_name: string | null;
          hospital_name: string;
          contact_phone: string | null;
          attachment_path: string | null;
          notes: string | null;
          needed_at: string | null;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          location: unknown | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          blood_type: BloodType;
          units_needed: number;
          status?: BloodRequestStatus;
          urgency?: BloodRequestUrgency;
          patient_name?: string | null;
          hospital_name: string;
          contact_phone?: string | null;
          attachment_path?: string | null;
          notes?: string | null;
          needed_at?: string | null;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
        };
        Update: Partial<
          Database['public']['Tables']['blood_requests']['Insert']
        >;
        Relationships: [];
      };
      donor_matches: {
        Row: {
          id: string;
          request_id: string;
          donor_id: string;
          status: DonorMatchStatus;
          distance_meters: number | null;
          travel_time_seconds: number | null;
          responded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          donor_id: string;
          status?: DonorMatchStatus;
          distance_meters?: number | null;
          travel_time_seconds?: number | null;
          responded_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['donor_matches']['Insert']>;
        Relationships: [];
      };
      donations: {
        Row: {
          id: string;
          match_id: string;
          donor_id: string;
          request_id: string;
          bloodbank_id: string | null;
          status: DonationStatus;
          scheduled_at: string | null;
          completed_at: string | null;
          units_donated: number | null;
          notes: string | null;
          verification_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          donor_id: string;
          request_id: string;
          bloodbank_id?: string | null;
          status?: DonationStatus;
          scheduled_at?: string | null;
          completed_at?: string | null;
          units_donated?: number | null;
          notes?: string | null;
          verification_token?: string;
        };
        Update: Partial<Database['public']['Tables']['donations']['Insert']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          data: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          data?: Json;
          read_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          push_enabled: boolean;
          emergency_alerts: boolean;
          message_notifications: boolean;
          sms_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          push_enabled?: boolean;
          emergency_alerts?: boolean;
          message_notifications?: boolean;
          sms_enabled?: boolean;
        };
        Update: Partial<
          Database['public']['Tables']['notification_preferences']['Insert']
        >;
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android' | 'web';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android' | 'web';
        };
        Update: Partial<Database['public']['Tables']['push_tokens']['Insert']>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          blood_request_id: string | null;
          donor_match_id: string | null;
          body: string;
          status: MessageStatus;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          blood_request_id?: string | null;
          donor_match_id?: string | null;
          body: string;
          status?: MessageStatus;
          read_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
        Relationships: [];
      };
      conversation_states: {
        Row: {
          user_id: string;
          donor_match_id: string;
          status: 'active' | 'archived' | 'deleted';
          updated_at: string;
        };
        Insert: {
          user_id: string;
          donor_match_id: string;
          status: 'active' | 'archived' | 'deleted';
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conversation_states']['Insert']>;
        Relationships: [];
      };
      availability: {
        Row: {
          id: string;
          user_id: string;
          status: AvailabilityStatus;
          starts_at: string;
          ends_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: AvailabilityStatus;
          starts_at: string;
          ends_at?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['availability']['Insert']>;
        Relationships: [];
      };
      faqs: {
        Row: {
          id: string;
          question: string;
          answer: string;
          category: string;
          display_order: number;
          is_published: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          answer: string;
          category?: string;
          display_order?: number;
          is_published?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['faqs']['Insert']>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string | null;
          blood_request_id: string | null;
          message_id: string | null;
          donation_id: string | null;
          type: ReportType;
          status: ReportStatus;
          reason: string;
          details: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          resolution_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_user_id?: string | null;
          blood_request_id?: string | null;
          message_id?: string | null;
          donation_id?: string | null;
          type: ReportType;
          status?: ReportStatus;
          reason: string;
          details?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          resolution_notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['reports']['Insert']>;
        Relationships: [];
      };
      report_moderation_actions: {
        Row: {
          id: string;
          report_id: string;
          actor_id: string;
          action: ReportModerationActionType;
          previous_status: ReportStatus;
          resulting_status: ReportStatus;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          actor_id: string;
          action: ReportModerationActionType;
          previous_status: ReportStatus;
          resulting_status: ReportStatus;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['report_moderation_actions']['Insert']
        >;
        Relationships: [];
      };
      analytics: {
        Row: {
          id: string;
          user_id: string | null;
          event_type: AnalyticsEventType;
          event_name: string;
          metadata: Json;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_type: AnalyticsEventType;
          event_name: string;
          metadata?: Json;
          occurred_at?: string;
        };
        Update: Partial<Database['public']['Tables']['analytics']['Insert']>;
        Relationships: [];
      };
      blood_inventory: {
        Row: {
          id: string;
          bloodbank_id: string;
          blood_type: BloodType;
          quantity: number;
          low_threshold: number;
          critical_threshold: number;
          stock_status: InventoryStockStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bloodbank_id: string;
          blood_type: BloodType;
          quantity?: number;
          low_threshold?: number;
          critical_threshold?: number;
        };
        Update: Partial<Database['public']['Tables']['blood_inventory']['Insert']>;
        Relationships: [];
      };
      blood_inventory_adjustments: {
        Row: {
          id: string;
          inventory_id: string;
          previous_quantity: number;
          adjustment_amount: number;
          resulting_quantity: number;
          reason: string;
          adjusted_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          inventory_id: string;
          previous_quantity: number;
          adjustment_amount: number;
          resulting_quantity: number;
          reason: string;
          adjusted_by: string;
        };
        Update: Partial<
          Database['public']['Tables']['blood_inventory_adjustments']['Insert']
        >;
        Relationships: [];
      };
    };
    Views: {
      open_blood_requests_feed: {
        Row: {
          id: string;
          blood_type: BloodType;
          units_needed: number;
          urgency: BloodRequestUrgency;
          needed_at: string | null;
          hospital_name: string;
          address: string;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
      recipient_donor_match_responses: {
        Row: {
          id: string;
          request_id: string;
          donor_id: string;
          status: DonorMatchStatus;
          distance_meters: number | null;
          travel_time_seconds: number | null;
          responded_at: string | null;
          created_at: string;
          updated_at: string;
          donor_name: string;
          donor_blood_type: BloodType;
          donor_verification_active: boolean;
          donor_verification_status: DonorVerificationStatus | null;
        };
        Relationships: [];
      };
      conversation_counterparts: {
        Row: {
          donor_match_id: string;
          blood_request_id: string;
          other_party_id: string;
          display_name: string;
          blood_type: BloodType | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      submit_donor_pre_screening: {
        Args: {
          p_questionnaire_version: string;
          p_responses: Json;
          p_acknowledged: boolean;
        };
        Returns: Database['public']['Tables']['donor_pre_screenings']['Row'];
      };
      get_donor_pre_screening_summary: {
        Args: { p_donation_id: string };
        Returns: Array<{
          id: string;
          donor_id: string;
          questionnaire_version: string;
          status: DonorPreScreeningStatus;
          requires_staff_review: boolean;
          completed_at: string;
          review_status: 'reviewed' | null;
          reviewed_at: string | null;
        }>;
      };
      get_donor_pre_screening_detail: {
        Args: { p_donation_id: string };
        Returns: Array<{
          id: string;
          donor_id: string;
          questionnaire_version: string;
          responses: Json;
          requires_staff_review: boolean;
          acknowledged_at: string;
          completed_at: string;
          review_status: 'reviewed' | null;
          review_notes: string | null;
          reviewed_by: string | null;
          reviewer_name: string | null;
          reviewed_at: string | null;
          review_history: Json;
        }>;
      };
      review_donor_pre_screening: {
        Args: {
          p_donation_id: string;
          p_pre_screening_id: string;
          p_review_notes?: string | null;
        };
        Returns: Database['public']['Tables']['donor_pre_screening_reviews']['Row'];
      };
      is_admin: {
        Args: {
          user_id?: string;
        };
        Returns: boolean;
      };
      is_bloodbank: {
        Args: {
          user_id?: string;
        };
        Returns: boolean;
      };
      blood_request_cooldown_remaining_seconds: {
        Args: {
          p_requester_id?: string;
        };
        Returns: number;
      };
      is_matched_donor_for_request: {
        Args: {
          request_id: string;
          user_id?: string;
        };
        Returns: boolean;
      };
      is_donor_verification_active: {
        Args: {
          donor_id: string;
        };
        Returns: boolean;
      };
      is_elevated_role_context: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      nearby_eligible_donors: {
        Args: {
          request_id: string;
          radius_km?: number;
          max_results?: number;
        };
        Returns: {
          donor_id: string;
          full_name: string;
          blood_type: BloodType;
          distance_meters: number;
        }[];
      };
      nearby_map_donors: {
        Args: {
          origin_lat: number;
          origin_lng: number;
          radius_km?: number;
          max_results?: number;
          filter_blood_type?: BloodType | null;
          available_only?: boolean;
        };
        Returns: {
          donor_id: string;
          full_name: string;
          blood_type: BloodType;
          is_available: boolean;
          latitude: number;
          longitude: number;
          donation_count: number;
          last_donation_at: string | null;
          is_verified: boolean;
        }[];
      };
      sanitize_user_role: {
        Args: {
          raw_role: string;
        };
        Returns: UserRole;
      };
      ensure_donation_for_accepted_match: {
        Args: {
          p_match_id: string;
        };
        Returns: Database['public']['Tables']['donations']['Row'];
      };
      verify_donation_qr: {
        Args: {
          p_donation_id: string;
          p_token: string;
        };
        Returns: Json;
      };
      get_donation_qr_token: {
        Args: {
          p_donation_id: string;
        };
        Returns: string;
      };
      complete_verified_donation: {
        Args: {
          p_donation_id: string;
          p_token: string;
          p_units_donated?: number;
          p_notes?: string;
        };
        Returns: Json;
      };
      set_donor_match_status: {
        Args: {
          p_match_id: string;
          p_status: DonorMatchStatus;
        };
        Returns: Database['public']['Tables']['donor_matches']['Row'];
      };
      set_blood_request_status: {
        Args: {
          p_request_id: string;
          p_status: BloodRequestStatus;
        };
        Returns: Database['public']['Tables']['blood_requests']['Row'];
      };
      set_donation_status: {
        Args: {
          p_donation_id: string;
          p_status: DonationStatus;
        };
        Returns: Json;
      };
      is_bloodbank_verified: {
        Args: {
          user_id?: string;
        };
        Returns: boolean;
      };
      review_bloodbank_verification: {
        Args: {
          p_verification_id: string;
          p_status: BloodbankVerificationStatus;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['bloodbank_verifications']['Row'];
      };
      users_share_request_context: {
        Args: {
          a: string;
          b: string;
        };
        Returns: boolean;
      };
      is_own_blood_request: {
        Args: {
          p_request_id: string;
        };
        Returns: boolean;
      };
      set_conversation_state: {
        Args: {
          p_donor_match_id: string;
          p_status: string;
        };
        Returns: undefined;
      };
      can_manage_blood_inventory: {
        Args: {
          p_bloodbank_id: string;
        };
        Returns: boolean;
      };
      ensure_blood_inventory: {
        Args: {
          p_bloodbank_id: string;
        };
        Returns: Database['public']['Tables']['blood_inventory']['Row'][];
      };
      adjust_blood_inventory: {
        Args: {
          p_bloodbank_id: string;
          p_blood_type: BloodType;
          p_delta: number;
          p_reason: string;
        };
        Returns: Database['public']['Tables']['blood_inventory']['Row'];
      };
      set_blood_inventory_thresholds: {
        Args: {
          p_bloodbank_id: string;
          p_blood_type: BloodType;
          p_low_threshold: number;
          p_critical_threshold: number;
        };
        Returns: Database['public']['Tables']['blood_inventory']['Row'];
      };
      list_blood_inventory_sites: {
        Args: Record<string, never>;
        Returns: {
          bloodbank_id: string;
          display_name: string;
          organization_name: string | null;
          hospital_name: string | null;
          branch_location: string | null;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          total_units: number;
          critical_count: number;
          low_count: number;
          stable_count: number;
          stock: Json;
        }[];
      };
      list_verified_bloodbank_facilities: {
        Args: Record<string, never>;
        Returns: {
          bloodbank_id: string;
          display_name: string;
          branch_location: string | null;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
        }[];
      };
      get_blood_inventory_summary: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_admin_predictive_analytics: {
        Args: Record<string, never>;
        Returns: Json;
      };
      submit_report: {
        Args: {
          p_type: ReportType;
          p_reason: string;
          p_details?: string | null;
          p_reported_user_id?: string | null;
          p_blood_request_id?: string | null;
          p_message_id?: string | null;
          p_donation_id?: string | null;
        };
        Returns: Database['public']['Tables']['reports']['Row'];
      };
      review_report: {
        Args: {
          p_report_id: string;
          p_status: ReportStatus;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['reports']['Row'];
      };
      warn_reported_user: {
        Args: {
          p_report_id: string;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['reports']['Row'];
      };
    };
    Enums: {
      analytics_event_type: AnalyticsEventType;
      availability_status: AvailabilityStatus;
      blood_request_status: BloodRequestStatus;
      blood_type: BloodType;
      donation_status: DonationStatus;
      donor_match_status: DonorMatchStatus;
      donor_verification_status: DonorVerificationStatus;
      inventory_stock_status: InventoryStockStatus;
      message_status: MessageStatus;
      notification_type: NotificationType;
      report_moderation_action: ReportModerationActionType;
      report_status: ReportStatus;
      report_type: ReportType;
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
};

