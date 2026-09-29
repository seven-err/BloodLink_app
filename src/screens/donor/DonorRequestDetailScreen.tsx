import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { BloodTypeBadge } from '@/components/bloodRequest/BloodTypeBadge';
import { ContentLoadingSkeleton } from '@/components/common/ContentLoadingSkeleton';
import { SafetyReminderCard } from '@/components/bloodRequest/SafetyReminderCard';
import { UrgencyBadge } from '@/components/bloodRequest/UrgencyBadge';
import { RequestLocationMapPreview } from '@/components/map/RequestLocationMapPreview';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { colors, fontFamilies } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { AppStackParamList } from '@/navigation/types';
import { authStyles } from '@/screens/auth/styles';
import { recipientStyles } from '@/screens/recipient/styles';
import {
  canShowSensitiveRequestDetails,
  getAuthorizedBloodRequestById,
  getDonorMatchForRequest,
  respondToBloodRequest,
  type DonorMatch,
  type MatchedBloodRequestDetails,
} from '@/services/supabase/donorMatches';
import { isOwnBloodRequest } from '@/services/supabase/bloodRequests';
import { resolveConversationRouteParams } from '@/services/supabase/messages';
import { isQrEligibleMatchStatus } from '@/services/supabase/donations';
import {
  getOpenBloodRequestById,
  type OpenBloodRequestFeedItem,
} from '@/services/supabase/openBloodRequestsFeed';
import { haversineDistanceMeters } from '@/utils/coordinates';
import { formatDistance } from '@/utils/travelMetrics';
import {
  subscribeToDonorMatches,
  subscribeToRequestMatches,
  unsubscribe,
} from '@/services/supabase/realtime';

type Props = NativeStackScreenProps<AppStackParamList, 'DonorRequestDetail'>;

type ResponseUiState = 'idle' | 'responding' | 'success' | 'error';

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleString();
};

const toFeedPreview = (
  details: Pick<
    MatchedBloodRequestDetails,
    | 'id'
    | 'blood_type'
    | 'units_needed'
    | 'urgency'
    | 'needed_at'
    | 'hospital_name'
    | 'address'
    | 'latitude'
    | 'longitude'
    | 'created_at'
    | 'updated_at'
  >,
): OpenBloodRequestFeedItem => ({
  id: details.id,
  blood_type: details.blood_type,
  units_needed: details.units_needed,
  urgency: details.urgency,
  needed_at: details.needed_at,
  hospital_name: details.hospital_name ?? '',
  address: details.address ?? '',
  latitude: details.latitude,
  longitude: details.longitude,
  created_at: details.created_at,
  updated_at: details.updated_at,
});

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



function ResponseStatusCard({
  hasExistingMatch,
  match,
  responseState,
  responseError,
}: {
  hasExistingMatch: boolean;
  match: DonorMatch | null;
  responseState: ResponseUiState;
  responseError: string | null;
}) {
  if (responseState === 'responding') {
    return (
      <View style={recipientStyles.card}>
        <ActivityIndicator color={colors.muted} />
        <Text style={recipientStyles.subtitle}>Submitting your response…</Text>
      </View>
    );
  }

  if (responseState === 'error' && responseError) {
    return (
      <View style={recipientStyles.card}>
        <Text style={authStyles.error}>{responseError}</Text>
      </View>
    );
  }

  if (hasExistingMatch && responseState !== 'success') {
    return (
      <View style={recipientStyles.card}>
        <Text style={recipientStyles.eyebrow}>Response recorded</Text>
        <Text style={recipientStyles.title}>You already responded</Text>
        <Text style={recipientStyles.subtitle}>
          Your interest in this request is on file with status &quot;{match?.status ?? 'pending'}
          &quot;. Healthcare or blood bank personnel will verify eligibility and contact you if
          needed.
        </Text>
      </View>
    );
  }

  if (responseState === 'success') {
    return (
      <View style={recipientStyles.card}>
        <Text style={recipientStyles.eyebrow}>Response sent</Text>
        <Text style={recipientStyles.title}>Thank you for responding</Text>
        <Text style={recipientStyles.subtitle}>
          Your interest has been recorded. Healthcare or blood bank personnel will verify your
          eligibility and contact you with next steps. Patient and hospital contact details stay
          hidden until your match is accepted.
        </Text>
      </View>
    );
  }

  return null;
}

