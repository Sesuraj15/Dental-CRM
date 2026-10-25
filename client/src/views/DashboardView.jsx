import React from 'react';
import {
  Calendar,
  Users,
  Target,
  Package,
  TrendingUp,
  AlertCircle,
  Clock,
  ArrowRight,
  CheckCircle,
  MessageSquare,
  Sparkles,
  Zap
} from 'lucide-react';

export default function DashboardView({
  data,
  onNavigate,
  onOpenAppointmentModal,
  onTriggerRecallBatch,
  onTriggerFollowups
}) {
  const {
    metrics = {},
    appointments = [],
    patients = [],
    leads = [],
    inventory = [],
    invoices = [],
    settings = {}
  } = data;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.date === todayStr);
  const lowStockItems = inventory.filter(i => i.qty <= i.min);
  const dueRecalls = metrics.recallDue || 0;
  const activeLeads = leads.filter(l => ['New', 'Contacted', 'Engaged'].includes(l.status)).length;

  const totalRevenue = invoices.reduce((acc, inv) => acc + (inv.paid ? (inv.amount || 0) : 0), 0);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Welcome Banner */}
      <div className="glass-card" style={{
        padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)',
        borderColor: 'rgba(13, 148, 136, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge badge-teal">Autonomous Clinical Hub</span>
            <span style={{ fontSize: 12, color: 'var(--tx-muted)' }}>Dr. Raj's Practice Dashboard</span>
          </div>
          <h2 style={{ fontSize: 24, margin: '4px 0 6px', color: 'var(--tx-primary)' }}>
            Welcome back, Dr. Raj 👋
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--tx-secondary)', maxWidth: 650 }}>
            The AI Autonomous Agent is actively following up leads on WhatsApp, monitoring 6-month patient hygiene recalls, and managing operatory inventory.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onTriggerFollowups} className="btn btn-primary">
            <Zap size={15} />
            <span>AI Follow-up Cycle</span>
          </button>
          <button onClick={onTriggerRecallBatch} className="btn btn-secondary">
            <Clock size={15} />
            <span>Run Recall Check</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        {/* Today's Appointments */}
        <div className="glass-card stat-card" onClick={() => onNavigate('appointments')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--cyan)' }}>
            <Calendar size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Today's Schedule</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--tx-primary)' }}>{todayAppts.length}</div>
            <div style={{ fontSize: 11.5, color: 'var(--teal)', fontWeight: 600, marginTop: 2 }}>
              {todayAppts.filter(a => a.status === 'Completed').length} completed today
            </div>
          </div>
        </div>

        {/* Overdue Hygiene Recalls */}
        <div className="glass-card stat-card" onClick={() => onNavigate('patients')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--amber)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Recalls Overdue</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--tx-primary)' }}>{dueRecalls}</div>
            <div style={{ fontSize: 11.5, color: 'var(--amber)', fontWeight: 600, marginTop: 2 }}>
              6-month interval alerts
            </div>
          </div>
        </div>

        {/* AI Active Nurture Funnel */}
        <div className="glass-card stat-card" onClick={() => onNavigate('leads')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--indigo)' }}>
            <Target size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Active AI Leads</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--tx-primary)' }}>{activeLeads}</div>
            <div style={{ fontSize: 11.5, color: 'var(--indigo)', fontWeight: 600, marginTop: 2 }}>
              Auto teeth triage & slots
            </div>
          </div>
        </div>

        {/* Operatory Inventory Low Alert */}
        <div className="glass-card stat-card" onClick={() => onNavigate('inventory')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{
            background: lowStockItems.length > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            color: lowStockItems.length > 0 ? 'var(--rose)' : 'var(--emerald)'
          }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Supplies Health</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--tx-primary)' }}>
              {lowStockItems.length > 0 ? `${lowStockItems.length} Low` : 'Nominal'}
            </div>
            <div style={{ fontSize: 11.5, color: lowStockItems.length > 0 ? 'var(--rose)' : 'var(--emerald)', fontWeight: 600, marginTop: 2 }}>
              {lowStockItems.length > 0 ? 'Restock recommended' : 'All items adequate'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 24 }}>
        {/* Today's Schedule Card */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, margin: 0, color: 'var(--tx-primary)' }}>Today's Operatory Schedule</h3>
              <p style={{ fontSize: 12, color: 'var(--tx-muted)', margin: '2px 0 0' }}>
                Appointments booked with Dr. Raj for today ({todayStr})
              </p>
            </div>
            <button onClick={() => onNavigate('appointments')} className="btn btn-outline btn-sm">
              <span>View Full Calendar</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {todayAppts.length === 0 ? (
            <div style={{
              padding: '36px 20px',
              textAlign: 'center',
              background: 'var(--card-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--tx-muted)'
            }}>
              <Calendar size={32} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>No appointments scheduled for today yet.</p>
              <button
                onClick={onOpenAppointmentModal}
                className="btn btn-primary btn-sm"
                style={{ marginTop: 12 }}
              >
                + Book New Patient Slot
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Service</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAppts.map(appt => {
                    const patient = patients.find(p => p.id === appt.patientId);
                    return (
                      <tr key={appt.id}>
                        <td style={{ fontWeight: 700, color: 'var(--teal)' }}>{appt.time}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{patient ? patient.name : 'Unknown Patient'}</div>
                          <div style={{ fontSize: 11, color: 'var(--tx-muted)' }}>{patient ? patient.phone : ''}</div>
                        </td>
                        <td>
                          <span className="badge badge-indigo">{appt.service}</span>
                        </td>
                        <td>
                          <span className={`badge ${
                            appt.status === 'Completed' ? 'badge-emerald' :
                            appt.status === 'Cancelled' ? 'badge-rose' : 'badge-teal'
                          }`}>
                            {appt.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Autonomous Lead Agent & Funnel */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 16, margin: 0, color: 'var(--tx-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} style={{ color: 'var(--cyan)' }} />
                AI Lead Nurture Pipeline
              </h3>
              <p style={{ fontSize: 12, color: 'var(--tx-muted)', margin: '2px 0 0' }}>
                Autonomous WhatsApp inquiry & slot conversion
              </p>
            </div>
            <button onClick={() => onNavigate('leads')} className="btn btn-outline btn-sm">
              <span>Kanban</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'New / Ingested', count: leads.filter(l => l.status === 'New').length, color: 'var(--cyan)' },
              { label: 'WhatsApp Contacted', count: leads.filter(l => l.status === 'Contacted').length, color: 'var(--indigo)' },
              { label: 'Teeth Inquiry / Engaged', count: leads.filter(l => l.status === 'Engaged').length, color: 'var(--amber)' },
              { label: 'Slot Auto-Booked', count: leads.filter(l => l.status === 'Booked').length, color: 'var(--teal)' },
              { label: 'Completed & Won', count: leads.filter(l => l.status === 'Won').length, color: 'var(--emerald)' }
            ].map(stage => (
              <div key={stage.label} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--card-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-secondary)' }}>{stage.label}</span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: stage.color,
                  background: 'var(--bg-surface)',
                  padding: '2px 8px',
                  borderRadius: 9999,
                  border: '1px solid var(--border)'
                }}>
                  {stage.count}
                </span>
              </div>
            ))}
          </div>

          {/* Quick Trigger Callout */}
          <div style={{
            marginTop: 'auto',
            padding: 14,
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            fontSize: 12,
            color: 'var(--tx-secondary)'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--cyan)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} />
              Autonomous Lead Agent Active
            </div>
            Runs automatically in the background to follow up leads with dental concerns and offer free calendar slots directly on WhatsApp.
          </div>
        </div>
      </div>
    </div>
  );
}
