import { MapPin, Navigation } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BloodTypeBadge } from '@/components/bloodRequest/BloodTypeBadge';
import { DonorVerificationBadge } from '@/components/donor/DonorVerificationBadge';
import { colors, radii, shadows } from '@/constants/theme';
import type { NearbyMapDonorItem } from '@/services/supabase/nearbyMapDonors';
import { resolveDonorVerificationDisplay } from '@/utils/donorVerificationDisplay';
import { formatLastDonationLabel } from '@/utils/donorMapDisplay';

type NearbyDonorCardProps = {
  donor: NearbyMapDonorItem;
  onPress: () => void;
  onDirections?: () => void;
  selected?: boolean;
};

const getInitials = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'BL';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
};

export function NearbyDonorCard({
  donor,
  onPress,
  onDirections,
  selected = false,
}: NearbyDonorCardProps) {
  const verificationStatus = resolveDonorVerificationDisplay({
    verificationActive: donor.isVerified,
  });

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : null,
        pressed ? styles.cardPressed : null,
      ]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarShell}>
            <Text style={styles.avatarText}>{getInitials(donor.fullName)}</Text>
          </View>
        </View>

        <View style={styles.mainCopy}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {donor.fullName}
            </Text>
            <DonorVerificationBadge status={verificationStatus} />
          </View>

          <View style={styles.badgeRow}>
            <BloodTypeBadge bloodType={donor.bloodType} variant="solid" />
            {donor.isAvailable ? (
              <View style={styles.availableBadge}>
                <View style={styles.availableDot} />
                <Text style={styles.availableText}>Available</Text>
              </View>
            ) : (
              <View style={styles.unavailableBadge}>
                <Text style={styles.unavailableText}>Unavailable</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MapPin color={colors.muted} size={14} strokeWidth={2} />
          <Text style={styles.metaText}>
            {donor.distanceMeters < 1000
              ? `${Math.round(donor.distanceMeters)} m`
              : `${(donor.distanceMeters / 1000).toFixed(1)} km`}
          </Text>
        </View>
        <Text style={styles.metaText}>
          {donor.donationCount} donation{donor.donationCount === 1 ? '' : 's'}
        </Text>
      </View>

      <Text style={styles.lastDonation}>{formatLastDonationLabel(donor.lastDonationAt)}</Text>

      {onDirections ? (
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.directionsBtn,
              pressed ? styles.directionsBtnPressed : null,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onDirections();
            }}
          >
            <Navigation color={colors.muted} size={15} strokeWidth={2.25} />
            <Text style={styles.directionsBtnText}>Get directions</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  availableBadge: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  availableDot: {
    backgroundColor: colors.success,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  availableText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  avatarShell: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarWrap: {
    height: 52,
    position: 'relative',
    width: 52,
  },
  avatarText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '800',
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 12,
    padding: 16,
    ...shadows.card,
  },
  cardPressed: {
    opacity: 0.96,
  },
  cardSelected: {
    backgroundColor: '#f8fafc',
  },
  lastDonation: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  mainCopy: {
    flex: 1,
    gap: 8,
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  name: {
    color: colors.foreground,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
  },
  unavailableBadge: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unavailableText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  directionsBtn: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  directionsBtnPressed: {
    opacity: 0.85,
  },
  directionsBtnText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
});
