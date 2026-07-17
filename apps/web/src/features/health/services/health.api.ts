import { apiRequest } from '@/lib/api-client';

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
}

export function getApiHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health');
}
