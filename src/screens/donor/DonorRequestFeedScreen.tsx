import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, Filter, Flame, Map, Search } from 'lucide-react-native';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DonorRequestFeedCard } from '@/components/donor/DonorRequestFeedCard';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { Skeleton } from '@/components/common/Skeleton';
import { HemieFloatingButton } from '@/components/hemie/HemieFloatingButton';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { AppTabParamList } from '@/navigation/AppTabNavigator';
import type { AppStackParamList } from '@/navigation/types';
import { donorRequestFeedStyles } from '@/screens/donor/donorRequestFeedStyles';
import {
  getOpenBloodRequestsFeed,
  type OpenBloodRequestFeedItem,
} from '@/services/supabase/openBloodRequestsFeed';
import { subscribeToOpenBloodRequests } from '@/services/supabase/realtime';
import { isDonorCompatibleWithRecipient } from '@/utils/bloodTypeCompatibility';
import { haversineDistanceMeters } from '@/utils/coordinates';
import { formatRelativeTime } from '@/utils/relativeTime';

import { appCache } from '@/utils/appCache';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Requests'>,
  NativeStackScreenProps<AppStackParamList>
>;

type RequestFilter = 'all' | 'critical' | 'high' | 'compatible';

const URGENCY_PRIORITY = {
  critical: 0,
  urgent: 1,
  normal: 2,
} as const;

const FILTER_CHIPS: { id: RequestFilter; label: string; icon?: typeof Flame }[] = [
  { id: 'compatible', label: 'Compatible', icon: Check },
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical', icon: Flame },
  { id: 'high', label: 'High' },
];

const getRequestDisplayTitle = (request: OpenBloodRequestFeedItem) => {
  const shortId = request.id.replace(/-/g, '').slice(-3).toUpperCase();

  if (request.urgency === 'critical') {
    return `Emergency Case #${shortId}`;
  }

  return `Patient ${request.blood_type}-${shortId}`;
};

const getRequestSubtitle = (request: OpenBloodRequestFeedItem) => {
  const hospital = request.hospital_name?.trim();
  const address = request.address?.trim();

  if (hospital && address) {
    return `${hospital} · ${address}`;
  }

  if (hospital) {
    return hospital;
  }

  if (address) {
    return address;
  }

  if (request.latitude != null && request.longitude != null) {
    return 'Exact coordinates available';
  }

  return 'Location not provided';
};

const getDistanceMeta = (
  request: OpenBloodRequestFeedItem,
  donorCoordinates: { latitude: number; longitude: number } | null,
) => {
  if (
    !donorCoordinates ||
    request.latitude == null ||
    request.longitude == null
  ) {
    return {
      distanceLabel: 'Distance unavailable',
      distanceMeters: null,
    };
  }

  const distanceMeters = haversineDistanceMeters(donorCoordinates, {
    latitude: request.latitude,
    longitude: request.longitude,
  });

  const distanceLabel =
    distanceMeters < 1000
      ? `${Math.round(distanceMeters)} m`
      : `${(distanceMeters / 1000).toFixed(1)} km`;

  return { distanceLabel, distanceMeters };
};

function DonorRequestFeedSkeleton({ topInset }: { topInset: number }) {
  return (
    <View style={donorRequestFeedStyles.screen}>
      <View style={[donorRequestFeedStyles.header, { paddingTop: topInset + 8 }]}>
        <Skeleton borderRadius={10} height={28} width="55%" />
        <Skeleton borderRadius={12} height={40} width={72} />
      </View>
      <View style={donorRequestFeedStyles.listContent}>
        <Skeleton borderRadius={999} height={48} width="100%" />
        <Skeleton borderRadius={999} height={38} width="100%" />
        <Skeleton borderRadius={16} height={220} width="100%" />
        <Skeleton borderRadius={16} height={220} width="100%" />
      </View>
    </View>
  );
}

