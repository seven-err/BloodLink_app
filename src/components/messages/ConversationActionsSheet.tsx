import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';

type ConversationActionsSheetProps = {
  visible: boolean;
  displayName: string;
  archived: boolean;
  error?: string | null;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function ConversationActionsSheet({
  visible,
  displayName,
  archived,
  error,
  onArchive,
  onDelete,
  onClose,
}: ConversationActionsSheetProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{displayName}</Text>
          <Text style={styles.message}>Choose what to do with this conversation.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
            onPress={onArchive}
          >
            <Text style={styles.actionLabel}>{archived ? 'Unarchive' : 'Archive'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
            onPress={onDelete}
          >
            <Text style={styles.destructiveLabel}>Delete</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, styles.cancelAction, pressed ? styles.pressed : null]}
            onPress={onClose}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionLabel: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelAction: {
    backgroundColor: colors.background,
    borderWidth: 0,
  },
  cancelLabel: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 10,
    padding: 20,
    width: '100%',
    ...shadows.card,
  },
  destructiveLabel: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  message: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  scrim: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 28,
  },
  title: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '800',
  },
});
