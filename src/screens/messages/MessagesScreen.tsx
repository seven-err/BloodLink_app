import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HemieFloatingButton } from '@/components/hemie/HemieFloatingButton';
import { ConversationActionsSheet } from '@/components/messages/ConversationActionsSheet';
import { ConversationListItem } from '@/components/messages/ConversationListItem';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { Skeleton } from '@/components/common/Skeleton';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { AppTabParamList } from '@/navigation/AppTabNavigator';
import type { AppStackParamList } from '@/navigation/types';
import { messagesStyles } from '@/screens/messages/styles';
import {
  listConversations,
  setConversationState,
  type ConversationInboxStatus,
  type ConversationPreview,
} from '@/services/supabase/messages';

import { appCache } from '@/utils/appCache';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Chat'>,
  NativeStackScreenProps<AppStackParamList>
>;

function MessagesSkeleton({ topInset }: { topInset: number }) {
  return (
    <View style={messagesStyles.screen}>
      <View style={[messagesStyles.header, { paddingTop: topInset + 8 }]}>
        <Skeleton borderRadius={8} height={26} width={140} />
        <Skeleton borderRadius={16} height={46} width="100%" />
      </View>
      <View style={messagesStyles.skeletonList}>
        <View style={messagesStyles.skeletonRow}>
          <Skeleton borderRadius={24} height={48} width={48} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton borderRadius={8} height={16} width="55%" />
            <Skeleton borderRadius={8} height={14} width="80%" />
          </View>
        </View>
        {[0, 1, 2].map((index) => (
          <View key={index} style={messagesStyles.skeletonRow}>
            <Skeleton borderRadius={24} height={48} width={48} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton borderRadius={8} height={16} width="45%" />
              <Skeleton borderRadius={8} height={14} width="70%" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function MessagesScreen({ navigation }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const cachedConversations = userId
    ? appCache.getSync<ConversationPreview[]>(`conversations:${userId}`)
    : undefined;

  const [conversations, setConversations] = useState<ConversationPreview[]>(
    () => cachedConversations ?? [],
  );
  const [loading, setLoading] = useState(() => cachedConversations === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inboxFilter, setInboxFilter] = useState<ConversationInboxStatus>('active');
  const [selectedConversation, setSelectedConversation] = useState<ConversationPreview | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadConversations = useCallback(
    async (isRefresh = false, isSilent = false) => {
      if (!userId) {
        setError('You must be signed in to view messages.');
        setConversations([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else if (!isSilent && !appCache.getSync(`conversations:${userId}`)) {
        setLoading(true);
      }

      setError(null);

      const { data, error: loadError } = await listConversations(userId);

      if (loadError) {
        setError(loadError.message);
        if (!isSilent && !appCache.getSync(`conversations:${userId}`)) {
          setConversations([]);
        }
      } else {
        const fresh = data ?? [];
        setConversations(fresh);
        appCache.setSync(`conversations:${userId}`, fresh);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadConversations(false, true);
    }, [loadConversations]),
  );

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const status = conversation.inboxStatus ?? 'active';
      if (status !== inboxFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        conversation.displayName.toLowerCase().includes(query) ||
        conversation.lastMessageBody.toLowerCase().includes(query)
      );
    });
  }, [conversations, inboxFilter, searchQuery]);

  const openHemie = useCallback(() => {
    navigation.getParent()?.navigate('HemieAI');
  }, [navigation]);

  const openConversation = useCallback(
    (conversation: ConversationPreview) => {
      navigation.getParent()?.navigate('ChatThread', {
        bloodRequestId: conversation.bloodRequestId,
        donorMatchId: conversation.donorMatchId,
        recipientDisplayName: conversation.displayName,
        recipientId: conversation.otherPartyId,
      });
    },
    [navigation],
  );

  const applyConversationState = useCallback(
    async (status: 'active' | 'archived' | 'deleted') => {
      if (!selectedConversation || !userId) {
        return;
      }

      setActionLoading(true);
      setActionError(null);

      const { error: stateError } = await setConversationState(
        selectedConversation.donorMatchId,
        status,
      );

      setActionLoading(false);

      if (stateError) {
        setActionError(stateError.message);
        return;
      }

      setConversations((current) => {
        const next =
          status === 'deleted'
            ? current.filter((item) => item.donorMatchId !== selectedConversation.donorMatchId)
            : current.map((item) =>
                item.donorMatchId === selectedConversation.donorMatchId
                  ? {
                      ...item,
                      inboxStatus: status === 'archived' ? ('archived' as const) : ('active' as const),
                    }
                  : item,
              );
        appCache.setSync(`conversations:${userId}`, next);
        return next;
      });
      setConfirmDelete(false);
      setSelectedConversation(null);
    },
    [selectedConversation, userId],
  );

  if (loading) {
    return <MessagesSkeleton topInset={topInset} />;
  }

  return (
    <View style={messagesStyles.screen}>
      <View style={[messagesStyles.header, { paddingTop: topInset + 8 }]}>
        <Text style={messagesStyles.title}>Messages</Text>
        <View style={messagesStyles.searchBar}>
          <Search color={colors.muted} size={20} />
          <TextInput
            accessibilityLabel="Search conversations"
            placeholder="Search conversations..."
            placeholderTextColor={colors.muted}
            style={messagesStyles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={messagesStyles.filterRow}>
          {([
            ['active', 'Inbox'],
            ['archived', 'Archived'],
          ] as const).map(([key, label]) => {
            const selected = inboxFilter === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[messagesStyles.filterTab, selected ? messagesStyles.filterTabActive : null]}
                onPress={() => setInboxFilter(key)}
              >
                <Text
                  style={[
                    messagesStyles.filterLabel,
                    selected ? messagesStyles.filterLabelActive : null,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={messagesStyles.hint}>Long press a chat to archive or delete it.</Text>
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.donorMatchId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadConversations(true)} />
        }
        renderItem={({ item }) => (
          <ConversationListItem
            conversation={item}
            onLongPress={() => {
              setActionError(null);
              setSelectedConversation(item);
            }}
            onPress={() => openConversation(item)}
          />
        )}
        ListEmptyComponent={
          error ? (
            <View style={messagesStyles.emptyCard}>
              <Text style={messagesStyles.emptyText}>{error}</Text>
              <PrimaryButton title="Try again" onPress={() => void loadConversations()} />
            </View>
          ) : searchQuery.trim() ? (
            <View style={messagesStyles.emptyCard}>
              <Text style={messagesStyles.emptyText}>No conversations match your search.</Text>
            </View>
          ) : inboxFilter === 'archived' ? (
            <View style={messagesStyles.emptyCard}>
              <Text style={messagesStyles.emptyText}>No archived conversations.</Text>
            </View>
          ) : (
            <View style={messagesStyles.emptyCard}>
              <Text style={messagesStyles.emptyText}>
                No active conversations yet. Messaging is unlocked when a donor match is accepted for a blood request.
              </Text>
              <View style={{ marginTop: 14, width: '100%', gap: 10 }}>
                <PrimaryButton
                  title="Explore Blood Requests"
                  onPress={() => navigation.navigate('Requests')}
                />
              </View>
            </View>
          )
        }
        style={messagesStyles.list}
      />

      <HemieFloatingButton onPress={openHemie} />

      <ConversationActionsSheet
        archived={selectedConversation?.inboxStatus === 'archived'}
        displayName={selectedConversation?.displayName ?? 'Conversation'}
        error={confirmDelete ? null : actionError}
        visible={Boolean(selectedConversation) && !confirmDelete}
        onArchive={() =>
          void applyConversationState(
            selectedConversation?.inboxStatus === 'archived' ? 'active' : 'archived',
          )
        }
        onClose={() => setSelectedConversation(null)}
        onDelete={() => {
          setActionError(null);
          setConfirmDelete(true);
        }}
      />

      <ConfirmModal
        confirmDestructive
        confirmLabel="Delete"
        loading={actionLoading}
        message={
          actionError ??
          'This removes the conversation from your inbox. The other person can still see their copy.'
        }
        title={`Delete chat with ${selectedConversation?.displayName ?? 'this person'}?`}
        visible={confirmDelete}
        onCancel={() => {
          if (!actionLoading) {
            setConfirmDelete(false);
            setActionError(null);
          }
        }}
        onConfirm={() => void applyConversationState('deleted')}
      />
    </View>
  );
}
