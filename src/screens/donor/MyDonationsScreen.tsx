import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Droplet,
  Heart,
  QrCode,
  Sparkles,
} from 'lucide-react-native';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContentLoadingSkeleton } from '@/components/common/ContentLoadingSkeleton';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { URGENCY_LABELS } from '@/constants/bloodRequestUrgency';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { AppStackParamList } from '@/navigation/types';
import { authStyles } from '@/screens/auth/styles';
import {
  describeDonationVerification,
  formatDonationVerificationStatus,
  isAwaitingDonationVerification,
  isVerifiedCompletedDonation,
  listDonorVerifiableItems,
  type DonorDonationListItem,
} from '@/services/supabase/donations';
import { myDonationsStyles as styles } from './myDonationsStyles';

type Props = NativeStackScreenProps<AppStackParamList, 'MyDonations'>;
type FilterTab = 'all' | 'completed' | 'active';

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDateOnly = (value: string | null) => {
  if (!value) {
    return 'Pending date';
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatStatusLabel = (item: DonorDonationListItem) =>
  formatDonationVerificationStatus(item.donationStatus, item.matchStatus);

function FullDonationCard({
  item,
  onPress,
}: {
  item: DonorDonationListItem;
  onPress: () => void;
}) {
  const isCompleted = isVerifiedCompletedDonation(item.donationStatus);

  const isCritical = item.urgency === 'critical';
  const isUrgent = item.urgency === 'urgent';

  const statusLabel = formatStatusLabel(item);
  const matchRefCode = item.matchId.slice(0, 8).toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.donationCard, pressed ? { opacity: 0.92 } : null]}
      onPress={onPress}
    >
      {/* Header: Blood Type, Units & Status Badges */}
      <View style={styles.cardHeader}>
        <View style={styles.bloodBadgeGroup}>
          <View style={styles.bloodBadge}>
            <Droplet color={colors.primary} fill={colors.primary} size={14} />
            <Text style={styles.bloodBadgeText}>{item.bloodType}</Text>
          </View>
          <Text style={styles.unitsText}>
            {item.unitsNeeded} unit{item.unitsNeeded === 1 ? '' : 's'} (Whole Blood)
          </Text>
        </View>

        <View style={styles.badgeGroup}>
          <View
            style={[
              styles.urgencyBadge,
              isCritical
                ? styles.urgencyBadgeCritical
                : isUrgent
                  ? styles.urgencyBadgeUrgent
                  : styles.urgencyBadgeNormal,
            ]}
          >
            <Text
              style={[
                styles.urgencyBadgeText,
                isCritical
                  ? styles.urgencyBadgeTextCritical
                  : isUrgent
                    ? styles.urgencyBadgeTextUrgent
                    : styles.urgencyBadgeTextNormal,
              ]}
            >
              {URGENCY_LABELS[item.urgency]}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              isCompleted
                ? styles.statusBadgeCompleted
                : styles.statusBadgePending,
            ]}
          >
            {isCompleted ? (
              <Check color={colors.success} size={12} strokeWidth={3} />
            ) : (
              <Clock color={colors.infoText} size={12} />
            )}
            <Text
              style={[
                styles.statusBadgeText,
                isCompleted
                  ? styles.statusBadgeTextCompleted
                  : styles.statusBadgeTextPending,
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Facility / Location Information */}
      <View style={styles.facilitySection}>
        <View style={styles.facilityIconWrap}>
          <Building2 color={colors.foreground} size={18} />
        </View>
        <View style={styles.facilityInfo}>
          <Text style={styles.facilityLabel}>Collection Center / Hospital</Text>
          <Text numberOfLines={2} style={styles.facilityName}>
            {item.hospitalName}
          </Text>
        </View>
      </View>

      {/* Comprehensive Details Grid */}
      <View style={styles.detailsGrid}>
        {item.completedAt ? (
          <View style={styles.detailItem}>
            <Check color={colors.success} size={14} />
            <Text style={styles.detailLabel}>Donated On</Text>
            <Text style={styles.detailValue}>{formatDateTime(item.completedAt)}</Text>
          </View>
        ) : item.scheduledAt ? (
          <View style={styles.detailItem}>
            <Calendar color={colors.muted} size={14} />
            <Text style={styles.detailLabel}>Scheduled For</Text>
            <Text style={styles.detailValue}>{formatDateTime(item.scheduledAt)}</Text>
          </View>
        ) : null}

        {item.neededAt ? (
          <View style={styles.detailItem}>
            <Clock color={colors.muted} size={14} />
            <Text style={styles.detailLabel}>Needed By</Text>
            <Text style={styles.detailValue}>{formatDateTime(item.neededAt)}</Text>
          </View>
        ) : null}

        <View style={styles.detailItem}>
          <Calendar color={colors.muted} size={14} />
          <Text style={styles.detailLabel}>Match Registered</Text>
          <Text style={styles.detailValue}>{formatDateOnly(item.createdAt)}</Text>
        </View>
      </View>

      {/* Reference Code & QR Action Button */}
      <View style={styles.refRow}>
        <Text style={styles.refText}>Ref: #{matchRefCode}</Text>
      </View>

      <Text style={styles.refText}>
        {describeDonationVerification(item.donationStatus, item.matchStatus)}
      </Text>

      <View style={styles.qrActionBtn}>
        <QrCode color={colors.primary} size={16} />
        <Text style={styles.qrActionText}>
          {isCompleted ? 'View verification record' : 'Show QR Verification Pass'}
        </Text>
        <ChevronRight color={colors.muted} size={16} />
      </View>
    </Pressable>
  );
}