function OwnRequestCard({ onManage }: { onManage: () => void }) {
  return (
    <View style={recipientStyles.card}>
      <Text style={recipientStyles.eyebrow}>Your request</Text>
      <Text style={recipientStyles.title}>You created this request</Text>
      <Text style={recipientStyles.subtitle}>
        Donors cannot donate to or chat on their own blood request. Manage it from Request mode
        instead.
      </Text>
      <PrimaryButton title="Manage this request" onPress={onManage} />
    </View>
  );
}

function SensitiveDetailsCard({ details }: { details: MatchedBloodRequestDetails }) {
  return (
    <View style={recipientStyles.sectionWrapper}>
      <Text style={recipientStyles.sectionTitle}>Patient Details</Text>
      <View style={recipientStyles.card}>
        <View style={{ gap: 4, marginBottom: 16 }}>
          <Text style={recipientStyles.subtitle}>
            Your match was accepted. Use these details to coordinate donation.
          </Text>
        </View>
        <View style={recipientStyles.detailGrid}>
          <DetailRow label="Patient" value={details.patient_name?.trim() || 'Not provided'} />
          <DetailRow label="Hospital" value={details.hospital_name} />
          <DetailRow label="Contact phone" value={details.contact_phone?.trim() || 'Not provided'} />
          <DetailRow label="Address" value={details.address?.trim() || 'Not provided'} />
          {details.notes?.trim() ? <DetailRow label="Notes" value={details.notes.trim()} /> : null}
        </View>
      </View>
    </View>
  );
}

import { appCache } from '@/utils/appCache';

