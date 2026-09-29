import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputKeyPressEvent,
  View,
} from 'react-native';

const DEFAULT_OTP_LENGTH = 6;

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  length?: number;
};

export function OtpInput({ value, onChange, error, length = DEFAULT_OTP_LENGTH }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');
  const activeIndex = Math.min(value.length, length - 1);

  const updateValue = (next: string) => {
    onChange(next.replace(/\D/g, '').slice(0, length));
  };

  const handleKeyPress = (event: TextInputKeyPressEvent) => {
    if (event.nativeEvent.key !== 'Backspace' || value.length === 0) {
      return;
    }

    updateValue(value.slice(0, -1));
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
        {digits.map((digit, index) => {
          const isActive = index === activeIndex && value.length < length;
          const isFilled = digit.trim().length > 0;

          return (
            <View
              key={index}
              style={[
                styles.box,
                isActive ? styles.boxActive : null,
                isFilled ? styles.boxFilled : null,
                error ? styles.boxError : null,
              ]}
            >
              <Text style={styles.digit}>{digit.trim()}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={inputRef}
        autoComplete="one-time-code"
        keyboardType="number-pad"
        maxLength={length}
        onChangeText={updateValue}
        onKeyPress={handleKeyPress}
        style={styles.hiddenInput}
        textContentType="oneTimeCode"
        value={value}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    height: 56,
    justifyContent: 'center',
    maxWidth: 52,
  },
  boxActive: {
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  boxError: {
    borderColor: '#94a3b8',
  },
  boxFilled: {
    borderColor: '#94a3b8',
  },
  digit: {
    color: '#202124',
    fontSize: 22,
    fontWeight: '700',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  hiddenInput: {
    height: 0,
    opacity: 0,
    position: 'absolute',
    width: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  wrap: {
    gap: 4,
  },
});
