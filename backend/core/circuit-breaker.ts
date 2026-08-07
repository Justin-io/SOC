/**
 * AEGIS-X Backend — Circuit Breaker
 * Token-bucket circuit breaker for external API calls.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 */

import { CircuitOpenError } from './errors.js';
import { getLogger } from './logger.js';

const log = getLogger('circuit-breaker');

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;    // failures before opening
  successThreshold: number;    // successes in half-open before closing
  timeoutMs: number;           // how long to stay open before half-open
  callTimeoutMs?: number;      // per-call timeout
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureAt: number;
  totalCalls: number;
  totalFailures: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private stats: CircuitStats = {
    failures: 0,
    successes: 0,
    lastFailureAt: 0,
    totalCalls: 0,
    totalFailures: 0,
  };

  constructor(private readonly options: CircuitBreakerOptions) {}

  get name(): string { return this.options.name; }
  get currentState(): CircuitState { return this.state; }
  get isOpen(): boolean { return this.state === 'OPEN'; }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkState();

    this.stats.totalCalls++;

    try {
      let result: T;
      if (this.options.callTimeoutMs) {
        result = await this.withTimeout(fn, this.options.callTimeoutMs);
      } else {
        result = await fn();
      }

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private checkState(): void {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.stats.lastFailureAt;
      if (elapsed >= this.options.timeoutMs) {
        this.state = 'HALF_OPEN';
        log.info(`Circuit half-open: ${this.options.name}`);
      } else {
        throw new CircuitOpenError(this.options.name);
      }
    }
  }

  private onSuccess(): void {
    this.stats.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.stats.successes++;
      if (this.stats.successes >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.stats.successes = 0;
        log.info(`Circuit closed: ${this.options.name}`);
      }
    }
  }

  private onFailure(error: unknown): void {
    this.stats.failures++;
    this.stats.totalFailures++;
    this.stats.lastFailureAt = Date.now();
    this.stats.successes = 0;

    if (this.stats.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      log.warn(`Circuit opened: ${this.options.name}`, {
        meta: {
          failures: this.stats.failures,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.stats.lastFailureAt = Date.now();
    }
  }

  private withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Call timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fn().then(
        (result) => { clearTimeout(timer); resolve(result); },
        (err)    => { clearTimeout(timer); reject(err); }
      );
    });
  }

  getStats(): { state: CircuitState; failures: number; totalCalls: number; totalFailures: number } {
    return {
      state: this.state,
      failures: this.stats.failures,
      totalCalls: this.stats.totalCalls,
      totalFailures: this.stats.totalFailures,
    };
  }
}

// Pre-built circuit breakers for external providers
export const circuitBreakers = {
  virusTotal: new CircuitBreaker({
    name: 'VirusTotal',
    failureThreshold: 3,
    successThreshold: 2,
    timeoutMs: 30_000,
    callTimeoutMs: 5_000,
  }),
  abuseIPDB: new CircuitBreaker({
    name: 'AbuseIPDB',
    failureThreshold: 3,
    successThreshold: 2,
    timeoutMs: 30_000,
    callTimeoutMs: 5_000,
  }),
  shodan: new CircuitBreaker({
    name: 'Shodan',
    failureThreshold: 3,
    successThreshold: 2,
    timeoutMs: 30_000,
    callTimeoutMs: 5_000,
  }),
  gemini: new CircuitBreaker({
    name: 'Gemini',
    failureThreshold: 5,
    successThreshold: 2,
    timeoutMs: 60_000,
    callTimeoutMs: 15_000,
  }),
};
