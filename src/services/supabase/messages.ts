import type { BloodType, Database } from '@/types/database';

import { supabase } from './client';

export type AppMessage = Database['public']['Tables']['messages']['Row'];

export type MessageConversationContext = {
  bloodRequestId: string;
  donorMatchId: string;
  recipientId: string;
};

export type MessagingAuthorizationResult =
  | { kind: 'authorized' }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'error'; message: string };

const MESSAGING_ELIGIBLE_MATCH_STATUSES = ['accepted', 'completed'] as const;

export const verifyMessagingAuthorized = async (
  context: MessageConversationContext,
  currentUserId: string,
): Promise<MessagingAuthorizationResult> => {
  const { data: match, error: matchError } = await supabase
    .from('donor_matches')
    .select('id, donor_id, request_id, status')
    .eq('id', context.donorMatchId)
    .eq('request_id', context.bloodRequestId)
    .maybeSingle();

  if (matchError) {
    return { kind: 'error', message: matchError.message };
  }

  if (!match) {
    return { kind: 'unauthorized', message: 'This conversation is not available.' };
  }

  if (
    !MESSAGING_ELIGIBLE_MATCH_STATUSES.includes(
      match.status as (typeof MESSAGING_ELIGIBLE_MATCH_STATUSES)[number],
    )
  ) {
    return {
      kind: 'unauthorized',
      message: 'Messaging is only available after a match is accepted.',
    };
  }

  const { data: request, error: requestError } = await supabase
    .from('blood_requests')
    .select('requester_id')
    .eq('id', context.bloodRequestId)
    .maybeSingle();

  if (requestError) {
    return { kind: 'error', message: requestError.message };
  }

  if (!request) {
    return { kind: 'unauthorized', message: 'Blood request not found.' };
  }

  const requesterId = request.requester_id;
  const donorId = match.donor_id;

  const isRequester = currentUserId === requesterId;
  const isDonor = currentUserId === donorId;

  if (!isRequester && !isDonor) {
    return { kind: 'unauthorized', message: 'You are not a participant in this conversation.' };
  }

  if (requesterId === donorId) {
    return {
      kind: 'unauthorized',
      message: 'You cannot chat on your own blood request.',
    };
  }

  const expectedOtherPartyId = isRequester ? donorId : requesterId;

  if (context.recipientId !== expectedOtherPartyId) {
    return { kind: 'unauthorized', message: 'Invalid conversation participant.' };
  }

  return { kind: 'authorized' };
};

export type ConversationInboxStatus = 'active' | 'archived';

export type ConversationPreview = {
  bloodRequestId: string;
  donorMatchId: string;
  otherPartyId: string;
  displayName: string;
  bloodType: BloodType | null;
  lastMessageBody: string;
  lastMessageAt: string;
  unreadCount: number;
  inboxStatus: ConversationInboxStatus;
};

export type ConversationCounterpart = {
  donorMatchId: string;
  bloodRequestId: string;
  otherPartyId: string;
  displayName: string;
  bloodType: BloodType | null;
};

const MESSAGING_ELIGIBLE_STATUSES = ['accepted', 'completed'] as const;

export const getProfileDisplayName = (profile: {
  full_name: string;
  organization_name: string | null;
  role: string;
}) => {
  if (profile.role === 'bloodbank' && profile.organization_name?.trim()) {
    return profile.organization_name.trim();
  }

  return profile.full_name.trim() || 'BloodLink user';
};

const EMPTY_CONVERSATION_SNIPPET = 'Tap to start coordinating';

const getRequesterContactLabel = (request?: {
  hospital_name: string | null;
  contact_phone: string | null;
} | null) =>
  request?.hospital_name?.trim() || request?.contact_phone?.trim() || 'Request contact';

type EligibleMatch = {
  id: string;
  request_id: string;
  donor_id: string;
  status: string;
  updated_at: string;
  created_at: string;
};

export const resolveConversationRouteParams = async (
  donorMatchId: string,
  bloodRequestId: string,
  currentUserId: string,
): Promise<
  | { kind: 'success'; recipientId: string; recipientDisplayName: string }
  | { kind: 'error'; message: string }
