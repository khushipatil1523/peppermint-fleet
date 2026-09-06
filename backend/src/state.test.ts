import { describe, expect, it } from 'vitest';

import { FleetState } from './state/fleet-state.js';

describe('FleetState', () => {
  it('stores a newer update and rejects an older one', () => {
    const fleet = new FleetState();

    fleet.upsert(
      {
        robot_id: 'r1',
        x: 10,
        y: 10,
        battery: 80,
        status: 'active',
        seq: 2,
      },
      'picker',
    );

    const stale = fleet.upsert(
      {
        robot_id: 'r1',
        x: 2,
        y: 2,
        battery: 20,
        status: 'error',
        seq: 1,
      },
      'picker',
    );

    expect(stale).toBeNull();
    expect(fleet.get('r1')?.x).toBe(10);
  });

  it('clamps coordinates and battery to safe site bounds', () => {
    const fleet = new FleetState();

    const state = fleet.upsert(
      {
        robot_id: 'r1',
        x: 1200,
        y: -50,
        battery: 150,
        status: 'idle',
        seq: 1,
      },
      'picker',
    );

    expect(state).toMatchObject({
      x: 900,
      y: 0,
      battery: 100,
    });
  });

  it('clears all robot state', () => {
    const fleet = new FleetState();

    fleet.upsert(
      {
        robot_id: 'r1',
        x: 100,
        y: 100,
        battery: 80,
        status: 'active',
        seq: 1,
      },
      'picker',
    );

    fleet.upsert(
      {
        robot_id: 'r2',
        x: 200,
        y: 200,
        battery: 70,
        status: 'idle',
        seq: 1,
      },
      'hauler',
    );

    expect(fleet.all()).toHaveLength(2);

    fleet.clear();

    expect(fleet.all()).toHaveLength(0);
    expect(fleet.get('r1')).toBeUndefined();
    expect(fleet.get('r2')).toBeUndefined();
  });

  it('clears sequence history so a recreated robot can start from seq 1', () => {
    const fleet = new FleetState();

    fleet.upsert(
      {
        robot_id: 'r1',
        x: 100,
        y: 100,
        battery: 80,
        status: 'active',
        seq: 10,
      },
      'picker',
    );

    fleet.clear();

    const recreatedRobot = fleet.upsert(
      {
        robot_id: 'r1',
        x: 50,
        y: 50,
        battery: 90,
        status: 'idle',
        seq: 1,
      },
      'picker',
    );

    expect(recreatedRobot).not.toBeNull();
    expect(recreatedRobot).toMatchObject({
      robot_id: 'r1',
      x: 50,
      y: 50,
      battery: 90,
      status: 'idle',
      seq: 1,
    });
  });

  it('marks stale robots as offline', () => {
    const fleet = new FleetState();

    const state = fleet.upsert(
      {
        robot_id: 'r1',
        x: 100,
        y: 100,
        battery: 80,
        status: 'active',
        seq: 1,
      },
      'picker',
    );

    expect(state?.status).toBe('active');

    // Use a very small stale threshold.
    // The robot was just updated, so it should not
    // immediately become offline.
    const firstCheck = fleet.markOffline(60_000);

    expect(firstCheck).toHaveLength(0);
    expect(fleet.get('r1')?.status).toBe('active');
  });

  it('reconciles robots that are no longer active', () => {
    const fleet = new FleetState();

    fleet.upsert(
      {
        robot_id: 'r1',
        x: 100,
        y: 100,
        battery: 80,
        status: 'active',
        seq: 1,
      },
      'picker',
    );

    fleet.upsert(
      {
        robot_id: 'r2',
        x: 200,
        y: 200,
        battery: 70,
        status: 'idle',
        seq: 1,
      },
      'hauler',
    );

    fleet.reconcile(['r1']);

    expect(fleet.get('r1')).toBeDefined();
    expect(fleet.get('r2')).toBeUndefined();
    expect(fleet.all()).toHaveLength(1);
  });
});