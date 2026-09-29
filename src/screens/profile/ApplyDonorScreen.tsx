import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import type { AppStackParamList } from '@/navigation/types';
import { ProfileSetupWizard } from '@/screens/auth/profile-setup/ProfileSetupWizard';

type Props = NativeStackScreenProps<AppStackParamList, 'ApplyDonor'>;

export function ApplyDonorScreen({ navigation }: Props) {
  const { top: topInset } = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={colors.foreground} size={22} />
        </Pressable>
        <Text style={styles.title}>Apply as a donor</Text>
      </View>
      <ProfileSetupWizard mode="apply-donor" onFinished={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  title: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '800',
  },
});
