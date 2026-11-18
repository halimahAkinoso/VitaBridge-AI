
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../src/theme';
import { useAuth } from '../../src/auth/AuthContext';
import { getCurrentUser } from '../../src/api';

export default function LoginScreen() {
  const router = useRouter();

  const { pathway } = useLocalSearchParams<{
    pathway?: string;
  }>();

  const { login: authenticate, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [invalidCredentials, setInvalidCredentials] = useState(false);

  const isPractitionerLogin = pathway === 'practitioner';

  const selectedPathway =
    pathway === 'child' || pathway === 'adult' ? pathway : null;

  const clearLoginError = () => {
    setLoginError('');
    setInvalidCredentials(false);
  };

  const handleLogin = async () => {
    clearLoginError();

    if (!email.trim() || !password) {
      setLoginError('Enter your email address and password to continue.');
      return;
    }

    let credentialsAccepted = false;

    try {
      setLoading(true);

      const user = await authenticate(email.trim(), password);
      credentialsAccepted = true;

      // Practitioner portal
      if (isPractitionerLogin) {
        if (user.role === 'admin') {
          router.replace('/admin/dashboard');
          return;
        }

        if (user.role === 'doctor') {
          router.replace('/doctor/dashboard');
          return;
        }

        await logout();

        Alert.alert(
          'Access restricted',
          'This portal is for authorised healthcare practitioners and administrators only.'
        );
        return;
      }

      // Child pathway validation
      if (selectedPathway === 'child' && user.role !== 'parent') {
        await logout();
        Alert.alert(
          'Account mismatch',
          'Please use a parent account for the child development pathway.'
        );
        return;
      }

      // Adult pathway validation
      if (selectedPathway === 'adult' && user.role !== 'adult') {
        await logout();
        Alert.alert(
          'Account mismatch',
          'Please use an adult account for this pathway.'
        );
        return;
      }

      // Practitioners must use Practitioner Access
      if (user.role === 'doctor' || user.role === 'admin') {
        await logout();
        Alert.alert(
          'Use Practitioner Access',
          'Please select Practitioner Access to sign in.'
        );
        return;
      }

      if (user.role !== 'adult' && user.role !== 'parent') {
        await logout();
        Alert.alert(
          'Access restricted',
          'This account does not have permission to access these pathways.'
        );
        return;
      }

      const profileResponse = await getCurrentUser();
      const profileComplete =
        profileResponse.data?.profile_complete === true;

      if (user.role === 'parent') {
        router.replace(
          profileComplete ? '/child/dashboard' : '/child/profile'
        );
      } else {
        router.replace(
          profileComplete ? '/adult/dashboard' : '/adult/profile'
        );
      }
    } catch (error: any) {
      const isInvalidCredentials =
        !credentialsAccepted && error?.response?.status === 401;
      const detail = error?.response?.data?.detail;
      const detailMessage = Array.isArray(detail)
        ? detail.map((item: any) => item.msg || String(item)).join(' ')
        : typeof detail === 'string'
          ? detail
          : '';

      setInvalidCredentials(isInvalidCredentials);
      setLoginError(
        isInvalidCredentials
          ? 'Email or password is incorrect. Check both fields and try again.'
          : detailMessage ||
              (error?.response
                ? 'Sign in failed. Please review your details and try again.'
                : 'Unable to connect. Check your connection and try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const goToRegister = () => {
    router.push({
      pathname: '/(auth)/register',
      params: selectedPathway ? { pathway: selectedPathway } : {},
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Ionicons name="fitness" size={35} color={COLORS.surface} />
          </View>

          <Text style={styles.brandName}>VitaBridge</Text>

          <Text style={styles.tagline}>
            PROTECTING BRAIN HEALTH EARLIER
          </Text>
        </View>

        <View style={styles.heading}>
          <Text style={styles.title}>
            {isPractitionerLogin ? 'Practitioner Sign In' : 'Welcome Back'}
          </Text>

          <Text style={styles.subtitle}>
            {isPractitionerLogin
              ? 'Sign in to your authorised VitaBridge practitioner account.'
              : 'Sign in to continue your brain health journey.'}
          </Text>
        </View>

        {selectedPathway && (
          <View style={styles.pathwayBox}>
            <Ionicons
              name={
                selectedPathway === 'child'
                  ? 'people-outline'
                  : 'person-outline'
              }
              size={22}
              color={COLORS.teal}
            />

            <View style={styles.pathwayText}>
              <Text style={styles.pathwayTitle}>
                {selectedPathway === 'child'
                  ? 'Child Development'
                  : 'Adult Brain Health'}
              </Text>

              <Text style={styles.pathwayDescription}>
                {selectedPathway === 'child'
                  ? 'Sign in using your parent account.'
                  : 'Sign in using your adult account.'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>

          <View
            style={[
              styles.inputContainer,
              invalidCredentials && styles.invalidInput,
            ]}
          >
            <Ionicons name="mail-outline" size={20} color={COLORS.muted} />

            <TextInput
              style={styles.input}
              placeholder="Enter your email address"
              placeholderTextColor={COLORS.muted}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                clearLoginError();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <Text style={styles.label}>Password</Text>

          <View
            style={[
              styles.inputContainer,
              invalidCredentials && styles.invalidInput,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={COLORS.muted}
            />

            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.muted}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                clearLoginError();
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading}
              accessibilityLabel={
                showPassword ? 'Hide password' : 'Show password'
              }
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={21}
                color={COLORS.muted}
              />
            </Pressable>
          </View>

          {loginError ? (
            <View
              style={styles.errorBox}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={COLORS.danger}
              />
              <Text style={styles.errorText}>{loginError}</Text>
            </View>
          ) : null}

          <Pressable
            style={styles.forgotPassword}
            onPress={() =>
              Alert.alert(
                'Password recovery',
                'Password recovery will be available in a future VitaBridge update.'
              )
            }
            disabled={loading}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Pressable>

          <Pressable
            style={[
              styles.loginButton,
              loading && styles.disabledButton,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Sign In</Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color="#FFFFFF"
                />
              </>
            )}
          </Pressable>
        </View>

        {!isPractitionerLogin && (
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>
              Don't have an account?
            </Text>

            <Pressable onPress={goToRegister} disabled={loading}>
              <Text style={styles.registerLink}>Create Account</Text>
            </Pressable>
          </View>
        )}

        {isPractitionerLogin && (
          <Text style={styles.practitionerNotice}>
            Practitioner accounts are created and approved by VitaBridge administrators.
          </Text>
        )}

        <View style={styles.securityNote}>
          <Ionicons
            name="shield-checkmark-outline"
            size={19}
            color={COLORS.teal}
          />

          <Text style={styles.securityText}>
            Your privacy and information security matter to us.
          </Text>
        </View>

        <Text style={styles.footer}>
          Early Awareness. Informed Action. Better Brain Health.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 35,
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: 35,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 23,
    backgroundColor: '#159C91',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.7,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#159C91',
    letterSpacing: 1.4,
    marginTop: 7,
  },
  heading: {
    marginBottom: 25,
  },
  title: {
    fontSize: 29,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 9,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 22,
  },
  pathwayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2EF',
    padding: 15,
    borderRadius: 14,
    marginBottom: 25,
    gap: 12,
  },
  pathwayText: {
    flex: 1,
  },
  pathwayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  pathwayDescription: {
    fontSize: 12,
    color: COLORS.muted,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 9,
    marginTop: 15,
  },
  inputContainer: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 15,
    gap: 11,
  },
  invalidInput: {
    borderColor: COLORS.danger,
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 13,
    marginBottom: 25,
  },
  forgotText: {
    color: '#159C91',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FCE8E8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F2C2C2',
    padding: 12,
    marginTop: 13,
  },
  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  loginButton: {
    minHeight: 56,
    backgroundColor: '#159C91',
    borderRadius: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 5,
  },
  disabledButton: {
    opacity: 0.65,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 30,
  },
  registerText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  registerLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#159C91',
  },
  practitionerNotice: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 24,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 30,
  },
  securityText: {
    fontSize: 11,
    color: COLORS.muted,
    flexShrink: 1,
  },
  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 25,
    lineHeight: 17,
  },
});
