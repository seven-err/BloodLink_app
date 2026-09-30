import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Mic, Square } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

let activeVoiceInput: symbol | null = null;

type Props = {
  disabled?: boolean;
  onTranscript: (transcript: string) => void;
};

export function VoiceInputButton({ disabled = false, onTranscript }: Props) {
  const owner = useRef(Symbol('voice-input'));
  const onTranscriptRef = useRef(onTranscript);
  const receivedResult = useRef(false);
  const mounted = useRef(true);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    mounted.current = true;
    const inputOwner = owner.current;
    const startListener = ExpoSpeechRecognitionModule.addListener('start', () => {
      if (activeVoiceInput === inputOwner) {
        setStarting(false);
        setListening(true);
      }
    });
    const resultListener = ExpoSpeechRecognitionModule.addListener('result', (event) => {
      if (activeVoiceInput !== inputOwner || !event.isFinal || receivedResult.current) return;
      const transcript = event.results[0]?.transcript?.trim();
      if (transcript) {
        receivedResult.current = true;
        onTranscriptRef.current(transcript);
      }
    });
    const errorListener = ExpoSpeechRecognitionModule.addListener('error', (event) => {
      if (activeVoiceInput !== inputOwner) return;
      setError(event.error === 'no-speech' || event.error === 'speech-timeout'
        ? 'No speech was detected. Try again.'
        : event.error === 'not-allowed'
          ? 'Microphone or speech recognition permission was denied.'
          : event.message || 'Voice input failed. Try again.');
    });
    const endListener = ExpoSpeechRecognitionModule.addListener('end', () => {
      if (activeVoiceInput !== inputOwner) return;
      activeVoiceInput = null;
      setStarting(false);
      setListening(false);
    });

    return () => {
      mounted.current = false;
      if (activeVoiceInput === inputOwner) {
        activeVoiceInput = null;
        ExpoSpeechRecognitionModule.abort();
      }
      startListener.remove();
      resultListener.remove();
      errorListener.remove();
      endListener.remove();
    };
  }, []);

  useFocusEffect(useCallback(() => () => {
    if (activeVoiceInput === owner.current) {
      activeVoiceInput = null;
      ExpoSpeechRecognitionModule.abort();
      setStarting(false);
      setListening(false);
    }
  }, []));

  const toggle = async () => {
    if (activeVoiceInput === owner.current && listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (starting || disabled || activeVoiceInput) return;
    setError(null);
    receivedResult.current = false;
    activeVoiceInput = owner.current;
    setStarting(true);
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        throw new Error('Speech recognition is unavailable on this device or browser.');
      }
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!mounted.current || activeVoiceInput !== owner.current) return;
      if (!permission.granted) {
        throw new Error('Microphone or speech recognition permission was denied.');
      }
      ExpoSpeechRecognitionModule.start({
        lang: Intl.DateTimeFormat().resolvedOptions().locale || 'en-PH',
        interimResults: false,
        continuous: false,
      });
    } catch (cause) {
      if (activeVoiceInput === owner.current) activeVoiceInput = null;
      if (mounted.current) {
        setStarting(false);
        setListening(false);
        setError(cause instanceof Error ? cause.message : 'Voice input failed. Try again.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={listening ? 'Stop voice input' : 'Start voice input'}
        accessibilityHint="Recognized words are added to your draft. Review them before sending."
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || starting, busy: starting, selected: listening }}
        disabled={(disabled && !listening) || starting}
        onPress={() => void toggle()}
        style={[styles.button, listening && styles.listening, (disabled || starting) && styles.disabled]}
      >
        {listening ? <Square color={colors.primaryForeground} size={18} fill={colors.primaryForeground} /> : <Mic color={colors.primary} size={22} />}
      </Pressable>
      {listening || starting || error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.status, error && styles.error]}>
          {error || (starting ? 'Starting voice input…' : 'Listening… tap to stop')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 48, width: 48 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  disabled: { opacity: 0.5 },
  error: { color: colors.primary },
  listening: { backgroundColor: colors.primary, borderColor: colors.primary },
  status: {
    backgroundColor: colors.card,
    borderRadius: 6,
    bottom: 52,
    color: colors.muted,
    fontSize: 12,
    padding: 4,
    position: 'absolute',
    right: 0,
    textAlign: 'right',
    width: 180,
  },
});
