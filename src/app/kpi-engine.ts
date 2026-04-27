/**
 * AXIOM Platform — KPI Engine
 *
 * Pure functions that advance the KPI snapshot each market tick.
 * No local type redefinitions — all types imported from the canonical
 * trading.ts type system.
 *
 * equityCurve lives inside KPISnapshot (see trading.ts) so all
 * consumers read from one place without extra state coupling.
 */

import type { KPISnapshot } from '../types/trading.js';

const BASE_EQUITY = 100_000;
const MAX_EQUITY_CURVE_LENGTH = 80;

// ─── INITIAL STATE ────────────────────────────────────────────────────────────

export function createInitialKPISnapshot(): KPISnapshot {
  return Object.freeze({
    totalPnL:      0,
    pnLPercent:    0,
    winRate:       58.4,
    sharpeRatio:   1.82,
    maxDrawdown:   -4.2,
    openPositions: 3,
    unrealisedPnL: 0,
    signalsToday:  0,
    equityCurve:   Object.freeze([BASE_EQUITY]),
  });
}

// ─── TICK ─────────────────────────────────────────────────────────────────────

/**
 * Advances all KPI metrics by one simulation tick.
 * Returns a new frozen snapshot — never mutates the previous one.
 *
 * equityCurve is kept to MAX_EQUITY_CURVE_LENGTH points (ring-buffer semantics).
 * maxDrawdown is computed from the rolling equity curve peak.
 */
export function tickKPISnapshot(previous: KPISnapshot): KPISnapshot {
  const realisedDelta  = (Math.random() - 0.47) * 280;
  const unrealisedPnL  = (Math.random() - 0.5) * 2_200;
  const totalPnL       = previous.totalPnL + realisedDelta;
  const currentEquity  = BASE_EQUITY + totalPnL + unrealisedPnL;

  const nextCurve: number[] = [
    ...previous.equityCurve,
    currentEquity,
  ].slice(-MAX_EQUITY_CURVE_LENGTH);

  const rollingPeak    = Math.max(...nextCurve);
  const latestEquity   = nextCurve[nextCurve.length - 1] ?? BASE_EQUITY;
  const drawdownPct    = rollingPeak === 0
    ? 0
    : ((latestEquity - rollingPeak) / rollingPeak) * 100;

  return Object.freeze({
    totalPnL:      Number(totalPnL.toFixed(2)),
    pnLPercent:    Number(((totalPnL / BASE_EQUITY) * 100).toFixed(2)),
    winRate:       Number((48 + Math.random() * 24).toFixed(1)),
    sharpeRatio:   Number((0.8  + Math.random() * 2.4).toFixed(2)),
    maxDrawdown:   Number(drawdownPct.toFixed(2)),
    openPositions: Math.max(0, Math.floor(1 + Math.random() * 8)),
    unrealisedPnL: Number(unrealisedPnL.toFixed(2)),
    signalsToday:  previous.signalsToday,
    equityCurve:   Object.freeze(nextCurve),
  });
}

// ─── SIGNAL COUNTER ───────────────────────────────────────────────────────────

/**
 * Returns a new snapshot with signalsToday incremented by 1.
 * Called from store.pushSignal so the count stays in sync with the audit log.
 */
export function incrementSignalCount(snapshot: KPISnapshot): KPISnapshot {
  return Object.freeze({
    ...snapshot,
    signalsToday: snapshot.signalsToday + 1,
  });
}
