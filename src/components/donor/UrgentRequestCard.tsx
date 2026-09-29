import { ArrowRight, HeartHandshake, MapPin, MessageCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, shadows } from '@/constants/theme';
import type { BloodRequestUrgency } from '@/types/database';

type UrgentRequestCardProps = {
  bloodType: string;
  distanceLabel: string;
  hospitalName?: string;
  unitsNeeded?: number;
  onChat: () => void;
  onDetails: () => void;
  onRespond: () => void;
  timeLabel?: string;
  title: string;
  urgency: BloodRequestUrgency;
};

const URGENCY_CONFIG: Record<
  BloodRequestUrgency,
  {
    tagBg: string;
    tagText: string;
    tagLabel: string;
  }
> = {
  critical: {
    tagBg: colors.criticalSoft,
    tagText: colors.critical,
    tagLabel: 'CRITICAL',
  },
  urgent: {
    tagBg: colors.orangeSoft,
    tagText: colors.orangeText,
    tagLabel: 'URGENT',
  },
  normal: {
    tagBg: '#E0F2FE',
    tagText: '#0284C7',
    tagLabel: 'NORMAL',
  },
};

export function UrgentRequestCard({
  bloodType,
  distanceLabel,
  hospitalName,
  unitsNeeded = 1,
  onChat,
  onDetails,
  onRespond,
  timeLabel,
  title,
  urgency,
}: UrgentRequestCardProps) {
  const urgencyStyle = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.critical;
  const hospitalDisplay = hospitalName || title;

  return (
    <View style={styles.card}>
      {/* Top Row: Blood Box + Text Info & Urgency Tag */}
      <View style={styles.topRow}>
        <View style={styles.leftInfo}>
          {/* Blood Box */}
          <View style={styles.bloodBox}>
            <Text style={styles.bloodTypeText}>{bloodType}</Text>
          </View>

          {/* Hospital & Meta */}
          <View style={styles.textContainer}>
            <Text numberOfLines={1} style={styles.hospitalText}>
              {hospitalDisplay}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {unitsNeeded} {unitsNeeded === 1 ? 'Unit' : 'Units'} Needed
              </Text>
              <Text style={styles.metaDot}>·</Text>
              <View style={styles.distanceContainer}>
                <MapPin color="#64748B" size={12} />
                <Text style={styles.metaText}>{distanceLabel}</Text>
              </View>
              {timeLabel ? (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{timeLabel}</Text>
                </>
              ) : null}
            </View>
          </View>
        </View>

        {/* Urgency Tag */}
        <View style={[styles.urgencyTag, { backgroundColor: urgencyStyle.tagBg }]}>
          <Text style={[styles.urgencyTagText, { color: urgencyStyle.tagText }]}>
            {urgencyStyle.tagLabel}
          </Text>
        </View>
      </View>

      {/* Action Row: Donate Button + Chat and Details */}
      <View style={styles.actionRow}>
        <Pressable
          accessibilityLabel="Donate to this blood request"
          accessibilityRole="button"
          style={({ pressed }) => [styles.donateButton, pressed ? styles.buttonPressed : null]}
          onPress={onRespond}
        >
          <HeartHandshake color="#FFFFFF" size={16} strokeWidth={2.25} />
          <Text style={styles.donateButtonText}>Donate</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Chat with requester"
          accessibilityRole="button"
          style={({ pressed }) => [styles.iconButton, pressed ? styles.buttonPressed : null]}
          onPress={onChat}
        >
          <MessageCircle color="#0F172A" size={16} strokeWidth={2.25} />
        </Pressable>

        <Pressable
          accessibilityLabel="View blood request details"
          accessibilityRole="button"
          style={({ pressed }) => [styles.iconButton, pressed ? styles.buttonPressed : null]}
          onPress={onDetails}
        >
          <ArrowRight color="#0F172A" size={16} strokeWidth={2.25} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  bloodBox: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  bloodTypeText: {
    color: '#0F172A',
    fontFamily: fontFamilies.displayHeavy,
    fontSize: 16,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    gap: 12,
    padding: 14,
    width: '100%',
    ...shadows.card,
  },
  distanceContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  donateButton: {
    alignItems: 'center',
    backgroundColor: colors.donate,
    borderRadius: 10,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  donateButtonText: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.textBold,
    fontSize: 13,
    fontWeight: '700',
  },
  hospitalText: {
    color: '#0F172A',
    fontFamily: fontFamilies.textBold,
    fontSize: 13.5,
    fontWeight: '700',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  leftInfo: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  metaDot: {
    color: '#94A3B8',
    fontFamily: fontFamilies.textRegular,
    fontSize: 11,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  metaText: {
    color: '#64748B',
    fontFamily: fontFamilies.textSemibold,
    fontSize: 11,
    fontWeight: '600',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  urgencyTag: {
    alignItems: 'center',
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  urgencyTagText: {
    fontFamily: fontFamilies.textHeavy,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});


