/**
 * AXIOM Platform — Ticker Engine (Central Orchestrator)
 *
 * Drives all simulation engines on a unified tick interval.
 * This is the single place that:
 *   1. Advances GBM prices for all instruments (store.pushCandle)
 *   2. Transitions the market regime (regime-detector.detectNextRegime)
 *   3. Emits trade signals (signal-factory.maybeBuildSignal)
 *   4. Emits market anomalies (anomaly-factory.maybeBuildAnomaly)
 *   5. Rebuilds the order book (orderbook-simulator.buildOrderBook)
 *   6. Advances KPI metrics (store.tickKPI)
 *   7. Ticks the API bridge monitor (api-bridge.tickBridge)
 *
 * No engine calls any other engine directly — all cross-engine
 * coordination goes through this module and the shared appState.
 *
 * Usage:
 *   import { startTicker, stopTicker } from './ticker-engine.js';
 *   startTicker();   // begin simulation
 *   stopTicker();    // halt (e.g. when tab is hidden)
 */

import { INSTRUMENT_CONFIGS, appState, pushCandle, pushSignal, pushAnomaly, tickKPI, updateRegime, updateOrderBook } from './store.js';
import { detectNextRegime }  from './regime-detector.js';
import { maybeBuildSignal }  from './signal-factory.js';
import { maybeBuildAnomaly } from './anomaly-factory.js';
import { buildOrderBook }    from './orderbook-simulator.js';
import { tickBridge }        from './api-bridge.js';
import type { InstrumentSymbol } from '../types/trading.js';

// ─── CONFIG ───────────────────────────────────────────────────────────────────

/** Market tick interval in milliseconds. */
const TICK_INTERVAL_MS = 800;

/**
 * Probability that a signal is emitted for any given instrument per tick.
 * Per-instrument: ~35% × 5 instruments → ~1–2 signals per tick on average.
 */
const SIGNAL_EMISSION_PROBABILITY = 0.35;

/**
 * Probability that an anomaly is emitted for any given instrument per tick.
 * Kept low so anomalies feel meaningful when they appear.
 */
const ANOMALY_EMISSION_PROBABILITY = 0.12;

/** Minimum ticks before a regime transition can occur. */
const MIN_TICKS_PER_REGIME = 15;

const INSTRUMENTS: readonly InstrumentSymbol[] = [
  'BTCUSD', 'ETHUSD', 'EURUSD', 'XAUUSD', 'NVDA',
] as const;

// ─── TICKER STATE ─────────────────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;

// ─── TICK HANDLER ─────────────────────────────────────────────────────────────

function onTick(): void {
  tickCount++;

  // 1. Advance GBM price + push candle for every instrument
  for (const symbol of INSTRUMENTS) {
    pushCandle(symbol);
  }

  // 2. Regime detection — only sample after minimum dwell time
  if (appState.regime.ticksInRegime >= MIN_TICKS_PER_REGIME) {
    const nextRegime = detectNextRegime(appState.regime);
    updateRegime(nextRegime);
  } else {
    // Still increment ticksInRegime without transitioning
    updateRegime({
      ...appState.regime,
      ticksInRegime: appState.regime.ticksInRegime + 1,
    });
  }

  // 3. Signal generation — attempt for every instrument
  const atrMultiplier = appState.strategyParams.atrMultiplier;
  const confFilter    = appState.strategyParams.signalConfidenceFilter;

  for (const symbol of INSTRUMENTS) {
    const signal = maybeBuildSignal(symbol, atrMultiplier, SIGNAL_EMISSION_PROBABILITY);
    if (signal !== null && signal.xai.confidence >= confFilter) {
      pushSignal(signal);
    }
  }

  // 4. Anomaly generation — attempt for every instrument
  for (const symbol of INSTRUMENTS) {
    const anomaly = maybeBuildAnomaly(symbol, ANOMALY_EMISSION_PROBABILITY);
    if (anomaly !== null) {
      pushAnomaly(anomaly);
    }
  }

  // 5. Rebuild order book for the active instrument
  const activeSymbol = appState.activeInstrument;
  const config       = INSTRUMENT_CONFIGS[activeSymbol];
  // Use the last close price of the most recent candle as mid price
  const candles      = appState.candles[activeSymbol];
  const lastCandle   = candles[candles.length - 1];
  if (lastCandle !== undefined) {
    const book = buildOrderBook(activeSymbol, lastCandle.c, config.decimals);
    updateOrderBook(book);
  }

  // 6. Advance KPI snapshot (includes equityCurve via kpi-engine)
  tickKPI();

  // 7. Tick API bridge monitor
  tickBridge();
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Starts the market simulation ticker.
 * Safe to call multiple times — idempotent (no duplicate intervals).
 */
export function startTicker(): void {
  if (intervalId !== null) return; // already running
  intervalId = setInterval(onTick, TICK_INTERVAL_MS);
}

/**
 * Stops the market simulation ticker.
 * Safe to call when ticker is not running.
 */
export function stopTicker(): void {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}

/**
 * Returns true if the ticker is currently running.
 */
export function isTickerRunning(): boolean {
  return intervalId !== null;
}

/**
 * Returns the number of ticks elapsed since startTicker() was called.
 */
export function getTickCount(): number {
  return tickCount;
}
