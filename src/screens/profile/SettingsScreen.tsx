import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Bell,
  Camera,
  CircleHelp,
  Globe,
  Info,
  LogOut,
  MapPin,
  MessageSquare,
  Moon,
  Shield,
  Smartphone,
  Trash2,
  UserRound,
  Flag,
} from 'lucide-react-native';
import { Alert, ScrollView, Text, View } from 'react-native';

import { SignOutConfirmModal } from '@/components/common/SignOutConfirmModal';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsScreenHeader } from '@/components/settings/SettingsScreenHeader';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsToggle } from '@/components/settings/SettingsToggle';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSignOut } from '@/hooks/useSignOut';
import type { AppStackParamList } from '@/navigation/types';
import {
  isExpoGoClient,
  syncPushRegistration,
} from '@/services/notifications/pushRegistration';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NOTIFICATION_PREFERENCE_DEFAULTS,
  type NotificationPreferences,
} from '@/services/supabase/notificationPreferences';
import { getHighAccuracyPosition } from '@/services/location/getHighAccuracyPosition';
import { setDonorMapVisibility } from '@/services/supabase/profiles';
import { authStyles } from '@/screens/auth/styles';
import { sanitizeProfileError } from '@/utils/profileErrors';
import { settingsStyles } from './settingsStyles';

type Props = NativeStackScreenProps<AppStackParamList, 'Settings'>;

const APP_VERSION = '1.0.0';

const DEFAULT_NOTIFICATION_PREFS: Pick<
  NotificationPreferences,
  'push_enabled' | 'emergency_alerts' | 'message_notifications' | 'sms_enabled'
> = { ...NOTIFICATION_PREFERENCE_DEFAULTS };

