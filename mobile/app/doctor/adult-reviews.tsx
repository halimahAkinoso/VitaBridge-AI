import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';
import { useFocusEffect } from 'expo-router';

import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import {
  getAdultClinicianQueue,
  submitAdultClinicalReview,
} from '../../src/api';

type AdultCase = {
  person_id: number;
  name: string;
  dob?: string | null;
  language?: string | null;
  baseline: Record<string, unknown>;
  hearing_vision: {
    responses?: Record<string, string>;
  };
  latest_review?: {
    decision: string;
    risk: string;
    next_action: string;
    created_at?: string | null;
  } | null;
};

const DECISIONS = ['MONITOR', 'FOLLOW_UP', 'REFER'] as const;
const RISK_LEVELS = ['NOT_ASSESSED', 'LOW', 'MODERATE', 'ELEVATED'] as const;

function responseSummary(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  return Array.isArray(value) ? value.join(', ') : String(value);
}

export default function AdultClinicalReviewsScreen() {
  const [cases, setCases] = useState<AdultCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [decision, setDecision] = useState<(typeof DECISIONS)[number]>('MONITOR');
  const [risk, setRisk] = useState<(typeof RISK_LEVELS)[number]>('NOT_ASSESSED');
  const [note, setNote] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setFeedback('');
      const { data } = await getAdultClinicianQueue();
      setCases(data.adults || []);
    } catch (requestError: unknown) {
      console.error('Unable to load adult clinician queue:', requestError);
      const detail = axios.isAxiosError<{ detail?: unknown }>(requestError)
        ? requestError.response?.data?.detail
        : undefined;
      setFeedback(
        typeof detail === 'string'
          ? detail
          : 'Unable to load adult reviews. Check clinician access and try again.'
      );
      setFeedbackIsError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openReview = (personId: number) => {
    setExpandedId(expandedId === personId ? null : personId);
    setDecision('MONITOR');
    setRisk('NOT_ASSESSED');
    setNote('');
    setNextAction('');
    setSpecialty('');
    setFeedback('');
  };

  const submitReview = async (item: AdultCase) => {
    if (saving) return;
    if (note.trim().length < 3 || nextAction.trim().length < 3) {
      setFeedback('Enter a review note and a clear next action.');
      setFeedbackIsError(true);
      return;
    }
    if (decision === 'REFER' && specialty.trim().length < 2) {
      setFeedback('Enter the specialty for this clinician-directed referral.');
      setFeedbackIsError(true);
      return;
    }

    try {
      setSaving(true);
      setFeedback('');
      await submitAdultClinicalReview(item.person_id, {
        decision,
        risk,
        note: note.trim(),
        next_action: nextAction.trim(),
        ...(decision === 'REFER' ? { referral_specialty: specialty.trim() } : {}),
      });
      setFeedback('Clinical review saved. Any referral was created from your decision.');
      setFeedbackIsError(false);
      setExpandedId(null);
      await load();
    } catch (requestError: unknown) {
      console.error('Unable to save adult clinical review:', requestError);
      const detail = axios.isAxiosError<{ detail?: unknown }>(requestError)
        ? requestError.response?.data?.detail
        : undefined;
      setFeedback(
        typeof detail === 'string'
          ? detail
          : 'Unable to save this review. Please try again.'
      );
      setFeedbackIsError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Adult Baseline Reviews</Text>
        <Text style={styles.subtitle}>
          Review self-reported context and document a clinician-directed next
          step. VitaBridge does not calculate cognitive scores or risk levels.
        </Text>

        {feedback ? (
          <Text
            style={[styles.feedback, feedbackIsError ? styles.error : styles.success]}
            accessibilityRole="alert"
          >
            {feedback}
          </Text>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.teal} style={styles.loader} />
        ) : cases.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>No adult assessments to review</Text>
            <Text style={styles.rowValue}>
              Submitted adult baseline and hearing/vision responses will appear here.
            </Text>
          </View>
        ) : (
          cases.map((item) => {
            const baseline = item.baseline || {};
            const sensory = item.hearing_vision?.responses || {};
            const expanded = expandedId === item.person_id;
            return (
              <View key={item.person_id} style={styles.card}>
                <View style={styles.personHeader}>
                  <View style={styles.personText}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.rowLabel}>
                      Preferred language: {item.language === 'ar' ? 'Arabic' : 'English'}
                    </Text>
                  </View>
                  {item.latest_review ? (
                    <Text style={styles.reviewStatus}>Reviewed</Text>
                  ) : (
                    <Text style={styles.pendingStatus}>Needs review</Text>
                  )}
                </View>

                <Text style={styles.section}>Health and wellbeing baseline</Text>
                <Text style={styles.rowValue}>
                  Conditions: {responseSummary(baseline.health_conditions)}
                </Text>
                <Text style={styles.rowValue}>
                  Blood pressure history: {responseSummary(baseline.blood_pressure_history)}
                </Text>
                <Text style={styles.rowValue}>
                  Sleep: {responseSummary(baseline.sleep_quality)}
                  {baseline.sleep_hours ? `, ${baseline.sleep_hours} hours` : ''}
                </Text>
                <Text style={styles.rowValue}>
                  Mood: {responseSummary(baseline.mood)}
                </Text>
                <Text style={styles.rowValue}>
                  Everyday activities: {responseSummary(baseline.everyday_function)}
                </Text>

                <Text style={styles.section}>Hearing and vision responses</Text>
                {Object.keys(sensory).length ? (
                  Object.entries(sensory).map(([key, value]) => (
                    <Text key={key} style={styles.rowValue}>
                      {key.replaceAll('_', ' ')}: {value}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.rowValue}>Not recorded</Text>
                )}

                {item.latest_review ? (
                  <View style={styles.priorReview}>
                    <Text style={styles.rowValue}>
                      Latest clinician decision: {item.latest_review.decision}
                    </Text>
                    <Text style={styles.rowValue}>
                      Clinician-assigned level: {item.latest_review.risk}
                    </Text>
                    <Text style={styles.rowValue}>
                      Recommendation: {item.latest_review.next_action}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  style={styles.reviewButton}
                  onPress={() => openReview(item.person_id)}
                  accessibilityRole="button"
                >
                  <Text style={styles.reviewButtonText}>
                    {expanded ? 'Close review form' : 'Record clinician review'}
                  </Text>
                </Pressable>

                {expanded ? (
                  <View style={styles.form}>
                    <Text style={styles.section}>Decision</Text>
                    <View style={styles.chips}>
                      {DECISIONS.map((choice) => (
                        <Pressable
                          key={choice}
                          onPress={() => setDecision(choice)}
                          style={[styles.chip, decision === choice && styles.chipSelected]}
                        >
                          <Text style={[styles.chipText, decision === choice && styles.chipTextSelected]}>
                            {choice.replace('_', ' ')}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.section}>Clinician-assigned risk level</Text>
                    <View style={styles.chips}>
                      {RISK_LEVELS.map((choice) => (
                        <Pressable
                          key={choice}
                          onPress={() => setRisk(choice)}
                          style={[styles.chip, risk === choice && styles.chipSelected]}
                        >
                          <Text style={[styles.chipText, risk === choice && styles.chipTextSelected]}>
                            {choice.replace('_', ' ')}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {decision === 'REFER' ? (
                      <TextInput
                        value={specialty}
                        onChangeText={setSpecialty}
                        placeholder="Referral specialty (required)"
                        placeholderTextColor={COLORS.muted}
                        style={styles.input}
                      />
                    ) : null}
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder="Clinician review note"
                      placeholderTextColor={COLORS.muted}
                      multiline
                      maxLength={2000}
                      style={[styles.input, styles.multiline]}
                    />
                    <TextInput
                      value={nextAction}
                      onChangeText={setNextAction}
                      placeholder="Recommended next action"
                      placeholderTextColor={COLORS.muted}
                      multiline
                      maxLength={255}
                      style={[styles.input, styles.multiline]}
                    />
                    <Text style={styles.helper}>
                      These decisions and risk labels are clinician-entered, not AI-generated.
                    </Text>
                    <Pressable
                      onPress={() => submitReview(item)}
                      disabled={saving}
                      style={[styles.submitButton, saving && styles.disabled]}
                    >
                      {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.submitButtonText}>Save review</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 35, maxWidth: 800, width: '100%', alignSelf: 'center' },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 15 },
  loader: { marginTop: 35 },
  feedback: { borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12, lineHeight: 18 },
  error: { color: COLORS.danger, backgroundColor: '#FCECEC' },
  success: { color: COLORS.success, backgroundColor: '#E8F5EF' },
  emptyCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 17, borderWidth: 1, borderColor: COLORS.border },
  card: { backgroundColor: COLORS.surface, borderRadius: 15, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  personHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  personText: { flex: 1 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  rowLabel: { color: COLORS.muted, fontSize: 10, marginTop: 5 },
  reviewStatus: { color: COLORS.success, fontSize: 10, fontWeight: '800' },
  pendingStatus: { color: COLORS.accent, fontSize: 10, fontWeight: '800' },
  section: { color: COLORS.teal, fontSize: 11, fontWeight: '900', marginTop: 13, marginBottom: 5 },
  rowValue: { color: COLORS.text, fontSize: 12, lineHeight: 18, marginTop: 3 },
  priorReview: { backgroundColor: '#F1F7F6', borderRadius: 10, padding: 11, marginTop: 10 },
  reviewButton: { backgroundColor: '#E7F4F2', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 13 },
  reviewButtonText: { color: COLORS.teal, fontSize: 12, fontWeight: '900' },
  form: { marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  chipSelected: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  chipText: { color: COLORS.text, fontSize: 10, fontWeight: '700' },
  chipTextSelected: { color: '#FFFFFF' },
  input: { minHeight: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 11, marginTop: 10, color: COLORS.text, backgroundColor: '#FFFFFF' },
  multiline: { minHeight: 75, textAlignVertical: 'top' },
  helper: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 9 },
  submitButton: { minHeight: 46, backgroundColor: COLORS.teal, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  submitButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});
