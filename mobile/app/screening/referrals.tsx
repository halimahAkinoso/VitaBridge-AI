
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import { getReferralTracking } from '../../src/api';

type Referral = {
  id: number;
  specialty: string;
  reason: string;
  status: string;
  created_at?: string;
};

export default function ReferralTrackingScreen() {
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getReferralTracking();
      setItems(response.data?.referrals || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Unable to load referrals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Referral Tracking</Text>
        <Text style={s.subtitle}>
          Follow the progress of referrals created after professional review.
        </Text>

        {loading ? <ActivityIndicator color={COLORS.teal} size="large" /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        {!loading && !error && items.length === 0 ? (
          <View style={s.card}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={35} color={COLORS.teal} />
            <Text style={s.heading}>No referrals yet</Text>
            <Text style={s.subtitle}>Any referrals made by the clinician will appear here.</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={s.card}>
            <View style={s.row}>
              <Text style={s.heading}>{item.specialty}</Text>
              <Text style={s.status}>{item.status.replace('_', ' ')}</Text>
            </View>
            <Text style={s.subtitle}>{item.reason}</Text>
            {item.created_at ? (
              <Text style={s.date}>
                Created: {new Date(item.created_at).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
        ))}

        <Pressable style={s.refresh} onPress={load}>
          <Text style={s.refreshText}>Refresh referral status</Text>
        </Pressable>
        <Text style={s.note}>
          Referral status is an administrative progress update and does not replace
          communication with the healthcare provider.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 18, paddingBottom: 35 },
  title: { fontSize: 25, fontWeight: '800', color: COLORS.text },
  subtitle: { color: COLORS.muted, lineHeight: 21, marginTop: 7 },
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 16, marginTop: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  heading: { color: COLORS.text, fontSize: 17, fontWeight: '800', marginTop: 8 },
  status: { color: COLORS.teal, fontWeight: '800', fontSize: 12 },
  date: { color: COLORS.muted, marginTop: 12, fontSize: 12 },
  refresh: { backgroundColor: COLORS.teal, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  refreshText: { color: '#fff', fontWeight: '800' },
  note: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 18 },
  error: { color: COLORS.danger, marginTop: 15 },
});
