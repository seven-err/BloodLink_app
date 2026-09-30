import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, Bell, Clock, FileText, Heart, MapPin, MessageCircle, Plus, Users } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DonorStatCard } from '@/components/donor/DonorStatCard';
import { NearbyDonorFeedCard } from '@/components/recipient/NearbyDonorFeedCard';
import { ModeToggle } from '@/components/common/ModeToggle';
import { DashboardQuickActions } from '@/components/common/DashboardQuickActions';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { Skeleton } from '@/components/common/Skeleton';
import { HemieFloatingButton } from '@/components/hemie/HemieFloatingButton';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useForegroundLocation } from '@/hooks/useForegroundLocation';
import type { AppTabParamList } from '@/navigation/AppTabNavigator';
import type { AppStackParamList } from '@/navigation/types';
import { recipientHomeStyles } from '@/screens/recipient/recipientHomeStyles';
import { getMyBloodRequests } from '@/services/supabase/bloodRequests';
import { listNotifications } from '@/services/supabase/notifications';
import {
  subscribeToMyBloodRequests,
  subscribeToUserNotifications,
  unsubscribe,
} from '@/services/supabase/realtime';
import {
  getNearbyMapDonors,
  type NearbyMapDonorItem,
} from '@/services/supabase/nearbyMapDonors';
import { isDonorCompatibleWithRecipient } from '@/utils/bloodTypeCompatibility';
import { formatLastDonationLabel } from '@/utils/donorMapDisplay';
import { sanitizeProfileError } from '@/utils/profileErrors';

import { appCache } from '@/utils/appCache';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Home'>,
  NativeStackScreenProps<AppStackParamList>
>;

const ACTIVE_REQUEST_STATUSES = new Set(['open', 'matched']);
const NEARBY_RADIUS_KM = 5;
const NEARBY_DONOR_PREVIEW_COUNT = 3;

const getFirstName = (fullName: string | null | undefined) => {
  const trimmed = fullName?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0];
};

const getOriginCoordinates = (
  gpsCoordinates: { latitude: number; longitude: number } | null,
  profileLatitude: number | null | undefined,
  profileLongitude: number | null | undefined,
) => {
  if (gpsCoordinates) {
    return gpsCoordinates;
  }

  if (
    profileLatitude != null &&
    profileLongitude != null &&
    Number.isFinite(profileLatitude) &&
    Number.isFinite(profileLongitude)
  ) {
    return {
      latitude: profileLatitude,
      longitude: profileLongitude,
    };
  }

  return null;
};

const formatDistanceLabel = (distanceMeters: number) => {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
};

