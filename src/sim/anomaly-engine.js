/**
 * anomaly-engine.js — Market Anomaly Detection Simulation
 *
 * Detects volume spikes, price gaps, liquidity vacuums, flash moves,
 * and spread widening events from OHLCV history.
 */

'use strict';

let anomalyCounter = 0;

// Severity thresholds for each anomaly type
const ANOMALY_THRESHOLDS = {
  VOLUME_SPIKE:      { volumeZScore: 2.5 },
  PRICE_GAP:         { gapPct: 0.003 },
  LIQUIDITY_VACUUM:  { volumeZScore: -2.0 },
  FLASH_MOVE:        { bodyPct: 0.008 },
  SPREAD_WIDENING:   { wickRatio: 3.0 },
};

/**
 * Computes rolling mean and standard deviation for a number array.
 * @param {number[]} values
 * @returns {{ mean: number, stdDev: number }}
 */
function rollingStats(values) {
  if (values.length === 0) return { mean: 0, stdDev: 1 };
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) || 1 };
}

/**
 * Scans the latest candle against rolling history for anomaly events.
 * @param {string} symbol
 * @param {{ open: number, high: number, low: number, close: number, volume: number }[]} candleHistory
 * @returns {object | null} AnomalyEvent or null
 */
function detectAnomaly(symbol, candleHistory) {
  if (candleHistory.length < 20) return null;

  const latest = candleHistory[candleHistory.length - 1];
  const previous = candleHistory[candleHistory.length - 2];
  const recentVolumes = candleHistory.slice(-20).map(candle => candle.volume);
  const { mean: meanVol, stdDev: stdDevVol } = rollingStats(recentVolumes);

  const volumeZScore = (latest.volume - meanVol) / stdDevVol;
  const bodySize = Math.abs(latest.close - latest.open);
  const bodyPct = bodySize / latest.open;
  const gapPct = Math.abs(latest.open - previous.close) / previous.close;
  const wickSize = (latest.high - latest.low) - bodySize;
  const wickRatio = bodySize > 0 ? wickSize / bodySize : 0;

  // Check each anomaly type in priority order
  if (volumeZScore >= ANOMALY_THRESHOLDS.VOLUME_SPIKE.volumeZScore) {
    anomalyCounter++;
    return buildAnomalyEvent(symbol, 'VOLUME_SPIKE', latest,
      Math.min((volumeZScore - 2.5) / 2 + 0.5, 1.0),
      `Volume ${volumeZScore.toFixed(1)}σ above mean — institutional activity suspected`);
  }

  if (volumeZScore <= ANOMALY_THRESHOLDS.LIQUIDITY_VACUUM.volumeZScore) {
    anomalyCounter++;
    return buildAnomalyEvent(symbol, 'LIQUIDITY_VACUUM', latest,
      Math.min(Math.abs(volumeZScore + 2) / 2 + 0.4, 0.9),
      `Volume ${Math.abs(volumeZScore).toFixed(1)}σ below mean — liquidity withdrawn`);
  }

  if (gapPct >= ANOMALY_THRESHOLDS.PRICE_GAP.gapPct) {
    anomalyCounter++;
    return buildAnomalyEvent(symbol, 'PRICE_GAP', latest,
      Math.min(gapPct / 0.01, 1.0),
      `Price gap of ${(gapPct * 100).toFixed(3)}% detected at open`);
  }

  if (bodyPct >= ANOMALY_THRESHOLDS.FLASH_MOVE.bodyPct) {
    anomalyCounter++;
    return buildAnomalyEvent(symbol, 'FLASH_MOVE', latest,
      Math.min(bodyPct / 0.02, 1.0),
      `Flash move: ${(bodyPct * 100).toFixed(3)}% candle body in single period`);
  }

  if (wickRatio >= ANOMALY_THRESHOLDS.SPREAD_WIDENING.wickRatio) {
    anomalyCounter++;
    return buildAnomalyEvent(symbol, 'SPREAD_WIDENING', latest,
      Math.min((wickRatio - 3) / 3 + 0.5, 0.85),
      `Wick/body ratio ${wickRatio.toFixed(1)}x — spread widening, order book thin`);
  }

  return null;
}

/**
 * Constructs an AnomalyEvent object.
 * @param {string} symbol
 * @param {string} type
 * @param {{ close: number, timestamp: number }} latestCandle
 * @param {number} severity
 * @param {string} description
 * @returns {object}
 */
function buildAnomalyEvent(symbol, type, latestCandle, severity, description) {
  return {
    anomalyId:           `ANO-${String(anomalyCounter).padStart(4, '0')}`,
    instrument:          symbol,
    timestamp:           latestCandle.timestamp,
    type,
    severity:            parseFloat(Math.max(0, Math.min(1, severity)).toFixed(3)),
    description,
    affectedPriceLevel:  latestCandle.close,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectAnomaly, buildAnomalyEvent, rollingStats };
}
