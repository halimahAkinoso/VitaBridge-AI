import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import { getScreeningHistory } from '../../src/api';

type ScreeningRecord = {
  id: number;
  person_id: number;
  kind: string;
  visit_no: number | null;
  age_months: number | null;
  raw_answers?: {
    answers?: Record<string, string>;
    notes?: string | null;
    instrument_name?: string | null;
    instrument_version?: string | null;
  };
  status?: string;
  risk?: string;
  clinician_reviewed?: boolean;
  created_at?: string | null;
};

type HistoryResponse = {
  person_id: number;
  person_name: string;
  screening_count: number;
  history: ScreeningRecord[];
};

const QUESTION_LABELS: Record<string, string> = {
  social_1: 'Does your child show interest in interacting with familiar people?',
  social_2: 'Does your child communicate needs or preferences in a way you can recognise?',
  social_3: 'Does your child participate in everyday activities appropriate to their current abilities?',
  language_1: 'Does your child respond to familiar voices, sounds or communication?',
  language_2: 'Does your child use sounds, gestures or words to communicate?',
  language_3: 'Does your child appear to understand familiar words or simple communication?',
  gross_1: 'Does your child move their body in ways that support their everyday activities?',
  gross_2: 'Does your child show progress in the larger movements they are learning?',
  gross_3: 'Can your child participate in age-appropriate movement and play activities?',
  fine_1: 'Does your child use their hands to explore objects and their surroundings?',
  fine_2: 'Does your child show progress in handling or manipulating everyday objects?',
  fine_3: 'Does your child use hand movements during play or everyday activities?',
};

