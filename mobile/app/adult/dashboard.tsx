
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';

import { Screen } from '../../components/Screen';
import { COLORS, SHADOW } from '../../src/theme';
import { getAdultProfile, getCurrentUser } from '../../src/api';
import { useAuth } from '../../src/auth/AuthContext';

type Profile = {
  name?: string;
  dob?: string;
  sex?: string;
  nationality?: string;
};

export default function AdultDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Load the adult's saved profile and authenticated user information.
  const loadProfile = async () => {
    try {
      setError('');

      const [profileResult, userResult] = await Promise.all([
        getAdultProfile().catch((err) => {
          console.error('Adult profile request failed:', err?.response?.data || err);
          return null;
        }),
        getCurrentUser().catch((err) => {
          console.error('Current user request failed:', err?.response?.data || err);
          return null;
        }),
      ]);

      const profileResponse = profileResult?.data || {};
      const userResponse = userResult?.data || {};

      const adultProfile =
        profileResponse.profile ||
        profileResponse.data?.profile ||
        profileResponse.data ||
        profileResponse;

      const currentUser =
        userResponse.user ||
        userResponse.profile ||
        userResponse.data?.user ||
        userResponse.data?.profile ||
        userResponse.data ||
        userResponse;

      // Support different name formats returned by the backend.
      const adultName =
        adultProfile?.full_name ||
        adultProfile?.name ||
        [
          adultProfile?.first_name,
          adultProfile?.last_name,
        ].filter(Boolean).join(' ');

      const userName =
        currentUser?.full_name ||
        currentUser?.name ||
        [
          currentUser?.first_name,
          currentUser?.last_name,
        ].filter(Boolean).join(' ') ||
        user?.name ||
        '';

      const selectedName = adultName || userName || '';

      // Never use an email address as the person's display name.
      const safeName =
        selectedName && !selectedName.includes('@')
          ? selectedName.trim()
          : '';

      setProfile({
        name: safeName,
        dob:
          adultProfile?.dob ||
          adultProfile?.date_of_birth ||
          '',
        sex: adultProfile?.sex || '',
        nationality: adultProfile?.nationality || '',
      });

      if (!profileResult && !userResult) {
        setError('Unable to load your profile. Please try again.');
      }
    } catch (err: any) {
      console.error(
        'Adult dashboard profile error:',
        err?.response?.data || err
      );

      setError(
        err?.response?.data?.detail ||
        'Unable to load your profile. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const navigate = (path: string) => {
    router.push(path as any);
  };

  const ActionCard = ({
    icon,
    title,
    description,
    buttonText,
    onPress,
    disabled = false,
  }: {
    icon: string;
    title: string;
    description: string;
    buttonText: string;
    onPress?: () => void;
    disabled?: boolean;
  }) => (
    <View style={[styles.actionCard, disabled && styles.disabledCard]}>
      <View style={styles.actionHeader}>
        <View style={styles.actionIcon}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>

        <View style={styles.actionHeading}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionDescription}>{description}</Text>
        </View>
      </View>

      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.actionButton,
          disabled && styles.disabledButton,
        ]}
      >
        <Text style={styles.actionButtonText}>{buttonText}</Text>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.loadingText}>
            Preparing your dashboard...
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.teal]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>VitaBridge</Text>
            <Text style={styles.tagline}>
              Protecting Brain Health Earlier
            </Text>
          </View>

          <View style={styles.logo}>
            <Text style={styles.logoIcon}>🧠</Text>
          </View>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>ADULT BRAIN HEALTH</Text>

          <Text style={styles.welcomeTitle}>
            Welcome
            {profile.name
              ? `, ${profile.name.split(' ')[0]}`
              : ''}
          </Text>

          <Text style={styles.welcomeDescription}>
            Take an active step towards understanding and protecting
            your brain health through early awareness and preventive care.
          </Text>

          <View style={styles.welcomeFooter}>
            <Text style={styles.welcomeFooterText}>
              Early Awareness. Informed Action.
            </Text>
          </View>
        </View>

        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View>
              <Text style={styles.sectionTitle}>My Profile</Text>

              <Text style={styles.profileName}>
                {profile.name || 'Complete Your Profile'}
              </Text>

              <Text style={styles.profileDetail}>
                {profile.sex || 'Personal profile'}
                {profile.nationality
                  ? ` • ${profile.nationality}`
                  : ''}
              </Text>
            </View>

            <Pressable
              style={styles.editButton}
              onPress={() => navigate('/adult/profile')}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>
        </View>

        {/* Screening section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Your Brain Health Journey
          </Text>

          <Text style={styles.sectionSubtitle}>
            Complete the screening steps at your own pace.
          </Text>
        </View>

        <ActionCard
          icon="📋"
          title="Baseline Brain Health Assessment"
          description="Begin your baseline health information and preventive assessment."
          buttonText="Start Assessment"
          onPress={() => navigate('/adult/screening')}
        />

        <ActionCard
          icon="👂"
          title="Hearing and Vision Screening"
          description="Complete the hearing and vision checks that help provide context for cognitive screening."
          buttonText="Start Hearing & Vision"
          onPress={() =>
            navigate('/adult/screening/hearing-vision')
          }
        />

        <ActionCard
          icon="🧠"
          title="Cognitive Screening"
          description="An approved instrument, permissions, and clinical authorization are required before cognitive screening can be enabled."
          buttonText="Approval Pending"
          disabled
        />

        {/* Records and support */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Your Records and Support
          </Text>
        </View>

        <ActionCard
          icon="📊"
          title="Screening History"
          description="Review your previous screening records and follow-up information."
          buttonText="View History"
          onPress={() => navigate('/adult/history')}
        />

        <ActionCard
          icon="📨"
          title="Referrals and Follow-up"
          description="View referrals and monitor the progress of your recommended follow-up care."
          buttonText="View Referrals"
          onPress={() => navigate('/screening/referrals')}
        />

        <ActionCard
          icon="🤖"
          title="Nura AI Assistant"
          description="Get general preventive brain health information and guidance."
          buttonText="Talk to Nura"
          onPress={() => navigate('/ai-assistant')}
        />

        {/* Important notice */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>
            Important Health Information
          </Text>

          <Text style={styles.noticeText}>
            VitaBridge supports preventive awareness and screening.
            It does not diagnose Alzheimer's disease or replace
            professional medical assessment. Discuss health concerns
            with a qualified healthcare professional.
          </Text>
        </View>

        {error ? (
          <Pressable
            style={styles.errorCard}
            onPress={onRefresh}
          >
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>Tap to retry</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footer}>
          VitaBridge AI © Protecting Brain Health Earlier
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 13,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  brand: {
    fontSize: 25,
    fontWeight: '900',
    color: COLORS.teal,
  },

  tagline: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 3,
  },

  logo: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoIcon: {
    fontSize: 27,
  },

  welcomeCard: {
    backgroundColor: COLORS.blue,
    borderRadius: 19,
    padding: 20,
    marginBottom: 17,
    ...SHADOW,
  },

  welcomeLabel: {
    color: '#D5E9EF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginBottom: 9,
  },

  welcomeDescription: {
    color: '#EAF4F6',
    fontSize: 13,
    lineHeight: 21,
  },

  welcomeFooter: {
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF40',
    marginTop: 17,
    paddingTop: 12,
  },

  welcomeFooterText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },

  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 25,
    ...SHADOW,
  },

  profileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
  },

  profileName: {
    color: COLORS.blue,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },

  profileDetail: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },

  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: '#E7F4F2',
  },

  editButtonText: {
    color: COLORS.teal,
    fontWeight: '800',
    fontSize: 12,
  },

  sectionHeader: {
    marginBottom: 14,
    marginTop: 5,
  },

  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
    lineHeight: 18,
  },

  actionCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 13,
    ...SHADOW,
  },

  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#E7F4F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  iconText: {
    fontSize: 22,
  },

  actionHeading: {
    flex: 1,
  },

  actionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 5,
  },

  actionDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },

  actionButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 21,
  },

  disabledCard: {
    opacity: 0.7,
  },

  disabledButton: {
    backgroundColor: COLORS.muted,
  },

  noticeCard: {
    backgroundColor: '#E7F4F2',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },

  noticeTitle: {
    color: COLORS.teal,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 7,
  },

  noticeText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 19,
  },

  errorCard: {
    backgroundColor: '#FCECEC',
    borderRadius: 12,
    padding: 14,
    marginTop: 15,
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 12,
  },

  retryText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },

  footer: {
    color: COLORS.muted,
    textAlign: 'center',
    fontSize: 10,
    marginTop: 25,
  },
});
