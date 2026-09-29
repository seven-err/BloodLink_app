import { calculateRoute } from '@/services/maps/osm';
import type { Database } from '@/types/database';

import { isOwnBloodRequest } from './bloodRequests';
import { supabase } from './client';

export type DonorMatch = Database['public']['Tables']['donor_matches']['Row'];

export type MatchedBloodRequestDetails = Pick<
  Database['public']['Tables']['blood_requests']['Row'],
  | 'id'
  | 'requester_id'
  | 'blood_type'
  | 'units_needed'
  | 'status'
  | 'urgency'
  | 'patient_name'
  | 'hospital_name'
  | 'contact_phone'
  | 'notes'
  | 'needed_at'
  | 'address'
  | 'latitude'
  | 'longitude'
  | 'created_at'
  | 'updated_at'
>;

const DUPLICATE_MATCH_ERROR_CODE = '23505';

const MATCHED_BLOOD_REQUEST_COLUMNS =
  'id,requester_id,blood_type,units_needed,status,urgency,patient_name,hospital_name,contact_phone,notes,needed_at,address,latitude,longitude,created_at,updated_at' as const;

export type RespondToBloodRequestOptions = {
  donorLatitude?: number | null;
  donorLongitude?: number | null;
  requestLatitude?: number | null;
  requestLongitude?: number | null;
};

export type RespondToBloodRequestResult =
  | { kind: 'created'; match: DonorMatch }
  | { kind: 'duplicate'; match: DonorMatch }
  | { kind: 'error'; message: string };

export const getDonorMatchForRequest = (requestId: string, donorId: string) =>
  supabase
    .from('donor_matches')
    .select('*')
    .eq('request_id', requestId)
    .eq('donor_id', donorId)
    .maybeSingle();

/** Readable only when blood_requests RLS authorizes the current user (e.g. after a match). */
export const getAuthorizedBloodRequestById = (requestId: string) =>
  supabase
    .from('blood_requests')
    .select(MATCHED_BLOOD_REQUEST_COLUMNS)
    .eq('id', requestId)
    .maybeSingle();

const buildMatchMetrics = async ({
  donorLatitude,
  donorLongitude,
  requestLatitude,
  requestLongitude,
}: RespondToBloodRequestOptions) => {
  if (
    donorLatitude == null ||
    donorLongitude == null ||
    requestLatitude == null ||
    requestLongitude == null
  ) {
    return { distanceMeters: null, travelTimeSeconds: null };
  }

  try {
    const route = await calculateRoute(
      { latitude: donorLatitude, longitude: donorLongitude },
      { latitude: requestLatitude, longitude: requestLongitude },
    );

    return {
      distanceMeters: route.distanceMeters,
      travelTimeSeconds: Math.round(route.durationSeconds),
    };
  } catch {
    return { distanceMeters: null, travelTimeSeconds: null };
  }
};

export const respondToBloodRequest = async (
  requestId: string,
  donorId: string,
  options: RespondToBloodRequestOptions = {},
): Promise<RespondToBloodRequestResult> => {
  const { data: existingMatch, error: existingError } = await getDonorMatchForRequest(
    requestId,
    donorId,
  );

  if (existingError) {
    return { kind: 'error', message: existingError.message };
  }

  if (existingMatch) {
    return { kind: 'duplicate', match: existingMatch };
  }

  if (await isOwnBloodRequest(requestId, donorId)) {
    return {
      kind: 'error',
      message: 'You cannot donate to your own blood request.',
    };
  }

  const { distanceMeters, travelTimeSeconds } = await buildMatchMetrics(options);

  const { data, error } = await supabase
    .from('donor_matches')
    .insert({
      donor_id: donorId,
      distance_meters: distanceMeters,
      request_id: requestId,
      responded_at: new Date().toISOString(),
      status: 'pending',
      travel_time_seconds: travelTimeSeconds,
    })
    .select()
    .single();

  if (error) {
    if (error.code === DUPLICATE_MATCH_ERROR_CODE) {
      const { data: racedMatch, error: racedError } = await getDonorMatchForRequest(
        requestId,
        donorId,
      );

      if (racedMatch) {
        return { kind: 'duplicate', match: racedMatch };
      }

      if (racedError) {
        return { kind: 'error', message: racedError.message };
      }
    }

    if (/row-level security|permission denied|not authorized/i.test(error.message)) {
      return {
        kind: 'error',
        message:
          'Unable to record your response. Confirm you are signed in as a donor and the request is still open.',
      };
    }

    return { kind: 'error', message: error.message };
  }

  return { kind: 'created', match: data };
};

export const canShowSensitiveRequestDetails = (match: DonorMatch | null) =>
  match?.status === 'accepted' || match?.status === 'completed';

export type RecipientDonorMatchResponse =
  Database['public']['Views']['recipient_donor_match_responses']['Row'];

const RECIPIENT_DONOR_MATCH_RESPONSE_COLUMNS =
  'id,request_id,donor_id,status,distance_meters,travel_time_seconds,responded_at,created_at,updated_at,donor_name,donor_blood_type,donor_verification_active,donor_verification_status' as const;

export type DonorMatchActionResult =
  | { kind: 'success'; match: DonorMatch }
  | { kind: 'not_found' }
  | { kind: 'invalid_transition'; message: string }
  | { kind: 'error'; message: string };

export const listMatchesForRequest = (requestId: string) =>
  supabase
    .from('recipient_donor_match_responses')
    .select(RECIPIENT_DONOR_MATCH_RESPONSE_COLUMNS)
    .eq('request_id', requestId)
    .order('responded_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

/** Hide raw database exception text from the request-details actions. */
export const describeDonorMatchActionError = (message: string): string => {
  if (/cannot change match status|unauthorized donor match status change/i.test(message)) {
    return 'Only the owner of this request can accept or decline a pending donor response.';
  }

  if (/row-level security|permission denied|access denied/i.test(message)) {
    return 'You are not allowed to update this donor response.';
  }

  return message;
};

const updatePendingDonorMatchStatus = async (
  matchId: string,
  status: 'accepted' | 'declined',
): Promise<DonorMatchActionResult> => {
  const { data: existingMatch, error: fetchError } = await supabase
    .from('donor_matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (fetchError) {
    return { kind: 'error', message: fetchError.message };
  }

  if (!existingMatch) {
    return { kind: 'not_found' };
  }

  if (existingMatch.status !== 'pending') {
    return {
      kind: 'invalid_transition',
      message: `This donor response is already ${existingMatch.status}.`,
    };
  }

  const { data, error } = await supabase
    .from('donor_matches')
    .update({ status })
    .eq('id', matchId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (error) {
    return { kind: 'error', message: describeDonorMatchActionError(error.message) };
  }

  if (!data) {
    return {
      kind: 'invalid_transition',
      message: 'This donor response was already updated.',
    };
  }

  return { kind: 'success', match: data };
};

export const acceptDonorMatch = (matchId: string) =>
  updatePendingDonorMatchStatus(matchId, 'accepted');

export const declineDonorMatch = (matchId: string) =>
  updatePendingDonorMatchStatus(matchId, 'declined');
