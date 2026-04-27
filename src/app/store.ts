/**
 * AXIOM Platform — Central State Store
 *
 * Pure in-memory state with typed mutation functions.
 * No external state library — avoids runtime overhead.
 * All mutations return void and operate on appState directly;
 * callers re-render after each mutation.
 *
 * KPI snapshot (including equityCurve) is advanced each tick via
 * tickKPISnapshot imported from kpi-engine.ts.
 */

import type {
  ApplicationState,
  InstrumentSymbol,
  InstrumentConfig,
  OHLCVCandle,
  MarketRegime,
  RegimeState,
  TradeSignal,
  MarketAnomaly,
  AuditEntry,
  KPISnapshot,
  StrategyParameters,
  OrderBookSnapshot,
  DepthLevel,
  APIBridgeEndpoint,
  BridgeMetrics,
  ViewName,
} from '../types/trading.js';

import { tickKPISnapshot, createInitialKPISnapshot, incrementSignalCount } from './kpi-engine.js';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

export const INSTRUMENT_CONFIGS: Readonly<Record<InstrumentSymbol, InstrumentConfig>> = {
  BTCUSD: { symbol: 'BTCUSD', price: 67420,  vol: 1.4, mu: 0.0001,  sigma: 0.018, decimals: 0 },
  ETHUSD: { symbol: 'ETHUSD', price: 3540,   vol: 1.2, mu: 0.0001,  sigma: 0.022, decimals: 1 },
  EURUSD: { symbol: 'EURUSD', price: 1.0852, vol: 0.6, mu: 0.00003, sigma: 0.004, decimals: 4 },
  XAUUSD: { symbol: 'XAUUSD', price: 2318,   vol: 0.8, mu: 0.00005, sigma: 0.008, decimals: 1 },
  NVDA:   { symbol: 'NVDA',   price: 876,    vol: 1.1, mu: 0.0002,  sigma: 0.025, decimals: 2 },
} as const;

export const MARKET_REGIMES: readonly MarketRegime[] = [
  'Trending', 'Mean-Reverting', 'Volatile', 'Consolidating',
] as const;

export const REGIME_COLORS: Readonly<Record<MarketRegime, string>> = {
  'Trending':       '#06d6a0',
  'Mean-Reverting': '#a78bfa',
  'Volatile':       '#ef4444',
  'Consolidating':  '#ffb703',
} as const;

const MAX_CANDLE_HISTORY  = 80;
const MAX_SIGNAL_HISTORY  = 50;
const MAX_ANOMALY_HISTORY = 40;
const MAX_AUDIT_HISTORY   = 50;

// ─── MUTABLE LIVE PRICES (updated by GBM each tick) ─────────────────────────
// Separated from INSTRUMENT_CONFIGS so GBM can mutate price without cloning.

const livePrices: Record<InstrumentSymbol, number> = {
  BTCUSD: 67420,
  ETHUSD: 3540,
  EURUSD: 1.0852,
  XAUUSD: 2318,
  NVDA:   876,
};

export function getLivePrice(symbol: InstrumentSymbol): number {
  const price = livePrices[symbol];
  // Defensive invariant: GBM guarantees price > 0
  return price > 0 ? price : 0.001;
}

// ─── GBM PRICE SIMULATOR ─────────────────────────────────────────────────────

/**
 * Advances price by one GBM step.
 * dt = 1 / (252 trading days * 78 ticks/day) — intraday scale.
 */
export function gbmStep(symbol: InstrumentSymbol): number {
  const config     = INSTRUMENT_CONFIGS[symbol];
  const current    = livePrices[symbol];
  const dt         = 1 / (252 * 78);
  const drift      = config.mu - 0.5 * config.sigma * config.sigma;
  const diffusion  = config.sigma * (Math.random() * 2 - 1) * Math.sqrt(dt);
  const next       = current * Math.exp(drift + diffusion);
  livePrices[symbol] = Math.max(next, 0.001);
  return livePrices[symbol];
}

/**
 * Generates one OHLCV candle using the current live price.
 */
export function generateCandle(symbol: InstrumentSymbol): OHLCVCandle {
  const openPrice  = livePrices[symbol];
  const closePrice = gbmStep(symbol);
  const high       = Math.max(openPrice, closePrice) * (1 + Math.random() * 0.003);
  const low        = Math.min(openPrice, closePrice) * (1 - Math.random() * 0.003);
  const volume     = 1_000 + Math.random() * 9_000;
  return Object.freeze({
    o:         openPrice,
    h:         high,
    l:         low,
    c:         closePrice,
    v:         volume,
    timestamp: Date.now(),
  });
}

