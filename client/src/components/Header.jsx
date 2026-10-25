import React, { useState } from 'react';
import {
  Bell,
  Plus,
  Zap,
  Radio,
  CheckCircle,
  Clock,
  Sparkles,
  ChevronDown,
  X
} from 'lucide-react';

export default function Header({
  currentView,
  clinicName = 'DentaDesk Dental Care',
  doctorName = 'Dr. Raj',
  waLive = false,
  notifications = [],
  onOpenNewAppointment,
  onOpenNewLead,
  onTriggerAutomation
}) {
  const [showNotifications, setShowNotifications] = useState(false);

  const viewTitles = {
    dashboard: { title: 'Executive Practice Overview', subtitle: 'Real-time clinical metrics, revenue performance, and daily schedule' },
    appointments: { title: 'Clinical Appointments & Operatory Schedule', subtitle: 'Manage calendar, book slots, and dispatch WhatsApp confirmation reminders' },
    leads: { title: 'Autonomous AI Lead Nurturing Agent', subtitle: 'Automatic WhatsApp qualification, teeth inquiry, and slot auto-booking' },
    patients: { title: 'Patient Health Records & Digital Dossier', subtitle: 'Complete patient directory, historical services, and automated 6-month recalls' },
    whatsapp: { title: 'WhatsApp Practice Bot & Interactive Simulator', subtitle: 'Live conversation threads, instant slot booking buttons, and bot tester' },
    'ai-copilot': { title: 'Clinical AI Copilot & Diagnostic Evaluator', subtitle: 'Real-time dental symptom triage, treatment planning, and clinical assistant' },
    inventory: { title: 'Operatory Supply Inventory', subtitle: 'Automated per-visit stock deduction, threshold alerts, and reordering' },
    billing: { title: 'Invoices, Fees & Payment Reconciliation', subtitle: 'Itemized dental treatments, UPI QR payment collection, and accounts' },
    settings: { title: 'Practice Configuration & Meta WhatsApp API', subtitle: 'Doctor details, WhatsApp webhook integration, and automated cron jobs' }
  };

  const currentInfo = viewTitles[currentView] || { title: 'DentaDesk Practice Hub', subtitle: 'Autonomous Dental CRM' };

  return (
    <header className="app-header">
      {/* Title & Context */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--tx-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {currentInfo.title}
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--tx-muted)', margin: 0 }}>
          {currentInfo.subtitle}
        </p>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* WhatsApp Cloud API Live Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 9999,
          background: waLive ? 'rgba(37, 211, 102, 0.12)' : 'rgba(245, 158, 11, 0.12)',
          border: `1px solid ${waLive ? 'rgba(37, 211, 102, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          fontSize: 11.5,
          fontWeight: 600,
          color: waLive ? '#10b981' : '#f59e0b'
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: waLive ? '#10b981' : '#f59e0b',
            boxShadow: waLive ? '0 0 8px #10b981' : '0 0 8px #f59e0b'
          }} />
          <span>{waLive ? 'WhatsApp Cloud API Live' : 'WhatsApp Dry-Run Simulator'}</span>
        </div>

        {/* Quick Action: Trigger AI Nurture */}
        <button
          onClick={onTriggerAutomation}
          className="btn btn-outline btn-sm"
          style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
          title="Run Autonomous Followup Agent across all active leads"
        >
          <Zap size={14} />
          <span>Run AI Follow-ups</span>
        </button>

        {/* Quick Action: Book Appointment */}
        <button
          onClick={onOpenNewAppointment}
          className="btn btn-primary btn-sm"
        >
          <Plus size={14} />
          <span>Book Slot</span>
        </button>

        {/* Notifications Trigger */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn btn-secondary btn-icon"
            style={{ position: 'relative' }}
            title="Notifications Log"
          >
            <Bell size={16} />
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--teal)',
                boxShadow: '0 0 6px var(--teal)'
              }} />
            )}
          </button>

          {/* Notifications Flyout */}
          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: '120%',
              right: 0,
              width: 360,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: 16,
              zIndex: 100,
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--tx-primary)' }}>System Notifications ({notifications.length})</span>
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--tx-muted)' }}
                >
                  <X size={15} />
                </button>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--tx-muted)', fontSize: 12 }}>
                    No recent notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} style={{
                      padding: 10,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--card-subtle)',
                      fontSize: 12,
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <div style={{ color: 'var(--tx-primary)', marginBottom: 4 }}>{n.msg}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--tx-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} />
                        {new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
