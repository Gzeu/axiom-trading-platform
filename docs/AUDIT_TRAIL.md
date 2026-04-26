# Blockchain Audit Trail — AXIOM Trading Platform

## Overview

Every AI-driven trade decision is recorded in an append-only hash chain. Each block is cryptographically linked to its predecessor, making tampering detectable.

## Block Schema

```typescript
interface AuditBlock {
  index: number;              // Sequential block number
  timestamp: number;          // Unix timestamp (ms)
  signal_id: string;          // Reference to TradeSignal
  instrument: string;         // Trading instrument
  action: TradeAction;        // LONG_ENTRY | SHORT_ENTRY | CLOSE_LONG | CLOSE_SHORT | HOLD
  confidence: number;         // 0–1 ML confidence score
  regime: MarketRegime;       // Active regime at decision time
  model_version: string;      // ML model version that generated the signal
  executor: string;           // Execution engine identifier
  prev_hash: string;          // SHA-256 of previous block
  hash: string;               // SHA-256 of this block's content
}
```

## Hash Computation

```
hash = SHA-256(
  index +
  timestamp +
  signal_id +
  instrument +
  action +
  confidence +
  regime +
  model_version +
  prev_hash
)
```

Genesis block uses `prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"`

## Chain Integrity Verification

The dashboard runs integrity verification on every new block insertion:
1. Recompute `hash` from block content
2. Verify `hash === block.hash`
3. Verify `block.prev_hash === chain[block.index - 1].hash`
4. If either check fails → emit `CHAIN_INTEGRITY_VIOLATION` event → alert UI

## Compliance Properties

- **Immutability:** Hash linkage makes retroactive modification detectable
- **Non-repudiation:** Every decision is signed with model version + executor ID
- **Auditability:** Full decision rationale stored in signal record linked by signal_id
- **Completeness:** Every signal emission triggers an audit block — no AI decision goes unlogged
