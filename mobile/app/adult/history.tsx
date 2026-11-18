import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import axios from 'axios';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import { getAdultScreeningHistory } from '../../src/api';

type AdultAssessment = {
  id: string;
  assessment: string;
  title: string;
  completed_at?: string | null;
  responses: Record<string, unknown>;
  status?: string | null;
  clinical_score_generated?: boolean;
};

type HistoryResponse = {
  person_name: string;
  assessment_count: number;
  assessments: AdultAssessment[];
};

const RESPONSE_LABELS: Record<string, string> = {
  health_conditions: 'Health history',
  blood_pressure_history: 'Blood pressure',
  sleep_quality: 'Sleep quality',
  physical_activity: 'Physical activity',
  social_engagement: 'Social engagement',
  mood: 'Mood',
  memory_concerns: 'Memory concerns',
  additional_notes: 'Additional information',
  hearing_difficulty: 'Difficulty hearing conversations',
  hearing_environment: 'Difficulty hearing in background noise',
  hearing_aid: 'Hearing support',
  vision_difficulty: 'Difficulty seeing clearly',
  vision_reading: 'Difficulty reading',
  vision_support: 'Vision support',
};

function formatDate(value?: string | null): string {
  if (!value) return 'Completion date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Completion date not recorded';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Not provided';
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : 'None selected';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export default function AdultScreeningHistory() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getAdultScreeningHistory();
      setData(response.data);
    } catch (requestError: unknown) {
      console.error('Adult screening history error:', requestError);
      const detail = axios.isAxiosError<{ detail?: unknown }>(requestError)
        ? requestError.response?.data?.detail
        : undefined;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Unable to load your screening history. Please try again.'
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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={25}
              color={COLORS.text}
            />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Screening History</Text>
            <Text style={styles.headerSubtitle}>ADULT BRAIN HEALTH RECORDS</Text>
          </View>
          <Pressable
            onPress={loadHistory}
            style={styles.refreshButton}
            accessibilityRole="button"
            accessibilityLabel="Refresh screening history"
          >
            <MaterialCommunityIcons
              name="refresh"
              size={22}
              color={COLORS.teal}
            />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons
              name="clipboard-text-clock-outline"
              size={30}
              color={COLORS.teal}
            />
          </View>
          <Text style={styles.title}>
            {data?.person_name ? `${data.person_name}'s records` : 'Your assessments'}
          </Text>
          <Text style={styles.description}>
            Saved baseline and hearing and vision responses appear here.
            These records support awareness and are not a diagnosis.
          </Text>
          {data ? (
            <Text style={styles.countText}>
              {data.assessment_count} assessment
              {data.assessment_count === 1 ? '' : 's'} recorded
            </Text>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={COLORS.teal} />
            <Text style={styles.stateText}>Loading screening history...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={38}
              color={COLORS.danger}
            />
            <Text style={styles.stateTitle}>Unable to load history</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable style={styles.primaryButton} onPress={loadHistory}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : !data || data.assessments.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={42}
              color={COLORS.teal}
            />
            <Text style={styles.stateTitle}>No saved assessments yet</Text>
            <Text style={styles.stateText}>
              Your completed health baseline and hearing and vision
              responses will appear here.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/adult/screening')}
            >
              <Text style={styles.primaryButtonText}>Start an assessment</Text>
            </Pressable>
          </View>
        ) : (
          data.assessments.map((assessment) => (
            <View key={assessment.id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <View style={styles.recordIcon}>
                  <MaterialCommunityIcons
                    name="clipboard-check-outline"
                    size={24}
                    color={COLORS.teal}
                  />
                </View>
                <View style={styles.recordHeading}>
                  <Text style={styles.recordTitle}>{assessment.title}</Text>
                  <Text style={styles.recordDate}>
                    {formatDate(assessment.completed_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.responses}>
                {Object.entries(assessment.responses).map(([key, value]) => (
                  <View key={key} style={styles.answerRow}>
                    <Text style={styles.questionLabel}>
                      {RESPONSE_LABELS[key] || key.replaceAll('_', ' ')}
                    </Text>
                    <Text style={styles.answerValue}>{formatValue(value)}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.notice}>
                This record is informational and does not provide a clinical
                score or diagnosis.
              </Text>
            </View>
          ))
        )}

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.replace('/adult/dashboard')}
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
  headerText: { flex: 1 },
  headerTitle: { fontSize: 21, fontWeight: '800', color: COLORS.text },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: COLORS.teal,
    marginTop: 4,
  },
  refreshButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 20,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#E8F4F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.blue },
  description: { fontSize: 13, lineHeight: 20, color: COLORS.muted, marginTop: 8 },
  countText: { fontSize: 12, fontWeight: '800', color: COLORS.teal, marginTop: 12 },
  stateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
  },
  stateTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginTop: 12, textAlign: 'center' },
  stateText: { fontSize: 13, lineHeight: 20, color: COLORS.muted, marginTop: 9, textAlign: 'center' },
  recordCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginBottom: 13,
  },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  recordIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: '#E8F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordHeading: { flex: 1 },
  recordTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  recordDate: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  responses: { marginTop: 13, borderTopWidth: 1, borderTopColor: COLORS.border },
  answerRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  questionLabel: { fontSize: 12, lineHeight: 18, color: COLORS.text, textTransform: 'capitalize' },
  answerValue: { fontSize: 12, fontWeight: '800', color: COLORS.teal, marginTop: 5 },
  notice: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  secondaryButton: {
    minHeight: 48,
    backgroundColor: '#E8F4F2',
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: COLORS.teal, fontSize: 13, fontWeight: '800' },
});
