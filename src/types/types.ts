/**
 * AXIOM Platform — Backward-Compatibility Re-exports
 *
 * This file previously contained a parallel type system.
 * All types now live in trading.ts as the single source of truth.
 * Re-exported here so any legacy import paths continue to resolve.
 *
 * DO NOT add new types here — add them to trading.ts.
 */

export type {
  InstrumentSymbol,
  InstrumentConfig,
  OHLCVCandle,
  MarketRegime,
  RegimeState,
  SignalSide,
  SignalSource,
  XAIExplanation,
  TradeSignal,
  AnomalyType,
  AnomalySeverity,
  MarketAnomaly,
  AuditEntryStatus,
  AuditEntry,
  KPISnapshot,
  StrategyParameters,
  DepthLevel,
  OrderBookSnapshot,
  BridgeStatus,
  APIBridgeEndpoint,
  BridgeMetrics,
  ViewName,
  ApplicationState,
} from './trading.js';
