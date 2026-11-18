
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createDoctorAccount } from '../../src/api';

export default function CreateDoctorScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateDoctor = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Required fields', 'Please complete all fields.');
      return;
    }

    if (password.length < 12) {
      Alert.alert(
        'Weak password',
        'Password must contain at least 12 characters.'
      );
      return;
    }

    try {
      setLoading(true);

      await createDoctorAccount({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      Alert.alert(
        'Success',
        'Doctor account created successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/admin/dashboard'),
          },
        ]
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        'Unable to create doctor account. Please try again.';

      Alert.alert('Account creation failed', String(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Create Doctor Account</Text>

      <Text style={styles.subtitle}>
        Register a new healthcare practitioner.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Doctor's full name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Temporary password</Text>
        <TextInput
          style={styles.input}
          placeholder="Minimum 12 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={handleCreateDoctor}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              Create Doctor Account
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F6F5',
    padding: 22,
  },
  heading: {
    fontSize: 25,
    fontWeight: '700',
    color: '#19313A',
    marginTop: 30,
  },
  subtitle: {
    fontSize: 14,
    color: '#62757A',
    marginTop: 8,
    marginBottom: 25,
  },
  form: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#19313A',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#D9E7E5',
    borderRadius: 10,
    paddingHorizontal: 13,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  button: {
    height: 52,
    backgroundColor: '#159C91',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    padding: 16,
  },
  backText: {
    color: '#245B83',
    fontWeight: '600',
  },
});
