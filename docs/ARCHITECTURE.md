# Architecture — AXIOM Trading Platform

## System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│              axiom-trading.html (SPA Dashboard)             │
│   Overview │ Signals │ Anomalies │ Audit Trail │ Strategy   │
└─────────────────────┬───────────────────────────────────────┘
                      │ event-driven updates (1s tick)
┌─────────────────────▼───────────────────────────────────────┐
│                  SIMULATION ENGINE LAYER                    │
│  market-engine.js  │  signal-engine.js  │  anomaly-engine   │
│  (OHLCV, regime)   │  (ML signals, XAI) │  (heatmap data)   │
└─────────────────────┬───────────────────────────────────────┘
                      │ typed data contracts (types.ts)
┌─────────────────────▼───────────────────────────────────────┐
│                   AUDIT / INTEGRITY LAYER                   │
│         audit-engine.js — SHA-256 hash chain log            │
│         Every AI trade decision → immutable block           │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

1. `market-engine` generates a new OHLCV candle every 1 second per instrument
2. `signal-engine` consumes candles → evaluates regime → emits `TradeSignal` with XAI rationale
3. `anomaly-engine` consumes OHLCV history → detects volume/price anomalies → emits `AnomalyEvent`
4. `audit-engine` receives every `TradeSignal` → creates a `Block` (prev_hash + SHA-256)
5. Dashboard views subscribe to all engines via a central `EventBus`

## State Architecture

- All state lives in-memory (no localStorage, no IndexedDB)
- Single source of truth: `PlatformState` object
- Mutations only via `dispatch(action)` pattern
- Views are pure functions of state (re-render on state change)

## API Bridge Monitor

Simulated latency metrics between:
- `Quant Model` → `Risk Engine` (target: <2ms)
- `Risk Engine` → `Order Router` (target: <1ms)
- `Order Router` → `Exchange Gateway` (target: <5ms)

Status is polled every 500ms and displayed in the header bar.

## Regime Detection (HMM Simulation)

Three regimes modeled:
- `TRENDING_BULL` — high momentum, low volatility
- `TRENDING_BEAR` — high momentum, negative direction
- `RANGING` — low momentum, mean-reverting
- `HIGH_VOLATILITY` — regime breakdown, elevated risk

Transition probabilities are updated every 30 candles using simulated Baum-Welch.