function RecipientHomeSkeleton({ topInset }: { topInset: number }) {
  return (
    <View style={recipientHomeStyles.screen}>
      <View style={[recipientHomeStyles.header, { paddingTop: topInset + 8 }]}>
        <View style={recipientHomeStyles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Skeleton borderRadius={999} height={42} width={42} />
            <View style={{ flex: 1, gap: 4 }}>
              <Skeleton height={20} width="60%" />
              <Skeleton height={14} width="35%" />
            </View>
          </View>
          <Skeleton borderRadius={999} height={40} width={40} />
        </View>
        <Skeleton borderRadius={999} height={44} style={recipientHomeStyles.modeToggleRow} width="100%" />
      </View>
      <View style={[recipientHomeStyles.scrollContent, { paddingTop: 24 }]}>
        <Skeleton borderRadius={16} height={160} width="100%" />
        <Skeleton borderRadius={16} height={120} width="100%" />
        <View style={recipientHomeStyles.statRow}>
          <Skeleton borderRadius={16} height={120} style={{ flex: 1 }} />
          <Skeleton borderRadius={16} height={120} style={{ flex: 1 }} />
        </View>
        <Skeleton borderRadius={16} height={24} width="60%" />
        <Skeleton borderRadius={16} height={150} width="100%" />
        <Skeleton borderRadius={16} height={150} width="100%" />
      </View>
    </View>
  );
}

export function RecipientHomeScreen({ navigation }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const { profile, session } = useAuth();

  const userId = session?.user.id;
  const cachedCount = userId
    ? appCache.getSync<number>(`recipient:active_request_count:${userId}`)
    : undefined;
  const cachedNearby = appCache.getSync<NearbyMapDonorItem[]>('recipient:nearby_donors');
  const cachedUnread = userId
    ? appCache.getSync<boolean>(`notifications:unread:${userId}`)
    : false;

  const [initialLoading, setInitialLoading] = useState(
    () => cachedCount === undefined && !cachedNearby,
  );
  const hasLoadedOnceRef = useRef(cachedCount !== undefined || Boolean(cachedNearby));
  const [activeRequestCount, setActiveRequestCount] = useState(() => cachedCount ?? 0);
  const [nearbyDonors, setNearbyDonors] = useState<NearbyMapDonorItem[]>(() => cachedNearby ?? []);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(() => cachedUnread ?? false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { coordinates: gpsCoordinates, requestLocation } = useForegroundLocation();

  const firstName = getFirstName(profile?.full_name);
  const userInitials = (profile?.full_name || 'Recipient')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join('') || 'R';

  const originCoordinates = useMemo(
    () => getOriginCoordinates(gpsCoordinates, profile?.latitude, profile?.longitude),
    [gpsCoordinates, profile?.latitude, profile?.longitude],
  );

  const nearbyDonorPreview = useMemo(() => {
    const compatibleDonors = nearbyDonors.filter((donor) => {
      if (!profile?.blood_type) {
        return true;
      }

      return isDonorCompatibleWithRecipient(donor.bloodType, profile.blood_type);
    });

    return [...compatibleDonors]
      .sort((left, right) => {
        if (left.isAvailable !== right.isAvailable) {
          return left.isAvailable ? -1 : 1;
        }

        return left.distanceMeters - right.distanceMeters;
      })
      .slice(0, NEARBY_DONOR_PREVIEW_COUNT)
      .map((donor) => ({
        ...donor,
        distanceLabel: formatDistanceLabel(donor.distanceMeters),
        timeLabel: formatLastDonationLabel(donor.lastDonationAt).replace('Last donation: ', ''),
      }));
  }, [nearbyDonors, profile?.blood_type]);

  const loadHomeData = useCallback(async (isRefresh = false) => {
    if (!session?.user.id) {
      setInitialLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else if (!hasLoadedOnceRef.current && appCache.getSync(`recipient:active_request_count:${session.user.id}`) === undefined) {
      setInitialLoading(true);
    }

    setLoadError(null);

    try {
      const [requestsResult, notificationsResult] = await Promise.all([
        getMyBloodRequests(session.user.id),
        listNotifications(),
      ]);

      if (requestsResult.error) {
        throw requestsResult.error;
      }

      if (notificationsResult.error) {
        throw notificationsResult.error;
      }

      const requests = requestsResult.data ?? [];
      const count = requests.filter((request) => ACTIVE_REQUEST_STATUSES.has(request.status)).length;
      setActiveRequestCount(count);
      appCache.setSync(`recipient:active_request_count:${session.user.id}`, count);
      appCache.setSync(`recipient:my_requests:${session.user.id}`, requests);

      const unread = (notificationsResult.data ?? []).some((notification) => notification.read_at === null);
      setHasUnreadNotifications(unread);
      appCache.setSync(`notifications:unread:${session.user.id}`, unread);

      if (originCoordinates) {
        const { data, error: donorsError } = await getNearbyMapDonors({
          originLatitude: originCoordinates.latitude,
          originLongitude: originCoordinates.longitude,
          radiusKm: NEARBY_RADIUS_KM,
          maxResults: 50,
          availableOnly: false,
        });

        if (donorsError) {
          throw donorsError;
        }

        const freshDonors = data ?? [];
        setNearbyDonors(freshDonors);
        appCache.setSync('recipient:nearby_donors', freshDonors);
      } else {
        setNearbyDonors([]);
      }
    } catch (error) {
      setLoadError(sanitizeProfileError(error, 'Unable to load recipient home data.'));
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
      hasLoadedOnceRef.current = true;
    }
  }, [originCoordinates, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;

    const requestSub = subscribeToMyBloodRequests(session.user.id, () => {
      void loadHomeData(false);
    });

    const notifChannel = subscribeToUserNotifications(session.user.id, () => {
      void loadHomeData(false);
    });

    return () => {
      requestSub.stop();
      unsubscribe(notifChannel);
    };
  }, [session?.user.id, loadHomeData]);

  useFocusEffect(
    useCallback(() => {
      void requestLocation();
      void loadHomeData();
    }, [loadHomeData, requestLocation]),
  );

  const openDonorDetail = (donor: NearbyMapDonorItem) => {
    navigation.getParent()?.navigate('NearbyDonorDetail', { donor });
  };

  const openCreateBloodRequest = () => {
    navigation.getParent()?.navigate(
      'CreateBloodRequest',
      profile?.blood_type ? { bloodType: profile.blood_type } : undefined,
    );
  };

  if (initialLoading && !hasLoadedOnceRef.current) {
    return <RecipientHomeSkeleton topInset={topInset} />;
  }

  return (
    <View style={recipientHomeStyles.screen}>
      <View style={[recipientHomeStyles.header, { paddingTop: topInset + 8 }]}>
        <View style={recipientHomeStyles.headerRow}>
          <View style={recipientHomeStyles.headerUserRow}>
            <View style={recipientHomeStyles.avatarBox}>
              <Text style={recipientHomeStyles.avatarText}>{userInitials}</Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text style={recipientHomeStyles.userNameText}>
                {profile?.full_name || (firstName ? `Hello, ${firstName}` : 'Recipient')}
              </Text>
              {profile?.blood_type ? (
                <View style={recipientHomeStyles.userBloodBadge}>
                  <Text style={recipientHomeStyles.userBloodBadgeText}>{profile.blood_type} Recipient</Text>
                </View>
              ) : (
                <Text style={recipientHomeStyles.roleLabel}>Recipient</Text>
              )}
            </View>
          </View>
          <Pressable
            accessibilityLabel="Open notifications"
            accessibilityRole="button"
            style={recipientHomeStyles.iconButton}
            onPress={() => navigation.getParent()?.navigate('Notifications')}
          >
            <Bell color={colors.foreground} size={20} />
            {hasUnreadNotifications ? <View style={recipientHomeStyles.notificationDot} /> : null}
          </Pressable>
        </View>
        <View style={recipientHomeStyles.modeToggleRow}>
          {profile?.role === 'recipient' ? (
            <Pressable
              accessibilityRole="button"
              style={recipientHomeStyles.applyDonorCard}
              onPress={() => navigation.getParent()?.navigate('ApplyDonor')}
            >
              <View style={recipientHomeStyles.applyDonorIcon}>
                <Heart color={colors.primary} size={18} />
              </View>
              <View style={recipientHomeStyles.applyDonorCopy}>
                <Text style={recipientHomeStyles.applyDonorTitle}>Apply as a donor</Text>
                <Text style={recipientHomeStyles.applyDonorBody}>
                  Donor tools are hidden on a recipient account. Please proceed to donor setup to donate blood.
                </Text>
              </View>
            </Pressable>
          ) : (
            <ModeToggle showHint={false} />
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={recipientHomeStyles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadHomeData(true)} />
        }
      >
        <View style={recipientHomeStyles.emergencyCard}>
          <View style={recipientHomeStyles.emergencyHeader}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={recipientHomeStyles.emergencyTitle}>Emergency Request</Text>
              <Text style={recipientHomeStyles.emergencySubtitle}>
                Broadcast instant SOS to nearby donors
              </Text>
            </View>
            <View style={recipientHomeStyles.emergencyIcon}>
              <AlertCircle color={colors.primary} size={20} />
            </View>
          </View>
          <Pressable
            accessibilityLabel="Create blood request"
            accessibilityRole="button"
            style={({ pressed }) => [
              recipientHomeStyles.emergencyButton,
              pressed ? { opacity: 0.92 } : null,
            ]}
            onPress={() => navigation.getParent()?.navigate('CreateBloodRequest')}
          >
            <Plus color={colors.primaryForeground} size={18} />
            <Text style={recipientHomeStyles.emergencyButtonText}>Create Blood Request</Text>
          </Pressable>
        </View>

        <DashboardQuickActions
          actions={[
            {
              accessibilityLabel: 'Create new request',
              icon: Plus,
              label: 'New Request',
              onPress: () => navigation.getParent()?.navigate('CreateBloodRequest'),
            },
            {
              accessibilityLabel: 'View my requests',
              badge: activeRequestCount,
              icon: FileText,
              label: 'My Requests',
              onPress: () => navigation.navigate('Requests'),
            },
            {
              accessibilityLabel: 'View donor map',
              icon: MapPin,
              label: 'Nearby',
              onPress: () => navigation.navigate('Map'),
            },
            {
              accessibilityLabel: 'View messages',
              icon: MessageCircle,
              label: 'Messages',
              onPress: () => navigation.navigate('Chat'),
            },
          ]}
        />



        <View style={recipientHomeStyles.statRow}>
          <DonorStatCard
            icon={<Users color={colors.muted} size={20} />}
            label="Active Requests"
            subtext="Being processed"
            subtextColor={colors.info}
            value={String(activeRequestCount)}
          />
          <DonorStatCard
            icon={<Clock color={colors.muted} size={20} />}
            label="Nearby Donors"
            subtext={`within ${NEARBY_RADIUS_KM} km`}
            value={String(nearbyDonors.length)}
          />
        </View>

        {loadError ? (
          <View style={recipientHomeStyles.loadErrorCard}>
            <Text style={recipientHomeStyles.errorText}>{loadError}</Text>
            <PrimaryButton title="Try again" onPress={() => void loadHomeData()} />
          </View>
        ) : null}

        <View style={recipientHomeStyles.sectionHeader}>
          <Text style={recipientHomeStyles.sectionTitle}>Available Donors Nearby</Text>
          <Pressable
            accessibilityLabel="View all donors on map"
            accessibilityRole="button"
            style={recipientHomeStyles.viewAllButton}
            onPress={() => navigation.navigate('Map')}
          >
            <Text style={recipientHomeStyles.linkText}>View All</Text>
          </Pressable>
        </View>

        <View style={recipientHomeStyles.donorList}>
          {!originCoordinates ? (
            <View style={recipientHomeStyles.bloodTypeCard}>
              <Text style={recipientHomeStyles.bloodTypeMeta}>
                Turn on location to see compatible donors near you.
              </Text>
              <PrimaryButton title="Enable location" onPress={() => void requestLocation()} />
            </View>
          ) : nearbyDonorPreview.length === 0 ? (
            <View style={recipientHomeStyles.bloodTypeCard}>
              <Text style={recipientHomeStyles.bloodTypeMeta}>
                No compatible donors nearby right now. Pull down to refresh or browse the map.
              </Text>
            </View>
          ) : (
            nearbyDonorPreview.map((donor) => (
              <NearbyDonorFeedCard
                key={donor.donorId}
                bloodType={donor.bloodType}
                distanceLabel={donor.distanceLabel}
                isAvailable={donor.isAvailable}
                name={donor.fullName}
                timeLabel={donor.timeLabel}
                onDetails={() => openDonorDetail(donor)}
                onRequest={openCreateBloodRequest}
              />
            ))
          )}
        </View>
      </ScrollView>

      <HemieFloatingButton onPress={() => navigation.getParent()?.navigate('HemieAI')} />
    </View>
  );
}
