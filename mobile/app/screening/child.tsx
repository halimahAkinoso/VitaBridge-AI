
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import { getCurrentUser, childScreen } from '../../src/api';

type ChildProfile = {
  id?: number;
  name?: string;
  date_of_birth?: string;
  profile_type?: string;
};

type Answer = 'Yes' | 'Sometimes' | 'Not yet' | 'Not sure';

type Question = {
  id: string;
  domain: string;
  prompt: string;
};

const OPTIONS: Answer[] = [
  'Yes',
  'Sometimes',
  'Not yet',
  'Not sure',
];

const QUESTIONS: Question[] = [
  {
    id: 'social_1',
    domain: 'Social Language and Self-help',
    prompt: 'Does your child show interest in interacting with familiar people?',
  },
  {
    id: 'social_2',
    domain: 'Social Language and Self-help',
    prompt: 'Does your child communicate needs or preferences in a way you can recognise?',
  },
  {
    id: 'social_3',
    domain: 'Social Language and Self-help',
    prompt: 'Does your child participate in everyday activities appropriate to their current abilities?',
  },
  {
    id: 'language_1',
    domain: 'Expressive and Receptive Language',
    prompt: 'Does your child respond to familiar voices, sounds or communication?',
  },
  {
    id: 'language_2',
    domain: 'Expressive and Receptive Language',
    prompt: 'Does your child use sounds, gestures or words to communicate?',
  },
  {
    id: 'language_3',
    domain: 'Expressive and Receptive Language',
    prompt: 'Does your child appear to understand familiar words or simple communication?',
  },
  {
    id: 'gross_1',
    domain: 'Gross Motor',
    prompt: 'Does your child move their body in ways that support their everyday activities?',
  },
  {
    id: 'gross_2',
    domain: 'Gross Motor',
    prompt: 'Does your child show progress in the larger movements they are learning?',
  },
  {
    id: 'gross_3',
    domain: 'Gross Motor',
    prompt: 'Can your child participate in age-appropriate movement and play activities?',
  },
  {
    id: 'fine_1',
    domain: 'Fine Motor',
    prompt: 'Does your child use their hands to explore objects and their surroundings?',
  },
  {
    id: 'fine_2',
    domain: 'Fine Motor',
    prompt: 'Does your child show progress in handling or manipulating everyday objects?',
  },
  {
    id: 'fine_3',
    domain: 'Fine Motor',
    prompt: 'Does your child use hand movements during play or everyday activities?',
  },
];

const DOMAINS = [
  'Social Language and Self-help',
  'Expressive and Receptive Language',
  'Gross Motor',
  'Fine Motor',
];

function getAgeInMonths(value?: string): number | null {
  if (!value) return null;

  const dob = new Date(`${value}T00:00:00`);

  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();

  let months =
    (today.getFullYear() - dob.getFullYear()) * 12 +
    today.getMonth() -
    dob.getMonth();

  if (today.getDate() < dob.getDate()) months--;

  return months;
}

function formatAge(months: number): string {
  if (months < 12) return `${months} months`;

  const years = Math.floor(months / 12);
  const remaining = months % 12;

  return remaining
    ? `${years} years, ${remaining} months`
    : `${years} years`;
}

