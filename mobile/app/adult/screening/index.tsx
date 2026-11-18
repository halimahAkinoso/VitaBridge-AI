
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SHADOW } from '../../../src/theme';

export default function AdultScreeningIntro() {
  const steps = [
    {
      icon: 'heart-outline' as const,
      title: 'Brain health baseline',
      description: 'Share information about your general health and wellbeing.',
    },
    {
      icon: 'ear-outline' as const,
      title: 'Hearing and vision',
      description: 'Complete the hearing and vision screening questions.',
    },
    {
      icon: 'clipboard-outline' as const,
      title: 'Cognitive assessment',
      description: 'Complete an approved cognitive screening assessment when available.',
    },
    {
      icon: 'document-text-outline' as const,
      title: 'Screening summary',
      description: 'Review your responses and recommended next steps.',
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={COLORS.text} />
          <Text style={styles.backText}>Back to dashboard</Text>
        </Pressable>

        <View style={styles.iconCircle}>
          <Ionicons name="bulb-outline" size={48} color={COLORS.teal} />
        </View>

        <Text style={styles.eyebrow}>VITABRIDGE BRAIN HEALTH</Text>
        <Text style={styles.title}>Your Brain Health Journey</Text>

        <Text style={styles.description}>
          This preventive screening pathway helps you become more aware
          of factors that may affect your brain health and cognitive wellbeing.
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={23} color={COLORS.blue} />
            <Text style={styles.infoTitle}>What to expect</Text>
          </View>

          {steps.map((step, index) => (
            <View style={styles.step} key={step.title}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon} size={22} color={COLORS.teal} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>
                  {index + 1}. {step.title}
                </Text>
                <Text style={styles.stepDescription}>
                  {step.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={COLORS.success}
          />
          <Text style={styles.noticeText}>
            Screening is not a medical diagnosis and does not replace
            assessment by a qualified healthcare professional.
          </Text>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/adult/screening/baseline')}
        >
          <Text style={styles.primaryButtonText}>Begin Assessment</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.footer}>
          Protecting Brain Health Earlier
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    padding: 22,
    paddingBottom: 40,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 28,
    paddingVertical: 8,
  },
  backText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: '#DDF1EE',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 22,
  },
  eyebrow: {
    color: COLORS.teal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  title: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
  description: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 25,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 19,
    ...SHADOW,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 20,
  },
  infoTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginBottom: 19,
  },
  stepIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#EAF5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1 },
  stepTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#E7F2EC',
    borderRadius: 14,
    padding: 15,
    marginTop: 20,
  },
  noticeText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 19,
  },
  primaryButton: {
    backgroundColor: COLORS.teal,
    minHeight: 54,
    borderRadius: 14,
    marginTop: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
