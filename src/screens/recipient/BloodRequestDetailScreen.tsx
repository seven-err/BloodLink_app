import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Droplets,
  MapPin,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BloodTypeBadge } from '@/components/bloodRequest/BloodTypeBadge';
import { ContentLoadingSkeleton } from '@/components/common/ContentLoadingSkeleton';
import { SafetyReminderCard } from '@/components/bloodRequest/SafetyReminderCard';
import { StatusBadge } from '@/components/bloodRequest/StatusBadge';
import { UrgencyBadge } from '@/components/bloodRequest/UrgencyBadge';
import { RequestLocationMapPreview } from '@/components/map/RequestLocationMapPreview';
import { DonorVerificationBadge } from '@/components/donor/DonorVerificationBadge';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { colors, fontFamilies } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { AppStackParamList } from '@/navigation/types';
import { authStyles } from '@/screens/auth/styles';
import { recipientStyles } from '@/screens/recipient/styles';
import {
  canEditBloodRequest,
  getBloodRequestById,
  type BloodRequest,
} from '@/services/supabase/bloodRequests';
import {
  acceptDonorMatch,
  declineDonorMatch,
  listMatchesForRequest,
  type RecipientDonorMatchResponse,
} from '@/services/supabase/donorMatches';
import {
  describeDonationVerification,
  listDonationVerificationsForRequest,
  type DonationVerification,
} from '@/services/supabase/donations';
import { subscribeToRequestDonations, subscribeToRequestMatches } from '@/services/supabase/realtime';
import { resolveDonorVerificationDisplay } from '@/utils/donorVerificationDisplay';
import { formatDistance, formatTravelTime } from '@/utils/travelMetrics';

type Props = NativeStackScreenProps<AppStackParamList, 'BloodRequestDetail'>;

type MatchActionState = 'idle' | 'accepting' | 'declining' | 'success' | 'error';
type ConfirmAction = 'accept' | 'decline';

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Not set';
  }
  return new Date(value).toLocaleString();
};

function DetailRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        recipientStyles.detailRow,
        isLast ? recipientStyles.detailRowLast : null,
      ]}
    >
      <Text style={recipientStyles.detailLabel}>{label}</Text>
      <Text style={recipientStyles.detailValue}>{value}</Text>
    </View>
  );
}

