import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const BenchmarkView: React.FC = () => {
  const [report, setReport] = useState<any | null>(null);
  const [running, setRunning] = useState(false);

  const load = () => apiClient.fetchBenchmark().then(setReport);
  useEffect(() => { load(); }, []);
  const run = async () => {
    setRunning(true);
    try { setReport(await apiClient.runBenchmark()); } finally { setRunning(false); }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Benchmark</h1><p className="text-xs text-[#737373] font-mono">200 labelled incidents: 120 benign / 80 multi-stage attacks</p></div>
        <Button onClick={run} disabled={running}>{running ? 'Running all 200…' : 'Run benchmark'}</Button>
      </div>
      {!report ? <Card className="p-6 text-sm text-[#737373]">No benchmark report yet. Run the full labelled suite to collect measured results.</Card> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[#737373]">PRECISION</div><div className="text-2xl font-mono">{report.precision}</div></Card>
            <Card className="p-4"><div className="text-xs text-[#737373]">RECALL</div><div className="text-2xl font-mono">{report.recall}</div></Card>
            <Card className="p-4"><div className="text-xs text-[#737373]">P50 LATENCY</div><div className="text-2xl font-mono">{report.p50LatencyMs}ms</div></Card>
            <Card className="p-4"><div className="text-xs text-[#737373]">P95 LATENCY</div><div className="text-2xl font-mono">{report.p95LatencyMs}ms</div></Card>
          </div>
          <Card className="p-5"><h2 className="font-semibold mb-2">Measured tier latency</h2><pre className="text-xs overflow-auto">{JSON.stringify(report.tierLatencyMs, null, 2)}</pre></Card>
          <Card className="p-5"><h2 className="font-semibold mb-2">MITRE distribution</h2><pre className="text-xs overflow-auto">{JSON.stringify(report.mitreDistribution, null, 2)}</pre></Card>
        </>
      )}
    </div>
  );
};
