import type {
  RobotState,
  RobotType,
  RobotUpdate,
} from '../types.js';

export class FleetState {
  private readonly robots = new Map<string, RobotState>();
  private readonly lastSeq = new Map<string, number>();

  upsert(
    update: RobotUpdate,
    robotType: RobotType,
  ): RobotState | null {
    const incomingSeq =
      update.seq ??
      Math.floor(
        (update.t ?? Date.now() / 1000) * 1000,
      );

    const previousSeq =
      this.lastSeq.get(update.robot_id) ?? -1;

    // Ignore duplicate or late/out-of-order updates.
    if (incomingSeq <= previousSeq) {
      return null;
    }

    const state: RobotState = {
      robot_id: update.robot_id,
      robot_type: robotType,

      x: Math.max(
        0,
        Math.min(900, update.x),
      ),

      y: Math.max(
        0,
        Math.min(560, update.y),
      ),

      status: update.status,

      battery: Math.max(
        0,
        Math.min(100, update.battery),
      ),

      updated_at: Date.now(),

      seq: incomingSeq,
    };

    this.lastSeq.set(
      update.robot_id,
      incomingSeq,
    );

    this.robots.set(
      update.robot_id,
      state,
    );

    return state;
  }

  all(): RobotState[] {
    return [...this.robots.values()];
  }

  get(
    id: string,
  ): RobotState | undefined {
    return this.robots.get(id);
  }

  /**
   * Remove all currently tracked robot state.
   *
   * Used when the simulator fleet is recreated,
   * for example:
   *
   * 8 → 100 robots
   * 100 → 500 robots
   * 500 → 8 robots
   *
   * Without clearing this state, robots that no longer
   * exist in the simulator could remain visible in the
   * backend/dashboard.
   */
  clear() {
    this.robots.clear();
    this.lastSeq.clear();
  }

  /**
   * Remove only robots that are not part of the
   * currently active simulator fleet.
   *
   * This is useful if the backend wants to reconcile
   * rather than completely clear the fleet.
   */
  reconcile(activeRobotIds: Iterable<string>) {
    const activeIds = new Set(
      activeRobotIds,
    );

    for (const robotId of this.robots.keys()) {
      if (!activeIds.has(robotId)) {
        this.robots.delete(robotId);
        this.lastSeq.delete(robotId);
      }
    }
  }

  markOffline(
    staleMs: number,
  ): RobotState[] {
    const now = Date.now();
    const changed: RobotState[] = [];

    for (const robot of this.robots.values()) {
      if (
        robot.status !== 'offline' &&
        now - robot.updated_at > staleMs
      ) {
        robot.status = 'offline';
        changed.push(robot);
      }
    }

    return changed;
  }
}