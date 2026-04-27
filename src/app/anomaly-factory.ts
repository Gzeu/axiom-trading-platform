/**
 * AXIOM Platform — Anomaly Factory
 *
 * Generates realistic market anomaly events with typed severity classification.
 * Each anomaly type has a distinct description template reflecting its domain meaning.
 */

import type {
  MarketAnomaly,
  AnomalyType,
  AnomalySeverity,
  InstrumentSymbol,
} from '../types/trading.js';

const ANOMALY_TYPES: readonly AnomalyType[] = [
  'Volume Spike',
  'Flash Move',
  'Liquidity Gap',
  'Order Block',
  'Regime Shift',
] as const;

function classifySeverity(magnitude: number): AnomalySeverity {
  if (magnitude > 7) return 'high';
  if (magnitude > 4) return 'medium';
  return 'low';
}

function buildDescription(type: AnomalyType, magnitude: number): string {
  switch (type) {
    case 'Volume Spike':
      return `Volume ${(magnitude * 40).toFixed(0)}% above 20-period average`;
    case 'Flash Move':
      return `Price moved ${magnitude.toFixed(2)}\u03c3 in single tick`;
    case 'Liquidity Gap':
      return `Orderbook gap detected: ${(magnitude * 15).toFixed(0)} levels thin`;
    case 'Order Block':
      return `Institutional order block ${magnitude.toFixed(1)}x normal size`;
    case 'Regime Shift':
      return `HMM state transition probability ${(magnitude * 10).toFixed(0)}%`;
  }
}

export function buildAnomaly(ticker: InstrumentSymbol): MarketAnomaly {
  const type      = ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)] as AnomalyType;
  const magnitude = 1.2 + Math.random() * 8.8;
  const severity  = classifySeverity(magnitude);
  const now       = new Date();

  return Object.freeze({
    id:          `anm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp:   now.getTime(),
    timeLabel:   now.toLocaleTimeString('en-GB'),
    ticker,
    type,
    description: buildDescription(type, magnitude),
    magnitude:   Math.round(magnitude * 100) / 100,
    severity,
  });
}

export function maybeBuildAnomaly(
  ticker: InstrumentSymbol,
  emissionProbability: number = 0.12,
): MarketAnomaly | null {
  if (Math.random() > emissionProbability) return null;
  return buildAnomaly(ticker);
}
