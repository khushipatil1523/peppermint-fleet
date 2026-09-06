import type { RobotStatus, RobotType, RobotUpdate } from '../types.js';

const WIDTH = 900;
const HEIGHT = 560;

const MIN_X = 15;
const MAX_X = WIDTH - 15;
const MIN_Y = 15;
const MAX_Y = HEIGHT - 15;

const OBSTACLES = [
  // Top-left horizontal obstacle
  { x: 150, y: 80, width: 200, height: 60 },

  // Center vertical obstacle
  { x: 500, y: 60, width: 60, height: 400 },

  // Top-right horizontal obstacle
  { x: 650, y: 150, width: 200, height: 50 },

  // Middle-left horizontal obstacle
  { x: 150, y: 220, width: 200, height: 60 },

  // Bottom-left horizontal obstacle
  { x: 150, y: 360, width: 200, height: 60 },

  // Bottom-right horizontal obstacle
  { x: 650, y: 340, width: 200, height: 50 },
];

const ROBOT_CLEARANCE = 12;

export type RosterRobot = {
  robot_id: string;
  robot_type: RobotType;
  start: { x: number; y: number };
};

type Obstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SimRobot = RosterRobot & {
  x: number;
  y: number;
  battery: number;
  status: RobotStatus;

  targetX: number;
  targetY: number;

  waypointX: number | null;
  waypointY: number | null;

  seq: number;

  missionTicks: number;
  pauseTicks: number;
  blockedTicks: number;
  maintenanceTicks: number;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function pointInsideObstacle(
  x: number,
  y: number,
  obstacle: Obstacle,
  clearance = 0,
) {
  return (
    x >= obstacle.x - clearance &&
    x <= obstacle.x + obstacle.width + clearance &&
    y >= obstacle.y - clearance &&
    y <= obstacle.y + obstacle.height + clearance
  );
}

function lineIntersectsObstacle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacle: Obstacle,
  clearance = 0,
) {
  const minX = obstacle.x - clearance;
  const maxX = obstacle.x + obstacle.width + clearance;
  const minY = obstacle.y - clearance;
  const maxY = obstacle.y + obstacle.height + clearance;

  const steps = Math.max(
    8,
    Math.ceil(distance(x1, y1, x2, y2) / 10),
  );

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;

    if (
      x >= minX &&
      x <= maxX &&
      y >= minY &&
      y <= maxY
    ) {
      return true;
    }
  }

  return false;
}

function isSafePosition(x: number, y: number) {
  return !OBSTACLES.some((obstacle) =>
    pointInsideObstacle(
      x,
      y,
      obstacle,
      ROBOT_CLEARANCE,
    ),
  );
}

export class SimulatedRobot {
  private readonly robot: SimRobot;

  constructor(roster: RosterRobot, index: number) {
    this.robot = {
      ...roster,

      x: roster.start.x,
      y: roster.start.y,

      battery: 65 + ((index * 17) % 31),

      status: 'idle',

      targetX: roster.start.x,
      targetY: roster.start.y,

      waypointX: null,
      waypointY: null,

      seq: 0,

      missionTicks: 0,
      pauseTicks: 0,
      blockedTicks: 0,
      maintenanceTicks: 0,
    };

    this.chooseTarget();
  }

  /**
   * Pick a safe destination that is not inside an obstacle.
   */
  private chooseTarget() {
    const r = this.robot;

    for (let attempt = 0; attempt < 30; attempt++) {
      const targetX = randomBetween(MIN_X, MAX_X);
      const targetY = randomBetween(MIN_Y, MAX_Y);

      const insideObstacle = OBSTACLES.some((obstacle) =>
        pointInsideObstacle(
          targetX,
          targetY,
          obstacle,
          ROBOT_CLEARANCE,
        ),
      );

      if (!insideObstacle) {
        r.targetX = targetX;
        r.targetY = targetY;

        this.calculateWaypoint();

        return;
      }
    }

    // Fallback to the current location if a safe target
    // could not be found.
    r.targetX = r.x;
    r.targetY = r.y;

    r.waypointX = null;
    r.waypointY = null;
  }

