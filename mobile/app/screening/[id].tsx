
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  getDoctorScreening,
  submitDoctorReview,
} from '../../src/api';
import { COLORS } from '../../src/theme';

const DECISIONS = [
  'Monitor',
  'Follow-up required',
  'Further assessment recommended',
  'Referral recommended',
];

export default function PractitionerScreeningReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const screeningId = Number(id);

  const queryClient = useQueryClient();

  const [decision, setDecision] = useState('Monitor');
  const [note, setNote] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['doctor-screening', screeningId],
    queryFn: async () => {
      const response = await getDoctorScreening(screeningId);
      return response.data;
    },
    enabled: Number.isInteger(screeningId) && screeningId > 0,
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      submitDoctorReview(screeningId, { decision, note }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['doctor-dashboard'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['doctor-screening', screeningId],
      });

      Alert.alert(
        'Review submitted',
        'The practitioner review has been recorded.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (error: any) => {
      Alert.alert(
        'Unable to save review',
        error?.response?.data?.detail ||
          'Please check your connection and try again.'
      );
    },
  });

  if (!Number.isInteger(screeningId) || screeningId < 1) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Invalid screening reference.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.muted}>Loading screening record...</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={42}
          color={COLORS.danger}
        />
        <Text style={styles.error}>Unable to load screening.</Text>
        <Pressable style={styles.primaryButton} onPress={() => refetch()}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const person = data.person;
  const screening = data.screening;
  const rawAnswers = screening.raw_answers || {};
  const answers = rawAnswers.answers || {};
  const observations = rawAnswers.notes || '';

  const displayValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'Not provided';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const formatLabel = (value: string) =>
    value.replace(/_/g, ' ').replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={22}
          color={COLORS.blue}
        />
        <Text style={styles.backText}>Back to Dashboard</Text>
      </Pressable>

      <Text style={styles.brand}>VitaBridge</Text>
      <Text style={styles.heading}>Screening Review</Text>
      <Text style={styles.subtitle}>
        Review submitted information and document your professional decision.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Patient Information</Text>

        <Text style={styles.patientName}>{person.name}</Text>

        <Text style={styles.detail}>
          Profile: {formatLabel(person.type || 'Unknown')}
        </Text>

        <Text style={styles.detail}>
          Date of birth: {person.date_of_birth || 'Not provided'}
        </Text>

        <Text style={styles.detail}>
          Sex: {person.sex || 'Not provided'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Screening Information</Text>

        <Text style={styles.detail}>
          Screening ID: {screeningId}
        </Text>

        <Text style={styles.detail}>
          Instrument: {rawAnswers.instrument_name || screening.kind}
        </Text>

        <Text style={styles.detail}>
          Version: {rawAnswers.instrument_version || 'Not specified'}
        </Text>

        <Text style={styles.detail}>
          Submission date:{' '}
          {screening.created_at
            ? new Date(screening.created_at).toLocaleString()
            : 'Unavailable'}
        </Text>

        <Text style={styles.detail}>
          Current status: {formatLabel(screening.status || 'Unknown')}
        </Text>

        <Text style={styles.detail}>
          Existing risk field: {formatLabel(screening.risk || 'Not assessed')}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recorded Responses</Text>

        {Object.keys(answers).length > 0 ? (
          Object.entries(answers).map(([question, answer]) => (
            <View key={question} style={styles.answerRow}>
              <Text style={styles.question}>
                {formatLabel(question)}
              </Text>
              <Text style={styles.answer}>
                {displayValue(answer)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>
            No individual questionnaire responses were supplied.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Additional Observations</Text>

        <Text style={styles.observation}>
          {observations || 'No additional observations recorded.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Practitioner Review</Text>

        <Text style={styles.label}>Review decision</Text>

        {DECISIONS.map((item) => (
          <Pressable
            key={item}
            onPress={() => setDecision(item)}
            style={[
              styles.decisionOption,
              decision === item && styles.selectedDecision,
            ]}
          >
            <MaterialCommunityIcons
              name={
                decision === item
                  ? 'radiobox-marked'
                  : 'radiobox-blank'
              }
              size={21}
              color={decision === item ? COLORS.teal : COLORS.muted}
            />

            <Text style={styles.decisionText}>{item}</Text>
          </Pressable>
        ))}

        <Text style={styles.label}>Professional notes</Text>

        <TextInput
          style={styles.notesInput}
          value={note}
          onChangeText={setNote}
          placeholder="Enter review notes and recommended next steps..."
          placeholderTextColor={COLORS.muted}
          multiline
          textAlignVertical="top"
          maxLength={2000}
        />

        <Text style={styles.characterCount}>
          {note.length}/2000 characters
        </Text>

        <Pressable
          style={[
            styles.primaryButton,
            reviewMutation.isPending && styles.disabled,
          ]}
          disabled={reviewMutation.isPending}
          onPress={() => {
            if (!note.trim()) {
              Alert.alert(
                'Review notes required',
                'Please enter professional notes before submitting.'
              );
              return;
            }

            Alert.alert(
              'Confirm review',
              'Submit this practitioner review?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Submit',
                  onPress: () => reviewMutation.mutate(),
                },
              ]
            );
          }}
        >
          {reviewMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.buttonText}>Submit Review</Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>
        Screening responses are reported observations, not a diagnosis.
        Practitioner decisions must be based on appropriate professional
        assessment and approved clinical protocols.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    minHeight: 400,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
    backgroundColor: COLORS.background,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 7,
  },
  backText: {
    color: COLORS.blue,
    fontWeight: '700',
  },
  brand: {
    color: COLORS.teal,
    fontWeight: '900',
    fontSize: 17,
  },
  heading: {
    fontSize: 25,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: 5,
  },
  subtitle: {
    color: COLORS.muted,
    lineHeight: 21,
    marginTop: 7,
    marginBottom: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 17,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 14,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.blue,
    marginBottom: 8,
  },
  detail: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 8,
    lineHeight: 19,
  },
  answerRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
  },
  question: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  answer: {
    color: COLORS.teal,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 6,
  },
  observation: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 21,
  },
  muted: {
    color: COLORS.muted,
    marginTop: 10,
  },
  error: {
    color: COLORS.danger,
    fontWeight: '700',
    marginVertical: 12,
  },
  label: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 10,
  },
  decisionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  selectedDecision: {
    backgroundColor: '#E7F3F0',
    borderColor: COLORS.teal,
  },
  decisionText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 125,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    padding: 12,
    fontSize: 13,
  },
  characterCount: {
    textAlign: 'right',
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: COLORS.teal,
    minHeight: 52,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
  disclaimer: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
});
