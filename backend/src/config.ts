import 'dotenv/config';

function numberEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export const env = {
  port: numberEnv('PORT', 3000, 1, 65535),
  fleetSize: numberEnv('FLEET_SIZE', 8, 1, 5000),
  updateIntervalMs: numberEnv('UPDATE_INTERVAL_MS', 1000, 100, 60000),
  payloadBytes: numberEnv('PAYLOAD_BYTES', 0, 0, 100000),
  adminToken: process.env.ADMIN_TOKEN ?? 'change-me-in-production',
  corsOrigin: process.env.CORS_ORIGIN ?? true,
};
