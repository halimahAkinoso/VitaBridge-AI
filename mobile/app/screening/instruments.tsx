
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import { getScreeningInstruments } from '../../src/api';

type Instrument = {
  code: string;
  name: string;
  version: string;
  status: string;
  age_min_months: number | null;
  age_max_months: number | null;
  description: string;
  scoring_enabled: boolean;
  clinical_interpretation: boolean;
};

export default function InstrumentSelectionScreen() {
  const router = useRouter();

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInstruments();
  }, []);

  const loadInstruments = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await getScreeningInstruments();

      setInstruments(response.data?.instruments || []);
    } catch (err: any) {
      console.error(
        'Instrument loading error:',
        err?.response?.data || err
      );

      setError(
        'Unable to load screening instruments. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const startInstrument = (instrument: Instrument) => {
    if (instrument.status !== 'active_prototype') {
      Alert.alert(
        'Not yet available',
        'This instrument requires permission and approved materials before it can be used.'
      );
      return;
    }

    router.push('/screening/child');
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.muted}>Loading instruments...</Text>
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
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={COLORS.text}
            />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>
              Screening Instruments
            </Text>
            <Text style={styles.subtitle}>
              CHILD DEVELOPMENT SCREENING
            </Text>
          </View>
        </View>

        <View style={styles.introCard}>
          <MaterialCommunityIcons
            name="clipboard-check-outline"
            size={34}
            color={COLORS.teal}
          />
          <Text style={styles.introTitle}>
            Choose a screening instrument
          </Text>
          <Text style={styles.introText}>
            Select an available instrument for caregiver
            developmental observations.
          </Text>
        </View>

        {error !== '' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={loadInstruments}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        )}

        {instruments.map((instrument) => {
          const active =
            instrument.status === 'active_prototype';

          return (
            <View key={instrument.code} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconBox}>
                  <MaterialCommunityIcons
                    name="clipboard-text-outline"
                    size={27}
                    color={COLORS.teal}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.instrumentName}>
                    {instrument.name}
                  </Text>
                  <Text style={styles.version}>
                    Version: {instrument.version}
                  </Text>
                </View>
              </View>

              <Text style={styles.description}>
                {instrument.description}
              </Text>

              <View
                style={[
                  styles.status,
                  active ? styles.activeStatus : styles.pendingStatus,
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    active ? styles.activeDot : styles.pendingDot,
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    active
                      ? styles.activeText
                      : styles.pendingText,
                  ]}
                >
                  {active ? 'Available for prototype use' : 'Approval required'}
                </Text>
              </View>

              {active ? (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => startInstrument(instrument)}
                >
                  <Text style={styles.primaryButtonText}>
                    Start Screening
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color="#FFFFFF"
                  />
                </Pressable>
              ) : (
                <View style={styles.disabledButton}>
                  <Text style={styles.disabledText}>
                    Not yet available
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.notice}>
          <MaterialCommunityIcons
            name="information-outline"
            size={22}
            color={COLORS.teal}
          />
          <Text style={styles.noticeText}>
            The active VitaBridge questionnaire records caregiver
            observations. It is not a validated diagnostic instrument.
            Pending instruments will become available only after
            appropriate permissions and approvals.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    marginRight: 9,
  },
  heading: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: COLORS.teal,
    marginTop: 4,
  },
  introCard: {
    backgroundColor: '#E8F4F2',
    borderRadius: 16,
    padding: 19,
    marginBottom: 18,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.blue,
    marginTop: 10,
  },
  introText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    marginTop: 6,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: '#E8F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrumentName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  version: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 5,
  },
  description: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
    marginTop: 13,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 9,
    marginTop: 13,
  },
  activeStatus: { backgroundColor: '#E8F4F2' },
  pendingStatus: { backgroundColor: '#F3F0E9' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  activeDot: { backgroundColor: COLORS.success },
  pendingDot: { backgroundColor: COLORS.accent },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeText: { color: COLORS.success },
  pendingText: { color: '#8A682C' },
  primaryButton: {
    backgroundColor: COLORS.teal,
    minHeight: 48,
    borderRadius: 11,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  disabledButton: {
    backgroundColor: '#EEF1F1',
    minHeight: 45,
    borderRadius: 10,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: '#E8F4F2',
    borderRadius: 13,
    marginTop: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
    color: COLORS.text,
  },
  muted: {
    color: COLORS.muted,
    marginTop: 10,
  },
  errorCard: {
    backgroundColor: '#FCE8E8',
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
  },
  retry: {
    color: COLORS.blue,
    fontWeight: '800',
    marginTop: 10,
  },
});
