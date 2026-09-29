import type { Database, ReportType } from '@/types/database';

import { supabase } from './client';

export type AppReport = Database['public']['Tables']['reports']['Row'];

export const REPORT_REASON_OPTIONS = [
  'Suspicious activity',
  'Misuse of the platform',
  'Harassment',
  'Impersonation',
  'False eligibility claims',
  'False emergency call',
  'Other',
] as const;

export type ReportReasonOption = (typeof REPORT_REASON_OPTIONS)[number];

export type SubmitReportInput = {
  type: ReportType;
  reason: string;
  details?: string | null;
  reportedUserId?: string | null;
  bloodRequestId?: string | null;
  messageId?: string | null;
  donationId?: string | null;
};

function reportErrorMessage(error: { message?: string; code?: string } | null): string {
  if (!error?.message) {
    return 'Unable to submit the report. Please try again.';
  }
  const message = error.message.toLowerCase();
  if (message.includes('unauthorized') || error.code === '42501') {
    return 'You are not allowed to submit this report.';
  }
  if (message.includes('yourself')) {
    return 'You cannot report yourself.';
  }
  if (message.includes('reason')) {
    return 'Please choose a valid report reason.';
  }
  return 'Unable to submit the report. Please try again.';
}

/**
 * Submit a safety report through the SECURITY DEFINER RPC.
 * Prefer this over direct table inserts so target ownership is validated server-side.
 */
export async function submitReport(
  input: SubmitReportInput,
): Promise<{ data: AppReport | null; error: string | null }> {
  const { data, error } = await supabase.rpc('submit_report', {
    p_type: input.type,
    p_reason: input.reason.trim(),
    p_details: input.details?.trim() ? input.details.trim() : null,
    p_reported_user_id: input.reportedUserId ?? null,
    p_blood_request_id: input.bloodRequestId ?? null,
    p_message_id: input.messageId ?? null,
    p_donation_id: input.donationId ?? null,
  });

  if (error) {
    return { data: null, error: reportErrorMessage(error) };
  }

  return {
    data: data as AppReport,
    error: null,
  };
}
