import AsyncStorage from '@react-native-async-storage/async-storage';
import { Info, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { chatStyles } from '@/screens/chat/styles';

const STORAGE_KEY = 'chat_safety_banner_hidden';

export const CHAT_SAFETY_BANNER_TEXT =
  'Coordinate donation details here. Do not share sensitive contact info unless already authorized through your accepted match.';

type ChatSafetyBannerProps = {
  onVisibilityChange?: (visible: boolean) => void;
};

export function ChatSafetyBanner({ onVisibilityChange }: ChatSafetyBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      const hidden = value === 'true';
      setVisible(!hidden);
      onVisibilityChange?.(!hidden);
    });
  }, [onVisibilityChange]);

  const dismiss = useCallback(() => {
    setVisible(false);
    onVisibilityChange?.(false);
    void AsyncStorage.setItem(STORAGE_KEY, 'true');
  }, [onVisibilityChange]);

  if (!visible) {
    return null;
  }

  return (
    <View style={chatStyles.disclaimer}>
      <View style={chatStyles.disclaimerRow}>
        <Info color={colors.info} size={18} />
        <Text style={chatStyles.disclaimerText}>
          <Text style={chatStyles.disclaimerLabel}>Secure chat: </Text>
          {CHAT_SAFETY_BANNER_TEXT}
        </Text>
        <Pressable
          accessibilityLabel="Hide secure chat notice"
          accessibilityRole="button"
          hitSlop={8}
          onPress={dismiss}
        >
          <X color={colors.muted} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

export const showChatSafetyBanner = () => AsyncStorage.removeItem(STORAGE_KEY);
