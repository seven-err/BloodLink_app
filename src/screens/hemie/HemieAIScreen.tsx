import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Info, RotateCcw, Send } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VoiceInputButton } from '@/components/chat/VoiceInputButton';
import { HemieAvatar } from '@/components/hemie/HemieAvatar';
import { HemieEmergencyDisclaimer } from '@/components/hemie/HemieEmergencyDisclaimer';
import { HemieMessageBubble } from '@/components/hemie/HemieMessageBubble';
import { SuggestedQuestionCard } from '@/components/hemie/SuggestedQuestionCard';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import type { AppStackParamList } from '@/navigation/types';
import { hemieStyles } from '@/screens/hemie/styles';
import {
  askHemie,
  HEMIE_UNAVAILABLE_MESSAGE,
  type HemieChatMessage,
} from '@/services/hemie/chat';
import { detectHemieActionIntent, resolveHemieAction, type HemieActionLink } from '@/services/hemie/actions';
import {
  getHemieWelcomeMessage,
  HEMIE_DISCLAIMER,
  HEMIE_SUGGESTED_QUESTIONS,
} from '@/utils/hemieResponses';

type Props = NativeStackScreenProps<AppStackParamList, 'HemieAI'>;

type ChatMessage = {
  id: string;
  isUser: boolean;
  text: string;
  local?: boolean;
  link?: HemieActionLink;
};

const DISCLAIMER_STORAGE_KEY = 'hemie_emergency_disclaimer_hidden';
const KEYBOARD_COMPOSER_LIFT = 20;
const MAX_MESSAGE_LENGTH = 2000;
const WELCOME_TEXT = getHemieWelcomeMessage();

let messageCounter = 0;
const createMessageId = () => `hemie-${Date.now()}-${messageCounter++}`;

const toApiMessages = (chatMessages: ChatMessage[]): HemieChatMessage[] =>
  chatMessages
    .slice(1)
    .filter((message) => !message.local)
    .map((message) => ({
      role: message.isUser ? 'user' : 'assistant',
      content: message.text,
    }));

