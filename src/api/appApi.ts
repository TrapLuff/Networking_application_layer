import axios from 'axios';
import type {
  ApiError,
  GenerateRequest,
  GenerateResponse,
  LoginRequest,
  SessionResponse,
} from '../shared/contracts.ts';

const api = axios.create({ baseURL: '/api', timeout: 8_000 });

export async function getSession(signal?: AbortSignal) {
  const { data } = await api.get<SessionResponse>('/session', { signal });
  return data.user;
}

export async function login(credentials: LoginRequest) {
  const { data } = await api.post<{ user: NonNullable<SessionResponse['user']> }>('/login', credentials);
  return data.user;
}

export async function generate(topic: string) {
  const request: GenerateRequest = { document_topic: topic };
  const { data } = await api.post<GenerateResponse>('/generate', request);
  return data;
}

export async function logout() {
  await api.post('/logout');
}

export function apiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiError>(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}
