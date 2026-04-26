// AXIOM Trading Platform — Core Type Definitions
// All data contracts between simulation engines and the dashboard view layer.

export type MarketRegime =
  | 'TRENDING_BULL'
  | 'TRENDING_BEAR'
  | 'RANGING'
  | 'HIGH_VOLATILITY';

export type TradeAction =
  | 'LONG_ENTRY'
  | 'SHORT_ENTRY'
  | 'CLOSE_LONG'
  | 'CLOSE_SHORT'
  | 'HOLD';

export type SignalDirection = 'bullish' | 'bearish' | 'neutral';

export type AnomalyType =
  | 'VOLUME_SPIKE'
  | 'PRICE_GAP'
  | 'LIQUIDITY_VACUUM'
  | 'FLASH_MOVE'
  | 'SPREAD_WIDENING';

export type ApiStatus = 'HEALTHY' | 'DEGRADED' | 'OFFLINE';

// ─── OHLCV ───────────────────────────────────────────────────────────────────

export interface OHLCVCandle {
  timestamp: number;    // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── MARKET FEATURES ─────────────────────────────────────────────────────────

export interface MarketFeatures {
  rsi: number;           // 0–100
  atr: number;           // Absolute price units
  vwapDeviation: number; // Fraction of VWAP (e.g., -0.012 = 1.2% below)
  volumeZScore: number;  // Standard deviations from mean volume
  momentum: number;      // 10-period rate of change
  bbWidth: number;       // Bollinger Band width as fraction of price
}

// ─── SIGNALS ─────────────────────────────────────────────────────────────────

export interface XAIFactor {
  feature: string;
  value: number;
  weight: number;
  direction: SignalDirection;
}

export interface TradeSignal {
  signalId: string;
  instrument: string;
  timestamp: number;
  action: TradeAction;
  confidence: number;           // 0–1
  regime: MarketRegime;
  primaryDriver: string;
  contributingFactors: XAIFactor[];
  riskNote: string;
  modelVersion: string;
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
}

// ─── ANOMALIES ────────────────────────────────────────────────────────────────

export interface AnomalyEvent {
  anomalyId: string;
  instrument: string;
  timestamp: number;
  type: AnomalyType;
  severity: number;     // 0–1
  description: string;
  affectedPriceLevel: number;
}

// ─── AUDIT CHAIN ─────────────────────────────────────────────────────────────

export interface AuditBlock {
  index: number;
  timestamp: number;
  signalId: string;
  instrument: string;
  action: TradeAction;
  confidence: number;
  regime: MarketRegime;
  modelVersion: string;
  executor: string;
  prevHash: string;
  hash: string;
}

// ─── PLATFORM STATE ──────────────────────────────────────────────────────────

export interface KPIState {
  totalPnL: number;          // Absolute USD
  dailyPnL: number;
  winRate: number;           // 0–1
  sharpeRatio: number;
  maxDrawdown: number;       // 0–1
  openPositions: number;
  totalSignals: number;
}

export interface ApiLatency {
  quantToRisk: number;       // ms
  riskToRouter: number;      // ms
  routerToGateway: number;   // ms
  status: ApiStatus;
}

export interface InstrumentState {
  symbol: string;
  candles: OHLCVCandle[];
  currentRegime: MarketRegime;
  regimeConfidence: number;
  lastSignal: TradeSignal | null;
  position: 'LONG' | 'SHORT' | 'FLAT';
}

export interface PlatformState {
  activeInstrument: string;
  instruments: Record<string, InstrumentState>;
  signalHistory: TradeSignal[];
  anomalyHistory: AnomalyEvent[];
  auditChain: AuditBlock[];
  kpi: KPIState;
  apiLatency: ApiLatency;
  activeView: 'overview' | 'signals' | 'anomalies' | 'audit' | 'strategy';
  tick: number;
}

// ─── STRATEGY LAB ────────────────────────────────────────────────────────────

export interface StrategyParams {
  confidenceThreshold: number;  // 0.5–0.95
  positionSizeMultiplier: number; // 0.5–3.0
  stopLossPct: number;          // 0.5–5.0
  takeProfitPct: number;        // 1.0–10.0
  regimeSensitivity: number;    // 0.1–1.0
  maxOpenPositions: number;     // 1–10
}
