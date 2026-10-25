import React, { useState } from 'react';
import {
  Settings,
  Save,
  MessageSquare,
  Clock,
  Shield,
  Zap,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Play
} from 'lucide-react';
import { api } from '../api';

export default function SettingsView({
  settings = {},
  prices = {},
  automations = {},
  waLive = false,
  onSaveSettings,
  onRunAutomationTask
}) {
  const [clinicName, setClinicName] = useState(settings.clinicName || 'DentaDesk Dental Care');
  const [doctorName, setDoctorName] = useState(settings.doctorName || 'Dr. Raj');
  const [phone, setPhone] = useState(settings.phone || '');
  const [address, setAddress] = useState(settings.address || 'Suite 402, Health Arcade, Dental Care Plaza');
  const [recallDays, setRecallDays] = useState(settings.recallDays || 180);

  // Price list state
  const [priceList, setPriceList] = useState({ ...prices });

  // Test WhatsApp state
  const [testPhone, setTestPhone] = useState(phone || '');
  const [testText, setTestText] = useState('Hello from DentaDesk! 🦷 Testing live WhatsApp connection.');
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  const handleSavePractice = (e) => {
    e.preventDefault();
    onSaveSettings({
      settings: {
        clinicName,
        doctorName: 'Dr. Raj', // strictly maintain Dr. Raj
        phone,
        address,
        recallDays: +recallDays || 180
      },
      prices: priceList
    });
  };

  const handleSendTestWA = async (e) => {
    e.preventDefault();
    if (!testPhone) return alert('Enter phone number to test');
    setTestLoading(true);
    try {
      const res = await api.testWAText(testPhone, testText);
      setTestResult(res);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Banner */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--radius-md)',
          background: 'rgba(13, 148, 136, 0.12)',
          color: 'var(--teal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Settings size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: 20, margin: 0, color: 'var(--tx-primary)' }}>
            Practice Configuration & Automation Engine
          </h2>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx-muted)' }}>
            Configure clinic branding, Dr. Raj profile, Meta WhatsApp Cloud API credentials, and cron tasks
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1.2fr)', gap: 24 }}>
        {/* Practice & Doctor Details */}
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, margin: '0 0 16px', color: 'var(--tx-primary)' }}>
            Clinic Branding & Doctor Identity
          </h3>

          <form onSubmit={handleSavePractice} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                Clinic Name
              </label>
              <input
                type="text"
                className="input"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                Lead Dental Surgeon (Doctor)
              </label>
              <input
                type="text"
                className="input"
                value="Dr. Raj"
                disabled
                style={{ background: 'var(--card-subtle)', opacity: 0.85, fontWeight: 700 }}
              />
              <span style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 2, display: 'block' }}>
                Configured strictly to Dr. Raj
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                Clinic WhatsApp Alert Number
              </label>
              <input
                type="tel"
                className="input"
                placeholder="e.g., 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                Clinic Physical Address
              </label>
              <input
                type="text"
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                Hygiene Recall Interval (Days)
              </label>
              <input
                type="number"
                className="input"
                value={recallDays}
                onChange={(e) => setRecallDays(e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 2, display: 'block' }}>
                Standard periodic checkup cycle is 180 days (6 months)
              </span>
            </div>

            <div style={{ marginTop: 10 }}>
              <h4 style={{ fontSize: 14, margin: '0 0 10px', color: 'var(--tx-primary)' }}>
                Treatment Fee Schedule (₹)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {Object.keys(priceList).map(svc => (
                  <div key={svc}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--tx-muted)', marginBottom: 2 }}>{svc}</label>
                    <input
                      type="number"
                      className="input"
                      value={priceList[svc] || ''}
                      onChange={(e) => setPriceList({ ...priceList, [svc]: +e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: 14 }}>
              <Save size={15} />
              <span>Save Practice Settings</span>
            </button>
          </form>
        </div>

        {/* WhatsApp Cloud API & Automations Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* WhatsApp API Connection */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, margin: 0, color: 'var(--tx-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} style={{ color: '#25D366' }} />
                Meta WhatsApp Business API
              </h3>
              <span className={`badge ${waLive ? 'badge-emerald' : 'badge-amber'}`}>
                {waLive ? 'Live API Connected' : 'Dry-Run Mode'}
              </span>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--tx-muted)', margin: '0 0 14px' }}>
              {waLive
                ? 'Your Meta Cloud API token is active. Messages are delivered straight to patients’ WhatsApp devices.'
                : 'Using local simulator engine. Set WA_TOKEN and WA_PHONE_ID in your .env file to transmit real WhatsApp messages.'}
            </p>

            <form onSubmit={handleSendTestWA} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                <input
                  type="tel"
                  className="input"
                  placeholder="Recipient phone (e.g., 9876543210)"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <button type="submit" disabled={testLoading} className="btn btn-secondary btn-sm">
                  {testLoading ? 'Sending...' : 'Send Test WhatsApp'}
                </button>
              </div>

              {testResult && (
                <div style={{
                  padding: 10,
                  borderRadius: 6,
                  background: testResult.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                  border: `1px solid ${testResult.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                  fontSize: 12,
                  color: testResult.ok ? 'var(--emerald)' : 'var(--rose)'
                }}>
                  {testResult.ok ? '✓ Test message transmitted successfully!' : `Error: ${testResult.error}`}
                </div>
              )}
            </form>
          </div>

          {/* Autonomous Scheduler Monitor */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 14px', color: 'var(--tx-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} style={{ color: 'var(--cyan)' }} />
              Autonomous Background Tasks
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { task: 'leadFollowup', name: 'Lead Follow-up Agent', desc: 'Autonomous teeth inquiry & slot offering (every 30 min)' },
                { task: 'reminders', name: '24h Appointment Reminders', desc: 'Dispatches WhatsApp reminders for upcoming visits' },
                { task: 'recall', name: '6-Month Hygiene Recalls', desc: 'Checks and alerts overdue patients for routine checkup' },
                { task: 'sheet', name: 'Google Sheets Lead Poll', desc: 'Syncs incoming leads from connected spreadsheets' }
              ].map(job => (
                <div key={job.task} style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--card-subtle)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--tx-primary)' }}>{job.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx-muted)' }}>{job.desc}</div>
                  </div>
                  <button
                    onClick={() => onRunAutomationTask(job.task)}
                    className="btn btn-outline btn-sm"
                    style={{ padding: '4px 10px', fontSize: 11.5 }}
                    title={`Trigger ${job.name} now`}
                  >
                    <Play size={12} />
                    <span>Run Now</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
