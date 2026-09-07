# Architecture

## 1. System Overview

The system is split into three main components:

```text
┌──────────────────────────────┐
│       Robot Simulator        │
│                              │
│ Node.js + TypeScript         │
│ - simulated robot state      │
│ - movement                   │
│ - battery/status changes     │
│ - configurable fleet size    │
└──────────────┬───────────────┘
               │
               │ HTTP POST /ingest
               │
               ▼
┌──────────────────────────────────────────┐
│             Fastify Backend              │
│                                          │
│  Request validation                      │
│          │                               │
│          ▼                               │
│  FleetState                              │
│  Map<robot_id, RobotState>               │
│          │                               │
│     ┌────┴──────────────┐                │
│     ▼                   ▼                │
│ History buffer       REST API             │
│                         │                │
│                         ▼                │
│                  WebSocket broadcaster   │
└──────────────────────┬───────────────────┘
                       │
                       │ snapshot + live updates
                       │ WebSocket /ws
                       ▼
┌──────────────────────────────────────────┐
│        React + TypeScript Dashboard      │
│                                          │
│  React state                             │
│      │                                   │
│      ├── Fleet statistics                │
│      ├── Robot search / filtering        │
│      ├── Robot details                   │
│      └── Trend chart                     │
│                                          │
│  Canvas                                 │
│      └── Site layout + robot markers     │
└──────────────────────────────────────────┘

The simulator, backend, and dashboard are independently deployable. The
simulator communicates with the backend through a real HTTP producer/consumer
boundary rather than directly calling backend state functions.

2. Component Responsibilities
Robot Simulator

The simulator owns the simulated robot state.

Each robot has:

robot_id
robot_type
position
battery
status
sequence number
update timestamp

On each simulation tick, the robot state is advanced and an update is sent to
the backend through POST /ingest.

Fleet size, update interval, and optional payload size are configurable without
changing the simulation code.

The simulator is intentionally not a full warehouse robotics simulator. Its
purpose is to produce plausible continuous robot events for the live system.

Backend

The backend is responsible for:

Validating incoming robot events.
Rejecting stale/out-of-order events.
Maintaining the latest state for every robot.
Maintaining bounded history for the dashboard trend.
Exposing current state through REST.
Broadcasting accepted updates through WebSocket.
Detecting robots that stop reporting and marking them offline.
Exposing protected runtime configuration for supported simulator controls.

Current fleet state is stored using:

Map<robot_id, RobotState>

This provides direct lookup and update without requiring a database for the
core current-state requirement.

Dashboard

The dashboard consumes the backend rather than reading events.jsonl
directly.

It provides:

total fleet count
working robot count
attention count
average battery
live site map
robot search
robot selection
robot details
attention filtering
working percentage trend
selectable trend windows

React manages application state and UI interactions.

Canvas renders the site and robot markers.

3. End-to-End Data Flow

The path from a simulated robot event to a visible dashboard update is:

Step 1 — Simulator advances robot state

A simulator tick updates a robot's position, battery, status, timestamp, and
sequence number.

For example:

robot r2
position: (787, 65)
battery: 75%
status: active
sequence: 42
Step 2 — Simulator publishes the event

The simulator serializes the update and sends:

POST /ingest

to the backend.

This keeps the producer and consumer separate.

Step 3 — Backend validates the event

The ingestion layer validates:

robot identity
robot type
coordinates
battery range
status
sequence information
timestamp information

Invalid input is rejected before it can modify fleet state.

Step 4 — Sequence check

The backend compares the incoming sequence number with the latest accepted
sequence for that robot.

For example:

seq 10 → accepted
seq 12 → accepted
seq 11 → rejected

This prevents a late event from overwriting newer state.

Step 5 — Fleet state update

For an accepted event:

Map<robot_id, RobotState>

is updated with the newest robot state.

The backend also records a bounded history point for trend information.

Step 6 — WebSocket broadcast

The accepted robot state is broadcast to connected dashboard clients.

A newly connected dashboard first receives a complete fleet snapshot. After
that it receives incremental robot updates.

Step 7 — Dashboard state update

The frontend receives the WebSocket message and updates its React state.

Step 8 — Pixel changes

The updated React state causes the dashboard to redraw the relevant robot
information.

Canvas renders the robot marker at its new (x, y) position on top of the site
layout.

Other UI components update:

Fleet statistics
Robot list
Selected robot details
Trend information
Attention indicators

This gives the complete path:

Simulator
   ↓
HTTP POST /ingest
   ↓
Validation
   ↓
Sequence check
   ↓
FleetState Map
   ↓
WebSocket broadcast
   ↓
React state
   ↓
Canvas redraw
   ↓
Robot appears at its new position
4. Why HTTP for Simulator → Backend?

HTTP was selected for the simulator → backend producer/consumer boundary.

Advantages
Simple to implement and test.
Easy to inspect using standard HTTP tools.
Clear separation between producer and consumer.
The simulator does not depend on backend implementation details.
The ingestion endpoint can later accept another producer.
Alternatives considered

Possible alternatives include:

MQTT
Kafka
RabbitMQ
gRPC
raw sockets

These could make sense for a much larger distributed system, but they would
add infrastructure and operational complexity without solving a demonstrated
requirement at the current scale.

Cost

Each update is an HTTP request, so request overhead grows with event frequency.

If event rates become a bottleneck, batching, streaming, or a message broker
could be considered after measurement.

5. Why WebSocket for Backend → Dashboard?

The dashboard is a live operational interface, so continuous server-to-client
updates are more appropriate than frequent polling.

WebSocket provides:

persistent connection
server-initiated updates
low polling overhead
full snapshot on connection
incremental updates after connection

The frontend also reconnects when the connection drops.

Cost

Broadcasting every accepted update to every connected dashboard client means
network and serialization costs increase with fleet size, update frequency,
and number of clients.

If this becomes a bottleneck, batched or delta-based WebSocket messages would
be a natural next step.

6. Why React + TypeScript?

React is used for the interactive dashboard state:

search
filtering
robot selection
statistics
trend controls
connection state
selected robot details

TypeScript provides explicit contracts for data crossing the simulator,
backend, and frontend boundaries.

This also makes invalid or inconsistent robot event structures easier to catch
during development.

7. Why Canvas?

The challenge requires the dashboard to remain usable as the fleet grows.

Rendering every robot as an individual React/DOM element would create
unnecessary DOM and React work.

Instead:

React
  ↓
application state + controls

Canvas
  ↓
site + robot visualization

Canvas allows many robot markers to be rendered inside a single drawing
surface while React continues to manage the application state.

The tradeoff is that Canvas requires explicit rendering logic and does not
provide normal DOM semantics for individual robot markers.

8. Why In-Memory State?

The primary requirement is the current fleet state.

A:

Map<robot_id, RobotState>

provides efficient direct lookup and update without introducing database
infrastructure.

A bounded in-memory history buffer is also maintained for the dashboard trend.

Advantages
Simple architecture.
Low operational overhead.
Easy to reason about.
Appropriate for current-state requirements.
No database dependency for the core system.
Tradeoffs
State is not durable across a process restart.
Multiple backend instances would require shared state.
Long-term historical analysis would require persistent storage.

If durable history or horizontal scaling becomes a requirement, a persistent
store and/or shared event layer can be introduced.

9. Failure Handling
9.1 Robot stops reporting

The backend tracks each robot's updated_at timestamp.

If no update is received for approximately three expected update intervals,
the robot is considered offline and the state change can be broadcast to the
dashboard.

This prevents a robot from appearing healthy indefinitely after it stops
reporting.

9.2 Late or out-of-order update

Each simulated event contains a monotonic sequence number.

The backend remembers the latest accepted sequence for each robot.

An event is accepted only when its sequence is newer than the last accepted
sequence.

Example:

10 → accepted
12 → accepted
11 → rejected

This prevents stale data from overwriting newer state.

9.3 Dashboard disconnects

The frontend automatically attempts to reconnect after a WebSocket
disconnect.

The reconnect delay increases between attempts.

When the connection is restored, the backend sends a fresh fleet snapshot.

Therefore, the frontend does not need to reconstruct every missed event while
it was disconnected.

9.4 Invalid robot update

External robot updates are validated before entering fleet state.

Invalid:

robot IDs
coordinates
battery values
statuses
sequence values
robot types

are rejected with an HTTP error rather than modifying the current state.

9.5 Simulator cannot reach backend

If an ingestion request fails, the simulator records the failure and continues
its simulation loop.

A production implementation could add:

retry with exponential backoff
delivery metrics
a durable queue
dead-letter handling

if guaranteed event delivery became a requirement.

10. Configuration and Runtime Controls

The backend supports configuration for:

fleetSize
updateIntervalMs
payloadBytes

These controls allow fleet growth and event-rate behavior to be tested without
changing application code.

The runtime configuration endpoint is protected using an administrative
token.

This prevents unauthenticated users from changing the simulator workload.

11. Scalability Considerations

The system was designed so that the fleet is not hard-coded to eight robots.

The main areas expected to become bottlenecks as the fleet grows are:

Backend
event ingestion
validation
serialization
WebSocket broadcasting
memory usage
Network
number of events per second
WebSocket message volume
payload size
number of connected clients
Browser
incoming update frequency
React state updates
Canvas redraw frequency
browser memory

The implementation should therefore be benchmarked rather than assigned an
unverified maximum fleet size.

12. What I Would Change at 10× Fleet Size

If the fleet grew by another 10×, I would first measure the actual bottleneck
rather than immediately adding infrastructure.

The investigation order would be:

Backend CPU and event-loop latency.
WebSocket serialization and broadcast cost.
Network bandwidth.
Browser rendering and state-update frequency.
Memory usage.

Depending on the result:

If the browser is the bottleneck
batch incoming updates
limit rendering frequency
reduce unnecessary React state updates
prioritize important robot changes
If WebSocket traffic is the bottleneck
batch robot updates
send delta updates
reduce redundant fields
consider compression
If backend processing is the bottleneck
profile ingestion and serialization
separate ingestion from fan-out
introduce workers where useful
consider an event distribution layer
If multiple backend instances are required

Introduce shared state and an event distribution mechanism so that all backend
instances and dashboard clients maintain a consistent fleet view.

13. Intentional Scope

The following areas were intentionally kept simple:

robot movement is simulated rather than based on real robot physics
path planning is not warehouse-grade
obstacle avoidance is limited to the requirements of the simulation
fleet state is in-memory
history is bounded rather than permanently stored
the system does not introduce a message broker
authentication is intentionally lightweight for the challenge

These are extension points rather than hidden limitations.

The architecture keeps these concerns separate so they can be added without
rewriting the core simulator → backend → dashboard data path.