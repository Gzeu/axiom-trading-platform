/**
 * AXIOM Platform — API Bridge Monitor
 *
 * Simulates low-latency WebSocket and HTTP connections to:
 * - Market data feed
 * - Execution engine
 * - ML inference API
 * - Audit chain node
 * - Risk engine
 *
 * Each endpoint's latency, status, and heartbeat are simulated
 * with realistic jitter, occasional degradation, and auto-recovery.
 */

import type {
  APIBridgeEndpoint,
  BridgeMetrics,
  BridgeStatus,
} from '../types/trading.js';

import {
  appState,
  updateBridgeEndpoint,
  updateBridgeMetrics,
} from './store.js';

// ─── LATENCY MODEL ────────────────────────────────────────────────────────────
// Models network jitter with log-normal distribution (realistic for TCP)

function simulateLatency(baseMs: number): number {
  const jitterFactor = 0.1 + Math.random() * 0.4;
  const jitter = baseMs * jitterFactor * (Math.random() > 0.5 ? 1 : -1);
  const latency = Math.max(1, baseMs + jitter);
  return Math.round(latency * 10) / 10;
}

function simulateP99Latency(avgMs: number): number {
  // p99 is typically 3–8x avg for real trading systems
  return Math.round(avgMs * (3 + Math.random() * 5));
}

// ─── STATUS TRANSITION MODEL ──────────────────────────────────────────────────
// Markov chain: connected → degraded (rare) → reconnecting → connected
// Ensures connected is the dominant state (~95% of the time)

function transitionStatus(current: BridgeStatus): BridgeStatus {
  const roll = Math.random();
  switch (current) {
    case 'connected':
      if (roll < 0.02) return 'degraded';      // 2% chance of degradation
      return 'connected';
    case 'degraded':
      if (roll < 0.3)  return 'reconnecting';  // 30% chance of escalating
      if (roll < 0.6)  return 'connected';     // 60% chance of self-healing
      return 'degraded';
    case 'reconnecting':
      if (roll < 0.7)  return 'connected';     // 70% chance of recovery
      return 'reconnecting';
    case 'disconnected':
      if (roll < 0.5)  return 'reconnecting';  // 50% chance of attempting reconnect
      return 'disconnected';
  }
}

function latencyForStatus(baseMs: number, status: BridgeStatus): number {
  switch (status) {
    case 'connected':     return simulateLatency(baseMs);
    case 'degraded':      return simulateLatency(baseMs * 4);  // 4x latency when degraded
    case 'reconnecting':  return simulateLatency(baseMs * 8);  // 8x latency when reconnecting
    case 'disconnected':  return 0;
  }
}

// ─── BRIDGE TICK ─────────────────────────────────────────────────────────────

/**
 * Advances each endpoint's simulated state by one tick.
 * Called on the same interval as the main market data tick.
 */
export function tickBridge(): void {
  let totalLatency = 0;
  let connectedCount = 0;
  let totalMessages = appState.bridge.metrics.totalMessagesIn;
  let droppedMessages = appState.bridge.metrics.droppedMessages;

  for (const endpoint of appState.bridge.endpoints) {
    const nextStatus = transitionStatus(endpoint.status);
    const nextLatency = latencyForStatus(
      // Recover base latency from threshold (threshold = ~3x base)
      Math.round(endpoint.maxLatencyThresholdMs / 3),
      nextStatus,
    );
    const errorIncrement =
      nextStatus === 'degraded' ? 1 :
      nextStatus === 'reconnecting' ? 3 :
      nextStatus === 'disconnected' ? 5 : 0;

    updateBridgeEndpoint(endpoint.name, {
      status: nextStatus,
      latencyMs: nextLatency,
      lastHeartbeat: nextStatus === 'connected' || nextStatus === 'degraded'
        ? Date.now()
        : endpoint.lastHeartbeat,
      errorCount: endpoint.errorCount + errorIncrement,
    });

    if (nextStatus === 'connected') {
      totalLatency += nextLatency;
      connectedCount++;
      totalMessages += Math.floor(10 + Math.random() * 90);
    } else if (nextStatus === 'disconnected' || nextStatus === 'reconnecting') {
      droppedMessages += Math.floor(Math.random() * 5);
    }
  }

  const avgLatency = connectedCount > 0 ? totalLatency / connectedCount : 0;

  updateBridgeMetrics({
    totalMessagesIn:  totalMessages,
    totalMessagesOut: Math.floor(totalMessages * 0.3), // ~30% of in-bound triggers out-bound orders
    avgLatencyMs:     Math.round(avgLatency * 10) / 10,
    p99LatencyMs:     simulateP99Latency(avgLatency),
    droppedMessages,
    uptimeSeconds:    appState.bridge.metrics.uptimeSeconds + 1,
  });
}

// ─── STATUS DISPLAY HELPERS ───────────────────────────────────────────────────

export const BRIDGE_STATUS_COLOR: Readonly<Record<BridgeStatus, string>> = {
  connected:    '#22c55e',
  degraded:     '#ffb703',
  reconnecting: '#a78bfa',
  disconnected: '#ef4444',
} as const;

export const BRIDGE_STATUS_LABEL: Readonly<Record<BridgeStatus, string>> = {
  connected:    'Connected',
  degraded:     'Degraded',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
} as const;

/**
 * Returns overall system health as a 0–100 score.
 * Weights: connected=100, degraded=40, reconnecting=15, disconnected=0.
 */
export function computeBridgeHealthScore(): number {
  const weights: Readonly<Record<BridgeStatus, number>> = {
    connected:    100,
    degraded:     40,
    reconnecting: 15,
    disconnected: 0,
  };
  const endpoints = appState.bridge.endpoints;
  if (endpoints.length === 0) return 0;
  const totalScore = endpoints.reduce(
    (sum, ep) => sum + (weights[ep.status] ?? 0),
    0,
  );
  return Math.round(totalScore / endpoints.length);
}
