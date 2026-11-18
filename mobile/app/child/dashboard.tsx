
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import { getCurrentUser } from '../../src/api';

type ChildProfileData = {
  name?: string;
  date_of_birth?: string;
  sex?: string;
  guardian_name?: string;
  relationship?: string;
  phone?: string;
};

export default function ParentDashboard() {
  const [child, setChild] = useState<ChildProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const loadChildProfile = useCallback(async () => {
    try {
      setLoading(true);
      setProfileError('');

      const response = await getCurrentUser();
      const profile = response.data?.profile;

      if (
        response.data?.profile_complete === true &&
        profile &&
        profile.profile_type === 'child'
      ) {
        setChild(profile);
      } else {
        setChild(null);
        setProfileError(
          'Child profile information is not available.'
        );
      }
    } catch (error: any) {
      console.error(
        'Unable to load child profile:',
        error?.response?.data || error
      );

      setProfileError(
        'Unable to load your child profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChildProfile();
    }, [loadChildProfile])
  );

  const openChildProfile = () => {
    router.push('/child/profile');
  };

  // UPDATED: Open instrument selection before starting screening
  const openDevelopmentTracking = () => {
    router.push('/screening/instruments');
  };

  const openScreeningHistory = () => {
    router.push('/screening/history');
  };

  const formatDate = (date?: string) => {
    if (!date) return 'Not available';

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.logo}>
          <MaterialCommunityIcons
            name="brain"
            size={30}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.brand}>VitaBridge</Text>

        <Text style={styles.tagline}>
          PROTECTING BRAIN HEALTH EARLIER
        </Text>
      </View>

      <Text style={styles.greeting}>Parent Dashboard</Text>

      <Text style={styles.description}>
        Welcome. Follow your child's early development and
        wellbeing journey with VitaBridge.
      </Text>

      {/* CHILD PROFILE CARD */}
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressedCard,
        ]}
        onPress={openChildProfile}
        accessibilityRole="button"
        accessibilityLabel="Open child profile"
      >
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons
            name="baby-face-outline"
            size={35}
            color={COLORS.teal}
          />

          <MaterialCommunityIcons
            name="chevron-right"
            size={27}
            color={COLORS.muted}
          />
        </View>

        <Text style={styles.cardTitle}>Child Profile</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={COLORS.teal} />
            <Text style={styles.cardText}>
              Loading child profile...
            </Text>
          </View>
        ) : child ? (
          <View style={styles.profileDetails}>
            <Text style={styles.childName}>
              {child.name || 'Child profile'}
            </Text>

            <Text style={styles.cardText}>
              Date of birth: {formatDate(child.date_of_birth)}
            </Text>

            <Text style={styles.cardText}>
              Sex: {child.sex || 'Not available'}
            </Text>

            <Text style={styles.cardAction}>
              View or update profile
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.cardText}>
              {profileError || 'Your child profile is not available.'}
            </Text>

            <Pressable
              onPress={loadChildProfile}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </>
        )}
      </Pressable>

      {/* DEVELOPMENT TRACKING / INSTRUMENT SELECTION */}
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressedCard,
        ]}
        onPress={openDevelopmentTracking}
        accessibilityRole="button"
        accessibilityLabel="Open child developmental screening instruments"
      >
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons
            name="chart-line"
            size={35}
            color={COLORS.teal}
          />

          <MaterialCommunityIcons
            name="chevron-right"
            size={27}
            color={COLORS.muted}
          />
        </View>

        <Text style={styles.cardTitle}>
          Development Tracking
        </Text>

        <Text style={styles.cardText}>
          Explore available developmental screening instruments,
          age-appropriate milestones and your child's progress.
        </Text>

        <Text style={styles.cardAction}>
          Select Screening Instrument →
        </Text>
      </Pressable>

      {/* SCREENING HISTORY CARD */}
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressedCard,
        ]}
        onPress={openScreeningHistory}
        accessibilityRole="button"
        accessibilityLabel="Open child screening history"
      >
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons
            name="clipboard-text-clock-outline"
            size={35}
            color={COLORS.teal}
          />

          <MaterialCommunityIcons
            name="chevron-right"
            size={27}
            color={COLORS.muted}
          />
        </View>

        <Text style={styles.cardTitle}>
          Screening History
        </Text>

        <Text style={styles.cardText}>
          View previously saved screening sessions, dates,
          developmental screening information and review status.
        </Text>

        <Text style={styles.cardAction}>
          View Screening Records
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressedCard,
        ]}
        onPress={() => router.push('/passport')}
        accessibilityRole="button"
        accessibilityLabel="Open family health passport"
      >
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons
            name="passport"
            size={35}
            color={COLORS.teal}
          />

          <MaterialCommunityIcons
            name="chevron-right"
            size={27}
            color={COLORS.muted}
          />
        </View>

        <Text style={styles.cardTitle}>Family Health Passport</Text>
        <Text style={styles.cardText}>
          Review recorded preventive care and follow-up for profiles linked to your account.
        </Text>
        <Text style={styles.cardAction}>View Family Passport</Text>
      </Pressable>

      {/* REFRESH PROFILE */}
      <Pressable
        style={styles.refreshButton}
        onPress={loadChildProfile}
        disabled={loading}
      >
        <MaterialCommunityIcons
          name="refresh"
          size={19}
          color={COLORS.teal}
        />

        <Text style={styles.refreshText}>
          Refresh Dashboard
        </Text>
      </Pressable>

      {/* RETURN TO WELCOME */}
      <Pressable
        style={styles.button}
        onPress={() => router.replace('/welcome')}
      >
        <Text style={styles.buttonText}>
          Return to Welcome
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 35,
  },

  logo: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  brand: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
  },

  tagline: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.teal,
    marginTop: 6,
  },

  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },

  description: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.muted,
    marginTop: 8,
    marginBottom: 24,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },

  pressedCard: {
    opacity: 0.75,
    borderColor: COLORS.teal,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 15,
  },

  cardText: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.muted,
    marginTop: 7,
  },

  profileDetails: {
    marginTop: 5,
  },

  childName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.teal,
    marginTop: 5,
  },

  cardAction: {
    color: COLORS.teal,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 14,
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },

  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#E4F4F1',
    borderRadius: 8,
  },

  retryText: {
    color: COLORS.teal,
    fontWeight: '700',
  },

  refreshButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 8,
  },

  refreshText: {
    color: COLORS.teal,
    fontWeight: '700',
    fontSize: 14,
  },

  button: {
    backgroundColor: COLORS.teal,
    padding: 17,
    borderRadius: 13,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
