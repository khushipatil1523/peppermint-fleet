# Architecture

## System

```text
┌─────────────────────────┐
│ Robot Simulator         │
│ Node + TypeScript       │
│ state machine + motion  │
└────────────┬────────────┘
             │ HTTP POST /ingest
             ▼
┌──────────────────────────────────┐
│ Fastify Backend                  │
│                                  │
│ validation → FleetState Map      │
│             → history buffer     │
│             → WebSocket          │
│             → REST               │
└────────────────┬─────────────────┘
                 │ snapshot + updates
                 ▼
┌──────────────────────────────────┐
│ React + TypeScript Dashboard      │
│                                  │
│ React state → Canvas map         │
│              → list/details      │
│              → trend chart       │
└──────────────────────────────────┘
```

## Data flow

1. The simulator owns a simulated robot state and advances it on each tick.
2. The simulator serializes a robot update and sends it to `POST /ingest`.
3. The backend validates the payload and checks the robot's sequence number.
4. `FleetState` stores the newest state in `Map<robot_id, RobotState>`.
5. The backend records a bounded history point and broadcasts the accepted state to connected WebSocket clients.
6. A dashboard WebSocket connection receives a full snapshot first, then incremental robot updates.
7. React stores the fleet state; Canvas draws the site and robot markers; other components render KPIs, filters, details, and the time trend.

## Why HTTP for simulator → backend?

The simulator is a producer and the backend is a consumer. HTTP gives a simple explicit boundary that is easy to test, observe, and replace later. It also avoids coupling the simulator to the backend's in-process state implementation.

## Why WebSocket for backend → dashboard?

The dashboard is a live operational view. WebSocket avoids repeated polling and supports a snapshot on connection followed by incremental updates.

## Why React + TypeScript?

React fits the interactive state model: search, selection, filtering, KPIs, map state, and trend data all consume the same live fleet state. TypeScript gives explicit contracts for robot events crossing simulator/backend/frontend boundaries.

## Why Canvas?

The challenge explicitly allows fleet size to grow substantially. Rendering every robot as a React/DOM component creates unnecessary UI work. Canvas allows many markers to be drawn in one rendering surface while React handles application state and controls.

## Why in-memory state?

The core requirement is current fleet state. A `Map<robot_id, RobotState>` provides direct lookup/update without introducing database infrastructure. A bounded in-memory history buffer is included as a lightweight optional extension; durable persistence is not required for the core path.

## Failure handling

### Robot stops reporting

The backend tracks `updated_at`. If no update arrives for roughly three update intervals, the robot is marked `offline` and the change is broadcast.

### Late/out-of-order update

Each simulated update includes a monotonic `seq`. The backend remembers the last accepted sequence per robot and ignores an update whose sequence is not newer.

### Dashboard disconnects

The frontend reconnects with increasing delays. On reconnect, the WebSocket server sends a fresh snapshot, so the browser does not need to reconstruct missed events.

### Invalid robot update

The ingestion layer validates IDs, coordinates, battery, status, and optional sequence/type fields and returns HTTP 400 for invalid data.

### Simulator cannot reach backend

The simulator reports failed HTTP requests and continues its simulation loop. A production system could add retries, backoff, delivery metrics, and a durable queue if required.

## 10× growth

The first areas to benchmark are:

1. WebSocket message volume and serialization.
2. Backend CPU/memory under high event rates.
3. Browser Canvas rendering and state-update frequency.
4. Network bandwidth.

No maximum fleet size is claimed until measured.