> => {
  const { data: match, error: matchError } = await supabase
    .from('donor_matches')
    .select('id, donor_id, request_id, status')
    .eq('id', donorMatchId)
    .eq('request_id', bloodRequestId)
    .maybeSingle();

  if (matchError) {
    return { kind: 'error', message: matchError.message };
  }

  if (!match) {
    return { kind: 'error', message: 'This conversation is not available.' };
  }

  if (
    !MESSAGING_ELIGIBLE_MATCH_STATUSES.includes(
      match.status as (typeof MESSAGING_ELIGIBLE_MATCH_STATUSES)[number],
    )
  ) {
    return {
      kind: 'error',
      message: 'Messaging is only available after a match is accepted.',
    };
  }

  const { data: request, error: requestError } = await supabase
    .from('blood_requests')
    .select('requester_id')
    .eq('id', bloodRequestId)
    .maybeSingle();

  if (requestError) {
    return { kind: 'error', message: requestError.message };
  }

  if (!request) {
    return { kind: 'error', message: 'Blood request not found.' };
  }

  const isRequester = currentUserId === request.requester_id;
  const isDonor = currentUserId === match.donor_id;

  if (!isRequester && !isDonor) {
    return { kind: 'error', message: 'You are not a participant in this conversation.' };
  }

  if (request.requester_id === match.donor_id) {
    return { kind: 'error', message: 'You cannot chat on your own blood request.' };
  }

  const counterpart = await getConversationCounterpart(donorMatchId);

  if (counterpart) {
    return {
      kind: 'success',
      recipientId: counterpart.otherPartyId,
      recipientDisplayName: counterpart.displayName,
    };
  }

  const otherPartyId = isRequester ? match.donor_id : request.requester_id;

  if (isRequester) {
    const { data: donorSummary, error: donorSummaryError } = await supabase
      .from('recipient_donor_match_responses')
      .select('donor_name')
      .eq('id', donorMatchId)
      .maybeSingle();

    if (donorSummaryError) {
      return { kind: 'error', message: donorSummaryError.message };
    }

    return {
      kind: 'success',
      recipientId: otherPartyId,
      recipientDisplayName: donorSummary?.donor_name?.trim() || 'BloodLink donor',
    };
  }

  return {
    kind: 'success',
    recipientId: otherPartyId,
    recipientDisplayName: 'Blood recipient',
  };
};

const mapCounterpart = (row: {
  donor_match_id: string;
  blood_request_id: string;
  other_party_id: string;
  display_name: string;
  blood_type: BloodType | null;
}): ConversationCounterpart => ({
  bloodRequestId: row.blood_request_id,
  bloodType: row.blood_type,
  displayName: row.display_name.trim() || 'BloodLink user',
  donorMatchId: row.donor_match_id,
  otherPartyId: row.other_party_id,
});

