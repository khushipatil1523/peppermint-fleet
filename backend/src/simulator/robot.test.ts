import { describe, expect, it } from 'vitest';

import {
  SimulatedRobot,
  type RosterRobot,
} from './robot.js';

const rosterRobot: RosterRobot = {
  robot_id: 'test-robot-1',
  robot_type: 'picker',
  start: {
    x: 50,
    y: 50,
  },
};

describe('SimulatedRobot', () => {
  it('generates a valid robot update', () => {
    const robot = new SimulatedRobot(
      rosterRobot,
      0,
    );

    const update = robot.step();

    expect(update.robot_id).toBe(
      'test-robot-1',
    );

    expect(update.robot_type).toBe(
      'picker',
    );

    expect(update.x).toBeGreaterThanOrEqual(15);
    expect(update.x).toBeLessThanOrEqual(885);

    expect(update.y).toBeGreaterThanOrEqual(15);
    expect(update.y).toBeLessThanOrEqual(545);

    expect(update.battery).toBeGreaterThanOrEqual(0);
    expect(update.battery).toBeLessThanOrEqual(100);

    expect(update.seq).toBe(1);
  });

  it('increments sequence numbers for every update', () => {
    const robot = new SimulatedRobot(
      rosterRobot,
      0,
    );

    const first = robot.step();
    const second = robot.step();
    const third = robot.step();

    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);
    expect(third.seq).toBe(3);
  });

  it('keeps the robot inside the site boundaries', () => {
    const robot = new SimulatedRobot(
      {
        ...rosterRobot,
        start: {
          x: 880,
          y: 540,
        },
      },
      0,
    );

    for (let i = 0; i < 100; i++) {
      const update = robot.step();

      expect(update.x).toBeGreaterThanOrEqual(15);
      expect(update.x).toBeLessThanOrEqual(885);

      expect(update.y).toBeGreaterThanOrEqual(15);
      expect(update.y).toBeLessThanOrEqual(545);
    }
  });

  it('does not teleport between consecutive updates', () => {
    const robot = new SimulatedRobot(
      rosterRobot,
      0,
    );

    let previous = robot.step();

    for (let i = 0; i < 50; i++) {
      const current = robot.step();

      const movement = Math.hypot(
        current.x - previous.x,
        current.y - previous.y,
      );

      /*
       * Picker speed is 2.2 units per simulation
       * step. Allow a little tolerance for rounding.
       */
      expect(movement).toBeLessThanOrEqual(
        3,
      );

      previous = current;
    }
  });

  it('keeps charging robots stationary', () => {
    const robot = new SimulatedRobot(
      rosterRobot,
      0,
    );

    /*
     * We cannot directly access the private
     * simulation state, so we observe the public
     * RobotUpdate contract over multiple steps.
     *
     * If the robot enters charging naturally,
     * its position should stop changing.
     */
    let previous = robot.step();

    for (let i = 0; i < 500; i++) {
      const current = robot.step();

      if (
        current.status === 'charging' &&
        previous.status === 'charging'
      ) {
        expect(current.x).toBe(previous.x);
        expect(current.y).toBe(previous.y);
        expect(current.battery).toBeGreaterThanOrEqual(
          previous.battery,
        );
      }

      previous = current;
    }
  });

  it('produces only valid operational statuses', () => {
    const robot = new SimulatedRobot(
      rosterRobot,
      0,
    );

    const validStatuses = new Set([
      'idle',
      'active',
      'on_mission',
      'charging',
      'blocked',
      'error',
      'maintenance',
      'offline',
    ]);

    for (let i = 0; i < 500; i++) {
      const update = robot.step();

      expect(
        validStatuses.has(update.status),
      ).toBe(true);
    }
  });
});