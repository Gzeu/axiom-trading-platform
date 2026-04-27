/**
 * AXIOM Platform — Orderbook Simulator
 *
 * Builds a synthetic L2 order book snapshot for a given instrument.
 * Types imported from the canonical trading.ts — no local redefinitions.
 */

import type {
  DepthLevel,
  OrderBookSnapshot,
  InstrumentSymbol,
} from '../types/trading.js';

const DEPTH_LEVELS = 20;

/**
 * Builds a synthetic 20-level L2 order book for the given instrument.
 *
 * @param instrument - The instrument this book is for (stored in snapshot)
 * @param midPrice   - Current mid price (from live GBM feed)
 * @param decimals   - Price decimal precision for this instrument
 */
export function buildOrderBook(
  instrument: InstrumentSymbol,
  midPrice: number,
  decimals: number,
): OrderBookSnapshot {
  const spread    = Number((midPrice * 0.0003).toFixed(decimals));
  const bidLevels: DepthLevel[] = [];
  const askLevels: DepthLevel[] = [];
  let cumulativeBid = 0;
  let cumulativeAsk = 0;

  for (let levelIndex = 0; levelIndex < DEPTH_LEVELS; levelIndex++) {
    const bidPrice    = Number((midPrice - spread * (levelIndex + 1)).toFixed(decimals));
    const askPrice    = Number((midPrice + spread * (levelIndex + 1)).toFixed(decimals));
    const bidQuantity = Number((500 + Math.random() * 2_000).toFixed(2));
    const askQuantity = Number((500 + Math.random() * 2_000).toFixed(2));

    cumulativeBid += bidQuantity;
    cumulativeAsk += askQuantity;

    bidLevels.push(Object.freeze({
      price:      bidPrice,
      quantity:   bidQuantity,
      cumulative: Number(cumulativeBid.toFixed(2)),
    }));
    askLevels.push(Object.freeze({
      price:      askPrice,
      quantity:   askQuantity,
      cumulative: Number(cumulativeAsk.toFixed(2)),
    }));
  }

  return Object.freeze({
    instrument,
    timestamp:       Date.now(),
    midPrice:        Number(midPrice.toFixed(decimals)),
    spread,
    bids:            Object.freeze(bidLevels),
    asks:            Object.freeze(askLevels),
    bidTotalVolume:  Number(cumulativeBid.toFixed(2)),
    askTotalVolume:  Number(cumulativeAsk.toFixed(2)),
  });
}
