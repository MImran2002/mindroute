export interface HealthStatus {
    status: 'ok';
    service: string;
    version: string;
    timestamp: string;
    uptimeSeconds: number;
}
export declare class HealthService {
    getHealth(): HealthStatus;
}
