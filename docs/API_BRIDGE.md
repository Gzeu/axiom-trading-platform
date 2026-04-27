# API Bridge Monitor

The AXIOM API Bridge Monitor simulates low-latency connections between the dashboard, model layer, and execution services.

## Endpoints
- Market Data Feed
- Execution Engine
- ML Inference API
- Audit Chain Node
- Risk Engine

## Status Model
Each endpoint transitions across four states:
- connected
- degraded
- reconnecting
- disconnected

## Latency Model
Latency uses bounded jitter around each endpoint's base threshold and updates every simulation tick.

## Health Score
Overall health score is a weighted average:
- connected = 100
- degraded = 40
- reconnecting = 15
- disconnected = 0

## Intended UI
The next dashboard version should expose:
- endpoint status table
- latency sparkbars
- aggregate health gauge
- dropped message counter
- uptime and p99 latency metrics
