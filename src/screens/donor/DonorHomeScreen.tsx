import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Bell,
  ChevronRight,
  Clock,
  Droplets,
  MapPin,
  MessageCircle,
} from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UrgentRequestCard } from '@/components/donor/UrgentRequestCard';
import { ModeToggle } from '@/components/common/ModeToggle';
import { DashboardQuickActions } from '@/components/common/DashboardQuickActions';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { Skeleton } from '@/components/common/Skeleton';
import { HemieFloatingButton } from '@/components/hemie/HemieFloatingButton';
import { NearbyDonorFeedCard } from '@/components/recipient/NearbyDonorFeedCard';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { AppTabParamList } from '@/navigation/AppTabNavigator';
import type { AppStackParamList } from '@/navigation/types';
import { donorHomeStyles } from '@/screens/donor/donorHomeStyles';
import { listNotifications } from '@/services/supabase/notifications';
import {
  getOpenBloodRequestsFeed,
  type OpenBloodRequestFeedItem,
} from '@/services/supabase/openBloodRequestsFeed';
import {
  subscribeToOpenBloodRequests,
  subscribeToUserNotifications,
  unsubscribe,
} from '@/services/supabase/realtime';
import {
  getNearbyMapDonors,
  type NearbyMapDonorItem,
} from '@/services/supabase/nearbyMapDonors';
import { haversineDistanceMeters } from '@/utils/coordinates';
import { formatRelativeTime } from '@/utils/relativeTime';
import { formatLastDonationLabel } from '@/utils/donorMapDisplay';
import { sanitizeProfileError } from '@/utils/profileErrors';

import { appCache } from '@/utils/appCache';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Home'>,
  NativeStackScreenProps<AppStackParamList>
>;

const URGENCY_PRIORITY = {
  critical: 0,
  urgent: 1,
  normal: 2,
} as const;

const formatDistanceLabel = (distanceMeters: number) => {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
};

const getFirstName = (fullName: string | null | undefined) => {
  const trimmed = fullName?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0];
};

