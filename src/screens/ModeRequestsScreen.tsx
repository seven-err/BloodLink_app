import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useUserMode, type UserMode } from '@/context/UserModeContext';
import type { AppTabParamList } from '@/navigation/AppTabNavigator';
import type { AppStackParamList } from '@/navigation/types';
import { DonorRequestFeedScreen } from '@/screens/donor/DonorRequestFeedScreen';
import { MyBloodRequestsScreen } from '@/screens/recipient/MyBloodRequestsScreen';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Requests'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function ModeRequestsScreen(props: Props) {
  const { profile } = useAuth();
  const { mode } = useUserMode();
  const effectiveMode: UserMode = profile?.role === 'recipient' ? 'request' : mode;

  return (
    <View style={styles.stage}>
      <View
        accessibilityElementsHidden={effectiveMode !== 'donate'}
        importantForAccessibility={effectiveMode === 'donate' ? 'auto' : 'no-hide-descendants'}
        pointerEvents={effectiveMode === 'donate' ? 'auto' : 'none'}
        style={[styles.pane, effectiveMode === 'donate' ? styles.visible : styles.hidden]}
      >
        <DonorRequestFeedScreen {...props} />
      </View>
      <View
        accessibilityElementsHidden={effectiveMode !== 'request'}
        importantForAccessibility={effectiveMode === 'request' ? 'auto' : 'no-hide-descendants'}
        pointerEvents={effectiveMode === 'request' ? 'auto' : 'none'}
        style={[styles.pane, effectiveMode === 'request' ? styles.visible : styles.hidden]}
      >
        <MyBloodRequestsScreen {...props} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
    zIndex: 0,
  },
  pane: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  stage: {
    flex: 1,
  },
  visible: {
    opacity: 1,
    zIndex: 1,
  },
});
