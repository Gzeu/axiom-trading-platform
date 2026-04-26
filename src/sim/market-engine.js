/**
 * market-engine.js — OHLCV Simulation Engine
 *
 * Generates realistic candlestick data using geometric Brownian motion
 * with regime-dependent drift and volatility parameters.
 * Regime transitions follow a simulated Hidden Markov Model.
 */

'use strict';

// ─── REGIME PARAMETERS ───────────────────────────────────────────────────────

const REGIME_PARAMS = {
  TRENDING_BULL:  { drift: 0.0004,  volatility: 0.008, volumeMult: 1.2 },
  TRENDING_BEAR:  { drift: -0.0004, volatility: 0.009, volumeMult: 1.3 },
  RANGING:        { drift: 0.00005, volatility: 0.004, volumeMult: 0.8 },
  HIGH_VOLATILITY:{ drift: 0.0001,  volatility: 0.022, volumeMult: 2.1 },
};

// Markov transition matrix — rows = current regime, columns = next regime
// Order: BULL, BEAR, RANGING, HIGH_VOL
const TRANSITION_MATRIX = {
  TRENDING_BULL:   [0.85, 0.05, 0.07, 0.03],
  TRENDING_BEAR:   [0.04, 0.83, 0.08, 0.05],
  RANGING:         [0.10, 0.10, 0.75, 0.05],
  HIGH_VOLATILITY: [0.15, 0.20, 0.30, 0.35],
};

const REGIMES = ['TRENDING_BULL', 'TRENDING_BEAR', 'RANGING', 'HIGH_VOLATILITY'];

// ─── GAUSSIAN RANDOM ─────────────────────────────────────────────────────────

/**
 * Box-Muller transform for normally distributed random numbers.
 * Returns a single N(0,1) sample.
 */
function gaussianRandom() {
  let u1 = 0;
  let u2 = 0;
  // Avoid log(0) by retrying u1 = 0
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

// ─── REGIME TRANSITION ───────────────────────────────────────────────────────

/**
 * Samples the next regime from the Markov transition matrix.
 * @param {string} currentRegime
 * @returns {string}
 */
function sampleNextRegime(currentRegime) {
  const probs = TRANSITION_MATRIX[currentRegime];
  const roll = Math.random();
  let cumulative = 0;
  for (let regimeIndex = 0; regimeIndex < REGIMES.length; regimeIndex++) {
    cumulative += probs[regimeIndex];
    if (roll <= cumulative) {
      return REGIMES[regimeIndex];
    }
  }
  // Fallback: return current (floating point edge case)
  return currentRegime;
}

// ─── CANDLE GENERATOR ────────────────────────────────────────────────────────

/**
 * Generates the next OHLCV candle using geometric Brownian motion.
 * @param {number} prevClose - Previous closing price
 * @param {string} regime - Current market regime
 * @param {number} baseVolume - Baseline volume for the instrument
 * @returns {{ candle: object, newClose: number }}
 */
function generateCandle(prevClose, regime, baseVolume) {
  const { drift, volatility, volumeMult } = REGIME_PARAMS[regime];

  // GBM price return: r = drift + volatility * Z where Z ~ N(0,1)
  const returnRate = drift + volatility * gaussianRandom();
  const closePrice = prevClose * Math.exp(returnRate);

  // Intrabar range: proportional to volatility
  const rangeFraction = Math.abs(gaussianRandom()) * volatility * 2;
  const rangeHigh = Math.max(prevClose, closePrice) * (1 + rangeFraction);
  const rangeLow  = Math.min(prevClose, closePrice) * (1 - rangeFraction);

  // Volume: log-normal distribution around baseline
  const volumeNoise = Math.exp(gaussianRandom() * 0.3);
  const volume = Math.round(baseVolume * volumeMult * volumeNoise);

  const candle = {
    timestamp: Date.now(),
    open:   parseFloat(prevClose.toFixed(2)),
    high:   parseFloat(rangeHigh.toFixed(2)),
    low:    parseFloat(rangeLow.toFixed(2)),
    close:  parseFloat(closePrice.toFixed(2)),
    volume,
  };

  return { candle, newClose: closePrice };
}

// ─── INSTRUMENT ENGINE ───────────────────────────────────────────────────────

/**
 * Creates a stateful simulation engine for a single instrument.
 * @param {string} symbol
 * @param {number} startPrice
 * @param {number} baseVolume
 * @returns {object} Engine with tick() method
 */
function createInstrumentEngine(symbol, startPrice, baseVolume) {
  let currentPrice = startPrice;
  let currentRegime = 'TRENDING_BULL';
  let candlesInRegime = 0;
  const MIN_REGIME_CANDLES = 15;
  const candles = [];

  return {
    symbol,

    tick() {
      // Attempt regime transition only after minimum dwell time
      candlesInRegime++;
      if (candlesInRegime >= MIN_REGIME_CANDLES) {
        const nextRegime = sampleNextRegime(currentRegime);
        if (nextRegime !== currentRegime) {
          currentRegime = nextRegime;
          candlesInRegime = 0;
        }
      }

      const { candle, newClose } = generateCandle(currentPrice, currentRegime, baseVolume);
      currentPrice = newClose;
      candles.push(candle);

      // Keep rolling window of 200 candles
      if (candles.length > 200) candles.shift();

      return {
        candle,
        regime: currentRegime,
        regimeConfidence: computeRegimeConfidence(candlesInRegime),
        candleHistory: candles.slice(),
      };
    },

    getCurrentPrice() {
      return currentPrice;
    },

    getCurrentRegime() {
      return currentRegime;
    },

    getCandleHistory() {
      return candles.slice();
    },
  };
}

/**
 * Regime confidence rises from 0.5 to 0.95 as the regime matures.
 * @param {number} candlesInRegime
 * @returns {number} 0–1
 */
function computeRegimeConfidence(candlesInRegime) {
  const MAX_CONFIDENCE_AT = 60;
  const raw = Math.min(candlesInRegime / MAX_CONFIDENCE_AT, 1);
  return parseFloat((0.5 + raw * 0.45).toFixed(3));
}

// ─── MARKET ENGINE FACTORY ───────────────────────────────────────────────────

/**
 * Creates a multi-instrument market simulation engine.
 * @returns {object}
 */
function createMarketEngine() {
  const instrumentConfigs = [
    { symbol: 'BTC/USD',  startPrice: 67_400,  baseVolume: 850 },
    { symbol: 'ETH/USD',  startPrice: 3_210,   baseVolume: 5_200 },
    { symbol: 'SPX/USD',  startPrice: 5_480,   baseVolume: 12_000 },
    { symbol: 'GOLD/USD', startPrice: 2_345,   baseVolume: 3_400 },
    { symbol: 'EUR/USD',  startPrice: 1.0854,  baseVolume: 25_000 },
  ];

  const engines = {};
  for (const config of instrumentConfigs) {
    engines[config.symbol] = createInstrumentEngine(
      config.symbol,
      config.startPrice,
      config.baseVolume,
    );
  }

  return {
    instruments: Object.keys(engines),

    tick() {
      const results = {};
      for (const symbol of Object.keys(engines)) {
        results[symbol] = engines[symbol].tick();
      }
      return results;
    },

    getEngine(symbol) {
      const engine = engines[symbol];
      if (!engine) throw new Error(`Unknown instrument: ${symbol}`);
      return engine;
    },
  };
}

// Export for both module and browser contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createMarketEngine, createInstrumentEngine, generateCandle, sampleNextRegime };
}
