
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { COLORS } from '../src/theme';

export default function Onboarding() {
  const selectPathway = (pathway: 'child' | 'adult') => {
    router.push(`/(auth)/login?pathway=${pathway}`);
  };

  const selectPractitioner = () => {
    router.push('/(auth)/login?pathway=practitioner');
  };

  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP NAVIGATION */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.replace('/welcome')}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color={COLORS.blue}
            />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.step}>01 / 03</Text>
        </View>

        {/* BRAND */}
        <View style={styles.brand}>
          <View style={styles.logo}>
            <MaterialCommunityIcons
              name="brain"
              size={35}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.brandName}>VitaBridge</Text>

          <Text style={styles.mission}>
            PROTECTING BRAIN HEALTH EARLIER
          </Text>
        </View>

        {/* INTRODUCTION */}
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>
            ONE CONNECTED HEALTH PLATFORM
          </Text>

          <Text style={styles.title}>
            Choose Your Health Pathway
          </Text>

          <Text style={styles.subtitle}>
            Personalised brain-health support across two
            important stages of life.
          </Text>
        </View>

        {/* CHILD HEALTH PATHWAY */}
        <Pressable
          onPress={() => selectPathway('child')}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Choose child health pathway"
        >
          <View style={styles.childVisual}>
            <View style={styles.childCircle}>
              <MaterialCommunityIcons
                name="baby-face-outline"
                size={67}
                color={COLORS.teal}
              />
            </View>

            <View style={styles.visualText}>
              <Text style={styles.visualEyebrow}>
                EARLY YEARS
              </Text>

              <Text style={styles.visualTitle}>
                Every milestone matters.
              </Text>

              <Text style={styles.visualSubtitle}>
                Nurturing healthy brain development.
              </Text>
            </View>

            <View style={styles.visualBadge}>
              <MaterialCommunityIcons
                name="heart-pulse"
                size={23}
                color={COLORS.teal}
              />
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  Child Health
                </Text>

                <Text style={styles.age}>
                  1 month – 6 years
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={30}
                color={COLORS.teal}
              />
            </View>

            <Text style={styles.description}>
              Support healthy brain development, growth,
              developmental milestones and early
              identification of potential concerns.
            </Text>

            <View style={styles.cardAction}>
              <Text style={styles.childAction}>
                Explore Child Health
              </Text>

              <MaterialCommunityIcons
                name="arrow-right"
                size={19}
                color={COLORS.teal}
              />
            </View>
          </View>
        </Pressable>

        {/* ADULT BRAIN HEALTH PATHWAY */}
        <Pressable
          onPress={() => selectPathway('adult')}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Choose adult brain health pathway"
        >
          <View style={styles.adultVisual}>
            <View style={styles.adultCircle}>
              <MaterialCommunityIcons
                name="brain"
                size={67}
                color={COLORS.blue}
              />
            </View>

            <View style={styles.visualText}>
              <Text style={styles.adultVisualEyebrow}>
                HEALTHY AGEING
              </Text>

              <Text style={styles.visualTitle}>
                Your brain health matters.
              </Text>

              <Text style={styles.visualSubtitle}>
                Supporting cognitive wellbeing.
              </Text>
            </View>

            <View style={styles.adultVisualBadge}>
              <MaterialCommunityIcons
                name="shield-check"
                size={23}
                color={COLORS.blue}
              />
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  Adult Brain Health
                </Text>

                <Text style={styles.adultAge}>
                  50 – 75 years
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={30}
                color={COLORS.blue}
              />
            </View>

            <Text style={styles.description}>
              Support cognitive wellbeing, memory awareness,
              brain-health screening and early identification
              of potential changes.
            </Text>

            <View style={styles.cardAction}>
              <Text style={styles.adultAction}>
                Explore Adult Health
              </Text>

              <MaterialCommunityIcons
                name="arrow-right"
                size={19}
                color={COLORS.blue}
              />
            </View>
          </View>
        </Pressable>

        {/* PRACTITIONER ACCESS */}
        <Pressable
          onPress={selectPractitioner}
          style={({ pressed }) => [
            styles.practitionerCard,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Practitioner login"
        >
          <View style={styles.practitionerIcon}>
            <MaterialCommunityIcons
              name="doctor"
              size={29}
              color={COLORS.blue}
            />
          </View>

          <View style={styles.practitionerContent}>
            <Text style={styles.practitionerTitle}>
              Practitioner Access
            </Text>

            <Text style={styles.practitionerDescription}>
              Healthcare professionals and authorised administrators.
            </Text>

            <View style={styles.practitionerActionRow}>
              <Text style={styles.practitionerAction}>
                Sign in to Practitioner Portal
              </Text>

              <MaterialCommunityIcons
                name="arrow-right"
                size={18}
                color={COLORS.teal}
              />
            </View>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={25}
            color={COLORS.blue}
          />
        </Pressable>

        {/* PRIVACY */}
        <View style={styles.privacy}>
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={25}
            color={COLORS.teal}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>
              Your privacy matters
            </Text>

            <Text style={styles.privacyText}>
              Your health information deserves appropriate
              consent, confidentiality and protection.
            </Text>
          </View>
        </View>

        {/* DISCLAIMER */}
        <Text style={styles.disclaimer}>
          Screening supports early identification.
          It does not provide a medical diagnosis.
        </Text>

        {/* FOOTER */}
        <Text style={styles.footer}>
          Early Awareness. Informed Action. Better Brain Health.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 35,
    backgroundColor: '#F2F7F7',
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  backText: {
    color: COLORS.blue,
    marginLeft: 7,
    fontWeight: '700',
  },

  step: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
  },

  brand: {
    alignItems: 'center',
    marginBottom: 25,
  },

  logo: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandName: {
    fontSize: 29,
    fontWeight: '900',
    color: COLORS.blue,
    marginTop: 8,
  },

  mission: {
    color: COLORS.teal,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 5,
  },

  intro: {
    marginBottom: 23,
  },

  eyebrow: {
    color: COLORS.teal,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    textAlign: 'center',
  },

  title: {
    fontSize: 27,
    fontWeight: '900',
    color: COLORS.blue,
    textAlign: 'center',
    marginTop: 10,
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    elevation: 3,
  },

  pressed: {
    opacity: 0.85,
  },

  childVisual: {
    minHeight: 170,
    backgroundColor: '#DDF1ED',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 17,
  },

  adultVisual: {
    minHeight: 170,
    backgroundColor: '#E4EDF6',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 17,
  },

  childCircle: {
    width: 105,
    height: 105,
    borderRadius: 53,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  adultCircle: {
    width: 105,
    height: 105,
    borderRadius: 53,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  visualText: {
    flex: 1,
    marginLeft: 14,
  },

  visualEyebrow: {
    color: COLORS.teal,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  adultVisualEyebrow: {
    color: COLORS.blue,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  visualTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    lineHeight: 24,
    marginTop: 7,
  },

  visualSubtitle: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.muted,
    marginTop: 6,
  },

  visualBadge: {
    position: 'absolute',
    right: 13,
    top: 13,
    width: 37,
    height: 37,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  adultVisualBadge: {
    position: 'absolute',
    right: 13,
    top: 13,
    width: 37,
    height: 37,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardBody: {
    padding: 19,
  },

  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardTitle: {
    color: COLORS.blue,
    fontSize: 20,
    fontWeight: '900',
  },

  age: {
    color: COLORS.teal,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 5,
  },

  adultAge: {
    color: COLORS.blue,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 5,
  },

  description: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 15,
  },

  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 17,
  },

  childAction: {
    color: COLORS.teal,
    fontSize: 13,
    fontWeight: '900',
    marginRight: 8,
  },

  adultAction: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '900',
    marginRight: 8,
  },

  /* PRACTITIONER ACCESS STYLES */

  practitionerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
    elevation: 2,
  },

  practitionerIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: '#E4EDF6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  practitionerContent: {
    flex: 1,
  },

  practitionerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.blue,
  },

  practitionerDescription: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 17,
    marginTop: 5,
  },

  practitionerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
    gap: 7,
  },

  practitionerAction: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.teal,
  },

  /* PRIVACY */

  privacy: {
    backgroundColor: '#E7F3F0',
    borderRadius: 15,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 3,
  },

  privacyTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 13,
  },

  privacyText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  disclaimer: {
    color: COLORS.muted,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 20,
  },

  footer: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
});
