
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Screen } from '../../components/Screen';
import { COLORS, SHADOW } from '../../src/theme';
import { getAdultProfile, saveAdultProfile } from '../../src/api';

type AdultProfile = {
  name: string;
  dob: string;
  sex: string;
  nationality: string;
  language: string;
};

const INITIAL_PROFILE: AdultProfile = {
  name: '',
  dob: '',
  sex: '',
  nationality: '',
  language: 'en',
};

const SEX_OPTIONS = [
  'Female',
  'Male',
  'Prefer not to say',
];

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Arabic', value: 'ar' },
];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helper?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="words"
      />

      {helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

function OptionGroup({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { label: string; value: string }[] | string[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.options}>
        {options.map((item) => {
          const option =
            typeof item === 'string'
              ? { label: item, value: item }
              : item;

          const selected = value === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[
                styles.option,
                selected && styles.optionSelected,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AdultProfileScreen() {
  const [profile, setProfile] =
    useState<AdultProfile>(INITIAL_PROFILE);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [requiresSignIn, setRequiresSignIn] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setLoadError('');

      const response = await getAdultProfile();
      const data = response.data?.profile;

      if (data) {
        setProfile({
          name: data.name || '',
          dob: data.dob || '',
          sex: data.sex || '',
          nationality: data.nationality || '',
          language: data.language === 'ar' ? 'ar' : 'en',
        });
      }
    } catch (error: any) {
      const needsAuthentication = error?.response?.status === 401;
      const message = needsAuthentication
        ? 'Please sign in to load and save your adult profile.'
        : error?.response?.data?.detail ||
          'Unable to load your profile. Please try again.';

      setRequiresSignIn(needsAuthentication);
      setLoadError(
        typeof message === 'string'
          ? message
          : 'Unable to load your profile.'
      );
    } finally {
      setLoading(false);
    }
  };

  const updateField = (
    field: keyof AdultProfile,
    value: string
  ) => {
    setFormError('');
    setProfile((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!profile.name.trim()) {
      setFormError('Please enter your full name.');
      return false;
    }

    if (!profile.dob.trim()) {
      setFormError('Please enter your date of birth.');
      return false;
    }

    const normalizedDob = profile.dob.trim().replace(/\//g, '-');
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (!datePattern.test(normalizedDob)) {
      setFormError('Use YYYY-MM-DD or YYYY/MM/DD for your date of birth.');
      return false;
    }

    const parsedDate = new Date(`${normalizedDob}T00:00:00`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== normalizedDob
    ) {
      setFormError('Please enter a valid date of birth.');
      return false;
    }

    if (parsedDate > new Date()) {
      setFormError('Date of birth cannot be in the future.');
      return false;
    }

    if (!profile.sex) {
      setFormError('Please select your sex or choose Prefer not to say.');
      return false;
    }

    if (!profile.language) {
      setFormError('Please select your preferred language.');
      return false;
    }

    setFormError('');
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const response = await saveAdultProfile({
        name: profile.name.trim(),
        dob: profile.dob.trim().replace(/\//g, '-'),
        sex: profile.sex,
        nationality: profile.nationality.trim() || undefined,
        language: profile.language,
      });

      const data = response.data;

      if (!data?.eligible) {
        setFormError(
          data?.message ||
            'The adult screening pathway is available for ages 50–75.'
        );
        return;
      }

      setLoadError('');
      setFormError('');
      setRequiresSignIn(false);
      router.replace('/adult/dashboard');
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const needsAuthentication = error?.response?.status === 401;

      setRequiresSignIn(needsAuthentication);
      setFormError(
        needsAuthentication
          ? 'Your session is not authenticated. Sign in again before saving this profile.'
          : typeof detail === 'string'
            ? detail
            : 'Unable to save your profile. Check your connection and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>🧠</Text>
            </View>

            <Text style={styles.brand}>VitaBridge</Text>
            <Text style={styles.tagline}>
              Protecting Brain Health Earlier
            </Text>
          </View>

          <View style={styles.headingSection}>
            <Text style={styles.heading}>Adult Health Profile</Text>

            <Text style={styles.description}>
              Let's get to know you. Your information helps us prepare
              your personalised preventive brain health screening.
            </Text>
          </View>

          {loadError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loadError}</Text>
              {requiresSignIn ? (
                <Pressable
                  onPress={() =>
                    router.replace({
                      pathname: '/(auth)/login',
                      params: { pathway: 'adult' },
                    })
                  }
                >
                  <Text style={styles.retryText}>Sign in to continue</Text>
                </Pressable>
              ) : (
                <Pressable onPress={loadProfile}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {formError ? (
            <View
              style={styles.errorBox}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.errorText}>{formError}</Text>
              {requiresSignIn ? (
                <Pressable
                  onPress={() =>
                    router.replace({
                      pathname: '/(auth)/login',
                      params: { pathway: 'adult' },
                    })
                  }
                >
                  <Text style={styles.retryText}>Sign in to continue</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal Information</Text>

            <Field
              label="Full Name *"
              value={profile.name}
              onChangeText={(value) => updateField('name', value)}
              placeholder="Enter your full name"
            />

            <Field
              label="Date of Birth *"
              value={profile.dob}
              onChangeText={(value) => updateField('dob', value)}
              placeholder="YYYY-MM-DD"
              helper="Use YYYY-MM-DD or YYYY/MM/DD. Screening eligibility: 50–75 years."
            />

            <OptionGroup
              label="Sex *"
              options={SEX_OPTIONS}
              value={profile.sex}
              onSelect={(value) => updateField('sex', value)}
            />

            <Field
              label="Nationality (optional)"
              value={profile.nationality}
              onChangeText={(value) => updateField('nationality', value)}
              placeholder="Enter your nationality"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Communication
            </Text>

            <OptionGroup
              label="Preferred Language *"
              options={LANGUAGE_OPTIONS}
              value={profile.language}
              onSelect={(value) => updateField('language', value)}
            />
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Your Information Matters</Text>
            <Text style={styles.noticeText}>
              Your profile supports preventive screening and
              personalised guidance. Screening does not provide a
              medical diagnosis.
            </Text>
          </View>

          <Pressable
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                Save Profile and Continue
              </Text>
            )}
          </Pressable>

          <Text style={styles.footer}>
            VitaBridge AI • Early Awareness. Informed Action.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 25,
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: 19,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 9,
  },
  logoIcon: {
    fontSize: 32,
  },
  brand: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.teal,
  },
  tagline: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  headingSection: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  description: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.blue,
    marginBottom: 18,
  },
  field: {
    marginBottom: 19,
  },
  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    paddingHorizontal: 13,
    color: COLORS.text,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
  },
  helper: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: '#FFFFFF',
  },
  optionSelected: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  optionText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  notice: {
    backgroundColor: '#E7F4F2',
    padding: 16,
    borderRadius: 13,
    marginBottom: 20,
  },
  noticeTitle: {
    color: COLORS.teal,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  noticeText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 19,
  },
  saveButton: {
    height: 54,
    borderRadius: 13,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 3,
  },
  disabledButton: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 20,
  },
  errorBox: {
    backgroundColor: '#FCECEC',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
  },
  retryText: {
    color: COLORS.blue,
    fontWeight: '800',
    marginTop: 8,
  },
});
