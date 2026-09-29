import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Award,
  Bell,
  Calendar,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Droplet,
  LogOut,
  QrCode,
  Mail,
  MapPin,
  Phone,
  Settings,
  Shield,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DonorVerificationBadge } from '@/components/donor/DonorVerificationBadge';

import { SignOutConfirmModal } from '@/components/common/SignOutConfirmModal';
import { Skeleton } from '@/components/common/Skeleton';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

import { useSignOut } from '@/hooks/useSignOut';
import type { AppTabParamList } from '@/navigation/AppTabNavigator';
import type { AppStackParamList } from '@/navigation/types';
import { authStyles } from '@/screens/auth/styles';
import { supabase } from '@/services/supabase/client';
import { getLatestOwnDonorPreScreening } from '@/services/supabase/donorPreScreenings';
import {
  formatDonationVerificationStatus,
  isVerifiedCompletedDonation,
  listDonorVerifiableItems,
  type DonorDonationListItem,
} from '@/services/supabase/donations';
import {
  getLatestDonorVerification,
  getProfile,
  isDonorVerificationActive,
  setDonorAvailability,
} from '@/services/supabase/profiles';
import { canDonorEnableAvailability } from '@/utils/donorAvailability';
import { getDonorEligibilityStat } from '@/utils/donorDonationStats';
import {
  resolveDonorVerificationDisplay,
  type DonorVerificationDisplay,
} from '@/utils/donorVerificationDisplay';
import { formatRoleLabel } from '@/utils/profileDisplay';
import { sanitizeProfileError } from '@/utils/profileErrors';
import { appCache } from '@/utils/appCache';
import { profileScreenStyles as styles } from './profileScreenStyles';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'AppProfile'>,
  NativeStackScreenProps<AppStackParamList>
>;

const formatDonationDate = (value: string | null) => {
  if (!value) {
    return 'Date pending';
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const computeResponseRate = (statuses: string[]) => {
  const responded = statuses.filter((status) =>
    ['accepted', 'declined', 'completed'].includes(status),
  );

  if (responded.length === 0) {
    return null;
  }

  const positive = responded.filter((status) => status === 'accepted' || status === 'completed')
    .length;

  return Math.round((positive / responded.length) * 100);
};



function ProfileSkeleton({ topInset }: { topInset: number }) {
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Skeleton height={28} width={100} />
      </View>
      <View style={styles.scrollContent}>
        <Skeleton borderRadius={24} height={220} width="100%" />
        <Skeleton borderRadius={16} height={180} width="100%" />
        <Skeleton borderRadius={16} height={200} width="100%" />
        <Skeleton borderRadius={16} height={240} width="100%" />
      </View>
    </View>
  );
}

function ContactInfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactIconWrap}>{icon}</View>
      <View style={styles.contactValueWrap}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
    </View>
  );
}

function ProfileMenuRow({
  badge,
  icon,
  label,
  onPress,
  showDivider,
}: {
  badge?: number;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  showDivider?: boolean;
}) {
  return (
    <>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.menuRow, pressed ? { opacity: 0.7 } : null]}
        onPress={onPress}
      >
        <View style={styles.menuIconWrap}>{icon}</View>
        <Text style={styles.menuLabel}>{label}</Text>
        {badge != null && badge > 0 ? (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <ChevronRight color={colors.mutedLight} size={20} />
      </Pressable>
      {showDivider ? <View style={styles.menuRowDivider} /> : null}
    </>
  );
}

