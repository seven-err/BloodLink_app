import type { RealtimeChannel } from '@supabase/supabase-js';

import {
  getOpenBloodRequestsFeed,
  type OpenBloodRequestFeedItem,
} from './openBloodRequestsFeed';
import { supabase } from './client';

type SubscriptionHandler<T> = (payload: T) => void;

export type RealtimeSubscription = {
  stop: () => void;
};

export type OpenBloodRequestsFeedSubscription = RealtimeSubscription;

export const subscribeToUserNotifications = (
  userId: string,
  onChange: SubscriptionHandler<unknown>,
): RealtimeChannel =>
  supabase
    .channel(`notifications:user:${userId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();

export const subscribeToDonorMatches = (
  donorId: string,
  onChange: SubscriptionHandler<unknown>,
): RealtimeChannel =>
  supabase
    .channel(`donor_matches:donor:${donorId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'donor_matches',
        filter: `donor_id=eq.${donorId}`,
      },
      onChange,
    )
    .subscribe();

const DEFAULT_OPEN_FEED_POLL_INTERVAL_MS = 20_000;

/**
 * Subscribes to open blood requests in real time across all accounts via
 * Supabase Realtime websocket events, with periodic polling as an active fallback.
 */
export const subscribeToOpenBloodRequests = (
  onChange: SubscriptionHandler<OpenBloodRequestFeedItem[]>,
  options?: { intervalMs?: number; onError?: SubscriptionHandler<Error> },
): OpenBloodRequestsFeedSubscription => {
  const intervalMs = options?.intervalMs ?? DEFAULT_OPEN_FEED_POLL_INTERVAL_MS;
  let active = true;

  const fetchAndNotify = async () => {
    const { data, error } = await getOpenBloodRequestsFeed();

    if (!active) {
      return;
    }

    if (error) {
      options?.onError?.(new Error(error.message));
      return;
    }

    onChange(data ?? []);
  };

  // Initial fetch
  void fetchAndNotify();

  // Supabase Realtime channel for live table changes
  const channel = supabase
    .channel(`blood_requests:open_feed:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'blood_requests',
      },
      () => {
        void fetchAndNotify();
      },
    )
    .subscribe();

  // Polling fallback timer
  const timer = setInterval(() => {
    void fetchAndNotify();
  }, intervalMs);

  return {
    stop: () => {
      active = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
    },
  };
};

/**
 * Subscribes to recipient's own blood requests for real-time updates (e.g. status changes, new matches).
 */
export const subscribeToMyBloodRequests = (
  requesterId: string,
  onChange: SubscriptionHandler<unknown>,
  options?: { intervalMs?: number },
): RealtimeSubscription => {
  const intervalMs = options?.intervalMs ?? DEFAULT_OPEN_FEED_POLL_INTERVAL_MS;
  const channelId = `blood_requests:requester:${requesterId}:${Date.now()}`;

  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'blood_requests',
        filter: `requester_id=eq.${requesterId}`,
      },
      onChange,
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'donor_matches',
      },
      onChange,
    )
    .subscribe();

  const timer = setInterval(onChange, intervalMs);

  return {
    stop: () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    },
  };
};

/**
 * Subscribes to donor matches for a specific blood request.
 */
export const subscribeToRequestMatches = (
  requestId: string,
  onChange: SubscriptionHandler<unknown>,
): RealtimeSubscription => {
  const channel = supabase
    .channel(`donor_matches:request:${requestId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'donor_matches',
        filter: `request_id=eq.${requestId}`,
      },
      onChange,
    )
    .subscribe();

  return {
    stop: () => {
      supabase.removeChannel(channel);
    },
  };
};

export type MessageConversationSubscriptionContext = {
  bloodRequestId: string;
  donorMatchId: string;
};

export type MessagesSubscription = {
  stop: () => void;
};

const DEFAULT_MESSAGES_POLL_INTERVAL_MS = 30_000;

/**
 * Subscribes to message changes for a blood-request conversation.
 * Realtime respects RLS; polling refetches as a safe fallback.
 */
export const subscribeToMessages = (
  context: MessageConversationSubscriptionContext,
  onChange: SubscriptionHandler<unknown>,
  options?: { intervalMs?: number; onError?: SubscriptionHandler<Error> },
): MessagesSubscription => {
  const intervalMs = options?.intervalMs ?? DEFAULT_MESSAGES_POLL_INTERVAL_MS;

  const channel = supabase
    .channel(`messages:request:${context.bloodRequestId}:match:${context.donorMatchId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `blood_request_id=eq.${context.bloodRequestId}`,
      },
      onChange,
    )
    .subscribe();

  const timer = setInterval(onChange, intervalMs);

  return {
    stop: () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    },
  };
};

export const subscribeToDonation = (
  donationId: string,
  onChange: SubscriptionHandler<unknown>,
): RealtimeSubscription => {
  const channel = supabase
    .channel(`donations:id:${donationId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'donations',
        filter: `id=eq.${donationId}`,
      },
      onChange,
    )
    .subscribe();

  return {
    stop: () => {
      supabase.removeChannel(channel);
    },
  };
};

export const subscribeToRequestDonations = (
  requestId: string,
  onChange: SubscriptionHandler<unknown>,
): RealtimeSubscription => {
  const channel = supabase
    .channel(`donations:request:${requestId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'donations',
        filter: `request_id=eq.${requestId}`,
      },
      onChange,
    )
    .subscribe();

  return {
    stop: () => {
      supabase.removeChannel(channel);
    },
  };
};

export const unsubscribe = (channel: RealtimeChannel) =>
  supabase.removeChannel(channel);
