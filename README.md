# AEGIS-X — Autonomous Security Operations Console

AEGIS-X is an autonomous AI-native Security Operations Center (SOC) platform designed for high-consequence cyber defense, real-time threat intelligence cascade, and Bayesian evidence fusion.

## Features

- **Multi-Tier Intelligence Cascade**: Deterministic fast-path (Tier 0), Statistical anomaly detection (Tier 1), and Gemini Flash reasoning (Tier 2).
- **10 Autonomous Specialist Agents**: Coordinator, Threat Intel, Malware, Cloud, Incident Response, Compliance, Edge, Deception, and Fusion Engine.
- **Bayesian Evidence Fusion**: Log-odds fusion with Wilson confidence intervals and dissent scoring.
- **Chronon & Digital Twin**: Lateral movement forecasting and zero-impact containment emulation.
- **Real-Time Emulation**: Ingest and emulate live threat telemetry on demand.
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

## Administration

### Mathematical & Algorithmic Specification

This section details the real-time workflow methodology and the mathematical models applied within the AEGIS-X engine for threat intelligence fusion, digital twin emulation, and risk forecasting.

#### 1. Real-Time Workflow Methodology
The AEGIS-X platform operates on a reactive, event-driven streaming architecture. Telemetry and alerts are ingested via a realtime stream and processed through a Multi-Tier Intelligence Cascade:
1. **Tier 0 (Deterministic):** Fast-path evaluation against known IOCs and behavioral signatures.
2. **Tier 1 (Statistical):** Anomaly detection using time-series forecasting (EWMA, Poisson models) and Markov surprise models.
3. **Tier 2 (Cognitive/LLM):** Deep reasoning via Gemini Flash for complex, multi-stage attack chains.
4. **Fusion Engine:** All evidence is routed to the Fusion Engine, which applies Bayesian logic to compute a final posterior probability and expected utility before executing the Digital Twin emulation.

#### 2. Bayesian Log-Odds Fusion
To deterministically fuse evidence from multiple independent specialist agents, the system converts probabilities into log-odds space. 
For an uninformative prior $P_0 = 0.5$, the initial log-odds $L_0 = 0$.
For each piece of evidence $E_i$ provided by an agent, the updated posterior log-odds $L_{post}$ is:
$$ L_{post} = L_0 + \sum_{i=1}^{N} \Big( \ln(LR_i) \times W_i \times (1 - U_i) \Big) $$
Where:
- $LR_i$ is the Likelihood Ratio of the evidence.
- $W_i \in [0, 1]$ is the reliability weight of the specific agent.
- $U_i \in [0, 1]$ is the uncertainty penalty of the evidence.

The final posterior probability is retrieved via the logistic function:
$$ P_{post} = \frac{1}{1 + e^{-L_{post}}} $$

#### 3. Wilson Score Confidence Intervals
To quantify the certainty of the Bayesian posterior, the system calculates a 95% Wilson score interval based on the sample size $n$ of evidence records, avoiding the degenerate bounds of normal approximations for extreme probabilities. Let $p = P_{post}$ and $z = 1.96$:
$$ \text{Center} = \frac{p + \frac{z^2}{2n}}{1 + \frac{z^2}{n}} $$
$$ \text{Spread} = \frac{z \sqrt{\frac{p(1-p)}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}} $$
The confidence interval is then defined as $[\text{Center} - \text{Spread}, \text{Center} + \text{Spread}]$.

#### 4. Expected Utility of Containment
When deciding whether to isolate a compromised node, the engine calculates the Expected Utility (EU) to balance security against business disruption:
$$ EU = \max\Big(0, \min\big(1, R \cdot P_{post} - D \cdot (1 - P_{post})\big)\Big) $$
Where:
- $R$ is the estimated Risk Reduction (e.g., $0.85$).
- $D$ is the estimated Business Disruption cost (e.g., $0.15$).

#### 5. Laplacian Network Graph Propagation (Chronon Engine)
The Digital Twin uses a discrete-time graph diffusion model to emulate lateral movement. Let $R_i^{(t)}$ be the risk score of node $i$ at step $t$. The inflow of risk from a set of compromised nodes $C$ is modeled as:
$$ R_i^{(t+1)} = \min\left(100, R_i^{(t)} + \sum_{j \in C} R_j^{(t)} \times W_{j,i} \times \alpha \right) $$
Where:
- $W_{j,i}$ is the adjacency weight (likelihood of propagation from asset type $j$ to type $i$).
- $\alpha$ is the diffusion coefficient (calibrated to $0.15$).

#### 6. Statistical Anomaly Scoring
- **Poisson Anomaly Score:** Evaluates count-based metrics (e.g., login failures). For observed $O$ and expected rate $\lambda$:
  $$ LLR = O \ln\left(\frac{O}{\lambda}\right) - (O - \lambda) $$
- **Markov Surprise:** Evaluates the novelty of a state transition given probability $P_{trans}$:
  $$ S = -\log_2(P_{trans}) $$
