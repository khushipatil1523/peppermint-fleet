export type RobotStatus = 'idle' | 'active' | 'on_mission' | 'charging' | 'blocked' | 'error' | 'maintenance' | 'offline';
export type Robot = {
  robot_id: string;
  robot_type: 'picker' | 'hauler';
  x: number;
  y: number;
  status: RobotStatus;
  battery: number;
  updated_at: number;
  seq: number;
};
