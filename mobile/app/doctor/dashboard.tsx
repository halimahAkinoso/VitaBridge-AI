
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

import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';

type DashboardCardProps = {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
};

function DashboardCard({
  title,
  description,
  icon,
  onPress,
}: DashboardCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressedCard,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.cardTop}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={icon}
            size={29}
            color={COLORS.teal}
          />
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={26}
          color={COLORS.muted}
        />
      </View>

      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </Pressable>
  );
}

export default function DoctorDashboard() {
  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* BRAND HEADER */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <MaterialCommunityIcons
              name="brain"
              size={30}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.brandText}>
            <Text style={styles.brand}>VitaBridge</Text>
            <Text style={styles.tagline}>
              PROTECTING BRAIN HEALTH EARLIER
            </Text>
          </View>
        </View>

        {/* WELCOME */}
        <View style={styles.welcomeSection}>
          <Text style={styles.heading}>Practitioner Dashboard</Text>

          <Text style={styles.description}>
            Welcome. Manage screening submissions, review
            observations and follow up on referrals.
          </Text>
        </View>

        {/* CHILD DEVELOPMENT */}
        <Text style={styles.sectionTitle}>
          Child Development
        </Text>

        <DashboardCard
          title="Child Screening Reviews"
          description="Open the clinician queue to review submitted child development observations."
          icon="clipboard-text-search-outline"
          onPress={() => router.push('/doctor/child-reviews')}
        />

        {/* REFERRALS */}
        <Text style={styles.sectionTitle}>
          Referral Management
        </Text>

        <DashboardCard
          title="Referral Tracking"
          description="View referral records and follow their progress."
          icon="clipboard-check-outline"
          onPress={() => router.push('/screening/referrals')}
        />

        {/* GENERAL SCREENING */}
        <Text style={styles.sectionTitle}>
          Screening Management
        </Text>

        <DashboardCard
          title="Screening Records"
          description="Open the screening records area to access individual screening details."
          icon="file-document-outline"
          onPress={() => router.push('/doctor/screening/1')}
        />

        {/* INFORMATION */}
        <View style={styles.notice}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={23}
            color={COLORS.teal}
          />

          <Text style={styles.noticeText}>
            VitaBridge supports preventive health awareness and
            professional review. Screening observations are not
            a diagnosis and should be interpreted by authorised
            healthcare professionals.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingBottom: 35,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 55,
    height: 55,
    borderRadius: 17,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandText: {
    flex: 1,
  },
  brand: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.blue,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: COLORS.teal,
    marginTop: 4,
  },
  welcomeSection: {
    marginBottom: 25,
  },
  heading: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 9,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.muted,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  pressedCard: {
    opacity: 0.75,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: '#E8F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 7,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F5F3',
    borderRadius: 15,
    padding: 15,
    marginTop: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.text,
    marginLeft: 10,
  },
});
