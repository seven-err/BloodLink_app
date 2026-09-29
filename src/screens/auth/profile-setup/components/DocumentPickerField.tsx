import * as DocumentPicker from 'expo-document-picker';
import { X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { LocalDocument } from '@/services/supabase/storageUpload';

import { profileSetupStyles } from '../styles';

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

type DocumentPickerFieldProps = {
  documents: LocalDocument[];
  error?: string;
  onChange: (documents: LocalDocument[]) => void;
};

export function DocumentPickerField({
  documents,
  error,
  onChange,
}: DocumentPickerFieldProps) {
  const pickDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: ACCEPTED_TYPES,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const nextDocuments: LocalDocument[] = result.assets.map((asset) => ({
      mimeType: asset.mimeType,
      name: asset.name,
      uri: asset.uri,
    }));

    onChange([...documents, ...nextDocuments]);
  };

  const removeDocument = (index: number) => {
    onChange(documents.filter((_, documentIndex) => documentIndex !== index));
  };

  return (
    <View style={profileSetupStyles.section}>
      <Text style={profileSetupStyles.sectionTitle}>Proof of affiliation</Text>
      <Pressable
        accessibilityRole="button"
        style={profileSetupStyles.uploadButton}
        onPress={pickDocuments}
      >
        <Text style={profileSetupStyles.uploadButtonText}>
          {documents.length ? 'Add another document' : 'Upload documents'}
        </Text>
      </Pressable>
      {documents.length ? (
        <View style={profileSetupStyles.documentList}>
          {documents.map((document, index) => (
            <View key={`${document.uri}-${index}`} style={profileSetupStyles.documentChip}>
              <Text numberOfLines={1} style={profileSetupStyles.documentChipText}>
                {document.name}
              </Text>
              <Pressable
                accessibilityLabel={`Remove ${document.name}`}
                accessibilityRole="button"
                onPress={() => removeDocument(index)}
              >
                <X color={colors.muted} size={16} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {error ? <Text style={{ color: colors.primary }}>{error}</Text> : null}
    </View>
  );
}
