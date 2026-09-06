# Findings

## Current status

The implementation provides the full local data path and a production-oriented foundation. Performance limits have **not** been claimed without measurement.

## What to benchmark

Test combinations such as:

| Fleet | Interval | Payload | Purpose |
|---:|---:|---:|---|
| 8 | 5000 ms | 0 B | baseline |
| 100 | 1000 ms | 0 B | medium fleet |
| 500 | 1000 ms | 0 B | high event rate |
| 1000 | 1000 ms | 0 B | stress |
| 1000+ | 500 ms | larger | find first limit |

Record actual:

- events/second
- ingestion latency
- backend CPU
- backend memory
- WebSocket bandwidth
- browser FPS/responsiveness
- browser memory
- first visible degradation

Do not replace this section with guessed numbers.

## Expected engineering questions

### What would change first at 10× fleet size?

Benchmark whether backend serialization/broadcasting or browser rendering becomes the first bottleneck. If browser rendering is first, reduce redraw frequency, batch updates, and/or aggregate low-priority updates. If network volume is first, move from per-robot messages to batched/delta frames.

### Why not a database immediately?

Current-state requirements do not require durable storage. Adding a database before measuring would increase operational complexity without addressing a demonstrated bottleneck. Durable history can be added if the optional history requirement becomes useful.

### What was intentionally kept simple?

The simulator uses target-based motion rather than full warehouse path planning. It does not model real robot physics or obstacle avoidance. Those are extension points rather than requirements for the basic live data path.
