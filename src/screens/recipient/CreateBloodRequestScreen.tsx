import { useFocusEffect } from '@react-navigation/native';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Droplets, MapPin } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { ContentLoadingSkeleton } from '@/components/common/ContentLoadingSkeleton';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { BloodTypeSelector } from '@/components/forms/BloodTypeSelector';
import { FormUrgencySelector } from '@/components/forms/FormUrgencySelector';
import { MedicalDocumentUploadField } from '@/components/forms/MedicalDocumentUploadField';
import { RequestFormField } from '@/components/forms/RequestFormField';
import { BLOOD_TYPES } from '@/constants/bloodTypes';
import { mapDbUrgencyToForm, mapFormUrgencyToDb } from '@/constants/createBloodRequestForm';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { AppStackParamList } from '@/navigation/types';
import { createBloodRequestStyles } from '@/screens/recipient/createBloodRequestStyles';
import { getHighAccuracyPosition } from '@/services/location/getHighAccuracyPosition';
import {
  canEditBloodRequest,
  createBloodRequest,
  formatBloodRequestCooldown,
  getBloodRequestById,
  getBloodRequestCooldownRemainingSeconds,
  getMyBloodRequests,
  updateBloodRequest,
} from '@/services/supabase/bloodRequests';
import { uploadBloodRequestAttachment, type LocalDocument } from '@/services/supabase/storageUpload';
import type { BloodType } from '@/types/database';
import { appCache } from '@/utils/appCache';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateBloodRequest'>;

const getDefaultNeededAt = () => {
  const date = new Date();
  date.setHours(date.getHours() + 24);
  return date.toISOString();
};

const bloodRequestSchema = z.object({
  address: z.string().trim().min(3, 'Location is required.'),
  bloodType: z.enum(BLOOD_TYPES as [BloodType, ...BloodType[]]),
  hospitalName: z.string().trim().min(2, 'Hospital or facility name is required.'),
  notes: z.string().trim().optional(),
  patientName: z.string().trim().min(2, 'Patient name or label is required.'),
  unitsNeeded: z
    .number()
    .int()
    .min(1, 'At least 1 unit is required.')
    .max(20, 'Maximum 20 units.'),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
});

type BloodRequestFormValues = z.infer<typeof bloodRequestSchema>;

type Coordinates = {
  latitude: number | null;
  longitude: number | null;
};

