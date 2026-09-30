import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { ArrowLeft, Check, MapPin, Minus, Plus, Stethoscope, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { ContentLoadingSkeleton } from '@/components/common/ContentLoadingSkeleton';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SwipeableBottomSheetModal } from '@/components/common/SwipeableBottomSheetModal';
import { BloodbankFacilityPicker } from '@/components/forms/BloodbankFacilityPicker';
import type { BloodRequestFacility } from '@/constants/bloodRequestFacilities';
import { BloodTypeSelector } from '@/components/forms/BloodTypeSelector';
import { FormUrgencySelector } from '@/components/forms/FormUrgencySelector';
import { MedicalDocumentUploadField } from '@/components/forms/MedicalDocumentUploadField';
import { RequestFormField } from '@/components/forms/RequestFormField';
import { BLOOD_TYPES } from '@/constants/bloodTypes';
import { FORM_URGENCY_OPTIONS, mapDbUrgencyToForm, mapFormUrgencyToDb } from '@/constants/createBloodRequestForm';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { AppStackParamList } from '@/navigation/types';
import { createBloodRequestStyles as styles } from '@/screens/recipient/createBloodRequestStyles';
import { getHighAccuracyPosition } from '@/services/location/getHighAccuracyPosition';
import { canEditBloodRequest, createBloodRequest, formatBloodRequestCooldown, getBloodRequestById, getBloodRequestCooldownRemainingSeconds, getMyBloodRequests, updateBloodRequest } from '@/services/supabase/bloodRequests';
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
  patientName: z.string().trim().min(2, 'Patient name or reference is required.'),
  unitsNeeded: z.number().int().min(1, 'At least 1 unit is required.').max(20, 'Maximum 20 units.'),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
});

type BloodRequestFormValues = z.infer<typeof bloodRequestSchema>;
type Coordinates = { latitude: number | null; longitude: number | null };