export default function ChildScreening() {
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [ageMonths, setAgeMonths] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState(false);

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [observations, setObservations] = useState('');
  const [currentDomain, setCurrentDomain] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const submissionIdRef = useRef<string | null>(null);
  const submissionInProgressRef = useRef(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await getCurrentUser();
      const profile = response.data?.profile;

      if (
        response.data?.profile_complete === true &&
        profile?.profile_type === 'child'
      ) {
        setChild(profile);
        setAgeMonths(getAgeInMonths(profile.date_of_birth));
      } else {
        setError('No completed child profile was found.');
      }
    } catch (err: any) {
      console.error(
        'Child screening profile error:',
        err?.response?.data || err
      );

      setError('Unable to retrieve child information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const eligible =
    ageMonths !== null &&
    ageMonths >= 1 &&
    ageMonths <= 72;

  const domainQuestions = QUESTIONS.filter(
    (question) => question.domain === DOMAINS[currentDomain]
  );

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = QUESTIONS.length;
  const allAnswered = answeredCount === totalQuestions;

  const selectAnswer = (id: string, answer: Answer) => {
    setSubmitMessage('');
    setSubmitError(false);
    if (answers[id] !== answer) {
      submissionIdRef.current = null;
    }
    setAnswers((previous) => ({
      ...previous,
      [id]: answer,
    }));
  };

  const submitScreening = async () => {
    if (submissionInProgressRef.current) return;

    if (!child || ageMonths === null || !eligible) {
      setSubmitError(true);
      setSubmitMessage(
        'Screening unavailable. The child must be aged 1–72 completed months.'
      );
      return;
    }

    if (!allAnswered) {
      setSubmitError(true);
      setSubmitMessage(
        `Please answer all ${totalQuestions} questions. You have answered ${answeredCount}.`
      );
      return;
    }

    submissionInProgressRef.current = true;
    const submissionId =
      submissionIdRef.current ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    submissionIdRef.current = submissionId;
    setSubmitting(true);
    setSubmitMessage('');

    try {
      const response = await childScreen({
        age_months: ageMonths,
        milestones: {},
        growth: {},
        answers,
        submission_id: submissionId,
        instrument_name: 'VitaBridge Developmental Surveillance',
        instrument_version: 'Prototype 1.0',
        notes: observations.trim(),
      });

      console.log('Screening submission response:', response.data);

      setSubmitError(false);
      setSubmitMessage(
        'Your responses have been saved successfully. You can return to your dashboard.'
      );
    } catch (err: any) {
      console.error(
        'Child screening submission error:',
        err?.response?.data || err
      );

      const detail = err?.response?.data?.detail;
      submissionInProgressRef.current = false;
      const message = Array.isArray(detail)
        ? detail.map((item: any) => item.msg || JSON.stringify(item)).join(' ')
        : typeof detail === 'string'
          ? detail
          : err?.message || 'Please check your connection and try again.';

      setSubmitError(true);
      setSubmitMessage(`Unable to save responses: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.muted}>Loading child information...</Text>
        </View>
      </Screen>
    );
  }

  if (error || !child || ageMonths === null) {
    return (
      <Screen>
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={42}
            color={COLORS.danger}
          />
          <Text style={styles.title}>Profile unavailable</Text>
          <Text style={styles.muted}>
            {error || 'Unable to calculate the child age.'}
          </Text>

          <Pressable style={styles.primaryButton} onPress={loadProfile}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!eligible) {
    return (
      <Screen>
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="information-outline"
            size={42}
            color={COLORS.danger}
          />
          <Text style={styles.title}>Outside the child pathway</Text>
          <Text style={styles.muted}>
            VitaBridge child developmental surveillance is restricted
            to children aged 1–72 completed months.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/child/dashboard')}
          >
            <Text style={styles.primaryButtonText}>Return to Dashboard</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={COLORS.text}
            />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              Child Development
            </Text>
            <Text style={styles.headerSubtitle}>
              VITABRIDGE DEVELOPMENTAL SURVEILLANCE
            </Text>
          </View>
        </View>

        <View style={styles.childCard}>
          <MaterialCommunityIcons
            name="baby-face-outline"
            size={34}
            color={COLORS.teal}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.childName}>{child.name}</Text>
            <Text style={styles.muted}>
              {formatAge(ageMonths)} old
            </Text>
          </View>

          <MaterialCommunityIcons
            name="shield-check-outline"
            size={25}
            color={COLORS.teal}
          />
        </View>

        <Text style={styles.title}>
          {reviewMode ? 'Review Your Responses' : 'Developmental Observations'}
        </Text>

        <Text style={styles.description}>
          Share your observations about your child's everyday development.
          Choose the response that best reflects what you have observed.
        </Text>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              Questionnaire progress
            </Text>
            <Text style={styles.progressValue}>
              {answeredCount}/{totalQuestions}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(answeredCount / totalQuestions) * 100}%` },
              ]}
            />
          </View>
        </View>

        {!reviewMode ? (
          <>
            <View style={styles.domainNavigation}>
              {DOMAINS.map((domain, index) => (
                <Pressable
                  key={domain}
                  onPress={() => setCurrentDomain(index)}
                  style={[
                    styles.domainTab,
                    currentDomain === index && styles.activeDomainTab,
                  ]}
                >
                  <Text
                    style={[
                      styles.domainTabText,
                      currentDomain === index && styles.activeDomainText,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.domainHeading}>
                {DOMAINS[currentDomain]}
              </Text>

              {domainQuestions.map((question, index) => (
                <View key={question.id} style={styles.question}>
                  <Text style={styles.questionNumber}>
                    Question {currentDomain * 3 + index + 1}
                  </Text>

                  <Text style={styles.questionText}>
                    {question.prompt}
                  </Text>

                  <View style={styles.options}>
                    {OPTIONS.map((option) => {
                      const selected = answers[question.id] === option;

                      return (
                        <Pressable
                          key={option}
                          onPress={() => selectAnswer(question.id, option)}
                          style={[
                            styles.option,
                            selected && styles.selectedOption,
                          ]}
                        >
                          <View
                            style={[
                              styles.radio,
                              selected && styles.selectedRadio,
                            ]}
                          />

                          <Text
                            style={[
                              styles.optionText,
                              selected && styles.selectedOptionText,
                            ]}
                          >
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>

            {currentDomain === DOMAINS.length - 1 && (
              <View style={styles.card}>
                <Text style={styles.domainHeading}>
                  Additional observations
                </Text>

                <Text style={styles.muted}>
                  Is there anything else you would like the healthcare
                  professional to know?
                </Text>

                <TextInput
                  value={observations}
                  onChangeText={(value) => {
                    setObservations(value);
                    submissionIdRef.current = null;
                  }}
                  multiline
                  maxLength={2000}
                  placeholder="Enter optional observations..."
                  placeholderTextColor={COLORS.muted}
                  style={styles.textInput}
                  textAlignVertical="top"
                />
              </View>
            )}

            <View style={styles.navigationButtons}>
              {currentDomain > 0 && (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setCurrentDomain((value) => value - 1)}
                >
                  <Text style={styles.secondaryButtonText}>Previous</Text>
                </Pressable>
              )}

              {currentDomain < DOMAINS.length - 1 ? (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => setCurrentDomain((value) => value + 1)}
                >
                  <Text style={styles.primaryButtonText}>
                    Continue
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color="#FFFFFF"
                  />
                </Pressable>
              ) : (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    if (!allAnswered) {
                      setSubmitError(true);
                      setSubmitMessage(
                        `Please answer all ${totalQuestions} questions before reviewing. You have answered ${answeredCount}.`
                      );
                      return;
                    }
                    setSubmitMessage('');
                    setReviewMode(true);
                  }}
                >
                  <Text style={styles.primaryButtonText}>
                    Review Responses
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color="#FFFFFF"
                  />
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <>
            {DOMAINS.map((domain) => (
              <View key={domain} style={styles.card}>
                <Text style={styles.domainHeading}>{domain}</Text>

                {QUESTIONS.filter((q) => q.domain === domain).map((q) => (
                  <View key={q.id} style={styles.reviewQuestion}>
                    <Text style={styles.questionText}>{q.prompt}</Text>
                    <Text style={styles.reviewAnswer}>
                      {answers[q.id]}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

            {observations.trim().length > 0 && (
              <View style={styles.card}>
                <Text style={styles.domainHeading}>
                  Additional observations
                </Text>
                <Text style={styles.muted}>{observations}</Text>
              </View>
            )}

            <View style={styles.notice}>
              <MaterialCommunityIcons
                name="information-outline"
                size={23}
                color={COLORS.teal}
              />
              <Text style={styles.noticeText}>
                These are caregiver observations, not a validated
                developmental assessment. Submission records the responses
                for professional review and does not produce a diagnosis.
              </Text>
            </View>

            {submitMessage !== '' && (
              <View
                style={[
                  styles.submitFeedback,
                  submitError
                    ? styles.submitFeedbackError
                    : styles.submitFeedbackSuccess,
                ]}
                accessibilityRole="alert"
              >
                <MaterialCommunityIcons
                  name={submitError ? 'alert-circle-outline' : 'check-circle-outline'}
                  size={21}
                  color={submitError ? COLORS.danger : COLORS.teal}
                />
                <Text
                  style={[
                    styles.submitFeedbackText,
                    submitError
                      ? styles.submitFeedbackErrorText
                      : styles.submitFeedbackSuccessText,
                  ]}
                >
                  {submitMessage}
                </Text>
              </View>
            )}

            {!submitError && submitMessage !== '' && (
              <>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.replace('/screening/history')}
                >
                  <Text style={styles.primaryButtonText}>View Screening History</Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color="#FFFFFF"
                  />
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => router.replace('/child/dashboard')}
                >
                  <Text style={styles.secondaryButtonText}>Return to Dashboard</Text>
                </Pressable>
              </>
            )}

            {submitMessage === '' && (
              <>
                <Pressable
                  style={styles.primaryButton}
                  onPress={submitScreening}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>
                        Submit Responses
                      </Text>
                      <MaterialCommunityIcons
                        name="check"
                        size={21}
                        color="#FFFFFF"
                      />
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setReviewMode(false)}
                  disabled={submitting}
                >
                  <Text style={styles.secondaryButtonText}>
                    Edit Responses
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 30,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  backButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: COLORS.teal,
    marginTop: 4,
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 22,
  },
  childName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.blue,
  },
  description: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.muted,
    marginTop: 8,
    marginBottom: 18,
  },
  muted: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
    marginTop: 5,
  },
  progressCard: {
    padding: 15,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 17,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.teal,
  },
  progressTrack: {
    height: 7,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: 7,
    backgroundColor: COLORS.teal,
    borderRadius: 5,
  },
  domainNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  domainTab: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDomainTab: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  domainTabText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  activeDomainText: {
    color: '#FFFFFF',
  },
  card: {
    padding: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  domainHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 15,
  },
  question: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  questionNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.teal,
    marginBottom: 7,
  },
  questionText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: COLORS.text,
  },
  options: {
    marginTop: 12,
    gap: 8,
  },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedOption: {
    backgroundColor: '#E8F4F2',
    borderColor: COLORS.teal,
  },
  radio: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.muted,
  },
  selectedRadio: {
    borderWidth: 5,
    borderColor: COLORS.teal,
  },
  optionText: {
    fontSize: 13,
    color: COLORS.text,
  },
  selectedOptionText: {
    fontWeight: '800',
    color: COLORS.teal,
  },
  textInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    padding: 13,
    marginTop: 12,
    color: COLORS.text,
    fontSize: 13,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  primaryButton: {
    minHeight: 52,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    backgroundColor: COLORS.teal,
    borderRadius: 13,
    padding: 14,
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F4F2',
    borderRadius: 12,
    paddingHorizontal: 18,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: COLORS.teal,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewQuestion: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reviewAnswer: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.teal,
    marginTop: 7,
  },
  submitFeedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  submitFeedbackError: {
    backgroundColor: '#FCE8E8',
  },
  submitFeedbackSuccess: {
    backgroundColor: '#E8F4F2',
  },
  submitFeedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  submitFeedbackErrorText: {
    color: COLORS.danger,
  },
  submitFeedbackSuccessText: {
    color: COLORS.teal,
  },
  notice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#E8F4F2',
    borderRadius: 13,
    padding: 14,
    marginVertical: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
    color: COLORS.text,
  },
});
