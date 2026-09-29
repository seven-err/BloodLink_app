import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { SettingsScreenHeader } from '@/components/settings/SettingsScreenHeader';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { AppStackParamList } from '@/navigation/types';
import { prefetchProfileAvatar, uploadProfileAvatar } from '@/services/supabase/profileAvatar';
import { updateProfileAvatarPath } from '@/services/supabase/profiles';
import type { LocalDocument } from '@/services/supabase/storageUpload';
import { pickProfileImage } from '@/utils/pickProfileImage';
import { sanitizeStorageError } from '@/utils/storageErrors';
import { editProfileStyles } from './editProfileStyles';

type Props = NativeStackScreenProps<AppStackParamList, 'ProfilePicture'>;

export function ProfilePictureScreen({ navigation }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { profile, refreshProfile, session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<LocalDocument | null>(null);

  const hasExistingAvatar = Boolean(profile?.avatar_path?.trim());
  const hasPendingChange = Boolean(selectedImage);
  const previewUri = selectedImage?.uri ?? null;

  const pickImage = async () => {
    if (picking) {
      return;
    }

    setError(null);
    setPicking(true);

    try {
      const image = await pickProfileImage();

      if (image) {
        setSelectedImage(image);
      }
    } catch (pickError) {
      setError(
        pickError instanceof Error ? pickError.message : 'Unable to open your photo library.',
      );
    } finally {
      setPicking(false);
    }
  };

  const saveProfilePicture = async () => {
    if (loading || !session?.user.id || !profile || !selectedImage) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const avatarPath = await uploadProfileAvatar(session.user.id, selectedImage);
      const { error: updateError } = await updateProfileAvatarPath(session.user.id, avatarPath);

      if (updateError) {
        throw updateError;
      }

      await prefetchProfileAvatar(avatarPath);
      await refreshProfile();
      navigation.goBack();
    } catch (saveError) {
      setError(sanitizeStorageError(saveError, 'Unable to update your profile picture.'));
    } finally {
      setLoading(false);
    }
  };

  const removeProfilePicture = () => {
    if (!session?.user.id || !profile || !hasExistingAvatar) {
      return;
    }

    Alert.alert('Remove profile picture?', 'Your initials will be shown instead.', [
      { style: 'cancel', text: 'Cancel' },
      {
        style: 'destructive',
        text: 'Remove',
        onPress: () => {
          void (async () => {
            setError(null);
            setLoading(true);

            try {
              const { error: updateError } = await updateProfileAvatarPath(session.user.id, null);

              if (updateError) {
                throw updateError;
              }

              setSelectedImage(null);
              await refreshProfile();
              navigation.goBack();
            } catch (removeError) {
              setError(
                sanitizeStorageError(removeError, 'Unable to remove your profile picture.'),
              );
            } finally {
              setLoading(false);
            }
          })();
        },
      },
    ]);
  };

  if (!profile) {
    return (
      <View style={editProfileStyles.screen}>
        <SettingsScreenHeader title="Profile Picture" onBack={() => navigation.goBack()} />
        <View style={editProfileStyles.scrollContent}>
          <View style={editProfileStyles.unavailableCard}>
            <Text style={editProfileStyles.unavailableTitle}>Profile unavailable</Text>
            <Text style={editProfileStyles.subtitle}>
              Sign in again to update your profile picture.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={editProfileStyles.screen}>
      <SettingsScreenHeader title="Profile Picture" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={editProfileStyles.scrollContent}>
        <Text style={editProfileStyles.subtitle}>
          Choose a clear photo of yourself. This helps recipients and donors recognize you during
          coordination.
        </Text>

        <View style={editProfileStyles.profilePicturePreviewWrap}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={editProfileStyles.profilePicturePreview} />
          ) : (
            <ProfileAvatar
              avatarPath={profile.avatar_path}
              fullName={profile.full_name}
              size={128}
            />
          )}
        </View>

        <View style={editProfileStyles.sectionCard}>
          <Pressable
            accessibilityRole="button"
            disabled={picking || loading}
            style={({ pressed }) => [
              editProfileStyles.profilePictureAction,
              pressed || picking || loading ? { opacity: 0.7 } : null,
            ]}
            onPress={() => void pickImage()}
          >
            {picking ? (
              <ActivityIndicator color={colors.foreground} size="small" />
            ) : (
              <ImagePlus color={colors.foreground} size={20} />
            )}
            <Text style={editProfileStyles.profilePictureActionText}>
              {hasExistingAvatar || hasPendingChange ? 'Choose a different photo' : 'Choose photo'}
            </Text>
          </Pressable>

          {hasExistingAvatar ? (
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              style={({ pressed }) => [
                editProfileStyles.profilePictureRemoveAction,
                pressed || loading ? { opacity: 0.7 } : null,
              ]}
              onPress={removeProfilePicture}
            >
              <Trash2 color={colors.primary} size={18} />
              <Text style={editProfileStyles.profilePictureRemoveText}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={editProfileStyles.profilePictureHintRow}>
          <Camera color={colors.mutedLight} size={16} />
          <Text style={editProfileStyles.helperText}>
            Pick from your photo library. JPEG, PNG, or WebP up to 5 MB.
          </Text>
        </View>

        {error ? <Text style={editProfileStyles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={[editProfileStyles.footer, { paddingBottom: bottomInset + 16 }]}>
        <Pressable
          accessibilityRole="button"
          disabled={loading || !hasPendingChange}
          style={({ pressed }) => [
            editProfileStyles.submitButton,
            loading || !hasPendingChange ? editProfileStyles.submitButtonDisabled : null,
            pressed && !loading && hasPendingChange
              ? editProfileStyles.submitButtonPressed
              : null,
          ]}
          onPress={() => void saveProfilePicture()}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={editProfileStyles.submitButtonText}>Save Profile Picture</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
