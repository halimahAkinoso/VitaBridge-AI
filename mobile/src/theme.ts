export const COLORS = {
  teal: '#159C91',
  blue: '#245B83',
  background: '#F0F6F5',
  accent: '#E9B96E',
  text: '#19313A',
  muted: '#62757A',
  surface: '#FFFFFF',
  border: '#D9E7E5',
  danger: '#B54747',
  success: '#25755F',
};

export const SHADOW = {
  shadowColor: '#16333A',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 2,
};

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';