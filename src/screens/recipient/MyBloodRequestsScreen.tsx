import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Droplets,
  Layers,
  Plus,
  Users,
} from 'lucide-react-native';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequestListCard } from '@/components/bloodRequest/RequestListCard';
import { ContentLoadingSkeleton } from '@/components/common/ContentLoadingSkeleton';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { colors } from '@/constants/theme';
import { URGENCY_LABELS } from '@/constants/bloodRequestUrgency';
import { useAuth } from '@/context/AuthContext';
import type { AppTabParamList } from '@/navigation/AppTabNavigator';
import type { AppStackParamList } from '@/navigation/types';
import { recipientStyles } from '@/screens/recipient/styles';
import { authStyles } from '@/screens/auth/styles';
import { getMyBloodRequests, type BloodRequest } from '@/services/supabase/bloodRequests';
import { subscribeToMyBloodRequests } from '@/services/supabase/realtime';

import { appCache } from '@/utils/appCache';

type Props =
  | CompositeScreenProps<
      BottomTabScreenProps<AppTabParamList, 'Requests'>,
      NativeStackScreenProps<AppStackParamList>
    >
  | NativeStackScreenProps<AppStackParamList, 'MyBloodRequests'>;

type FilterTab = 'all' | 'active' | 'matched' | 'completed';

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleString();
};

