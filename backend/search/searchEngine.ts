/**
 * AEGIS-X Backend — Global Search Engine
 * In-memory full-text search across incidents, agents, IOCs, reports, MITRE.
 */

import type { SearchResult, Incident, AgentMetrics, IOCItem, SOCReport } from '../core/types.js';

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+|[^a-z0-9.]/).filter(Boolean);
}

function scoreMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 70;

  // Fuzzy token match
  const queryTokens = tokenize(q);
  const textTokens = tokenize(t);
  let matched = 0;
  for (const qt of queryTokens) {
    if (textTokens.some((tt) => tt.includes(qt) || qt.includes(tt))) matched++;
  }

  return queryTokens.length > 0 ? Math.round((matched / queryTokens.length) * 50) : 0;
}

export class SearchEngine {
  search(
    query: string,
    options: {
      incidents?: Incident[];
      agents?: AgentMetrics[];
      iocs?: IOCItem[];
      reports?: SOCReport[];
    }
  ): SearchResult[] {
    if (!query || query.trim().length < 2) return [];

    const results: SearchResult[] = [];

    // Search incidents
    for (const inc of options.incidents ?? []) {
      const score = Math.max(
        scoreMatch(query, inc.id),
        scoreMatch(query, inc.title),
        scoreMatch(query, inc.asset.hostname),
        scoreMatch(query, inc.mitreTechnique.id),
        scoreMatch(query, inc.mitreTechnique.name),
        scoreMatch(query, inc.source)
      );
      if (score > 20) {
        results.push({
          type: 'incident',
          id: inc.id,
          title: inc.title,
          subtitle: `${inc.asset.hostname} | ${inc.mitreTechnique.id}`,
          severity: inc.severity,
          score,
        });
      }
    }

    // Search agents
    for (const agent of options.agents ?? []) {
      const score = Math.max(
        scoreMatch(query, agent.role),
        scoreMatch(query, agent.name),
        scoreMatch(query, agent.model),
        scoreMatch(query, agent.description)
      );
      if (score > 20) {
        results.push({
          type: 'agent',
          id: agent.role,
          title: agent.name,
          subtitle: `${agent.role} | ${agent.model}`,
          score,
        });
      }
    }

    // Search IOCs
    for (const ioc of options.iocs ?? []) {
      const score = Math.max(
        scoreMatch(query, ioc.value),
        scoreMatch(query, ioc.type),
        scoreMatch(query, ioc.threatFamily ?? ''),
        scoreMatch(query, ioc.reputation)
      );
      if (score > 20) {
        results.push({
          type: 'ioc',
          id: ioc.value,
          title: ioc.value,
          subtitle: `${ioc.type} | ${ioc.reputation} | ${ioc.confidence}%`,
          score,
        });
      }
    }

    // Search reports
    for (const report of options.reports ?? []) {
      const score = Math.max(
        scoreMatch(query, report.id),
        scoreMatch(query, report.title),
        scoreMatch(query, report.category),
        scoreMatch(query, report.summary)
      );
      if (score > 20) {
        results.push({
          type: 'report',
          id: report.id,
          title: report.title,
          subtitle: `${report.category} | ${report.generatedAt.slice(0, 10)}`,
          score,
        });
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  }
}

export const searchEngine = new SearchEngine();
