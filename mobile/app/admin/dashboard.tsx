
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/theme';

export default function AdminDashboard() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Administrator</Text>
          <Text style={styles.subtitle}>
            VitaBridge Management Dashboard
          </Text>
        </View>

        <Ionicons
          name="shield-checkmark"
          size={36}
          color={COLORS.teal || '#159C91'}
        />
      </View>

      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>
          Welcome to VitaBridge
        </Text>
        <Text style={styles.welcomeText}>
          Manage practitioner access and oversee platform
          administration.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Administration
      </Text>

      <Pressable
        style={styles.actionCard}
        onPress={() => router.push('/admin/create-doctor')}
      >
        <View style={styles.iconBox}>
          <Ionicons
            name="person-add"
            size={25}
            color="#159C91"
          />
        </View>

        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>
            Create Doctor Account
          </Text>
          <Text style={styles.actionDescription}>
            Register an authorised doctor on VitaBridge.
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={22}
          color="#62757A"
        />
      </Pressable>

      <Pressable
        style={styles.actionCard}
        onPress={() => router.push('/doctor/dashboard')}
      >
        <View style={styles.iconBox}>
          <Ionicons
            name="medkit"
            size={25}
            color="#159C91"
          />
        </View>

        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>
            Doctor Dashboard
          </Text>
          <Text style={styles.actionDescription}>
            Open the practitioner workspace.
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={22}
          color="#62757A"
        />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F6F5',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 25,
  },
  heading: {
    fontSize: 25,
    fontWeight: '700',
    color: '#19313A',
  },
  subtitle: {
    fontSize: 13,
    color: '#62757A',
    marginTop: 5,
  },
  welcomeCard: {
    backgroundColor: '#159C91',
    borderRadius: 16,
    padding: 22,
    marginBottom: 28,
  },
  welcomeTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#19313A',
    marginBottom: 14,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E7F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#19313A',
  },
  actionDescription: {
    fontSize: 12,
    color: '#62757A',
    marginTop: 5,
  },
});
