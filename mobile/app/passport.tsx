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

import { Screen } from '../components/Screen';
import { COLORS } from '../src/theme';
import { getFamilyHealthPassport } from '../src/api';

type FamilyMember = {
  person_id: number;
  name: string;
  type: 'adult' | 'child';
  completed: string[];
  due: string[];
  care_gaps: string[];
  screening_record_count: number;
  referrals: {
    id: number;
    specialty?: string;
    status: string;
    created_at?: string | null;
  }[];
};

export default function FamilyPassportScreen() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await getFamilyHealthPassport();
      setMembers(data.family || []);
    } catch (requestError: unknown) {
      console.error('Family health passport failed:', requestError);
      const detail = axios.isAxiosError<{ detail?: unknown }>(requestError)
        ? requestError.response?.data?.detail
        : undefined;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Unable to load your health passport. Please try again.'
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
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={23} color={COLORS.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Family Health Passport</Text>
            <Text style={styles.subtitle}>YOUR CONNECTED PREVENTION JOURNEY</Text>
          </View>
          <Pressable onPress={load} style={styles.refreshButton}>
            <MaterialCommunityIcons name="refresh" size={22} color={COLORS.teal} />
          </Pressable>
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introTitle}>One view of recorded care</Text>
          <Text style={styles.body}>
            Review saved assessments, follow-up, and known next steps for
            profiles linked to your account. Only connected records are shown;
            missing data does not prove a visit was missed.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.teal} style={styles.loader} />
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={load} style={styles.button}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        ) : members.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.memberTitle}>No profile linked yet</Text>
            <Text style={styles.body}>
              Complete an adult or child profile to start your passport.
            </Text>
          </View>
        ) : (
          members.map((member) => (
            <View key={member.person_id} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <View style={styles.memberIcon}>
                  <MaterialCommunityIcons
                    name={member.type === 'adult' ? 'account-heart-outline' : 'human-baby-changing-table'}
                    size={24}
                    color={COLORS.teal}
                  />
                </View>
                <View style={styles.memberNameWrap}>
                  <Text style={styles.memberTitle}>{member.name}</Text>
                  <Text style={styles.memberType}>
                    {member.type === 'adult' ? 'Adult health journey' : 'Child development journey'}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Completed and recorded</Text>
              {member.completed.length ? (
                member.completed.map((item) => (
                  <View key={item} style={styles.listRow}>
                    <MaterialCommunityIcons name="check-circle-outline" size={18} color={COLORS.success} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No completed screening records are connected yet.</Text>
              )}

              <Text style={styles.sectionTitle}>Available next steps</Text>
              {member.due.map((item) => (
                <View key={item} style={styles.listRow}>
                  <MaterialCommunityIcons name="circle-outline" size={18} color={COLORS.teal} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}

              {member.care_gaps.length ? (
                <>
                  <Text style={styles.sectionTitle}>Follow-up to close</Text>
                  {member.care_gaps.map((item) => (
                    <View key={item} style={styles.gapRow}>
                      <MaterialCommunityIcons name="arrow-right-circle-outline" size={18} color={COLORS.accent} />
                      <Text style={styles.listText}>{item}</Text>
                    </View>
                  ))}
                </>
              ) : null}

              <Text style={styles.recordCount}>
                {member.screening_record_count} screening record
                {member.screening_record_count === 1 ? '' : 's'} linked
              </Text>
            </View>
          ))
        )}

        <Text style={styles.disclaimer}>
          This passport summarizes recorded preventive care. It does not
          diagnose disease, calculate a family risk score, or replace clinician
          review. Cognitive screening remains unavailable until an approved
          instrument and authorization are in place.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 35, maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 17 },
  backButton: { width: 40, height: 42, justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  subtitle: { color: COLORS.teal, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 4 },
  refreshButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  introCard: { backgroundColor: '#E8F4F2', borderRadius: 15, padding: 16, marginBottom: 15 },
  introTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  body: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 7 },
  loader: { marginTop: 35 },
  stateCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  error: { color: COLORS.danger, fontSize: 13, lineHeight: 19 },
  button: { backgroundColor: COLORS.teal, borderRadius: 10, padding: 12, marginTop: 12, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  memberCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 15 },
  memberIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E7F4F2', alignItems: 'center', justifyContent: 'center' },
  memberNameWrap: { flex: 1 },
  memberTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  memberType: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  sectionTitle: { color: COLORS.teal, fontSize: 11, fontWeight: '900', marginTop: 12, marginBottom: 7 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
  gapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
  listText: { color: COLORS.text, flex: 1, fontSize: 12, lineHeight: 18 },
  emptyText: { color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  recordCount: { color: COLORS.muted, fontSize: 10, marginTop: 12 },
  disclaimer: { color: COLORS.muted, fontSize: 10, lineHeight: 16, marginTop: 7, textAlign: 'center' },
});
