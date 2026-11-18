
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SHADOW } from '../../../src/theme';
import { saveAdultHearingVision } from '../../../src/api';

type Answer = {
  id: string;
  question: string;
  options: string[];
};

const hearingQuestions: Answer[] = [
  {
    id: 'hearing_difficulty',
    question: 'Do you experience difficulty hearing conversations?',
    options: ['Never', 'Sometimes', 'Often', 'Always'],
  },
  {
    id: 'hearing_environment',
    question: 'Do you find it difficult to hear when there is background noise?',
    options: ['Never', 'Sometimes', 'Often', 'Always'],
  },
  {
    id: 'hearing_aid',
    question: 'Do you currently use a hearing aid or other hearing support?',
    options: ['Yes', 'No', 'Prefer not to say'],
  },
];

const visionQuestions: Answer[] = [
  {
    id: 'vision_difficulty',
    question: 'Do you experience difficulty seeing objects clearly?',
    options: ['Never', 'Sometimes', 'Often', 'Always'],
  },
  {
    id: 'vision_reading',
    question: 'Do you experience difficulty reading printed text?',
    options: ['Never', 'Sometimes', 'Often', 'Always'],
  },
  {
    id: 'vision_support',
    question: 'Do you currently use glasses or other vision support?',
    options: ['Yes', 'No', 'Prefer not to say'],
  },
];

