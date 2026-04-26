/**
 * audit-engine.js — Blockchain-Verified Audit Trail
 *
 * Implements a SHA-256 hash chain. Every AI trade decision is recorded
 * as an append-only block. Tampering with any block invalidates all
 * subsequent blocks — detectable via chain integrity verification.
 *
 * SHA-256 is computed via the Web Crypto API (browser) or Node crypto module.
 */

'use strict';

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
const EXECUTOR_ID = 'AXIOM-EXEC-v1.0.0';

/**
 * Computes SHA-256 of a UTF-8 string.
 * Returns a hex string. Works in both browser (SubtleCrypto) and Node.js.
 * @param {string} message
 * @returns {Promise<string>}
 */
async function sha256(message) {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser: Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  } else if (typeof require !== 'undefined') {
    // Node.js: built-in crypto
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(message, 'utf8').digest('hex');
  }
  throw new Error('No cryptographic API available in this environment');
}

/**
 * Builds the canonical string to hash for a block.
 * Field ordering is fixed — changing it breaks chain compatibility.
 * @param {object} block (without hash field)
 * @returns {string}
 */
function buildBlockContent(block) {
  return [
    String(block.index),
    String(block.timestamp),
    block.signalId,
    block.instrument,
    block.action,
    block.confidence.toFixed(6),
    block.regime,
    block.modelVersion,
    block.executor,
    block.prevHash,
  ].join('|');
}

/**
 * Creates a blockchain audit engine.
 * @returns {object}
 */
function createAuditEngine() {
  const chain = [];
  let pendingIntegrityViolation = false;

  /**
   * Appends a new block for a trade signal.
   * @param {object} signal - TradeSignal object
   * @returns {Promise<object>} The new AuditBlock
   */
  async function appendBlock(signal) {
    const prevHash = chain.length > 0
      ? chain[chain.length - 1].hash
      : GENESIS_HASH;

    const blockWithoutHash = {
      index:        chain.length,
      timestamp:    Date.now(),
      signalId:     signal.signalId,
      instrument:   signal.instrument,
      action:       signal.action,
      confidence:   signal.confidence,
      regime:       signal.regime,
      modelVersion: signal.modelVersion,
      executor:     EXECUTOR_ID,
      prevHash,
    };

    const content = buildBlockContent(blockWithoutHash);
    const hash = await sha256(content);

    const block = { ...blockWithoutHash, hash };
    chain.push(block);
    return block;
  }

  /**
   * Verifies the integrity of the entire chain.
   * @returns {Promise<{ valid: boolean, violationIndex: number | null }>}
   */
  async function verifyChain() {
    for (let blockIndex = 0; blockIndex < chain.length; blockIndex++) {
      const block = chain[blockIndex];

      // Recompute hash
      const { hash: _omitted, ...blockWithoutHash } = block;
      const expectedHash = await sha256(buildBlockContent(blockWithoutHash));

      if (expectedHash !== block.hash) {
        pendingIntegrityViolation = true;
        return { valid: false, violationIndex: blockIndex };
      }

      // Verify chain linkage (skip genesis)
      if (blockIndex > 0) {
        const expectedPrevHash = chain[blockIndex - 1].hash;
        if (block.prevHash !== expectedPrevHash) {
          pendingIntegrityViolation = true;
          return { valid: false, violationIndex: blockIndex };
        }
      }
    }

    return { valid: true, violationIndex: null };
  }

  return {
    appendBlock,
    verifyChain,
    getChain() { return chain.slice(); },
    getLength() { return chain.length; },
    hasIntegrityViolation() { return pendingIntegrityViolation; },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createAuditEngine, sha256, buildBlockContent };
}
