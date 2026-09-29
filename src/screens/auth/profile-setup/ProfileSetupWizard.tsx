import * as Location from 'expo-location';
import { Camera, Heart, MapPin, Users } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormTextInput } from '@/components/forms/FormTextInput';
import { BLOOD_TYPES } from '@/constants/bloodTypes';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getHighAccuracyPosition } from '@/services/location/getHighAccuracyPosition';
import { completeProfile } from '@/services/supabase/profiles';
import type { BloodType, OnboardingRole } from '@/types/database';
import { getDonorEligibilityIssues } from '@/utils/donorEligibility';
import {
  formatPhoneDisplay,
  isPhilippineMobile,
  normalizePhoneNumber,
  PH_MOBILE_ERROR,
  PH_MOBILE_PLACEHOLDER,
} from '@/utils/phone';
import { AuthBrand } from '../AuthBrand';
import { authStyles } from '../styles';
import { EligibilityCallout } from './components/EligibilityCallout';
import { ProfileSetupProgress } from './components/ProfileSetupProgress';
import { RoleSelectionCard } from './components/RoleSelectionCard';
import { ToggleSettingCard } from './components/ToggleSettingCard';
import { profileSetupStyles } from './styles';

type BasicInfo = {
  fullName: string;
  email: string;
  phone: string;
};

type DonorDetails = {
  availableToDonate: boolean;
  birthdate: string;
  bloodType: BloodType | null;
  enableLocation: boolean;
  lastDonationDate: string;
  lastTransfusionDate: string;
  weightKg: string;
};

type RecipientDetails = {
  bloodType: BloodType | null;
  enableLocation: boolean;
};

const getPrefillValue = (
  profileValue: string | null | undefined,
  metadataValue: unknown,
  sessionValue?: string | null,
) => {
  if (profileValue?.trim()) {
    return profileValue.trim();
  }

  if (typeof metadataValue === 'string' && metadataValue.trim()) {
    return metadataValue.trim();
  }

  return sessionValue?.trim() ?? '';
};

type ProfileSetupWizardProps = {
  /** Recipient applying to donate skips role selection and opens donor details. */
  mode?: 'onboarding' | 'apply-donor';
  onFinished?: (role: OnboardingRole) => void;
};

