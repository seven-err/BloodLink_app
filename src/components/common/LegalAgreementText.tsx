import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LegalDocumentId } from '@/constants/legalDocuments';
import { colors } from '@/constants/theme';

type LegalAgreementTextProps = {
  leadIn: string;
  onOpen: (document: LegalDocumentId) => void;
};

export function LegalAgreementText({ leadIn, onOpen }: LegalAgreementTextProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{leadIn}</Text>
      <Pressable
        accessibilityRole="link"
        hitSlop={10}
        style={styles.linkHit}
        onPress={() => onOpen('terms')}
      >
        <Text style={styles.link}>Terms and Conditions</Text>
      </Pressable>
      <Text style={styles.text}>and</Text>
      <Pressable
        accessibilityRole="link"
        hitSlop={10}
        style={styles.linkHit}
        onPress={() => onOpen('privacy')}
      >
        <Text style={styles.link}>Privacy Policy</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  linkHit: {
    paddingVertical: 2,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
