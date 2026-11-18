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
import { getAdultResults } from '../../src/api';

type AdultResult = {
  available: boolean;
  status: string;
  risk: string;
  recommendation: string | null;
  reviewed_at: string | null;
  source: string | null;
  message: string;
};

export default function AdultResultsScreen() {
  const [result, setResult] = useState<AdultResult | null>(null);
  const [reportedContext, setReportedContext] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await getAdultResults();
      setResult(data.result);
      setReportedContext(data.reported_context || []);
    } catch (requestError: unknown) {
      console.error('Unable to load adult results:', requestError);
      const detail = axios.isAxiosError<{ detail?: unknown }>(requestError)
        ? requestError.response?.data?.detail
        : undefined;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Unable to load your results. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={23} color={COLORS.text} />
          </Pressable>
          <Text style={styles.title}>Your Results</Text>
          <Pressable
            onPress={load}
            style={styles.refreshButton}
            accessibilityRole="button"
            accessibilityLabel="Refresh results"
          >
            <MaterialCommunityIcons name="refresh" size={22} color={COLORS.teal} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.teal} style={styles.loader} />
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error} accessibilityRole="alert">{error}</Text>
            <Pressable onPress={load} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : result?.available ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>CLINICIAN-RECORDED RESULT</Text>
            <View style={styles.resultRow}>
              <View style={styles.resultBlock}>
                <Text style={styles.label}>Status</Text>
                <Text style={styles.status}>{result.status}</Text>
              </View>
              <View style={styles.resultBlock}>
                <Text style={styles.label}>Risk</Text>
                <Text style={styles.risk}>{result.risk.replaceAll('_', ' ')}</Text>
              </View>
            </View>
            {result.recommendation ? (
              <View style={styles.recommendation}>
                <Text style={styles.label}>Recommended next step</Text>
                <Text style={styles.recommendationText}>{result.recommendation}</Text>
              </View>
            ) : null}
            {reportedContext.length > 0 ? (
              <View style={styles.context}>
                <Text style={styles.label}>Context you reported</Text>
                <Text style={styles.contextText}>
                  {reportedContext.join(', ')}. These reports may help your clinician interpret the result, but they do not establish a cause.
                </Text>
              </View>
            ) : null}
            <Text style={styles.note}>{result.message}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.pendingIcon}>
              <MaterialCommunityIcons
                name="clipboard-clock-outline"
                size={30}
                color={COLORS.blue}
              />
            </View>
            <Text style={styles.pendingTitle}>Awaiting clinician review</Text>
            <Text style={styles.pendingText}>
              {result?.message || 'Your saved responses are waiting for clinician review.'}
            </Text>
            <Text style={styles.note}>
              VitaBridge does not generate WATCH or risk labels from self-reported answers.
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push('/ai-assistant')}
            style={styles.primaryButton}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Ask Nura to explain</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/adult/plan')}
            style={styles.secondaryButton}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>View my one-step plan</Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          Results and risk labels are entered by a clinician. They are not an AI diagnosis.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 36, maxWidth: 700, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: { width: 40, height: 42, justifyContent: 'center' },
  refreshButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: COLORS.text, fontSize: 21, fontWeight: '900' },
  loader: { marginTop: 35 },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  eyebrow: { color: COLORS.teal, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  resultRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  resultBlock: { flex: 1, borderRadius: 12, backgroundColor: '#F1F7F6', padding: 14 },
  label: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  status: { color: COLORS.blue, fontSize: 22, fontWeight: '900', marginTop: 6 },
  risk: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 8 },
  recommendation: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 16, paddingTop: 14 },
  recommendationText: { color: COLORS.text, fontSize: 14, lineHeight: 21, fontWeight: '700', marginTop: 5 },
  context: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 14, paddingTop: 13 },
  contextText: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  note: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 14 },
  pendingIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#E8F1F7', alignItems: 'center', justifyContent: 'center' },
  pendingTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 13 },
  pendingText: { color: COLORS.text, fontSize: 13, lineHeight: 20, marginTop: 7 },
  actions: { gap: 10, marginTop: 15 },
  primaryButton: { backgroundColor: COLORS.teal, minHeight: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  secondaryButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: COLORS.teal, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14 },
  secondaryButtonText: { color: COLORS.teal, fontSize: 13, fontWeight: '800' },
  error: { color: COLORS.danger, fontSize: 13, lineHeight: 19 },
  disclaimer: { color: COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 16 },
});
