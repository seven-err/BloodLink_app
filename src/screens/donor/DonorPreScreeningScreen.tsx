import { AlertCircle, Check, ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import {
  DONOR_PRE_SCREENING_QUESTIONS,
  DONOR_PRE_SCREENING_STEPS,
  formatPreScreeningAnswer,
  type DonorPreScreeningResponses,
  type PreScreeningAnswer,
} from '@/constants/donorPreScreening';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase/client';
import {
  getLatestOwnDonorPreScreening,
  submitDonorPreScreening,
} from '@/services/supabase/donorPreScreenings';

const REVIEW_STEP = DONOR_PRE_SCREENING_STEPS.length;

export function DonorPreScreeningScreen() {
  const navigation = useNavigation();
  const { profile, refreshProfile, session, updateProfileLocally } = useAuth();
  const { top } = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<DonorPreScreeningResponses>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTargetStep, setErrorTargetStep] = useState<number | null>(null);

  const isOnboarding = profile?.role === 'donor' && profile.onboarding_completed === false;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!session?.user.id) return;
      const { data } = await getLatestOwnDonorPreScreening(session.user.id);
      if (!active) return;
      if (data?.responses && typeof data.responses === 'object' && !Array.isArray(data.responses)) {
        setResponses((existing) => {
          if (Object.keys(existing).length > 0) return existing;
          return data.responses as DonorPreScreeningResponses;
        });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const progress = ((step + 1) / (REVIEW_STEP + 1)) * 100;
  const currentStep = DONOR_PRE_SCREENING_STEPS[step];

  const stepComplete = useMemo(() => {
    if (!currentStep) return true;
    return currentStep.questions.every((question) => {
      if (!responses[question.key]) return false;
      return !(
        responses[question.key] === 'yes' &&
        question.detailKey &&
        question.detailRequired &&
        !responses[question.detailKey]?.trim()
      );
    });
  }, [currentStep, responses]);

  const chooseAnswer = (key: string, value: PreScreeningAnswer, detailKey?: string) => {
    setResponses((current) => {
      const next = { ...current, [key]: value };
      if (value !== 'yes' && detailKey) delete next[detailKey];
      return next;
    });
    setError(null);
    setErrorTargetStep(null);
  };

  const continueForward = () => {
    if (!stepComplete && currentStep) {
      const missing = currentStep.questions.find((q) => {
        if (!responses[q.key]) return true;
        if (
          responses[q.key] === 'yes' &&
          q.detailKey &&
          q.detailRequired &&
          !responses[q.detailKey]?.trim()
        ) {
          return true;
        }
        return false;
      });

      if (missing) {
        if (
          responses[missing.key] === 'yes' &&
          missing.detailKey &&
          missing.detailRequired &&
          !responses[missing.detailKey]?.trim()
        ) {
          setError(`Please provide details for Question ${missing.number}.`);
        } else {
          setError(`Please answer Question ${missing.number} before continuing.`);
        }
      } else {
        setError('Answer every question and complete the required details before continuing.');
      }
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return;
    }

    setError(null);
    setErrorTargetStep(null);
    setStep((current) => Math.min(REVIEW_STEP, current + 1));
    scrollViewRef.current?.scrollTo({ animated: false, y: 0 });
  };

  const jumpToStep = (targetStep: number) => {
    setError(null);
    setErrorTargetStep(null);
    setStep(targetStep);
    scrollViewRef.current?.scrollTo({ animated: false, y: 0 });
  };

  const submit = async () => {
    if (saving) return;

    if (!acknowledged) {
      setError('Confirm the acknowledgement before submitting.');
      setErrorTargetStep(null);
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return;
    }

    const unanswered = DONOR_PRE_SCREENING_QUESTIONS.find((question) => !responses[question.key]);
    if (unanswered) {
      const stepIdx = DONOR_PRE_SCREENING_STEPS.findIndex((s) =>
        s.questions.some((q) => q.key === unanswered.key),
      );
      setError(`Question ${unanswered.number} still needs an answer (tap to fix).`);
      setErrorTargetStep(stepIdx >= 0 ? stepIdx : null);
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return;
    }

    const missingDetail = DONOR_PRE_SCREENING_QUESTIONS.find(
      (q) =>
        q.detailKey &&
        q.detailRequired &&
        responses[q.key] === 'yes' &&
        !responses[q.detailKey]?.trim(),
    );
    if (missingDetail) {
      const stepIdx = DONOR_PRE_SCREENING_STEPS.findIndex((s) =>
        s.questions.some((q) => q.key === missingDetail.key),
      );
      setError(`Question ${missingDetail.number} requires additional details (tap to fix).`);
      setErrorTargetStep(stepIdx >= 0 ? stepIdx : null);
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return;
    }

    // Construct a sanitized payload matching exact database expectations
    const cleanResponses: DonorPreScreeningResponses = {};
    for (const q of DONOR_PRE_SCREENING_QUESTIONS) {
      const val = responses[q.key];
      if (val) {
        cleanResponses[q.key] = val;
      }
      if (val === 'yes' && q.detailKey && responses[q.detailKey]?.trim()) {
        cleanResponses[q.detailKey] = responses[q.detailKey].trim();
      }
    }

    setSaving(true);
    setError(null);
    setErrorTargetStep(null);

    try {
      const { error: submitError } = await submitDonorPreScreening(cleanResponses);
      if (submitError) {
        setError(submitError.message || 'Unable to submit pre-screening. Please try again.');
        scrollViewRef.current?.scrollToEnd({ animated: true });
        setSaving(false);
        return;
      }

      // Immediate optimistic update of profile state so RootNavigator transitions instantly
      updateProfileLocally({ onboarding_completed: true });

      // Background sync to ensure remote DB and profile cache stay updated
      if (session?.user.id) {
        void supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', session.user.id);
      }
      void refreshProfile();

      setSubmitted(true);
      setSaving(false);

      if (!isOnboarding && navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      scrollViewRef.current?.scrollToEnd({ animated: true });
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.center}>
        <View style={styles.successIconCircle}>
          <Check color={colors.primaryForeground} size={36} strokeWidth={3} />
        </View>
        <Text style={styles.successTitle}>Pre-Screening Submitted!</Text>
        <Text style={styles.successSubtitle}>
          Thank you for completing your pre-screening questionnaire. Your responses have been
          securely recorded.
        </Text>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        <Text style={styles.helper}>Loading your donor dashboard…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: top + 8 }]}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          disabled={isOnboarding && step === 0}
          hitSlop={8}
          style={{ opacity: isOnboarding && step === 0 ? 0 : 1 }}
          onPress={() => (step > 0 ? jumpToStep(step - 1) : navigation.goBack())}
        >
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.headerTitle}>Donor Pre-Screening</Text>
          <Text style={styles.progressText}>
            Step {step + 1} of {REVIEW_STEP + 1}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step < REVIEW_STEP && currentStep ? (
          <>
            <View style={styles.intro}>
              <Text style={styles.title}>{currentStep.title}</Text>
              <Text style={styles.subtitle}>{currentStep.subtitle}</Text>
            </View>
            {currentStep.questions.map((question) => (
              <View key={question.key} style={styles.questionCard}>
                <Text style={styles.questionNumber}>QUESTION {question.number} OF 29</Text>
                <Text style={styles.questionText}>{question.prompt}</Text>
                <View style={styles.optionRow}>
                  {question.options?.map((option) => {
                    const selected = responses[question.key] === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        style={[styles.option, selected ? styles.optionSelected : null]}
                        onPress={() => chooseAnswer(question.key, option.value, question.detailKey)}
                      >
                        <Text
                          style={[styles.optionText, selected ? styles.optionTextSelected : null]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {responses[question.key] === 'yes' && question.detailKey ? (
                  <View style={{ gap: 7 }}>
                    <Text style={styles.detailLabel}>
                      {question.detailLabel}
                      {question.detailRequired ? ' *' : ''}
                    </Text>
                    <TextInput
                      multiline
                      placeholder={question.detailPlaceholder}
                      placeholderTextColor={colors.mutedLight}
                      style={styles.detailInput}
                      value={responses[question.detailKey] ?? ''}
                      onChangeText={(value) =>
                        setResponses((current) => ({ ...current, [question.detailKey!]: value }))
                      }
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </>
        ) : (
          <>
            <View style={styles.intro}>
              <Text style={styles.title}>Review & Submit</Text>
              <Text style={styles.subtitle}>
                Review your answers. You can go back to make changes before submitting.
              </Text>
            </View>
            {DONOR_PRE_SCREENING_STEPS.map((section, sectionIndex) => (
              <View key={section.title} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewTitle}>{section.title}</Text>
                  <Pressable onPress={() => jumpToStep(sectionIndex)}>
                    <Text style={styles.editLink}>Edit</Text>
                  </Pressable>
                </View>
                {section.questions.map((question) => {
                  const ans = responses[question.key];
                  const needsDetail =
                    ans === 'yes' &&
                    question.detailKey &&
                    question.detailRequired &&
                    !responses[question.detailKey]?.trim();
                  const isMissing = !ans || needsDetail;

                  return (
                    <View
                      key={question.key}
                      style={[styles.reviewRow, isMissing ? styles.reviewRowMissing : null]}
                    >
                      <Text
                        style={[
                          styles.reviewQuestion,
                          isMissing ? styles.reviewQuestionMissing : null,
                        ]}
                      >
                        {question.number}. {question.prompt}
                      </Text>
                      <Text
                        style={[styles.reviewAnswer, isMissing ? styles.reviewAnswerMissing : null]}
                      >
                        {!ans ? 'Not answered yet' : formatPreScreeningAnswer(ans)}
                      </Text>
                      {question.detailKey && responses[question.detailKey] ? (
                        <Text style={styles.reviewDetail}>{responses[question.detailKey]}</Text>
                      ) : null}
                      {needsDetail ? (
                        <Text style={styles.reviewMissingDetailText}>
                          Required details missing *
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledged }}
              style={styles.acknowledgement}
              onPress={() => setAcknowledged((current) => !current)}
            >
              <View style={[styles.checkbox, acknowledged ? styles.checkboxSelected : null]}>
                {acknowledged ? (
                  <Check color={colors.primaryForeground} size={15} strokeWidth={3} />
                ) : null}
              </View>
              <Text style={styles.acknowledgementText}>
                I confirm that the information I provided is accurate to the best of my knowledge. I
                understand that this pre-screening does not determine my final eligibility to donate
                blood. Final eligibility will be determined by authorized healthcare or blood-bank
                personnel.
              </Text>
            </Pressable>
            <View style={styles.disclaimer}>
              <ShieldCheck color={colors.info} size={20} />
              <Text style={styles.disclaimerText}>
                Submitting marks this questionnaire as Pre-Screening Completed only. It is not a
                medical clearance or approval to donate.
              </Text>
            </View>
          </>
        )}

        {error ? (
          <Pressable
            disabled={errorTargetStep === null}
            style={styles.errorContainer}
            onPress={() => {
              if (errorTargetStep !== null) {
                jumpToStep(errorTargetStep);
              }
            }}
          >
            <AlertCircle color={colors.primary} size={16} />
            <Text selectable style={styles.error}>
              {error}
            </Text>
          </Pressable>
        ) : null}

        <PrimaryButton
          loading={saving}
          title={step === REVIEW_STEP ? 'Submit Pre-Screening' : 'Continue'}
          onPress={step === REVIEW_STEP ? () => void submit() : continueForward}
        />
        {step > 0 ? (
          <PrimaryButton
            disabled={saving}
            title="Back"
            variant="secondary"
            onPress={() => jumpToStep(step - 1)}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  acknowledgement: {
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  acknowledgementText: {
    color: colors.foreground,
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  center: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 40,
  },
  detailInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.foreground,
    minHeight: 48,
    padding: 12,
    textAlignVertical: 'top',
  },
  detailLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
  },
  disclaimer: {
    alignItems: 'flex-start',
    backgroundColor: colors.infoSoft,
    borderRadius: radii.card,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  disclaimerText: {
    color: colors.foreground,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  editLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  error: {
    color: colors.primary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: '800',
  },
  helper: {
    color: colors.muted,
    fontSize: 14,
  },
  intro: {
    gap: 6,
  },
  option: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: colors.primaryForeground,
  },
  progressFill: {
    backgroundColor: colors.primary,
    height: '100%',
  },
  progressText: {
    color: colors.muted,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    backgroundColor: colors.border,
    height: 4,
  },
  questionCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  questionNumber: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  questionText: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
  },
  reviewAnswer: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewAnswerMissing: {
    color: colors.primary,
    fontStyle: 'italic',
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 2,
    padding: 16,
  },
  reviewDetail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  reviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  reviewMissingDetailText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  reviewQuestion: {
    color: colors.foreground,
    fontSize: 13,
    lineHeight: 19,
  },
  reviewQuestionMissing: {
    fontWeight: '700',
  },
  reviewRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 3,
    paddingVertical: 10,
  },
  reviewRowMissing: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  reviewTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '800',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  successIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    marginBottom: 8,
    width: 72,
  },
  successSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: 'center',
  },
  successTitle: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  title: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: '800',
  },
});