export function DonorRequestFeedScreen({ navigation }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const { profile } = useAuth();
  const cachedRequests = appCache.getSync<OpenBloodRequestFeedItem[]>('feed:open_requests');
  const [requests, setRequests] = useState<OpenBloodRequestFeedItem[]>(() => cachedRequests ?? []);
  const [loading, setLoading] = useState(() => !cachedRequests);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<RequestFilter>('compatible');

  const donorCoordinates = useMemo(() => {
    if (
      profile?.latitude != null &&
      profile?.longitude != null &&
      Number.isFinite(profile.latitude) &&
      Number.isFinite(profile.longitude)
    ) {
      return {
        latitude: profile.latitude,
        longitude: profile.longitude,
      };
    }

    return null;
  }, [profile?.latitude, profile?.longitude]);

  const loadRequests = useCallback(async (isRefresh = false, isSilent = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent && !appCache.getSync('feed:open_requests')) {
      setLoading(true);
    }

    setError(null);

    const { data, error: fetchError } = await getOpenBloodRequestsFeed();

    if (fetchError) {
      setError(fetchError.message);
      if (!isSilent && !appCache.getSync('feed:open_requests')) {
        setRequests([]);
      }
    } else {
      const fresh = data ?? [];
      setRequests(fresh);
      appCache.setSync('feed:open_requests', fresh);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const subscription = subscribeToOpenBloodRequests((feed) => {
      setRequests(feed);
      appCache.setSync('feed:open_requests', feed);
      setLoading(false);
    });

    return () => {
      subscription.stop();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      // For focus, we do a silent fetch to ensure up-to-date data
      void loadRequests(false, true);
    }, [loadRequests]),
  );

  const enrichedRequests = useMemo(
    () =>
      requests.map((request) => {
        const { distanceLabel, distanceMeters } = getDistanceMeta(request, donorCoordinates);

        return {
          ...request,
          compatible: isDonorCompatibleWithRecipient(profile?.blood_type, request.blood_type),
          distanceLabel,
          distanceMeters,
          subtitle: getRequestSubtitle(request),
          timeLabel: formatRelativeTime(request.created_at),
          title: getRequestDisplayTitle(request),
        };
      }),
    [donorCoordinates, profile?.blood_type, requests],
  );

  const visibleRequests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return enrichedRequests
      .filter((request) => {
        if (activeFilter === 'critical' && request.urgency !== 'critical') {
          return false;
        }

        if (activeFilter === 'high' && request.urgency !== 'urgent') {
          return false;
        }

        if (activeFilter === 'compatible' && profile?.blood_type && !request.compatible) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          request.title,
          request.subtitle,
          request.blood_type,
          request.distanceLabel,
          request.timeLabel,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (activeFilter === 'compatible') {
          if (left.distanceMeters == null && right.distanceMeters != null) {
            return 1;
          }

          if (left.distanceMeters != null && right.distanceMeters == null) {
            return -1;
          }

          if (left.distanceMeters != null && right.distanceMeters != null) {
            const distanceDiff = left.distanceMeters - right.distanceMeters;
            if (distanceDiff !== 0) {
              return distanceDiff;
            }
          }
        }

        const urgencyDiff = URGENCY_PRIORITY[left.urgency] - URGENCY_PRIORITY[right.urgency];
        if (urgencyDiff !== 0) {
          return urgencyDiff;
        }

        if (activeFilter !== 'compatible' && left.distanceMeters != null && right.distanceMeters != null) {
          return left.distanceMeters - right.distanceMeters;
        }

        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
  }, [activeFilter, enrichedRequests, profile?.blood_type, searchQuery]);

  const handleFilterShortcut = () => {
    if (activeFilter === 'all') {
      setActiveFilter('compatible');
      return;
    }

    setActiveFilter('all');
    setSearchQuery('');
  };

  if (loading) {
    return <DonorRequestFeedSkeleton topInset={topInset} />;
  }

  if (error && requests.length === 0) {
    return (
      <View style={[donorRequestFeedStyles.screen, { justifyContent: 'center', padding: 24 }]}>
        <Text style={donorRequestFeedStyles.errorText}>{error}</Text>
        <PrimaryButton title="Try again" onPress={() => void loadRequests()} />
      </View>
    );
  }

  return (
    <View style={donorRequestFeedStyles.screen}>
      <View style={[donorRequestFeedStyles.header, { paddingTop: topInset + 8 }]}>
        <Text style={[donorRequestFeedStyles.headerTitle, { flex: 1 }]}>Blood Requests</Text>
        <Pressable
          accessibilityLabel="View nearby donors map"
          accessibilityRole="button"
          style={({ pressed }) => [
            donorRequestFeedStyles.mapLinkButton,
            pressed ? donorRequestFeedStyles.mapLinkButtonPressed : null,
          ]}
          onPress={() => navigation.navigate('Map')}
        >
          <Map color={colors.muted} size={18} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={donorRequestFeedStyles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.muted}
            onRefresh={() => void loadRequests(true)}
          />
        }
      >
        <View style={donorRequestFeedStyles.toolbar}>
          <View style={donorRequestFeedStyles.searchRow}>
            <View style={donorRequestFeedStyles.searchShell}>
              <Search color={colors.mutedLight} size={18} />
              <TextInput
                placeholder="Search requests..."
                placeholderTextColor={colors.mutedLight}
                style={donorRequestFeedStyles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <Pressable
              accessibilityLabel={
                activeFilter === 'compatible'
                  ? 'Show all requests'
                  : 'Show compatible requests only'
              }
              accessibilityRole="button"
              style={({ pressed }) => [
                donorRequestFeedStyles.filterButton,
                pressed ? donorRequestFeedStyles.filterButtonPressed : null,
              ]}
              onPress={handleFilterShortcut}
            >
              <Filter color={colors.foreground} size={18} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={donorRequestFeedStyles.chipRow}
            showsHorizontalScrollIndicator={false}
            style={donorRequestFeedStyles.chipScroll}
          >
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilter === chip.id;
              const ChipIcon = chip.icon;

              return (
                <Pressable
                  key={chip.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  style={[
                    donorRequestFeedStyles.chip,
                    isActive ? donorRequestFeedStyles.chipActive : null,
                  ]}
                  onPress={() => setActiveFilter(chip.id)}
                >
                  {ChipIcon ? (
                    <ChipIcon
                      color={isActive ? colors.primaryForeground : colors.muted}
                      size={14}
                    />
                  ) : null}
                  <Text
                    style={[
                      donorRequestFeedStyles.chipLabel,
                      isActive ? donorRequestFeedStyles.chipLabelActive : null,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Map')}
          >
            <Text style={donorRequestFeedStyles.mapTextLink}>View nearby donors on map</Text>
          </Pressable>
        </View>

        {error ? <Text style={donorRequestFeedStyles.errorText}>{error}</Text> : null}

        {visibleRequests.length === 0 ? (
          <View style={donorRequestFeedStyles.emptyCard}>
            <Text style={donorRequestFeedStyles.emptyText}>
              No requests match your filters right now. Try another category or pull down to
              refresh.
            </Text>
          </View>
        ) : (
          visibleRequests.map((request) => (
            <DonorRequestFeedCard
              key={request.id}
              bloodType={request.blood_type}
              compatible={request.compatible}
              distanceLabel={request.distanceLabel}
              subtitle={request.subtitle}
              timeLabel={request.timeLabel}
              title={request.title}
              unitsNeeded={request.units_needed}
              urgency={request.urgency}
              onChat={() => navigation.navigate('Chat')}
              onRespond={() =>
                navigation.getParent()?.navigate('DonorRequestDetail', {
                  requestId: request.id,
                  intent: 'respond',
                })
              }
              onViewDetails={() =>
                navigation
                  .getParent()
                  ?.navigate('DonorRequestDetail', { requestId: request.id })
              }
            />
          ))
        )}
      </ScrollView>

      <HemieFloatingButton onPress={() => navigation.getParent()?.navigate('HemieAI')} />
    </View>
  );
}
