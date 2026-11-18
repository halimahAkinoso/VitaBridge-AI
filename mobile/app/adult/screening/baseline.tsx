
import React, { useState } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Screen } from '../../../components/Screen';
import { COLORS, SHADOW } from '../../../src/theme';
import { saveAdultBaseline } from '../../../src/api';

type BaselineForm = {
  health_conditions: string[];
  blood_pressure_history: string;
  systolic_bp_mmhg: string;
  diastolic_bp_mmhg: string;
  blood_glucose_mmol_l: string;
  cholesterol_mmol_l: string;
  weight_kg: string;
  sleep_quality: string;
  sleep_hours: string;
  snoring: string;
  physical_activity: string;
  social_engagement: string;
  everyday_function: string;
  mood: string;
  memory_concerns: string;
  family_history: string;
  additional_notes: string;
};

const INITIAL_FORM: BaselineForm = {
  health_conditions: [],
  blood_pressure_history: '',
  systolic_bp_mmhg: '',
  diastolic_bp_mmhg: '',
  blood_glucose_mmol_l: '',
  cholesterol_mmol_l: '',
  weight_kg: '',
  sleep_quality: '',
  sleep_hours: '',
  snoring: '',
  physical_activity: '',
  social_engagement: '',
  everyday_function: '',
  mood: '',
  memory_concerns: '',
  family_history: '',
  additional_notes: '',
};

const HEALTH_CONDITIONS = [
  'Hypertension',
  'Diabetes',
  'High cholesterol',
  'Heart disease',
  'Previous stroke',
  'None of the above',
  'Prefer not to say',
];

const BLOOD_PRESSURE_OPTIONS = [
  'Normal',
  'Sometimes high',
  'Frequently high',
  'Under treatment',
  'Not sure',
  'Prefer not to say',
];

const SLEEP_OPTIONS = [
  'Very good',
  'Good',
  'Fair',
  'Poor',
  'Very poor',
];

const ACTIVITY_OPTIONS = [
  'Very active',
  'Moderately active',
  'Lightly active',
  'Not physically active',
];

const SOCIAL_OPTIONS = [
  'Very often',
  'Often',
  'Sometimes',
  'Rarely',
];

const MOOD_OPTIONS = [
  'Very good',
  'Good',
  'Fair',
  'Low',
  'Prefer not to say',
];

const MEMORY_OPTIONS = [
  'No concerns',
  'Occasional forgetfulness',
  'Frequent forgetfulness',
  'Memory concerns affecting daily activities',
  'Prefer not to say',
];

const SNORING_OPTIONS = [
  'No',
  'Sometimes',
  'Often',
  'Not sure',
  'Prefer not to say',
];

const FUNCTION_OPTIONS = [
  'No change',
  'A little harder',
  'Much harder',
  'Not sure',
  'Prefer not to say',
];

const FAMILY_HISTORY_OPTIONS = [
  'Yes',
  'No',
  'Not sure',
  'Prefer not to say',
];

type OptionGroupProps = {
  label: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
};

