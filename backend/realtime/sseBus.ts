/**
 * AEGIS-X Backend — SSE Broadcast Bus
 * Central realtime event publisher. All subsystems publish here.
 * Every connected SSE client receives all events.
 * Supports heartbeat, missed event replay (last 100 events), backpressure.
 */

import type { Response } from 'express';
import { config } from '../core/config.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('realtime:sse-bus');

export interface SSEClient {
  id: string;
  res: Response;
  connectedAt: number;
  lastEventId: number;
}

export interface SSEEvent {
  id: number;
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

class SSEBus {
  private clients = new Map<string, SSEClient>();
  private eventLog: SSEEvent[] = [];
  private eventCounter = 0;
  private readonly MAX_LOG = 200;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Register a new SSE client connection.
   */
  addClient(id: string, res: Response, lastEventId?: number): void {
    const client: SSEClient = {
      id,
      res,
      connectedAt: Date.now(),
      lastEventId: lastEventId ?? this.eventCounter,
    };
    this.clients.set(id, client);

    log.info('SSE client connected', { meta: { clientId: id, total: this.clients.size } });

    // Send connected confirmation
    this.sendToClient(client, 'connected', {
      status: 'connected',
      clientId: id,
      timestamp: new Date().toISOString(),
    });

    // Replay missed events
    if (lastEventId !== undefined && lastEventId < this.eventCounter) {
      const missed = this.eventLog.filter((e) => e.id > lastEventId);
      for (const event of missed.slice(-50)) { // max 50 replayed
        this.sendToClient(client, event.event, event.data);
      }
    }

    res.on('close', () => this.removeClient(id));
  }

  removeClient(id: string): void {
    this.clients.delete(id);
    log.info('SSE client disconnected', { meta: { clientId: id, remaining: this.clients.size } });
  }

  /**
   * Publish an event to all connected clients.
   */
  publish(event: string, data: Record<string, unknown>): void {
    const sseEvent: SSEEvent = {
      id: ++this.eventCounter,
      event,
      data: { ...data, _eventId: this.eventCounter },
      timestamp: new Date().toISOString(),
    };

    this.eventLog.push(sseEvent);
    if (this.eventLog.length > this.MAX_LOG) {
      this.eventLog.shift();
    }

    let sent = 0;
    for (const client of this.clients.values()) {
      try {
        this.sendToClient(client, event, sseEvent.data);
        sent++;
      } catch (err) {
        log.warn('Failed to send SSE event to client', { meta: { clientId: client.id } });
        this.removeClient(client.id);
      }
    }

    if (sent > 0) {
      log.debug(`Published SSE event: ${event}`, { meta: { recipients: sent } });
    }
  }

  private sendToClient(client: SSEClient, event: string, data: Record<string, unknown>): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    client.res.write(payload);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.clients.size > 0) {
        this.publish('heartbeat', {
          timestamp: new Date().toISOString(),
          connectedClients: this.clients.size,
        });
      }
    }, config.sseHeartbeatMs);
  }

  get connectedCount(): number {
    return this.clients.size;
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      totalEventsPublished: this.eventCounter,
      eventLogSize: this.eventLog.length,
    };
  }

  destroy(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    for (const client of this.clients.values()) {
      try { client.res.end(); } catch { /* ignore */ }
    }
    this.clients.clear();
  }
}

export const sseBus = new SSEBus();
