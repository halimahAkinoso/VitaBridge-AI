
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import { getCurrentUser, saveProfile } from '../../src/api';

type ChildProfileData = {
  profile_type?: string;
  name?: string;
  date_of_birth?: string;
  sex?: 'Male' | 'Female';
  phone?: string;
  guardian_name?: string;
  relationship?: string;
};

// Web and native-compatible messages
function showMessage(
  title: string,
  message: string,
  onConfirm?: () => void
) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    onConfirm?.();
  } else {
    Alert.alert(title, message, [
      {
        text: 'OK',
        onPress: onConfirm,
      },
    ]);
  }
}

// Validate and normalize date of birth
function normalizeDateOfBirth(value: string): string | null {
  const parts = value.trim().split(/[/-]/);

  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date > today) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Calculate child's age in completed months
function calculateAgeInMonths(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number);
  const dob = new Date(year, month - 1, day);
  const today = new Date();

  let months =
    (today.getFullYear() - dob.getFullYear()) * 12 +
    (today.getMonth() - dob.getMonth());

  if (today.getDate() < dob.getDate()) {
    months -= 1;
  }

  return months;
}

export default function ChildProfile() {
  const [childName, setChildName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState<'Male' | 'Female' | ''>('');
  const [guardianName, setGuardianName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Retrieve the previously saved child profile.
  useEffect(() => {
    let mounted = true;

    const loadExistingProfile = async () => {
      try {
        const response = await getCurrentUser();

        if (!mounted) return;

        const profile: ChildProfileData | null =
          response.data?.profile || null;

        if (
          response.data?.profile_complete === true &&
          profile?.profile_type === 'child'
        ) {
          setChildName(profile.name || '');
          setDateOfBirth(profile.date_of_birth || '');
          setSex(profile.sex || '');
          setGuardianName(profile.guardian_name || '');
          setRelationship(profile.relationship || '');
          setPhone(profile.phone || '');

          setConsent(true);
          setIsEditing(true);
        }
      } catch (error: any) {
        console.error(
          'Unable to retrieve child profile:',
          error?.response?.data || error
        );

        if (mounted) {
          showMessage(
            'Profile loading issue',
            'We could not retrieve your saved information. Please check your connection and try again.'
          );
        }
      } finally {
        if (mounted) {
          setProfileLoading(false);
        }
      }
    };

    loadExistingProfile();

    return () => {
      mounted = false;
    };
  }, []);

  // Save new profile or update existing profile.
  const handleSubmit = async () => {
    if (loading || profileLoading) return;

    if (
      !childName.trim() ||
      !dateOfBirth.trim() ||
      !sex ||
      !guardianName.trim() ||
      !relationship.trim() ||
      !phone.trim()
    ) {
      showMessage(
        'Incomplete profile',
        'Please complete all required fields.'
      );
      return;
    }

    const normalizedDob = normalizeDateOfBirth(dateOfBirth);

    if (!normalizedDob) {
      showMessage(
        'Invalid date of birth',
        'Enter a valid date using YYYY/MM/DD or YYYY-MM-DD.'
      );
      return;
    }

    const ageInMonths = calculateAgeInMonths(normalizedDob);

    if (ageInMonths < 1 || ageInMonths > 72) {
      showMessage(
        'Age outside this pathway',
        'This child profile is intended for children aged 1 month to 6 years.'
      );
      return;
    }

    const cleanedPhone = phone.replace(/[\s()-]/g, '');

    if (!/^\+?\d{7,15}$/.test(cleanedPhone)) {
      showMessage(
        'Invalid phone number',
        'Please enter a valid contact phone number.'
      );
      return;
    }

    if (!consent) {
      showMessage(
        'Consent required',
        'Please confirm that you are authorised to provide this information.'
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        profile_type: 'child',
        name: childName.trim(),
        date_of_birth: normalizedDob,
        sex,
        phone: cleanedPhone,
        guardian_name: guardianName.trim(),
        relationship: relationship.trim(),
        consent: true,
      };

      const response = await saveProfile(payload);

      console.log('Child profile save response:', response.data);

      showMessage(
        isEditing ? 'Profile updated' : 'Profile saved',
        isEditing
          ? "Your child's information has been updated successfully."
          : "Your child's profile has been saved successfully.",
        () => router.replace('/child/dashboard')
      );
    } catch (error: any) {
      console.error(
        'Child profile submission failed:',
        error?.response?.status,
        error?.response?.data || error
      );

      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        'Unable to save the child profile. Please check your connection and try again.';

      showMessage('Profile not saved', String(message));
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options?: {
      keyboardType?: 'default' | 'phone-pad';
    }
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={options?.keyboardType || 'default'}
        autoCapitalize="words"
        editable={!loading && !profileLoading}
      />
    </View>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          disabled={loading}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={25}
            color={COLORS.text}
          />
        </Pressable>

        <View>
          <Text style={styles.headerTitle}>Child Profile</Text>
          <Text style={styles.headerSubtitle}>
            Protecting brain health earlier
          </Text>
        </View>
      </View>

      <View style={styles.intro}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="baby-face-outline"
            size={32}
            color={COLORS.teal}
          />
        </View>

        <Text style={styles.title}>
          Your child's health journey
        </Text>

        <Text style={styles.description}>
          Provide basic information to create a child profile and support
          age-appropriate development and wellbeing screening.
        </Text>
      </View>

      {profileLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.teal} />

          <Text style={styles.loadingText}>
            Retrieving saved child information...
          </Text>
        </View>
      ) : (
        <>
          {isEditing && (
            <View style={styles.editNotice}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color={COLORS.success}
              />

              <Text style={styles.editNoticeText}>
                Existing child profile loaded. You can update the details below.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Child Information
            </Text>

            {renderInput(
              'Child full name *',
              childName,
              setChildName,
              'Enter child full name'
            )}

            {renderInput(
              'Date of birth *',
              dateOfBirth,
              setDateOfBirth,
              'YYYY/MM/DD or YYYY-MM-DD'
            )}

            <Text style={styles.dateHint}>
              Example: 2025/7/28 or 2025-07-28
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Sex *</Text>

              <View style={styles.sexContainer}>
                {(['Male', 'Female'] as const).map((item) => {
                  const selected = sex === item;

                  return (
                    <Pressable
                      key={item}
                      onPress={() => setSex(item)}
                      style={[
                        styles.sexButton,
                        selected && styles.selectedSexButton,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={loading}
                    >
                      <Text
                        style={[
                          styles.sexText,
                          selected && styles.selectedSexText,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Parent / Guardian Information
            </Text>

            {renderInput(
              'Parent or guardian full name *',
              guardianName,
              setGuardianName,
              'Enter parent or guardian name'
            )}

            {renderInput(
              'Relationship to child *',
              relationship,
              setRelationship,
              'e.g. Mother, Father, Guardian'
            )}

            {renderInput(
              'Contact phone number *',
              phone,
              setPhone,
              'Enter contact phone number',
              { keyboardType: 'phone-pad' }
            )}
          </View>

          <Pressable
            onPress={() => setConsent(!consent)}
            style={styles.consentContainer}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            disabled={loading}
          >
            <View
              style={[
                styles.checkbox,
                consent && styles.checkedCheckbox,
              ]}
            >
              {consent && (
                <MaterialCommunityIcons
                  name="check"
                  size={19}
                  color="#FFFFFF"
                />
              )}
            </View>

            <Text style={styles.consentText}>
              I confirm that I am authorised to provide this information
              and consent to the creation of this child's profile.
            </Text>
          </Pressable>

          <Text style={styles.notice}>
            VitaBridge supports early awareness and screening. It does not
            replace professional medical assessment or diagnosis.
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={loading || profileLoading}
            accessibilityRole="button"
            style={[
              styles.submitButton,
              (loading || profileLoading) && styles.disabledButton,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitText}>
                  {isEditing
                    ? 'Update Child Profile'
                    : 'Complete Child Profile'}
                </Text>

                <MaterialCommunityIcons
                  name="arrow-right"
                  size={22}
                  color="#FFFFFF"
                />
              </>
            )}
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    marginRight: 10,
  },

  headerTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.text,
  },

  headerSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 3,
  },

  intro: {
    alignItems: 'center',
    marginBottom: 22,
  },

  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#E4F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  title: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.blue,
    textAlign: 'center',
  },

  description: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 18,
  },

  field: {
    marginBottom: 17,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 9,
  },

  input: {
    height: 55,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 15,
    fontSize: 15,
    color: COLORS.text,
  },

  dateHint: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: -8,
    marginBottom: 17,
  },

  sexContainer: {
    flexDirection: 'row',
    gap: 12,
  },

  sexButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#F7FAFA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedSexButton: {
    backgroundColor: '#E4F4F1',
    borderColor: COLORS.teal,
    borderWidth: 1.5,
  },

  sexText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  selectedSexText: {
    color: COLORS.teal,
  },

  consentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F4F2',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },

  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },

  checkedCheckbox: {
    backgroundColor: COLORS.teal,
  },

  consentText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 21,
  },

  notice: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
    marginBottom: 18,
  },

  submitButton: {
    minHeight: 58,
    borderRadius: 15,
    backgroundColor: COLORS.teal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 25,
  },

  disabledButton: {
    opacity: 0.6,
  },

  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  loadingContainer: {
    alignItems: 'center',
    padding: 35,
  },

  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 12,
  },

  editNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#E8F4F2',
    padding: 13,
    borderRadius: 12,
    marginBottom: 16,
  },

  editNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.text,
  },
});
