export type MarketRegime = 'Trending' | 'Mean-Reverting' | 'Volatile' | 'Consolidating';

export interface RegimeDetectionResult {
  readonly regime: MarketRegime;
  readonly confidence: number;
  readonly transitionProbabilities: Readonly<Record<MarketRegime, number>>;
}

const TRANSITION_MATRIX: Readonly<Record<MarketRegime, Readonly<Record<MarketRegime, number>>>> = {
  'Trending': {
    'Trending': 0.78,
    'Mean-Reverting': 0.08,
    'Volatile': 0.09,
    'Consolidating': 0.05,
  },
  'Mean-Reverting': {
    'Trending': 0.14,
    'Mean-Reverting': 0.66,
    'Volatile': 0.08,
    'Consolidating': 0.12,
  },
  'Volatile': {
    'Trending': 0.12,
    'Mean-Reverting': 0.1,
    'Volatile': 0.68,
    'Consolidating': 0.1,
  },
  'Consolidating': {
    'Trending': 0.11,
    'Mean-Reverting': 0.19,
    'Volatile': 0.08,
    'Consolidating': 0.62,
  },
} as const;

function normalizeProbabilities(values: Record<MarketRegime, number>): Readonly<Record<MarketRegime, number>> {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return {
      'Trending': 0.25,
      'Mean-Reverting': 0.25,
      'Volatile': 0.25,
      'Consolidating': 0.25,
    };
  }

  return {
    'Trending': values['Trending'] / total,
    'Mean-Reverting': values['Mean-Reverting'] / total,
    'Volatile': values['Volatile'] / total,
    'Consolidating': values['Consolidating'] / total,
  };
}

export function detectNextRegime(currentRegime: MarketRegime): RegimeDetectionResult {
  const transitionRow = TRANSITION_MATRIX[currentRegime];
  const jittered: Record<MarketRegime, number> = {
    'Trending': Math.max(0.01, transitionRow['Trending'] + (Math.random() - 0.5) * 0.04),
    'Mean-Reverting': Math.max(0.01, transitionRow['Mean-Reverting'] + (Math.random() - 0.5) * 0.04),
    'Volatile': Math.max(0.01, transitionRow['Volatile'] + (Math.random() - 0.5) * 0.04),
    'Consolidating': Math.max(0.01, transitionRow['Consolidating'] + (Math.random() - 0.5) * 0.04),
  };

  const normalized = normalizeProbabilities(jittered);
  const roll = Math.random();
  let cumulative = 0;
  let nextRegime: MarketRegime = 'Trending';

  for (const regime of ['Trending', 'Mean-Reverting', 'Volatile', 'Consolidating'] as const) {
    cumulative += normalized[regime];
    if (roll <= cumulative) {
      nextRegime = regime;
      break;
    }
  }

  return {
    regime: nextRegime,
    confidence: Number(normalized[nextRegime].toFixed(2)),
    transitionProbabilities: normalized,
  };
}
