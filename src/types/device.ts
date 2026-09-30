/**
 * Device type definitions
 */

export type DeviceStatus = 'ONLINE' | 'OFFLINE';

export interface DeviceMetrics {
  cpu_usage?: number;
  signal_strength?: number;
  [key: string]: any;
}

export interface Device {
  id: string;
  name: string;
  lastHeartbeat: Date;
  status: DeviceStatus;
  metrics?: DeviceMetrics;
}

export interface HeartbeatRequest {
  timestamp: string;
  status: string;
  cpu_usage?: number;
  signal_strength?: number;
  [key: string]: any;
}

export interface DeviceRegistrationRequest {
  id: string;
  name: string;
}

export interface FleetSummary {
  total: number;
  online: number;
  offline: number;
}