export function DonorRequestDetailScreen({ navigation, route }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const { requestId, intent } = route.params;
  const respondOnOpenRef = useRef(intent === 'respond');
  const didAutoRespond = useRef(false);
  const { session, profile } = useAuth();
  const donorId = session?.user.id;

  const cachedDetail = appCache.getSync<OpenBloodRequestFeedItem>(`request:detail:${requestId}`);
  const cachedFromFeed = !cachedDetail
    ? (appCache.getSync<OpenBloodRequestFeedItem[]>('feed:open_requests') ?? []).find(
        (r) => r.id === requestId,
      )
    : undefined;
  const initialRequest = cachedDetail ?? cachedFromFeed ?? null;

  const [request, setRequest] = useState<OpenBloodRequestFeedItem | null>(() => initialRequest);
  const [existingMatch, setExistingMatch] = useState<DonorMatch | null>(
    () => donorId ? appCache.getSync<DonorMatch>(`donor_match:${requestId}:${donorId}`) ?? null : null,
  );
  const [matchedDetails, setMatchedDetails] = useState<MatchedBloodRequestDetails | null>(
    () => appCache.getSync<MatchedBloodRequestDetails>(`request:matched_details:${requestId}`) ?? null,
  );
  const [loading, setLoading] = useState(() => !initialRequest);
  const [error, setError] = useState<string | null>(null);
  const [responseState, setResponseState] = useState<ResponseUiState>('idle');
  const [responseError, setResponseError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState(false);
  const [isOwnRequest, setIsOwnRequest] = useState(false);
  const [autoRespondReady, setAutoRespondReady] = useState(false);

  const loadRequest = useCallback(async (isSilent = false) => {
    if (!donorId) {
      setError('You must be signed in as a donor to view this request.');
      setLoading(false);
      return;
    }

    if (!isSilent && !appCache.getSync(`request:detail:${requestId}`) && !initialRequest) {
      setLoading(true);
    }
    setError(null);

    const [
      { data: feedItem, error: feedError },
      { data: donorMatch, error: matchError },
      ownRequest,
    ] = await Promise.all([
      getOpenBloodRequestById(requestId),
      getDonorMatchForRequest(requestId, donorId),
      isOwnBloodRequest(requestId, donorId),
    ]);

    if (feedError) {
      setError(feedError.message);
      if (!initialRequest) {
        setRequest(null);
        setExistingMatch(null);
        setMatchedDetails(null);
      }
      setLoading(false);
      return;
    }

    if (matchError) {
      setError(matchError.message);
      if (!initialRequest) {
        setRequest(null);
        setExistingMatch(null);
        setMatchedDetails(null);
      }
      setLoading(false);
      return;
    }

    setExistingMatch(donorMatch);
    setIsOwnRequest(ownRequest);
    if (donorMatch) {
      appCache.setSync(`donor_match:${requestId}:${donorId}`, donorMatch);
    }

    if (ownRequest) {
      const { data: ownedDetails } = await getAuthorizedBloodRequestById(requestId);
      setRequest(ownedDetails ? toFeedPreview(ownedDetails) : feedItem);
      setMatchedDetails(null);
      setLoading(false);
      return;
    }

    if (!feedItem && !donorMatch && !initialRequest) {
      setError('This request is no longer open or you do not have access.');
      setRequest(null);
      setMatchedDetails(null);
      setLoading(false);
      return;
    }

    let nextRequest: OpenBloodRequestFeedItem | null = feedItem ?? initialRequest;
    let nextMatchedDetails: MatchedBloodRequestDetails | null = null;

    if (donorMatch && canShowSensitiveRequestDetails(donorMatch)) {
      const { data: authorizedDetails, error: detailsError } =
        await getAuthorizedBloodRequestById(requestId);

      if (detailsError) {
        setMatchedDetails(null);
      } else if (authorizedDetails) {
        nextMatchedDetails = authorizedDetails;
        appCache.setSync(`request:matched_details:${requestId}`, authorizedDetails);
        if (!nextRequest) {
          nextRequest = toFeedPreview(authorizedDetails);
        }
      }
    }

    if (nextRequest) {
      setRequest(nextRequest);
      appCache.setSync(`request:detail:${requestId}`, nextRequest);
    }
    setMatchedDetails(nextMatchedDetails);
    if (respondOnOpenRef.current && !ownRequest && !donorMatch && nextRequest) {
      setAutoRespondReady(true);
    }
    setLoading(false);
  }, [donorId, initialRequest, requestId]);

  useEffect(() => {
    if (!donorId) return;

    const matchChannel = subscribeToDonorMatches(donorId, () => {
      void loadRequest(true);
    });

    const requestSub = subscribeToRequestMatches(requestId, () => {
      void loadRequest(true);
    });

    return () => {
      unsubscribe(matchChannel);
      requestSub.stop();
    };
  }, [donorId, requestId, loadRequest]);

  useFocusEffect(
    useCallback(() => {
      void loadRequest(true);
    }, [loadRequest]),
  );

  const openMatchChat = useCallback(async () => {
    if (isOwnRequest) {
      setChatError('You cannot chat on your own blood request.');
      return;
    }

    if (!donorId || !existingMatch) {
      setChatError('You must be signed in to open this conversation.');
      return;
    }

    setOpeningChat(true);
    setChatError(null);

    const result = await resolveConversationRouteParams(
      existingMatch.id,
      requestId,
      donorId,
    );

    setOpeningChat(false);

    if (result.kind === 'error') {
      setChatError(result.message);
      return;
    }

    navigation.navigate('ChatThread', {
      bloodRequestId: requestId,
      donorMatchId: existingMatch.id,
      recipientDisplayName: result.recipientDisplayName,
      recipientId: result.recipientId,
    });
  }, [donorId, existingMatch, isOwnRequest, navigation, requestId]);

  const handleRespond = useCallback(async () => {
    if (isOwnRequest) {
      setResponseError('You cannot donate to your own blood request.');
      setResponseState('error');
      return;
    }

    if (!donorId || !request) {
      setResponseError('You must be signed in to respond to this request.');
      setResponseState('error');
      return;
    }

    setResponseState('responding');
    setResponseError(null);

    const result = await respondToBloodRequest(requestId, donorId, {
      donorLatitude: profile?.latitude ?? null,
      donorLongitude: profile?.longitude ?? null,
      requestLatitude: request.latitude,
      requestLongitude: request.longitude,
    });

    if (result.kind === 'error') {
      setResponseError(result.message);
      setResponseState('error');
      return;
    }

    setExistingMatch(result.match);

    if (result.kind === 'duplicate') {
      setResponseState('idle');
      return;
    }

    setResponseState('success');
  }, [donorId, isOwnRequest, profile?.latitude, profile?.longitude, request, requestId]);

  useEffect(() => {
    if (!autoRespondReady || didAutoRespond.current || !request || !donorId) {
      return;
    }

    didAutoRespond.current = true;
    void handleRespond();
  }, [autoRespondReady, donorId, handleRespond, request]);

  const distanceLabel = useMemo(() => {
    if (
      !request ||
      profile?.latitude == null ||
      profile?.longitude == null ||
      request.latitude == null ||
      request.longitude == null
    ) {
      return null;
    }

    return formatDistance(
      haversineDistanceMeters(
        { latitude: profile.latitude, longitude: profile.longitude },
        { latitude: request.latitude, longitude: request.longitude },
      ),
    );
  }, [profile?.latitude, profile?.longitude, request]);

  const hasResponded = Boolean(existingMatch) && !isOwnRequest;
  const showRespondButton = !isOwnRequest && !hasResponded && responseState !== 'success';
  const showStatusCard =
    responseState === 'responding' ||
    responseState === 'success' ||
    responseState === 'error' ||
    hasResponded;

  if (loading) {
    return <ContentLoadingSkeleton rows={2} />;
  }

  if (error) {
    return (
      <View style={recipientStyles.centerContent}>
        <Text style={authStyles.error}>{error}</Text>
        <PrimaryButton title="Try again" onPress={() => void loadRequest()} />
        <PrimaryButton
          title="Back to open requests"
          variant="secondary"
          onPress={() => navigation.navigate('AppTabs', { screen: 'Requests' })}
        />
      </View>
    );
  }

  if (!request && !existingMatch) {
    return (
      <View style={recipientStyles.centerContent}>
        <Text style={authStyles.error}>Blood request not found.</Text>
        <PrimaryButton title="Try again" onPress={() => void loadRequest()} />
        <PrimaryButton
          title="Back to open requests"
          variant="secondary"
          onPress={() => navigation.navigate('AppTabs', { screen: 'Requests' })}
        />
      </View>
    );
  }

  if (!request && existingMatch) {
    return (
      <ScrollView
        contentContainerStyle={recipientStyles.scrollContent}
        style={recipientStyles.screen}
      >
        <View style={recipientStyles.card}>
          <Text style={recipientStyles.eyebrow}>Request closed</Text>
          <Text style={recipientStyles.title}>This request is no longer open</Text>
          <Text style={recipientStyles.subtitle}>
            Your response remains on file with status &quot;{existingMatch.status}&quot;. Patient
            and hospital details stay hidden until your match is accepted.
          </Text>
        </View>

        {showStatusCard ? (
          <ResponseStatusCard
            hasExistingMatch={hasResponded}
            match={existingMatch}
            responseError={responseError}
            responseState={responseState}
          />
        ) : null}

        {isOwnRequest ? (
          <OwnRequestCard
            onManage={() => navigation.navigate('BloodRequestDetail', { requestId })}
          />
        ) : null}

        {matchedDetails ? <SensitiveDetailsCard details={matchedDetails} /> : null}

        {!isOwnRequest && existingMatch && isQrEligibleMatchStatus(existingMatch.status) ? (
          <>
            <PrimaryButton
              title="Open secure chat"
              loading={openingChat}
              onPress={() => void openMatchChat()}
            />
            {chatError ? <Text style={authStyles.error}>{chatError}</Text> : null}
            <PrimaryButton
              title="Show QR for staff verification"
              variant="secondary"
              onPress={() =>
                navigation.navigate('DonationQr', {
                  matchId: existingMatch.id,
                })
              }
            />
          </>
        ) : null}

        <PrimaryButton
          title="Back to open requests"
          variant="secondary"
          onPress={() => navigation.navigate('AppTabs', { screen: 'Requests' })}
        />
      </ScrollView>
    );
  }

  if (!request) {
    return null;
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
      </View>

      <ScrollView
        contentContainerStyle={recipientStyles.scrollContent}
        style={recipientStyles.screen}
      >
        <View style={recipientStyles.sectionWrapper}>
          <Text style={recipientStyles.sectionTitle}>Request Details</Text>
          <View style={recipientStyles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                {/* Blood Box */}
                <BloodTypeBadge bloodType={request.blood_type} />

                {/* Hospital & Meta */}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: fontFamilies.textBold, fontSize: 13.5, fontWeight: '700' }}>
                    {request.hospital_name?.trim() || 'Hospital not provided'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: colors.muted, fontFamily: fontFamilies.textSemibold, fontSize: 11, fontWeight: '600' }}>
                      {request.units_needed} {request.units_needed === 1 ? 'Unit' : 'Units'} Needed
                    </Text>
                  </View>
                </View>
              </View>

              {/* Urgency Tag */}
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <UrgencyBadge urgency={request.urgency} />
              </View>
            </View>

            <View style={recipientStyles.infoBanner}>
              <Text style={recipientStyles.infoBannerText}>
                Patient and contact details are hidden until your match is accepted.
              </Text>
            </View>

            <View style={recipientStyles.detailGrid}>
              <DetailRow
                label="Units"
                value={`${request.units_needed} ${request.units_needed === 1 ? 'unit' : 'units'}`}
              />
              <DetailRow label="Needed By" value={formatDateTime(request.needed_at)} />
              {distanceLabel ? <DetailRow label="Distance" value={distanceLabel} /> : null}
              {request.address?.trim() ? (
                <DetailRow label="Hospital address" value={request.address.trim()} />
              ) : null}
              <DetailRow label="Posted" value={formatDateTime(request.created_at)} isLast />
            </View>
          </View>
        </View>

      <RequestLocationMapPreview
        latitude={request.latitude}
        longitude={request.longitude}
        subtitle="Exact request location for navigation and coordination."
        title="Request location"
      />

      {showStatusCard ? (
        <ResponseStatusCard
          hasExistingMatch={hasResponded}
          match={existingMatch}
          responseError={responseError}
          responseState={responseState}
        />
      ) : null}

      {isOwnRequest ? (
        <OwnRequestCard
          onManage={() => navigation.navigate('BloodRequestDetail', { requestId })}
        />
      ) : null}

      {matchedDetails ? <SensitiveDetailsCard details={matchedDetails} /> : null}

      {!isOwnRequest && existingMatch && isQrEligibleMatchStatus(existingMatch.status) ? (
        <>
          <PrimaryButton
            title="Open secure chat"
            loading={openingChat}
            onPress={() => void openMatchChat()}
          />
          {chatError ? <Text style={authStyles.error}>{chatError}</Text> : null}
          <PrimaryButton
            title="Show QR for staff verification"
            variant="secondary"
            onPress={() =>
              navigation.navigate('DonationQr', {
                matchId: existingMatch.id,
              })
            }
          />
        </>
      ) : null}

      <SafetyReminderCard />

      {showRespondButton ? (
        <PrimaryButton
          title={responseState === 'error' ? 'Try again' : 'Respond to request'}
          variant="donate"
          loading={responseState === 'responding'}
          onPress={() => void handleRespond()}
        />
      ) : null}

      <PrimaryButton
        title="Back to open requests"
        variant="secondary"
        onPress={() => navigation.navigate('AppTabs', { screen: 'Requests' })}
      />
      </ScrollView>
    </View>
  );
}
