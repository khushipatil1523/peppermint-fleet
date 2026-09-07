# Peppermint Fleet Command

A full-stack real-time fleet monitoring dashboard built for the Peppermint Robotics SDE-1 Full Stack Hiring Challenge.

The system simulates a fleet of robots, ingests their telemetry through a backend, maintains current state and bounded history, and streams live updates to a React dashboard.

## Live Demo

> **Dashboard:** https://peppermint-fleet.onrender.com  
> **Backend:** https://peppermint-fleet-backend-4c9q.onrender.com  
> **WebSocket:** wss://peppermint-fleet-backend-4c9q.onrender.com/ws  
> **Source:** https://github.com/khushipatil1523/peppermint-fleet

The live dashboard is the primary submission. The backend exposes REST APIs and a WebSocket endpoint used by the dashboard.

---

## What This Project Does

The system models a fleet of autonomous robots operating on a site map.

Each robot continuously produces telemetry containing:

- Robot ID and type
- Position (`x`, `y`)
- Operational status
- Battery level
- Monotonic sequence number
- Event timestamp

The backend:

1. Receives robot events.
2. Validates and normalizes them.
3. Rejects stale/out-of-order updates.
4. Maintains the latest state of every robot.
5. Keeps bounded per-robot history.
6. Broadcasts accepted updates through WebSocket.
7. Exposes REST endpoints for initial hydration and inspection.

The frontend:

- Hydrates the initial fleet state through REST.
- Connects to WebSocket for live updates.
- Renders robot positions on a Canvas site map.
- Shows fleet KPIs.
- Supports robot search and attention filtering.
- Shows the selected robot's details.
- Displays working-fleet trends over time.
- Automatically reconnects after a WebSocket disconnect.

---

## Architecture

