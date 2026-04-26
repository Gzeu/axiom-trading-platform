# AXIOM Trading Platform

> Next-generation algorithmic trading platform with real-time predictive analytics, adaptive ML models, explainable AI trade signals, market anomaly detection, and blockchain-verified audit trails.

---

## Overview

AXIOM is a full-stack algorithmic trading dashboard that integrates:

- **Real-time predictive analytics** — live OHLCV data simulation with regime shift detection
- **Adaptive ML models** — self-improving signal engine that adjusts to market regime changes
- **Explainable AI (XAI)** — every trade signal includes a human-readable rationale breakdown
- **Market anomaly detection** — heatmap and pattern visualizer for liquidity and volume anomalies
- **Blockchain-verified audit trail** — immutable log of all AI-driven trade decisions
- **Strategy Lab** — interactive parameter optimization with radar chart feedback
- **Low-latency API bridge monitor** — live status of quantitative model ↔ execution engine connections

---

## Architecture

```
axiom-trading-platform/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md        # System design, data flow, layer boundaries
│   ├── ML_MODELS.md           # ML model specifications, regime detection logic
│   └── AUDIT_TRAIL.md         # Blockchain audit trail schema and verification
├── src/
│   ├── dashboard/
│   │   └── axiom-trading.html # Main dashboard — single-file SPA
│   ├── sim/
│   │   ├── market-engine.js   # OHLCV simulation engine
│   │   ├── signal-engine.js   # AI signal generation & XAI explanations
│   │   ├── anomaly-engine.js  # Anomaly detection simulation
│   │   └── audit-engine.js    # Blockchain audit trail simulation
│   └── types/
│       └── types.ts           # TypeScript type definitions
└── assets/
    └── logo.svg               # AXIOM brand mark
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Dashboard UI | Vanilla HTML/CSS/JS — zero-dependency SPA |
| Charts | Chart.js 4.x |
| Icons | Lucide Icons |
| Fonts | Satoshi (Fontshare) + JetBrains Mono |
| Data Simulation | In-memory JS engines (realistic random walks, regime HMM) |
| Audit Trail | SHA-256 hash chain (simulated blockchain) |
| Type Safety | TypeScript definitions for all data contracts |

---

## Views

| View | Description |
|---|---|
| **Overview** | KPI bar, candlestick chart, volume, active signals summary |
| **Signals** | AI trade signal feed with XAI breakdown per signal |
| **Anomalies** | Market anomaly heatmap + liquidity depth chart |
| **Audit Trail** | Blockchain-verified log of all AI-driven trades |
| **Strategy Lab** | Parameter sliders + radar chart for strategy optimization |

---

## Design System

- **Dark-first** — optimized for low-light trading environments
- **Palette:** Deep navy surfaces, electric teal accent, amber warnings, crimson loss signals
- **Typography:** Satoshi (UI) + JetBrains Mono (data)
- **Spacing:** 4px base grid
- **Motion:** 180ms `cubic-bezier(0.16, 1, 0.3, 1)` for all interactive transitions

---

## Status

🚧 **Active Development** — Initial scaffold complete. Dashboard build in progress.

---

## License

MIT © 2026 George Pricop
