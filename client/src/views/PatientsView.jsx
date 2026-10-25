import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Clock,
  MessageSquare,
  FileText,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  CheckCircle,
  Activity
} from 'lucide-react';

export default function PatientsView({
  patients = [],
  appointments = [],
  invoices = [],
  onCreatePatient,
  onUpdatePatient,
  onDeletePatient,
  onRecallPatient,
  onRunBatchRecall
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRecallDue, setFilterRecallDue] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeDossierPatient, setActiveDossierPatient] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [notes, setNotes] = useState('');
  const [lastService, setLastService] = useState('Checkup');

  const now = Date.now();

  const isDueForRecall = (p) => {
    if (!p.lastVisit) return false;
    const vDate = new Date(p.lastVisit.includes('T') ? p.lastVisit : p.lastVisit + 'T00:00');
    const daysSince = Math.floor((now - vDate.getTime()) / 864e5);
    return daysSince >= (p.recallDays || 180);
  };

  const getDaysOverdue = (p) => {
    if (!p.lastVisit) return 0;
    const vDate = new Date(p.lastVisit.includes('T') ? p.lastVisit : p.lastVisit + 'T00:00');
    const daysSince = Math.floor((now - vDate.getTime()) / 864e5);
    return daysSince - (p.recallDays || 180);
  };

  const recallDueCount = patients.filter(isDueForRecall).length;

  const filteredPatients = patients.filter(p => {
    const matchesSearch = searchQuery
      ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery)
      : true;
    const matchesRecall = filterRecallDue ? isDueForRecall(p) : true;
    return matchesSearch && matchesRecall;
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!name || !phone) return alert('Name and phone are required');
    onCreatePatient({
      name,
      phone,
      age: age ? +age : null,
      gender,
      lastService,
      notes
    });
    setShowCreateModal(false);
    setName('');
    setPhone('');
    setAge('');
    setNotes('');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Banner & Recall Trigger */}
      <div className="glass-card" style={{
        padding: '20px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(13, 148, 136, 0.12)',
            color: 'var(--teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, margin: 0, color: 'var(--tx-primary)' }}>
              Patient Directory & Recall Ledger ({patients.length})
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx-muted)' }}>
              {recallDueCount} patients due for periodic 6-month hygiene checkup & cleaning
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            onClick={() => setFilterRecallDue(!filterRecallDue)}
            className={`btn btn-sm ${filterRecallDue ? 'btn-primary' : 'btn-outline'}`}
          >
            <Clock size={14} />
            <span>{filterRecallDue ? 'Showing Overdue Only' : `Show Overdue (${recallDueCount})`}</span>
          </button>

          <button
            onClick={onRunBatchRecall}
            className="btn btn-secondary btn-sm"
            title="Automatically send WhatsApp recalls to all overdue patients"
          >
            <MessageSquare size={14} />
            <span>⚡ Send WhatsApp Recall Batch</span>
          </button>

          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
            <Plus size={14} />
            <span>+ Register Patient</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Search size={16} style={{ color: 'var(--tx-muted)' }} />
        <input
          type="text"
          className="input"
          placeholder="Search patient by full name or phone number..."
          style={{ border: 'none', background: 'transparent', padding: '6px 0', fontSize: 14 }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Patients Table */}
      <div className="glass-card" style={{ padding: 20 }}>
        {filteredPatients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx-muted)' }}>
            <Users size={36} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: 13 }}>No patients found matching your search.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Age / Gender</th>
                  <th>Last Visit & Service</th>
                  <th>Recall Status</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(p => {
                  const due = isDueForRecall(p);
                  const daysOverdue = getDaysOverdue(p);

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--tx-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--tx-muted)' }}>{p.phone}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: 'var(--tx-secondary)' }}>
                          {p.age ? `${p.age} yrs` : '—'} • {p.gender || 'Other'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--tx-primary)', fontSize: 12.5 }}>
                          {p.lastVisit || 'No Prior Visit'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--teal)' }}>
                          {p.lastService || 'Checkup'}
                        </div>
                      </td>
                      <td>
                        {due ? (
                          <span className="badge badge-amber">
                            <Clock size={11} />
                            <span>Overdue ({daysOverdue}d)</span>
                          </span>
                        ) : p.lastVisit ? (
                          <span className="badge badge-emerald">
                            <CheckCircle size={11} />
                            <span>Up to date</span>
                          </span>
                        ) : (
                          <span className="badge badge-muted">New Registration</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--tx-secondary)', maxWidth: 220 }}>
                        {p.notes || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => onRecallPatient(p.id)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '5px 10px', fontSize: 12 }}
                            title="Send WhatsApp Recall Message"
                          >
                            <MessageSquare size={13} />
                            <span>Recall</span>
                          </button>
                          <button
                            onClick={() => setActiveDossierPatient(p)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '5px 10px', fontSize: 12 }}
                            title="View Patient Clinical Dossier"
                          >
                            <FileText size={13} />
                            <span>Dossier</span>
                          </button>
                          <button
                            onClick={() => onDeletePatient(p.id)}
                            className="btn btn-outline btn-sm"
                            style={{ color: 'var(--rose)', borderColor: 'rgba(244,63,94,0.3)', padding: '5px 8px' }}
                            title="Delete Patient Record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Patient Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, marginBottom: 16, color: 'var(--tx-primary)' }}>
              Register New Patient
            </h3>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Vikram Mehra"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                    Age
                  </label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g., 34"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                    Gender
                  </label>
                  <select
                    className="select"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Primary Concern / Initial Service
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Routine Checkup, Root Canal, Bleeding Gums"
                  value={lastService}
                  onChange={(e) => setLastService(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Medical History & Allergies
                </label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="e.g., penicillin allergy, hypertensive, dental anxiety"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Patient Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Dossier Modal */}
      {activeDossierPatient && (
        <div className="modal-overlay" onClick={() => setActiveDossierPatient(null)}>
          <div className="modal-content" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 20, margin: 0, color: 'var(--tx-primary)' }}>
                  {activeDossierPatient.name}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--tx-muted)' }}>
                  {activeDossierPatient.phone} • {activeDossierPatient.age || '—'} yrs • {activeDossierPatient.gender}
                </p>
              </div>
              <button
                onClick={() => setActiveDossierPatient(null)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>

            {/* Medical Notes */}
            <div style={{
              padding: 14,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--card-subtle)',
              border: '1px solid var(--border)',
              marginBottom: 18
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--tx-muted)', marginBottom: 4 }}>
                Clinical & Health Notes
              </div>
              <div style={{ fontSize: 13, color: 'var(--tx-primary)' }}>
                {activeDossierPatient.notes || 'No health conditions or drug allergies recorded.'}
              </div>
            </div>

            {/* Appointments History */}
            <div style={{ marginBottom: 18 }}>
              <h4 style={{ fontSize: 14, marginBottom: 10, color: 'var(--tx-primary)' }}>
                Appointment & Consultation History
              </h4>
              {appointments.filter(a => a.patientId === activeDossierPatient.id).length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--tx-muted)', fontStyle: 'italic' }}>
                  No previous appointments logged.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {appointments.filter(a => a.patientId === activeDossierPatient.id).map(a => (
                    <div key={a.id} style={{
                      padding: 10,
                      borderRadius: 6,
                      background: 'var(--card-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12.5
                    }}>
                      <div>
                        <b>{a.date} at {a.time}</b> — {a.service}
                        {a.notes && <div style={{ fontSize: 11, color: 'var(--tx-muted)' }}>{a.notes}</div>}
                      </div>
                      <span className={`badge ${a.status === 'Completed' ? 'badge-emerald' : 'badge-teal'}`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invoices History */}
            <div>
              <h4 style={{ fontSize: 14, marginBottom: 10, color: 'var(--tx-primary)' }}>
                Treatment Invoices & Payments
              </h4>
              {invoices.filter(i => i.patientId === activeDossierPatient.id).length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--tx-muted)', fontStyle: 'italic' }}>
                  No billing invoices issued yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invoices.filter(i => i.patientId === activeDossierPatient.id).map(inv => (
                    <div key={inv.id} style={{
                      padding: 10,
                      borderRadius: 6,
                      background: 'var(--card-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12.5
                    }}>
                      <div>
                        <b>Invoice #{inv.id}</b> — {inv.service}
                        <div style={{ fontSize: 11, color: 'var(--tx-muted)' }}>Method: {inv.method}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--tx-primary)' }}>₹{inv.amount}</div>
                        <span className={`badge ${inv.paid ? 'badge-emerald' : 'badge-amber'}`}>
                          {inv.paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