  /**
   * If the direct path crosses an obstacle, create a simple
   * waypoint around one of its corners.
   *
   * This intentionally stays simple. We don't need a full
   * path-planning system for this challenge.
   */
  private calculateWaypoint() {
    const r = this.robot;

    const obstacle = OBSTACLES.find((candidate) =>
      lineIntersectsObstacle(
        r.x,
        r.y,
        r.targetX,
        r.targetY,
        candidate,
        ROBOT_CLEARANCE,
      ),
    );

    if (!obstacle) {
      r.waypointX = null;
      r.waypointY = null;
      return;
    }

    const corners = [
      {
        x: obstacle.x - ROBOT_CLEARANCE,
        y: obstacle.y - ROBOT_CLEARANCE,
      },
      {
        x: obstacle.x + obstacle.width + ROBOT_CLEARANCE,
        y: obstacle.y - ROBOT_CLEARANCE,
      },
      {
        x: obstacle.x - ROBOT_CLEARANCE,
        y: obstacle.y + obstacle.height + ROBOT_CLEARANCE,
      },
      {
        x: obstacle.x + obstacle.width + ROBOT_CLEARANCE,
        y: obstacle.y + obstacle.height + ROBOT_CLEARANCE,
      },
    ];

    const safeCorners = corners.filter(
      (corner) =>
        corner.x >= MIN_X &&
        corner.x <= MAX_X &&
        corner.y >= MIN_Y &&
        corner.y <= MAX_Y &&
        !OBSTACLES.some((other) =>
          other !== obstacle &&
          pointInsideObstacle(
            corner.x,
            corner.y,
            other,
            ROBOT_CLEARANCE,
          ),
        ),
    );

    if (safeCorners.length === 0) {
      r.waypointX = null;
      r.waypointY = null;
      return;
    }

    safeCorners.sort(
      (a, b) =>
        distance(r.x, r.y, a.x, a.y) -
        distance(r.x, r.y, b.x, b.y),
    );

    const waypoint = safeCorners[0];

    r.waypointX = waypoint.x;
    r.waypointY = waypoint.y;
  }

  /**
   * Decide when the robot changes operational state.
   *
   * States intentionally have different behavior:
   *
   * active/on_mission -> movement
   * idle              -> pause
   * charging          -> stationary
   * blocked           -> stationary
   * error             -> stationary
   * maintenance       -> stationary
   */
  private chooseNextStatus() {
    const r = this.robot;

    // Battery protection always wins.
    if (
      r.battery <= 18 &&
      r.status !== 'charging'
    ) {
      r.status = 'charging';
      r.pauseTicks = 0;
      r.waypointX = null;
      r.waypointY = null;

      return;
    }

    // Finish charging.
    if (
      r.status === 'charging' &&
      r.battery >= 88
    ) {
      r.status = 'idle';
      r.pauseTicks = 2 + Math.floor(Math.random() * 5);

      this.chooseTarget();

      return;
    }

    // Charging means the robot stays still.
    if (r.status === 'charging') {
      return;
    }

    // Maintenance countdown.
    if (r.status === 'maintenance') {
      r.maintenanceTicks++;

      if (r.maintenanceTicks >= 8) {
        r.status = 'idle';
        r.maintenanceTicks = 0;
        r.pauseTicks = 2 + Math.floor(Math.random() * 4);

        this.chooseTarget();
      }

      return;
    }

    // Error robots stay stopped until they enter maintenance.
    if (r.status === 'error') {
      if (Math.random() < 0.12) {
        r.status = 'maintenance';
        r.maintenanceTicks = 0;
      }

      return;
    }

    // Blocked robots remain stationary for a while.
    if (r.status === 'blocked') {
      r.blockedTicks++;

      if (r.blockedTicks >= 3) {
        r.blockedTicks = 0;

        if (Math.random() < 0.15) {
          r.status = 'error';
        } else {
          r.status = 'on_mission';
          this.calculateWaypoint();
        }
      }

      return;
    }

    // Intentional idle pause.
    if (r.status === 'idle') {
      if (r.pauseTicks > 0) {
        r.pauseTicks--;
        return;
      }

      const roll = Math.random();

      if (roll < 0.10) {
        r.status = 'on_mission';
        r.missionTicks = 0;
        this.chooseTarget();
      } else if (roll < 0.28) {
        r.status = 'active';
        this.chooseTarget();
      }

      return;
    }

    // Active robot can become idle or start a mission.
    if (r.status === 'active') {
      if (Math.random() < 0.08) {
        r.status = 'idle';
        r.pauseTicks = 2 + Math.floor(Math.random() * 5);
      }

      return;
    }

    // Mission robot can become blocked/error or complete its mission.
    if (r.status === 'on_mission') {
      if (Math.random() < 0.012) {
        r.status = 'blocked';
        r.blockedTicks = 0;
        return;
      }

      if (Math.random() < 0.006) {
        r.status = 'error';
        return;
      }

      return;
    }
  }

