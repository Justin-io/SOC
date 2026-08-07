# AEGIS-X — Autonomous Security Operations Console

AEGIS-X is an autonomous AI-native Security Operations Center (SOC) platform designed for high-consequence cyber defense, real-time threat intelligence cascade, and Bayesian evidence fusion.

## Features

- **Multi-Tier Intelligence Cascade**: Deterministic fast-path (Tier 0), Statistical anomaly detection (Tier 1), and Gemini Flash reasoning (Tier 2).
- **10 Autonomous Specialist Agents**: Coordinator, Threat Intel, Malware, Cloud, Incident Response, Compliance, Edge, Deception, and Fusion Engine.
- **Bayesian Evidence Fusion**: Log-odds fusion with Wilson confidence intervals and dissent scoring.
- **Chronon & Digital Twin**: Lateral movement forecasting and zero-impact containment simulation.
- **Real-Time Simulation**: Ingest and simulate live threat telemetry on demand.
- **Immutable SHA-256 Audit Chain**: Cryptographic audit logging for full forensic transparency.

## Quick Start

### Prerequisites
- Node.js (v18+)

### Setup & Execution

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment file and configure your settings:
   ```bash
   cp .env.example .env
   ```

3. (Optional) Set your `GEMINI_API_KEY` in `.env` to enable Gemini AI reasoning:
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   PORT=3000
   ```

4. Start the application:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.
