# Findings

## 1. Summary

This project was built as a live fleet-management system consisting of a robot
simulator, backend ingestion/state management, and a React dashboard.

The main engineering goal was to keep the producer/consumer boundary explicit,
make the backend state easy to update and query, and keep the dashboard usable
as the fleet size increases.

The system was tested locally with progressively larger simulated fleets.
These tests were primarily functional/scalability observations rather than a
formal benchmark, so I have intentionally not claimed performance limits that
were not measured with dedicated profiling tools.

---

## 2. Engineering Tradeoffs

### HTTP from simulator to backend

I chose HTTP POST for the simulator → backend boundary.

**Why:**

- Simple producer/consumer separation.
- Easy to inspect and test with standard HTTP tooling.
- The simulator does not depend on the backend's internal state implementation.
- The same ingestion endpoint can accept updates from another producer later.

**Alternatives considered:**

- MQTT
- Message queues such as Kafka/RabbitMQ
- gRPC

For this challenge, those alternatives would introduce additional
infrastructure without solving a demonstrated problem at the current scale.

**Cost of this choice:**

HTTP adds request/response overhead for every update. At substantially higher
event rates, batching, a message broker, or another streaming transport could
reduce overhead.

---

### WebSocket from backend to dashboard

I chose WebSocket for the backend → dashboard live feed.

The dashboard needs continuously changing robot state, so pushing updates avoids
repeated REST polling.

The server sends a complete snapshot when a dashboard connects and then sends
incremental robot updates.

**Cost of this choice:**

Each connected dashboard client receives live updates, so serialization and
network traffic increase with both fleet size and number of clients.

At a larger scale, batched/delta messages or a pub/sub layer would be candidates
for reducing this cost.

---

### In-memory fleet state

Current state is stored as:

`Map<robot_id, RobotState>`

This gives direct lookup and update without requiring a database.

I intentionally did not introduce a database for the core current-state
requirement.

**Why:**

- Current fleet state is the primary requirement.
- The system is easier to run and explain.
- There is no demonstrated persistence bottleneck.
- Adding a database would add operational complexity.

A bounded in-memory history is maintained for the dashboard trend.

**Cost:**

State is process-local and is not durable across a restart. A multi-instance
deployment would also require shared state or a coordinated event stream.

---

### Canvas for fleet visualization

Robot markers are rendered on HTML Canvas instead of creating one React/DOM
element per robot.

React manages application state and controls while Canvas handles the map
rendering.

This keeps the number of DOM elements relatively small as the fleet grows.

**Cost:**

Canvas requires explicit drawing logic and does not provide normal DOM
accessibility/layout behavior for every robot marker.

---

## 3. Fleet Growth Testing

The simulator configuration allows fleet size and update interval to be changed
without modifying the simulation code.

I progressively tested the local system with:

| Fleet size | Observation |
|---:|---|
| 8 | Baseline fleet operated normally |
| 20 | Dashboard remained functional |
| 50 | Dashboard remained functional |
| 100 | Dashboard remained functional |
| 250 | Dashboard remained functional |
| 500 | Dashboard remained functional |
| 800 | Dashboard remained functional and backend remained responsive during testing |
| 1000 | Dashboard remained functional during the local test |

These tests demonstrate that the implementation can operate beyond the original
8-robot roster and that the dashboard does not fundamentally depend on a fixed
fleet size.

### Important limitation of these results

These are observed local functional/scalability tests, not a formal load-test
benchmark.

I did not use a dedicated profiler or controlled benchmark harness to measure:

- exact events/second throughput
- p50/p95/p99 ingestion latency
- CPU utilization
- sustained memory growth
- WebSocket bandwidth
- browser FPS
- browser memory
- maximum sustainable fleet size

Therefore I do **not** claim that the system supports a specific maximum fleet
size.

The observed result is limited to the configurations and environment in which
the tests were performed.

---

## 4. Where I Expect the System to Degrade

The likely pressure points as the fleet grows are:

### 1. WebSocket serialization and broadcast

Every accepted robot update can result in a WebSocket message to connected
clients.

As the number of robots and update frequency increase, serialization and
network traffic can become significant.

**Possible next step:**

Batch multiple robot updates into a single frame and send only changed fields
(delta updates) where appropriate.

---

### 2. Backend CPU and memory

The backend maintains:

- current robot state
- sequence information
- bounded history
- WebSocket connections
- ingestion processing

At higher event rates, update processing and serialization become increasingly
important.

**Possible next step:**

Run a controlled load test and profile CPU, heap usage, event-loop latency, and
ingestion latency before deciding which optimization is actually necessary.

---

### 3. Browser rendering

The browser has to process incoming state changes and redraw the fleet map.

Canvas avoids the cost of hundreds or thousands of separate DOM robot elements,
but React state updates and Canvas redraw frequency can still become a
bottleneck.

**Possible next step:**

Decouple network update frequency from rendering frequency, batch incoming
updates, and render at a controlled frame rate.

---

### 4. Network bandwidth

At a high fleet size combined with a short update interval, the number of
messages can grow quickly.

**Possible next step:**

Use batched WebSocket frames, delta encoding, compression where appropriate,
and/or a server-side aggregation strategy.

---

## 5. What Happens at 10× Fleet Size?

If the fleet grows by another order of magnitude, I would not immediately add
infrastructure based on assumptions.

I would first benchmark the system and identify the actual first bottleneck.

The investigation order would be:

1. Backend CPU and event-loop latency
2. WebSocket serialization/broadcast cost
3. Network bandwidth
4. Browser state-update and Canvas rendering cost
5. Memory growth

If the browser becomes the bottleneck first, I would:

- batch updates
- limit rendering frequency
- avoid unnecessary React state changes
- aggregate or prioritize low-value updates

If network traffic becomes the bottleneck, I would:

- batch robot updates
- send deltas instead of complete robot objects
- consider compression
- consider an event distribution layer for multiple consumers

If backend processing becomes the bottleneck, I would profile first and then
consider:

- separating ingestion from fan-out
- worker-based processing
- a message broker
- horizontal scaling with shared state/event distribution

The key principle is to measure first rather than introduce infrastructure
prematurely.

---

## 6. Failure and Reliability Findings

### Robot stops reporting

Each robot state has an `updated_at` timestamp.

If a robot stops sending updates for approximately three update intervals, the
backend can classify it as offline and broadcast the updated state.

This prevents a silent robot from appearing healthy indefinitely.

---

### Out-of-order updates

Robot updates carry a monotonically increasing sequence number.

The backend remembers the latest accepted sequence for each robot.

For example:

```text
sequence 10 → accepted
sequence 12 → accepted
sequence 11 → rejected