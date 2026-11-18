
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import { register } from '../../src/api';

type AccountType = 'adult' | 'parent';

export default function RegisterScreen() {
  const { pathway } = useLocalSearchParams<{
    pathway?: string;
  }>();

  const initialAccount: AccountType =
    pathway === 'child' ? 'parent' : 'adult';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [accountType, setAccountType] =
    useState<AccountType>(initialAccount);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registeredName, setRegisteredName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleRegister = async () => {
    setErrorMessage('');

    if (
      !name.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (name.trim().length < 2) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (password.length < 12 || password.length > 128) {
      setErrorMessage(
        'Your password must contain between 12 and 128 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Your passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      const response = await register({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: accountType,
      });

      const data = response.data;

      if (data?.error) {
        throw new Error(data.error);
      }

      const token = data?.token;
      const user = data?.user;

      if (!token || !user?.email || !user?.role) {
        throw new Error(
          'The server returned an incomplete registration response.'
        );
      }

      setRegisteredName(user.name || name.trim());

      // Clear registration details.
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      // Display successful registration.
      setRegistered(true);

    } catch (error: any) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Registration failed. Please try again.';

      setErrorMessage(message);

    } finally {
      setLoading(false);
    }
  };

  // Continue to login after successful registration.
  const continueToLogin = () => {
    const selectedPathway =
      pathway === 'child' || pathway === 'adult'
        ? pathway
        : accountType === 'parent'
          ? 'child'
          : 'adult';

    router.replace({
      pathname: '/(auth)/login',
      params: { pathway: selectedPathway },
    });
  };

  // SUCCESS SCREEN
  if (registered) {
    return (
      <Screen>
        <View style={styles.successContainer}>
          <MaterialCommunityIcons
            name="check-circle"
            size={82}
            color={COLORS.success}
          />

          <Text style={styles.successBrand}>
            VitaBridge
          </Text>

          <Text style={styles.mission}>
            PROTECTING BRAIN HEALTH EARLIER
          </Text>

          <Text style={styles.successTitle}>
            Account Created Successfully!
          </Text>

          <Text style={styles.successSubtitle}>
            Welcome, {registeredName}.
          </Text>

          <Text style={styles.successDescription}>
            Your registration request was successfully
            accepted by VitaBridge.
          </Text>

          <View style={styles.successInfo}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={27}
              color={COLORS.teal}
            />

            <Text style={styles.successInfoText}>
              Your registration details have been submitted.
              Additional account verification and appropriate
              consent steps are required before accessing
              healthcare services.
            </Text>
          </View>

          <Pressable
            style={styles.button}
            onPress={continueToLogin}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>
              Continue to Sign In
            </Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={21}
              color="#FFFFFF"
            />
          </Pressable>

          <Pressable
            onPress={() => router.replace('/welcome')}
            style={styles.homeButton}
          >
            <Text style={styles.homeText}>
              Return to Welcome
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // REGISTRATION FORM
  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={23}
              color={COLORS.blue}
            />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.brand}>
            <View style={styles.logo}>
              <MaterialCommunityIcons
                name="brain"
                size={42}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.brandName}>VitaBridge</Text>

            <Text style={styles.mission}>
              PROTECTING BRAIN HEALTH EARLIER
            </Text>
          </View>

          <View style={styles.intro}>
            <Text style={styles.heading}>
              Create Your Account
            </Text>

            <Text style={styles.subtitle}>
              Begin your journey towards early awareness,
              informed action and better brain health.
            </Text>
          </View>

          <Text style={styles.label}>Full name *</Text>

          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="account-outline"
              size={21}
              color={COLORS.muted}
            />

            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={COLORS.muted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
            />
          </View>

          <Text style={styles.label}>Email address *</Text>

          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="email-outline"
              size={21}
              color={COLORS.muted}
            />

            <TextInput
              style={styles.input}
              placeholder="Enter your email address"
              placeholderTextColor={COLORS.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </View>

          <Text style={styles.label}>Account type *</Text>

          <View style={styles.accountOptions}>
            <Pressable
              onPress={() => setAccountType('adult')}
              style={[
                styles.accountOption,
                accountType === 'adult' && styles.selectedAccount,
              ]}
            >
              <MaterialCommunityIcons
                name="brain"
                size={25}
                color={
                  accountType === 'adult'
                    ? COLORS.teal
                    : COLORS.muted
                }
              />

              <Text style={styles.accountText}>Adult</Text>

              <Text style={styles.accountDescription}>
                Personal brain health
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setAccountType('parent')}
              style={[
                styles.accountOption,
                accountType === 'parent' && styles.selectedAccount,
              ]}
            >
              <MaterialCommunityIcons
                name="baby-face-outline"
                size={25}
                color={
                  accountType === 'parent'
                    ? COLORS.teal
                    : COLORS.muted
                }
              />

              <Text style={styles.accountText}>
                Parent / Guardian
              </Text>

              <Text style={styles.accountDescription}>
                Child health management
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Password *</Text>

          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={21}
              color={COLORS.muted}
            />

            <TextInput
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor={COLORS.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
            />

            <Pressable
              onPress={() => setShowPassword(!showPassword)}
            >
              <MaterialCommunityIcons
                name={
                  showPassword
                    ? 'eye-off-outline'
                    : 'eye-outline'
                }
                size={22}
                color={COLORS.muted}
              />
            </Pressable>
          </View>

          <Text style={styles.helper}>
            Use at least 12 characters.
          </Text>

          <Text style={styles.label}>Confirm password *</Text>

          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="lock-check-outline"
              size={21}
              color={COLORS.muted}
            />

            <TextInput
              style={styles.input}
              placeholder="Re-enter your password"
              placeholderTextColor={COLORS.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoComplete="new-password"
            />

            <Pressable
              onPress={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
            >
              <MaterialCommunityIcons
                name={
                  showConfirmPassword
                    ? 'eye-off-outline'
                    : 'eye-outline'
                }
                size={22}
                color={COLORS.muted}
              />
            </Pressable>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={21}
                color={COLORS.danger}
              />

              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.button,
              loading && styles.disabled,
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.buttonText}>
                  Create Account
                </Text>

                <MaterialCommunityIcons
                  name="arrow-right"
                  size={21}
                  color="#FFFFFF"
                />
              </>
            )}
          </Pressable>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>
              Already have an account?
            </Text>

            <Pressable
              onPress={() =>
                router.replace({
                  pathname: '/(auth)/login',
                  params: pathway ? { pathway } : {},
                })
              }
            >
              <Text style={styles.loginLink}>Sign In</Text>
            </Pressable>
          </View>

          <View style={styles.privacyBox}>
            <MaterialCommunityIcons
              name="shield-lock-outline"
              size={25}
              color={COLORS.teal}
            />

            <Text style={styles.privacyText}>
              Your privacy and the protection of your
              health information matter to VitaBridge.
            </Text>
          </View>

          <Text style={styles.disclaimer}>
            Account creation does not constitute clinical
            consent or authorize access to another person's
            health information.
          </Text>

          <Text style={styles.footer}>
            Early Awareness. Informed Action. Better Brain Health.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 35,
    backgroundColor: COLORS.background,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  backText: {
    color: COLORS.blue,
    fontWeight: '700',
    marginLeft: 7,
  },
  brand: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 25,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.blue,
    marginTop: 9,
  },
  mission: {
    color: COLORS.teal,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 5,
    textAlign: 'center',
  },
  intro: {
    marginBottom: 25,
  },
  heading: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
  },
  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 9,
  },
  inputContainer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 19,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  accountOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  accountOption: {
    flex: 1,
    minHeight: 112,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAccount: {
    borderColor: COLORS.teal,
    borderWidth: 2,
    backgroundColor: '#E9F5F2',
  },
  accountText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
    textAlign: 'center',
  },
  accountDescription: {
    color: COLORS.muted,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 4,
  },
  helper: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: -12,
    marginBottom: 18,
  },
  button: {
    backgroundColor: COLORS.teal,
    borderRadius: 13,
    minHeight: 56,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 23,
    gap: 5,
  },
  loginText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  loginLink: {
    color: COLORS.teal,
    fontSize: 13,
    fontWeight: '900',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCECEC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    gap: 8,
  },
  errorText: {
    color: COLORS.danger,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successBrand: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.blue,
    marginTop: 15,
  },
  successTitle: {
    fontSize: 25,
    fontWeight: '900',
    color: COLORS.success,
    textAlign: 'center',
    marginTop: 35,
  },
  successSubtitle: {
    color: COLORS.blue,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  successDescription: {
    color: COLORS.muted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 23,
    marginTop: 14,
  },
  successInfo: {
    flexDirection: 'row',
    backgroundColor: '#E6F3EF',
    padding: 16,
    borderRadius: 14,
    marginTop: 30,
    gap: 12,
  },
  successInfoText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 19,
  },
  homeButton: {
    marginTop: 20,
    padding: 12,
  },
  homeText: {
    color: COLORS.blue,
    fontWeight: '700',
  },
  privacyBox: {
    backgroundColor: '#E6F3EF',
    padding: 15,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 27,
  },
  privacyText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
  },
  disclaimer: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
  },
  footer: {
    color: COLORS.blue,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 13,
  },
});