function DonorHomeSkeleton({ topInset }: { topInset: number }) {
  return (
    <View style={donorHomeStyles.screen}>
      <View style={[donorHomeStyles.header, { paddingTop: topInset + 8 }]}>
        <View style={donorHomeStyles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Skeleton borderRadius={999} height={42} width={42} />
            <View style={{ flex: 1, gap: 4 }}>
              <Skeleton height={20} width="60%" />
              <Skeleton height={14} width="35%" />
            </View>
          </View>
          <Skeleton borderRadius={999} height={40} width={40} />
        </View>
        <Skeleton borderRadius={999} height={44} style={donorHomeStyles.modeToggleRow} width="100%" />
      </View>
      <View style={[donorHomeStyles.scrollContent, { paddingTop: 24 }]}>
        <Skeleton borderRadius={16} height={120} width="100%" />
        <View style={donorHomeStyles.statRow}>
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

export function DonorHomeScreen({ navigation }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const cachedRequests = appCache.getSync<OpenBloodRequestFeedItem[]>('feed:open_requests');
  const cachedNearby = appCache.getSync<NearbyMapDonorItem[]>('feed:nearby_donors');
  const cachedUnread = session?.user.id
    ? appCache.getSync<boolean>(`notifications:unread:${session.user.id}`)
    : false;

  const [initialLoading, setInitialLoading] = useState(
    () => !cachedRequests && !cachedNearby,
  );
  const hasLoadedOnceRef = useRef(Boolean(cachedRequests || cachedNearby));
  const [requests, setRequests] = useState<OpenBloodRequestFeedItem[]>(() => cachedRequests ?? []);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(
    () => cachedUnread ?? false,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nearbyDonors, setNearbyDonors] = useState<NearbyMapDonorItem[]>(() => cachedNearby ?? []);

  const firstName = getFirstName(profile?.full_name);

  const urgentRequests = useMemo(() => {
    const donorCoordinates =
      profile?.latitude != null &&
      profile?.longitude != null &&
      Number.isFinite(profile.latitude) &&
      Number.isFinite(profile.longitude)
        ? { latitude: profile.latitude, longitude: profile.longitude }
        : null;

    return [...requests]
      .sort((left, right) => {
        const urgencyDiff = URGENCY_PRIORITY[left.urgency] - URGENCY_PRIORITY[right.urgency];
        if (urgencyDiff !== 0) {
          return urgencyDiff;
        }

        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      })
      .slice(0, 3)
      .map((request) => {
        const distanceMeters =
          donorCoordinates &&
          request.latitude != null &&
          request.longitude != null
            ? haversineDistanceMeters(donorCoordinates, {
                latitude: request.latitude,
                longitude: request.longitude,
              })
            : null;

        const distanceLabel =
          distanceMeters == null
            ? 'Nearby'
            : distanceMeters < 1000
              ? `${Math.round(distanceMeters)} m`
              : `${(distanceMeters / 1000).toFixed(1)} km`;

        return {
          ...request,
          distanceLabel,
          timeLabel: formatRelativeTime(request.created_at),
          title: `${request.blood_type} blood request`,
        };
      });
  }, [profile?.latitude, profile?.longitude, requests]);

  const loadHomeData = useCallback(async (isRefresh = false) => {
    if (!session?.user.id) {
      setInitialLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else if (!hasLoadedOnceRef.current && !appCache.getSync('feed:open_requests')) {
      setInitialLoading(true);
    }

    setLoadError(null);

    try {
      const [
        requestsResult,
        notificationsResult,
      ] = await Promise.all([
        getOpenBloodRequestsFeed(),
        listNotifications(),
      ]);

      if (requestsResult.error) {
        throw requestsResult.error;
      }

      if (notificationsResult.error) {
        throw notificationsResult.error;
      }

      const freshRequests = requestsResult.data ?? [];
      setRequests(freshRequests);
      appCache.setSync('feed:open_requests', freshRequests);

      if (profile?.latitude != null && profile?.longitude != null) {
        const donorsResult = await getNearbyMapDonors({
          originLatitude: profile.latitude,
          originLongitude: profile.longitude,
          radiusKm: 5,
          maxResults: 3,
        });
        if (!donorsResult.error) {
          const freshDonors = donorsResult.data ?? [];
          setNearbyDonors(freshDonors);
          appCache.setSync('feed:nearby_donors', freshDonors);
        }
      }

      const unread = (notificationsResult.data ?? []).some(
        (notification) => notification.read_at === null,
      );
      setHasUnreadNotifications(unread);
      appCache.setSync(`notifications:unread:${session.user.id}`, unread);
    } catch (error) {
      setLoadError(sanitizeProfileError(error, 'Unable to load donor home data.'));
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
      hasLoadedOnceRef.current = true;
    }
  }, [session?.user.id, profile?.latitude, profile?.longitude]);

  useEffect(() => {
    if (!session?.user.id) return;

    const requestSub = subscribeToOpenBloodRequests((feed) => {
      setRequests(feed);
      setInitialLoading(false);
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
      void loadHomeData();
    }, [loadHomeData]),
  );

  const userInitials = (profile?.full_name || 'Donor')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join('') || 'D';

  if (initialLoading && !hasLoadedOnceRef.current) {
    return <DonorHomeSkeleton topInset={topInset} />;
  }

  return (
    <View style={donorHomeStyles.screen}>
      <View style={[donorHomeStyles.header, { paddingTop: topInset + 8 }]}>
        <View style={donorHomeStyles.headerRow}>
          <View style={donorHomeStyles.headerUserRow}>
            <View style={donorHomeStyles.avatarBox}>
              <Text style={donorHomeStyles.avatarText}>{userInitials}</Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text style={donorHomeStyles.userNameText}>
                {profile?.full_name || (firstName ? `Hello, ${firstName}` : 'Donor')}
              </Text>
              {profile?.blood_type ? (
                <View style={donorHomeStyles.userBloodBadge}>
                  <Text style={donorHomeStyles.userBloodBadgeText}>{profile.blood_type} Donor</Text>
                </View>
              ) : (
                <Text style={donorHomeStyles.roleLabel}>Donor</Text>
              )}
            </View>
          </View>
          <Pressable
            accessibilityLabel="Open notifications"
            accessibilityRole="button"
            style={donorHomeStyles.iconButton}
            onPress={() => navigation.getParent()?.navigate('Notifications')}
          >
            <Bell color={colors.foreground} size={20} />
            {hasUnreadNotifications ? <View style={donorHomeStyles.notificationDot} /> : null}
          </Pressable>
        </View>
        <View style={donorHomeStyles.modeToggleRow}>
          <ModeToggle showHint={false} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={donorHomeStyles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadHomeData(true)} />
        }
      >
        {loadError ? (
          <View style={donorHomeStyles.loadErrorCard}>
            <Text style={donorHomeStyles.availabilityError}>{loadError}</Text>
            <PrimaryButton title="Try again" onPress={() => void loadHomeData()} />
          </View>
        ) : null}

        <DashboardQuickActions
          actions={[
            {
              accessibilityLabel: 'View blood requests',
              badge: urgentRequests.length,
              icon: Droplets,
              label: 'Requests',
              onPress: () => navigation.navigate('Requests'),
            },
            {
              accessibilityLabel: 'View nearby map',
              icon: MapPin,
              label: 'Nearby',
              onPress: () => navigation.navigate('Map'),
            },
            {
              accessibilityLabel: 'View donation history',
              icon: Clock,
              label: 'History',
              onPress: () => navigation.getParent()?.navigate('MyDonations'),
            },
            {
              accessibilityLabel: 'View messages',
              icon: MessageCircle,
              label: 'Messages',
              onPress: () => navigation.navigate('Chat'),
            },
          ]}
        />





        <View style={donorHomeStyles.sectionHeader}>
          <View style={donorHomeStyles.sectionTitleRow}>
            <Text style={donorHomeStyles.sectionTitle}>Urgent Requests</Text>
            {urgentRequests.length > 0 ? (
              <View style={donorHomeStyles.countBadge}>
                <Text style={donorHomeStyles.countBadgeText}>{urgentRequests.length}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="View all blood requests"
            accessibilityRole="button"
            style={donorHomeStyles.viewAllButton}
            onPress={() => navigation.navigate('Requests')}
          >
            <Text style={donorHomeStyles.linkText}>All ({requests.length})</Text>
            <ChevronRight color={colors.muted} size={14} />
          </Pressable>
        </View>

        <View style={donorHomeStyles.urgentList}>
          {urgentRequests.length === 0 ? (
            <View style={donorHomeStyles.bloodTypeCard}>
              <Text style={donorHomeStyles.bloodTypeMeta}>
                No urgent requests nearby right now. Pull down to refresh or browse all open
                requests.
              </Text>
            </View>
          ) : (
            urgentRequests.map((request) => (
              <UrgentRequestCard
                key={request.id}
                bloodType={request.blood_type}
                distanceLabel={request.distanceLabel}
                hospitalName={request.hospital_name || request.title}
                timeLabel={request.timeLabel}
                title={request.hospital_name || request.title}
                unitsNeeded={request.units_needed}
                urgency={request.urgency}
                onChat={() => navigation.navigate('Chat')}
                onDetails={() =>
                  navigation
                    .getParent()
                    ?.navigate('DonorRequestDetail', { requestId: request.id })
                }
                onRespond={() =>
                  navigation.getParent()?.navigate('DonorRequestDetail', {
                    requestId: request.id,
                    intent: 'respond',
                  })
                }
              />
            ))
          )}
        </View>

        <View style={donorHomeStyles.sectionHeader}>
          <Text style={donorHomeStyles.sectionTitle}>Available Donors Nearby</Text>
          <Pressable
            accessibilityLabel="View all donors on map"
            accessibilityRole="button"
            style={donorHomeStyles.viewAllButton}
            onPress={() => navigation.navigate('Map')}
          >
            <Text style={donorHomeStyles.linkText}>View Map</Text>
            <ChevronRight color={colors.muted} size={14} />
          </Pressable>
        </View>

        <View style={donorHomeStyles.urgentList}>
          {nearbyDonors.length === 0 ? (
            <View style={donorHomeStyles.bloodTypeCard}>
              <Text style={donorHomeStyles.bloodTypeMeta}>
                No donors found nearby right now. Pull down to refresh or check the map.
              </Text>
            </View>
          ) : (
            nearbyDonors.map((donor) => (
              <NearbyDonorFeedCard
                key={donor.donorId}
                bloodType={donor.bloodType}
                distanceLabel={formatDistanceLabel(donor.distanceMeters)}
                isAvailable={donor.isAvailable}
                name={donor.fullName}
                timeLabel={formatLastDonationLabel(donor.lastDonationAt).replace('Last donation: ', '')}
                onDetails={() => navigation.getParent()?.navigate('NearbyDonorDetail', { donor })}
                onRequest={() =>
                  navigation.getParent()?.navigate(
                    'CreateBloodRequest',
                    profile?.blood_type ? { bloodType: profile.blood_type } : undefined,
                  )
                }
              />
            ))
          )}
        </View>
      </ScrollView>

      <HemieFloatingButton onPress={() => navigation.getParent()?.navigate('HemieAI')} />
    </View>
  );
}
