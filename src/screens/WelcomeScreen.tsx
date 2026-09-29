import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Hospital, Shield, Users, Zap } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalAgreementText } from '@/components/common/LegalAgreementText';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { colors, radii } from '@/constants/theme';
import type { AuthStackParamList } from '@/navigation/types';

import bloodlinkLogo from '../assets/images/bloodlink-new-logo.png';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

// Orbit geometry
const ORBIT_RADIUS = 112;
const BADGE_ITEMS: { icon: LucideIcon; label: string; offset: number }[] = [
  { icon: Shield, label: 'Verified Donors', offset: 0 },
  { icon: Zap, label: 'Emergency Alerts', offset: (2 * Math.PI) / 3 },
  { icon: Users, label: 'Compatible Matches', offset: (4 * Math.PI) / 3 },
];

// ─── OrbitBadge ──────────────────────────────────────────────────────────────
type OrbitBadgeProps = {
  icon: LucideIcon;
  label: string;
  angularOffset: number;
  orbit: SharedValue<number>;
};

function OrbitBadge({ icon: Icon, label, angularOffset, orbit }: OrbitBadgeProps) {
  const animStyle = useAnimatedStyle(() => {
    const angle = orbit.value + angularOffset;
    const tx = ORBIT_RADIUS * Math.sin(angle);
    const ty = -ORBIT_RADIUS * Math.cos(angle);
    return {
      transform: [{ translateX: tx }, { translateY: ty }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.badgeAnchor, animStyle]}>
      <View style={styles.orbitBadge}>
        <View style={styles.badgeIconCircle}>
          <Icon color={colors.muted} size={11} strokeWidth={2.6} />
        </View>
        <Text numberOfLines={1} style={styles.badgeLabel}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── PulseRing ───────────────────────────────────────────────────────────────
type PulseRingProps = {
  delay: number;
  size: number;
};

function PulseRing({ delay, size }: PulseRingProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2800, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const animStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.7, 1.85]);
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0.55, 0.2, 0]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.pulseRingBase,
        { borderRadius: size / 2, height: size, width: size },
        animStyle,
      ]}
    />
  );
}

// ─── WelcomeScreen ───────────────────────────────────────────────────────────
export function WelcomeScreen({ navigation }: Props) {
  // Shared value for orbit angle: 0 → 2π over 20 seconds, looped
  const orbit = useSharedValue(0);

  // Hospital hub subtle scale-breathe
  const hubBreath = useSharedValue(1);

  useEffect(() => {
    // Continuous orbit on the UI thread — silky smooth
    orbit.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: 50000, // Increased from 20000 to make the orbit slower (30 seconds per rotation)
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    // Gentle hub breathing
    hubBreath.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [orbit, hubBreath]);

  // Derive the orbit guide ring angle for a subtle slow counter-rotate effect
  const ringRotation = useDerivedValue(() => `${-orbit.value * 0.15}rad`);

  const hubStyle = useAnimatedStyle(() => ({
    transform: [{ scale: hubBreath.value }],
  }));

  const orbitRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: ringRotation.value }],
  }));

  const handleGetStarted = () => navigation.navigate('Signup');
  const handleExistingAccount = () => navigation.navigate('Login');

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {/* ── Hero ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(600).springify()} style={styles.heroSection}>
          <Image
            accessibilityLabel="BloodLink logo"
            resizeMode="contain"
            source={bloodlinkLogo}
            style={styles.logo}
          />
          <View style={styles.textContainer}>
            <Text style={styles.headline}>Find compatible blood{'\n'}donors faster</Text>
          </View>
        </Animated.View>

        {/* ── Orbit Stage ── */}
        <Animated.View entering={FadeIn.delay(100).duration(700)} style={styles.orbitStage}>
          {/* Slow-rotating dashed orbit guide */}
          <Animated.View style={[styles.orbitRing, orbitRingStyle]} />

          {/* Radial pulse rings */}
          <PulseRing delay={0} size={112} />
          <PulseRing delay={900} size={112} />

          {/* Hospital hub - Much bigger */}
          <Animated.View style={[styles.hospitalHub, hubStyle]}>
            <Hospital color={colors.primary} size={44} strokeWidth={2.3} />
          </Animated.View>

          {/* Orbiting badges - Compact & smaller */}
          {BADGE_ITEMS.map((item) => (
            <OrbitBadge
              angularOffset={item.offset}
              icon={item.icon}
              key={item.label}
              label={item.label}
              orbit={orbit}
            />
          ))}
        </Animated.View>

        {/* ── CTA ── */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(600).springify()}
          style={styles.bottomSection}
        >
          <View style={styles.actions}>
            <PrimaryButton title="Get Started" onPress={handleGetStarted} />
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={handleExistingAccount}
            >
              <Text style={styles.secondaryButtonText}>I already have an account</Text>
            </Pressable>
          </View>

          <LegalAgreementText
            leadIn="By continuing, you agree to our"
            onOpen={(document) => navigation.navigate('LegalDocument', { document })}
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    width: '100%',
  },
  badgeAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  badgeIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  badgeLabel: {
    color: '#1e293b',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  bottomSection: {
    gap: 18,
    paddingTop: 4,
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  headline: {
    color: colors.foreground,
    fontSize: 35,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 45,
    textAlign: 'center',
  },
  heroSection: {
    alignItems: 'center',
    gap: 20,
    width: '100%',
  },
  hospitalHub: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: colors.border,
    borderRadius: 46,
    borderWidth: 1, // Soften border from 2 to 1
    elevation: 2,
    height: 92,
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    width: 92,
  },
  logo: {
    height: 110,
    maxWidth: 280,
    width: '100%',
  },
  orbitBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(226,232,240,0.4)', // Soften border opacity
    borderRadius: radii.pill,
    borderWidth: 1,
    elevation: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    shadowColor: '#0f172a',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.015,
    shadowRadius: 4,
  },
  orbitRing: {
    borderColor: 'rgba(226,232,240,0.4)', // Soften border opacity
    borderRadius: ORBIT_RADIUS,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: ORBIT_RADIUS * 2,
    position: 'absolute',
    width: ORBIT_RADIUS * 2,
  },
  orbitStage: {
    alignItems: 'center',
    height: (ORBIT_RADIUS + 22) * 2,
    justifyContent: 'center',
    marginVertical: 6,
    overflow: 'visible',
    position: 'relative',
    width: '100%',
  },
  pulseRingBase: {
    backgroundColor: colors.border,
    position: 'absolute',
  },
  safeArea: {
    backgroundColor: '#fff',
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },

  textContainer: {
    alignItems: 'center',
    gap: 8,
  },
});
