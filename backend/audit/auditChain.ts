/**
 * AEGIS-X Backend — tamper-evident audit chain.
 * Prototype: logical hash chain persisted to JSONL. Production requires WORM storage + KMS signing.
 */

import { appendFileSync, existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import type { AuditBlock } from '../core/types.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('audit:chain');
const GENESIS_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
const MAX_IN_MEMORY_BLOCKS = 10_000;
const AUDIT_FILE = path.resolve(process.cwd(), 'audit-chain.jsonl');

function computeHash(block: Omit<AuditBlock, 'hash' | 'verificationStatus'>): string {
  return '0x' + createHash('sha256').update(JSON.stringify({
    index: block.index,
    timestamp: block.timestamp,
    previousHash: block.previousHash,
    actor: block.actor,
    actorType: block.actorType,
    action: block.action,
    incidentId: block.incidentId,
    details: block.details,
  })).digest('hex');
}

class AuditChain {
  private chain: AuditBlock[] = [];
  private nextIndex = 0;

  constructor() {
    this.load();
    if (this.chain.length === 0) this.appendGenesis();
  }

  private load(): void {
    if (!existsSync(AUDIT_FILE)) return;
    const blocks = readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as AuditBlock);
    this.chain = blocks.slice(-MAX_IN_MEMORY_BLOCKS);
    this.nextIndex = (blocks.at(-1)?.index ?? -1) + 1;
  }

  private persist(block: AuditBlock): void {
    appendFileSync(AUDIT_FILE, `${JSON.stringify(block)}\n`, { encoding: 'utf8', flag: 'a' });
  }

  private capMemory(): void {
    if (this.chain.length > MAX_IN_MEMORY_BLOCKS) this.chain.splice(0, this.chain.length - MAX_IN_MEMORY_BLOCKS);
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
      integrityProof: 'SHA256_GENESIS',
      details: { version: '1.0.0', initTimestamp: new Date().toISOString() },
    };
    this.chain.push(genesis);
    this.nextIndex = 1;
    this.persist(genesis);
  }

  append(params: { actor: string; actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM'; action: string; incidentId?: string; details?: Record<string, unknown> }): AuditBlock {
    const previous = this.chain.at(-1);
    if (!previous) throw new Error('Audit chain has no head');
    const expectedPreviousHash = previous.index === 0 && previous.action === 'AEGIS_X_CHAIN_GENESIS'
      ? GENESIS_HASH
      : computeHash({
        index: previous.index, timestamp: previous.timestamp, previousHash: previous.previousHash,
        actor: previous.actor, actorType: previous.actorType, action: previous.action,
        incidentId: previous.incidentId, integrityProof: previous.integrityProof, details: previous.details,
      });
    if (previous.hash !== expectedPreviousHash) {
      previous.verificationStatus = 'TAMPERED';
      throw new Error(`Audit chain tamper detected at head index ${previous.index}`);
    }

    const blockData = {
      index: this.nextIndex++,
      timestamp: new Date().toISOString(),
      previousHash: previous.hash,
      actor: params.actor,
      actorType: params.actorType,
      action: params.action,
      incidentId: params.incidentId,
      integrityProof: 'SHA256_LOGICAL_CHAIN',
      details: params.details ?? {},
    };
    const block: AuditBlock = { ...blockData, hash: computeHash(blockData), verificationStatus: 'VALID' };
    this.chain.push(block);
    this.capMemory();
    this.persist(block);
    log.debug('Audit block appended', { meta: { index: block.index, action: params.action, incidentId: params.incidentId } });
    return block;
  }

  verify(): { valid: boolean; firstInvalidIndex?: number; totalBlocks: number } {
    for (let index = 0; index < this.chain.length; index++) {
      const block = this.chain[index];
      if (block.index === 0 && block.action === 'AEGIS_X_CHAIN_GENESIS') {
        if (block.hash !== GENESIS_HASH) return { valid: false, firstInvalidIndex: block.index, totalBlocks: this.chain.length };
        continue;
      }
      const expected = computeHash({
        index: block.index, timestamp: block.timestamp, previousHash: block.previousHash,
        actor: block.actor, actorType: block.actorType, action: block.action,
        incidentId: block.incidentId, integrityProof: block.integrityProof, details: block.details,
      });
      const previous = index > 0 ? this.chain[index - 1] : undefined;
      if (block.hash !== expected || (previous && block.previousHash !== previous.hash)) {
        return { valid: false, firstInvalidIndex: block.index, totalBlocks: this.chain.length };
      }
    }
    return { valid: true, totalBlocks: this.chain.length };
  }

  getChain(limit = 100, offset = 0): AuditBlock[] { return this.chain.slice().reverse().slice(offset, offset + limit); }
  getByIncident(incidentId: string): AuditBlock[] { return this.chain.filter((block) => block.incidentId === incidentId); }
  getTotalBlocks(): number { return this.chain.length; }
}

export const auditChain = new AuditChain();
