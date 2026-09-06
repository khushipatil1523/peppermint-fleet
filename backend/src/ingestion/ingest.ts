import type { FleetState } from '../state/fleet-state.js';
import type { RobotType, RobotUpdate } from '../types.js';

export function ingestRobotUpdate(fleet: FleetState, update: RobotUpdate, robotType: RobotType) {
  return fleet.upsert(update, robotType);
}