export function HemieAIScreen({ navigation }: Props) {
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { profile, session } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const pendingRef = useRef(false);
  const requestIdRef = useRef(0);
  const conversationIdRef = useRef<string | null>(null);
  const [draft, setDraft] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [disclaimerVisible, setDisclaimerVisible] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: createMessageId(),
      isUser: false,
      text: WELCOME_TEXT,
    },
  ]);

  messagesRef.current = messages;

  useEffect(() => {
    void AsyncStorage.getItem(DISCLAIMER_STORAGE_KEY).then((value) => {
      if (value === 'true') {
        setDisclaimerVisible(false);
      }
    });
  }, []);

  const hideDisclaimer = useCallback(() => {
    setDisclaimerVisible(false);
    void AsyncStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
  }, []);

  const showDisclaimer = useCallback(() => {
    setDisclaimerVisible(true);
    void AsyncStorage.removeItem(DISCLAIMER_STORAGE_KEY);
    scrollRef.current?.scrollTo({ animated: true, y: 0 });
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    if (keyboardHeight > 0 || pending) {
      scrollToBottom();
    }
  }, [keyboardHeight, pending, scrollToBottom]);

  const startNewChat = useCallback(() => {
    requestIdRef.current += 1;
    pendingRef.current = false;
    messagesRef.current = [{ id: createMessageId(), isUser: false, text: WELCOME_TEXT }];
    conversationIdRef.current = null;
    setDraft('');
    setErrorText(null);
    setPending(false);
    setMessages(messagesRef.current);
  }, []);

  const appendExchange = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || pendingRef.current) {
        return;
      }

      if (trimmed.length > MAX_MESSAGE_LENGTH) {
        setErrorText(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
        return;
      }

      const accessToken = session?.access_token;
      if (!accessToken) {
        setErrorText('Sign in to chat with Hemie.');
        return;
      }

      const actionIntent = detectHemieActionIntent(trimmed);
      const userMessage: ChatMessage = {
        id: createMessageId(),
        isUser: true,
        text: trimmed,
        local: Boolean(actionIntent),
      };
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const history = toApiMessages(messagesRef.current);
      pendingRef.current = true;
      messagesRef.current = [...messagesRef.current, userMessage];

      setDraft('');
      setErrorText(null);
      setPending(true);
      setMessages(messagesRef.current);
      scrollToBottom();

      try {
        if (actionIntent) {
          const actionReply = await resolveHemieAction(actionIntent, trimmed, profile);
          if (requestId !== requestIdRef.current) return;
          messagesRef.current = [
            ...messagesRef.current,
            { id: createMessageId(), isUser: false, text: actionReply.message, local: true, link: actionReply.link },
          ];
          setMessages(messagesRef.current);
          return;
        }

        const result = await askHemie({
          accessToken,
          conversationId: conversationIdRef.current,
          history,
          message: trimmed,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        conversationIdRef.current = result.conversationId;
        messagesRef.current = [
          ...messagesRef.current,
          {
            id: createMessageId(),
            isUser: false,
            text: result.message,
          },
        ];
        setMessages(messagesRef.current);
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        const fallback =
          error instanceof Error && error.message
            ? error.message
            : HEMIE_UNAVAILABLE_MESSAGE;
        setErrorText(fallback);
      } finally {
        if (requestId === requestIdRef.current) {
          pendingRef.current = false;
          setPending(false);
          scrollToBottom();
        }
      }
    },
    [profile, scrollToBottom, session?.access_token],
  );

  const showSuggestedQuestions = messages.length === 1 && !pending;
  const keyboardOpen = keyboardHeight > 0;
  const composerPaddingBottom = keyboardOpen ? 12 : Math.max(bottomInset, 12);
  const canSend = Boolean(draft.trim()) && !pending;

  return (
    <View style={[hemieStyles.screen, keyboardOpen ? { paddingBottom: keyboardHeight + KEYBOARD_COMPOSER_LIFT } : null]}>
      <View style={[hemieStyles.header, { paddingTop: topInset + 8 }]}>
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
        <HemieAvatar size={52} />
        <View style={hemieStyles.headerCopy}>
          <Text accessibilityRole="header" style={hemieStyles.headerTitle}>
            Hemie
          </Text>
          <Text style={hemieStyles.headerSubtitle}>Your BloodLink Assistant</Text>
        </View>
        <Pressable
          accessibilityLabel="Start a new chat"
          accessibilityRole="button"
          hitSlop={8}
          style={hemieStyles.headerInfoButton}
          onPress={startNewChat}
        >
          <RotateCcw color={colors.foreground} size={18} />
        </Pressable>
        {!disclaimerVisible ? (
          <Pressable
            accessibilityLabel="Show disclaimer"
            accessibilityRole="button"
            style={hemieStyles.headerInfoButton}
            onPress={showDisclaimer}
          >
            <Info color={colors.muted} size={18} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={hemieStyles.chatContent}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={hemieStyles.chatBody}
        onContentSizeChange={() => {
          if (keyboardOpen || pending) {
            scrollToBottom();
          }
        }}
      >
        {disclaimerVisible ? <HemieEmergencyDisclaimer onDismiss={hideDisclaimer} /> : null}

        {showSuggestedQuestions ? (
          <View style={hemieStyles.suggestedSection}>
            <Text style={hemieStyles.suggestedLabel}>Try asking:</Text>
            <View style={hemieStyles.suggestedGrid}>
              {HEMIE_SUGGESTED_QUESTIONS.map((question) => (
                <SuggestedQuestionCard
                  key={question}
                  question={question}
                  onPress={() => {
                    void appendExchange(question);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        {messages.map((message) => (
          <HemieMessageBubble
            key={message.id}
            isUser={message.isUser}
            text={message.text}
            actionLabel={message.link?.label}
            onAction={message.link ? () => {
              if (message.link?.target === 'create_request') {
                navigation.navigate('CreateBloodRequest', message.link.bloodType ? { bloodType: message.link.bloodType } : undefined);
              } else if (message.link?.target === 'map') {
                navigation.navigate('AppTabs', { screen: 'Map' });
              } else if (message.link?.target === 'request_detail') {
                navigation.navigate('DonorRequestDetail', { requestId: message.link.requestId });
              } else if (message.link?.target === 'requests') {
                navigation.navigate('AppTabs', { screen: 'Requests' });
              }
            } : undefined}
          />
        ))}

        {errorText ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={hemieStyles.errorText}>
            {errorText}
          </Text>
        ) : null}

        {pending ? (
          <View style={hemieStyles.typingRow} accessibilityLiveRegion="polite">
            <HemieAvatar size={44} />
            <Text style={hemieStyles.typingText}>Hemie is typing...</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[hemieStyles.composerDock, { paddingBottom: composerPaddingBottom }]}>
        <View style={hemieStyles.footer}>
          <View style={hemieStyles.inputRow}>
            <TextInput
              accessibilityLabel="Type your message"
              editable={!pending}
              multiline
              placeholder="Type your message..."
              placeholderTextColor={colors.muted}
              returnKeyType="send"
              style={hemieStyles.input}
              value={draft}
              blurOnSubmit={false}
              onChangeText={(value) => {
                setDraft(value);
                if (errorText) {
                  setErrorText(null);
                }
              }}
              onFocus={scrollToBottom}
              onKeyPress={(event) => {
                if (Platform.OS !== 'web' || event.nativeEvent.key !== 'Enter') {
                  return;
                }

                const withShift = event.nativeEvent as { shiftKey?: boolean };
                if (withShift.shiftKey) {
                  return;
                }

                event.preventDefault?.();
                void appendExchange(draft);
              }}
              onSubmitEditing={() => {
                void appendExchange(draft);
              }}
            />
            <VoiceInputButton
              disabled={pending}
              onTranscript={(transcript) => {
                setDraft((current) => `${current.trimEnd()}${current.trim() ? ' ' : ''}${transcript}`);
                setErrorText(null);
              }}
            />
            <Pressable
              accessibilityLabel="Send message"
              accessibilityRole="button"
              disabled={!canSend}
              style={[hemieStyles.sendButton, !canSend ? hemieStyles.sendButtonDisabled : null]}
              onPress={() => {
                void appendExchange(draft);
              }}
            >
              <Send color={colors.primaryForeground} size={20} />
            </Pressable>
          </View>
          {disclaimerVisible ? null : (
            <Text style={hemieStyles.footerDisclaimer}>{HEMIE_DISCLAIMER}</Text>
          )}
        </View>
      </View>
    </View>
  );
}
