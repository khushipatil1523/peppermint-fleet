import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RobotStatus, RobotUpdate } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rosterPath = path.join(__dirname, '../robots.json');

type RosterRobot = { robot_id: string; robot_type: 'picker' | 'hauler'; start: { x: number; y: number } };

type SimRobot = RosterRobot & {
  x: number; y: number; battery: number; status: RobotStatus;
  targetX: number; targetY: number; seq: number; missionTicks: number;
};

const WIDTH = 900;
const HEIGHT = 560;

export class Simulator {
  private robots: SimRobot[] = [];
  private timer?: NodeJS.Timeout;
  private tickMs: number;
  private payloadBytes: number;
  private fleetSize: number;
  private onUpdate: (update: RobotUpdate, robotType: SimRobot['robot_type']) => void;

  constructor(onUpdate: Simulator['onUpdate']) {
    this.onUpdate = onUpdate;
    this.fleetSize = Number(process.env.FLEET_SIZE ?? 8);
    this.tickMs = Number(process.env.UPDATE_INTERVAL_MS ?? 1000);
    this.payloadBytes = Number(process.env.PAYLOAD_BYTES ?? 0);
    this.resetRobots();
  }

  config() { return { fleetSize: this.fleetSize, updateIntervalMs: this.tickMs, payloadBytes: this.payloadBytes }; }

  configure(fleetSize: number, updateIntervalMs: number, payloadBytes = this.payloadBytes) {
    this.fleetSize = Math.max(1, Math.min(5000, Math.floor(fleetSize)));
    this.tickMs = Math.max(100, Math.min(60000, Math.floor(updateIntervalMs)));
    this.payloadBytes = Math.max(0, Math.min(100000, Math.floor(payloadBytes)));
    this.resetRobots();
    this.start();
  }

  start() {
    this.stop();
    this.timer = setInterval(() => this.step(), this.tickMs);
    this.step();
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }

  private resetRobots() {
    const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8')) as RosterRobot[];
    this.robots = Array.from({ length: this.fleetSize }, (_, i) => {
      const base = roster[i % roster.length];
      const extra = Math.floor(i / roster.length);
      return {
        robot_id: i < roster.length ? base.robot_id : `${base.robot_id}-${extra + 1}`,
        robot_type: base.robot_type,
        start: base.start,
        x: Math.min(WIDTH - 10, base.start.x + (extra * 7) % 50),
        y: Math.min(HEIGHT - 10, base.start.y + (extra * 11) % 50),
        battery: 65 + ((i * 17) % 31),
        status: 'idle',
        targetX: 0, targetY: 0, seq: 0, missionTicks: 0
      };
    });
    for (const r of this.robots) this.chooseTarget(r);
  }

  private chooseTarget(r: SimRobot) {
    r.targetX = 20 + Math.random() * (WIDTH - 40);
    r.targetY = 20 + Math.random() * (HEIGHT - 40);
  }

  private nextStatus(r: SimRobot) {
    if (r.battery <= 18) { r.status = 'charging'; return; }
    if (r.status === 'charging' && r.battery >= 85) { r.status = 'idle'; r.missionTicks = 0; return; }
    if (r.status === 'idle' && Math.random() < 0.08) { r.status = 'on_mission'; r.missionTicks = 0; return; }
    if (r.status === 'on_mission' && Math.random() < 0.012) { r.status = 'blocked'; return; }
    if (r.status === 'blocked' && Math.random() < 0.20) { r.status = 'on_mission'; return; }
    if (r.status === 'on_mission' && Math.random() < 0.01) { r.status = 'error'; return; }
    if (r.status === 'error' && Math.random() < 0.10) { r.status = 'maintenance'; return; }
    if (r.status === 'maintenance' && Math.random() < 0.08) { r.status = 'idle'; return; }
    if (r.status === 'idle' && Math.random() < 0.18) r.status = 'active';
    else if (r.status === 'active' && Math.random() < 0.12) r.status = 'idle';
  }

  private step() {
    for (const r of this.robots) {
      this.nextStatus(r);
      if (r.status === 'charging') {
        r.battery = Math.min(100, r.battery + 0.45);
      } else if (r.status === 'active' || r.status === 'on_mission') {
        r.battery = Math.max(0, r.battery - 0.035);
      }

      if (r.status === 'active' || r.status === 'on_mission') {
        const speed = r.robot_type === 'hauler' ? 3.0 : 2.2;
        const dx = r.targetX - r.x, dy = r.targetY - r.y;
        const distance = Math.hypot(dx, dy);
        if (distance < speed + 1) {
          r.x = r.targetX; r.y = r.targetY; this.chooseTarget(r);
          if (r.status === 'on_mission') r.missionTicks++;
          if (r.missionTicks > 20) r.status = 'idle';
        } else {
          r.x += dx / distance * speed;
          r.y += dy / distance * speed;
        }
      }

      r.x = Math.max(5, Math.min(WIDTH - 5, r.x));
      r.y = Math.max(5, Math.min(HEIGHT - 5, r.y));
      const update: RobotUpdate = {
        t: Date.now() / 1000,
        robot_id: r.robot_id,
        x: Number(r.x.toFixed(2)),
        y: Number(r.y.toFixed(2)),
        status: r.status,
        battery: Number(r.battery.toFixed(1)),
        seq: ++r.seq
      };
      if (this.payloadBytes > 0) (update as RobotUpdate & { payload?: string }).payload = 'x'.repeat(this.payloadBytes);
      this.onUpdate(update, r.robot_type);
    }
  }
}