export function ProfileSetupWizard({
  mode = 'onboarding',
  onFinished,
}: ProfileSetupWizardProps) {
  const { profile, refreshProfile, session, updateProfileLocally } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(mode === 'apply-donor' ? 3 : 1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [coordinates, setCoordinates] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({
    latitude: profile?.latitude ?? null,
    longitude: profile?.longitude ?? null,
  });

  const prefilledBasicInfo = useMemo<BasicInfo>(() => {
    const metadata = session?.user.user_metadata ?? {};

    return {
      email: session?.user.email ?? '',
      fullName: getPrefillValue(profile?.full_name, metadata.full_name),
      phone: getPrefillValue(profile?.phone, metadata.phone),
    };
  }, [profile?.full_name, profile?.phone, session?.user.email, session?.user.user_metadata]);

  const [basicInfo, setBasicInfo] = useState<BasicInfo>(prefilledBasicInfo);
  const [role, setRole] = useState<OnboardingRole | null>(
    mode === 'apply-donor' ? 'donor' : null,
  );
  const [donorDetails, setDonorDetails] = useState<DonorDetails>({
    availableToDonate: true,
    birthdate: profile?.birthdate ?? '',
    bloodType: profile?.blood_type ?? null,
    enableLocation: false,
    lastDonationDate: profile?.last_donation_at ?? '',
    lastTransfusionDate: '',
    weightKg: profile?.weight_kg ? String(profile.weight_kg) : '',
  });
  const [recipientDetails, setRecipientDetails] = useState<RecipientDetails>({
    bloodType: profile?.blood_type ?? null,
    enableLocation: false,
  });

  useEffect(() => {
    setBasicInfo(prefilledBasicInfo);
  }, [prefilledBasicInfo]);

  const hasPrefilledName = Boolean(prefilledBasicInfo.fullName);
  const hasPrefilledPhone =
    Boolean(prefilledBasicInfo.phone) && isPhilippineMobile(prefilledBasicInfo.phone);
  const hasPrefilledEmail = Boolean(prefilledBasicInfo.email);

  const stepTitle =
    mode === 'apply-donor'
      ? 'Apply as a Donor'
      : step === 1
        ? 'Set Up Your Profile'
        : step === 2
          ? 'Choose Your Role'
          : 'Health Information';

  const stepSubtitle =
    mode === 'apply-donor'
      ? 'Please proceed to complete your donor details.'
      : step === 1
        ? 'Step 1 of 3: Basic Information'
        : step === 2
          ? 'Step 2 of 3: Account Type'
          : role === 'recipient'
            ? 'Step 3 of 3: Recipient Details'
            : 'Step 3 of 3: Donor Details';

  const captureLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setError('Location permission was denied. You can proceed without enabling location.');
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return null;
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords) {
        const coords = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        setCoordinates(coords);
        setError(null);
        return coords;
      }

      const currentPosition = await Promise.race([
        getHighAccuracyPosition(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Location request timed out.')), 3500),
        ),
      ]);

      const coords = {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      };
      setCoordinates(coords);
      setError(null);
      return coords;
    } catch (locErr) {
      console.warn('Location capture error:', locErr);
      return null;
    }
  };

  const validateStep1 = () => {
    const fullName = (hasPrefilledName ? prefilledBasicInfo.fullName : basicInfo.fullName).trim();
    const phone = (hasPrefilledPhone ? prefilledBasicInfo.phone : basicInfo.phone).trim();
    const email = (hasPrefilledEmail ? prefilledBasicInfo.email : basicInfo.email).trim();

    if (fullName.length < 2) {
      setError('Full name is required.');
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return false;
    }

    if (!email.includes('@')) {
      setError('A valid email address is required.');
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return false;
    }

    if (!isPhilippineMobile(phone)) {
      setError(PH_MOBILE_ERROR);
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return false;
    }

    setBasicInfo({ email, fullName, phone });
    setError(null);
    return true;
  };

  const validateStep2 = () => {
    if (!role) {
      setError('Choose the account type that best describes you.');
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return false;
    }

    setError(null);
    return true;
  };

  const validateStep3 = () => {
    if (role === 'donor') {
      if (!donorDetails.bloodType) {
        setError('Please select your blood type.');
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return false;
      }

      const birthdate = donorDetails.birthdate.trim().replace(/\//g, '-');
      if (!birthdate) {
        setError('Please enter your birthdate in YYYY-MM-DD format (e.g. 1995-08-25).');
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return false;
      }

      const weightKg = Number(donorDetails.weightKg);
      if (!donorDetails.weightKg.trim() || !Number.isFinite(weightKg)) {
        setError('Please enter your weight in kg (minimum 50 kg).');
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return false;
      }

      const issues = getDonorEligibilityIssues({
        birthdate,
        lastTransfusionDate: donorDetails.lastTransfusionDate?.trim().replace(/\//g, '-') || null,
        weightKg,
      });

      if (issues.length) {
        setError(issues[0]);
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return false;
      }
    }

    if (role === 'recipient' && !recipientDetails.bloodType) {
      setError('Please select your blood type.');
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return false;
    }

    setError(null);
    return true;
  };

  const goNext = () => {
    if (step === 1 && !validateStep1()) {
      return;
    }

    if (step === 2 && !validateStep2()) {
      return;
    }

    if (step < 3) {
      setStep((current) => (current === 1 ? 2 : 3));
      return;
    }

    void submitProfile();
  };

  const submitProfile = async () => {
    if (loading) {
      return;
    }

    if (!session?.user.id) {
      setError('User session not found. Please log in again.');
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return;
    }

    if (!role) {
      setError('Please choose your account type (Donor or Recipient).');
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return;
    }

    if (!validateStep3()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fullName = (hasPrefilledName ? prefilledBasicInfo.fullName : basicInfo.fullName).trim();
      const phone = normalizePhoneNumber(
        hasPrefilledPhone ? prefilledBasicInfo.phone : basicInfo.phone,
      );
      const enableLocation =
        role === 'donor' ? donorDetails.enableLocation : recipientDetails.enableLocation;

      let activeCoords = coordinates;
      if (enableLocation && (activeCoords.latitude === null || activeCoords.longitude === null)) {
        const captured = await captureLocation();
        if (captured) {
          activeCoords = captured;
        }
      }

      const cleanBirthdate = donorDetails.birthdate.trim().replace(/\//g, '-');
      const cleanLastDonation = donorDetails.lastDonationDate?.trim().replace(/\//g, '-') || null;
      const weightKg = Number(donorDetails.weightKg);

      const { data: updatedProfile, error: profileError } = await completeProfile({
        bloodType: role === 'donor' ? donorDetails.bloodType : recipientDetails.bloodType,
        birthdate: role === 'donor' ? cleanBirthdate || null : null,
        fullName,
        isAvailable: role === 'donor' ? donorDetails.availableToDonate : false,
        lastDonationAt: cleanLastDonation,
        latitude: enableLocation ? activeCoords.latitude : null,
        longitude: enableLocation ? activeCoords.longitude : null,
        phone,
        role,
        userId: session.user.id,
        weightKg: role === 'donor' && Number.isFinite(weightKg) ? weightKg : null,
      });

      if (profileError) {
        setError(profileError.message);
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return;
      }

      if (updatedProfile) {
        updateProfileLocally(updatedProfile);
      }
      void refreshProfile();
      onFinished?.(role);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to complete your profile.',
      );
      scrollViewRef.current?.scrollToEnd({ animated: true });
    } finally {
      setLoading(false);
    }
  };

  const renderBloodTypeGrid = (
    selectedBloodType: BloodType | null,
    onSelect: (bloodType: BloodType) => void,
  ) => (
    <View style={profileSetupStyles.section}>
      <Text style={profileSetupStyles.sectionTitle}>Blood Type</Text>
      <View style={profileSetupStyles.bloodGrid}>
        {BLOOD_TYPES.map((bloodType) => {
          const selected = selectedBloodType === bloodType;

          return (
            <Pressable
              key={bloodType}
              style={[
                profileSetupStyles.bloodTypeButton,
                selected ? profileSetupStyles.bloodTypeButtonSelected : null,
              ]}
              onPress={() => onSelect(bloodType)}
            >
              <Text
                style={[
                  profileSetupStyles.bloodTypeText,
                  selected ? profileSetupStyles.bloodTypeTextSelected : null,
                ]}
              >
                {bloodType}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={profileSetupStyles.section}>
      <View style={profileSetupStyles.photoCircle}>
        <Camera color={colors.mutedLight} size={32} />
      </View>
      <Pressable style={profileSetupStyles.uploadButton}>
        <Text style={profileSetupStyles.uploadButtonText}>Upload Photo</Text>
      </Pressable>
      {hasPrefilledName ? (
        <View style={profileSetupStyles.readOnlyField}>
          <Text style={profileSetupStyles.readOnlyLabel}>Full Name</Text>
          <Text style={profileSetupStyles.readOnlyValue}>{prefilledBasicInfo.fullName}</Text>
        </View>
      ) : (
        <FormTextInput
          label="Full Name"
          placeholder="John Doe"
          value={basicInfo.fullName}
          onChangeText={(fullName) => setBasicInfo((current) => ({ ...current, fullName }))}
        />
      )}
      {hasPrefilledEmail ? (
        <View style={profileSetupStyles.readOnlyField}>
          <Text style={profileSetupStyles.readOnlyLabel}>Email</Text>
          <Text style={profileSetupStyles.readOnlyValue}>{prefilledBasicInfo.email}</Text>
        </View>
      ) : (
        <FormTextInput
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          placeholder="john@example.com"
          value={basicInfo.email}
          onChangeText={(email) => setBasicInfo((current) => ({ ...current, email }))}
        />
      )}
      {hasPrefilledPhone ? (
        <View style={profileSetupStyles.readOnlyField}>
          <Text style={profileSetupStyles.readOnlyLabel}>Phone Number</Text>
          <Text style={profileSetupStyles.readOnlyValue}>
            {formatPhoneDisplay(prefilledBasicInfo.phone)}
          </Text>
        </View>
      ) : (
        <FormTextInput
          keyboardType="phone-pad"
          label="Philippine mobile number"
          placeholder={PH_MOBILE_PLACEHOLDER}
          value={basicInfo.phone}
          onChangeText={(phone) => setBasicInfo((current) => ({ ...current, phone }))}
        />
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={profileSetupStyles.roleList}>
      <RoleSelectionCard
        description="I want to donate blood"
        icon={<Heart color={colors.primary} size={22} />}
        iconBackground={colors.primarySoft}
        selected={role === 'donor'}
        title="Donor"
        onPress={() => setRole('donor')}
      />
      <RoleSelectionCard
        description="I need blood donation"
        icon={<Users color={colors.info} size={22} />}
        iconBackground={colors.infoSoft}
        selected={role === 'recipient'}
        title="Recipient"
        onPress={() => setRole('recipient')}
      />
    </View>
  );

  const renderDonorStep3 = () => (
    <>
      {renderBloodTypeGrid(donorDetails.bloodType, (bloodType) =>
        setDonorDetails((current) => ({ ...current, bloodType })),
      )}
      <ToggleSettingCard
        description="Allow BloodLink to find nearby blood requests."
        icon={<MapPin color={colors.muted} size={20} />}
        title="Enable Location"
        value={donorDetails.enableLocation}
        onValueChange={(enableLocation) => {
          setDonorDetails((current) => ({ ...current, enableLocation }));
          if (enableLocation) {
            void captureLocation();
          }
        }}
      />
      <ToggleSettingCard
        description="Show me in search results for recipients."
        title="Available to Donate"
        value={donorDetails.availableToDonate}
        onValueChange={(availableToDonate) =>
          setDonorDetails((current) => ({ ...current, availableToDonate }))
        }
      />
      <FormTextInput
        keyboardType="numbers-and-punctuation"
        label="Birthdate"
        placeholder="YYYY-MM-DD"
        value={donorDetails.birthdate}
        onChangeText={(birthdate) => setDonorDetails((current) => ({ ...current, birthdate }))}
      />
      <FormTextInput
        keyboardType="decimal-pad"
        label="Weight (kg)"
        placeholder="50"
        value={donorDetails.weightKg}
        onChangeText={(weightKg) => setDonorDetails((current) => ({ ...current, weightKg }))}
      />
      <FormTextInput
        keyboardType="numbers-and-punctuation"
        label="Last Donation Date (Optional)"
        placeholder="YYYY-MM-DD"
        value={donorDetails.lastDonationDate}
        onChangeText={(lastDonationDate) =>
          setDonorDetails((current) => ({ ...current, lastDonationDate }))
        }
      />
      <FormTextInput
        keyboardType="numbers-and-punctuation"
        label="Last Blood Transfusion Date (if applicable)"
        placeholder="YYYY-MM-DD"
        value={donorDetails.lastTransfusionDate}
        onChangeText={(lastTransfusionDate) =>
          setDonorDetails((current) => ({ ...current, lastTransfusionDate }))
        }
      />
      <EligibilityCallout />
    </>
  );

  const renderRecipientStep3 = () => (
    <>
      {renderBloodTypeGrid(recipientDetails.bloodType, (bloodType) =>
        setRecipientDetails((current) => ({ ...current, bloodType })),
      )}
      <ToggleSettingCard
        description="Allow BloodLink to find nearby donors."
        icon={<MapPin color={colors.muted} size={20} />}
        title="Enable Location"
        value={recipientDetails.enableLocation}
        onValueChange={(enableLocation) => {
          setRecipientDetails((current) => ({ ...current, enableLocation }));
          if (enableLocation) {
            void captureLocation();
          }
        }}
      />
      <View style={profileSetupStyles.infoCallout}>
        <Text style={profileSetupStyles.infoCalloutTitle}>Important Information</Text>
        <Text style={profileSetupStyles.infoCalloutText}>
          Your blood type information will help us match you with compatible donors quickly in case
          of emergency.
        </Text>
      </View>
    </>
  );

  const renderStep3 = () => {
    if (role === 'donor') {
      return renderDonorStep3();
    }

    if (role === 'recipient') {
      return renderRecipientStep3();
    }

    return null;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={profileSetupStyles.screen}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={profileSetupStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AuthBrand />
        {mode === 'onboarding' ? <ProfileSetupProgress currentStep={step} /> : null}
        <View style={profileSetupStyles.heading}>
          <Text style={profileSetupStyles.stepTitle}>{stepTitle}</Text>
          <Text style={profileSetupStyles.stepSubtitle}>{stepSubtitle}</Text>
        </View>
        {step === 1 ? renderStep1() : null}
        {step === 2 ? renderStep2() : null}
        {step === 3 ? renderStep3() : null}
        {error ? <Text style={authStyles.error}>{error}</Text> : null}
        <PrimaryButton
          loading={loading}
          title={
            mode === 'apply-donor' ? 'Proceed as donor' : step === 3 ? 'Complete Profile' : 'Continue'
          }
          onPress={goNext}
          style={profileSetupStyles.continueButton}
        />
        {step > 1 && mode === 'onboarding' ? (
          <PrimaryButton
            title="Back"
            variant="secondary"
            onPress={() => {
              setError(null);
              setStep((current) => (current === 3 ? 2 : 1));
            }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
