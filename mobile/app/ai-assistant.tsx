import React, { useEffect, useRef, useState } from 'react';
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
import axios from 'axios';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { COLORS } from '../src/theme';
import { agentChat, getNuraContext } from '../src/api';

type Message = {
  id: string;
  role: 'nura' | 'you';
  text: string;
};

function NuraMessageText({
  message,
  isArabic,
}: {
  message: Message;
  isArabic: boolean;
}) {
  const start = message.role === 'nura' ? message.text.indexOf('**') : -1;
  const end = start >= 0 ? message.text.indexOf('**', start + 2) : -1;
  const textStyle = [
    styles.messageText,
    message.role === 'you' && styles.userMessageText,
    isArabic && styles.rtlText,
  ];

  if (start < 0 || end < 0) {
    return <Text style={textStyle}>{message.text}</Text>;
  }

  return (
    <Text style={textStyle}>
      {message.text.slice(0, start)}
      <Text style={styles.boldAction}>
        {message.text.slice(start + 2, end)}
      </Text>
      {message.text.slice(end + 2)}
    </Text>
  );
}

export default function NuraAssistantScreen() {
  const [isArabic, setIsArabic] = useState(false);
  const [isChild, setIsChild] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'nura',
      text: "Hello, I'm Nura. I can explain your saved prevention steps, help you think through a barrier, and suggest questions for your care team. I do not diagnose or book appointments.",
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [nextAction, setNextAction] = useState('');
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    getNuraContext()
      .then(({ data }) => {
        const arabic = data.language === 'ar';
        const child = data.person_type === 'child';
        setIsArabic(arabic);
        setIsChild(child);
        setNextAction(data.next_best_action?.detail || '');
        setMessages((items) =>
          items.length === 1 && items[0].id === 'welcome'
            ? [
                {
                  ...items[0],
                  text: arabic
                    ? child
                      ? 'مرحباً، أنا نورة. أشرح سجل نمو طفلك وخطوات المتابعة المسجلة، وأساعدك في الاستعداد لزيارة الطفل الوقائية. لا أقدم تشخيصاً.'
                      : 'مرحباً، أنا نورة. أشرح نتائجك وخطوات الوقاية المسجلة وأساعدك على التفكير في العوائق وتجهيز أسئلة لفريق الرعاية. لا أقدم تشخيصاً.'
                    : child
                      ? "Hello, I'm Nura. I can explain your child's saved developmental records and follow-up steps, and help you prepare for a Well-Child Visit. I do not diagnose."
                      : "Hello, I'm Nura. I can explain your saved results and prevention steps, help you think through a barrier, and suggest questions for your care team. I do not diagnose.",
                },
              ]
            : items
        );
      })
      .catch((requestError: unknown) => {
        console.error('Unable to load Nura context:', requestError);
        setError('Sign in with an adult or parent account and complete the health profile to use Nura.');
      });
  }, []);

  const send = async (message = input) => {
    const text = message.trim();
    if (!text || sending) return;

    setInput('');
    setError('');
    setMessages((items) => [
      ...items,
      { id: `you-${Date.now()}`, role: 'you', text },
    ]);
    setSending(true);

    try {
      const { data } = await agentChat(text);
      setMessages((items) => [
        ...items,
        {
          id: `nura-${Date.now()}`,
          role: 'nura',
          text: data.reply,
        },
      ]);
    } catch (requestError: unknown) {
      console.error('Nura message failed:', requestError);
      const detail = axios.isAxiosError<{ detail?: unknown }>(requestError)
        ? requestError.response?.data?.detail
        : undefined;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Nura could not respond. Please try again.'
      );
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
    }
  };

  const quickPrompts = isChild
    ? isArabic
      ? ['اشرح سجل نمو طفلي', 'ما خطوتنا التالية؟', 'ما الزيارة الوقائية المستحقة؟', 'كيف أتابع التطور؟']
      : ["Explain my child's screening", 'What is our next step?', 'Which Well-Child Visit is due?', 'How can I support development?']
    : isArabic
      ? ['اشرح نتيجتي', 'ما خطوتي التالية؟', 'اشرح فحص الإدراك', 'فاتني موعد متابعة']
      : ['Explain my result', 'What is my next step?', 'Explain cognitive screening', 'I missed a follow-up'];

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={23} color={COLORS.text} />
          </Pressable>
          <View style={styles.nuraIcon}>
            <MaterialCommunityIcons name="brain" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Nura</Text>
            <Text style={styles.subtitle}>
              {isArabic ? 'دليلك للوقاية' : 'Your prevention guide'}
            </Text>
          </View>
        </View>

        {nextAction ? (
          <View style={styles.nextAction}>
            <Text style={styles.nextActionLabel}>
              {isArabic
                ? isChild ? 'الخطوة التالية' : 'خطوتك التالية'
                : isChild ? 'YOUR CHILD’S NEXT STEP' : 'YOUR NEXT STEP'}
            </Text>
            <Text style={[styles.nextActionText, isArabic && styles.rtlText]}>
              {nextAction}
            </Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.message,
                message.role === 'you' ? styles.userMessage : styles.nuraMessage,
              ]}
            >
              <Text style={[styles.messageRole, isArabic && styles.rtlText]}>
                {message.role === 'you'
                  ? isArabic
                    ? 'أنت'
                    : 'You'
                  : isArabic
                    ? 'نورة'
                    : 'Nura'}
              </Text>
              <NuraMessageText message={message} isArabic={isArabic} />
            </View>
          ))}
          {sending ? (
            <View style={styles.typing}>
              <ActivityIndicator size="small" color={COLORS.teal} />
              <Text style={styles.typingText}>
                {isArabic ? 'نورة تجهز الرد...' : 'Nura is preparing a response...'}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPrompts}
        >
          {quickPrompts.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => send(prompt)}
              style={styles.prompt}
              disabled={sending}
            >
              <Text style={styles.promptText}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={isArabic ? 'اكتب سؤالك لنورة' : 'Ask Nura a question'}
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            multiline
            maxLength={1000}
            accessibilityLabel="Message Nura"
            textAlign={isArabic ? 'right' : 'left'}
          />
          <Pressable
            onPress={() => send()}
            disabled={sending || !input.trim()}
            style={[styles.sendButton, (!input.trim() || sending) && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          {isArabic
            ? 'نورة دليل وليست مختصة صحية. تستخدم الردود بياناتك المحفوظة ولا تُرسل إلى خدمة ذكاء اصطناعي خارجية. للحالات العاجلة، اتصل بمختص صحي أو بخدمات الطوارئ المحلية.'
            : 'Nura is a guide, not a clinician. Responses use your saved app data and are not sent to an external AI service. For urgent concerns, contact a healthcare professional or local emergency service.'}
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { width: 35, height: 42, justifyContent: 'center' },
  nuraIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  headerText: { flex: 1 },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  subtitle: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  nextAction: { backgroundColor: '#E7F4F2', padding: 13, margin: 14, borderRadius: 12 },
  nextActionLabel: { color: COLORS.teal, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  nextActionText: { color: COLORS.text, fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 4 },
  messages: { padding: 14, gap: 11 },
  message: { maxWidth: '88%', padding: 13, borderRadius: 15 },
  nuraMessage: { alignSelf: 'flex-start', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderTopLeftRadius: 4 },
  userMessage: { alignSelf: 'flex-end', backgroundColor: COLORS.teal, borderTopRightRadius: 4 },
  messageRole: { color: COLORS.teal, fontSize: 10, fontWeight: '900', marginBottom: 5 },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  messageText: { color: COLORS.text, fontSize: 13, lineHeight: 20 },
  boldAction: { color: COLORS.text, fontWeight: '900' },
  userMessageText: { color: '#FFFFFF' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  typingText: { color: COLORS.muted, fontSize: 11 },
  quickPrompts: { gap: 8, paddingHorizontal: 14, paddingVertical: 9 },
  prompt: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.surface },
  promptText: { color: COLORS.teal, fontSize: 11, fontWeight: '700' },
  error: { color: COLORS.danger, paddingHorizontal: 14, paddingBottom: 8, fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingHorizontal: 14, paddingTop: 9, borderTopWidth: 1, borderTopColor: COLORS.border },
  input: { flex: 1, minHeight: 44, maxHeight: 110, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, fontSize: 13 },
  sendButton: { width: 43, height: 43, borderRadius: 14, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  disclaimer: { color: COLORS.muted, fontSize: 10, lineHeight: 15, paddingHorizontal: 15, paddingTop: 8, paddingBottom: 10, textAlign: 'center' },
});