export default function HearingVisionScreening() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [requiresSignIn, setRequiresSignIn] = useState(false);

  const allQuestions = useMemo(
    () => [...hearingQuestions, ...visionQuestions],
    []
  );

  const answeredCount = Object.keys(answers).length;
  const progress = answeredCount / allQuestions.length;
  const isComplete = answeredCount === allQuestions.length;

  const selectAnswer = (questionId: string, value: string) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  };

  const handleContinue = async () => {
    if (!isComplete) {
      setFeedback('Please answer all questions before continuing.');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setFeedback('');
    setRequiresSignIn(false);

    try {
      const payload = {
        responses: answers,
        completed_at: new Date().toISOString(),
      };

      await saveAdultHearingVision(payload);
      router.replace('/adult/results');
    } catch (error: unknown) {
      console.error('Adult hearing and vision save failed:', error);

      const requestError = axios.isAxiosError<{ detail?: unknown }>(error)
        ? error
        : null;
      const needsAuthentication =
        requestError?.response?.status === 401;
      const detail = requestError?.response?.data?.detail;

      setRequiresSignIn(needsAuthentication);
      setFeedback(
        needsAuthentication
          ? 'Your session is not authenticated. Sign in again before saving these responses.'
          : typeof detail === 'string'
            ? detail
            : 'We could not save your responses. Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (item: Answer, index: number) => (
    <View style={styles.questionCard} key={item.id}>
      <Text style={styles.questionNumber}>
        QUESTION {index + 1}
      </Text>

      <Text style={styles.questionText}>
        {item.question}
      </Text>

      <View style={styles.optionsContainer}>
        {item.options.map((option) => {
          const selected = answers[item.id] === option;

          return (
            <Pressable
              key={option}
              onPress={() => selectAnswer(item.id, option)}
              style={[
                styles.option,
                selected && styles.selectedOption,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <View
                style={[
                  styles.radioOuter,
                  selected && styles.radioOuterSelected,
                ]}
              >
                {selected && <View style={styles.radioInner} />}
              </View>

              <Text
                style={[
                  styles.optionText,
                  selected && styles.selectedOptionText,
                ]}
              >
                {option}
              </Text>

              {selected && (
                <Ionicons
                  name="checkmark-circle"
                  size={19}
                  color={COLORS.teal}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={21}
            color={COLORS.text}
          />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons
              name="ear-outline"
              size={30}
              color={COLORS.teal}
            />
          </View>

          <Text style={styles.eyebrow}>
            ADULT BRAIN HEALTH SCREENING
          </Text>

          <Text style={styles.title}>
            Hearing and Vision
          </Text>

          <Text style={styles.description}>
            Tell us about your hearing and vision experiences.
            Your answers help build a broader picture of factors
            relevant to brain health.
          </Text>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>
              Your progress
            </Text>

            <Text style={styles.progressCount}>
              {answeredCount} of {allQuestions.length} answered
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name="ear"
              size={22}
              color={COLORS.teal}
            />
          </View>

          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>Hearing</Text>
            <Text style={styles.sectionDescription}>
              Questions about your hearing experiences
            </Text>
          </View>
        </View>

        {hearingQuestions.map((item, index) =>
          renderQuestion(item, index)
        )}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name="eye-outline"
              size={23}
              color={COLORS.teal}
            />
          </View>

          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>Vision</Text>
            <Text style={styles.sectionDescription}>
              Questions about your vision experiences
            </Text>
          </View>
        </View>

        {visionQuestions.map((item, index) =>
          renderQuestion(
            item,
            index + hearingQuestions.length
          )
        )}

        <View style={styles.notice}>
          <Ionicons
            name="information-circle-outline"
            size={23}
            color={COLORS.blue}
          />

          <Text style={styles.noticeText}>
            This questionnaire records your experiences only.
            It does not test hearing or eyesight, diagnose a
            condition, or replace professional assessment.
            If you have concerns, speak with a qualified
            healthcare professional.
          </Text>
        </View>

        {feedback ? (
          <View
            style={styles.feedbackBox}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.feedbackText}>{feedback}</Text>
            {requiresSignIn ? (
              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: '/(auth)/login',
                    params: { pathway: 'adult' },
                  })
                }
              >
                <Text style={styles.signInText}>Sign in to continue</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={[
            styles.continueButton,
            (!isComplete || submitting) && styles.disabledButton,
          ]}
          onPress={handleContinue}
          disabled={!isComplete || submitting}
        >
          <Text style={styles.continueText}>
            {submitting ? 'Saving responses...' : 'Save and Continue'}
          </Text>

          <Ionicons
            name="arrow-forward"
            size={20}
            color="#FFFFFF"
          />
        </Pressable>

        <Text style={styles.footer}>
          VitaBridge — Protecting Brain Health Earlier
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 45,
    width: '100%',
    maxWidth: 750,
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 22,
    paddingVertical: 8,
  },
  backText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
  },
  headerIcon: {
    width: 75,
    height: 75,
    borderRadius: 22,
    backgroundColor: '#E2F2EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    color: COLORS.teal,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 9,
    textAlign: 'center',
  },
  description: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  progressCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 17,
    marginBottom: 27,
    ...SHADOW,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  progressCount: {
    color: COLORS.muted,
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 10,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: COLORS.teal,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 13,
    marginTop: 8,
  },
  sectionIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#E2F2EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionText: {
    flex: 1,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionDescription: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  questionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 17,
    marginBottom: 13,
    ...SHADOW,
  },
  questionNumber: {
    color: COLORS.teal,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 9,
  },
  questionText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 14,
  },
  optionsContainer: {
    gap: 9,
  },
  option: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  selectedOption: {
    borderColor: COLORS.teal,
    backgroundColor: '#EAF5F3',
  },
  radioOuter: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: COLORS.teal,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.teal,
  },
  optionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
  },
  selectedOptionText: {
    color: COLORS.teal,
    fontWeight: '700',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#E8F1F5',
    borderRadius: 14,
    padding: 15,
    marginTop: 12,
  },
  noticeText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 19,
  },
  feedbackBox: {
    backgroundColor: '#FCECEC',
    borderColor: '#E8B8B8',
    borderWidth: 1,
    borderRadius: 11,
    marginTop: 16,
    padding: 13,
  },
  feedbackText: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  signInText: {
    color: COLORS.teal,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 9,
    textDecorationLine: 'underline',
  },
  continueButton: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: COLORS.teal,
    marginTop: 23,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 11,
  },
  disabledButton: {
    opacity: 0.45,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 22,
  },
});