// ─── AUDIT HASH CHAIN ────────────────────────────────────────────────────────

/**
 * Deterministic-ish FNV-1a mock hash.
 * Not cryptographically secure — simulation only.
 */
function computeEntryHash(payload: string): string {
  let hash = 0x811c9dc5n;
  for (let i = 0; i < payload.length; i++) {
    hash ^= BigInt(payload.charCodeAt(i));
    hash  = (hash * 0x01000193n) & 0xFF_FF_FF_FF_FF_FF_FF_FFn;
  }
  const deterministicPart = hash.toString(16).padStart(16, '0');
  const noisePart          = Math.random().toString(16).slice(2, 18).padEnd(16, '0');
  return deterministicPart + noisePart;
}

function buildAuditEntry(
  signal: TradeSignal,
  previousHash: string,
  blockIndex: number,
): AuditEntry {
  const payload = [
    signal.timeLabel,
    signal.ticker,
    signal.side,
    signal.price.toFixed(INSTRUMENT_CONFIGS[signal.ticker].decimals),
    previousHash,
  ].join('|');
  const txHash = computeEntryHash(payload);
  return Object.freeze({
    id:           `audit-${blockIndex}-${txHash.slice(0, 8)}`,
    timestamp:    signal.timestamp,
    timeLabel:    signal.timeLabel,
    ticker:       signal.ticker,
    side:         signal.side,
    price:        signal.price,
    xaiReason:    signal.xai.primaryReason,
    txHash,
    previousHash,
    status:       'verified' as const,
    blockIndex,
  });
}

// ─── INITIAL STATE ────────────────────────────────────────────────────────────

function buildInitialCandles(): Record<InstrumentSymbol, OHLCVCandle[]> {
  const symbols: InstrumentSymbol[] = ['BTCUSD', 'ETHUSD', 'EURUSD', 'XAUUSD', 'NVDA'];
  const candles = {} as Record<InstrumentSymbol, OHLCVCandle[]>;
  for (const symbol of symbols) {
    candles[symbol] = [];
    for (let tick = 0; tick < 60; tick++) {
      candles[symbol].push(generateCandle(symbol));
    }
  }
  return candles;
}

function buildInitialRegime(): RegimeState {
  return Object.freeze({
    current:                 'Trending' as const,
    confidence:              0.82,
    ticksInRegime:           0,
    transitionProbabilities: Object.freeze({
      'Trending':       0.75,
      'Mean-Reverting': 0.12,
      'Volatile':       0.08,
      'Consolidating':  0.05,
    }),
  });
}

function buildInitialStrategyParams(): StrategyParameters {
  return {
    rsiOverbought:          70,
    rsiOversold:            30,
    atrMultiplier:          2.0,
    vwapDeviationBand:      1.5,
    signalConfidenceFilter: 65,
    maxPositionSizePct:     5,
  };
}

function buildInitialBridgeEndpoints(): APIBridgeEndpoint[] {
  return [
    { name: 'Market Data Feed', url: 'wss://feed.axiom-sim.internal/v2/market',   status: 'connected', latencyMs: 12, lastHeartbeat: Date.now(), errorCount: 0, maxLatencyThresholdMs: 50  },
    { name: 'Execution Engine', url: 'wss://exec.axiom-sim.internal/v1/orders',   status: 'connected', latencyMs: 8,  lastHeartbeat: Date.now(), errorCount: 0, maxLatencyThresholdMs: 25  },
    { name: 'ML Inference API', url: 'https://ml.axiom-sim.internal/v1/predict',  status: 'connected', latencyMs: 34, lastHeartbeat: Date.now(), errorCount: 0, maxLatencyThresholdMs: 100 },
    { name: 'Audit Chain Node', url: 'https://audit.axiom-sim.internal/v1/chain', status: 'connected', latencyMs: 22, lastHeartbeat: Date.now(), errorCount: 0, maxLatencyThresholdMs: 150 },
    { name: 'Risk Engine',      url: 'wss://risk.axiom-sim.internal/v1/monitor',  status: 'connected', latencyMs: 6,  lastHeartbeat: Date.now(), errorCount: 0, maxLatencyThresholdMs: 20  },
  ];
}

