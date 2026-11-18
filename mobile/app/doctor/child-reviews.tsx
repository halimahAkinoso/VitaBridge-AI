
import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import {
  getChildClinicianQueue,
  reviewChildScreening,
} from '../../src/api';

type RecordItem = {
  id: number;
  person_name: string;
  age_months: number;
  status: string;
  risk: string;
  raw_answers?: {
    answers?: Record<string, string>;
    notes?: string;
    instrument_name?: string;
  };
  clinician_reviewed: boolean;
  created_at?: string;
};

type Decision = 'MONITOR' | 'FOLLOW_UP' | 'REFER';

export default function ChildReviewsScreen() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [decision, setDecision] = useState<Decision>('MONITOR');
  const [risk, setRisk] = useState<
    'NOT_ASSESSED' | 'FOLLOW_UP_RECOMMENDED' | 'URGENT_REVIEW'
  >('NOT_ASSESSED');
  const [note, setNote] = useState('');
  const [nextAction, setNextAction] = useState(
    'Continue routine developmental monitoring.'
  );
  const [specialty, setSpecialty] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getChildClinicianQueue();
      setRecords(response.data?.queue || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Unable to load review queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadQueue(); }, [loadQueue]));

  const submitReview = async () => {
    if (!selected || note.trim().length < 3 || nextAction.trim().length < 3) {
      Alert.alert('Complete review', 'Enter the clinician note and next action.');
      return;
    }
    if (decision === 'REFER' && !specialty.trim()) {
      Alert.alert('Referral required', 'Enter the referral specialty.');
      return;
    }

    try {
      setSaving(true);
      await reviewChildScreening(selected.id, {
        decision,
        clinician_note: note.trim(),
        next_action: nextAction.trim(),
        risk,
        ...(decision === 'REFER'
          ? { referral_specialty: specialty.trim() }
          : {}),
      });
      Alert.alert('Saved', 'The clinician review has been recorded.');
      setSelected(null);
      setNote('');
      setSpecialty('');
      await loadQueue();
    } catch (e: any) {
      Alert.alert(
        'Unable to save review',
        e?.response?.data?.detail || 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Screen><View style={s.center}>
      <ActivityIndicator color={COLORS.teal} size="large" />
      <Text style={s.muted}>Loading child review queue...</Text>
    </View></Screen>;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Child Screening Reviews</Text>
        <Text style={s.muted}>
          Review caregiver observations and record a professional follow-up.
        </Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {selected ? (
          <>
            <Pressable onPress={() => setSelected(null)} style={s.back}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.teal} />
              <Text style={s.link}>Back to queue</Text>
            </Pressable>

            <View style={s.card}>
              <Text style={s.heading}>{selected.person_name}</Text>
              <Text style={s.muted}>Age: {selected.age_months} months</Text>
              <Text style={s.section}>Caregiver responses</Text>
              {Object.entries(selected.raw_answers?.answers || {}).map(([key, value]) => (
                <View key={key} style={s.answerRow}>
                  <Text style={s.answerKey}>{key.replaceAll('_', ' ')}</Text>
                  <Text style={s.answerValue}>{value}</Text>
                </View>
              ))}
              {selected.raw_answers?.notes ? (
                <>
                  <Text style={s.section}>Additional observations</Text>
                  <Text style={s.body}>{selected.raw_answers.notes}</Text>
                </>
              ) : null}
            </View>

            <View style={s.card}>
              <Text style={s.section}>Clinician decision</Text>
              {(['MONITOR', 'FOLLOW_UP', 'REFER'] as Decision[]).map((item) => (
                <Pressable key={item} onPress={() => setDecision(item)}
                  style={[s.choice, decision === item && s.choiceActive]}>
                  <MaterialCommunityIcons
                    name={decision === item ? 'radiobox-marked' : 'radiobox-blank'}
                    size={21} color={COLORS.teal}
                  />
                  <Text style={s.body}>{item.replace('_', ' ')}</Text>
                </Pressable>
              ))}

              <Text style={s.label}>Review category</Text>
              {([
                ['NOT_ASSESSED', 'Not assessed'],
                ['FOLLOW_UP_RECOMMENDED', 'Follow-up recommended'],
                ['URGENT_REVIEW', 'Urgent review'],
              ] as const).map(([value, label]) => (
                <Pressable key={value} onPress={() => setRisk(value)}
                  style={[s.choice, risk === value && s.choiceActive]}>
                  <MaterialCommunityIcons
                    name={risk === value ? 'radiobox-marked' : 'radiobox-blank'}
                    size={21} color={COLORS.teal}
                  />
                  <Text style={s.body}>{label}</Text>
                </Pressable>
              ))}

              {decision === 'REFER' ? <>
                <Text style={s.label}>Referral specialty</Text>
                <TextInput value={specialty} onChangeText={setSpecialty}
                  placeholder="e.g. Paediatrics" style={s.input} />
              </> : null}

              <Text style={s.label}>Clinician note</Text>
              <TextInput value={note} onChangeText={setNote}
                multiline placeholder="Enter review observations..."
                style={[s.input, s.multiline]} />

              <Text style={s.label}>Recommended next action</Text>
              <TextInput value={nextAction} onChangeText={setNextAction}
                multiline style={[s.input, s.multiline]} />

              <Pressable disabled={saving} onPress={submitReview} style={s.primary}>
                {saving ? <ActivityIndicator color="#fff" /> :
                  <Text style={s.primaryText}>Save clinician review</Text>}
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={s.section}>Review queue ({records.length})</Text>
            {records.length === 0 ? (
              <View style={s.card}>
                <Text style={s.body}>No child screening records found.</Text>
              </View>
            ) : records.map((item) => (
              <Pressable key={item.id} style={s.card}
                onPress={() => {
                  setSelected(item);
                  setDecision('MONITOR');
                  setRisk('NOT_ASSESSED');
                  setNote('');
                  setSpecialty('');
                  setNextAction('Continue routine developmental monitoring.');
                }}>
                <View style={s.row}>
                  <Text style={s.heading}>{item.person_name}</Text>
                  <MaterialCommunityIcons name="chevron-right"
                    size={23} color={COLORS.teal} />
                </View>
                <Text style={s.muted}>
                  {item.age_months} months · {item.status}
                </Text>
                <Text style={s.link}>Open screening for review</Text>
              </Pressable>
            ))}
            <Pressable style={s.secondary} onPress={loadQueue}>
              <Text style={s.link}>Refresh queue</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 25, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  heading: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  section: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 18, marginBottom: 10 },
  muted: { color: COLORS.muted, marginTop: 5, lineHeight: 20 },
  body: { color: COLORS.text, lineHeight: 22 },
  card: { backgroundColor: COLORS.surface, borderRadius: 15, padding: 16, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  answerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  answerKey: { color: COLORS.muted, flex: 1, textTransform: 'capitalize' },
  answerValue: { color: COLORS.text, fontWeight: '700' },
  label: { color: COLORS.text, fontWeight: '700', marginTop: 15, marginBottom: 7 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, color: COLORS.text, backgroundColor: '#fff' },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 9, marginBottom: 6 },
  choiceActive: { backgroundColor: '#E8F4F2' },
  primary: { backgroundColor: COLORS.teal, padding: 15, borderRadius: 11, alignItems: 'center', marginTop: 20 },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: { padding: 14, alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15 },
  link: { color: COLORS.teal, fontWeight: '700', marginTop: 8 },
  error: { color: COLORS.danger, marginTop: 12 },
});
