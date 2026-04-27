# AXIOM Trading Platform

> Next-gen algorithmic trading platform with real-time predictive analytics, adaptive ML models, and blockchain-verified audit trails.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.2-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Chart.js](https://img.shields.io/badge/Chart.js-4.4-ff6384?logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)
[![License](https://img.shields.io/badge/license-MIT-06d6a0)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/demo-live-06d6a0?logo=github)](https://gzeu.github.io/axiom-trading-platform/)

## Version Status
- Current stable: v1.1.0
- Next target: v2.0.0 with Bridge Monitor UI, Equity Curve, Open Positions, Toasts, CSV export

## Live Demo

**[https://gzeu.github.io/axiom-trading-platform/](https://gzeu.github.io/axiom-trading-platform/)**

Open in browser — no install required. All data is simulated in-memory.

## Features

### Current
- Real-time OHLCV charts for 5 instruments
- AI signals with XAI rationale
- Market anomaly feed with severity scoring
- Blockchain-style audit trail
- Strategy parameter lab
- TypeScript state and simulation engines

### In Progress for v2
- Bridge Monitor dashboard view
- Equity curve chart
- Open positions table
- Toast notifications for critical events
- CSV export for signals
- Modular regime and KPI engines wired into UI

## Getting Started

### Browser-only
1. Clone the repository
2. Open `src/dashboard/axiom-trading.html`

### Local dev
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
npm run preview
```
