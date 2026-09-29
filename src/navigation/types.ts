import type { NavigatorScreenParams } from '@react-navigation/native';

import type { AppTabParamList } from '@/navigation/AppTabNavigator';
import type { NearbyMapDonorItem } from '@/services/supabase/nearbyMapDonors';
import type { BloodType } from '@/types/database';

export type AuthStackParamList = {
  Welcome: undefined;
  LegalDocument: {
    document: 'terms' | 'privacy';
  };
  Signup: undefined;
  VerifyEmail: {
    email: string;
    resent?: boolean;
  };
  EnterPhone: {
    mode: 'signup' | 'login';
  };
  VerifyOtp: {
    phone: string;
    mode: 'signup' | 'login';
  };
  Login: undefined;
  ForgotPassword: undefined;
};

export type AppStackParamList = {
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  HemieAI: undefined;
  EditProfile: undefined;
  ApplyDonor: undefined;
  Settings: undefined;
  AccountSettings: undefined;
  ProfilePicture: undefined;
  ReportSafety:
    | {
        reportedUserId?: string;
        reportedDisplayName?: string;
        bloodRequestId?: string;
        messageId?: string;
        donationId?: string;
        defaultType?: import('@/types/database').ReportType;
      }
    | undefined;
  SettingsDetail: {
    description: string;
    title: string;
  };
  DonorRequestDetail: { requestId: string; intent?: 'respond' };
  MyDonations: undefined;
  DonationQr: { matchId: string; donationId?: string };
  ProfileQr: undefined;
  DonorPreScreening: undefined;
  MyBloodRequests: undefined;
  CreateBloodRequest: { bloodType?: BloodType; requestId?: string } | undefined;
  BloodRequestDetail: { requestId: string };
  ChatThread: {
    bloodRequestId: string;
    donorMatchId: string;
    recipientId: string;
    recipientDisplayName?: string;
  };
  Notifications: undefined;
  NearbyDonorDetail: { donor: NearbyMapDonorItem };
};
