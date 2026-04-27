/**
 * AXIOM Platform — Regime Detector
 *
 * Hidden Markov Model-inspired market regime detection.
 * MarketRegime imported from trading.ts — no local redefinition.
 */

import type { MarketRegime, RegimeState } from '../types/trading.js';

// ─── HMM TRANSITION MATRIX ───────────────────────────────────────────────────
// Row = current regime. Values = probability of transitioning to each state.
// Each row sums to 1.0.

const TRANSITION_MATRIX: Readonly<Record<MarketRegime, Readonly<Record<MarketRegime, number>>>> = {
  'Trending': {
    'Trending':       0.78,
    'Mean-Reverting': 0.08,
    'Volatile':       0.09,
    'Consolidating':  0.05,
  },
  'Mean-Reverting': {
    'Trending':       0.14,
    'Mean-Reverting': 0.66,
    'Volatile':       0.08,
    'Consolidating':  0.12,
  },
  'Volatile': {
    'Trending':       0.12,
    'Mean-Reverting': 0.10,
    'Volatile':       0.68,
    'Consolidating':  0.10,
  },
  'Consolidating': {
    'Trending':       0.11,
    'Mean-Reverting': 0.19,
    'Volatile':       0.08,
    'Consolidating':  0.62,
  },
} as const;

const ALL_REGIMES: readonly MarketRegime[] = [
  'Trending',
  'Mean-Reverting',
  'Volatile',
  'Consolidating',
] as const;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function normalizeProbabilities(
  values: Record<MarketRegime, number>,
): Readonly<Record<MarketRegime, number>> {
  const total = Object.values(values).reduce((sum, v) => sum + v, 0);
  if (total <= 0) {
    // Degenerate fallback — uniform distribution
    return Object.freeze({
      'Trending':       0.25,
      'Mean-Reverting': 0.25,
      'Volatile':       0.25,
      'Consolidating':  0.25,
    });
  }
  return Object.freeze({
    'Trending':       values['Trending']       / total,
    'Mean-Reverting': values['Mean-Reverting'] / total,
    'Volatile':       values['Volatile']       / total,
    'Consolidating':  values['Consolidating']  / total,
  });
}

// ─── REGIME TICK ─────────────────────────────────────────────────────────────

/**
 * Advances the regime by one tick using the HMM transition matrix.
 * Small Gaussian jitter is applied to probabilities before sampling
 * to simulate posterior uncertainty.
 *
 * Returns a full RegimeState (compatible with ApplicationState.regime).
 */
export function detectNextRegime(current: RegimeState): RegimeState {
  const transitionRow = TRANSITION_MATRIX[current.current];

  // Apply small jitter to simulate posterior uncertainty
  const jittered: Record<MarketRegime, number> = {
    'Trending':       Math.max(0.01, transitionRow['Trending']       + (Math.random() - 0.5) * 0.04),
    'Mean-Reverting': Math.max(0.01, transitionRow['Mean-Reverting'] + (Math.random() - 0.5) * 0.04),
    'Volatile':       Math.max(0.01, transitionRow['Volatile']       + (Math.random() - 0.5) * 0.04),
    'Consolidating':  Math.max(0.01, transitionRow['Consolidating']  + (Math.random() - 0.5) * 0.04),
  };

  const normalized   = normalizeProbabilities(jittered);
  const roll         = Math.random();
  let cumulative     = 0;
  let nextRegime: MarketRegime = 'Trending';

  for (const regime of ALL_REGIMES) {
    cumulative += normalized[regime];
    if (roll <= cumulative) {
      nextRegime = regime;
      break;
    }
  }

  const regimeChanged = nextRegime !== current.current;

  return Object.freeze({
    current:                 nextRegime,
    confidence:              Number(normalized[nextRegime].toFixed(2)),
    ticksInRegime:           regimeChanged ? 0 : current.ticksInRegime + 1,
    transitionProbabilities: normalized,
  });
}
