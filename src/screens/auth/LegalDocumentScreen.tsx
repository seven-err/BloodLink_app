import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsScreenHeader } from '@/components/settings/SettingsScreenHeader';
import { LEGAL_DOCUMENTS } from '@/constants/legalDocuments';
import { colors, radii, shadows } from '@/constants/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'LegalDocument'>;

export function LegalDocumentScreen({ navigation, route }: Props) {
  const document = LEGAL_DOCUMENTS[route.params.document];

  return (
    <View style={styles.screen}>
      <SettingsScreenHeader title={document.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated {document.updated}</Text>
        {document.sections.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.body}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 10,
    padding: 16,
    ...shadows.card,
  },
  content: {
    gap: 12,
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '800',
  },
  updated: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
});
