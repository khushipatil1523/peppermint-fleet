import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';

import { env } from './config.js';
import { FleetState } from './state/fleet-state.js';
import { ingestRobotUpdate } from './ingestion/ingest.js';
import { validateRobotUpdate } from './ingestion/validation.js';
import { Broadcaster } from './websocket/broadcaster.js';
import { Simulator } from './simulator/simulator.js';

import type {
  RobotType,
  RobotUpdate,
  RuntimeConfig,
} from './types.js';

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: env.corsOrigin,
});

const fleet = new FleetState();
const broadcaster = new Broadcaster();

const knownTypes = new Map<
  string,
  RobotType
>();

const history = new Map<
  string,
  RobotStateHistory[]
>();

function processUpdate(
  update: RobotUpdate,
) {
  const robotType =
    update.robot_type ??
    knownTypes.get(update.robot_id);

  if (!robotType) {
    return null;
  }

  knownTypes.set(
    update.robot_id,
    robotType,
  );

  const state = ingestRobotUpdate(
    fleet,
    update,
    robotType,
  );

  if (state) {
    const points =
      history.get(state.robot_id) ?? [];

    points.push({
      timestamp: state.updated_at,
      x: state.x,
      y: state.y,
      status: state.status,
      battery: state.battery,
    });

    if (points.length > 720) {
      points.splice(
        0,
        points.length - 720,
      );
    }

    history.set(
      state.robot_id,
      points,
    );

    broadcaster.send({
      type: 'robot_update',
      robot: state,
    });
  }

  return state;
}

app.get('/health', async () => ({
  ok: true,
  service: 'fleet-backend',
  robots: fleet.all().length,
  websocket_clients:
    broadcaster.count(),
  time: new Date().toISOString(),
}));

app.get('/robots', async () => ({
  robots: fleet.all(),
}));

app.get<{
  Params: {
    robotId: string;
  };
}>(
  '/robots/:robotId',
  async (request, reply) => {
    const robot = fleet.get(
      request.params.robotId,
    );

    if (!robot) {
      return reply
        .code(404)
        .send({
          error: 'Robot not found',
        });
    }

    return robot;
  },
);

app.get<{
  Params: {
    robotId: string;
  };
  Querystring: {
    from?: string;
    to?: string;
  };
}>(
  '/robots/history/:robotId',
  async (request, reply) => {
    if (
      !fleet.get(
        request.params.robotId,
      )
    ) {
      return reply
        .code(404)
        .send({
          error: 'Robot not found',
        });
    }

    const points =
      history.get(
        request.params.robotId,
      ) ?? [];

    const from = request.query.from
      ? Number(request.query.from)
      : 0;

    const to = request.query.to
      ? Number(request.query.to)
      : Date.now();

    return {
      robot_id:
        request.params.robotId,

      history: points.filter(
        (point) =>
          point.timestamp >= from &&
          point.timestamp <= to,
      ),
    };
  },
);

app.post<{
  Body: RobotUpdate;
}>(
  '/ingest',
  async (request, reply) => {
    if (
      !validateRobotUpdate(
        request.body,
      )
    ) {
      return reply
        .code(400)
        .send({
          error:
            'Invalid robot update',
        });
    }

    const state =
      processUpdate(
        request.body,
      );

    if (!state) {
      return reply
        .code(400)
        .send({
          error:
            'Unknown robot type; provide robot_type on first update',
        });
    }

    return {
      accepted: true,
      robot: state,
    };
  },
);

const simulator = new Simulator(
  `http://127.0.0.1:${env.port}/ingest`,
  {
    fleetSize: env.fleetSize,
    updateIntervalMs:
      env.updateIntervalMs,
    payloadBytes:
      env.payloadBytes,
  },
);

app.get(
  '/config',
  async () => simulator.config(),
);

app.post<{
  Body: Partial<RuntimeConfig>;
}>(
  '/admin/config',
  async (request, reply) => {
    const authorization =
      request.headers.authorization;

    if (
      authorization !==
      `Bearer ${env.adminToken}`
    ) {
      return reply
        .code(401)
        .send({
          error: 'Unauthorized',
        });
    }

    const body =
      request.body ?? {};

    if (
      body.fleetSize !== undefined &&
      (
        !Number.isFinite(
          body.fleetSize,
        ) ||
        body.fleetSize < 1
      )
    ) {
      return reply
        .code(400)
        .send({
          error:
            'Invalid fleetSize',
        });
    }

    if (
      body.updateIntervalMs !==
        undefined &&
      (
        !Number.isFinite(
          body.updateIntervalMs,
        ) ||
        body.updateIntervalMs < 100
      )
    ) {
      return reply
        .code(400)
        .send({
          error:
            'Invalid updateIntervalMs',
        });
    }

    if (
      body.payloadBytes !==
        undefined &&
      (
        !Number.isFinite(
          body.payloadBytes,
        ) ||
        body.payloadBytes < 0
      )
    ) {
      return reply
        .code(400)
        .send({
          error:
            'Invalid payloadBytes',
        });
    }

    /*
     * Fleet size changes recreate the simulator's
     * robot set. Clear backend state first so robots
     * from the previous fleet cannot remain visible.
     */
    const currentConfig =
      simulator.config();

    const fleetSizeChanged =
      body.fleetSize !== undefined &&
      Math.floor(
        body.fleetSize,
      ) !==
        currentConfig.fleetSize;

    if (fleetSizeChanged) {
      fleet.clear();
      knownTypes.clear();
      history.clear();

      /*
       * Tell connected dashboards that the current
       * snapshot is being replaced.
       */
      broadcaster.send({
        type: 'snapshot',
        robots: [],
        config: {
          ...currentConfig,
          ...body,
          fleetSize: Math.floor(
            body.fleetSize!,
          ),
        },
      });
    }

    simulator.configure(body);

    const nextConfig =
      simulator.config();

    /*
     * Send the new configuration to connected
     * dashboards after the simulator has been
     * reconfigured.
     */
    broadcaster.send({
      type: 'snapshot',
      robots: fleet.all(),
      config: nextConfig,
    });

    return nextConfig;
  },
);

const port = env.port;

await app.listen({
  port,
  host: '0.0.0.0',
});

const wss =
  new WebSocketServer({
    server: app.server,
    path: '/ws',
  });

wss.on(
  'connection',
  (ws) => {
    broadcaster.add(ws);

    ws.send(
      JSON.stringify({
        type: 'snapshot',
        robots: fleet.all(),
        config:
          simulator.config(),
      }),
    );

    ws.on(
      'close',
      () => broadcaster.remove(ws),
    );
  },
);

const offlineInterval =
  setInterval(() => {
    const staleMs =
      Math.max(
        3000,
        simulator.config()
          .updateIntervalMs * 3,
      );

    for (
      const robot of fleet.markOffline(
        staleMs,
      )
    ) {
      broadcaster.send({
        type: 'robot_update',
        robot,
      });
    }
  }, 1000);

simulator.start();

app.log.info(
  {
    config:
      simulator.config(),
  },
  'Fleet simulator started',
);

process.on(
  'SIGTERM',
  () => {
    clearInterval(
      offlineInterval,
    );

    simulator.stop();
    wss.close();

    void app.close();
  },
);

process.on(
  'SIGINT',
  () => {
    clearInterval(
      offlineInterval,
    );

    simulator.stop();
    wss.close();

    void app.close();
  },
);

type RobotStateHistory = {
  timestamp: number;
  x: number;
  y: number;
  status: string;
  battery: number;
};