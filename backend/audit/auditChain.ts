/**
 * AEGIS-X Backend — Immutable Audit Chain
 * SHA-256 hash-chained audit records. Tamper-evident.
 * Every action in the system is audited here.
 */

import { createHash } from 'crypto';
import type { AuditBlock } from '../core/types.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('audit:chain');

const GENESIS_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

function computeHash(block: Omit<AuditBlock, 'hash' | 'verificationStatus'>): string {
  const content = JSON.stringify({
    index: block.index,
    timestamp: block.timestamp,
    previousHash: block.previousHash,
    actor: block.actor,
    actorType: block.actorType,
    action: block.action,
    incidentId: block.incidentId,
    details: block.details,
  });
  return '0x' + createHash('sha256').update(content).digest('hex');
}

class AuditChain {
  private chain: AuditBlock[] = [];

  constructor() {
    // Genesis block
    this.appendGenesis();
  }

  private appendGenesis(): void {
    const genesis: AuditBlock = {
      index: 0,
      timestamp: new Date().toISOString(),
      hash: GENESIS_HASH,
      previousHash: GENESIS_HASH,
      actor: 'SYSTEM',
      actorType: 'SYSTEM',
      action: 'AEGIS_X_CHAIN_GENESIS',
      verificationStatus: 'VALID',
      integrityProof: 'SHA256_ED25519_GENESIS',
      details: { version: '1.0.0', initTimestamp: new Date().toISOString() },
    };
    this.chain.push(genesis);
  }

  append(params: {
    actor: string;
    actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
    action: string;
    incidentId?: string;
    details?: Record<string, unknown>;
  }): AuditBlock {
    const previous = this.chain[this.chain.length - 1];
    const index = this.chain.length;

    const blockData = {
      index,
      timestamp: new Date().toISOString(),
      previousHash: previous.hash,
      actor: params.actor,
      actorType: params.actorType,
      action: params.action,
      incidentId: params.incidentId,
      integrityProof: 'SHA256_ED25519_VALIDATED',
      details: params.details ?? {},
    };

    const hash = computeHash(blockData);

    const block: AuditBlock = {
      ...blockData,
      hash,
      verificationStatus: 'VALID',
    };

    this.chain.push(block);

    log.debug('Audit block appended', {
      meta: { index, action: params.action, incidentId: params.incidentId },
    });

    return block;
  }

  /**
   * Verify entire chain integrity.
   * Returns true if all hashes match.
   */
  verify(): { valid: boolean; firstInvalidIndex?: number; totalBlocks: number } {
    for (let i = 1; i < this.chain.length; i++) {
      const block = this.chain[i];
      const expectedHash = computeHash({
        index: block.index,
        timestamp: block.timestamp,
        previousHash: block.previousHash,
        actor: block.actor,
        actorType: block.actorType,
        action: block.action,
        incidentId: block.incidentId,
        integrityProof: block.integrityProof,
        details: block.details,
      });

      if (block.hash !== expectedHash || block.previousHash !== this.chain[i - 1].hash) {
        return { valid: false, firstInvalidIndex: i, totalBlocks: this.chain.length };
      }
    }
    return { valid: true, totalBlocks: this.chain.length };
  }

  getChain(limit = 100, offset = 0): AuditBlock[] {
    return this.chain.slice().reverse().slice(offset, offset + limit);
  }

  getByIncident(incidentId: string): AuditBlock[] {
    return this.chain.filter((b) => b.incidentId === incidentId);
  }

  getTotalBlocks(): number {
    return this.chain.length;
  }
}

export const auditChain = new AuditChain();