export function CreateBloodRequestScreen({ navigation, route }: Props) {
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const requestId = route.params?.requestId;
  const isEditing = Boolean(requestId);
  const [coordinates, setCoordinates] = useState<Coordinates>({
    latitude: profile?.latitude ?? null,
    longitude: profile?.longitude ?? null,
  });
  const [document, setDocument] = useState<LocalDocument | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [editableRequestId, setEditableRequestId] = useState<string | null>(null);
  const [formReady, setFormReady] = useState(!isEditing);
  const [editBlocked, setEditBlocked] = useState(false);
  const cooldownActive = !isEditing && cooldownSeconds > 0;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BloodRequestFormValues>({
    defaultValues: {
      address: profile?.address ?? '',
      bloodType: route.params?.bloodType ?? profile?.blood_type ?? BLOOD_TYPES[0],
      hospitalName: '',
      notes: '',
      patientName: '',
      unitsNeeded: 1,
      urgencyLevel: 'medium',
    },
    resolver: zodResolver(bloodRequestSchema),
  });

  const refreshCooldown = useCallback(async () => {
    if (isEditing || !session?.user.id) {
      setCooldownSeconds(0);
      setEditableRequestId(null);
      return;
    }

    const remaining = await getBloodRequestCooldownRemainingSeconds();
    setCooldownSeconds(remaining);

    if (remaining <= 0) {
      setEditableRequestId(null);
      return;
    }

    const { data } = await getMyBloodRequests(session.user.id);
    const latestEditable = (data ?? []).find((request) =>
      canEditBloodRequest(request, session.user.id),
    );
    setEditableRequestId(latestEditable?.id ?? null);
  }, [isEditing, session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void refreshCooldown();
    }, [refreshCooldown]),
  );

  useEffect(() => {
    if (!cooldownActive) {
      return;
    }

    const timer = setInterval(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownActive]);

  useEffect(() => {
    if (!requestId) {
      setFormReady(true);
      setEditBlocked(false);
      return;
    }

    let cancelled = false;

    const loadRequest = async () => {
      setFormReady(false);
      setEditBlocked(false);
      setError(null);

      const { data, error: loadError } = await getBloodRequestById(requestId);

      if (cancelled) {
        return;
      }

      if (loadError || !data) {
        setError(loadError?.message ?? 'Unable to load this request.');
        setEditBlocked(true);
        setFormReady(true);
        return;
      }

      if (!session?.user.id || !canEditBloodRequest(data, session.user.id)) {
        setError('You can only edit your own open or matched requests.');
        setEditBlocked(true);
        setFormReady(true);
        return;
      }

      reset({
        address: data.address ?? '',
        bloodType: data.blood_type,
        hospitalName: data.hospital_name,
        notes: data.notes ?? '',
        patientName: data.patient_name ?? '',
        unitsNeeded: data.units_needed,
        urgencyLevel: mapDbUrgencyToForm(data.urgency),
      });
      setCoordinates({
        latitude: data.latitude,
        longitude: data.longitude,
      });
      setFormReady(true);
    };

    void loadRequest();

    return () => {
      cancelled = true;
    };
  }, [requestId, reset, session?.user.id]);

  const selectedBloodType = watch('bloodType');
  const selectedUrgencyLevel = watch('urgencyLevel');
  const unitsNeeded = watch('unitsNeeded');

  const captureLocation = async () => {
    if (locating) {
      return;
    }

    setLocationMessage(null);
    setLocating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setLocationMessage(
          permission.canAskAgain === false
            ? 'Location permission is disabled. Enter an address manually.'
            : 'Location permission denied. Enter an address manually.',
        );
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        setLocationMessage('Location services are off. Enter an address manually.');
        return;
      }

      const currentPosition = await getHighAccuracyPosition();

      setCoordinates({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
      setLocationMessage('GPS location captured. Add an address for donors.');
    } catch {
      setLocationMessage('Unable to capture location. Enter an address manually.');
    } finally {
      setLocating(false);
    }
  };

  const onSubmit = async (values: BloodRequestFormValues) => {
    if (loading || cooldownActive || editBlocked || (isEditing && !formReady)) {
      return;
    }

    if (!session?.user.id) {
      setError('You need to be signed in to create a blood request.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      let attachmentPath: string | null = null;

      if (document) {
        attachmentPath = await uploadBloodRequestAttachment(session.user.id, document);
      }

      const payload = {
        address: values.address,
        bloodType: values.bloodType,
        hospitalName: values.hospitalName,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        notes: values.notes || null,
        patientName: values.patientName,
        unitsNeeded: values.unitsNeeded,
        urgency: mapFormUrgencyToDb(values.urgencyLevel),
      };
      const { data, error: saveError } = isEditing && requestId
        ? await updateBloodRequest(requestId, session.user.id, {
            ...payload,
            ...(attachmentPath ? { attachmentPath } : {}),
          })
        : await createBloodRequest({
            ...payload,
            attachmentPath,
            contactPhone: profile?.phone ?? null,
            neededAt: getDefaultNeededAt(),
            requesterId: session.user.id,
          });

      if (saveError) {
        if (saveError.message.toLowerCase().includes('before creating another blood request')) {
          void refreshCooldown();
        }
        setError(saveError.message);
        return;
      }

      if (!data) {
        setError(isEditing ? 'Unable to update blood request.' : 'Unable to create blood request.');
        return;
      }

      appCache.invalidate('feed:open_requests');
      appCache.invalidate(`recipient:my_requests:${session.user.id}`);
      appCache.invalidate(`recipient:active_request_count:${session.user.id}`);
      appCache.setSync(`blood_request:detail:${data.id}`, data);

      navigation.replace('BloodRequestDetail', { requestId: data.id });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : isEditing
            ? 'Unable to update blood request.'
            : 'Unable to create blood request.',
      );
    } finally {
      setLoading(false);
    }
  };

  const adjustUnits = (delta: number) => {
    const next = Math.max(1, Math.min(20, unitsNeeded + delta));
    setValue('unitsNeeded', next, { shouldValidate: true });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={createBloodRequestStyles.screen}
    >
      {/* Header */}
      <View style={[createBloodRequestStyles.header, { paddingTop: topInset + 8 }]}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color={colors.foreground} size={22} />
        </Pressable>
        <Text style={createBloodRequestStyles.headerTitle}>
          {isEditing ? 'Edit Blood Request' : 'New Blood Request'}
        </Text>
      </View>

      {isEditing && !formReady ? (
        <ContentLoadingSkeleton rows={2} />
      ) : editBlocked ? (
        <View style={createBloodRequestStyles.scrollContent}>
          {error ? <Text style={createBloodRequestStyles.errorText}>{error}</Text> : null}
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={createBloodRequestStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Banner */}
        <View style={createBloodRequestStyles.heroBanner}>
          <View style={createBloodRequestStyles.heroBannerIcon}>
            <Droplets color={colors.primaryForeground} size={26} />
          </View>
          <View style={createBloodRequestStyles.heroBannerText}>
            <Text style={createBloodRequestStyles.heroBannerTitle}>
              {isEditing ? 'Update This Request' : 'Request Blood Donation'}
            </Text>
            <Text style={createBloodRequestStyles.heroBannerSubtitle}>
              {isEditing
                ? 'Save corrections here. Donors see the update, but are not alerted again.'
                : 'Fill in the details below. Nearby donors will be notified instantly.'}
            </Text>
          </View>
        </View>

        {/* Section 1: Patient & Request Info */}
        <View style={createBloodRequestStyles.section}>
          <Text style={createBloodRequestStyles.sectionTitle}>Patient Information</Text>
          <View style={createBloodRequestStyles.sectionCard}>

          <Controller
            control={control}
            name="patientName"
            render={({ field: { onBlur, onChange, value } }) => (
              <RequestFormField
                error={errors.patientName?.message}
                // keyboardType='number-pad'
                label="Patient Name / Label"
                placeholder="e.g. Juan Dela Cruz"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                // onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
              />
            )}
          />

          <Controller
            control={control}
            name="hospitalName"
            render={({ field: { onBlur, onChange, value } }) => (
              <RequestFormField
                error={errors.hospitalName?.message}
                label="Hospital / Facility"
                placeholder="e.g. Philippine General Hospital"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            )}
          />
          </View>
        </View>

        {/* Section 2: Blood Type & Units */}
        <View style={createBloodRequestStyles.section}>
          <Text style={createBloodRequestStyles.sectionTitle}>Blood Requirements</Text>
          <View style={createBloodRequestStyles.sectionCard}>

          <BloodTypeSelector
            error={errors.bloodType?.message}
            value={selectedBloodType}
            onChange={(bloodType) =>
              setValue('bloodType', bloodType, { shouldValidate: true })
            }
          />

          {/* Units Stepper */}
          <View style={createBloodRequestStyles.field}>
            <Text style={createBloodRequestStyles.fieldLabel}>Units Needed</Text>
            <View style={createBloodRequestStyles.stepperRow}>
              <Pressable
                accessibilityLabel="Decrease units"
                accessibilityRole="button"
                style={createBloodRequestStyles.stepperButton}
                onPress={() => adjustUnits(-1)}
              >
                <Text style={createBloodRequestStyles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={createBloodRequestStyles.stepperValue}>{unitsNeeded}</Text>
              <Pressable
                accessibilityLabel="Increase units"
                accessibilityRole="button"
                style={createBloodRequestStyles.stepperButton}
                onPress={() => adjustUnits(1)}
              >
                <Text style={createBloodRequestStyles.stepperButtonText}>+</Text>
              </Pressable>
              <Text style={createBloodRequestStyles.stepperUnit}>
                {unitsNeeded === 1 ? 'unit' : 'units'}
              </Text>
            </View>
            {errors.unitsNeeded ? (
              <Text style={createBloodRequestStyles.errorText}>{errors.unitsNeeded.message}</Text>
            ) : null}
          </View>

          <FormUrgencySelector
            error={errors.urgencyLevel?.message}
            value={selectedUrgencyLevel}
            onChange={(urgencyLevel) =>
              setValue('urgencyLevel', urgencyLevel, { shouldValidate: true })
            }
          />
          </View>
        </View>

        {/* Section 3: Location */}
        <View style={createBloodRequestStyles.section}>
          <Text style={createBloodRequestStyles.sectionTitle}>Location</Text>
          <View style={createBloodRequestStyles.sectionCard}>

          {/* GPS Capture Button */}
          <Pressable
            accessibilityLabel="Use current location"
            accessibilityRole="button"
            disabled={locating}
            style={({ pressed }) => [
              createBloodRequestStyles.locationButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => void captureLocation()}
          >
            {locating ? (
              <ActivityIndicator color={colors.mutedLight} size="small" />
            ) : (
              <MapPin
                color={coordinates.latitude != null ? colors.success : colors.mutedLight}
                size={18}
              />
            )}
            <Text
              style={[
                createBloodRequestStyles.locationButtonText,
                coordinates.latitude != null
                  ? createBloodRequestStyles.locationButtonTextActive
                  : null,
              ]}
            >
              {locating
                ? 'Getting location…'
                : coordinates.latitude != null
                  ? 'GPS location captured'
                  : 'Use current GPS location'}
            </Text>
          </Pressable>
          {locationMessage ? (
            <Text style={createBloodRequestStyles.helperText}>{locationMessage}</Text>
          ) : null}

          <Controller
            control={control}
            name="address"
            render={({ field: { onBlur, onChange, value } }) => (
              <RequestFormField
                error={errors.address?.message}
                label="Address / Landmark"
                placeholder="Enter address for donors (e.g. ward, floor)"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            )}
          />
          </View>
        </View>

        {/* Section 4: Additional Details */}
        <View style={createBloodRequestStyles.section}>
          <Text style={createBloodRequestStyles.sectionTitle}>Additional Details</Text>
          <View style={createBloodRequestStyles.sectionCard}>

          <Controller
            control={control}
            name="notes"
            render={({ field: { onBlur, onChange, value } }) => (
              <RequestFormField
                error={errors.notes?.message}
                label="Medical Note (Optional)"
                multiline
                placeholder="Any relevant medical information for the donor"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            )}
          />

          <MedicalDocumentUploadField document={document} onChange={setDocument} />
          </View>
        </View>

        {error ? <Text style={createBloodRequestStyles.errorText}>{error}</Text> : null}
      </ScrollView>
      )}

      {!editBlocked && formReady ? (
      <View style={[createBloodRequestStyles.footer, { paddingBottom: bottomInset + 16 }]}>
        {cooldownActive ? (
          <Text style={createBloodRequestStyles.cooldownText}>
            You recently posted a request. Wait {formatBloodRequestCooldown(cooldownSeconds)} before
            posting another one. You can still edit the request you already sent.
          </Text>
        ) : null}
        {editableRequestId ? (
          <PrimaryButton
            title="Edit your request"
            variant="secondary"
            onPress={() =>
              navigation.navigate('CreateBloodRequest', { requestId: editableRequestId })
            }
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loading || cooldownActive }}
          disabled={loading || cooldownActive}
          style={({ pressed }) => [
            createBloodRequestStyles.submitButton,
            loading || cooldownActive ? createBloodRequestStyles.submitButtonDisabled : null,
            pressed && !loading && !cooldownActive
              ? createBloodRequestStyles.submitButtonPressed
              : null,
          ]}
          onPress={handleSubmit(onSubmit)}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={createBloodRequestStyles.submitButtonText}>
              {cooldownActive
                ? `Wait ${formatBloodRequestCooldown(cooldownSeconds)}`
                : isEditing
                  ? 'Save Changes'
                  : 'Submit Request'}
            </Text>
          )}
        </Pressable>
      </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
