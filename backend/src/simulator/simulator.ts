import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SimulatedRobot,
  type RosterRobot,
} from './robot.js';
import type { RuntimeConfig } from '../types.js';

const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
);

const rosterPath = path.join(
  __dirname,
  '../../robots.json',
);

export class Simulator {
  private robots: SimulatedRobot[] = [];

  private timer?: NodeJS.Timeout;

  private fleetSize: number;
  private intervalMs: number;
  private payloadBytes: number;

  private ingestUrl: string;

  private running = false;

  /**
   * Prevents overlapping simulation ticks.
   *
   * This matters when:
   * - fleet size increases
   * - update interval decreases
   * - network requests take longer than expected
   */
  private tickInProgress = false;

  constructor(
    ingestUrl: string,
    initial: RuntimeConfig,
  ) {
    this.ingestUrl = ingestUrl;

    this.fleetSize = initial.fleetSize;
    this.intervalMs = initial.updateIntervalMs;
    this.payloadBytes = initial.payloadBytes;

    this.createRobots();
  }

  config(): RuntimeConfig {
    return {
      fleetSize: this.fleetSize,
      updateIntervalMs: this.intervalMs,
      payloadBytes: this.payloadBytes,
    };
  }

  /**
   * Runtime configuration.
   *
   * These controls allow the deployed instance to be
   * changed without redeployment.
   *
   * Robot instances are preserved when only the interval
   * or payload size changes. This keeps their sequence
   * numbers and simulation state continuous.
   *
   * Robots are recreated only when fleet size changes.
   */
  configure(next: Partial<RuntimeConfig>) {
    const wasRunning = this.running;

    // Remember the old fleet size before applying changes.
    const previousFleetSize = this.fleetSize;

    // Stop the existing timer before changing configuration.
    this.stop();

    if (next.fleetSize !== undefined) {
      this.fleetSize = Math.max(
        1,
        Math.min(
          5000,
          Math.floor(next.fleetSize),
        ),
      );
    }

    if (next.updateIntervalMs !== undefined) {
      this.intervalMs = Math.max(
        100,
        Math.min(
          60000,
          Math.floor(next.updateIntervalMs),
        ),
      );
    }

    if (next.payloadBytes !== undefined) {
      this.payloadBytes = Math.max(
        0,
        Math.min(
          100000,
          Math.floor(next.payloadBytes),
        ),
      );
    }

    /*
     * Only recreate robots when fleet size actually changes.
     *
     * Changing interval or payload size should not reset:
     * - robot positions
     * - battery
     * - status
     * - sequence numbers
     * - mission state
     */
    if (this.fleetSize !== previousFleetSize) {
      this.createRobots();
    }

    if (wasRunning) {
      this.start();
    }
  }

  start() {
    // Avoid duplicate timers.
    this.stop();

    this.running = true;

    // Produce the first update immediately.
    void this.tick();

    this.timer = setInterval(
      () => void this.tick(),
      this.intervalMs,
    );
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.running = false;
  }

  /**
   * Load the official roster and expand it when running
   * larger simulator configurations.
   *
   * The simulator generates new live data; it does NOT
   * replay events.jsonl.
   */
  private createRobots() {
    const roster = JSON.parse(
      fs.readFileSync(
        rosterPath,
        'utf8',
      ),
    ) as RosterRobot[];

    if (roster.length === 0) {
      throw new Error(
        'robots.json must contain at least one robot',
      );
    }

    this.robots = Array.from(
      { length: this.fleetSize },
      (_, i) => {
        const base = roster[i % roster.length];

        const extra = Math.floor(
          i / roster.length,
        );

        const robotId =
          i < roster.length
            ? base.robot_id
            : `${base.robot_id}-${extra + 1}`;

        /*
         * Spread generated robots around their base
         * positions so a 500/1000 robot test does not
         * place every generated robot at exactly the
         * same coordinates.
         */
        const offsetX =
          (extra * 17 + i * 3) % 70;

        const offsetY =
          (extra * 13 + i * 5) % 70;

        const start = {
          x: Math.min(
            890,
            Math.max(
              10,
              base.start.x + offsetX,
            ),
          ),

          y: Math.min(
            550,
            Math.max(
              10,
              base.start.y + offsetY,
            ),
          ),
        };

        return new SimulatedRobot(
          {
            ...base,
            robot_id: robotId,
            start,
          },
          i,
        );
      },
    );
  }

  /**
   * Generate one update per robot and send each update
   * independently to the backend ingestion endpoint.
   */
  private async tick() {
    if (!this.running) {
      return;
    }

    if (this.tickInProgress) {
      return;
    }

    this.tickInProgress = true;

    try {
      const updates = this.robots.map(
        (robot) => robot.step(),
      );

      /*
       * Optional payload inflation used for load testing.
       * The actual robot state remains unchanged.
       */
      if (this.payloadBytes > 0) {
        for (const update of updates) {
          update.payload =
            'x'.repeat(this.payloadBytes);
        }
      }

      const results =
        await Promise.allSettled(
          updates.map((update) =>
            fetch(
              this.ingestUrl,
              {
                method: 'POST',
                headers: {
                  'content-type':
                    'application/json',
                },
                body: JSON.stringify(
                  update,
                ),
              },
            ),
          ),
        );

      for (const result of results) {
        if (result.status === 'rejected') {
          console.warn(
            'Simulator ingest failed:',
            result.reason,
          );
          continue;
        }

        if (!result.value.ok) {
          console.warn(
            `Simulator ingest returned ${result.value.status}`,
          );
        }
      }
    } finally {
      this.tickInProgress = false;
    }
  }
}