export function MyBloodRequestsScreen({ navigation }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const isTabScreen = 'jumpTo' in navigation;
  const stackNavigation = 'getParent' in navigation ? navigation.getParent() : navigation;
  const { session } = useAuth();
  const userId = session?.user.id;
  const cachedRequests = userId
    ? appCache.getSync<BloodRequest[]>(`recipient:my_requests:${userId}`)
    : undefined;

  const [requests, setRequests] = useState<BloodRequest[]>(() => cachedRequests ?? []);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(() => cachedRequests === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(
    async (isRefresh = false, isSilent = false) => {
      if (!session?.user.id) {
        setError('You need to be signed in to view your requests.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else if (!isSilent && !appCache.getSync(`recipient:my_requests:${session.user.id}`)) {
        setLoading(true);
      }

      setError(null);

      const { data, error: fetchError } = await getMyBloodRequests(session.user.id);

      if (fetchError) {
        setError(fetchError.message);
        if (!isSilent && !appCache.getSync(`recipient:my_requests:${session.user.id}`)) {
          setRequests([]);
        }
      } else {
        const fresh = data ?? [];
        setRequests(fresh);
        appCache.setSync(`recipient:my_requests:${session.user.id}`, fresh);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [session?.user.id],
  );

  useEffect(() => {
    if (!session?.user.id) return;

    const subscription = subscribeToMyBloodRequests(session.user.id, () => {
      void loadRequests(false, true);
    });

    return () => {
      subscription.stop();
    };
  }, [session?.user.id, loadRequests]);

  useFocusEffect(
    useCallback(() => {
      void loadRequests(false, true);
    }, [loadRequests]),
  );

  const openCreateRequest = () => {
    stackNavigation?.navigate('CreateBloodRequest');
  };

  const filteredRequests = useMemo(() => {
    if (activeFilter === 'all') {
      return requests;
    }
    if (activeFilter === 'active') {
      return requests.filter((r) => r.status === 'open');
    }
    if (activeFilter === 'matched') {
      return requests.filter((r) => r.status === 'matched');
    }
    if (activeFilter === 'completed') {
      return requests.filter(
        (r) => r.status === 'fulfilled' || r.status === 'cancelled' || r.status === 'expired',
      );
    }
    return requests;
  }, [activeFilter, requests]);

  const activeCount = useMemo(() => requests.filter((r) => r.status === 'open').length, [requests]);
  const matchedCount = useMemo(() => requests.filter((r) => r.status === 'matched').length, [requests]);
  const completedCount = useMemo(
    () =>
      requests.filter(
        (r) => r.status === 'fulfilled' || r.status === 'cancelled' || r.status === 'expired',
      ).length,
    [requests],
  );

  if (loading) {
    return <ContentLoadingSkeleton />;
  }

  if (error && requests.length === 0) {
    return (
      <View style={recipientStyles.centerContent}>
        <Text style={authStyles.error}>{error}</Text>
        <PrimaryButton title="Try again" onPress={() => void loadRequests()} />
        <PrimaryButton
          title="Create blood request"
          variant="secondary"
          onPress={openCreateRequest}
        />
      </View>
    );
  }

  const FILTERS: { id: FilterTab; label: string; count: number; icon: React.ReactNode }[] = [
    {
      id: 'all',
      label: 'All',
      count: requests.length,
      icon: (
        <Layers
          color={activeFilter === 'all' ? colors.primaryForeground : colors.muted}
          size={13}
          strokeWidth={2.25}
        />
      ),
    },
    {
      id: 'active',
      label: 'Open',
      count: activeCount,
      icon: (
        <Activity
          color={activeFilter === 'active' ? colors.primaryForeground : colors.muted}
          size={13}
          strokeWidth={2.25}
        />
      ),
    },
    {
      id: 'matched',
      label: 'Matched',
      count: matchedCount,
      icon: (
        <Users
          color={activeFilter === 'matched' ? colors.primaryForeground : colors.muted}
          size={13}
          strokeWidth={2.25}
        />
      ),
    },
    {
      id: 'completed',
      label: 'Done',
      count: completedCount,
      icon: (
        <CheckCircle2
          color={activeFilter === 'completed' ? colors.primaryForeground : colors.muted}
          size={13}
          strokeWidth={2.25}
        />
      ),
    },
  ];

  return (
    <View style={recipientStyles.screen}>
      {/* Header */}
      {isTabScreen ? (
        <View style={[recipientStyles.tabHeader, { paddingTop: topInset + 8 }]}>
          <Text style={recipientStyles.tabHeaderTitle}>My Requests</Text>
          <Pressable
            accessibilityLabel="Create blood request"
            accessibilityRole="button"
            style={({ pressed }) => [
              recipientStyles.createHeaderButton,
              pressed ? recipientStyles.createHeaderButtonPressed : null,
            ]}
            onPress={openCreateRequest}
          >
            <Plus color={colors.primaryForeground} size={16} strokeWidth={2.5} />
            <Text style={recipientStyles.createHeaderButtonText}>New</Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingBottom: 12,
            paddingHorizontal: 16,
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
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '700' }}>
            My Blood Requests
          </Text>
          <Pressable
            accessibilityLabel="Create blood request"
            accessibilityRole="button"
            style={({ pressed }) => [
              recipientStyles.createHeaderButton,
              pressed ? recipientStyles.createHeaderButtonPressed : null,
            ]}
            onPress={openCreateRequest}
          >
            <Plus color={colors.primaryForeground} size={16} strokeWidth={2.5} />
            <Text style={recipientStyles.createHeaderButtonText}>New</Text>
          </Pressable>
        </View>
      )}



      {/* Filter chips */}
      <ScrollView
        horizontal
        contentContainerStyle={recipientStyles.filterChipsRow}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, height: 56 }}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            accessibilityLabel={`Show ${f.label} requests`}
            accessibilityRole="button"
            style={[
              recipientStyles.filterChip,
              activeFilter === f.id ? recipientStyles.filterChipSelected : null,
            ]}
            onPress={() => setActiveFilter(f.id)}
          >
            {f.icon}
            <Text
              style={[
                recipientStyles.filterChipText,
                activeFilter === f.id ? recipientStyles.filterChipTextSelected : null,
              ]}
            >
              {f.label} ({f.count})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        contentContainerStyle={recipientStyles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.muted}
            onRefresh={() => void loadRequests(true)}
          />
        }
        style={{ flex: 1 }}
      >
        {error ? <Text style={authStyles.error}>{error}</Text> : null}

        {filteredRequests.length === 0 ? (
          <View style={recipientStyles.emptyCard}>
            <View style={recipientStyles.emptyIcon}>
              <Droplets color={colors.primary} size={24} />
            </View>
            <Text style={recipientStyles.emptyText}>
              {requests.length === 0
                ? 'No blood requests yet. Tap "New" to create your first request.'
                : 'No requests match the selected filter.'}
            </Text>
            {requests.length === 0 ? (
              <PrimaryButton title="Create blood request" onPress={openCreateRequest} />
            ) : null}
          </View>
        ) : (
          filteredRequests.map((request) => (
            <RequestListCard
              key={request.id}
              bloodType={request.blood_type}
              metaLines={[
                `${request.hospital_name}`,
                `${URGENCY_LABELS[request.urgency]} urgency · ${request.units_needed} unit${request.units_needed === 1 ? '' : 's'}`,
                `Needed by: ${formatDateTime(request.needed_at)}`,
              ]}
              status={request.status}
              title={request.patient_name?.trim() || undefined}
              unitsNeeded={request.units_needed}
              urgency={request.urgency}
              onPress={() =>
                stackNavigation?.navigate('BloodRequestDetail', { requestId: request.id })
              }
            />
          ))
        )}

        {!isTabScreen ? (
          <PrimaryButton title="Create blood request" onPress={openCreateRequest} />
        ) : null}
      </ScrollView>
    </View>
  );
}
