
import axios from 'axios';
import { API_URL } from './theme';
import { getToken } from './auth/tokenStorage';

let authToken: string | null = null;

// --------------------------------------
// AUTHENTICATION TOKEN MANAGEMENT
// --------------------------------------

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

export const clearAuthToken = () => {
  authToken = null;
};

// --------------------------------------
// AXIOS CLIENT
// --------------------------------------

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --------------------------------------
// AUTHENTICATION INTERCEPTOR
// --------------------------------------

api.interceptors.request.use(async (config) => {
  try {
    const savedToken = await getToken();
    const token = savedToken || authToken;

    const isPublicEndpoint =
      config.url?.includes('/auth/login') ||
      config.url?.includes('/auth/register');

    if (token && !isPublicEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
      authToken = token;
    }
  } catch (error) {
    console.error('Unable to retrieve authentication token:', error);

    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
  }

  return config;
});

// --------------------------------------
// AUTHENTICATION
// --------------------------------------

export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

export const register = (payload: Record<string, unknown>) =>
  api.post('/auth/register', payload);

// --------------------------------------
// ADMINISTRATOR
// --------------------------------------

export interface CreateDoctorPayload {
  name: string;
  email: string;
  password: string;
}

export const createDoctorAccount = (
  payload: CreateDoctorPayload
) => api.post('/auth/admin/create-doctor', payload);

// --------------------------------------
// GENERAL SCREENING
// --------------------------------------

export const adultScreen = (payload: Record<string, unknown>) =>
  api.post('/screening/adult', payload);

export const childScreen = (payload: Record<string, unknown>) =>
  api.post('/screening/child', payload);

export const getScreeningHistory = () =>
  api.get('/screening/history');

export const getScreeningInstruments = () =>
  api.get('/screening/instruments');

// --------------------------------------
// CHILD SCREENING AND CLINICIAN REVIEW
// --------------------------------------

export const getChildClinicianQueue = () =>
  api.get('/screening/clinician/child-queue');

export const getAdultClinicianQueue = () =>
  api.get('/screening/clinician/adult-queue');

export const submitAdultClinicalReview = (
  personId: number,
  payload: {
    decision: 'WATCH' | 'ACT' | 'REFER' | 'MONITOR' | 'FOLLOW_UP';
    risk: 'NOT_ASSESSED' | 'LOW' | 'MODERATE' | 'ELEVATED';
    note: string;
    next_action: string;
    referral_specialty?: string;
  }
) =>
  api.post(`/screening/clinician/adult-review/${personId}`, payload);

export const reviewChildScreening = (
  screeningId: number,
  payload: {
    decision: 'MONITOR' | 'FOLLOW_UP' | 'REFER';
    clinician_note: string;
    next_action: string;
    risk:
      | 'NOT_ASSESSED'
      | 'FOLLOW_UP_RECOMMENDED'
      | 'URGENT_REVIEW';
    referral_specialty?: string;
  }
) =>
  api.post(
    `/screening/clinician/child-review/${screeningId}`,
    payload
  );

// --------------------------------------
// REFERRAL TRACKING
// --------------------------------------

export const getReferralTracking = () =>
  api.get('/screening/referrals');

export const updateReferralStatus = (
  referralId: number,
  status:
    | 'OPEN'
    | 'SCHEDULED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
) =>
  api.patch(
    `/screening/clinician/referrals/${referralId}`,
    { status }
  );

// --------------------------------------
// ADULT PROFILE
// --------------------------------------

export const getAdultProfile = () =>
  api.get('/screening/adult/profile');

export const saveAdultProfile = (payload: {
  name: string;
  dob: string;
  sex?: string;
  nationality?: string;
  language: string;
  education?: string;
  culture?: string;
}) =>
  api.put('/screening/adult/profile', payload);

// --------------------------------------
// ADULT BRAIN HEALTH BASELINE
// --------------------------------------

export interface AdultBaselinePayload {
  health_conditions: string[];
  blood_pressure_history: string;
  systolic_bp_mmhg?: number;
  diastolic_bp_mmhg?: number;
  blood_glucose_mmol_l?: number;
  cholesterol_mmol_l?: number;
  weight_kg?: number;
  sleep_quality: string;
  sleep_hours?: number;
  snoring?: string;
  physical_activity: string;
  social_engagement: string;
  everyday_function?: string;
  mood: string;
  memory_concerns: string;
  family_history?: string;
  additional_notes?: string;
}

export const saveAdultBaseline = (
  payload: AdultBaselinePayload
) =>
  api.post('/screening/adult/baseline', payload);

// --------------------------------------
// AI ASSISTANT
// --------------------------------------

export const agentChat = (message: string) =>
  api.post('/agent/chat', { message });

export const getNuraContext = () =>
  api.get('/agent/nura-context');

export const getPreventionOverview = () =>
  api.get('/agent/overview');

export const getAdultResults = () =>
  api.get('/agent/results');

export const getAdultActionPlan = () =>
  api.get('/agent/plan');

export const getFamilyHealthPassport = () =>
  api.get('/passport/family/me');

export const saveDailyCheckIn = (payload: {
  sleep_hours?: number;
  mood_score?: number;
}) =>
  api.post('/agent/check-in', payload);

// --------------------------------------
// DOCTOR / PRACTITIONER
// --------------------------------------

export const getDoctorDashboard = () =>
  api.get('/doctor/dashboard');

export const getDoctorScreening = (screeningId: number) =>
  api.get(`/doctor/screening/${screeningId}`);

export const submitDoctorReview = (
  screeningId: number,
  payload: {
    decision: string;
    note: string;
  }
) =>
  api.post(`/doctor/review/${screeningId}`, payload);

// --------------------------------------
// NOTIFICATIONS
// --------------------------------------

export const getNotifications = (id: number) =>
  api.get(`/notifications/${id}`);

// --------------------------------------
// USER PROFILE
// --------------------------------------

export const getCurrentUser = () =>
  api.get('/users/me');

export const saveProfile = (
  payload: Record<string, unknown>
) =>
  api.post('/users/profile', payload);


export const saveAdultHearingVision = async (payload: {
  responses: Record<string, string>;
  completed_at: string;
}) => {
  const response = await api.post(
    '/screening/adult/hearing-vision',
    payload
  );

  return response.data;
};

export const getAdultScreeningHistory = () =>
  api.get('/screening/adult/history');