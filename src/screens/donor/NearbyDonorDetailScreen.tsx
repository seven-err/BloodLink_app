import { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BloodTypeBadge } from '@/components/bloodRequest/BloodTypeBadge';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { DonorVerificationBadge } from '@/components/donor/DonorVerificationBadge';
import { SettingsScreenHeader } from '@/components/settings/SettingsScreenHeader';
import { useAuth } from '@/context/AuthContext';
import type { AppStackParamList } from '@/navigation/types';
import { nearbyDonorDetailStyles } from '@/screens/donor/nearbyDonorDetailStyles';
import { getMyBloodRequests, type BloodRequest } from '@/services/supabase/bloodRequests';
import { getBloodTypeCompatibilityLabel, isDonorCompatibleWithRecipient } from '@/utils/bloodTypeCompatibility';
import { resolveDonorVerificationDisplay } from '@/utils/donorVerificationDisplay';
import { formatLastDonationLabel } from '@/utils/donorMapDisplay';
import { getDonorEligibilityStat } from '@/utils/donorDonationStats';
import { formatDistance } from '@/utils/travelMetrics';
import { appCache } from '@/utils/appCache';

type Props = NativeStackScreenProps<AppStackParamList, 'NearbyDonorDetail'>;

function DetailRow({
  isLast = false,
  label,
  value,
}: {
  isLast?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View
      style={[
        nearbyDonorDetailStyles.detailRow,
        isLast ? nearbyDonorDetailStyles.detailRowLast : null,
      ]}
    >
      <Text style={nearbyDonorDetailStyles.detailLabel}>{label}</Text>
      <Text style={nearbyDonorDetailStyles.detailValue}>{value}</Text>
    </View>
  );
}

function formatEligibility(lastDonationAt: string | null) {
  const eligibility = getDonorEligibilityStat(lastDonationAt);

  if (eligibility.value === 'Now') {
    return 'Eligible now';
  }

  return `${eligibility.value} ${eligibility.label.toLowerCase()}`;
}