export function CreateBloodRequestScreen({ navigation, route }: Props) {
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const requestId = route.params?.requestId;
  const isEditing = Boolean(requestId);
  const [coordinates, setCoordinates] = useState<Coordinates>({ latitude: profile?.latitude ?? null, longitude: profile?.longitude ?? null });
  const [document, setDocument] = useState<LocalDocument | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [editableRequestId, setEditableRequestId] = useState<string | null>(null);
  const [formReady, setFormReady] = useState(!isEditing);
  const [editBlocked, setEditBlocked] = useState(false);
  const [manualFacility, setManualFacility] = useState(isEditing);
  const [selectedFacilityAddress, setSelectedFacilityAddress] = useState<string | undefined>();
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [reviewValues, setReviewValues] = useState<BloodRequestFormValues | null>(null);
  const cooldownActive = !isEditing && cooldownSeconds > 0;

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<BloodRequestFormValues>({
    defaultValues: {
      address: profile?.address ?? '',
      bloodType: route.params?.bloodType ?? profile?.blood_type ?? BLOOD_TYPES[0],
      hospitalName: '', notes: '', patientName: '', unitsNeeded: 1, urgencyLevel: 'medium',
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
    const latestEditable = (data ?? []).find((request) => canEditBloodRequest(request, session.user.id));
    setEditableRequestId(latestEditable?.id ?? null);
  }, [isEditing, session?.user.id]);

  useFocusEffect(useCallback(() => void refreshCooldown(), [refreshCooldown]));

  useEffect(() => {
    if (!cooldownActive) return;
    const timer = setInterval(() => setCooldownSeconds((current) => Math.max(0, current - 1)), 1000);
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
      if (cancelled) return;
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
      reset({ address: data.address ?? '', bloodType: data.blood_type, hospitalName: data.hospital_name, notes: data.notes ?? '', patientName: data.patient_name ?? '', unitsNeeded: data.units_needed, urgencyLevel: mapDbUrgencyToForm(data.urgency) });
      setCoordinates({ latitude: data.latitude, longitude: data.longitude });
      setManualFacility(true);
      setNoteExpanded(Boolean(data.notes?.trim()));
      setFormReady(true);
    };
    void loadRequest();
    return () => { cancelled = true; };
  }, [requestId, reset, session?.user.id]);

  const selectedBloodType = watch('bloodType');
  const selectedUrgencyLevel = watch('urgencyLevel');
  const unitsNeeded = watch('unitsNeeded');
  const hospitalName = watch('hospitalName');

  const captureLocation = async () => {
    if (locating) return;
    setLocationMessage(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationMessage(permission.canAskAgain === false ? 'Location permission is disabled. Enter an address manually.' : 'Location permission denied. Enter an address manually.');
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setLocationMessage('Location services are off. Enter an address manually.');
        return;
      }
      const currentPosition = await getHighAccuracyPosition();
      setCoordinates({ latitude: currentPosition.coords.latitude, longitude: currentPosition.coords.longitude });
      setLocationMessage('Current location captured. Add an address or landmark for donors.');
    } catch {
      setLocationMessage('Unable to capture location. Enter an address manually.');
    } finally {
      setLocating(false);
    }
  };

  const chooseFacility = (facility: BloodRequestFacility) => {
    const facilityAddress = facility.address.trim() || facility.branchLocation?.trim() || '';
    setManualFacility(false);
    setSelectedFacilityAddress(facilityAddress || undefined);
    setValue('hospitalName', facility.displayName, { shouldValidate: true });
    setValue('address', facilityAddress, { shouldValidate: true });
    setCoordinates({ latitude: facility.latitude, longitude: facility.longitude });
    setLocationMessage(null);
  };

  const chooseManualFacility = () => {
    setManualFacility(true);
    setSelectedFacilityAddress(undefined);
    setValue('hospitalName', '', { shouldValidate: true });
    setValue('address', profile?.address ?? '', { shouldValidate: true });
    setCoordinates({ latitude: profile?.latitude ?? null, longitude: profile?.longitude ?? null });
  };

  const onSubmit = async (values: BloodRequestFormValues) => {
    if (loading || cooldownActive || editBlocked || (isEditing && !formReady)) return;
    if (!session?.user.id) {
      setError('You need to be signed in to create a blood request.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      let attachmentPath: string | null = null;
      if (document) attachmentPath = await uploadBloodRequestAttachment(session.user.id, document);
      const payload = { address: values.address, bloodType: values.bloodType, hospitalName: values.hospitalName, latitude: coordinates.latitude, longitude: coordinates.longitude, notes: values.notes || null, patientName: values.patientName, unitsNeeded: values.unitsNeeded, urgency: mapFormUrgencyToDb(values.urgencyLevel) };
      const { data, error: saveError } = isEditing && requestId
        ? await updateBloodRequest(requestId, session.user.id, { ...payload, ...(attachmentPath ? { attachmentPath } : {}) })
        : await createBloodRequest({ ...payload, attachmentPath, contactPhone: profile?.phone ?? null, neededAt: getDefaultNeededAt(), requesterId: session.user.id });
      if (saveError) {
        if (saveError.message.toLowerCase().includes('before creating another blood request')) void refreshCooldown();
        setError(saveError.message);
        setReviewValues(null);
        return;
      }
      if (!data) {
        setError(isEditing ? 'Unable to update blood request.' : 'Unable to create blood request.');
        setReviewValues(null);
        return;
      }
      appCache.invalidate('feed:open_requests');
      appCache.invalidate(`recipient:my_requests:${session.user.id}`);
      appCache.invalidate(`recipient:active_request_count:${session.user.id}`);
      appCache.setSync(`blood_request:detail:${data.id}`, data);
      navigation.replace('BloodRequestDetail', { requestId: data.id });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : isEditing ? 'Unable to update blood request.' : 'Unable to create blood request.');
      setReviewValues(null);
    } finally {
      setLoading(false);
    }
  };

  const adjustUnits = (delta: number) => setValue('unitsNeeded', Math.max(1, Math.min(20, unitsNeeded + delta)), { shouldValidate: true });
  const urgencyLabel = FORM_URGENCY_OPTIONS.find((option) => option.id === reviewValues?.urgencyLevel)?.label;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()}><ArrowLeft color={colors.foreground} size={22} /></Pressable>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Blood Request' : 'New Blood Request'}</Text>
      </View>

      {isEditing && !formReady ? <ContentLoadingSkeleton rows={3} /> : editBlocked ? (
        <View style={styles.scrollContent}>{error ? <Text style={styles.errorText}>{error}</Text> : null}</View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Text style={styles.introTitle}>{isEditing ? 'Update the essentials.' : 'Provide the essentials.'}</Text>
            <Text style={styles.introSubtitle}>{isEditing ? 'Review corrections before saving them for responding donors.' : "We'll use these details to find compatible nearby donors."}</Text>
          </View>

          <View style={styles.sectionCard}>
            <SectionHeader eyebrow="1 · BLOOD NEEDED" description="Used to identify compatible donors." />
            <BloodTypeSelector error={errors.bloodType?.message} label="Blood type" value={selectedBloodType} onChange={(bloodType) => setValue('bloodType', bloodType, { shouldValidate: true })} />
            <View style={styles.divider} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Units</Text>
              <View style={styles.stepperShell}>
                <Pressable accessibilityLabel="Decrease units" accessibilityRole="button" disabled={unitsNeeded <= 1} style={({ pressed }) => [styles.stepperButton, unitsNeeded <= 1 ? styles.stepperButtonDisabled : null, pressed ? styles.pressed : null]} onPress={() => adjustUnits(-1)}><Minus color={colors.foreground} size={18} /></Pressable>
                <Text style={styles.stepperValue}>{unitsNeeded} {unitsNeeded === 1 ? 'unit' : 'units'}</Text>
                <Pressable accessibilityLabel="Increase units" accessibilityRole="button" disabled={unitsNeeded >= 20} style={({ pressed }) => [styles.stepperButton, unitsNeeded >= 20 ? styles.stepperButtonDisabled : null, pressed ? styles.pressed : null]} onPress={() => adjustUnits(1)}><Plus color={colors.foreground} size={18} /></Pressable>
              </View>
              {errors.unitsNeeded ? <Text style={styles.errorText}>{errors.unitsNeeded.message}</Text> : null}
            </View>
            <FormUrgencySelector error={errors.urgencyLevel?.message} value={selectedUrgencyLevel} onChange={(urgencyLevel) => setValue('urgencyLevel', urgencyLevel, { shouldValidate: true })} />
          </View>

          <View style={styles.sectionCard}>
            <SectionHeader eyebrow="2 · HOSPITAL & PATIENT" description="Choose a listed facility or enter another one." />
            <BloodbankFacilityPicker error={errors.hospitalName?.message || (!manualFacility ? errors.address?.message : undefined)} selectedAddress={!manualFacility ? selectedFacilityAddress : undefined} selectedName={!manualFacility ? hospitalName : undefined} onChooseManual={chooseManualFacility} onSelect={chooseFacility} />
            {manualFacility ? (
              <View style={styles.manualFields}>
                <View style={styles.manualBadge}><Text style={styles.manualBadgeText}>Manual facility</Text></View>
                <Controller control={control} name="hospitalName" render={({ field: { onBlur, onChange, value } }) => <RequestFormField error={errors.hospitalName?.message} label="Facility name" placeholder="e.g. Cebu Provincial Hospital" value={value} onBlur={onBlur} onChangeText={onChange} />} />
                <Controller control={control} name="address" render={({ field: { onBlur, onChange, value } }) => <RequestFormField error={errors.address?.message} label="Address / Landmark" placeholder="City, street, ward, or landmark" value={value} onBlur={onBlur} onChangeText={onChange} />} />
                <Pressable accessibilityLabel="Use current location" accessibilityRole="button" disabled={locating} style={({ pressed }) => [styles.locationButton, pressed ? styles.pressed : null]} onPress={() => void captureLocation()}>
                  {locating ? <ActivityIndicator color={colors.primary} size="small" /> : <MapPin color={coordinates.latitude != null ? colors.success : colors.primary} size={18} />}
                  <Text style={styles.locationButtonText}>{locating ? 'Getting current location…' : coordinates.latitude != null ? 'Current location captured' : 'Use current location'}</Text>
                </Pressable>
                {locationMessage ? <Text style={styles.helperText}>{locationMessage}</Text> : null}
              </View>
            ) : null}
            <View style={styles.divider} />
            <Controller control={control} name="patientName" render={({ field: { onBlur, onChange, value } }) => <RequestFormField error={errors.patientName?.message} label="Patient name / reference" placeholder="Enter a name or hospital reference" value={value} onBlur={onBlur} onChangeText={onChange} />} />
            <Text style={styles.privacyNote}>Only shared where necessary to coordinate this request.</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}><SectionHeader eyebrow="3 · SUPPORTING DETAILS" description="Optional" /><Stethoscope color={colors.mutedLight} size={20} /></View>
            {noteExpanded ? (
              <View style={styles.optionalField}>
                <View style={styles.optionalFieldHeader}><Text style={styles.fieldLabel}>Medical note</Text><Pressable accessibilityLabel="Remove medical note" hitSlop={8} onPress={() => { setValue('notes', ''); setNoteExpanded(false); }}><X color={colors.muted} size={18} /></Pressable></View>
                <Controller control={control} name="notes" render={({ field: { onBlur, onChange, value } }) => <RequestFormField error={errors.notes?.message} label="Details" multiline placeholder="Relevant information for the donor" value={value} onBlur={onBlur} onChangeText={onChange} />} />
              </View>
            ) : <Pressable accessibilityRole="button" style={({ pressed }) => [styles.optionalAction, pressed ? styles.pressed : null]} onPress={() => setNoteExpanded(true)}><Plus color={colors.primary} size={18} /><Text style={styles.optionalActionText}>Add medical note</Text></Pressable>}
            <MedicalDocumentUploadField document={document} onChange={setDocument} />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      )}

      {!editBlocked && formReady ? (
        <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]}>
          {cooldownActive ? <Text style={styles.cooldownText}>You recently posted a request. Wait {formatBloodRequestCooldown(cooldownSeconds)} before posting another one. You can still edit the request you already sent.</Text> : null}
          {editableRequestId ? <PrimaryButton title="Edit your request" variant="secondary" onPress={() => navigation.navigate('CreateBloodRequest', { requestId: editableRequestId })} /> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading || cooldownActive }} disabled={loading || cooldownActive} style={({ pressed }) => [styles.submitButton, loading || cooldownActive ? styles.submitButtonDisabled : null, pressed && !loading && !cooldownActive ? styles.submitButtonPressed : null]} onPress={handleSubmit(setReviewValues)}>
            <Text style={styles.submitButtonText}>{cooldownActive ? `Wait ${formatBloodRequestCooldown(cooldownSeconds)}` : isEditing ? 'Review Changes' : 'Review Request'}</Text>
          </Pressable>
        </View>
      ) : null}

      <SwipeableBottomSheetModal visible={Boolean(reviewValues)} onDismiss={() => !loading && setReviewValues(null)}>
        {reviewValues ? (
          <View style={styles.reviewSheet}>
            <View style={styles.reviewHeader}><View style={styles.reviewIcon}><Check color={colors.primary} size={22} /></View><View style={styles.reviewHeaderCopy}><Text style={styles.reviewTitle}>{isEditing ? 'Review changes' : 'Review request'}</Text><Text style={styles.reviewSubtitle}>Confirm the critical details before notifying donors.</Text></View></View>
            <View style={styles.reviewSummary}>
              <Text style={styles.reviewBloodLine}>{reviewValues.bloodType} · {reviewValues.unitsNeeded} {reviewValues.unitsNeeded === 1 ? 'unit' : 'units'} · {urgencyLabel}</Text>
              <View style={styles.reviewDivider} />
              <ReviewRow label="Facility" value={reviewValues.hospitalName} />
              <ReviewRow label="Location" value={reviewValues.address} />
              <ReviewRow label="Patient" value={reviewValues.patientName} />
              {document ? <ReviewRow label="Attachment" value={document.name} /> : null}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.reviewActions}>
              <Pressable accessibilityRole="button" disabled={loading} style={({ pressed }) => [styles.editButton, pressed ? styles.pressed : null]} onPress={() => setReviewValues(null)}><Text style={styles.editButtonText}>Edit Request</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={loading} style={({ pressed }) => [styles.confirmButton, loading ? styles.submitButtonDisabled : null, pressed ? styles.submitButtonPressed : null]} onPress={() => void onSubmit(reviewValues)}>{loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.confirmButtonText}>{isEditing ? 'Confirm Changes' : 'Confirm & Find Donors'}</Text>}</Pressable>
            </View>
          </View>
        ) : null}
      </SwipeableBottomSheetModal>
    </KeyboardAvoidingView>
  );
}

function SectionHeader({ description, eyebrow }: { description: string; eyebrow: string }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionEyebrow}>{eyebrow}</Text><Text style={styles.sectionDescription}>{description}</Text></View>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.reviewRow}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value}</Text></View>;
}
