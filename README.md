# Peppermint Fleet Command

A full-stack reference implementation for the Peppermint Robotics SDE-1 fleet dashboard challenge.

## Architecture

```text
Node simulator
     |
     | HTTP POST /ingest
     v
Fastify backend
  | validation
  | current state Map
  | history buffer
  | REST API
  | WebSocket
     |
     v
React + TypeScript dashboard
  | Canvas site map
  | fleet KPIs
  | search / attention filter
  | selected robot
  | working-fleet trend
```

The browser never reads `events.jsonl`. The simulator generates new data and the dashboard receives state from the backend.

## Project layout

- `backend/` — independently runnable Node/Fastify service and simulator
- `frontend/` — independently runnable React/Vite dashboard
- `events.jsonl` — supplied challenge log retained as a reference artifact
- `Hiring-Challenge.pdf` — supplied challenge brief

## Prerequisites

- Node.js 20+
- npm 10+

## Run locally

### Terminal 1 — backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Windows PowerShell:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

Backend: `http://localhost:3000`

### Terminal 2 — frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Windows PowerShell:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Frontend: `http://localhost:5173`

## Build independently

Backend:

```bash
cd backend
npm run build
npm start
```

Frontend:

```bash
cd frontend
npm run build
```

The two packages have independent `package.json` files and do not require a shared runtime package installation.

## Configuration

Backend `.env`:

```env
PORT=3000
FLEET_SIZE=8
UPDATE_INTERVAL_MS=1000
PAYLOAD_BYTES=0
ADMIN_TOKEN=change-me
CORS_ORIGIN=http://localhost:5173
```

Frontend `.env`:

```env
VITE_API_URL=http://localhost:3000
```

`FLEET_SIZE`, `UPDATE_INTERVAL_MS`, and `PAYLOAD_BYTES` are startup controls. `POST /admin/config` also provides runtime controls without redeployment; it requires `Authorization: Bearer <ADMIN_TOKEN>`.

Example:

```bash
curl -X POST http://localhost:3000/admin/config \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{"fleetSize":100,"updateIntervalMs":1000}'
```

## API

- `GET /health` — service health and robot count
- `GET /robots` — current fleet state
- `GET /robots/:robotId` — current state for one robot
- `GET /robots/history/:robotId?from=<ms>&to=<ms>` — bounded in-memory history
- `POST /ingest` — simulator/producer event endpoint
- `GET /config` — active simulator configuration
- `POST /admin/config` — protected runtime configuration
- `WS /ws` — snapshot on connect + live robot updates

## Data contract

Robot updates use the challenge terminology:

```json
{
  "robot_id": "r2",
  "robot_type": "hauler",
  "x": 787.3,
  "y": 65.2,
  "status": "active",
  "battery": 75.8,
  "seq": 42,
  "t": 123.4
}
```

Statuses are: `idle`, `active`, `on_mission`, `charging`, `blocked`, `error`, `maintenance`, `offline`.

Working = `active` or `on_mission`.

Attention = `blocked`, `error`, `maintenance`, `offline`, or battery below 20%.

## Simulator behavior

The simulator starts from `backend/robots.json`, but does not replay the supplied event log. Robots move continuously toward changing targets, remain inside the 900×560 coordinate space, drain/charge their battery, and transition among operational statuses.

The simulator is intentionally simple enough to explain and extend. Production-grade obstacle/path planning is outside the core implementation.

## Tests

```bash
cd backend
npm test
```

The tests cover current-state updates, battery/position normalization, and stale/out-of-order sequence rejection.

## Deployment

Deploy the services separately:

1. **Backend:** deploy `backend/` as a Node service or Docker container. Set `PORT`, `ADMIN_TOKEN`, CORS, and simulator settings.
2. **Frontend:** deploy `frontend/` as a static Vite application. Set `VITE_API_URL` to the public backend HTTPS URL before building.
3. The browser WebSocket URL is derived automatically from `VITE_API_URL`: `https://...` becomes `wss://...`.

The backend `Dockerfile` is self-contained and deploys only the backend service.

## Scalability notes

The dashboard uses Canvas for robot markers instead of one React DOM node per robot. The robot list is capped to 300 visible rows. These are engineering choices, not benchmark claims.

Run real load tests before making claims about the maximum fleet size. Record the first observed bottleneck in `FINDINGS.md` rather than inventing results.

## AI assistance

AI assistance was used for scaffolding, code generation, debugging, and documentation. Before submission, review the code, run the tests/builds, replace any unmeasured performance statements with observed measurements, and make sure you can explain every architectural decision.
