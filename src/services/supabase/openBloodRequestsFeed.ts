import type { Database } from '@/types/database';

import { supabase } from './client';

export type OpenBloodRequestFeedItem =
  Database['public']['Views']['open_blood_requests_feed']['Row'];

/** Safe columns exposed to unmatched donors via open_blood_requests_feed. */
const OPEN_BLOOD_REQUESTS_FEED_COLUMNS =
  'id,blood_type,units_needed,urgency,needed_at,hospital_name,address,latitude,longitude,created_at,updated_at' as const;

const withoutOwnRequests = async <T extends { id: string }>(rows: T[] | null) => {
  if (!rows?.length) {
    return rows;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;

  if (!userId) {
    return rows;
  }

  const { data: ownRequests, error } = await supabase
    .from('blood_requests')
    .select('id')
    .eq('requester_id', userId);

  if (error || !ownRequests?.length) {
    return rows;
  }

  const ownIds = new Set(ownRequests.map((request) => request.id));
  return rows.filter((row) => !ownIds.has(row.id));
};

export const getOpenBloodRequestsFeed = async () => {
  const result = await supabase
    .from('open_blood_requests_feed')
    .select(OPEN_BLOOD_REQUESTS_FEED_COLUMNS)
    .order('created_at', { ascending: false });

  if (result.error) {
    return result;
  }

  return {
    ...result,
    data: (await withoutOwnRequests(result.data)) ?? [],
  };
};

export const getOpenBloodRequestById = async (requestId: string) => {
  const result = await supabase
    .from('open_blood_requests_feed')
    .select(OPEN_BLOOD_REQUESTS_FEED_COLUMNS)
    .eq('id', requestId)
    .maybeSingle();

  if (result.error || !result.data) {
    return result;
  }

  const visible = await withoutOwnRequests([result.data]);
  return {
    ...result,
    data: visible?.[0] ?? null,
  };
};