export function SettingsScreen({ navigation }: Props) {
  const { profile, refreshProfile, session } = useAuth();
  const {
    cancelSignOut,
    clearSignOutError,
    confirmSignOut,
    confirmVisible,
    performSignOut,
    signOutError,
    signingOut,
  } = useSignOut();

  const [mapVisibilityLoading, setMapVisibilityLoading] = useState(false);
  const [mapVisibilityError, setMapVisibilityError] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  const [notificationLoadingKey, setNotificationLoadingKey] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const showComingSoon = (feature: string) => {
    Alert.alert(feature, 'This preference will be available in a future update.');
  };

  const isDonor = profile?.role === 'donor';

  const loadNotificationPreferences = useCallback(async () => {
    if (!session?.user.id) {
      return;
    }

    const { data, error } = await getNotificationPreferences(session.user.id);

    if (error) {
      setNotificationError(
        sanitizeProfileError(error, 'Unable to load notification preferences.'),
      );
      return;
    }

    if (data) {
      setNotificationPrefs({
        push_enabled: data.push_enabled,
        emergency_alerts: data.emergency_alerts,
        message_notifications: data.message_notifications,
        sms_enabled: data.sms_enabled ?? false,
      });
      setNotificationError(null);
    }
  }, [session?.user.id]);

  useEffect(() => {
    void loadNotificationPreferences();
  }, [loadNotificationPreferences]);

  const handleNotificationToggle = async (
    key: keyof typeof DEFAULT_NOTIFICATION_PREFS,
    value: boolean,
  ) => {
    if (!session?.user.id || notificationLoadingKey) {
      return;
    }

    if (key === 'sms_enabled' && value && !profile?.phone?.trim()) {
      Alert.alert(
        'Phone number required',
        'Add a verified phone number to your profile before enabling SMS alerts.',
      );
      return;
    }

    const previous = notificationPrefs;
    const next = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(next);
    setNotificationLoadingKey(key);
    setNotificationError(null);

    const { data, error } = await updateNotificationPreferences(session.user.id, {
      [key]: value,
    });

    if (error) {
      setNotificationPrefs(previous);
      setNotificationError(
        sanitizeProfileError(error, 'Unable to update notification preferences.'),
      );
      setNotificationLoadingKey(null);
      return;
    }

    if (data) {
      setNotificationPrefs({
        push_enabled: data.push_enabled,
        emergency_alerts: data.emergency_alerts,
        message_notifications: data.message_notifications,
        sms_enabled: data.sms_enabled ?? false,
      });
    }

    if (key === 'push_enabled') {
      const pushResult = await syncPushRegistration(session.user.id, value);

      if (pushResult.error && value) {
        setNotificationError(pushResult.error.message);
      } else if (value && pushResult.skippedInExpoGo) {
        Alert.alert(
          'Push preference saved',
          'Remote push is not available in Expo Go on SDK 53+. Your preference is saved; use a development build (`npx expo run:android` / `run:ios`) to register device push tokens.',
        );
      }
    }

    setNotificationLoadingKey(null);
  };

  const pushSubtitle = isExpoGoClient()
    ? 'Saved in settings · device push needs a development build'
    : 'Device alerts for important updates';

  const handleMapVisibilityToggle = async (visibleOnMap: boolean) => {
    if (!session?.user.id || mapVisibilityLoading) {
      return;
    }

    setMapVisibilityLoading(true);
    setMapVisibilityError(null);

    let latitude = profile?.latitude ?? null;
    let longitude = profile?.longitude ?? null;

    if (visibleOnMap && (latitude == null || longitude == null)) {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setMapVisibilityError('Location permission is required to appear on the donor map.');
        setMapVisibilityLoading(false);
        return;
      }

      try {
        const position = await getHighAccuracyPosition();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        setMapVisibilityError('Unable to read your location. Try again from the Map tab.');
        setMapVisibilityLoading(false);
        return;
      }
    }

    const { error } = await setDonorMapVisibility({
      userId: session.user.id,
      visibleOnMap,
      latitude,
      longitude,
    });

    if (error) {
      setMapVisibilityError(
        sanitizeProfileError(error, 'Unable to update map visibility. Please try again.'),
      );
    } else {
      await refreshProfile();
    }

    setMapVisibilityLoading(false);
  };

  const openDetail = (title: string, description: string) => {
    navigation.navigate('SettingsDetail', { description, title });
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'Account deletion is handled by BloodLink support to protect healthcare records. Email support@bloodlink.app to request permanent removal of your profile, requests, and donation history.',
      [
        { style: 'cancel', text: 'Cancel' },
        { text: 'OK' },
      ],
    );
  };

  return (
    <View style={settingsStyles.screen}>
      <SettingsScreenHeader title="Settings" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={settingsStyles.scrollContent}>
        <SettingsSection title="Notifications">
          <SettingsRow
            icon={<Bell color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Push Notifications"
            showDivider
            subtitle={pushSubtitle}
            trailing={
              <SettingsToggle
                disabled={notificationLoadingKey === 'push_enabled'}
                value={notificationPrefs.push_enabled}
                onValueChange={(value) => void handleNotificationToggle('push_enabled', value)}
              />
            }
            showChevron={false}
          />
          <SettingsRow
            icon={<Bell color={colors.primary} size={22} strokeWidth={1.75} />}
            label="Emergency Alerts"
            showDivider
            subtitle="Blood requests, matches, and donations"
            trailing={
              <SettingsToggle
                disabled={notificationLoadingKey === 'emergency_alerts'}
                value={notificationPrefs.emergency_alerts}
                onValueChange={(value) => void handleNotificationToggle('emergency_alerts', value)}
              />
            }
            showChevron={false}
          />
          <SettingsRow
            icon={<MessageSquare color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Message Notifications"
            showDivider
            subtitle="Chat and coordination messages"
            trailing={
              <SettingsToggle
                disabled={notificationLoadingKey === 'message_notifications'}
                value={notificationPrefs.message_notifications}
                onValueChange={(value) =>
                  void handleNotificationToggle('message_notifications', value)
                }
              />
            }
            showChevron={false}
          />
          <SettingsRow
            icon={<Smartphone color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="SMS Alerts"
            subtitle={
              profile?.phone?.trim()
                ? 'Text alerts for urgent matches and donations'
                : 'Requires a phone number on your profile'
            }
            trailing={
              <SettingsToggle
                disabled={notificationLoadingKey === 'sms_enabled'}
                value={notificationPrefs.sms_enabled}
                onValueChange={(value) => void handleNotificationToggle('sms_enabled', value)}
              />
            }
            showChevron={false}
          />
        </SettingsSection>

        {notificationError ? (
          <Text style={[authStyles.error, { marginHorizontal: 24 }]}>{notificationError}</Text>
        ) : null}

        <SettingsSection title="Account">
          <SettingsRow
            icon={<Camera color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Profile Picture"
            showDivider
            subtitle="Update your photo"
            onPress={() => navigation.navigate('ProfilePicture')}
          />
          <SettingsRow
            icon={<UserRound color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Account Settings"
            subtitle="Name, email, and phone number"
            onPress={() => navigation.navigate('AccountSettings')}
          />
        </SettingsSection>

        <SettingsSection title="Privacy & Security">
          <SettingsRow
            icon={<Flag color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Report a concern"
            showDivider
            subtitle="Use the flag icon in chat to report a person"
            onPress={() =>
              openDetail(
                'Report a concern',
                'Open a BloodLink chat conversation and tap the flag icon to report suspicious activity, harassment, impersonation, false eligibility, or false emergency calls. Administrators review reports in the Safety & Moderation queue.',
              )
            }
          />
          <SettingsRow
            icon={<Shield color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Privacy Settings"
            showDivider
            onPress={() =>
              openDetail(
                'Privacy Settings',
                'Control who can see your profile details, contact information, and donation activity. BloodLink only shares the minimum information required for safe coordination.',
              )
            }
          />
          <SettingsRow
            icon={<Shield color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Data Security"
            onPress={() =>
              openDetail(
                'Data Security',
                'Your account data is encrypted in transit and stored securely. Verification records, staff roles, and protected health details are never editable from the mobile app.',
              )
            }
          />
        </SettingsSection>

        <SettingsSection title="Preferences">
          <SettingsRow
            icon={<MapPin color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Location Services"
            showDivider={isDonor}
            subtitle="Managed by your device settings"
            onPress={() =>
              openDetail(
                'Location Services',
                'BloodLink uses your device location permission to estimate distance to nearby donors and requests. You can enable or disable location access in your phone settings.',
              )
            }
          />
          {isDonor ? (
            <SettingsRow
              icon={<MapPin color={colors.foreground} size={22} strokeWidth={1.75} />}
              label="Show on Donor Map"
              subtitle="Let verified users see your GPS pin on the map"
              trailing={
                <SettingsToggle
                  disabled={mapVisibilityLoading}
                  value={profile?.visible_on_map ?? false}
                  onValueChange={(value) => void handleMapVisibilityToggle(value)}
                />
              }
              showChevron={false}
            />
          ) : null}
          <SettingsRow
            icon={<Globe color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Language"
            showDivider
            trailing={<Text style={settingsStyles.rowTrailingText}>English</Text>}
            onPress={() => showComingSoon('Language')}
          />
          <SettingsRow
            icon={<Moon color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Dark Mode"
            subtitle="Coming soon"
            onPress={() => showComingSoon('Dark Mode')}
          />
        </SettingsSection>

        {mapVisibilityError ? (
          <Text style={[authStyles.error, { marginHorizontal: 24 }]}>{mapVisibilityError}</Text>
        ) : null}

        <SettingsSection title="Support">
          <SettingsRow
            icon={<CircleHelp color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="Help Center"
            showDivider
            onPress={() => navigation.navigate('HemieAI')}
          />
          <SettingsRow
            icon={<Info color={colors.foreground} size={22} strokeWidth={1.75} />}
            label="About BloodLink"
            onPress={() =>
              openDetail(
                'About BloodLink',
                'BloodLink connects blood donors with recipients who need help fast. Built for safe coordination, verified profiles, and life-saving response when every minute counts.',
              )
            }
          />
        </SettingsSection>

        <SettingsSection title="Account Actions">
          <SettingsRow
            icon={<LogOut color={colors.foreground} size={22} strokeWidth={1.75} />}
            label={signingOut ? 'Signing out…' : 'Logout'}
            showChevron={false}
            showDivider
            onPress={() => {
              if (signingOut) {
                return;
              }

              clearSignOutError();
              confirmSignOut();
            }}
          />
          <SettingsRow
            destructive
            icon={<Trash2 color={colors.primary} size={22} strokeWidth={1.75} />}
            label="Delete Account"
            showChevron={false}
            onPress={confirmDeleteAccount}
          />
        </SettingsSection>

        {signOutError ? <Text style={authStyles.error}>{signOutError}</Text> : null}

        <View style={settingsStyles.footer}>
          <Text style={settingsStyles.footerText}>BloodLink v{APP_VERSION}</Text>
          <Text style={settingsStyles.footerText}>© 2026 BloodLink. All rights reserved.</Text>
        </View>
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