```text
                         Robot Simulator
                              |
                              | HTTP POST /ingest
                              v
                    +----------------------+
                    |    Fastify Backend   |
                    |----------------------|
                    | Validation           |
                    | Current State Map    |
                    | Bounded History      |
                    | REST API             |
                    | WebSocket            |
                    +----------+-----------+
                               |
                    +----------+----------+
                    |                     |
                 REST                  WebSocket
              initial state           live updates
                    |                     |
                    +----------+----------+
                               v
                    +----------------------+
                    | React + TypeScript   |
                    |----------------------|
                    | Canvas Site Map      |
                    | Fleet KPIs           |
                    | Search / Filters     |
                    | Robot Details        |
                    | Trend Chart          |
                    +----------------------+

                The browser does not read events.jsonl directly.

The supplied event log is retained as a reference artifact. The running system uses the simulator to generate new telemetry, sends it to the backend, and delivers accepted state changes to the browser.

For the detailed request/data flow and failure handling, see ARCHITECTURE.md.

Project Structure
peppermint-fleet/
│
├── backend/
│   ├── src/
│   │   ├── config.ts
│   │   ├── server.ts
│   │   ├── types.ts
│   │   ├── ingestion/
│   │   ├── simulator/
│   │   ├── state/
│   │   ├── websocket/
│   │   └── tests/
│   ├── robots.json
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/
│   │   ├── components/
│   │   └── hooks/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── ARCHITECTURE.md
├── FINDINGS.md
├── events.jsonl
└── README.md
Main responsibilities
Area	Responsibility
backend/	API, simulator, state management, history and WebSocket
frontend/	Dashboard UI and live fleet visualization
robots.json	Initial robot configuration
events.jsonl	Supplied challenge log retained as reference
ARCHITECTURE.md	Detailed architecture and failure handling
FINDINGS.md	Implementation findings, tradeoffs and scalability observations
Tech Stack
Backend
Node.js
TypeScript
Fastify
WebSocket
In-memory state/history
Frontend
React
TypeScript
Vite
HTML Canvas
Recharts
Deployment
Render
Docker for the backend
Running Locally
Prerequisites
Node.js 20+
npm 10+

Check your versions:

node --version
npm --version
1. Start the Backend
Linux / macOS
cd backend
npm install
cp .env.example .env
npm run dev
Windows PowerShell
cd backend
npm install
Copy-Item .env.example .env
npm run dev

Backend:

http://localhost:3000

Health check:

http://localhost:3000/health
2. Start the Frontend

Open a second terminal.

Linux / macOS
cd frontend
npm install
cp .env.example .env
npm run dev
Windows PowerShell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev

Frontend:

http://localhost:5173

The frontend uses VITE_API_URL to locate the backend.

Configuration
Backend

Create backend/.env:

PORT=3000

FLEET_SIZE=8
UPDATE_INTERVAL_MS=1000
PAYLOAD_BYTES=0

ADMIN_TOKEN=change-me

CORS_ORIGIN=http://localhost:5173
Configuration knobs
Variable	Purpose
FLEET_SIZE	Number of simulated robots
UPDATE_INTERVAL_MS	Simulator update frequency
PAYLOAD_BYTES	Optional telemetry payload size
ADMIN_TOKEN	Protects runtime configuration changes
CORS_ORIGIN	Allowed frontend origin

FLEET_SIZE, UPDATE_INTERVAL_MS, and PAYLOAD_BYTES can be changed at startup.

The backend also exposes a protected runtime configuration endpoint, allowing fleet size and update frequency to be changed without rebuilding the application.

Frontend

Create frontend/.env:

VITE_API_URL=http://localhost:3000

For the deployed dashboard this points to:

https://peppermint-fleet-backend-4c9q.onrender.com

The WebSocket URL is derived automatically from the API URL:

https://...  ->  wss://...
http://...  ->  ws://...
Runtime Configuration

The protected endpoint is:

POST /admin/config

It requires:

Authorization: Bearer <ADMIN_TOKEN>

Example:

curl -X POST http://localhost:3000/admin/config \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{"fleetSize":100,"updateIntervalMs":1000}'

Example response:

{
  "fleetSize": 100,
  "updateIntervalMs": 1000
}

This was intentionally kept as a backend control rather than adding an unnecessary dashboard control.

API
Endpoint	Purpose
GET /health	Service health and current robot count
GET /robots	Current state of the fleet
GET /robots/:robotId	Current state of one robot
GET /robots/history/:robotId	Bounded historical telemetry
POST /ingest	Robot/simulator telemetry ingestion
GET /config	Active simulator configuration
POST /admin/config	Protected runtime configuration
WS /ws	Initial snapshot + live robot updates
History query

Historical data can be filtered by timestamp:

GET /robots/history/r2?from=<ms>&to=<ms>

History is intentionally bounded in memory rather than growing without limit.

Robot Data Contract

Robot updates follow the challenge terminology:

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

Supported statuses:

idle
active
on_mission
charging
blocked
error
maintenance
offline
Dashboard definitions

Working

active OR on_mission

Attention

blocked
error
maintenance
offline
OR battery < 20%

These definitions are used consistently by the dashboard KPIs, filtering and robot details.

Simulator

The simulator starts from:

backend/robots.json

It does not replay events.jsonl.

Instead, robots continuously generate new telemetry and move toward changing targets.

The simulator handles:

Continuous robot movement
Site boundaries
Obstacle avoidance
Battery drain
Battery charging
Status transitions
Sequence numbers
Configurable fleet size
Configurable update interval
Optional payload size

The simulator is deliberately lightweight and deterministic enough to be easy to understand and extend.

Production-grade fleet path planning and navigation are outside the scope of this challenge implementation.

Real-Time Data Flow

The live path is:

Robot Simulator
      |
      | POST /ingest
      v
Backend validation
      |
      v
Current-state Map
      |
      +----> Bounded history
      |
      +----> WebSocket broadcast
                    |
                    v
              React dashboard
                    |
                    v
              Canvas pixel update

When a browser first connects:

REST loads the current fleet snapshot.
The browser opens the WebSocket connection.
The backend sends a snapshot on connection.
Subsequent accepted robot updates are pushed through WebSocket.
The selected robot, KPIs, map and trends update without page refresh.
Reliability & Failure Handling
Robot stops publishing

The backend retains the robot's last known state.

A production implementation could add heartbeat/timeout detection. The current system keeps the simulator and ingestion model intentionally simple for the challenge.

Out-of-order events

Each robot has a sequence number.

Older sequence numbers are rejected so a delayed event cannot overwrite newer state.

Invalid telemetry

Incoming values are validated and normalized before entering fleet state.

Dashboard disconnect

The frontend automatically attempts WebSocket reconnection using exponential backoff.

The sequence is approximately:

1s → 2s → 4s → 8s

Once reconnected, the frontend can rehydrate state through REST and continue receiving live updates.

Backend restart

The current fleet state and history are held in memory.

Therefore, a backend restart resets runtime state and simulator state.

Persistent state was intentionally not introduced for this challenge because the system is a simulated fleet rather than a production control plane.

Dashboard Features

The dashboard provides:

Fleet overview
Total robots
Working robots
Robots needing attention
Average battery
Live connection status
Site map
Robot positions rendered using Canvas
Robot status visualization
Obstacle/site layout
Selected robot highlighting
Robot discovery
Search by robot ID
Attention filtering
Selected robot details
Robot details
Robot ID
Robot type
Current position
Status
Battery
Sequence number
Recent telemetry trend
Working-fleet trend

The dashboard supports trend windows of:

5 min
15 min
30 min
60 min
Scalability

The implementation was tested locally by increasing the simulator fleet through multiple configurations:

8 → 20 → 50 → 100 → 250 → 500 → 800 → 1000 robots

The dashboard remained functional across these configurations during manual testing.

These observations are functional scalability observations, not a formal benchmark. No claim is made here about a production maximum fleet size.

The current implementation's likely scaling constraints are:

In-memory backend state
Simulator CPU/update volume
WebSocket fan-out
Browser rendering and JavaScript work
Historical data retained in memory

The frontend uses Canvas rather than one DOM element per robot, and the visible robot list is capped at 300 rows to keep the UI responsive.

More detailed observations, tradeoffs and next steps are documented in FINDINGS.md.

Build
Backend
cd backend
npm install
npm run build
npm start
Frontend
cd frontend
npm install
npm run build

The backend and frontend have independent package.json files and can be built and deployed separately.

Tests

Run backend tests with:

cd backend
npm test

The tests cover important state-management behavior including:

Current-state updates
Battery and position normalization
Stale/out-of-order sequence rejection
Deployment

The application is deployed as two services.

Backend

The backend can be deployed as a Node.js service or Docker container.

The repository contains a self-contained:

backend/Dockerfile

The backend listens on:

0.0.0.0

and uses the deployment-provided PORT.

Required production configuration includes:

PORT
ADMIN_TOKEN
CORS_ORIGIN
FLEET_SIZE
UPDATE_INTERVAL_MS
PAYLOAD_BYTES
Frontend

The frontend is deployed as a static Vite application.

Set:

VITE_API_URL=https://peppermint-fleet-backend-4c9q.onrender.com

before building/deploying.

The browser derives the secure WebSocket endpoint from this URL.

Engineering Tradeoffs

A few deliberate choices were made to keep the implementation understandable while still satisfying the real-time fleet requirements.

HTTP ingestion instead of MQTT/Kafka

HTTP was chosen because:

It is simple to deploy.
It is easy to inspect and debug.
The challenge has a relatively small simulated fleet.
The simulator and backend can run behind the same service.

A production fleet with unreliable networks and very high event volume would be a stronger candidate for MQTT or another dedicated event transport.

WebSocket instead of polling

WebSocket was chosen because fleet telemetry is continuously changing.

Polling would introduce:

Repeated requests
Additional latency
More redundant data transfer
More work as fleet size grows

WebSocket provides a natural push-based update path.

In-memory state

In-memory state keeps the challenge implementation simple and fast.

The tradeoff is that state is lost when the backend restarts.

A production system would likely introduce persistent/event-backed state and possibly separate ingestion, state management and delivery services.

Canvas rendering

Canvas avoids creating a large React DOM tree when many robots are visible.

This reduces per-robot DOM overhead and gives the renderer direct control over map drawing.

What Was Intentionally Not Built

The following were intentionally kept outside the core challenge scope:

Persistent database
MQTT/Kafka event broker
Multi-instance shared state
Authentication/authorization beyond the admin configuration token
Production-grade path planning
Distributed simulator workers
Historical analytics database
Advanced observability/metrics pipeline
Automated load-testing infrastructure

These would become relevant as the fleet and operational requirements increase.

If the Fleet Grows 10×

The first architectural changes I would make are:

Move ingestion away from the application process so telemetry spikes do not directly compete with dashboard delivery.
Introduce a durable event/stream layer for buffering and replay.
Move fleet state into shared storage so multiple backend instances can serve the same fleet.
Separate WebSocket fan-out from ingestion/state processing.
Add real load testing and metrics for CPU, memory, event latency, WebSocket bandwidth and browser rendering.
Add observability around ingestion rate, rejected events, connection count and update latency.

The current architecture is intentionally a single-service reference implementation rather than a distributed production fleet platform.

AI Assistance

AI assistance was used during development for:

Project scaffolding
Code generation
Debugging
Documentation drafting
Reviewing implementation approaches

The implementation was reviewed and tested before submission.

The final architectural decisions, configuration choices, simulator behavior and documented tradeoffs were reviewed against the running system so they can be explained during the interview.

Challenge Documentation

Additional challenge deliverables:

ARCHITECTURE.md — system architecture, end-to-end data flow and failure handling
FINDINGS.md — implementation findings, tradeoffs, scalability observations and future improvements
Submission

Live Dashboard

https://peppermint-fleet.onrender.com

Backend

https://peppermint-fleet-backend-4c9q.onrender.com

GitHub Repository

https://github.com/khushipatil1523/peppermint-fleet

