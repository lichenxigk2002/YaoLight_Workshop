import http from '@/api/http';
import type { AdminSession } from '@/types/auth';

export interface LoginFormValues {
  username: string;
  password: string;
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginUser {
  id: number;
  username: string;
  role: string;
}

interface LoginResponse {
  token: string;
  user: LoginUser;
}

export async function adminLogin(values: LoginFormValues): Promise<AdminSession> {
  const response = await http.post<ApiEnvelope<LoginResponse>>('/auth/login', values);
  const payload = response.data.data;

  if (payload.user.role !== 'admin') {
    throw new Error('ADMIN_ONLY');
  }

  return {
    token: payload.token,
    user: {
      id: payload.user.id,
      username: payload.user.username,
      role: 'admin',
    },
  };
}
