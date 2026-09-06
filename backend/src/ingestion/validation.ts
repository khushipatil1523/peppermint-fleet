import { STATUSES, type RobotUpdate } from '../types.js';

const statusSet = new Set<string>(STATUSES);
const robotIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;

export function validateRobotUpdate(value: unknown): value is RobotUpdate {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.robot_id === 'string' && robotIdPattern.test(body.robot_id) &&
    typeof body.x === 'number' && Number.isFinite(body.x) &&
    typeof body.y === 'number' && Number.isFinite(body.y) &&
    typeof body.battery === 'number' && Number.isFinite(body.battery) &&
    typeof body.status === 'string' && statusSet.has(body.status) &&
    (body.robot_type === undefined || body.robot_type === 'picker' || body.robot_type === 'hauler') &&
    (body.seq === undefined || (typeof body.seq === 'number' && Number.isInteger(body.seq) && body.seq >= 0))
  );
}
