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
import { getAdultActionPlan } from '../../src/api';

type PlanAction = {
  title: string;
  detail: string;
  source: string;
};

export default function AdultPlanScreen() {
  const [action, setAction] = useState<PlanAction | null>(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await getAdultActionPlan();
      setAction(data.actions?.[0] || null);
      setDisclaimer(data.disclaimer || '');
    } catch (requestError: unknown) {
      console.error('Unable to load adult action plan:', requestError);
      const detail = axios.isAxiosError<{ detail?: unknown }>(requestError)
        ? requestError.response?.data?.detail
        : undefined;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Unable to load your next step. Please try again.'
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
          <Text style={styles.title}>Your Plan</Text>
          <Pressable
            onPress={load}
            style={styles.refreshButton}
            accessibilityRole="button"
            accessibilityLabel="Refresh plan"
          >
            <MaterialCommunityIcons name="refresh" size={22} color={COLORS.teal} />
          </Pressable>
        </View>

        <Text style={styles.intro}>
          One clear next step, based on your saved information and clinician review.
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.teal} style={styles.loader} />
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error} accessibilityRole="alert">{error}</Text>
            <Pressable onPress={load} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : action ? (
          <View style={styles.card}>
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons name="arrow-right-circle" size={27} color={COLORS.teal} />
            </View>
            <Text style={styles.eyebrow}>YOUR ONE NEXT ACTION</Text>
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.actionDetail}>{action.detail}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.actionTitle}>No next step is available yet</Text>
          </View>
        )}

        <Pressable
          onPress={() => router.push('/ai-assistant')}
          style={styles.chatButton}
          accessibilityRole="button"
        >
          <Text style={styles.chatButtonText}>Ask Nura about this action</Text>
        </Pressable>

        {disclaimer ? <Text style={styles.disclaimer}>{disclaimer}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 36, maxWidth: 700, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backButton: { width: 40, height: 42, justifyContent: 'center' },
  refreshButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: COLORS.text, fontSize: 21, fontWeight: '900' },
  intro: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  loader: { marginTop: 35 },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  actionIcon: { width: 52, height: 52, borderRadius: 15, backgroundColor: '#E7F4F2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  eyebrow: { color: COLORS.teal, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  actionTitle: { color: COLORS.text, fontSize: 17, lineHeight: 23, fontWeight: '900', marginTop: 7 },
  actionDetail: { color: COLORS.text, fontSize: 14, lineHeight: 22, marginTop: 8 },
  primaryButton: { backgroundColor: COLORS.teal, minHeight: 46, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  chatButton: { backgroundColor: '#E7F4F2', minHeight: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 13 },
  chatButtonText: { color: COLORS.teal, fontSize: 13, fontWeight: '800' },
  error: { color: COLORS.danger, fontSize: 13, lineHeight: 19 },
  disclaimer: { color: COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 15 },
});
