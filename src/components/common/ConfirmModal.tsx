import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDestructive?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  visible,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmDestructive = false,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => {
        if (!loading) {
          onCancel();
        }
      }}
    >
      <View style={styles.scrim}>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          style={StyleSheet.absoluteFill}
          onPress={loading ? undefined : onCancel}
        />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                (pressed || loading) && styles.pressed,
              ]}
              onPress={onCancel}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              style={({ pressed }) => [
                styles.button,
                confirmDestructive ? styles.destructiveButton : styles.confirmButton,
                (pressed || loading) && styles.pressed,
              ]}
              onPress={onConfirm}
            >
              <Text
                style={
                  confirmDestructive ? styles.destructiveLabel : styles.confirmLabel
                }
              >
                {loading ? `${confirmLabel}…` : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
  },
  cancelLabel: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 10,
    maxWidth: 360,
    padding: 20,
    width: '100%',
    ...shadows.card,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmLabel: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: '700',
  },
  destructiveButton: {
    backgroundColor: colors.primarySoft,
  },
  destructiveLabel: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  pressed: {
    opacity: 0.75,
  },
  scrim: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '800',
  },
});