function OptionGroup({
  label,
  options,
  value,
  onSelect,
}: OptionGroupProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.options}>
        {options.map((option) => {
          const selected = value === option;

          return (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              style={[
                styles.option,
                selected && styles.optionSelected,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                ]}
              >
                {option}
              </Text>

              {selected && (
                <Ionicons
                  name="checkmark-circle"
                  size={17}
                  color="#FFFFFF"
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function NumberField({
  label,
  value,
  placeholder,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={[styles.field, styles.measurementField]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType="decimal-pad"
        style={styles.numericInput}
      />
    </View>
  );
}

function ConditionSelector({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        Have you been diagnosed with any of these conditions?
      </Text>

      <Text style={styles.helper}>
        Select all that apply. You may also choose None of the above
        or Prefer not to say.
      </Text>

      <View style={styles.conditionList}>
        {HEALTH_CONDITIONS.map((condition) => {
          const checked = selected.includes(condition);

          return (
            <Pressable
              key={condition}
              onPress={() => onToggle(condition)}
              style={[
                styles.conditionOption,
                checked && styles.conditionOptionSelected,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              <View
                style={[
                  styles.checkbox,
                  checked && styles.checkboxChecked,
                ]}
              >
                {checked && (
                  <Ionicons
                    name="checkmark"
                    size={15}
                    color="#FFFFFF"
                  />
                )}
              </View>

              <Text
                style={[
                  styles.conditionText,
                  checked && styles.conditionTextSelected,
                ]}
              >
                {condition}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AdultBaselineScreen() {
  const [form, setForm] = useState<BaselineForm>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'error' | 'success' | ''>('');

  const updateField = (
    field: keyof BaselineForm,
    value: string
  ) => {
    setFeedback('');
    setFeedbackType('');
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const toggleCondition = (condition: string) => {
    setFeedback('');
    setFeedbackType('');
    setForm((previous) => {
      let updated = [...previous.health_conditions];

      if (
        condition === 'None of the above' ||
        condition === 'Prefer not to say'
      ) {
        updated = updated.includes(condition) ? [] : [condition];
      } else {
        updated = updated.filter(
          (item) =>
            item !== 'None of the above' &&
            item !== 'Prefer not to say'
        );

        updated = updated.includes(condition)
          ? updated.filter((item) => item !== condition)
          : [...updated, condition];
      }

      return {
        ...previous,
        health_conditions: updated,
      };
    });
  };

  const validateForm = () => {
    const requiredFields: {
      key: keyof BaselineForm;
      label: string;
    }[] = [
      {
        key: 'blood_pressure_history',
        label: 'Blood pressure history',
      },
      {
        key: 'sleep_quality',
        label: 'Sleep quality',
      },
      {
        key: 'physical_activity',
        label: 'Physical activity',
      },
      {
        key: 'social_engagement',
        label: 'Social engagement',
      },
      {
        key: 'mood',
        label: 'Mood',
      },
      {
        key: 'memory_concerns',
        label: 'Memory concerns',
      },
    ];

    const missing = requiredFields.find(
      (field) => !String(form[field.key]).trim()
    );

    if (missing) {
      setFeedback(`Please complete: ${missing.label}.`);
      setFeedbackType('error');
      return false;
    }

    if (form.health_conditions.length === 0) {
      setFeedback(
        'Please select a health history option or Prefer not to say.'
      );
      setFeedbackType('error');
      return false;
    }

    const numericFields: {
      key: keyof BaselineForm;
      label: string;
      min: number;
      max: number;
    }[] = [
      { key: 'systolic_bp_mmhg', label: 'Systolic blood pressure', min: 50, max: 300 },
      { key: 'diastolic_bp_mmhg', label: 'Diastolic blood pressure', min: 30, max: 200 },
      { key: 'blood_glucose_mmol_l', label: 'Blood glucose', min: 0, max: 60 },
      { key: 'cholesterol_mmol_l', label: 'Cholesterol', min: 0, max: 60 },
      { key: 'weight_kg', label: 'Weight', min: 1, max: 500 },
      { key: 'sleep_hours', label: 'Sleep duration', min: 0, max: 24 },
    ];
    const invalidNumber = numericFields.find(({ key, min, max }) => {
      const value = String(form[key]).trim();
      if (!value) return false;
      const parsed = Number(value);
      return !Number.isFinite(parsed) || parsed < min || parsed > max;
    });
    if (invalidNumber) {
      setFeedback(
        `Enter a valid ${invalidNumber.label.toLowerCase()} or leave it blank.`
      );
      setFeedbackType('error');
      return false;
    }

    setFeedback('');
    setFeedbackType('');
    return true;
  };

  const handleSave = async () => {
    if (saving || completed) return;
    if (!validateForm()) return;

    try {
      setSaving(true);
      setFeedback('');
      setFeedbackType('');

      // Match the FastAPI AdultBaselineRequest field names exactly.
      const payload: BaselineForm = {
        health_conditions: form.health_conditions,
        blood_pressure_history: form.blood_pressure_history.trim(),
        systolic_bp_mmhg: form.systolic_bp_mmhg.trim(),
        diastolic_bp_mmhg: form.diastolic_bp_mmhg.trim(),
        blood_glucose_mmol_l: form.blood_glucose_mmol_l.trim(),
        cholesterol_mmol_l: form.cholesterol_mmol_l.trim(),
        weight_kg: form.weight_kg.trim(),
        sleep_quality: form.sleep_quality.trim(),
        sleep_hours: form.sleep_hours.trim(),
        snoring: form.snoring.trim(),
        physical_activity: form.physical_activity.trim(),
        social_engagement: form.social_engagement.trim(),
        everyday_function: form.everyday_function.trim(),
        mood: form.mood.trim(),
        memory_concerns: form.memory_concerns.trim(),
        family_history: form.family_history.trim(),
        additional_notes: form.additional_notes.trim(),
      };

      const optionalNumber = (value: string) =>
        value.trim() ? Number(value) : undefined;
      await saveAdultBaseline({
        ...payload,
        systolic_bp_mmhg: optionalNumber(payload.systolic_bp_mmhg),
        diastolic_bp_mmhg: optionalNumber(payload.diastolic_bp_mmhg),
        blood_glucose_mmol_l: optionalNumber(payload.blood_glucose_mmol_l),
        cholesterol_mmol_l: optionalNumber(payload.cholesterol_mmol_l),
        weight_kg: optionalNumber(payload.weight_kg),
        sleep_hours: optionalNumber(payload.sleep_hours),
      });

      setCompleted(true);
      setFeedback('Your baseline assessment has been saved. Continuing to Hearing and Vision...');
      setFeedbackType('success');

      // Do not depend on Alert.alert: it does not behave consistently on web.
      router.replace('/adult/screening/hearing-vision');
    } catch (error: any) {
      console.error(
        'Adult baseline save failed:',
        error?.response?.data || error
      );

      const detail = error?.response?.data?.detail;
      let message = 'Unable to save your assessment. Please check your connection and try again.';

      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail
          .map((item: any) => item?.msg || item?.message || String(item))
          .join(' ');
      } else if (typeof error?.message === 'string') {
        message = error.message;
      }

      setFeedback(message);
      setFeedbackType('error');
    } finally {
      setSaving(false);
    }
  };

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
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={21}
              color={COLORS.text}
            />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.header}>
            <View style={styles.logo}>
              <MaterialCommunityIcons
                name="brain"
                size={35}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.brand}>VitaBridge</Text>

            <Text style={styles.tagline}>
              Protecting Brain Health Earlier
            </Text>
          </View>

          <View style={styles.headingSection}>
            <Text style={styles.eyebrow}>
              ADULT BRAIN HEALTH SCREENING
            </Text>

            <Text style={styles.heading}>
              Health Baseline Assessment
            </Text>

            <Text style={styles.description}>
              Tell us about your general health, lifestyle and
              wellbeing. This information helps establish your
              baseline for preventive brain health awareness.
            </Text>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                Assessment progress
              </Text>

              <Text style={styles.progressCount}>
                Step 2 of 4
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeading}>
              <Ionicons
                name="medical-outline"
                size={22}
                color={COLORS.teal}
              />

              <Text style={styles.sectionTitle}>
                Health History
              </Text>
            </View>

            <ConditionSelector
              selected={form.health_conditions}
              onToggle={toggleCondition}
            />

            <OptionGroup
              label="How would you describe your blood pressure history?"
              options={BLOOD_PRESSURE_OPTIONS}
              value={form.blood_pressure_history}
              onSelect={(value) =>
                updateField('blood_pressure_history', value)
              }
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent measurements (optional)</Text>
            <Text style={styles.helper}>
              Enter a value only if you know it. These are stored as self-reported
              measurements and are not interpreted as a result.
            </Text>
            <View style={styles.measurementRow}>
              <NumberField
                label="Systolic blood pressure (mmHg)"
                value={form.systolic_bp_mmhg}
                placeholder="e.g. 120"
                onChangeText={(value) => updateField('systolic_bp_mmhg', value)}
              />
              <NumberField
                label="Diastolic blood pressure (mmHg)"
                value={form.diastolic_bp_mmhg}
                placeholder="e.g. 80"
                onChangeText={(value) => updateField('diastolic_bp_mmhg', value)}
              />
            </View>
            <View style={styles.measurementRow}>
              <NumberField
                label="Blood glucose (mmol/L)"
                value={form.blood_glucose_mmol_l}
                placeholder="Optional"
                onChangeText={(value) => updateField('blood_glucose_mmol_l', value)}
              />
              <NumberField
                label="Total cholesterol (mmol/L)"
                value={form.cholesterol_mmol_l}
                placeholder="Optional"
                onChangeText={(value) => updateField('cholesterol_mmol_l', value)}
              />
            </View>
            <NumberField
              label="Weight (kg)"
              value={form.weight_kg}
              placeholder="Optional"
              onChangeText={(value) => updateField('weight_kg', value)}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeading}>
              <Ionicons
                name="moon-outline"
                size={22}
                color={COLORS.teal}
              />

              <Text style={styles.sectionTitle}>
                Lifestyle and Wellbeing
              </Text>
            </View>

            <OptionGroup
              label="How would you describe your sleep quality?"
              options={SLEEP_OPTIONS}
              value={form.sleep_quality}
              onSelect={(value) =>
                updateField('sleep_quality', value)
              }
            />

            <NumberField
              label="About how many hours do you usually sleep?"
              value={form.sleep_hours}
              placeholder="Optional"
              onChangeText={(value) => updateField('sleep_hours', value)}
            />

            <OptionGroup
              label="Do you snore, or has anyone mentioned pauses in your breathing during sleep?"
              options={SNORING_OPTIONS}
              value={form.snoring}
              onSelect={(value) => updateField('snoring', value)}
            />

            <OptionGroup
              label="How would you describe your physical activity?"
              options={ACTIVITY_OPTIONS}
              value={form.physical_activity}
              onSelect={(value) =>
                updateField('physical_activity', value)
              }
            />

            <OptionGroup
              label="How often do you engage socially with family, friends or your community?"
              options={SOCIAL_OPTIONS}
              value={form.social_engagement}
              onSelect={(value) =>
                updateField('social_engagement', value)
              }
            />

            <OptionGroup
              label="Have everyday activities become more difficult than usual?"
              options={FUNCTION_OPTIONS}
              value={form.everyday_function}
              onSelect={(value) => updateField('everyday_function', value)}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeading}>
             <MaterialCommunityIcons
  name="brain"
  size={35}
  color="#FFFFFF"
/>

              <Text style={styles.sectionTitle}>
                Mood and Memory
              </Text>
            </View>

            <OptionGroup
              label="How would you describe your general mood recently?"
              options={MOOD_OPTIONS}
              value={form.mood}
              onSelect={(value) => updateField('mood', value)}
            />

            <OptionGroup
              label="Have you noticed any changes or concerns about your memory?"
              options={MEMORY_OPTIONS}
              value={form.memory_concerns}
              onSelect={(value) =>
                updateField('memory_concerns', value)
              }
            />

            <OptionGroup
              label="Is there a known family history of memory or brain health conditions? (optional)"
              options={FAMILY_HISTORY_OPTIONS}
              value={form.family_history}
              onSelect={(value) => updateField('family_history', value)}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Additional Information
            </Text>

            <Text style={styles.label}>
              Anything else you would like us to know?
            </Text>

            <TextInput
              value={form.additional_notes}
              onChangeText={(value) =>
                updateField('additional_notes', value)
              }
              placeholder="Enter any additional information (optional)"
              placeholderTextColor={COLORS.muted}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              style={styles.textArea}
            />

            <Text style={styles.helper}>
              Maximum 1,000 characters.
            </Text>
          </View>

          <View style={styles.notice}>
            <Ionicons
              name="information-circle-outline"
              size={23}
              color={COLORS.blue}
            />

            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>
                Important Information
              </Text>

              <Text style={styles.noticeText}>
                This assessment collects self-reported health and
                lifestyle information. It does not diagnose a
                medical condition or determine cognitive ability.
                Your responses should be discussed with a qualified
                healthcare professional where appropriate.
              </Text>
            </View>
          </View>

          {feedback ? (
            <View
              style={[
                styles.feedbackBox,
                feedbackType === 'success'
                  ? styles.feedbackSuccess
                  : styles.feedbackError,
              ]}
              accessibilityRole="alert"
            >
              <Text
                style={[
                  styles.feedbackText,
                  feedbackType === 'success'
                    ? styles.feedbackSuccessText
                    : styles.feedbackErrorText,
                ]}
              >
                {feedback}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={handleSave}
            disabled={saving || completed}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.saveButtonText}>
                  Save and Continue
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color="#FFFFFF"
                />
              </>
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
    paddingBottom: 45,
    width: '100%',
    maxWidth: 750,
    alignSelf: 'center',
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 8,
    marginBottom: 15,
  },

  backText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },

  header: {
    alignItems: 'center',
    marginBottom: 25,
  },

  logo: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 9,
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

  eyebrow: {
    color: COLORS.teal,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
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
    lineHeight: 22,
  },

  progressCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 17,
    marginBottom: 20,
    ...SHADOW,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  progressTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },

  progressCount: {
    color: COLORS.muted,
    fontSize: 12,
  },

  progressTrack: {
    height: 8,
    borderRadius: 10,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },

  progressFill: {
    width: '50%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: COLORS.teal,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 17,
    padding: 18,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.blue,
  },

  field: {
    marginBottom: 22,
  },

  measurementRow: {
    flexDirection: 'row',
    gap: 12,
  },

  measurementField: {
    flex: 1,
    minWidth: 0,
  },

  numericInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: COLORS.text,
    backgroundColor: '#FFFFFF',
  },

  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    lineHeight: 20,
  },

  helper: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 7,
    lineHeight: 17,
  },

  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },

  option: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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

  // This style fixes the TypeScript error.
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  conditionList: {
    gap: 9,
    marginTop: 5,
  },

  conditionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    gap: 11,
    backgroundColor: '#FFFFFF',
  },

  conditionOptionSelected: {
    borderColor: COLORS.teal,
    backgroundColor: '#EAF5F3',
  },

  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxChecked: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },

  conditionText: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
  },

  conditionTextSelected: {
    color: COLORS.teal,
    fontWeight: '700',
  },

  textArea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    padding: 13,
    color: COLORS.text,
    backgroundColor: '#FFFFFF',
    fontSize: 13,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    backgroundColor: '#E8F1F5',
    padding: 16,
    borderRadius: 13,
    marginBottom: 20,
  },

  noticeContent: {
    flex: 1,
  },

  noticeTitle: {
    color: COLORS.blue,
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
    minHeight: 54,
    borderRadius: 13,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
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

  feedbackBox: {
    padding: 13,
    borderRadius: 11,
    marginBottom: 14,
    borderWidth: 1,
  },

  feedbackSuccess: {
    backgroundColor: '#E8F5EF',
    borderColor: '#A8D8BE',
  },

  feedbackError: {
    backgroundColor: '#FCECEC',
    borderColor: '#E8B8B8',
  },

  feedbackText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },

  feedbackSuccessText: {
    color: '#25755F',
  },

  feedbackErrorText: {
    color: COLORS.danger,
  },

  footer: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 22,
  },
});



