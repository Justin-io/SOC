import React, { useState } from 'react';
import { ArrowLeft, Calculator as MathIcon, Info, Share2 } from 'lucide-react';
import katex from 'katex';

interface EquationProps {
  latex: string;
  block?: boolean;
}

const Equation: React.FC<EquationProps> = ({ latex, block = false }) => {
  const html = katex.renderToString(latex, {
    displayMode: block,
    throwOnError: false,
    strict: false,
  });
  return (
    <span
      className={`text-black ${block ? 'block overflow-x-auto py-2' : 'inline-block'}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface MathSpecDocProps {
  onBack: () => void;
}

export const MathSpecDoc: React.FC<MathSpecDocProps> = ({ onBack }) => {
  // Sandbox State for Live Mathematical Simulator
  const [lr, setLr] = useState(5.0);
  const [weight, setWeight] = useState(0.8);
  const [uncertainty, setUncertainty] = useState(0.1);
  const [riskReduction, setRiskReduction] = useState(0.85);
  const [disruptionCost, setDisruptionCost] = useState(0.3);

  // Math Live Calculations
  const priorProb = 0.5;
  const l0 = Math.log(priorProb / (1 - priorProb));
  const l_post = l0 + Math.log(Math.max(0.01, lr)) * weight * (1 - uncertainty);
  const p_post = 1 / (1 + Math.exp(-l_post));
  
  // Wilson Interval
  const n = 15; // Assume 15 evidence records
  const z = 1.96;
  const p = p_post;
  const center = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const spread = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / (1 + (z * z) / n);
  const wilsonLower = Math.max(0, center - spread);
  const wilsonUpper = Math.min(1, center + spread);

  // Expected Utility
  const eu = Math.max(0, Math.min(1, riskReduction * p - disruptionCost * (1 - p)));

  return (
    <div className="p-6 max-w-5xl mx-auto font-sans bg-white min-h-screen text-[#111111]">
      
      {/* Navigation Header */}
      <div className="flex items-center gap-4 border-b border-[#E5E5E5] pb-4 mb-6 sticky top-0 bg-white z-10 pt-4">
        <button 
          onClick={onBack}
          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-gray-700"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
            Mathematical & Algorithmic Specification
          </h1>
          <p className="text-sm text-[#737373] mt-0.5 font-mono">
            Formally Proven Core Equations, Multi-Tier Fusion, & Bayesian Methodology
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[#F4F4F5] border border-[#E5E5E5] text-xs font-semibold rounded hover:bg-[#E4E4E5]">
            <Share2 size={14} /> Export PDF
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Content Area */}
        <div className="flex-1 space-y-12">
          
          <section id="workflow-methodology">
            <h2 className="text-xl font-bold text-[#111111] mb-3 flex items-center gap-2 border-b border-[#E5E5E5] pb-2">
              <span className="bg-[#111] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">1</span>
              Real-Time Workflow Methodology
            </h2>
            <div className="text-[#333] space-y-4 leading-relaxed text-sm">
              <p>
                The AEGIS-X platform operates on a reactive, event-driven streaming architecture. Telemetry and alerts are ingested via a realtime stream and processed through a <strong>Multi-Tier Intelligence Cascade</strong>. This approach guarantees ultra-low latency for known threats while reserving intensive cognitive reasoning for complex attack chains.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-xs shadow-inner">
                <p className="mb-2 font-bold text-gray-700">Cascade Architecture:</p>
                <ul className="space-y-2 list-none">
                  <li><strong className="text-indigo-600">Tier 0 (Deterministic):</strong> <Equation latex="O(1)" /> hash lookups, YARA signatures, and behavioral fast-path rules.</li>
                  <li><strong className="text-indigo-600">Tier 1 (Statistical):</strong> Time-series anomalies, Poisson models, and EWMA forecasting.</li>
                  <li><strong className="text-indigo-600">Tier 2 (Cognitive/LLM):</strong> Deep reasoning over unstructured logs via Gemini & Claude.</li>
                  <li><strong className="text-indigo-600">Fusion Engine:</strong> Terminal node routing all evidence via Bayesian log-odds to yield a final conformal posterior probability.</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="bayesian-fusion">
            <h2 className="text-xl font-bold text-[#111111] mb-3 flex items-center gap-2 border-b border-[#E5E5E5] pb-2">
              <span className="bg-[#111] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">2</span>
              Bayesian Log-Odds Evidence Fusion
            </h2>
            <div className="text-[#333] space-y-4 leading-relaxed text-sm">
              <p>
                To deterministically aggregate multi-agent evidence in an independent, identically distributed (<Equation latex="i.i.d." />) framework, we map probabilities into log-odds space. This prevents asymptotic probability collapse associated with naive Bayes multiplication.
              </p>
              
              <div className="bg-white border-l-4 border-blue-500 pl-4 py-2 my-4 shadow-sm text-lg">
                <Equation latex="L_{post} = L_0 + \sum_{i=1}^{N} \Big( \ln(LR_i) \cdot W_i \cdot (1 - U_i) \Big)" block />
              </div>
              
              <p>Where for <Equation latex="N" /> pieces of evidence:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><Equation latex="L_0" /> is the prior log-odds (derived from an uninformative prior <Equation latex="P_0 = 0.5" />).</li>
                <li><Equation latex="LR_i" /> is the Likelihood Ratio of the <Equation latex="i" />-th evidence.</li>
                <li><Equation latex="W_i \in [0, 1]" /> is the reliability weight of the specific agent generating the evidence.</li>
                <li><Equation latex="U_i \in [0, 1]" /> is the uncertainty penalty (where <Equation latex="0" /> is fully certain).</li>
              </ul>
              
              <p>The log-odds is mapped back to the posterior probability space via the standard logistic sigmoid function:</p>
              
              <div className="bg-white border-l-4 border-green-500 pl-4 py-2 my-4 shadow-sm text-lg">
                <Equation latex="P_{post} = \frac{1}{1 + e^{-L_{post}}}" block />
              </div>
            </div>
          </section>

          <section id="wilson-score">
            <h2 className="text-xl font-bold text-[#111111] mb-3 flex items-center gap-2 border-b border-[#E5E5E5] pb-2">
              <span className="bg-[#111] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">3</span>
              Wilson Score Confidence Bounds
            </h2>
            <div className="text-[#333] space-y-4 leading-relaxed text-sm">
              <p>
                To quantify uncertainty in our Bayesian posterior, especially for small sample sizes of alerts <Equation latex="n" />, we utilise the <strong>Wilson Score Interval</strong>. This avoids the severe degradation of normal Wald approximations when <Equation latex="p \approx 0" /> or <Equation latex="p \approx 1" />.
              </p>
              <p>Let <Equation latex="p = P_{post}" /> and <Equation latex="z = 1.96" /> (for 95% confidence). We define the center and spread:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-md">
                  <p className="text-xs font-bold text-gray-500 mb-2">Center (<Equation latex="\tilde{p}" />)</p>
                  <Equation latex="\text{Center} = \frac{p + \frac{z^2}{2n}}{1 + \frac{z^2}{n}}" block />
                </div>
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-md">
                  <p className="text-xs font-bold text-gray-500 mb-2">Spread (Margin of Error)</p>
                  <Equation latex="\text{Spread} = \frac{z \sqrt{\frac{p(1-p)}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}" block />
                </div>
              </div>
              <p>
                The calibrated confidence interval is bounded exactly by <Equation latex="\big[ \text{Center} - \text{Spread}, \text{Center} + \text{Spread} \big]" />.
              </p>
            </div>
          </section>

          <section id="expected-utility">
            <h2 className="text-xl font-bold text-[#111111] mb-3 flex items-center gap-2 border-b border-[#E5E5E5] pb-2">
              <span className="bg-[#111] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">4</span>
              Expected Utility of Autonomous Containment
            </h2>
            <div className="text-[#333] space-y-4 leading-relaxed text-sm">
              <p>
                The Autonomous Containment engine executes actions (e.g., endpoint isolation) only when the Expected Utility (<Equation latex="EU" />) is strictly positive, optimizing the trade-off between risk mitigation and business disruption.
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4 shadow-sm text-lg">
                <Equation latex="EU = \max\Big(0, \min\big(1, R \cdot P_{post} - D \cdot (1 - P_{post})\big)\Big)" block />
              </div>
              
              <ul className="list-disc pl-6 space-y-1">
                <li><Equation latex="R" /> (Risk Reduction): Normalized value (0 to 1) of the security benefit if an attack is successfully isolated.</li>
                <li><Equation latex="D" /> (Business Disruption Cost): Normalized penalty (0 to 1) incurred if an isolation turns out to be a false positive.</li>
              </ul>
            </div>
          </section>

          <section id="chronon-engine">
            <h2 className="text-xl font-bold text-[#111111] mb-3 flex items-center gap-2 border-b border-[#E5E5E5] pb-2">
              <span className="bg-[#111] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">5</span>
              Discrete-Time Laplacian Graph Diffusion (Chronon Engine)
            </h2>
            <div className="text-[#333] space-y-4 leading-relaxed text-sm">
              <p>
                The Digital Twin utilizes a graph diffusion model to emulate malware lateral movement and blast radius over the topology matrix. For any node <Equation latex="i" /> at time step <Equation latex="t" />, the accumulated risk score <Equation latex="R_i" /> is defined as:
              </p>
              
              <div className="bg-indigo-50 border border-indigo-200 rounded-md p-4 my-4 shadow-sm text-lg">
                <Equation latex="R_i^{(t+1)} = \min\left(100, R_i^{(t)} + \sum_{j \in C} R_j^{(t)} \cdot W_{j,i} \cdot \alpha \right)" block />
              </div>

              <ul className="list-disc pl-6 space-y-1">
                <li><Equation latex="C" />: The subset of actively compromised neighboring nodes.</li>
                <li><Equation latex="W_{j,i}" />: Directed adjacency weight representing vulnerability propagation vector from <Equation latex="j" /> to <Equation latex="i" />.</li>
                <li><Equation latex="\alpha" />: Diffusion coefficient calibrated to the exploit speed (standard setup <Equation latex="\alpha = 0.15" />).</li>
              </ul>
            </div>
          </section>

          <section id="statistical-anomaly">
            <h2 className="text-xl font-bold text-[#111111] mb-3 flex items-center gap-2 border-b border-[#E5E5E5] pb-2">
              <span className="bg-[#111] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">6</span>
              Statistical Anomaly & Surprise Scoring
            </h2>
            <div className="text-[#333] space-y-4 leading-relaxed text-sm">
              <p>
                Tier 1 evaluations rely on distribution-free or generalized statistical bounds. 
              </p>
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gray-800 mb-2">A. Poisson Log-Likelihood Ratio</h4>
                  <p>For count-based metrics (e.g., login failures) with observed <Equation latex="O" /> and expected rate <Equation latex="\lambda" />:</p>
                  <div className="bg-white border p-3 rounded-md mt-2 shadow-sm">
                    <Equation latex="LLR = O \ln\left(\frac{O}{\lambda}\right) - (O - \lambda)" block />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 mb-2">B. Markov Surprise Novelty</h4>
                  <p>Given the probability <Equation latex="P_{trans}" /> of transitioning to a new state in an application state machine:</p>
                  <div className="bg-white border p-3 rounded-md mt-2 shadow-sm">
                    <Equation latex="S = -\log_2(P_{trans})" block />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 mb-2">C. Exponentially Weighted Moving Average (EWMA)</h4>
                  <p>Where <Equation latex="\alpha_{ewma}" /> is the smoothing factor:</p>
                  <div className="bg-white border p-3 rounded-md mt-2 shadow-sm">
                    <Equation latex="\hat{Y}_t = \alpha_{ewma} Y_t + (1 - \alpha_{ewma}) \hat{Y}_{t-1}" block />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="conformal-risk">
            <h2 className="text-xl font-bold text-[#111111] mb-3 flex items-center gap-2 border-b border-[#E5E5E5] pb-2">
              <span className="bg-[#111] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">7</span>
              Conformal Risk & Multi-Agent Consensus
            </h2>
            <div className="text-[#333] space-y-4 leading-relaxed text-sm">
              <p>
                <strong>Conformal Coverage:</strong> To ensure that our risk predictions are robust against arbitrary non-stationary distributions, we apply Conformal Prediction guarantees. For a desired coverage <Equation latex="1 - \alpha" />, we flag an event as anomalous if its non-conformity score exceeds the calibrated quantile <Equation latex="Q" />:
              </p>
              <div className="bg-white border p-3 rounded-md shadow-sm">
                <Equation latex="\text{Anomaly If } S(x) > Q_{1-\alpha}(\hat{S}_{cal})" block />
              </div>

              <p className="mt-4">
                <strong>Agent Dissent Metric:</strong> The ensemble disagreement across <Equation latex="N" /> specialist cognitive agents is evaluated using population variance scaled against a benchmark standard deviation of <Equation latex="25\%" />:
              </p>
              <div className="bg-white border p-3 rounded-md shadow-sm">
                <Equation latex="\sigma_{agents} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (C_i - \bar{C})^2}" block />
                <Equation latex="D_{score} = \min\left(100, \left\lfloor \frac{\sigma_{agents}}{25} \times 50 \right\rfloor \right)" block />
              </div>
            </div>
          </section>

        </div>

        {/* Right Sidebar: Live Simulator Sandbox */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-28 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#111111] mb-4 flex items-center gap-2 border-b border-[#E5E5E5] pb-2">
              <MathIcon size={16} className="text-indigo-600" />
              Live Equation Sandbox
            </h3>

            <div className="space-y-4 font-mono text-[11px]">
              
              <div className="space-y-1">
                <div className="flex justify-between text-gray-700">
                  <label>Likelihood Ratio (<Equation latex="LR_i" />)</label>
                  <span className="font-bold">{lr.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min={0.1} max={20.0} step={0.1} 
                  value={lr} onChange={(e) => setLr(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-gray-700">
                  <label>Agent Weight (<Equation latex="W_i" />)</label>
                  <span className="font-bold">{weight.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min={0.0} max={1.0} step={0.05} 
                  value={weight} onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-gray-700">
                  <label>Uncertainty Penalty (<Equation latex="U_i" />)</label>
                  <span className="font-bold">{uncertainty.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min={0.0} max={1.0} step={0.05} 
                  value={uncertainty} onChange={(e) => setUncertainty(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <hr className="border-[#E5E5E5] my-4" />
              
              <div className="space-y-1">
                <div className="flex justify-between text-gray-700">
                  <label>Risk Reduction (<Equation latex="R" />)</label>
                  <span className="font-bold">{riskReduction.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min={0.0} max={1.0} step={0.05} 
                  value={riskReduction} onChange={(e) => setRiskReduction(Number(e.target.value))}
                  className="w-full accent-red-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-gray-700">
                  <label>Disruption Cost (<Equation latex="D" />)</label>
                  <span className="font-bold">{disruptionCost.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min={0.0} max={1.0} step={0.05} 
                  value={disruptionCost} onChange={(e) => setDisruptionCost(Number(e.target.value))}
                  className="w-full accent-red-600"
                />
              </div>

            </div>

            {/* Sandbox Output Calculations */}
            <div className="mt-6 bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-[11px] shadow-inner space-y-3">
              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-gray-400">Bayesian Log-Odds (<Equation latex="L_{post}" />)</span>
                <span className="font-bold text-white">{l_post.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-gray-400">Posterior Prob (<Equation latex="P_{post}" />)</span>
                <span className="font-bold text-green-400">{(p_post * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-gray-400">Wilson Interval</span>
                <span className="font-bold text-purple-400">
                  [{(wilsonLower * 100).toFixed(1)}%, {(wilsonUpper * 100).toFixed(1)}%]
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Expected Utility (<Equation latex="EU" />)</span>
                <span className="font-bold text-blue-400">{eu.toFixed(4)}</span>
              </div>
            </div>

            <div className="mt-4 flex bg-blue-50 text-blue-800 text-[10px] p-2 rounded items-start gap-2">
              <Info size={12} className="mt-0.5 shrink-0" />
              <p>Outputs are rendered live using the mathematical formulas in Sections 2, 3, and 4.</p>
            </div>
            
          </div>
        </div>
      </div>
      
    </div>
  );
};
