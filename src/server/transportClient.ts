import axios from 'axios';
import type { SendRequest } from '../shared/contracts.ts';

export function sendToTransport(baseUrl: string, message: SendRequest) {
  const url = new URL('/api/v1/send', baseUrl);
  return axios.post(url.href, message, { timeout: 3_000 });
}