export function NearbyDonorDetailScreen({ navigation, route }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const { donor } = route.params;
  const [coordinating, setCoordinating] = useState(false);
  const displayName = donor.fullName?.trim() || 'BloodLink donor';
  const verificationStatus = resolveDonorVerificationDisplay({
    verificationActive: donor.isVerified,
  });
  const isRecipient = profile?.role === 'recipient';
  const viewerBloodType = profile?.blood_type ?? null;
  const donorCompatibleWithRecipient =
    viewerBloodType != null
      ? isDonorCompatibleWithRecipient(donor.bloodType, viewerBloodType)
      : true;
  const lastDonation = formatLastDonationLabel(donor.lastDonationAt).replace(
    /^Last donation:\s*/i,
    '',
  );

  const handleRecipientCoordinate = useCallback(async () => {
    if (!session?.user.id || coordinating) {
      return;
    }

    if (viewerBloodType && !donorCompatibleWithRecipient) {
      Alert.alert(
        'Blood type mismatch',
        `${displayName} (${donor.bloodType}) is not compatible with your blood type (${viewerBloodType}). Browse the map for other donors.`,
      );
      return;
    }

    setCoordinating(true);

    const cachedRequests = appCache.getSync<BloodRequest[]>(`recipient:my_requests:${session.user.id}`);
    let requests: BloodRequest[] | undefined = cachedRequests;

    if (!requests) {
      const { data, error } = await getMyBloodRequests(session.user.id);
      if (error) {
        Alert.alert('Unable to load requests', error.message);
        setCoordinating(false);
        return;
      }
      requests = data ?? [];
    }

    const openCompatibleRequests = (requests ?? []).filter(
      (request) =>
        request.status === 'open' &&
        isDonorCompatibleWithRecipient(donor.bloodType, request.blood_type),
    );

    if (openCompatibleRequests.length === 1) {
      navigation.navigate('BloodRequestDetail', { requestId: openCompatibleRequests[0].id });
      setCoordinating(false);
      return;
    }

    if (openCompatibleRequests.length > 1) {
      Alert.alert(
        'Open requests found',
        'You already have open blood requests that this donor could respond to. Open one to review responses when they arrive.',
        [
          { style: 'cancel', text: 'Stay here' },
          {
            text: 'View my requests',
            onPress: () => navigation.navigate('MyBloodRequests'),
          },
        ],
      );
      setCoordinating(false);
      return;
    }

    navigation.navigate('CreateBloodRequest', {
      bloodType: viewerBloodType ?? undefined,
    });
    setCoordinating(false);
  }, [
    coordinating,
    displayName,
    donor.bloodType,
    donorCompatibleWithRecipient,
    navigation,
    session?.user.id,
    viewerBloodType,
  ]);

  return (
    <View style={nearbyDonorDetailStyles.screen}>
      <SettingsScreenHeader title="Donor Details" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={nearbyDonorDetailStyles.scrollContent}>
        <View style={[nearbyDonorDetailStyles.heroCard, { marginTop: topInset > 0 ? 0 : 8 }]}>
          <View style={nearbyDonorDetailStyles.heroTop}>
            <View style={nearbyDonorDetailStyles.avatarShell}>
              <Text style={nearbyDonorDetailStyles.avatarText}>
                {displayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0] ?? '')
                  .join('')
                  .toUpperCase() || 'BL'}
              </Text>
            </View>
            <View style={nearbyDonorDetailStyles.heroCopy}>
              <View style={nearbyDonorDetailStyles.nameRow}>
                <Text numberOfLines={1} style={nearbyDonorDetailStyles.name}>
                  {displayName}
                </Text>
                <DonorVerificationBadge status={verificationStatus} />
              </View>
              <View style={nearbyDonorDetailStyles.badgeRow}>
                <BloodTypeBadge bloodType={donor.bloodType} size="lg" variant="solid" />
                <View
                  style={[
                    nearbyDonorDetailStyles.statusPill,
                    donor.isAvailable
                      ? nearbyDonorDetailStyles.statusPillAvailable
                      : nearbyDonorDetailStyles.statusPillUnavailable,
                  ]}
                >
                  <Text
                    style={[
                      nearbyDonorDetailStyles.statusPillText,
                      donor.isAvailable
                        ? nearbyDonorDetailStyles.statusPillTextAvailable
                        : nearbyDonorDetailStyles.statusPillTextUnavailable,
                    ]}
                  >
                    {donor.isAvailable ? 'Available now' : 'Currently unavailable'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={nearbyDonorDetailStyles.section}>
          <Text style={nearbyDonorDetailStyles.sectionTitle}>Donor Details</Text>
          <View style={nearbyDonorDetailStyles.detailsCard}>
            <DetailRow label="Blood type" value={donor.bloodType} />
            <DetailRow
              label="Status"
              value={donor.isAvailable ? 'Available now' : 'Currently unavailable'}
            />
            <DetailRow label="Distance" value={formatDistance(donor.distanceMeters)} />
            <DetailRow
              label="Donations"
              value={`${donor.donationCount} completed`}
            />
            <DetailRow label="Last donation" value={lastDonation} />
            <DetailRow label="Eligibility" value={formatEligibility(donor.lastDonationAt)} />
            <DetailRow
              label="Can donate to"
              value={getBloodTypeCompatibilityLabel(donor.bloodType)}
            />
            <DetailRow
              label="Verification"
              value={donor.isVerified ? 'Verified donor' : 'Verification pending'}
            />
            {viewerBloodType ? (
              <DetailRow
                isLast
                label="Compatible with you"
                value={donorCompatibleWithRecipient ? `Yes, for ${viewerBloodType}` : `No, not for ${viewerBloodType}`}
              />
            ) : (
              <DetailRow isLast label="Compatible with you" value="Set your blood type in profile" />
            )}
          </View>
        </View>

        <View style={nearbyDonorDetailStyles.noticeCard}>
          <Text style={nearbyDonorDetailStyles.noticeTitle}>Privacy notice</Text>
          <Text style={nearbyDonorDetailStyles.noticeText}>
            Phone number and exact location stay hidden until a match is accepted. Use a blood
            request to coordinate. Turn-by-turn directions to this donor are not available from
            this screen.
          </Text>
        </View>

        {isRecipient ? (
          <View style={nearbyDonorDetailStyles.actions}>
            <PrimaryButton
              title="Coordinate through request"
              loading={coordinating}
              onPress={() => void handleRecipientCoordinate()}
            />
            {!donorCompatibleWithRecipient && viewerBloodType ? (
              <Text style={nearbyDonorDetailStyles.actionHint}>
                This donor is not compatible with your {viewerBloodType} blood type.
              </Text>
            ) : (
              <Text style={nearbyDonorDetailStyles.actionHint}>
                BloodLink notifies compatible donors when you post an open request. You can accept
                their response from your request details.
              </Text>
            )}
          </View>
        ) : null}

        <PrimaryButton
          title="Report this donor"
          variant="secondary"
          onPress={() =>
            navigation.navigate('ReportSafety', {
              defaultType: 'user',
              reportedDisplayName: displayName,
              reportedUserId: donor.donorId,
            })
          }
        />
      </ScrollView>
    </View>
  );
}
