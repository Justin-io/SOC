/**
 * AEGIS-X Backend — Configuration Module
 * Env-validated configuration with typed defaults.
 */

export interface AegisConfig {
  port: number;
  nodeEnv: string;
  geminiApiKey: string | null;
  geminiModel: string;
  geminiModelFast: string;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  intelligence: {
    tier0TimeoutMs: number;
    tier1TimeoutMs: number;
    tier2TimeoutMs: number;
    tier3TimeoutMs: number;
    tier0ConfidenceThreshold: number;
    tier1ConfidenceThreshold: number;
  };
  iocCache: {
    ttlMs: number;
    maxEntries: number;
  };
  humanApproval: {
    timeoutMs: number;
  };
  sseHeartbeatMs: number;
  telemetryIntervalMs: number;
  liveEventIntervalMs: number;
  agentHeartbeatMs: number;
}

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (!value && fallback === undefined) {
    // Soft fail — log warning, don't crash
    console.warn(`[Config] Missing env var: ${key}`);
    return '';
  }
  return value ?? fallback ?? '';
}

function getEnvInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? fallback : parsed;
}

export const config: AegisConfig = {
  port: getEnvInt('PORT', 3000),
  nodeEnv: getEnv('NODE_ENV', 'development'),
  geminiApiKey: process.env.GEMINI_API_KEY ?? null,
  geminiModel: getEnv('GEMINI_MODEL', 'gemini-2.0-flash'),
  geminiModelFast: getEnv('GEMINI_MODEL_FAST', 'gemini-2.0-flash'),
  rateLimit: {
    windowMs: getEnvInt('RATE_LIMIT_WINDOW_MS', 60_000),
    maxRequests: getEnvInt('RATE_LIMIT_MAX', 120),
  },
  intelligence: {
    tier0TimeoutMs: 50,
    tier1TimeoutMs: 200,
    tier2TimeoutMs: 2_000,
    tier3TimeoutMs: 30_000,
    tier0ConfidenceThreshold: 95,
    tier1ConfidenceThreshold: 80,
  },
  iocCache: {
    ttlMs: getEnvInt('IOC_CACHE_TTL_MS', 3_600_000), // 1 hour
    maxEntries: getEnvInt('IOC_CACHE_MAX', 10_000),
  },
  humanApproval: {
    timeoutMs: getEnvInt('HUMAN_APPROVAL_TIMEOUT_MS', 300_000), // 5 min
  },
  sseHeartbeatMs: 15_000,
  telemetryIntervalMs: 4_000,
  liveEventIntervalMs: 8_000,
  agentHeartbeatMs: 5_000,
};

export function hasGeminiKey(): boolean {
  return Boolean(config.geminiApiKey && config.geminiApiKey.length > 10);
}

export function isDevelopment(): boolean {
  return config.nodeEnv !== 'production';
}
