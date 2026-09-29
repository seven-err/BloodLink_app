import type { BloodRequestStatus, BloodRequestUrgency, BloodType, Database } from '@/types/database';

import { supabase } from './client';

export type BloodRequest = Database['public']['Tables']['blood_requests']['Row'];

export type CreateBloodRequestInput = {
  requesterId: string;
  bloodType: BloodType;
  unitsNeeded: number;
  urgency: BloodRequestUrgency;
  neededAt: string;
  patientName: string;
  hospitalName: string;
  contactPhone: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  attachmentPath?: string | null;
};

export const formatBloodRequestCooldown = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes <= 0) {
    return `${remainder}s`;
  }

  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

export const getBloodRequestCooldownRemainingSeconds = async () => {
  const { data, error } = await supabase.rpc('blood_request_cooldown_remaining_seconds');

  if (error || typeof data !== 'number' || !Number.isFinite(data)) {
    return 0;
  }

  return Math.max(0, Math.ceil(data));
};

export const createBloodRequest = ({
  requesterId,
  bloodType,
  unitsNeeded,
  urgency,
  neededAt,
  patientName,
  hospitalName,
  contactPhone,
  address,
  latitude,
  longitude,
  notes,
  attachmentPath,
}: CreateBloodRequestInput) =>
  supabase
    .from('blood_requests')
    .insert({
      address: address.trim(),
      attachment_path: attachmentPath ?? null,
      blood_type: bloodType,
      contact_phone: contactPhone?.trim() ?? null,
      hospital_name: hospitalName.trim(),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      needed_at: neededAt,
      notes: notes?.trim() || null,
      patient_name: patientName.trim(),
      requester_id: requesterId,
      status: 'open',
      units_needed: unitsNeeded,
      urgency,
    })
    .select()
    .single();

const EDITABLE_BLOOD_REQUEST_STATUSES: BloodRequestStatus[] = ['draft', 'open', 'matched'];

export const canEditBloodRequest = (
  request: Pick<BloodRequest, 'requester_id' | 'status'>,
  userId: string,
) =>
  request.requester_id === userId && EDITABLE_BLOOD_REQUEST_STATUSES.includes(request.status);

export type UpdateBloodRequestInput = {
  bloodType: BloodType;
  unitsNeeded: number;
  urgency: BloodRequestUrgency;
  patientName: string;
  hospitalName: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  attachmentPath?: string | null;
};

export const updateBloodRequest = (
  requestId: string,
  requesterId: string,
  {
    bloodType,
    unitsNeeded,
    urgency,
    patientName,
    hospitalName,
    address,
    latitude,
    longitude,
    notes,
    attachmentPath,
  }: UpdateBloodRequestInput,
) =>
  supabase
    .from('blood_requests')
    .update({
      address: address.trim(),
      ...(attachmentPath !== undefined ? { attachment_path: attachmentPath } : {}),
      blood_type: bloodType,
      hospital_name: hospitalName.trim(),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      notes: notes?.trim() || null,
      patient_name: patientName.trim(),
      units_needed: unitsNeeded,
      urgency,
    })
    .eq('id', requestId)
    .eq('requester_id', requesterId)
    .select()
    .single();

export const getMyBloodRequests = (requesterId: string) =>
  supabase
    .from('blood_requests')
    .select('*')
    .eq('requester_id', requesterId)
    .order('created_at', { ascending: false });

export const getBloodRequestById = (requestId: string) =>
  supabase.from('blood_requests').select('*').eq('id', requestId).maybeSingle();

export const isOwnBloodRequest = async (requestId: string, userId: string) => {
  const { data, error } = await supabase.rpc('is_own_blood_request', {
    p_request_id: requestId,
  });

  if (!error && typeof data === 'boolean') {
    return data;
  }

  const { data: owned } = await supabase
    .from('blood_requests')
    .select('id')
    .eq('id', requestId)
    .eq('requester_id', userId)
    .maybeSingle();

  return Boolean(owned);
};
