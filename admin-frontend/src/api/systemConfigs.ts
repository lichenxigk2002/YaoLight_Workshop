import http from '@/api/http';
import axios from 'axios';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const response = await promise;
    if (response.data.code !== 200) {
      throw new Error(response.data.message || 'Request failed');
    }
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
      throw new Error(error.response?.data?.message || error.message || 'Request failed');
    }
    throw error;
  }
}

export interface SendEmailDebugPayload {
  to: string;
  subject?: string;
  body?: string;
  attachment_name?: string;
  attachment_content?: string;
}

export interface SendEmailDebugResult {
  to: string;
  subject: string;
  attachment_name: string;
}

export function sendEmailDebug(payload: SendEmailDebugPayload) {
  return unwrap<SendEmailDebugResult>(http.post('/admin/system-configs/email/debug', payload));
}