function formatDate(value?: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAge(months?: number | null): string {
  if (months === null || months === undefined) return 'Age unavailable';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  return remaining
    ? `${years} year${years === 1 ? '' : 's'}, ${remaining} month${remaining === 1 ? '' : 's'}`
    : `${years} year${years === 1 ? '' : 's'}`;
}

function formatStatus(status?: string): string {
  if (!status) return 'Pending professional review';
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ChildScreeningHistory() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getScreeningHistory();
      setData(response.data);
    } catch (err: any) {
      console.error('Screening history error:', err?.response?.data || err);
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : err?.message || 'Unable to load screening history. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={25} color={COLORS.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Screening History</Text>
            <Text style={styles.headerSubtitle}>CHILD DEVELOPMENT RECORDS</Text>
          </View>
          <Pressable onPress={loadHistory} style={styles.refreshButton}>
            <MaterialCommunityIcons name="refresh" size={22} color={COLORS.teal} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="clipboard-text-clock-outline" size={30} color={COLORS.teal} />
          </View>
          <Text style={styles.title}>Developmental observations</Text>
          <Text style={styles.description}>
            Review previously submitted caregiver observations. These records are
            not diagnostic assessments and remain subject to professional review.
          </Text>
          {data && (
            <Text style={styles.countText}>
              {data.screening_count} submission{data.screening_count === 1 ? '' : 's'} recorded
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={COLORS.teal} />
            <Text style={styles.stateText}>Loading screening history...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={38} color={COLORS.danger} />
            <Text style={styles.stateTitle}>Unable to load history</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable style={styles.primaryButton} onPress={loadHistory}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : !data || data.history.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={42} color={COLORS.teal} />
            <Text style={styles.stateTitle}>No submissions yet</Text>
            <Text style={styles.stateText}>
              Completed child developmental observation submissions will appear here.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/screening/child')}
            >
              <Text style={styles.primaryButtonText}>Start an observation</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {data.person_name ? `${data.person_name}'s records` : 'Previous submissions'}
            </Text>

            {data.history.map((record) => {
              const expanded = expandedId === record.id;
              const answers = record.raw_answers?.answers || {};
              const answerEntries = Object.entries(answers);

              return (
                <View key={record.id} style={styles.recordCard}>
                  <Pressable
                    style={styles.recordHeader}
                    onPress={() => setExpandedId(expanded ? null : record.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                  >
                    <View style={styles.recordIcon}>
                      <MaterialCommunityIcons name="clipboard-check-outline" size={24} color={COLORS.teal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordTitle}>Developmental observations</Text>
                      <Text style={styles.recordDate}>{formatDate(record.created_at)}</Text>
                      <Text style={styles.recordMeta}>
                        Age at submission: {formatAge(record.age_months ?? record.visit_no)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color={COLORS.muted}
                    />
                  </Pressable>

                  <View style={styles.statusRow}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>{formatStatus(record.status)}</Text>
                  </View>

                  {expanded && (
                    <View style={styles.details}>
                      <Text style={styles.detailHeading}>Recorded responses</Text>
                      {answerEntries.length === 0 ? (
                        <Text style={styles.detailText}>No individual responses were included in this record.</Text>
                      ) : (
                        answerEntries.map(([key, answer]) => (
                          <View key={key} style={styles.answerRow}>
                            <Text style={styles.questionLabel}>
                              {QUESTION_LABELS[key] || key.replaceAll('_', ' ')}
                            </Text>
                            <Text style={styles.answerValue}>{answer}</Text>
                          </View>
                        ))
                      )}

                      {!!record.raw_answers?.notes?.trim() && (
                        <View style={styles.notesBox}>
                          <Text style={styles.detailHeading}>Additional observations</Text>
                          <Text style={styles.detailText}>{record.raw_answers.notes}</Text>
                        </View>
                      )}

                      <View style={styles.reviewNotice}>
                        <MaterialCommunityIcons name="information-outline" size={19} color={COLORS.teal} />
                        <Text style={styles.reviewNoticeText}>
                          {record.clinician_reviewed
                            ? 'This record has been marked as reviewed by a clinician.'
                            : 'This record is awaiting review by an authorised healthcare professional.'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.replace('/child/dashboard')}
        >
          <Text style={styles.secondaryButtonText}>Return to Dashboard</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 42, height: 42, justifyContent: 'center', marginRight: 8 },
  headerTitle: { fontSize: 21, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7, color: COLORS.teal, marginTop: 4 },
  refreshButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  heroCard: { backgroundColor: COLORS.surface, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, padding: 18, marginBottom: 20 },
  heroIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#E8F4F2', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.blue },
  description: { fontSize: 13, lineHeight: 20, color: COLORS.muted, marginTop: 8 },
  countText: { fontSize: 12, fontWeight: '800', color: COLORS.teal, marginTop: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  stateCard: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 22, alignItems: 'center', marginBottom: 16 },
  stateTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginTop: 12, textAlign: 'center' },
  stateText: { fontSize: 13, lineHeight: 20, color: COLORS.muted, marginTop: 9, textAlign: 'center' },
  recordCard: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 15, marginBottom: 13 },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  recordIcon: { width: 45, height: 45, borderRadius: 13, backgroundColor: '#E8F4F2', alignItems: 'center', justifyContent: 'center' },
  recordTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  recordDate: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  recordMeta: { fontSize: 11, color: COLORS.teal, fontWeight: '700', marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  statusText: { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  details: { marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: COLORS.border },
  detailHeading: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 9 },
  answerRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  questionLabel: { fontSize: 12, lineHeight: 18, color: COLORS.text },
  answerValue: { fontSize: 12, fontWeight: '800', color: COLORS.teal, marginTop: 5 },
  notesBox: { backgroundColor: '#F0F6F5', borderRadius: 11, padding: 12, marginTop: 12 },
  detailText: { fontSize: 12, lineHeight: 19, color: COLORS.muted },
  reviewNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#E8F4F2', borderRadius: 10, padding: 11, marginTop: 12 },
  reviewNoticeText: { flex: 1, fontSize: 11, lineHeight: 17, color: COLORS.text },
  primaryButton: { minHeight: 48, backgroundColor: COLORS.teal, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  secondaryButton: { minHeight: 48, backgroundColor: '#E8F4F2', borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  secondaryButtonText: { color: COLORS.teal, fontSize: 13, fontWeight: '800' },
});