  /**
   * Move toward the current waypoint or target.
   */
  private move() {
    const r = this.robot;

    if (
      r.status !== 'active' &&
      r.status !== 'on_mission'
    ) {
      return;
    }

    const destinationX =
      r.waypointX ?? r.targetX;

    const destinationY =
      r.waypointY ?? r.targetY;

    const speed =
      r.robot_type === 'hauler'
        ? 3
        : 2.2;

    const dx = destinationX - r.x;
    const dy = destinationY - r.y;

    const remaining = Math.hypot(dx, dy);

    if (remaining <= speed + 1) {
      // Check the destination before moving there.
      if (!isSafePosition(destinationX, destinationY)) {
        r.waypointX = null;
        r.waypointY = null;

        this.chooseTarget();

        return;
      }

      r.x = destinationX;
      r.y = destinationY;

      if (r.waypointX !== null) {
        // Waypoint reached; continue toward final target.
        r.waypointX = null;
        r.waypointY = null;

        return;
      }

      // Final destination reached.
      if (r.status === 'on_mission') {
        r.missionTicks++;

        // Mission completed after several destinations.
        if (r.missionTicks >= 3) {
          r.status = 'idle';
          r.pauseTicks = 3 + Math.floor(Math.random() * 6);
        } else {
          this.chooseTarget();
        }
      } else {
        // Active robot reached its current work point.
        this.chooseTarget();
      }

      return;
    }

    const nextX =
      r.x + (dx / remaining) * speed;

    const nextY =
      r.y + (dy / remaining) * speed;

    if (isSafePosition(nextX, nextY)) {
      r.x = nextX;
      r.y = nextY;
    } else {
      // Stop before entering an obstacle.
      r.waypointX = null;
      r.waypointY = null;

      this.chooseTarget();
    }
  }

  step(): RobotUpdate {
    const r = this.robot;

    this.chooseNextStatus();

    // Battery behavior.
    if (r.status === 'charging') {
      r.battery = Math.min(
        100,
        r.battery + 0.45,
      );
    }

    if (
      r.status === 'active' ||
      r.status === 'on_mission'
    ) {
      r.battery = Math.max(
        0,
        r.battery - 0.035,
      );
    }

    // Only working robots move.
    this.move();

    // Keep every robot inside the site.
    r.x = Math.max(
      MIN_X,
      Math.min(MAX_X, r.x),
    );

    r.y = Math.max(
      MIN_Y,
      Math.min(MAX_Y, r.y),
    );

    return {
      t: Date.now() / 1000,

      robot_id: r.robot_id,
      robot_type: r.robot_type,

      x: Number(r.x.toFixed(2)),
      y: Number(r.y.toFixed(2)),

      status: r.status,

      battery: Number(
        r.battery.toFixed(1),
      ),

      seq: ++r.seq,
    };
  }
}