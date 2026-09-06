import type { RobotState, RobotUpdate } from './types.js';

export class FleetState {
  private robots = new Map<string, RobotState>();
  private lastSeq = new Map<string, number>();

  upsert(update: RobotUpdate, robotType: RobotState['robot_type']): RobotState | null {
    const previousSeq = this.lastSeq.get(update.robot_id) ?? -1;
    const incomingSeq = update.seq ?? Math.floor((update.t ?? Date.now()) * 1000);
    if (incomingSeq < previousSeq) return null;

    const state: RobotState = {
      robot_id: update.robot_id,
      robot_type: robotType,
      x: update.x,
      y: update.y,
      status: update.status,
      battery: Math.max(0, Math.min(100, update.battery)),
      updated_at: Date.now(),
      seq: incomingSeq
    };
    this.lastSeq.set(update.robot_id, incomingSeq);
    this.robots.set(update.robot_id, state);
    return state;
  }

  markOffline(staleMs: number): RobotState[] {
    const now = Date.now();
    const changed: RobotState[] = [];
    for (const robot of this.robots.values()) {
      if (robot.status !== 'offline' && now - robot.updated_at > staleMs) {
        robot.status = 'offline';
        changed.push(robot);
      }
    }
    return changed;
  }

  all(): RobotState[] { return [...this.robots.values()]; }
  get(id: string): RobotState | undefined { return this.robots.get(id); }
}