import { appCache } from '@/utils/appCache';

export function MyDonationsScreen({ navigation }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const { session } = useAuth();
  const donorId = session?.user.id;
  const cachedItems = donorId
    ? appCache.getSync<DonorDonationListItem[]>(`donor:my_donations:${donorId}`)
    : undefined;

  const [items, setItems] = useState<DonorDonationListItem[]>(() => cachedItems ?? []);
  const [loading, setLoading] = useState(() => cachedItems === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const loadItems = useCallback(
    async (isRefresh = false, isSilent = false) => {
      if (!donorId) {
        setError('You need to be signed in as a donor to view donations.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else if (!isSilent && !appCache.getSync(`donor:my_donations:${donorId}`)) {
        setLoading(true);
      }

      setError(null);

      const { data, error: loadError } = await listDonorVerifiableItems(donorId);

      if (loadError) {
        setError(loadError.message);
        if (!isSilent && !appCache.getSync(`donor:my_donations:${donorId}`)) {
          setItems([]);
        }
      } else {
        const fresh = data ?? [];
        setItems(fresh);
        appCache.setSync(`donor:my_donations:${donorId}`, fresh);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [donorId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadItems(false, true);
    }, [loadItems]),
  );

  const completedCount = useMemo(
    () => items.filter((item) => isVerifiedCompletedDonation(item.donationStatus)).length,
    [items],
  );

  const activeCount = useMemo(
    () => items.filter((item) => isAwaitingDonationVerification(item.donationStatus)).length,
    [items],
  );

  const filteredItems = useMemo(() => {
    if (activeTab === 'completed') {
      return items.filter((item) => isVerifiedCompletedDonation(item.donationStatus));
    }
    if (activeTab === 'active') {
      return items.filter((item) => isAwaitingDonationVerification(item.donationStatus));
    }
    return items;
  }, [activeTab, items]);

  const handleOpenQr = (item: DonorDonationListItem) => {
    navigation.navigate('DonationQr', {
      donationId: item.donationId ?? undefined,
      matchId: item.matchId,
    });
  };

  if (loading) {
    return <ContentLoadingSkeleton />;
  }

  if (error) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }]}>
        <Text style={authStyles.error}>{error}</Text>
        <PrimaryButton title="Try again" onPress={() => void loadItems()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
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
          My Donations
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadItems(true)} />
        }
        style={{ flex: 1 }}
      >
        {/* Overview Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.headerSubtitle}>
            Complete record of your blood donations. Tap any donation card to display your QR verification pass at the blood bank or collection center.
          </Text>
        </View>

      {/* Summary Statistics Card */}
      <View style={styles.statsCard}>
        <View style={styles.statColumn}>
          <Text style={styles.statValuePrimary}>{items.length}</Text>
          <Text style={styles.statLabel}>Total Matched</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statColumn}>
          <Text style={styles.statValueSuccess}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statColumn}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Heart color={colors.primary} fill={colors.primary} size={14} />
            <Text style={styles.statValue}>{completedCount * 3}</Text>
          </View>
          <Text style={styles.statLabel}>Lives Impacted</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, activeTab === 'all' ? styles.filterChipActive : null]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeTab === 'all' ? styles.filterChipTextActive : null,
            ]}
          >
            All ({items.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.filterChip, activeTab === 'completed' ? styles.filterChipActive : null]}
          onPress={() => setActiveTab('completed')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeTab === 'completed' ? styles.filterChipTextActive : null,
            ]}
          >
            Completed ({completedCount})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.filterChip, activeTab === 'active' ? styles.filterChipActive : null]}
          onPress={() => setActiveTab('active')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeTab === 'active' ? styles.filterChipTextActive : null,
            ]}
          >
            Active / Pending ({activeCount})
          </Text>
        </Pressable>
      </View>

      {/* Donation Cards or Empty State */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Sparkles color={colors.muted} size={28} />
          </View>
          <Text style={styles.emptyTitle}>
            {activeTab === 'completed'
              ? 'No completed donations'
              : activeTab === 'active'
                ? 'No active matches'
                : 'No donations yet'}
          </Text>
          <Text style={styles.emptyDescription}>
            {activeTab === 'completed'
              ? 'Completed donations will appear here once verified by collection staff.'
              : activeTab === 'active'
                ? 'Accepted and scheduled donations waiting for collection will appear here.'
                : 'Respond to urgent blood requests in your area and help save lives.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.emptyActionBtn}
            onPress={() => navigation.navigate('AppTabs', { screen: 'Requests' })}
          >
            <Text style={styles.emptyActionText}>Browse Open Requests</Text>
          </Pressable>
        </View>
      ) : (
        filteredItems.map((item) => (
          <FullDonationCard
            key={item.matchId}
            item={item}
            onPress={() => handleOpenQr(item)}
          />
        ))
      )}
    </ScrollView>
    </View>
  );
}