function RecentDonationRow({
  item,
  onPress,
}: {
  item: DonorDonationListItem;
  onPress?: () => void;
}) {
  const isCompleted = isVerifiedCompletedDonation(item.donationStatus);

  const statusLabel = formatDonationVerificationStatus(item.donationStatus, item.matchStatus);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.donationItem, pressed ? { opacity: 0.8 } : null]}
      onPress={onPress}
    >
      <View style={styles.donationHeaderRow}>
        <Text numberOfLines={1} style={styles.donationHospital}>
          {item.hospitalName}
        </Text>
        <View
          style={[
            styles.donationStatusPill,
            !isCompleted ? styles.donationStatusPillActive : null,
          ]}
        >
          {isCompleted ? (
            <Check color={colors.success} size={12} strokeWidth={2.5} />
          ) : null}
          <Text
            style={[
              styles.donationStatusText,
              !isCompleted ? styles.donationStatusTextActive : null,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.donationMetaRow}>
        <View style={styles.donationBadgeRow}>
          <View style={styles.donationBloodBadge}>
            <Droplet color={colors.primary} fill={colors.primary} size={12} />
            <Text style={styles.donationBloodBadgeText}>{item.bloodType}</Text>
          </View>
          <Text style={styles.donationUnitsText}>
            {item.unitsNeeded} unit{item.unitsNeeded === 1 ? '' : 's'}
          </Text>
        </View>

        <View style={styles.donationDateRow}>
          <Calendar color={colors.muted} size={13} />
          <Text style={styles.donationDate}>
            {formatDonationDate(item.completedAt ?? item.scheduledAt ?? item.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

type CachedProfileDashboard = {
  verificationActive: boolean;
  donorVerificationStatus: DonorVerificationDisplay;
  totalDonations: number;
  responseRate: number | null;
  recentDonations: DonorDonationListItem[];
};

export function UserProfileScreen({ navigation }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const { profile, refreshProfile, session } = useAuth();
  const userId = session?.user.id;
  const cachedDashboard = userId
    ? appCache.getSync<CachedProfileDashboard>(`profile:dashboard:${userId}`)
    : undefined;

  const {
    cancelSignOut,
    clearSignOutError,
    confirmSignOut,
    confirmVisible,
    performSignOut,
    signOutError,
    signingOut,
  } = useSignOut();

  const [loading, setLoading] = useState(
    () => profile?.role === 'donor' && cachedDashboard === undefined,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [donorVerificationStatus, setDonorVerificationStatus] =
    useState<DonorVerificationDisplay>(() => cachedDashboard?.donorVerificationStatus ?? 'pending');
  const [totalDonations, setTotalDonations] = useState(() => cachedDashboard?.totalDonations ?? 0);
  const [responseRate, setResponseRate] = useState<number | null>(
    () => cachedDashboard?.responseRate ?? null,
  );
  const [recentDonations, setRecentDonations] = useState<DonorDonationListItem[]>(
    () => cachedDashboard?.recentDonations ?? [],
  );
  const [verificationActive, setVerificationActive] = useState(
    () => cachedDashboard?.verificationActive ?? false,
  );
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityOverride, setAvailabilityOverride] = useState<boolean | null>(null);
  const [preScreening, setPreScreening] = useState<Awaited<
    ReturnType<typeof getLatestOwnDonorPreScreening>
  >['data']>(null);

  const isDonor = profile?.role === 'donor';
  const canEnableAvailability = canDonorEnableAvailability(profile, verificationActive);
  const isAvailable = availabilityOverride ?? profile?.is_available ?? false;
  const email = session?.user.email?.trim() || null;
  const phone = profile?.phone?.trim() || session?.user.phone?.trim() || null;
  const location = profile?.address?.trim() || null;
  const eligibilityStat = getDonorEligibilityStat(profile?.last_donation_at);

  const navigateToStack = useCallback(
    <RouteName extends keyof AppStackParamList>(
      screen: RouteName,
      ...args: undefined extends AppStackParamList[RouteName]
        ? [params?: AppStackParamList[RouteName]]
        : [params: AppStackParamList[RouteName]]
    ) => {
      const stackNavigation = navigation.getParent();
      if (stackNavigation) {
        stackNavigation.navigate(screen, ...args);
        return;
      }
    },
    [navigation],
  );

  const handleAvailabilityToggle = async (nextValue: boolean) => {
    if (!session?.user.id || availabilityLoading) {
      return;
    }

    if (nextValue && !canEnableAvailability) {
      setAvailabilityError(
        'Complete your donor profile (blood type, birthdate, and weight) before turning on availability.',
      );
      setAvailabilityOverride(null);
      return;
    }

    setAvailabilityLoading(true);
    setAvailabilityError(null);
    setAvailabilityOverride(nextValue);

    try {
      const { error: updateError } = await setDonorAvailability(session.user.id, nextValue);

      if (updateError) {
        throw updateError;
      }

      await refreshProfile();
      setAvailabilityOverride(null);
    } catch (toggleError) {
      setAvailabilityOverride(null);
      setAvailabilityError(
        sanitizeProfileError(toggleError, 'Unable to update availability. Please try again.'),
      );
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const loadProfileData = useCallback(async (isRefresh = false, isSilent = false) => {
    if (!session?.user.id) {
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent && !appCache.getSync(`profile:dashboard:${session.user.id}`)) {
      setLoading(true);
    }

    setError(null);

    try {
      await refreshProfile();

      const { data: freshProfile } = await getProfile(session.user.id);

      if (freshProfile?.role !== 'donor') {
        setDonorVerificationStatus('pending');
        setVerificationActive(false);
        setTotalDonations(0);
        setResponseRate(null);
        setRecentDonations([]);
        setPreScreening(null);
        return;
      }

      const [donationsResult, verificationResult, latestVerificationResult, matchesResult, preScreeningResult] =
        await Promise.all([
          listDonorVerifiableItems(session.user.id),
          isDonorVerificationActive(session.user.id),
          getLatestDonorVerification(session.user.id),
          supabase.from('donor_matches').select('status').eq('donor_id', session.user.id),
          getLatestOwnDonorPreScreening(session.user.id),
        ]);

      if (donationsResult.error) {
        throw donationsResult.error;
      }

      if (verificationResult.error) {
        throw verificationResult.error;
      }

      if (latestVerificationResult.error) {
        throw latestVerificationResult.error;
      }

      if (matchesResult.error) {
        throw matchesResult.error;
      }
      if (preScreeningResult.error) {
        throw preScreeningResult.error;
      }

      setPreScreening(preScreeningResult.data);

      const isVerificationActiveResult = Boolean(verificationResult.data);
      const resolvedStatus = resolveDonorVerificationDisplay({
        latestStatus: latestVerificationResult.data?.status ?? null,
        verificationActive: isVerificationActiveResult,
      });

      setVerificationActive(isVerificationActiveResult);
      setDonorVerificationStatus(resolvedStatus);

      const completedDonations = (donationsResult.data ?? []).filter((item) =>
        isVerifiedCompletedDonation(item.donationStatus),
      );
      setTotalDonations(completedDonations.length);

      const statuses = (matchesResult.data ?? []).map((match) => match.status);
      const computedRate = computeResponseRate(statuses);
      setResponseRate(computedRate);

      const sortedRecent = [...completedDonations]
        .sort((left, right) => {
          const leftDate = new Date(left.completedAt ?? left.createdAt).getTime();
          const rightDate = new Date(right.completedAt ?? right.createdAt).getTime();
          return rightDate - leftDate;
        })
        .slice(0, 3);

      setRecentDonations(sortedRecent);

      appCache.setSync(`profile:dashboard:${session.user.id}`, {
        verificationActive: isVerificationActiveResult,
        donorVerificationStatus: resolvedStatus,
        totalDonations: completedDonations.length,
        responseRate: computedRate,
        recentDonations: sortedRecent,
      });
    } catch (loadError) {
      setError(sanitizeProfileError(loadError, 'Unable to load profile data.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshProfile, session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProfileData(false, true);
    }, [loadProfileData]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void loadProfileData();
  };

  if (loading && !profile) {
    return <ProfileSkeleton topInset={topInset} />;
  }

  if (!profile) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: topInset + 8 }]}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile unavailable</Text>
            <Text style={styles.emptyDonationsText}>
              We could not load your profile details right now.
            </Text>
            {error ? <Text style={authStyles.error}>{error}</Text> : null}
          </View>
        </View>
      </View>
    );
  }

  const displayName = profile.full_name?.trim() || 'BloodLink user';

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable
            accessibilityLabel="Open settings"
            accessibilityRole="button"
            style={styles.headerSettingsButton}
            onPress={() => navigateToStack('Settings')}
          >
            <Settings color={colors.foreground} size={20} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <>
            <Skeleton borderRadius={24} height={220} width="100%" />
            <Skeleton borderRadius={16} height={180} width="100%" />
          </>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.overviewHeader}>
                <View style={styles.avatarWrap}>
                  <ProfileAvatar
                    avatarPath={profile.avatar_path}
                    fullName={profile.full_name}
                    size={72}
                  />
                </View>

                <View style={styles.overviewMeta}>
                  <View style={styles.nameRow}>
                    <Text numberOfLines={1} style={styles.userName}>
                      {displayName}
                    </Text>
                    {isDonor ? (
                      <DonorVerificationBadge status={donorVerificationStatus} />
                    ) : null}
                  </View>
                  <Text style={styles.roleLabel}>
                    {formatRoleLabel(profile.role)} account
                  </Text>
                  {profile.blood_type ? (
                    <View style={styles.bloodTypePill}>
                      <Droplet color={colors.primary} fill={colors.primary} size={14} />
                      <Text style={styles.bloodTypePillText}>
                        {profile.blood_type} Blood Type
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {isDonor ? (
                <View style={styles.statRow}>
                  <View style={styles.statColumn}>
                    <Text style={styles.statValuePrimary}>{totalDonations}</Text>
                    <Text style={styles.statLabel}>Donations</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statColumn}>
                    <Text style={
                      eligibilityStat.value === 'Now' ? styles.statValueSuccess : styles.statValueWarning
                    }>{eligibilityStat.value}</Text>
                    <Text style={styles.statLabel}>{eligibilityStat.label}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statColumn}>
                    <Text style={
                      responseRate != null && responseRate >= 80 ? styles.statValueSuccess : styles.statValue
                    }>
                      {responseRate == null ? '\u2014' : `${responseRate}%`}
                    </Text>
                    <Text style={styles.statLabel}>Response</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.editProfileButton,
                    isDonor ? styles.editProfileButtonDonor : null,
                    pressed ? { opacity: 0.7 } : null,
                  ]}
                  onPress={() => navigateToStack('EditProfile')}
                >
                  <UserRound color={colors.foreground} size={16} />
                  <Text numberOfLines={1} style={styles.editProfileText}>Edit Profile</Text>
                </Pressable>

                {isDonor ? (
                  <>
                    <View style={styles.availabilityCard}>
                      <View style={styles.availabilityCopy}>
                        <View style={styles.availabilityTitleRow}>
                          <Droplet
                            color={isAvailable ? colors.primary : colors.mutedLight}
                            fill={isAvailable ? colors.primary : 'none'}
                            size={13}
                          />
                          <Text numberOfLines={1} style={styles.availabilityTitle}>
                            Donate
                          </Text>
                        </View>
                      </View>
                      <Switch
                        accessibilityLabel="Donation availability"
                        accessibilityState={{ checked: isAvailable, disabled: availabilityLoading }}
                        disabled={availabilityLoading}
                        thumbColor={colors.primaryForeground}
                        trackColor={{ false: colors.border, true: colors.success }}
                        value={isAvailable}
                        onValueChange={(value) => {
                          void handleAvailabilityToggle(value);
                        }}
                        style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                      />
                    </View>
                    <Pressable
                      accessibilityLabel="View QR Pass"
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.qrButton,
                        pressed ? { opacity: 0.7 } : null,
                      ]}
                      onPress={() => navigateToStack('ProfileQr')}
                    >
                      <QrCode color={colors.foreground} size={18} />
                    </Pressable>
                  </>
                ) : null}
              </View>

              {!canEnableAvailability && !isAvailable && isDonor ? (
                <Text style={styles.availabilityHint}>
                  Complete your donor profile to enable donation availability.
                </Text>
              ) : null}
              {availabilityError ? (
                <Text style={styles.availabilityError}>{availabilityError}</Text>
              ) : null}
            </View>



            {isDonor ? (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.card, pressed ? { opacity: 0.8 } : null]}
                onPress={() => navigateToStack('DonorPreScreening')}
              >
                <View style={styles.sectionHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ClipboardCheck color={colors.primary} size={20} />
                    <Text style={styles.cardTitle}>Donor Pre-Screening</Text>
                  </View>
                  <ChevronRight color={colors.mutedLight} size={20} />
                </View>
                <Text style={{ color: colors.success, fontSize: 14, fontWeight: '800' }}>
                  {preScreening ? 'Pre-Screening Completed' : 'Not completed'}
                </Text>
                {preScreening ? (
                  <Text style={styles.emptyDonationsText}>
                    Last completed: {formatDonationDate(preScreening.completed_at)}
                  </Text>
                ) : null}
                {preScreening?.requires_staff_review ? (
                  <Text style={{ color: colors.warningText, fontSize: 13, fontWeight: '700' }}>
                    Requires Blood Bank Assessment
                  </Text>
                ) : null}
                <Text style={styles.emptyDonationsText}>
                  Final donation eligibility requires assessment by authorized blood-bank or
                  healthcare personnel. Tap to review or submit an updated questionnaire.
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contact Information</Text>
              {email ? (
                <ContactInfoRow
                  icon={<Mail color={colors.muted} size={18} />}
                  label="Email"
                  value={email}
                />
              ) : null}
              {phone ? (
                <ContactInfoRow
                  icon={<Phone color={colors.muted} size={18} />}
                  label="Phone"
                  value={phone}
                />
              ) : null}
              <ContactInfoRow
                icon={<MapPin color={colors.muted} size={18} />}
                label="Location"
                value={location || 'Not set'}
              />
            </View>

            {isDonor ? (
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.cardTitle}>Recent Donations</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigateToStack('MyDonations')}
                  >
                    <Text style={styles.linkText}>View All</Text>
                  </Pressable>
                </View>
                {recentDonations.length === 0 ? (
                  <Text style={styles.emptyDonationsText}>
                    No completed donations yet. Your donation history will appear here.
                  </Text>
                ) : (
                  recentDonations.map((item) => (
                    <RecentDonationRow
                      key={item.matchId}
                      item={item}
                      onPress={() =>
                        navigateToStack('DonationQr', {
                          donationId: item.donationId ?? undefined,
                          matchId: item.matchId,
                        })
                      }
                    />
                  ))
                )}
              </View>
            ) : null}

            <View style={styles.card}>
              <ProfileMenuRow
                icon={<Bell color={colors.muted} size={18} />}
                label="Notifications"
                showDivider
                onPress={() => navigateToStack('Notifications')}
              />
              <ProfileMenuRow
                icon={<Shield color={colors.muted} size={18} />}
                label="Privacy & Security"
                showDivider={isDonor}
                onPress={() => navigateToStack('Settings')}
              />
              {isDonor ? (
                <ProfileMenuRow
                  icon={<Award color={colors.muted} size={18} />}
                  label="Donation History"
                  showDivider
                  onPress={() => navigateToStack('MyDonations')}
                />
              ) : null}
              <ProfileMenuRow
                icon={<CircleHelp color={colors.muted} size={18} />}
                label="Help & Support"
                onPress={() => navigateToStack('HemieAI')}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={signingOut}
              style={({ pressed }) => [
                styles.logoutButton,
                pressed || signingOut ? { opacity: 0.7 } : null,
              ]}
              onPress={() => {
                clearSignOutError();
                confirmSignOut();
              }}
            >
              <LogOut color={colors.primary} size={18} />
              <Text style={styles.logoutText}>{signingOut ? 'Signing out…' : 'Logout'}</Text>
            </Pressable>

            {error ? <Text style={authStyles.error}>{error}</Text> : null}
            {signOutError ? <Text style={authStyles.error}>{signOutError}</Text> : null}
          </>
        )}
      </ScrollView>

      <SignOutConfirmModal
        loading={signingOut}
        visible={confirmVisible}
        onCancel={cancelSignOut}
        onConfirm={() => {
          void performSignOut();
        }}
      />
    </View>
  );
}