function buildInitialBridgeMetrics(): BridgeMetrics {
  return {
    totalMessagesIn:  0,
    totalMessagesOut: 0,
    avgLatencyMs:     16.4,
    p99LatencyMs:     48.2,
    droppedMessages:  0,
    uptimeSeconds:    0,
  };
}

export const appState: ApplicationState = {
  activeView:       'overview',
  activeInstrument: 'BTCUSD',
  candles:          buildInitialCandles(),
  signals:          [],
  anomalies:        [],
  auditLog:         [],
  kpi:              createInitialKPISnapshot(),   // ← wired to kpi-engine
  regime:           buildInitialRegime(),
  orderBook:        null,
  strategyParams:   buildInitialStrategyParams(),
  bridge: {
    endpoints: buildInitialBridgeEndpoints(),
    metrics:   buildInitialBridgeMetrics(),
  },
  ui: {
    signalBadgeCount:  0,
    anomalyBadgeCount: 0,
    lastRenderMs:      0,
  },
};

// ─── STATE MUTATION FUNCTIONS ─────────────────────────────────────────────────

export function pushCandle(symbol: InstrumentSymbol): void {
  const candle     = generateCandle(symbol);
  const candleList = appState.candles[symbol];
  candleList.push(candle);
  if (candleList.length > MAX_CANDLE_HISTORY) candleList.shift();
}

export function pushSignal(signal: TradeSignal): void {
  appState.signals.unshift(signal);
  if (appState.signals.length > MAX_SIGNAL_HISTORY) appState.signals.pop();

  // Increment signal counter via kpi-engine (keeps count in KPISnapshot)
  appState.kpi = incrementSignalCount(appState.kpi);
  appState.ui.signalBadgeCount = Math.min(appState.ui.signalBadgeCount + 1, 99);

  // Append blockchain audit entry
  const prevHash = appState.auditLog[0]?.txHash
    ?? '0000000000000000000000000000000000000000';
  const entry = buildAuditEntry(signal, prevHash, appState.auditLog.length);
  appState.auditLog.unshift(entry);
  if (appState.auditLog.length > MAX_AUDIT_HISTORY) appState.auditLog.pop();
}

export function pushAnomaly(anomaly: MarketAnomaly): void {
  appState.anomalies.unshift(anomaly);
  if (appState.anomalies.length > MAX_ANOMALY_HISTORY) appState.anomalies.pop();
  appState.ui.anomalyBadgeCount = Math.min(appState.ui.anomalyBadgeCount + 1, 99);
}

/**
 * Advances the KPI snapshot by one tick using kpi-engine.tickKPISnapshot.
 * Called by ticker-engine on every market tick.
 */
export function tickKPI(): void {
  appState.kpi = tickKPISnapshot(appState.kpi);
}

export function updateKPI(delta: Partial<KPISnapshot>): void {
  appState.kpi = Object.freeze({ ...appState.kpi, ...delta });
}

export function updateRegime(regime: RegimeState): void {
  appState.regime = regime;
}

export function setActiveView(view: ViewName): void {
  appState.activeView = view;
  if (view === 'signals')   appState.ui.signalBadgeCount  = 0;
  if (view === 'anomalies') appState.ui.anomalyBadgeCount = 0;
}

export function setActiveInstrument(symbol: InstrumentSymbol): void {
  appState.activeInstrument = symbol;
}

export function updateStrategyParam<K extends keyof StrategyParameters>(
  key: K,
  value: StrategyParameters[K],
): void {
  appState.strategyParams = { ...appState.strategyParams, [key]: value };
}

export function updateBridgeEndpoint(
  name: string,
  patch: Partial<Pick<APIBridgeEndpoint, 'status' | 'latencyMs' | 'lastHeartbeat' | 'errorCount'>>,
): void {
  const idx = appState.bridge.endpoints.findIndex(ep => ep.name === name);
  if (idx === -1) return;
  const existing = appState.bridge.endpoints[idx];
  if (existing === undefined) return;
  appState.bridge.endpoints[idx] = { ...existing, ...patch };
}

export function updateBridgeMetrics(patch: Partial<BridgeMetrics>): void {
  appState.bridge.metrics = { ...appState.bridge.metrics, ...patch };
}

export function updateOrderBook(snapshot: OrderBookSnapshot): void {
  appState.orderBook = snapshot;
}
