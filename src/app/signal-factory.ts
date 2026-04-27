/**
 * AXIOM Platform — Signal Factory
 *
 * Generates realistic AI trade signals with full XAI explanations.
 * Each signal includes: RSI/ATR/VWAP indicator values, source algorithm,
 * confidence score, target price, stop loss, and risk/reward ratio.
 */

import type {
  TradeSignal,
  SignalSide,
  SignalSource,
  XAIExplanation,
  InstrumentSymbol,
} from '../types/trading.js';

import { INSTRUMENT_CONFIGS, getLivePrice } from './store.js';

// ─── SIGNAL GENERATION CONFIG ─────────────────────────────────────────────────

interface SignalTemplate {
  readonly source: SignalSource;
  readonly side: SignalSide;
  readonly primaryReason: string;
  readonly baseConfidence: number;
}

const LONG_TEMPLATES: readonly SignalTemplate[] = [
  { source: 'RSI_DIVERGENCE',        side: 'long',  primaryReason: 'RSI divergence + VWAP reclaim above mean',        baseConfidence: 72 },
  { source: 'MOMENTUM_BREAKOUT',     side: 'long',  primaryReason: 'Momentum breakout confirmed by ATR expansion',    baseConfidence: 68 },
  { source: 'ORDER_FLOW_IMBALANCE',  side: 'long',  primaryReason: 'Order flow imbalance: 3.2x bid dominance',        baseConfidence: 78 },
  { source: 'HMM_REGIME_SHIFT',      side: 'long',  primaryReason: 'HMM regime shift to Trending state detected',     baseConfidence: 65 },
  { source: 'VWAP_DEVIATION',        side: 'long',  primaryReason: 'VWAP deviation -1.8\u03c3 reversal setup',                baseConfidence: 70 },
  { source: 'VOLUME_SPIKE',          side: 'long',  primaryReason: 'Volume spike +240% with price retention',         baseConfidence: 74 },
] as const;

const SHORT_TEMPLATES: readonly SignalTemplate[] = [
  { source: 'RSI_DIVERGENCE',        side: 'short', primaryReason: 'RSI overbought (78) + liquidity gap below',       baseConfidence: 71 },
  { source: 'MOMENTUM_BREAKOUT',     side: 'short', primaryReason: 'Distribution: 4 consecutive bearish candles',     baseConfidence: 66 },
  { source: 'ORDER_FLOW_IMBALANCE',  side: 'short', primaryReason: 'Ask dominance 2.8x — institutional selling',      baseConfidence: 79 },
  { source: 'HMM_REGIME_SHIFT',      side: 'short', primaryReason: 'ATR-based stop breach probability >72%',          baseConfidence: 64 },
  { source: 'VWAP_DEVIATION',        side: 'short', primaryReason: 'Regime shift to Mean-Reverting — fade the move',  baseConfidence: 67 },
  { source: 'VOLUME_SPIKE',          side: 'short', primaryReason: 'VWAP deviation +2.1\u03c3 — statistical reversion due',   baseConfidence: 73 },
] as const;

function pickRandom<T>(arr: readonly T[]): T {
  const idx = Math.floor(Math.random() * arr.length);
  // arr is always non-empty — bounded by const arrays above
  return arr[idx] as T;
}

// ─── XAI EXPLANATION BUILDER ─────────────────────────────────────────────────

function buildXAIExplanation(
  template: SignalTemplate,
  price: number,
  atrMultiplier: number,
): XAIExplanation {
  const rsiVal = template.side === 'long'
    ? 25 + Math.random() * 20  // oversold range 25–45
    : 65 + Math.random() * 20; // overbought range 65–85

  const atrVal = price * 0.008 + Math.random() * price * 0.012;
  const vwapDev = template.side === 'long'
    ? -(1 + Math.random() * 2)   // negative deviation for long
    : (1 + Math.random() * 2);   // positive deviation for short
  const volumeRatio = 1.5 + Math.random() * 3;
  const orderFlow  = template.side === 'long'
    ? 1.5 + Math.random() * 2    // bid dominance
    : -(1.5 + Math.random() * 2); // ask dominance

  const confidenceJitter = Math.floor((Math.random() - 0.5) * 16);
  const confidence = Math.min(98, Math.max(52,
    template.baseConfidence + confidenceJitter,
  ));

  return Object.freeze({
    primaryReason: template.primaryReason,
    indicators: Object.freeze({
      rsi:                Math.round(rsiVal * 10) / 10,
      atr:                Math.round(atrVal * 100) / 100,
      vwapDeviation:      Math.round(vwapDev * 100) / 100,
      volumeRatio:        Math.round(volumeRatio * 100) / 100,
      orderFlowImbalance: Math.round(orderFlow * 100) / 100,
    }),
    source:     template.source,
    confidence,
  });
}

// ─── SIGNAL BUILDER ───────────────────────────────────────────────────────────

export function buildSignal(
  ticker: InstrumentSymbol,
  atrMultiplier: number = 2.0,
): TradeSignal {
  const config   = INSTRUMENT_CONFIGS[ticker];
  const price    = getLivePrice(ticker);
  const side     = Math.random() > 0.5 ? 'long' : 'short';
  const templates = side === 'long' ? LONG_TEMPLATES : SHORT_TEMPLATES;
  const template  = pickRandom(templates);
  const xai       = buildXAIExplanation(template, price, atrMultiplier);

  const atrValue = price * 0.008 + Math.random() * price * 0.012;
  const targetDistance = atrValue * atrMultiplier * (1.5 + Math.random());
  const stopDistance   = atrValue * atrMultiplier;

  const targetPrice = side === 'long'
    ? price + targetDistance
    : price - targetDistance;
  const stopLoss = side === 'long'
    ? price - stopDistance
    : price + stopDistance;

  const riskRewardRatio = Math.abs(targetPrice - price) / Math.abs(stopLoss - price);
  const now = new Date();

  return Object.freeze({
    id:              `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp:       now.getTime(),
    timeLabel:       now.toLocaleTimeString('en-GB'),
    ticker,
    side,
    price,
    priceLabel:      price.toFixed(config.decimals),
    xai,
    targetPrice:     Math.round(targetPrice * 10 ** config.decimals) / 10 ** config.decimals,
    stopLoss:        Math.round(stopLoss    * 10 ** config.decimals) / 10 ** config.decimals,
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
  });
}

export function maybeBuildSignal(
  ticker: InstrumentSymbol,
  atrMultiplier: number,
  emissionProbability: number = 0.35,
): TradeSignal | null {
  if (Math.random() > emissionProbability) return null;
  return buildSignal(ticker, atrMultiplier);
}
