import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { COLORS } from '../../src/theme';
import { getPreventionOverview, saveDailyCheckIn } from '../../src/api';

const MOOD_CHOICES = [
  { score: 1, en: 'Very low', ar: 'منخفض جداً' },
  { score: 2, en: 'Low', ar: 'منخفض' },
  { score: 3, en: 'Okay', ar: 'مقبول' },
  { score: 4, en: 'Good', ar: 'جيد' },
  { score: 5, en: 'Very good', ar: 'جيد جداً' },
];

export default function AdultCheckInScreen() {
  const [isArabic, setIsArabic] = useState(false);
  const [sleepHours, setSleepHours] = useState('');
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'error' | 'success'>('error');

  useEffect(() => {
    getPreventionOverview()
      .then(({ data }) => {
        setIsArabic(data.language === 'ar');
        setSleepHours(
          data.today_check_in?.sleep_hours === null ||
            data.today_check_in?.sleep_hours === undefined
            ? ''
            : String(data.today_check_in.sleep_hours)
        );
        setMoodScore(data.today_check_in?.mood_score ?? null);
      })
      .catch((error: unknown) => {
        console.error('Unable to load today’s check-in:', error);
        setFeedback(
          'Unable to load today’s saved check-in. You can still enter and save your answers.'
        );
        setFeedbackType('error');
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (saving) return;
    const hasSleep = sleepHours.trim().length > 0;
    const parsedSleep = hasSleep ? Number(sleepHours) : undefined;
    if (
      hasSleep &&
      (parsedSleep === undefined ||
        !Number.isFinite(parsedSleep) ||
        parsedSleep < 0 ||
        parsedSleep > 24)
    ) {
      setFeedback(
        isArabic
          ? 'أدخل مدة النوم بين 0 و24 ساعة، أو اترك الحقل فارغاً.'
          : 'Enter sleep duration between 0 and 24 hours, or leave it blank.'
      );
      setFeedbackType('error');
      return;
    }
    if (parsedSleep === undefined && moodScore === null) {
      setFeedback(
        isArabic
          ? 'اختر مدة النوم أو الحالة المزاجية أو كليهما لحفظ تسجيلك.'
          : 'Choose sleep duration, mood, or both to save your check-in.'
      );
      setFeedbackType('error');
      return;
    }

    try {
      setSaving(true);
      setFeedback('');
      await saveDailyCheckIn({
        ...(parsedSleep !== undefined ? { sleep_hours: parsedSleep } : {}),
        ...(moodScore !== null ? { mood_score: moodScore } : {}),
      });
      setFeedback(
        isArabic
          ? 'تم حفظ تسجيلك. هذه ملاحظة شخصية عن صحتك وليست تقييماً طبياً.'
          : 'Your check-in is saved. It is a personal wellbeing note, not a medical assessment.'
      );
      setFeedbackType('success');
      router.replace('/adult/dashboard');
    } catch (error: unknown) {
      console.error('Unable to save daily check-in:', error);
      const detail = axios.isAxiosError<{ detail?: unknown }>(error)
        ? error.response?.data?.detail
        : undefined;
      setFeedback(
        typeof detail === 'string'
          ? detail
          : isArabic
            ? 'تعذر حفظ تسجيلك. يرجى المحاولة مرة أخرى.'
            : 'Unable to save your check-in. Please try again.'
      );
      setFeedbackType('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.text} />
          <Text style={styles.backText}>{isArabic ? 'رجوع' : 'Back'}</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name="weather-sunset-up" size={30} color={COLORS.teal} />
          </View>
          <Text style={[styles.eyebrow, isArabic && styles.rtlText]}>
            {isArabic ? 'تسجيل شخصي سريع' : 'A PRIVATE 30-SECOND CHECK-IN'}
          </Text>
          <Text style={[styles.title, isArabic && styles.rtlText]}>
            {isArabic ? 'كيف حالك اليوم؟' : 'How are you today?'}
          </Text>
          <Text style={[styles.description, isArabic && styles.rtlText]}>
            {isArabic
              ? 'تسجيل سريع لملاحظة نومك ومزاجك بمرور الوقت. السؤالان اختياريان، ولا ينتج عن إجاباتك درجة مخاطر أو تشخيص.'
              : 'A quick way to notice your own sleep and mood over time. Both questions are optional, and your answers do not produce a risk score or diagnosis.'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.teal} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={[styles.question, isArabic && styles.rtlText]}>
                {isArabic ? 'كم ساعة نمت الليلة الماضية؟' : 'How long did you sleep last night?'}
              </Text>
              <TextInput
                value={sleepHours}
                onChangeText={setSleepHours}
                placeholder={isArabic ? 'الساعات (0–24)' : 'Hours (0–24)'}
                placeholderTextColor={COLORS.muted}
                keyboardType="decimal-pad"
                style={styles.sleepInput}
                accessibilityLabel="Hours of sleep last night"
                textAlign={isArabic ? 'right' : 'left'}
              />
              <Pressable
                onPress={() => setSleepHours('')}
                accessibilityRole="button"
              >
                <Text style={styles.skipText}>
                  {isArabic ? 'تخطي سؤال النوم' : 'Skip sleep question'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={[styles.question, isArabic && styles.rtlText]}>
                {isArabic ? 'كيف تشعر اليوم؟' : 'How is your mood today?'}
              </Text>
              <View style={styles.moodOptions}>
                {MOOD_CHOICES.map(({ score, en, ar }) => {
                  const selected = moodScore === score;
                  return (
                    <Pressable
                      key={score}
                      onPress={() => setMoodScore(selected ? null : score)}
                      style={[styles.moodOption, selected && styles.selectedOption]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <Text style={[styles.optionText, selected && styles.selectedText]}>
                        {isArabic ? ar : en}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => setMoodScore(null)}
                accessibilityRole="button"
              >
                <Text style={styles.skipText}>
                  {isArabic ? 'تخطي سؤال المزاج' : 'Skip mood question'}
                </Text>
              </Pressable>
            </View>

            {feedback ? (
              <View
                style={[
                  styles.feedback,
                  feedbackType === 'success' ? styles.successFeedback : null,
                ]}
                accessibilityRole="alert"
              >
                <Text
                  style={[
                    styles.feedbackText,
                    feedbackType === 'success' ? styles.successText : null,
                  ]}
                >
                  {feedback}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.saveButton, saving && styles.disabled]}
              onPress={save}
              disabled={saving}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>
                  {isArabic ? 'حفظ التسجيل' : 'Save check-in'}
                </Text>
              )}
            </Pressable>

            <Text style={styles.privacy}>
              {isArabic
                ? 'يظهر تسجيلك في حسابك فقط. لا ترسله نورة إلى خدمة ذكاء اصطناعي خارجية.'
                : 'Your check-in is visible only in your signed-in account. Nura does not send it to an external AI service.'}
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, maxWidth: 700, width: '100%', alignSelf: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  backText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  header: { alignItems: 'center', marginVertical: 22 },
  icon: { width: 68, height: 68, borderRadius: 22, backgroundColor: '#E7F4F2', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  eyebrow: { color: COLORS.teal, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: COLORS.text, fontSize: 25, fontWeight: '900', marginTop: 8 },
  description: { color: COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 9 },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 17, marginBottom: 14 },
  question: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginBottom: 14 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minWidth: 51, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, alignItems: 'center' },
  moodOptions: { gap: 8 },
  sleepInput: { minHeight: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, color: COLORS.text, backgroundColor: '#FFFFFF' },
  moodOption: { minHeight: 42, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  selectedOption: { borderColor: COLORS.teal, backgroundColor: '#E7F4F2' },
  optionText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  selectedText: { color: COLORS.teal, fontWeight: '800' },
  skipText: { color: COLORS.teal, fontSize: 12, fontWeight: '700', marginTop: 13 },
  feedback: { backgroundColor: '#FCECEC', borderWidth: 1, borderColor: '#E8B8B8', borderRadius: 11, padding: 13, marginTop: 6 },
  successFeedback: { backgroundColor: '#E8F5EF', borderColor: '#A8D8BE' },
  feedbackText: { color: COLORS.danger, fontSize: 13, lineHeight: 19 },
  successText: { color: COLORS.success },
  saveButton: { backgroundColor: COLORS.teal, minHeight: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  privacy: { color: COLORS.muted, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 15 },
});