function DonorResponseCard({
  bloodRequestId,
  match,
  donation,
  actionMatchId,
  actionState,
  actionError,
  confirmMatchId,
  confirmAction,
  navigation,
  onAccept,
  onDecline,
  onConfirm,
  onCancelConfirm,
}: {
  bloodRequestId: string;
  match: RecipientDonorMatchResponse;
  donation: DonationVerification | null;
  actionMatchId: string | null;
  actionState: MatchActionState;
  actionError: string | null;
  confirmMatchId: string | null;
  confirmAction: ConfirmAction | null;
  navigation: NativeStackNavigationProp<AppStackParamList, 'BloodRequestDetail'>;
  onAccept: (match: RecipientDonorMatchResponse) => void;
  onDecline: (match: RecipientDonorMatchResponse) => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
}) {
  const isPending = match.status === 'pending';
  const isBusy = actionMatchId === match.id && actionState !== 'idle' && actionState !== 'error';
  const isConfirming = confirmMatchId === match.id;
  const travelTime = formatTravelTime(match.travel_time_seconds);
  const donorLabel = match.donor_name?.trim() || 'BloodLink donor';
  const verificationStatus = resolveDonorVerificationDisplay({
    latestStatus: match.donor_verification_status,
    verificationActive: match.donor_verification_active,
  });

  return (
    <View style={recipientStyles.donorResponseCard}>
      {/* Header row */}
      <View style={recipientStyles.cardHeaderRow}>
        <View style={recipientStyles.donorTitleRow}>
          <Text numberOfLines={1} style={recipientStyles.donorName}>
            {donorLabel}
          </Text>
          <DonorVerificationBadge status={verificationStatus} />
        </View>
        <StatusBadge status={match.status} />
      </View>

      {/* Meta chips */}
      <View style={recipientStyles.donorResponseMetaRow}>
        <View style={recipientStyles.donorResponseMetaChip}>
          <Droplets color={colors.primary} size={12} />
          <Text style={recipientStyles.donorResponseMetaChipText}>{match.donor_blood_type}</Text>
        </View>
        <View style={recipientStyles.donorResponseMetaChip}>
          <MapPin color={colors.muted} size={12} />
          <Text style={recipientStyles.donorResponseMetaChipText}>
            {formatDistance(match.distance_meters)}
          </Text>
        </View>
        {travelTime ? (
          <View style={recipientStyles.donorResponseMetaChip}>
            <Text style={recipientStyles.donorResponseMetaChipText}>{travelTime}</Text>
          </View>
        ) : null}
      </View>

      <Text style={recipientStyles.donorResponseMeta}>
        Responded {formatDateTime(match.responded_at ?? match.created_at)}
      </Text>

      {match.status === 'accepted' || match.status === 'completed' ? (
        <Text
          style={
            donation?.status === 'completed'
              ? recipientStyles.successText
              : recipientStyles.donorResponseMeta
          }
        >
          {describeDonationVerification(donation?.status ?? null, match.status)}
          {donation?.completedAt
            ? ` Verified ${formatDateTime(donation.completedAt)}.`
            : ''}
        </Text>
      ) : null}

      {/* Actions */}
      {isPending ? (
        isConfirming ? (
          // Inline confirmation row
          <View style={recipientStyles.donorResponseActions}>
            <Text style={[recipientStyles.donorResponseMeta, { flex: 1, color: colors.foreground }]}>
              {confirmAction === 'accept'
                ? `Accept ${donorLabel}?`
                : `Decline ${donorLabel}?`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={confirmAction === 'accept' ? 'Confirm' : 'Decline'}
                  loading={isBusy}
                  disabled={isBusy}
                  onPress={onConfirm}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title="Cancel"
                  variant="secondary"
                  disabled={isBusy}
                  onPress={onCancelConfirm}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={recipientStyles.donorResponseActions}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="Accept"
                disabled={isBusy}
                onPress={() => onAccept(match)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="Decline"
                variant="secondary"
                disabled={isBusy}
                onPress={() => onDecline(match)}
              />
            </View>
          </View>
        )
      ) : null}

      {match.status === 'accepted' || match.status === 'completed' ? (
        <PrimaryButton
          title="Message donor"
          onPress={() =>
            navigation.navigate('ChatThread', {
              bloodRequestId,
              donorMatchId: match.id,
              recipientDisplayName: donorLabel,
              recipientId: match.donor_id,
            })
          }
        />
      ) : null}

      {actionMatchId === match.id && actionState === 'error' && actionError ? (
        <Text style={authStyles.error}>{actionError}</Text>
      ) : null}
    </View>
  );
}

function DonorResponsesSection({
  bloodRequestId,
  matches,
  donationsByMatchId,
  matchesLoading,
  matchesError,
  actionMatchId,
  actionState,
  actionError,
  actionSuccessMessage,
  confirmMatchId,
  confirmAction,
  navigation,
  onAccept,
  onDecline,
  onConfirm,
  onCancelConfirm,
  onRetry,
}: {
  bloodRequestId: string;
  matches: RecipientDonorMatchResponse[];
  donationsByMatchId: Record<string, DonationVerification>;
  matchesLoading: boolean;
  matchesError: string | null;
  actionMatchId: string | null;
  actionState: MatchActionState;
  actionError: string | null;
  actionSuccessMessage: string | null;
  confirmMatchId: string | null;
  confirmAction: ConfirmAction | null;
  navigation: NativeStackNavigationProp<AppStackParamList, 'BloodRequestDetail'>;
  onAccept: (match: RecipientDonorMatchResponse) => void;
  onDecline: (match: RecipientDonorMatchResponse) => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onRetry: () => void;
}) {
  return (
    <View style={recipientStyles.sectionWrapper}>
      <Text style={recipientStyles.sectionTitle}>
        Donor Responses{matches.length > 0 ? ` (${matches.length})` : ''}
      </Text>

      {matchesLoading ? (
        <View style={recipientStyles.card}>
          <ActivityIndicator color={colors.muted} />
          <Text style={recipientStyles.subtitle}>Loading donor responses…</Text>
        </View>
      ) : matchesError ? (
        <View style={recipientStyles.card}>
          <Text style={authStyles.error}>{matchesError}</Text>
          <PrimaryButton title="Retry" variant="secondary" onPress={onRetry} />
        </View>
      ) : matches.length === 0 ? (
        <View style={recipientStyles.emptyCard}>
          <View style={recipientStyles.emptyIcon}>
            <Droplets color={colors.primary} size={24} />
          </View>
          <Text style={recipientStyles.emptyText}>
            No responses yet. Verified donors who respond will appear here for you to accept or
            decline.
          </Text>
        </View>
      ) : (
        <>
          {actionSuccessMessage ? (
            <Text style={recipientStyles.successText}>{actionSuccessMessage}</Text>
          ) : null}
          {matches.map((match) => (
            <DonorResponseCard
              key={match.id}
              actionError={actionError}
              actionMatchId={actionMatchId}
              actionState={actionState}
              bloodRequestId={bloodRequestId}
              confirmAction={confirmAction}
              confirmMatchId={confirmMatchId}
              donation={donationsByMatchId[match.id] ?? null}
              match={match}
              navigation={navigation}
              onAccept={onAccept}
              onCancelConfirm={onCancelConfirm}
              onConfirm={onConfirm}
              onDecline={onDecline}
            />
          ))}
        </>
      )}
    </View>
  );
}

import { appCache } from '@/utils/appCache';

export function BloodRequestDetailScreen({ navigation, route }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const { session } = useAuth();
  const { requestId } = route.params;

  const cachedRequest = appCache.getSync<BloodRequest>(`blood_request:detail:${requestId}`);
  const cachedMatches = appCache.getSync<RecipientDonorMatchResponse[]>(`blood_request:matches:${requestId}`);

  const [request, setRequest] = useState<BloodRequest | null>(() => cachedRequest ?? null);
  const [matches, setMatches] = useState<RecipientDonorMatchResponse[]>(() => cachedMatches ?? []);
  const [donationsByMatchId, setDonationsByMatchId] = useState<Record<string, DonationVerification>>(
    {},
  );
  const [loading, setLoading] = useState(() => cachedRequest === undefined);
  const [matchesLoading, setMatchesLoading] = useState(() => cachedMatches === undefined);
  const [error, setError] = useState<string | null>(null);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [actionMatchId, setActionMatchId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<MatchActionState>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  // Inline confirmation state (replaces Alert.alert which doesn't work on web)
  const [confirmMatchId, setConfirmMatchId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const pendingMatchRef = useRef<RecipientDonorMatchResponse | null>(null);

  const loadDonationVerifications = useCallback(async () => {
    const { data, error: fetchError } = await listDonationVerificationsForRequest(requestId);

    if (fetchError || !data) {
      return;
    }

    setDonationsByMatchId(
      Object.fromEntries(data.map((verification) => [verification.matchId, verification])),
    );
  }, [requestId]);

  const loadMatches = useCallback(async (isSilent = false) => {
    if (!isSilent && !appCache.getSync(`blood_request:matches:${requestId}`)) {
      setMatchesLoading(true);
    }
    setMatchesError(null);

    const { data, error: fetchError } = await listMatchesForRequest(requestId);

    if (fetchError) {
      setMatchesError(fetchError.message);
      if (!appCache.getSync(`blood_request:matches:${requestId}`)) {
        setMatches([]);
      }
    } else {
      const fresh = data ?? [];
      setMatches(fresh);
      appCache.setSync(`blood_request:matches:${requestId}`, fresh);
    }

    setMatchesLoading(false);
  }, [requestId]);

  const loadRequest = useCallback(async (isSilent = false) => {
    if (!isSilent && !appCache.getSync(`blood_request:detail:${requestId}`)) {
      setLoading(true);
    }
    setError(null);

    const { data, error: fetchError } = await getBloodRequestById(requestId);

    if (fetchError) {
      setError(fetchError.message);
      if (!appCache.getSync(`blood_request:detail:${requestId}`)) {
        setRequest(null);
      }
    } else if (!data) {
      setError('Blood request not found or you do not have access.');
      if (!appCache.getSync(`blood_request:detail:${requestId}`)) {
        setRequest(null);
      }
    } else {
      setRequest(data);
      appCache.setSync(`blood_request:detail:${requestId}`, data);
    }

    setLoading(false);
  }, [requestId]);

  const loadScreenData = useCallback(async (isSilent = false) => {
    setActionSuccessMessage(null);
    setActionError(null);
    setActionState('idle');
    setActionMatchId(null);
    await Promise.all([loadRequest(isSilent), loadMatches(isSilent), loadDonationVerifications()]);
  }, [loadDonationVerifications, loadMatches, loadRequest]);

  useEffect(() => {
    const matchSubscription = subscribeToRequestMatches(requestId, () => {
      void loadMatches(true);
      void loadRequest(true);
      void loadDonationVerifications();
    });
    const donationSubscription = subscribeToRequestDonations(requestId, () => {
      void loadDonationVerifications();
      void loadRequest(true);
    });

    return () => {
      matchSubscription.stop();
      donationSubscription.stop();
    };
  }, [requestId, loadDonationVerifications, loadMatches, loadRequest]);

  useFocusEffect(
    useCallback(() => {
      void loadScreenData(true);
    }, [loadScreenData]),
  );

  const handleMatchAction = useCallback(
    async (
      match: RecipientDonorMatchResponse,
      action: 'accept' | 'decline',
    ) => {
      setActionMatchId(match.id);
      setActionState(action === 'accept' ? 'accepting' : 'declining');
      setActionError(null);
      setActionSuccessMessage(null);
      // Clear inline confirm
      setConfirmMatchId(null);
      setConfirmAction(null);
      pendingMatchRef.current = null;

      const result =
        action === 'accept'
          ? await acceptDonorMatch(match.id)
          : await declineDonorMatch(match.id);

      const donorLabel = match.donor_name?.trim() || 'this donor';

      if (result.kind === 'success') {
        setActionError(null);
        setActionState('success');
        setActionSuccessMessage(
          action === 'accept'
            ? `Accepted ${donorLabel}. They can now view full request details.`
            : `Declined ${donorLabel}'s response.`,
        );
        await loadMatches();
        setActionError(null);
        setActionMatchId(null);
        return;
      }

      setActionState('error');

      if (result.kind === 'not_found') {
        setActionError('This donor response is no longer available.');
      } else if (result.kind === 'invalid_transition') {
        setActionError(result.message);
        await loadMatches();
      } else {
        setActionError(result.message);
      }
    },
    [loadMatches],
  );

  /** First press: show inline confirm row on the card. */
  const handleRequestAccept = useCallback((match: RecipientDonorMatchResponse) => {
    setConfirmMatchId(match.id);
    setConfirmAction('accept');
    pendingMatchRef.current = match;
  }, []);

  const handleRequestDecline = useCallback((match: RecipientDonorMatchResponse) => {
    setConfirmMatchId(match.id);
    setConfirmAction('decline');
    pendingMatchRef.current = match;
  }, []);

  /** Second press: execute the confirmed action. */
  const handleConfirm = useCallback(() => {
    const match = pendingMatchRef.current;
    const action = confirmAction;
    if (!match || !action) return;
    void handleMatchAction(match, action);
  }, [confirmAction, handleMatchAction]);

  const handleCancelConfirm = useCallback(() => {
    setConfirmMatchId(null);
    setConfirmAction(null);
    pendingMatchRef.current = null;
  }, []);

  if (loading) {
    return <ContentLoadingSkeleton rows={2} />;
  }

  if (error || !request) {
    return (
      <View style={recipientStyles.centerContent}>
        <Text style={authStyles.error}>{error ?? 'Blood request not found.'}</Text>
        <PrimaryButton title="Try again" onPress={() => void loadScreenData()} />
        <PrimaryButton
          title="Back to my requests"
          variant="secondary"
          onPress={() => navigation.navigate('MyBloodRequests')}
        />
      </View>
    );
  }

  return (
    <View style={recipientStyles.screen}>
      {/* Inline header with back button */}
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          flexDirection: 'row',
          gap: 12,
          paddingBottom: 14,
          paddingHorizontal: 20,
          paddingTop: topInset + 8,
        }}
      >
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color={colors.foreground} size={22} />
        </Pressable>
        <Text
          style={{
            color: colors.foreground,
            flex: 1,
            fontSize: 18,
            fontWeight: '800',
          }}
        >
          Request Details
        </Text>
        {session?.user.id && canEditBloodRequest(request, session.user.id) ? (
          <Pressable
            accessibilityLabel="Edit request"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.navigate('CreateBloodRequest', { requestId: request.id })}
          >
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700' }}>Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={recipientStyles.scrollContent}
        style={recipientStyles.screen}
      >
        {/* Request Details Card */}
        <View style={recipientStyles.sectionWrapper}>
          <Text style={recipientStyles.sectionTitle}>Request Details</Text>
          <View style={recipientStyles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                {/* Blood Box */}
                <BloodTypeBadge bloodType={request.blood_type} />

                {/* Patient/Hospital & Meta */}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: '#0F172A', fontFamily: fontFamilies.textBold, fontSize: 13.5, fontWeight: '700' }}>
                    {request.patient_name?.trim() || 'Blood Request'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text numberOfLines={1} style={{ color: '#64748B', fontFamily: fontFamilies.textSemibold, fontSize: 11, fontWeight: '600', flex: 1 }}>
                      {request.hospital_name}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Status & Urgency Tags */}
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <StatusBadge status={request.status} />
                <UrgencyBadge urgency={request.urgency} />
              </View>
            </View>

            <View style={recipientStyles.detailGrid}>
              <DetailRow label="Needed By" value={formatDateTime(request.needed_at)} />
              {request.contact_phone ? (
                <DetailRow label="Contact" value={request.contact_phone} />
              ) : null}
              {request.address ? (
                <DetailRow label="Address" value={request.address} />
              ) : null}
              {request.notes ? (
                <DetailRow label="Notes" value={request.notes} />
              ) : null}
              <DetailRow label="Submitted" value={formatDateTime(request.created_at)} isLast />
            </View>
          </View>
        </View>

        {/* Donor responses */}
        <DonorResponsesSection
          actionError={actionError}
          actionMatchId={actionMatchId}
          actionState={actionState}
          actionSuccessMessage={actionSuccessMessage}
          bloodRequestId={requestId}
          confirmAction={confirmAction}
          confirmMatchId={confirmMatchId}
          matches={matches}
          donationsByMatchId={donationsByMatchId}
          matchesError={matchesError}
          matchesLoading={matchesLoading}
          navigation={navigation}
          onAccept={handleRequestAccept}
          onCancelConfirm={handleCancelConfirm}
          onConfirm={handleConfirm}
          onDecline={handleRequestDecline}
          onRetry={() => void loadMatches()}
        />

        {/* Map */}
        <RequestLocationMapPreview
          latitude={request.latitude}
          longitude={request.longitude}
          subtitle="Preview of the coordinates saved with your request."
          title="Request Location"
        />



        <SafetyReminderCard />

        <PrimaryButton
          title="Back to my requests"
          variant="secondary"
          onPress={() => navigation.navigate('MyBloodRequests')}
        />
      </ScrollView>
    </View>
  );
}
