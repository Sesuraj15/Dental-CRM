import React, { useState } from 'react';
import {
  Target,
  Sparkles,
  Zap,
  Plus,
  RefreshCw,
  Upload,
  ArrowRight,
  MessageSquare,
  Calendar,
  CheckCircle,
  Clock,
  Trash2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export default function LeadsView({
  leads = [],
  patients = [],
  onCreateLead,
  onUpdateLead,
  onDeleteLead,
  onConvertLead,
  onAIFollowup,
  onSyncSheet,
  onImportCSV,
  onTriggerFullCycle
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvText, setCsvText] = useState('');

  // Form states
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSource, setLeadSource] = useState('Meta Ads');
  const [leadNotes, setLeadNotes] = useState('');

  const stages = [
    { key: 'New', label: '1. New / Ingested', color: 'var(--cyan)' },
    { key: 'Contacted', label: '2. WhatsApp Contacted', color: 'var(--indigo)' },
    { key: 'Engaged', label: '3. Teeth Inquiry / Engaged', color: 'var(--amber)' },
    { key: 'Booked', label: '4. Slot Auto-Booked', color: 'var(--teal)' },
    { key: 'Won', label: '5. Completed & Won', color: 'var(--emerald)' }
  ];

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!leadName || !leadPhone) return alert('Name and phone are required');
    onCreateLead({
      name: leadName,
      phone: leadPhone,
      source: leadSource,
      notes: leadNotes
    });
    setShowCreateModal(false);
    setLeadName('');
    setLeadPhone('');
    setLeadNotes('');
  };

  const handleCSVSubmit = (e) => {
    e.preventDefault();
    if (!csvText.trim()) return alert('Paste CSV data first');
    onImportCSV(csvText);
    setShowCSVModal(false);
    setCsvText('');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top AI Automation Action Header */}
      <div className="glass-card" style={{
        padding: '22px 26px',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
        borderColor: 'rgba(99, 102, 241, 0.25)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge badge-indigo">Autonomous AI Funnel</span>
            <span style={{ fontSize: 12, color: 'var(--tx-muted)' }}>Zero Human Resources Required</span>
          </div>
          <h2 style={{ fontSize: 22, margin: '2px 0 6px', color: 'var(--tx-primary)' }}>
            WhatsApp AI Lead Qualification & Slot Auto-Booking
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--tx-secondary)', maxWidth: 700 }}>
            The AI agent automatically greets incoming leads, diagnoses teeth symptoms (pain, whitening, cleaning, checkup), and offers available working slots with Dr. Raj for instant 1-click WhatsApp confirmation.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button onClick={onTriggerFullCycle} className="btn btn-primary" title="Trigger autonomous follow-up cycle for all active leads">
            <Zap size={15} />
            <span>⚡ Run AI Follow-up Cycle</span>
          </button>
          <button onClick={onSyncSheet} className="btn btn-secondary" title="Sync leads from connected Google Sheet">
            <RefreshCw size={14} />
            <span>Sync Sheet</span>
          </button>
          <button onClick={() => setShowCSVModal(true)} className="btn btn-outline" title="Bulk import lead phone numbers">
            <Upload size={14} />
            <span>Import CSV</span>
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={15} />
            <span>+ Ingest Lead</span>
          </button>
        </div>
      </div>

      {/* Funnel Metrics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12
      }}>
        {stages.map(st => {
          const count = leads.filter(l => l.status === st.key).length;
          return (
            <div key={st.key} className="glass-card" style={{ padding: '14px 18px', borderTop: `3px solid ${st.color}` }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx-muted)' }}>{st.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-primary)', marginTop: 4 }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban Board Columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
        gap: 16,
        alignItems: 'start'
      }}>
        {stages.map(stage => {
          const stageLeads = leads.filter(l => l.status === stage.key);
          return (
            <div
              key={stage.key}
              style={{
                background: 'var(--card-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 450,
                maxHeight: 780
              }}
            >
              {/* Column Header */}
              <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md) var(--radius-md) 0 0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-primary)' }}>{stage.key}</span>
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: 'var(--card-subtle)',
                  color: 'var(--tx-muted)',
                  border: '1px solid var(--border)'
                }}>
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards Container */}
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1 }}>
                {stageLeads.length === 0 ? (
                  <div style={{
                    padding: '30px 10px',
                    textAlign: 'center',
                    color: 'var(--tx-muted)',
                    fontSize: 12,
                    fontStyle: 'italic'
                  }}>
                    No leads in this stage
                  </div>
                ) : (
                  stageLeads.map(lead => {
                    const patient = patients.find(p => p.id === lead.patientId);
                    return (
                      <div
                        key={lead.id}
                        className="glass-card"
                        style={{
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          borderColor: 'var(--border)'
                        }}
                      >
                        {/* Card Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-primary)' }}>{lead.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--tx-muted)', marginTop: 1 }}>{lead.phone}</div>
                          </div>
                          <span className="badge badge-muted" style={{ fontSize: 10 }}>{lead.source}</span>
                        </div>

                        {/* AI Qualification Stage & Concern */}
                        <div style={{
                          padding: 8,
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(99, 102, 241, 0.08)',
                          fontSize: 11.5,
                          border: '1px solid rgba(99, 102, 241, 0.15)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontWeight: 700, color: 'var(--indigo)', fontSize: 10.5 }}>
                              AI STAGE: {lead.aiStage || 'NEW'}
                            </span>
                            {lead.followupCount > 0 && (
                              <span style={{ fontSize: 10, color: 'var(--tx-muted)' }}>
                                Cycle #{lead.followupCount}
                              </span>
                            )}
                          </div>
                          <div style={{ color: 'var(--tx-secondary)', fontSize: 11 }}>
                            {lead.concern ? (
                              <span>🦷 <b>Reported Issue:</b> {lead.concern}</span>
                            ) : (
                              <span style={{ fontStyle: 'italic', opacity: 0.8 }}>Pending teeth symptom response</span>
                            )}
                          </div>
                        </div>

                        {/* Notes */}
                        {lead.notes && (
                          <div style={{ fontSize: 11, color: 'var(--tx-muted)', background: 'var(--card-subtle)', padding: 6, borderRadius: 4 }}>
                            {lead.notes}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {/* 1-Click AI Nurture */}
                            <button
                              onClick={() => onAIFollowup(lead.id)}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 8px', fontSize: 11 }}
                              title="Autonomous AI WhatsApp follow-up for this lead"
                            >
                              <Sparkles size={12} />
                              <span>AI Nurture</span>
                            </button>

                            {/* Convert to Patient */}
                            {lead.status !== 'Booked' && lead.status !== 'Won' && (
                              <button
                                onClick={() => onConvertLead(lead.id)}
                                className="btn btn-outline btn-sm"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                title="Convert to patient and schedule appointment"
                              >
                                <span>Convert</span>
                              </button>
                            )}
                          </div>

                          {/* Delete Lead */}
                          <button
                            onClick={() => onDeleteLead(lead.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--tx-muted)', cursor: 'pointer', padding: 4 }}
                            title="Delete Lead"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ingest Lead Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, marginBottom: 16, color: 'var(--tx-primary)' }}>
              Ingest New Dental Lead
            </h3>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Lead Full Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Ananya Sharma"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  WhatsApp Phone Number *
                </label>
                <input
                  type="tel"
                  className="input"
                  placeholder="e.g., 9876543210"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Acquisition Source
                </label>
                <select
                  className="select"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                >
                  <option value="Meta Ads">Meta Ads (Facebook/Instagram)</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Website Form">Website Consultation Form</option>
                  <option value="Google Sheet">Google Sheet Sync</option>
                  <option value="Referral">Patient Referral</option>
                  <option value="Manual">Manual Walk-in / Ingest</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Initial Notes / Dental Concern
                </label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="e.g., Inquired about teeth aligners or cleaning"
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Ingest Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVModal && (
        <div className="modal-overlay" onClick={() => setShowCSVModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, marginBottom: 16, color: 'var(--tx-primary)' }}>
              Bulk Import Leads (CSV / Text)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginBottom: 12 }}>
              Paste lines formatted as <code>Name, Phone, Source</code> or just <code>Phone</code>:
            </p>
            <form onSubmit={handleCSVSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <textarea
                className="textarea"
                rows={8}
                placeholder="Pooja Sharma, 9876543210, Instagram Ads&#10;Karthik R, 9123456789, Google Search"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowCSVModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Import All
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
