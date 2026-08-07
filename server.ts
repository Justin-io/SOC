import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google GenAI on the server
let aiClient: GoogleGenAI | null = null;
function getGenAIClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }
  return aiClient;
}

// REST API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    cpuUsagePercent: Number((Math.random() * 10 + 12).toFixed(1)),
    realtimeConnected: true,
  });
});

// SSE Endpoint for Live Incident Stream & Telemetry
app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('connected', { status: 'connected', timestamp: new Date().toISOString() });

  const interval = setInterval(() => {
    // Periodically send synthetic heartbeat and telemetry update
    const randomEvent = Math.random();
    if (randomEvent > 0.6) {
      sendEvent('telemetry', {
        type: 'HEARTBEAT',
        cpuUsage: Number((Math.random() * 15 + 15).toFixed(1)),
        memoryUsage: Number((Math.random() * 5 + 40).toFixed(1)),
        latencyMs: Math.floor(Math.random() * 40 + 80),
        activeAgentsCount: 10,
        timestamp: new Date().toISOString(),
      });
    } else if (randomEvent < 0.2) {
      // Push live event
      const assets = ['SRV-PROD-AUTH', 'K8S-INGRESS-01', 'AWS-S3-FINANCE', 'WRK-SEC-04', 'DB-CLUSTER-MASTER'];
      const techniques = [
        { id: 'T1059.001', name: 'PowerShell Execution' },
        { id: 'T1078.004', name: 'Cloud Accounts Compromise' },
        { id: 'T1555', name: 'Credentials from Password Stores' },
        { id: 'T1498', name: 'Network Denial of Service' },
      ];
      const selectedAsset = assets[Math.floor(Math.random() * assets.length)];
      const selectedTech = techniques[Math.floor(Math.random() * techniques.length)];
      
      sendEvent('live_event', {
        id: `EVT-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        asset: selectedAsset,
        technique: selectedTech,
        severity: Math.random() > 0.7 ? 'HIGH' : 'MEDIUM',
        confidence: Math.floor(Math.random() * 20 + 80),
        source: 'AEGIS-X Realtime Telemetry Bus',
      });
    }
  }, 4000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// AI Investigation Endpoint via Gemini API
app.post('/api/investigate/ai', async (req, res) => {
  try {
    const { incidentTitle, incidentDescription, mitreTechnique, rawEvidence } = req.body;
    const ai = getGenAIClient();

    if (!ai) {
      return res.json({
        success: false,
        fallback: true,
        analysis: 'Gemini API key not configured on server. Displaying deterministic heuristic assessment.',
        counterfactual: 'Without API Key authorization, counterfactual estimation relies on rule-based priors.',
        mitigationPlan: '1. Isolate target asset.\n2. Revoke active IAM & Kerberos sessions.\n3. Conduct memory forensic sweep.',
      });
    }

    const prompt = `
You are the AEGIS-X Chief Autonomous Security Intelligence Engine.
Analyze the following security incident in depth:

Title: ${incidentTitle || 'Unknown Security Event'}
Description: ${incidentDescription || 'No description provided'}
MITRE Technique: ${mitreTechnique || 'N/A'}
Raw Evidence Context: ${rawEvidence || 'N/A'}

Provide a structured operational analysis containing:
1. Threat Vector & Attacker Intent Analysis
2. Counterfactual Reasoning (What evidence, if absent, would lower the risk score?)
3. Immediate 3-step Containment & Remediation Directive
4. Estimated Business & Compliance Risk Level

Keep the answer concise, professional, bulleted, and in standard SOC operational format.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    const outputText = response.text || 'Analysis completed with default parameters.';

    return res.json({
      success: true,
      analysis: outputText,
      timestamp: new Date().toISOString(),
      modelUsed: 'gemini-3.6-flash',
    });
  } catch (error: unknown) {
    console.error('Error in /api/investigate/ai:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal AI investigation error',
    });
  }
});

// AI Report Generation Endpoint
app.post('/api/reports/generate', async (req, res) => {
  try {
    const { title, category, focusArea } = req.body;
    const ai = getGenAIClient();

    let reportSummary = '';
    if (ai) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `Generate an executive SOC summary report titled "${title}" focusing on category "${category}" and specific area "${focusArea}". Include key metrics, MITRE ATT&CK coverage, incident response SLA compliance, and strategic recommendations for executive leadership. Keep under 300 words.`,
      });
      reportSummary = response.text || 'Report generated successfully.';
    } else {
      reportSummary = `Executive summary for ${title}: All high-priority incidents in ${focusArea} were triaged within SLA bounds. Mean Time to Contain (MTTC) was 3.4 minutes. MITRE ATT&CK coverage stands at 94.2%.`;
    }

    return res.json({
      success: true,
      report: {
        id: `RPT-${Date.now()}`,
        title: title || 'AEGIS-X Automated Briefing',
        category: category || 'EXECUTIVE',
        generatedAt: new Date().toISOString(),
        author: 'AEGIS-X AI Engine (Server)',
        status: 'READY',
        summary: reportSummary,
        fileSizeMb: Number((Math.random() * 3 + 1.5).toFixed(1)),
        mitreCoveragePercent: 95.4,
      },
    });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Report generation failed',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AEGIS-X Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
