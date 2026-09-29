import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ProfileSetupStackParamList } from '@/navigation/ProfileSetupNavigator';
import { ProfileSetupWizard } from './profile-setup/ProfileSetupWizard';

type Props = NativeStackScreenProps<ProfileSetupStackParamList, 'ProfileCompletion'>;

export function ProfileCompletionScreen({ navigation }: Props) {
  return (
    <ProfileSetupWizard
      onFinished={(role) => {
        if (role === 'donor') {
          navigation.replace('DonorPreScreening');
        }
      }}
    />
  );
}
