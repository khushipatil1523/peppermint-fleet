export const STATUSES = [
  'idle', 'active', 'on_mission', 'charging',
  'blocked', 'error', 'maintenance', 'offline'
] as const;

export type RobotStatus = typeof STATUSES[number];
export type RobotType = 'picker' | 'hauler';

export interface RobotUpdate {
  t?: number;
  robot_id: string;
  robot_type?: RobotType;
  x: number;
  y: number;
  status: RobotStatus;
  battery: number;
  seq?: number;
  payload?: string;
}

export interface RobotState {
  robot_id: string;
  robot_type: RobotType;
  x: number;
  y: number;
  status: RobotStatus;
  battery: number;
  updated_at: number;
  seq: number;
}

export interface RuntimeConfig {
  fleetSize: number;
  updateIntervalMs: number;
  payloadBytes: number;
}
