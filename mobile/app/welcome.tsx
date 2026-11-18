
import React from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { COLORS } from '../src/theme';

export default function Welcome() {
  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>

          {/* VITABRIDGE BRAND */}
          <View style={styles.brand}>
            <View style={styles.logo}>
              <MaterialCommunityIcons
                name="brain"
                size={43}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.brandName}>VitaBridge</Text>

            <Text style={styles.mission}>
              PROTECTING BRAIN HEALTH EARLIER
            </Text>
          </View>

          {/* MAIN INTRODUCTION */}
          <View style={styles.intro}>
            <Text style={styles.heading}>
              A Healthier Brain Begins With Early Action.
            </Text>

            <Text style={styles.description}>
              Supporting healthy brain development in children
              and protecting cognitive wellbeing as we age
              through early identification, screening and prevention.
            </Text>
          </View>

          {/* CHILD HEALTH PATHWAY */}
          <View style={styles.pathwayCard}>
            <View style={styles.pathwayIconChild}>
              <MaterialCommunityIcons
                name="baby-face-outline"
                size={32}
                color={COLORS.teal}
              />
            </View>

            <View style={styles.pathwayContent}>
              <Text style={styles.pathwayTitle}>
                Early Brain Development
              </Text>

              <Text style={styles.ageLabel}>
                Children: 1 month – 6 years
              </Text>

              <Text style={styles.pathwayDescription}>
                Supporting healthy development, growth,
                developmental milestones and early identification
                of potential concerns.
              </Text>
            </View>
          </View>

          {/* ADULT HEALTH PATHWAY */}
          <View style={styles.pathwayCard}>
            <View style={styles.pathwayIconAdult}>
              <MaterialCommunityIcons
                name="brain"
                size={32}
                color={COLORS.blue}
              />
            </View>

            <View style={styles.pathwayContent}>
              <Text style={styles.pathwayTitle}>
                Brain Health & Healthy Ageing
              </Text>

              <Text style={styles.ageLabel}>
                Adults: 50 – 75 years
              </Text>

              <Text style={styles.pathwayDescription}>
                Supporting cognitive wellbeing, memory awareness,
                brain health screening and early identification
                of potential changes.
              </Text>
            </View>
          </View>

          {/* GET STARTED BUTTON */}
          <Link href="/onboarding" asChild>
            <Pressable
              style={styles.button}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>
                Start Your Health Journey
              </Text>

              <Text style={styles.buttonArrow}>→</Text>
            </Pressable>
          </Link>

          {/* FOOTER */}
          <View style={styles.footerContainer}>
            <Text style={styles.footer}>
              Early Awareness. Informed Action. Better Brain Health.
            </Text>

            <Text style={styles.disclaimer}>
              Screening supports early identification.
              It does not provide a medical diagnosis.
            </Text>
          </View>

        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({

  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingVertical: 28,
    backgroundColor: '#F4F8F8',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
  },

  // BRAND

  brand: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logo: {
    width: 87,
    height: 87,
    borderRadius: 25,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },

  brandName: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.blue,
    marginTop: 12,
    letterSpacing: -1,
  },

  mission: {
    color: COLORS.teal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 9,
  },

  // INTRODUCTION

  intro: {
    marginBottom: 25,
  },

  heading: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 35,
    textAlign: 'center',
  },

  description: {
    fontSize: 14,
    lineHeight: 23,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
  },

  // HEALTH PATHWAY CARDS

  pathwayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E7EEEE',
    elevation: 2,
  },

  pathwayIconChild: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#E5F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pathwayIconAdult: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#E9F0F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pathwayContent: {
    flex: 1,
    marginLeft: 14,
  },

  pathwayTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.blue,
  },

  ageLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.teal,
    marginTop: 5,
  },

  pathwayDescription: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
    marginTop: 6,
  },

  // BUTTON

  button: {
    backgroundColor: COLORS.teal,
    borderRadius: 15,
    paddingVertical: 17,
    paddingHorizontal: 20,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    marginLeft: 10,
    fontWeight: '700',
  },

  // FOOTER

  footerContainer: {
    marginTop: 25,
    alignItems: 'center',
  },

  footer: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 19,
  },

  disclaimer: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
  },

});
