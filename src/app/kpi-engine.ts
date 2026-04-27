export interface KPISnapshot {
  readonly totalPnL: number;
  readonly pnLPercent: number;
  readonly winRate: number;
  readonly sharpeRatio: number;
  readonly maxDrawdown: number;
  readonly openPositions: number;
  readonly unrealisedPnL: number;
  readonly signalsToday: number;
  readonly equityCurve: readonly number[];
}

const BASE_EQUITY = 100000;

export function createInitialKPISnapshot(): KPISnapshot {
  return {
    totalPnL: 0,
    pnLPercent: 0,
    winRate: 58.4,
    sharpeRatio: 1.82,
    maxDrawdown: -4.2,
    openPositions: 3,
    unrealisedPnL: 0,
    signalsToday: 0,
    equityCurve: [BASE_EQUITY],
  };
}

export function tickKPISnapshot(previous: KPISnapshot): KPISnapshot {
  const realizedDelta = (Math.random() - 0.47) * 280;
  const unrealizedPnL = (Math.random() - 0.5) * 2200;
  const totalPnL = previous.totalPnL + realizedDelta;
  const nextEquityPoint = BASE_EQUITY + totalPnL + unrealizedPnL;
  const equityCurve = [...previous.equityCurve, nextEquityPoint].slice(-80);
  const rollingPeak = Math.max(...equityCurve);
  const trough = equityCurve[equityCurve.length - 1] ?? BASE_EQUITY;
  const drawdownPct = rollingPeak === 0 ? 0 : ((trough - rollingPeak) / rollingPeak) * 100;

  return {
    totalPnL: Number(totalPnL.toFixed(2)),
    pnLPercent: Number(((totalPnL / BASE_EQUITY) * 100).toFixed(2)),
    winRate: Number((48 + Math.random() * 24).toFixed(1)),
    sharpeRatio: Number((0.8 + Math.random() * 2.4).toFixed(2)),
    maxDrawdown: Number(drawdownPct.toFixed(2)),
    openPositions: Math.max(0, Math.floor(1 + Math.random() * 8)),
    unrealisedPnL: Number(unrealizedPnL.toFixed(2)),
    signalsToday: previous.signalsToday,
    equityCurve,
  };
}

export function incrementSignalCount(snapshot: KPISnapshot): KPISnapshot {
  return {
    ...snapshot,
    signalsToday: snapshot.signalsToday + 1,
  };
}
