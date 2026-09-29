import {
  DONOR_PRE_SCREENING_VERSION,
  type DonorPreScreeningResponses,
} from '@/constants/donorPreScreening';
import type { Json } from '@/types/database';
import { supabase } from './client';

export type DonorPreScreening = Awaited<
  ReturnType<typeof getLatestOwnDonorPreScreening>
>['data'];

export const getLatestOwnDonorPreScreening = (donorId: string) =>
  supabase
    .from('donor_pre_screenings')
    .select('*')
    .eq('donor_id', donorId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

export const submitDonorPreScreening = (responses: DonorPreScreeningResponses) =>
  supabase.rpc('submit_donor_pre_screening', {
    p_acknowledged: true,
    p_questionnaire_version: DONOR_PRE_SCREENING_VERSION,
    p_responses: responses as Json,
  });