export const getConversationCounterpart = async (
  donorMatchId: string,
): Promise<ConversationCounterpart | null> => {
  const { data, error } = await supabase
    .from('conversation_counterparts')
    .select('donor_match_id, blood_request_id, other_party_id, display_name, blood_type')
    .eq('donor_match_id', donorMatchId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapCounterpart(data);
};

export const listConversations = async (currentUserId: string) => {
  const { data: donorMatches, error: donorMatchError } = await supabase
    .from('donor_matches')
    .select('id, request_id, donor_id, status, updated_at, created_at')
    .eq('donor_id', currentUserId)
    .in('status', [...MESSAGING_ELIGIBLE_STATUSES]);

  if (donorMatchError) {
    return { data: null, error: donorMatchError };
  }

  const { data: ownedRequests, error: ownedRequestError } = await supabase
    .from('blood_requests')
    .select('id')
    .eq('requester_id', currentUserId);

  if (ownedRequestError) {
    return { data: null, error: ownedRequestError };
  }

  const ownedRequestIds = (ownedRequests ?? []).map((request) => request.id);

  let requesterMatches: EligibleMatch[] = [];

  if (ownedRequestIds.length > 0) {
    const { data, error: requesterMatchError } = await supabase
      .from('donor_matches')
      .select('id, request_id, donor_id, status, updated_at, created_at')
      .in('request_id', ownedRequestIds)
      .in('status', [...MESSAGING_ELIGIBLE_STATUSES]);

    if (requesterMatchError) {
      return { data: null, error: requesterMatchError };
    }

    requesterMatches = data ?? [];
  }

  const matchById = new Map<string, EligibleMatch>();

  for (const match of [...(donorMatches ?? []), ...requesterMatches]) {
    matchById.set(match.id, match);
  }

  if (matchById.size === 0) {
    return { data: [], error: null };
  }

  const matchIds = [...matchById.keys()];
  const requestIds = [...new Set([...matchById.values()].map((match) => match.request_id))];

  const [
    { data: requests, error: requestError },
    { data: rawMessages, error: messageError },
    { data: donorSummaries, error: donorSummaryError },
    { data: counterparts, error: counterpartError },
    { data: conversationStates, error: conversationStateError },
  ] = await Promise.all([
    supabase
      .from('blood_requests')
      .select('id, requester_id, hospital_name, contact_phone')
      .in('id', requestIds),
    supabase
      .from('messages')
      .select(
        'id, sender_id, recipient_id, blood_request_id, donor_match_id, body, status, read_at, created_at',
      )
      .in('donor_match_id', matchIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('recipient_donor_match_responses')
      .select('id, donor_name, donor_blood_type')
      .in('id', matchIds),
    supabase
      .from('conversation_counterparts')
      .select('donor_match_id, blood_request_id, other_party_id, display_name, blood_type')
      .in('donor_match_id', matchIds),
    supabase
      .from('conversation_states')
      .select('donor_match_id, status')
      .eq('user_id', currentUserId)
      .in('donor_match_id', matchIds),
  ]);

  if (requestError) {
    return { data: null, error: requestError };
  }

  if (messageError) {
    return { data: null, error: messageError };
  }

  if (donorSummaryError) {
    return { data: null, error: donorSummaryError };
  }

  if (counterpartError && counterpartError.code !== 'PGRST205') {
    return { data: null, error: counterpartError };
  }

  if (conversationStateError && conversationStateError.code !== 'PGRST205') {
    return { data: null, error: conversationStateError };
  }

  const requesterIds = [...new Set((requests ?? []).map((r) => r.requester_id).filter(Boolean))];

  const { data: requesterProfiles, error: requesterProfilesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', requesterIds);

  if (requesterProfilesError) {
    return { data: null, error: requesterProfilesError };
  }

  const requesterProfileById = new Map((requesterProfiles ?? []).map((p) => [p.id, p]));

  type ConversationMessage = NonNullable<typeof rawMessages>[number];

  const messagesByMatch = new Map<string, ConversationMessage[]>();

  for (const message of rawMessages ?? []) {
    if (!message.donor_match_id) {
      continue;
    }

    const existing = messagesByMatch.get(message.donor_match_id) ?? [];
    existing.push(message);
    messagesByMatch.set(message.donor_match_id, existing);
  }

  const requestById = new Map((requests ?? []).map((request) => [request.id, request]));
  const donorSummaryByMatchId = new Map(
    (donorSummaries ?? []).map((summary) => [summary.id, summary]),
  );
  const counterpartByMatchId = new Map(
    (counterparts ?? []).map((row) => [row.donor_match_id, mapCounterpart(row)]),
  );
  const inboxStatusByMatchId = new Map(
    (conversationStates ?? []).map((state) => [state.donor_match_id, state.status]),
  );
  const conversations: ConversationPreview[] = [];

  for (const match of matchById.values()) {
    const request = requestById.get(match.request_id);
    const requesterId = request?.requester_id;

    if (!requesterId) {
      continue;
    }

    const isDonor = currentUserId === match.donor_id;
    const isRequester = currentUserId === requesterId;

    if (!isDonor && !isRequester) {
      continue;
    }

    if (requesterId === match.donor_id) {
      continue;
    }

    const inboxStatus = inboxStatusByMatchId.get(match.id) ?? 'active';

    if (inboxStatus === 'deleted') {
      continue;
    }

    const counterpart = counterpartByMatchId.get(match.id);
    const otherPartyId = counterpart?.otherPartyId ?? (isDonor ? requesterId : match.donor_id);
    const donorSummary = donorSummaryByMatchId.get(match.id);
    const requesterProfile = requesterId ? requesterProfileById.get(requesterId) : undefined;

    const displayName =
      counterpart?.displayName ||
      (isDonor
        ? requesterProfile?.full_name?.trim() || getRequesterContactLabel(request)
        : donorSummary?.donor_name?.trim() || 'BloodLink donor');
    const bloodType =
      counterpart?.bloodType ?? (isDonor ? null : (donorSummary?.donor_blood_type ?? null));

    const matchMessages = messagesByMatch.get(match.id) ?? [];
    const latestMessage = matchMessages[0];
    const unreadCount = matchMessages.filter(
      (message) =>
        message.recipient_id === currentUserId &&
        message.status === 'sent' &&
        message.read_at === null,
    ).length;

    conversations.push({
      bloodRequestId: match.request_id,
      donorMatchId: match.id,
      otherPartyId,
      displayName,
      bloodType,
      lastMessageBody: latestMessage?.body ?? EMPTY_CONVERSATION_SNIPPET,
      lastMessageAt: latestMessage?.created_at ?? match.updated_at ?? match.created_at,
      unreadCount,
      inboxStatus,
    });
  }

  conversations.sort(
    (left, right) =>
      new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime(),
  );

  return { data: conversations, error: null };
};

export const listMessages = (context: MessageConversationContext) =>
  supabase
    .from('messages')
    .select('*')
    .eq('blood_request_id', context.bloodRequestId)
    .eq('donor_match_id', context.donorMatchId)
    .order('created_at', { ascending: true });

export type SendMessageResult =
  | { kind: 'success'; message: AppMessage }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'validation_error'; message: string }
  | { kind: 'error'; message: string };

export const sendMessage = async (
  senderId: string,
  recipientId: string,
  body: string,
  context: Pick<MessageConversationContext, 'bloodRequestId' | 'donorMatchId'>,
): Promise<SendMessageResult> => {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return { kind: 'validation_error', message: 'Message cannot be empty.' };
  }

  const authorization = await verifyMessagingAuthorized(
    { ...context, recipientId },
    senderId,
  );

  if (authorization.kind === 'error') {
    return { kind: 'error', message: authorization.message };
  }

  if (authorization.kind === 'unauthorized') {
    return { kind: 'unauthorized', message: authorization.message };
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      blood_request_id: context.bloodRequestId,
      body: trimmedBody,
      donor_match_id: context.donorMatchId,
      recipient_id: recipientId,
      sender_id: senderId,
      status: 'sent',
    })
    .select()
    .single();

  if (error) {
    return { kind: 'error', message: error.message };
  }

  return { kind: 'success', message: data };
};

export const markMessageRead = (messageId: string) =>
  supabase
    .from('messages')
    .update({
      read_at: new Date().toISOString(),
      status: 'read',
    })
    .eq('id', messageId)
    .eq('status', 'sent')
    .select()
    .maybeSingle();

export const markUnreadMessagesRead = async (
  messages: AppMessage[],
  currentUserId: string,
) => {
  const unreadIds = messages
    .filter(
      (message) =>
        message.recipient_id === currentUserId &&
        message.status === 'sent' &&
        message.read_at === null,
    )
    .map((message) => message.id);

  if (unreadIds.length === 0) {
    return { error: null };
  }

  const { error } = await supabase
    .from('messages')
    .update({
      read_at: new Date().toISOString(),
      status: 'read',
    })
    .in('id', unreadIds)
    .eq('recipient_id', currentUserId)
    .eq('status', 'sent');

  return { error };
};

export type ConversationStateStatus = 'active' | 'archived' | 'deleted';

export const setConversationState = async (
  donorMatchId: string,
  status: ConversationStateStatus,
) => {
  const { error } = await supabase.rpc('set_conversation_state', {
    p_donor_match_id: donorMatchId,
    p_status: status,
  });

  return { error };
};
