import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Flag, Info, Send } from 'lucide-react-native';
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatSafetyBanner, showChatSafetyBanner } from '@/components/chat/ChatSafetyBanner';
import { ChatThreadSkeleton } from '@/components/chat/ChatThreadSkeleton';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { VoiceInputButton } from '@/components/chat/VoiceInputButton';
import { ConversationAvatar } from '@/components/messages/ConversationAvatar';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import type { AppStackParamList } from '@/navigation/types';
import { authStyles } from '@/screens/auth/styles';
import { chatStyles } from '@/screens/chat/styles';
import { recipientStyles } from '@/screens/recipient/styles';
import { getBloodRequestById } from '@/services/supabase/bloodRequests';
import {
  getConversationCounterpart,
  listMessages,
  markUnreadMessagesRead,
  sendMessage,
  verifyMessagingAuthorized,
  type AppMessage,
} from '@/services/supabase/messages';
import { subscribeToMessages } from '@/services/supabase/realtime';
import { BloodType } from '@/types/database';
import { appCache } from '@/utils/appCache';

type Props = NativeStackScreenProps<AppStackParamList, 'ChatThread'>;

type SendState = 'idle' | 'sending' | 'error';

const COMPOSER_SPACE = 88;
const KEYBOARD_COMPOSER_LIFT = 20;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export function ChatThreadScreen({ navigation, route }: Props) {
  const { bloodRequestId, donorMatchId, recipientDisplayName, recipientId } = route.params;
  const { session } = useAuth();
  const currentUserId = session?.user.id;
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  const cacheKeyMessages = `chat:messages:${bloodRequestId}:${donorMatchId}`;
  const cacheKeyDetails = `chat:request_details:${bloodRequestId}`;

  const cachedMessages = appCache.getSync<AppMessage[]>(cacheKeyMessages);
  const cachedDetails = appCache.getSync<{
    hospital_name: string;
    patient_name: string | null;
    blood_type: BloodType;
  }>(cacheKeyDetails);

  const [messages, setMessages] = useState<AppMessage[]>(() => cachedMessages ?? []);
  const [loading, setLoading] = useState(() => !cachedMessages);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [draft, setDraft] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [safetyBannerVisible, setSafetyBannerVisible] = useState(true);
  const [requestDetails, setRequestDetails] = useState<{
    hospital_name: string;
    patient_name: string | null;
    blood_type: BloodType;
  } | null>(() => cachedDetails ?? null);
  const [resolvedName, setResolvedName] = useState(
    () => recipientDisplayName?.trim() || '',
  );
  const [resolvedRecipientId, setResolvedRecipientId] = useState(recipientId);

  useEffect(() => {
    let active = true;

    void getConversationCounterpart(donorMatchId).then((counterpart) => {
      if (!active || !counterpart) {
        return;
      }

      setResolvedName(counterpart.displayName);
      setResolvedRecipientId(counterpart.otherPartyId);
    });

    return () => {
      active = false;
    };
  }, [donorMatchId]);

  useEffect(() => {
    const fetchRequestDetails = async () => {
      const { data, error: fetchError } = await getBloodRequestById(bloodRequestId);

      if (fetchError) {
        console.warn(`Could not fetch blood request details: ${fetchError.message}`);
      } else if (data) {
        setRequestDetails(data);
        appCache.setSync(cacheKeyDetails, data);
      }
    };

    void fetchRequestDetails();
  }, [bloodRequestId, cacheKeyDetails]);

  const listRef = useRef<FlatList<AppMessage>>(null);

  const conversationContext = useMemo(
    () => ({
      bloodRequestId,
      donorMatchId,
      recipientId: resolvedRecipientId,
    }),
    [bloodRequestId, donorMatchId, resolvedRecipientId],
  );

  const headerLabel = resolvedName.trim() || recipientDisplayName?.trim() || 'Conversation';
  const keyboardOpen = keyboardHeight > 0;
  const composerBottom = keyboardOpen ? keyboardHeight + KEYBOARD_COMPOSER_LIFT : 0;
  const composerPaddingBottom = keyboardOpen ? 12 : Math.max(bottomInset, 12);
  const scrollBottomInset = keyboardOpen
    ? COMPOSER_SPACE + keyboardHeight + KEYBOARD_COMPOSER_LIFT
    : COMPOSER_SPACE + bottomInset;

  const subtitleParts: string[] = [];
  if (requestDetails) {
    if (requestDetails.hospital_name) {
      subtitleParts.push(requestDetails.hospital_name);
    }
    if (requestDetails.patient_name && requestDetails.patient_name.trim() !== headerLabel) {
      subtitleParts.push(requestDetails.patient_name);
    }
    if (requestDetails.blood_type) {
      subtitleParts.push(`Blood Type: ${requestDetails.blood_type}`);
    }
  }

  const headerSubtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : 'Secure match chat';

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const loadMessages = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!currentUserId) {
        setError('You must be signed in to view messages.');
        setLoading(false);
        return;
      }

      if (!options?.silent && !appCache.getSync(cacheKeyMessages)) {
        setLoading(true);
      }

      setError(null);

      const authorization = await verifyMessagingAuthorized(conversationContext, currentUserId);

      if (authorization.kind === 'error') {
        setError(authorization.message);
        setLoading(false);
        return;
      }

      if (authorization.kind === 'unauthorized') {
        setAccessDenied(true);
        setError(authorization.message);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await listMessages(conversationContext);

      if (fetchError) {
        setError(fetchError.message);
      } else {
        const fresh = data ?? [];
        setMessages(fresh);
        appCache.setSync(cacheKeyMessages, fresh);
        scrollToBottom(false);
        void markUnreadMessagesRead(fresh, currentUserId);
      }

      setLoading(false);
    },
    [conversationContext, currentUserId, cacheKeyMessages, scrollToBottom],
  );

  useFocusEffect(
    useCallback(() => {
      void loadMessages();

      if (!currentUserId || accessDenied) {
        return undefined;
      }

      const subscription = subscribeToMessages({ bloodRequestId, donorMatchId }, () => {
        void loadMessages({ silent: true });
      });

      return () => {
        subscription.stop();
      };
    }, [accessDenied, bloodRequestId, currentUserId, donorMatchId, loadMessages]),
  );

  const handleSend = useCallback(async () => {
    if (!currentUserId || !draft.trim()) {
      return;
    }

    setSendState('sending');
    setSendError(null);

    const result = await sendMessage(currentUserId, resolvedRecipientId, draft, {
      bloodRequestId,
      donorMatchId,
    });

    if (result.kind === 'success') {
      setDraft('');
      setSendState('idle');
      setMessages((current) => {
        const next = [...current, result.message];
        appCache.setSync(cacheKeyMessages, next);
        return next;
      });
      appCache.invalidate(`conversations:${currentUserId}`);
      scrollToBottom();
      return;
    }

    setSendState('error');
    setSendError(result.message);
  }, [bloodRequestId, cacheKeyMessages, currentUserId, donorMatchId, draft, resolvedRecipientId, scrollToBottom]);

  const showSafetyBanner = useCallback(() => {
    void showChatSafetyBanner().then(() => {
      setSafetyBannerVisible(true);
      listRef.current?.scrollToOffset({ animated: true, offset: 0 });
    });
  }, []);

  if (loading) {
    return <ChatThreadSkeleton />;
  }

  if (error && (accessDenied || messages.length === 0)) {
    return (
      <View style={recipientStyles.centerContent}>
        <Text style={authStyles.error}>{error}</Text>
        {!accessDenied ? (
          <PrimaryButton title="Try again" onPress={() => void loadMessages()} />
        ) : null}
        <PrimaryButton title="Go back" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={chatStyles.screen}>
      <View style={[chatStyles.header, { paddingTop: topInset + 8 }]}>
        {navigation.canGoBack() ? (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft color={colors.foreground} size={22} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
        <ConversationAvatar initials={getInitials(headerLabel)} />
        <View style={chatStyles.headerCopy}>
          <Text numberOfLines={1} style={chatStyles.headerTitle}>
            {headerLabel}
          </Text>
          <Text style={chatStyles.headerSubtitle}>{headerSubtitle}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable
            accessibilityLabel="Report this conversation"
            accessibilityRole="button"
            style={chatStyles.headerInfoButton}
            onPress={() =>
              navigation.navigate('ReportSafety', {
                reportedUserId: resolvedRecipientId,
                reportedDisplayName: headerLabel,
                bloodRequestId,
                defaultType: 'user',
              })
            }
          >
            <Flag color={colors.warning} size={18} />
          </Pressable>
          {!safetyBannerVisible ? (
            <Pressable
              accessibilityLabel="Show secure chat notice"
              accessibilityRole="button"
              style={chatStyles.headerInfoButton}
              onPress={showSafetyBanner}
            >
              <Info color={colors.info} size={18} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        ref={listRef}
        contentContainerStyle={[chatStyles.chatContent, { paddingBottom: scrollBottomInset }]}
        data={messages}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={chatStyles.emptyHint}>
            No messages yet. Send a message to start coordinating with your matched contact.
          </Text>
        }
        ListHeaderComponent={
          <ChatSafetyBanner onVisibilityChange={setSafetyBannerVisible} />
        }
        onContentSizeChange={() => {
          if (messages.length > 0) {
            scrollToBottom(false);
          }
        }}
        renderItem={({ item }) => (
          <MessageBubble
            isOwnMessage={item.sender_id === currentUserId}
            message={item}
            showReadState
          />
        )}
        style={chatStyles.chatBody}
      />

      {error ? <Text style={[authStyles.error, chatStyles.inlineError]}>{error}</Text> : null}

      {!accessDenied ? (
        <View
          style={[
            chatStyles.composerDock,
            { bottom: composerBottom, paddingBottom: composerPaddingBottom },
          ]}
        >
          <View style={chatStyles.inputRow}>
            <TextInput
              editable={sendState !== 'sending'}
              multiline
              placeholder="Type a message…"
              placeholderTextColor={colors.muted}
              returnKeyType="send"
              style={chatStyles.input}
              value={draft}
              blurOnSubmit={false}
              onChangeText={setDraft}
              onSubmitEditing={() => void handleSend()}
            />
            <VoiceInputButton
              disabled={sendState === 'sending'}
              onTranscript={(transcript) => {
                setDraft((current) => `${current.trimEnd()}${current.trim() ? ' ' : ''}${transcript}`);
                setSendError(null);
              }}
            />
            <Pressable
              accessibilityLabel="Send message"
              accessibilityRole="button"
              disabled={!draft.trim() || sendState === 'sending'}
              style={[
                chatStyles.sendButton,
                !draft.trim() || sendState === 'sending' ? chatStyles.sendButtonDisabled : null,
              ]}
              onPress={() => void handleSend()}
            >
              <Send color={colors.primaryForeground} size={20} />
            </Pressable>
          </View>
          {sendError ? <Text style={authStyles.error}>{sendError}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
