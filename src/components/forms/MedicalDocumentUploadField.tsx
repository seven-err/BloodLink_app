import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileImage, FileText, Image, Paperclip, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SwipeableBottomSheetModal } from '@/components/common/SwipeableBottomSheetModal';
import { colors } from '@/constants/theme';
import { createBloodRequestStyles } from '@/screens/recipient/createBloodRequestStyles';
import type { LocalDocument } from '@/services/supabase/storageUpload';

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

type MedicalDocumentUploadFieldProps = {
  document: LocalDocument | null;
  error?: string;
  onChange: (document: LocalDocument | null) => void;
};

export function MedicalDocumentUploadField({
  document,
  error,
  onChange,
}: MedicalDocumentUploadFieldProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const applyImage = (asset: ImagePicker.ImagePickerAsset) => {
    onChange({
      mimeType: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? `medical-document-${Date.now()}.jpg`,
      uri: asset.uri,
    });
    setSheetVisible(false);
  };

  const takePhoto = async () => {
    setPickerError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPickerError('Camera permission is required to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (!result.canceled && result.assets[0]) applyImage(result.assets[0]);
    } catch {
      setPickerError('Unable to open the camera. Please try again.');
    }
  };

  const choosePhoto = async () => {
    setPickerError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPickerError('Photo library permission is required to choose an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (!result.canceled && result.assets[0]) applyImage(result.assets[0]);
    } catch {
      setPickerError('Unable to open the photo library. Please try again.');
    }
  };

  const pickDocument = async () => {
    setPickerError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ACCEPTED_TYPES,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      onChange({ mimeType: asset.mimeType, name: asset.name, uri: asset.uri });
      setSheetVisible(false);
    } catch {
      setPickerError('Unable to open the file picker. Please try again.');
    }
  };

  return (
    <View style={createBloodRequestStyles.field}>
      {document ? (
        <View style={styles.attachmentRow}>
          <View style={styles.attachmentIcon}>
            {document.mimeType?.startsWith('image/') ? <FileImage color={colors.primary} size={19} /> : <FileText color={colors.primary} size={19} />}
          </View>
          <Pressable accessibilityRole="button" style={styles.attachmentCopy} onPress={() => setSheetVisible(true)}>
            <Text numberOfLines={1} style={styles.attachmentName}>{document.name}</Text>
            <Text style={styles.attachmentAction}>Tap to replace</Text>
          </Pressable>
          <Pressable accessibilityLabel={`Remove ${document.name}`} hitSlop={8} onPress={() => onChange(null)}>
            <X color={colors.muted} size={20} />
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]} onPress={() => setSheetVisible(true)}>
          <Paperclip color={colors.primary} size={18} />
          <Text style={styles.addButtonText}>Attach medical document</Text>
        </Pressable>
      )}
      {error || pickerError ? <Text style={createBloodRequestStyles.errorText}>{error ?? pickerError}</Text> : null}

      <SwipeableBottomSheetModal visible={sheetVisible} onDismiss={() => setSheetVisible(false)}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Add medical document</Text>
          <Text style={styles.sheetSubtitle}>Photos and PDF files up to 10 MB are supported.</Text>
          {pickerError ? <Text style={createBloodRequestStyles.errorText}>{pickerError}</Text> : null}
          <AttachmentOption icon={<Camera color={colors.primary} size={21} />} title="Take Photo" subtitle="Use your camera" onPress={() => void takePhoto()} />
          <AttachmentOption icon={<Image color={colors.primary} size={21} />} title="Choose Photo" subtitle="Select from your gallery" onPress={() => void choosePhoto()} />
          <AttachmentOption icon={<FileText color={colors.primary} size={21} />} title="Choose File" subtitle="Upload a PDF or image file" onPress={() => void pickDocument()} />
          <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => setSheetVisible(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </SwipeableBottomSheetModal>
    </View>
  );
}

function AttachmentOption({ icon, onPress, subtitle, title }: { icon: React.ReactNode; onPress: () => void; subtitle: string; title: string }) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]} onPress={onPress}>
      <View style={styles.optionIcon}>{icon}</View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addButton: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 42 },
  addButtonText: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  attachmentAction: { color: colors.muted, fontSize: 12 },
  attachmentCopy: { flex: 1, gap: 2 },
  attachmentIcon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  attachmentName: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  attachmentRow: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 60, padding: 11 },
  cancelButton: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, marginTop: 4, paddingTop: 16 },
  cancelText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  option: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 66, paddingVertical: 10 },
  optionCopy: { flex: 1, gap: 3 },
  optionIcon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  optionSubtitle: { color: colors.muted, fontSize: 13 },
  optionTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  sheet: { paddingBottom: 24, paddingHorizontal: 20 },
  sheetSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18, paddingBottom: 10 },
  sheetTitle: { color: colors.foreground, fontSize: 19, fontWeight: '800', paddingBottom: 5 },
});
