import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  AlertTriangle,
  Stethoscope,
  Send,
  CheckCircle,
  FileText,
  Clock,
  Layers,
  HelpCircle
} from 'lucide-react';
import { api } from '../api';

export default function DentalAICopilotView({ prices = {} }) {
  const [activeTab, setActiveTab] = useState('triage');

  // Triage state
  const [symptomsInput, setSymptomsInput] = useState('');
  const [triageResult, setTriageResult] = useState(null);
  const [triageLoading, setTriageLoading] = useState(false);

  // Copilot Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello! I am your Dental Clinical & Practice Copilot. Ask me anything about Dr. Raj\'s appointments, overdue patient recalls, dental triage, or treatment estimates.'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Treatment Plan state
  const [selectedServices, setSelectedServices] = useState(['Checkup', 'Cleaning']);
  const [planNotes, setPlanNotes] = useState('');
  const [planResult, setPlanResult] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);

  const handleRunTriage = async (e) => {
    e.preventDefault();
    if (!symptomsInput.trim()) return;
    setTriageLoading(true);
    try {
      const res = await api.aiTriage(symptomsInput.trim());
      setTriageResult(res);
    } catch (err) {
      alert('Triage error: ' + err.message);
    } finally {
      setTriageLoading(false);
    }
  };

  const handleSendCopilotChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      const res = await api.aiChat(userMsg);
      setChatMessages(prev => [...prev, { role: 'assistant', text: res.reply || res.text || 'Understood.' }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Error contacting AI Copilot: ' + err.message }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    setPlanLoading(true);
    try {
      const res = await api.aiTreatmentPlan(selectedServices, planNotes);
      setPlanResult(res);
    } catch (err) {
      alert('Treatment plan error: ' + err.message);
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('triage')}
          className={`btn btn-sm ${activeTab === 'triage' ? 'btn-primary' : 'btn-outline'}`}
        >
          <Stethoscope size={14} />
          <span>Clinical Symptom Triage</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`btn btn-sm ${activeTab === 'chat' ? 'btn-primary' : 'btn-outline'}`}
        >
          <Bot size={14} />
          <span>Practice Data Copilot</span>
        </button>
        <button
          onClick={() => setActiveTab('plan')}
          className={`btn btn-sm ${activeTab === 'plan' ? 'btn-primary' : 'btn-outline'}`}
        >
          <FileText size={14} />
          <span>Treatment Plan Estimator</span>
        </button>
      </div>

      {/* Tab 1: Clinical Symptom Triage */}
      {activeTab === 'triage' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.4fr)', gap: 24 }}>
          {/* Input Panel */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={18} style={{ color: 'var(--cyan)' }} />
              <h3 style={{ fontSize: 16, margin: 0, color: 'var(--tx-primary)' }}>
                AI Dental Symptom Evaluator
              </h3>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--tx-muted)', margin: '0 0 16px' }}>
              Enter reported patient symptoms to evaluate clinical urgency, provisional diagnosis, and chairside procedure.
            </p>

            <form onSubmit={handleRunTriage} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Patient Symptoms & Complaints
                </label>
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder="e.g., sharp shooting pain in lower molar when drinking cold water, lingers for 15 minutes, slight swelling on cheek"
                  value={symptomsInput}
                  onChange={(e) => setSymptomsInput(e.target.value)}
                  required
                />
              </div>

              {/* Sample Symptom Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--tx-muted)', alignSelf: 'center' }}>Presets:</span>
                {[
                  'Severe throbbing pain in lower jaw with facial swelling',
                  'Bleeding gums while brushing, bad breath, plaque buildup',
                  'Yellow teeth staining from coffee and tobacco',
                  'Chipped front tooth after eating hard food'
                ].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSymptomsInput(s)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    {s.slice(0, 32)}...
                  </button>
                ))}
              </div>

              <button type="submit" disabled={triageLoading} className="btn btn-primary" style={{ marginTop: 8 }}>
                {triageLoading ? 'Analyzing Clinical Signals...' : 'Run Symptom Triage'}
              </button>
            </form>
          </div>

          {/* Result Panel */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 16px', color: 'var(--tx-primary)' }}>
              Clinical Triage Assessment
            </h3>

            {!triageResult ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--tx-muted)' }}>
                <Stethoscope size={36} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                <p style={{ margin: 0, fontSize: 13 }}>Enter patient symptoms on the left to evaluate clinical guidance.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)' }}>Urgency Level</span>
                  <span className={`badge ${
                    triageResult.urgency === 'High' ? 'badge-rose' :
                    triageResult.urgency === 'Medium' ? 'badge-amber' : 'badge-emerald'
                  }`} style={{ fontSize: 12, padding: '4px 10px' }}>
                    {triageResult.urgency} Urgency
                  </span>
                </div>

                <div style={{ padding: 12, borderRadius: 8, background: 'var(--card-subtle)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Provisional Impression</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-primary)', marginTop: 2 }}>
                    {triageResult.provisionalDiagnosis || triageResult.condition || 'Dental Consultation Required'}
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(13, 148, 136, 0.08)', border: '1px solid rgba(13, 148, 136, 0.25)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase' }}>Recommended Clinical Procedure</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-primary)', marginTop: 2 }}>
                    {triageResult.recommendedService || 'Comprehensive Checkup & Diagnostic X-Ray'}
                  </div>
                </div>

                {triageResult.guidance && (
                  <div style={{ padding: 12, borderRadius: 8, background: 'var(--card-subtle)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Chairside Guidance & Home Palliative</div>
                    <div style={{ fontSize: 13, color: 'var(--tx-secondary)', marginTop: 2 }}>
                      {triageResult.guidance}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Practice Data Copilot */}
      {activeTab === 'chat' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 270px)', minHeight: 520, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--card-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={18} style={{ color: 'var(--cyan)' }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-primary)' }}>DentaDesk Practice AI Copilot</span>
              <span style={{ fontSize: 11, color: 'var(--tx-muted)', marginLeft: 8 }}>Connected to Live Practice State</span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {chatMessages.map((msg, i) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div key={i} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                  maxWidth: '75%'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 14,
                    fontSize: 13,
                    lineHeight: 1.5,
                    background: isAssistant ? 'var(--card-subtle)' : 'linear-gradient(135deg, var(--teal) 0%, var(--cyan) 100%)',
                    color: isAssistant ? 'var(--tx-primary)' : '#ffffff',
                    border: isAssistant ? '1px solid var(--border)' : 'none',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--tx-muted)', fontSize: 12, fontStyle: 'italic', paddingLeft: 10 }}>
                Dr. Raj's AI Copilot is thinking...
              </div>
            )}
          </div>

          <div style={{ padding: 14, borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            <form onSubmit={handleSendCopilotChat} style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                className="input"
                placeholder="Ask about schedule, recall statistics, pricing, or patient concerns..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" disabled={chatLoading} className="btn btn-primary">
                <Send size={15} />
                <span>Ask</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Treatment Plan Estimator */}
      {activeTab === 'plan' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 12px', color: 'var(--tx-primary)' }}>
              Configure Treatment Plan
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--tx-muted)', margin: '0 0 16px' }}>
              Select planned dental treatments for an itemized estimate with stages and recovery advice.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 8 }}>
                  Include Procedures
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.keys(prices).map(svc => {
                    const isChecked = selectedServices.includes(svc);
                    return (
                      <label key={svc} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: isChecked ? 'rgba(13, 148, 136, 0.12)' : 'var(--card-subtle)',
                        border: `1px solid ${isChecked ? 'var(--teal)' : 'var(--border)'}`,
                        cursor: 'pointer',
                        fontSize: 12.5,
                        color: 'var(--tx-primary)'
                      }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedServices([...selectedServices, svc]);
                            else setSelectedServices(selectedServices.filter(s => s !== svc));
                          }}
                        />
                        <span>{svc} (₹{prices[svc]})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Special Clinical Conditions
                </label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="e.g., patient requests pain-free local anesthesia; has dental anxiety"
                  value={planNotes}
                  onChange={(e) => setPlanNotes(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={planLoading || selectedServices.length === 0}
                className="btn btn-primary"
              >
                {planLoading ? 'Computing Plan...' : 'Generate Treatment Roadmap'}
              </button>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 12px', color: 'var(--tx-primary)' }}>
              Treatment Plan Roadmap
            </h3>

            {!planResult ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--tx-muted)' }}>
                <FileText size={36} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                <p style={{ margin: 0, fontSize: 13 }}>Click 'Generate Treatment Roadmap' to preview estimate.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, background: 'var(--card-subtle)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-muted)' }}>Estimated Total Fee</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--teal)' }}>₹{planResult.totalEstimate || 0}</span>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-muted)', marginBottom: 6 }}>Procedures & Steps</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {planResult.steps?.map((step, idx) => (
                      <div key={idx} style={{ padding: 8, borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: 12.5 }}>
                        <b>Step {idx + 1}:</b> {step}
                      </div>
                    ))}
                  </div>
                </div>

                {planResult.advice && (
                  <div style={{ padding: 12, borderRadius: 8, background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)', fontSize: 12 }}>
                    <b>Patient Preparation:</b> {planResult.advice}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
