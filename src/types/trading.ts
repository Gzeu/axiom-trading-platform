/**
 * AXIOM Trading Platform — Complete Type System
 * All domain types. No `any`. Strict discriminated unions throughout.
 */

// ─── INSTRUMENTS ────────────────────────────────────────────────────────────

export type InstrumentSymbol =
  | 'BTCUSD'
  | 'ETHUSD'
  | 'EURUSD'
  | 'XAUUSD'
  | 'NVDA';

export interface InstrumentConfig {
  readonly symbol: InstrumentSymbol;
  readonly price: number;
  readonly vol: number;
  /** GBM drift per tick */
  readonly mu: number;
  /** GBM volatility per tick */
  readonly sigma: number;
  /** Decimal places for price display */
  readonly decimals: number;
}

// ─── OHLCV ──────────────────────────────────────────────────────────────────

export interface OHLCVCandle {
  readonly o: number; // open
  readonly h: number; // high
  readonly l: number; // low
  readonly c: number; // close
  readonly v: number; // volume
  readonly timestamp: number; // unix ms
}

// ─── MARKET REGIME ──────────────────────────────────────────────────────────

export type MarketRegime =
  | 'Trending'
  | 'Mean-Reverting'
  | 'Volatile'
  | 'Consolidating';

export interface RegimeState {
  readonly current: MarketRegime;
  readonly confidence: number; // 0–1 HMM posterior probability
  readonly ticksInRegime: number;
  readonly transitionProbabilities: Readonly<Record<MarketRegime, number>>;
}

// ─── TRADE SIGNALS ──────────────────────────────────────────────────────────

export type SignalSide = 'long' | 'short';

export type SignalSource =
  | 'RSI_DIVERGENCE'
  | 'MOMENTUM_BREAKOUT'
  | 'ORDER_FLOW_IMBALANCE'
  | 'HMM_REGIME_SHIFT'
  | 'VWAP_DEVIATION'
  | 'VOLUME_SPIKE';

export interface XAIExplanation {
  /** Human-readable primary reason */
  readonly primaryReason: string;
  /** Contributing indicator values */
  readonly indicators: Readonly<{
    rsi?: number;
    atr?: number;
    vwapDeviation?: number;
    volumeRatio?: number;
    orderFlowImbalance?: number;
  }>;
  /** Source algorithm that produced this signal */
  readonly source: SignalSource;
  /** Confidence score 0–100 */
  readonly confidence: number;
}

export interface TradeSignal {
  readonly id: string;
  readonly timestamp: number;
  readonly timeLabel: string;
  readonly ticker: InstrumentSymbol;
  readonly side: SignalSide;
  readonly price: number;
  readonly priceLabel: string;
  readonly xai: XAIExplanation;
  /** Target price based on ATR projection */
  readonly targetPrice: number;
  /** Stop loss price based on ATR multiplier */
  readonly stopLoss: number;
  /** Expected value: (target - entry) / (entry - stop) */
  readonly riskRewardRatio: number;
}

// ─── ANOMALIES ───────────────────────────────────────────────────────────────

export type AnomalyType =
  | 'Volume Spike'
  | 'Flash Move'
  | 'Liquidity Gap'
  | 'Order Block'
  | 'Regime Shift';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface MarketAnomaly {
  readonly id: string;
  readonly timestamp: number;
  readonly timeLabel: string;
  readonly ticker: InstrumentSymbol;
  readonly type: AnomalyType;
  readonly description: string;
  /** Standard deviations from mean */
  readonly magnitude: number;
  readonly severity: AnomalySeverity;
}

// ─── AUDIT TRAIL ─────────────────────────────────────────────────────────────

export type AuditEntryStatus = 'verified' | 'pending' | 'tampered';

export interface AuditEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly timeLabel: string;
  readonly ticker: InstrumentSymbol;
  readonly side: SignalSide;
  readonly price: number;
  readonly xaiReason: string;
  /** SHA-256-like hash of this entry's payload + previousHash */
  readonly txHash: string;
  /** Hash of the preceding entry — forms the chain */
  readonly previousHash: string;
  readonly status: AuditEntryStatus;
  /** Sequence number in the chain */
  readonly blockIndex: number;
}

// ─── KPI STATE ───────────────────────────────────────────────────────────────

export interface KPISnapshot {
  readonly totalPnL: number;
  readonly pnLPercent: number;
  readonly winRate: number;
  readonly sharpeRatio: number;
  readonly maxDrawdown: number;
  readonly openPositions: number;
  readonly unrealisedPnL: number;
  readonly signalsToday: number;
}

// ─── STRATEGY PARAMETERS ─────────────────────────────────────────────────────

export interface StrategyParameters {
  rsiOverbought: number;   // 60–90
  rsiOversold: number;     // 10–40
  atrMultiplier: number;   // 1.0–4.0
  vwapDeviationBand: number; // 0.5–4.0 %
  signalConfidenceFilter: number; // 50–95 %
  maxPositionSizePct: number; // 1–20 % of equity
}

// ─── LIQUIDITY DEPTH ─────────────────────────────────────────────────────────

export interface DepthLevel {
  readonly price: number;
  readonly quantity: number;
  /** Cumulative quantity from best to this level */
  readonly cumulative: number;
}

export interface OrderBookSnapshot {
  readonly instrument: InstrumentSymbol;
  readonly timestamp: number;
  readonly midPrice: number;
  readonly spread: number;
  readonly bids: readonly DepthLevel[];
  readonly asks: readonly DepthLevel[];
  readonly bidTotalVolume: number;
  readonly askTotalVolume: number;
}

// ─── API BRIDGE ──────────────────────────────────────────────────────────────

export type BridgeStatus = 'connected' | 'degraded' | 'disconnected' | 'reconnecting';

export interface APIBridgeEndpoint {
  readonly name: string;
  readonly url: string;
  status: BridgeStatus;
  latencyMs: number;
  lastHeartbeat: number;
  errorCount: number;
  readonly maxLatencyThresholdMs: number;
}

export interface BridgeMetrics {
  readonly totalMessagesIn: number;
  readonly totalMessagesOut: number;
  readonly avgLatencyMs: number;
  readonly p99LatencyMs: number;
  readonly droppedMessages: number;
  readonly uptimeSeconds: number;
}

// ─── APPLICATION STATE ───────────────────────────────────────────────────────

export type ViewName =
  | 'overview'
  | 'signals'
  | 'anomalies'
  | 'audit'
  | 'strategy'
  | 'bridge';

export interface ApplicationState {
  activeView: ViewName;
  activeInstrument: InstrumentSymbol;
  candles: Record<InstrumentSymbol, OHLCVCandle[]>;
  signals: TradeSignal[];
  anomalies: MarketAnomaly[];
  auditLog: AuditEntry[];
  kpi: KPISnapshot;
  regime: RegimeState;
  orderBook: OrderBookSnapshot | null;
  strategyParams: StrategyParameters;
  bridge: {
    endpoints: APIBridgeEndpoint[];
    metrics: BridgeMetrics;
  };
  ui: {
    signalBadgeCount: number;
    anomalyBadgeCount: number;
    lastRenderMs: number;
  };
}
