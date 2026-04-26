/**
 * signal-engine.js — AI Signal Generation & XAI Explanation Engine
 *
 * Consumes OHLCV candle history + market regime to produce typed trade signals.
 * Every signal includes a structured XAI explanation with feature attribution weights.
 */

'use strict';

let signalCounter = 0;
const MODEL_VERSION = 'v2.4.1';

// ─── TECHNICAL INDICATORS ────────────────────────────────────────────────────

/**
 * Computes RSI(14) from a closing price array.
 * @param {number[]} closes
 * @returns {number} RSI value 0–100, or 50 if insufficient data
 */
function computeRSI(closes) {
  const period = 14;
  if (closes.length < period + 1) return 50;

  const recent = closes.slice(-(period + 1));
  let gains = 0;
  let losses = 0;

  for (let priceIndex = 1; priceIndex < recent.length; priceIndex++) {
    const delta = recent[priceIndex] - recent[priceIndex - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * Computes ATR(14) — Average True Range.
 * @param {{ high: number, low: number, close: number }[]} candles
 * @returns {number}
 */
function computeATR(candles) {
  const period = 14;
  if (candles.length < period + 1) return 0;

  const recent = candles.slice(-(period + 1));
  let totalTrueRange = 0;

  for (let candleIndex = 1; candleIndex < recent.length; candleIndex++) {
    const high = recent[candleIndex].high;
    const low = recent[candleIndex].low;
    const prevClose = recent[candleIndex - 1].close;
    const trueRange = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    );
    totalTrueRange += trueRange;
  }

  return parseFloat((totalTrueRange / period).toFixed(4));
}

/**
 * Computes VWAP deviation: (close - VWAP) / VWAP.
 * @param {{ close: number, volume: number }[]} candles
 * @param {number} windowSize
 * @returns {number}
 */
function computeVWAPDeviation(candles, windowSize = 20) {
  const recent = candles.slice(-windowSize);
  if (recent.length < 2) return 0;

  let totalPriceVolume = 0;
  let totalVolume = 0;
  for (const candle of recent) {
    totalPriceVolume += candle.close * candle.volume;
    totalVolume += candle.volume;
  }

  if (totalVolume === 0) return 0;
  const vwap = totalPriceVolume / totalVolume;
  const currentClose = recent[recent.length - 1].close;
  return parseFloat(((currentClose - vwap) / vwap).toFixed(6));
}

/**
 * Computes volume z-score relative to a rolling window.
 * @param {number[]} volumes
 * @param {number} windowSize
 * @returns {number}
 */
function computeVolumeZScore(volumes, windowSize = 20) {
  const recent = volumes.slice(-windowSize);
  if (recent.length < 2) return 0;

  const mean = recent.reduce((sum, vol) => sum + vol, 0) / recent.length;
  const variance = recent.reduce((sum, vol) => sum + Math.pow(vol - mean, 2), 0) / recent.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  const latestVolume = recent[recent.length - 1];
  return parseFloat(((latestVolume - mean) / stdDev).toFixed(3));
}

/**
 * Computes 10-period rate of change (momentum).
 * @param {number[]} closes
 * @returns {number}
 */
function computeMomentum(closes) {
  const period = 10;
  if (closes.length < period + 1) return 0;
  const current = closes[closes.length - 1];
  const previous = closes[closes.length - 1 - period];
  return parseFloat(((current - previous) / previous).toFixed(6));
}

/**
 * Computes Bollinger Band width as a fraction of the middle band.
 * @param {number[]} closes
 * @param {number} period
 * @returns {number}
 */
function computeBBWidth(closes, period = 20) {
  if (closes.length < period) return 0;
  const recent = closes.slice(-period);
  const mean = recent.reduce((sum, close) => sum + close, 0) / period;
  const variance = recent.reduce((sum, close) => sum + Math.pow(close - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  if (mean === 0) return 0;
  return parseFloat(((4 * stdDev) / mean).toFixed(6)); // 2σ band width / mean
}

// ─── SIGNAL GENERATION ───────────────────────────────────────────────────────

/**
 * Determines the trade action from features and regime.
 * @param {object} features
 * @param {string} regime
 * @param {number} confidenceThreshold
 * @returns {{ action: string, confidence: number, primaryDriver: string, riskNote: string }}
 */
function determineSignal(features, regime, confidenceThreshold = 0.65) {
  const { rsi, atr, vwapDeviation, volumeZScore, momentum, bbWidth } = features;

  // Score bullish evidence (0–1 per factor)
  const bullishScore =
    (rsi < 35 ? 0.38 : rsi < 50 ? 0.15 : 0) +
    (vwapDeviation < -0.008 ? 0.29 : vwapDeviation < 0 ? 0.10 : 0) +
    (volumeZScore > 1.5 ? 0.21 : volumeZScore > 0.5 ? 0.08 : 0) +
    (momentum > 0.002 ? 0.12 : momentum > 0 ? 0.05 : 0);

  // Score bearish evidence
  const bearishScore =
    (rsi > 65 ? 0.38 : rsi > 50 ? 0.15 : 0) +
    (vwapDeviation > 0.008 ? 0.29 : vwapDeviation > 0 ? 0.10 : 0) +
    (volumeZScore > 1.5 ? 0.21 : volumeZScore > 0.5 ? 0.08 : 0) +
    (momentum < -0.002 ? 0.12 : momentum < 0 ? 0.05 : 0);

  // ATR spike check — elevates risk note
  const atrSpike = atr > 0 && bbWidth > 0.04;
  const riskNote = atrSpike
    ? 'ATR elevated — reduce position size by 20%'
    : bbWidth < 0.01
    ? 'Bollinger Band squeeze — breakout imminent, await confirmation'
    : 'Normal risk profile';

  if (regime === 'TRENDING_BULL' && bullishScore >= confidenceThreshold) {
    return { action: 'LONG_ENTRY',  confidence: Math.min(bullishScore, 0.97), primaryDriver: 'RSI oversold + momentum confluence', riskNote };
  }
  if (regime === 'TRENDING_BEAR' && bearishScore >= confidenceThreshold) {
    return { action: 'SHORT_ENTRY', confidence: Math.min(bearishScore, 0.97), primaryDriver: 'RSI overbought + negative momentum', riskNote };
  }
  if ((regime === 'TRENDING_BULL' || regime === 'HIGH_VOLATILITY') && rsi > 75) {
    return { action: 'CLOSE_LONG',  confidence: 0.72 + Math.random() * 0.15, primaryDriver: 'RSI overbought exit signal', riskNote };
  }
  if ((regime === 'TRENDING_BEAR' || regime === 'HIGH_VOLATILITY') && rsi < 25) {
    return { action: 'CLOSE_SHORT', confidence: 0.70 + Math.random() * 0.15, primaryDriver: 'RSI oversold exit signal', riskNote };
  }

  return { action: 'HOLD', confidence: 0.52, primaryDriver: 'No edge detected — regime RANGING', riskNote: 'Await regime clarification' };
}

/**
 * Builds XAI factor attributions for a signal.
 * @param {object} features
 * @param {string} action
 * @returns {Array<{ feature: string, value: number, weight: number, direction: string }>}
 */
function buildXAIFactors(features, action) {
  const isBullish = action === 'LONG_ENTRY' || action === 'CLOSE_SHORT';
  const isBearish = action === 'SHORT_ENTRY' || action === 'CLOSE_LONG';

  const rsiDirection = features.rsi < 45 ? 'bullish' : features.rsi > 55 ? 'bearish' : 'neutral';
  const vwapDirection = features.vwapDeviation < 0 ? 'bullish' : features.vwapDeviation > 0 ? 'bearish' : 'neutral';
  const volDirection = features.volumeZScore > 0.5 ? (isBullish ? 'bullish' : 'bearish') : 'neutral';
  const momDirection = features.momentum > 0 ? 'bullish' : features.momentum < 0 ? 'bearish' : 'neutral';

  return [
    { feature: 'RSI',          value: features.rsi,             weight: 0.38, direction: rsiDirection },
    { feature: 'VWAP_dev',     value: features.vwapDeviation,   weight: 0.29, direction: vwapDirection },
    { feature: 'Volume_zscore',value: features.volumeZScore,    weight: 0.21, direction: volDirection },
    { feature: 'Momentum',     value: features.momentum,        weight: 0.12, direction: momDirection },
  ];
}

// ─── SIGNAL ENGINE FACTORY ───────────────────────────────────────────────────

/**
 * Creates the signal engine for a given instrument.
 * @param {string} symbol
 * @returns {object}
 */
function createSignalEngine(symbol) {
  let signalStreak = 0;
  let winCount = 0;
  let totalEvaluated = 0;
  let confidenceThreshold = 0.65;

  return {
    /**
     * Evaluates candle history and regime to produce a TradeSignal.
     * @param {{ high: number, low: number, close: number, volume: number }[]} candleHistory
     * @param {string} regime
     * @returns {object} TradeSignal
     */
    evaluate(candleHistory, regime) {
      if (candleHistory.length < 20) return null;

      const closes  = candleHistory.map(candle => candle.close);
      const volumes = candleHistory.map(candle => candle.volume);

      const features = {
        rsi:            computeRSI(closes),
        atr:            computeATR(candleHistory),
        vwapDeviation:  computeVWAPDeviation(candleHistory),
        volumeZScore:   computeVolumeZScore(volumes),
        momentum:       computeMomentum(closes),
        bbWidth:        computeBBWidth(closes),
      };

      const { action, confidence, primaryDriver, riskNote } = determineSignal(
        features,
        regime,
        confidenceThreshold,
      );

      const currentClose = closes[closes.length - 1];
      const atr = features.atr || currentClose * 0.01;

      signalCounter++;
      const signal = {
        signalId:            `SIG-${String(signalCounter).padStart(4, '0')}`,
        instrument:          symbol,
        timestamp:           Date.now(),
        action,
        confidence:          parseFloat(confidence.toFixed(4)),
        regime,
        primaryDriver,
        contributingFactors: buildXAIFactors(features, action),
        riskNote,
        modelVersion:        MODEL_VERSION,
        entryPrice:          currentClose,
        targetPrice:         parseFloat((action === 'LONG_ENTRY'
          ? currentClose + atr * 2
          : currentClose - atr * 2).toFixed(2)),
        stopPrice:           parseFloat((action === 'LONG_ENTRY'
          ? currentClose - atr * 1.5
          : currentClose + atr * 1.5).toFixed(2)),
      };

      // Self-improvement: adapt threshold every 50 signals
      totalEvaluated++;
      if (totalEvaluated % 50 === 0) {
        const winRate = winCount / Math.max(totalEvaluated, 1);
        if (winRate < 0.48) confidenceThreshold = Math.min(confidenceThreshold + 0.05, 0.90);
        else if (winRate > 0.62) confidenceThreshold = Math.max(confidenceThreshold - 0.03, 0.55);
      }

      return signal;
    },

    recordOutcome(won) {
      if (won) winCount++;
    },

    getConfidenceThreshold() {
      return confidenceThreshold;
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createSignalEngine, computeRSI, computeATR, computeVWAPDeviation, computeVolumeZScore, computeMomentum, computeBBWidth };
}
