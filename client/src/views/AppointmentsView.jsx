import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  RotateCcw,
  MessageSquare,
  Search,
  Filter,
  Trash2,
  User,
  Activity
} from 'lucide-react';

export default function AppointmentsView({
  appointments = [],
  patients = [],
  prices = {},
  slots = [],
  onBookAppointment,
  onUpdateStatus,
  onReschedule,
  onDeleteAppointment,
  onSendReminder
}) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBookModal, setShowBookModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  // New Appointment Form State
  const [formPatientId, setFormPatientId] = useState('');
  const [formDate, setFormDate] = useState(selectedDate);
  const [formTime, setFormTime] = useState(slots[0] || '10:00 AM');
  const [formService, setFormService] = useState('Checkup');
  const [formNotes, setFormNotes] = useState('');

  // Reschedule Form State
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');

  // Filtered appointments
  const filteredAppointments = appointments.filter(a => {
    const matchesDate = selectedDate ? a.date === selectedDate : true;
    const matchesStatus = statusFilter === 'ALL' ? true : a.status === statusFilter;
    const patient = patients.find(p => p.id === a.patientId);
    const matchesSearch = searchQuery
      ? (patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         patient?.phone?.includes(searchQuery) ||
         a.service.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesDate && matchesStatus && matchesSearch;
  });

  // Calculate day slot statuses
  const dayAppointments = appointments.filter(a => a.date === selectedDate && a.status === 'Booked');

  const handleOpenBookModal = (timeSlot = null) => {
    setFormDate(selectedDate);
    if (timeSlot) setFormTime(timeSlot);
    if (patients.length > 0 && !formPatientId) setFormPatientId(patients[0].id);
    setShowBookModal(true);
  };

  const handleCreateAppointment = (e) => {
    e.preventDefault();
    if (!formPatientId) return alert('Please select a patient');
    onBookAppointment({
      patientId: +formPatientId,
      date: formDate,
      time: formTime,
      service: formService,
      notes: formNotes
    });
    setShowBookModal(false);
    setFormNotes('');
  };

  const handleOpenReschedule = (appt) => {
    setRescheduleTarget(appt);
    setReschedDate(appt.date);
    setReschedTime(appt.time);
  };

  const handleConfirmReschedule = (e) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    onReschedule(rescheduleTarget.id, reschedDate, reschedTime);
    setRescheduleTarget(null);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Filter and Controls Bar */}
      <div className="glass-card" style={{ padding: 18, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          {/* Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarIcon size={16} style={{ color: 'var(--teal)' }} />
            <input
              type="date"
              className="input"
              style={{ width: 160 }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Quick Date Presets */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className={`btn btn-sm ${selectedDate === new Date().toISOString().split('T')[0] ? 'btn-primary' : 'btn-secondary'}`}
            >
              Today
            </button>
            <button
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setSelectedDate(tomorrow.toISOString().split('T')[0]);
              }}
              className="btn btn-secondary btn-sm"
            >
              Tomorrow
            </button>
            <button
              onClick={() => setSelectedDate('')}
              className={`btn btn-sm ${selectedDate === '' ? 'btn-primary' : 'btn-outline'}`}
            >
              All Dates
            </button>
          </div>

          {/* Status Filter */}
          <select
            className="select"
            style={{ width: 130 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="Booked">Booked</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--tx-muted)' }} />
            <input
              type="text"
              className="input"
              placeholder="Search patient or service..."
              style={{ paddingLeft: 32 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button onClick={() => handleOpenBookModal()} className="btn btn-primary">
            <Plus size={15} />
            <span>+ Book Slot</span>
          </button>
        </div>
      </div>

      {/* Operatory Daily Working Slots Timeline */}
      {selectedDate && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} style={{ color: 'var(--cyan)' }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-primary)' }}>
                Operatory Slots for {selectedDate} ({dayAppointments.length} Booked)
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--tx-muted)' }}>Doctor: Dr. Raj</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {slots.map(slotTime => {
              const bookedAppt = dayAppointments.find(a => a.time === slotTime);
              const isBooked = !!bookedAppt;
              const patient = isBooked ? patients.find(p => p.id === bookedAppt.patientId) : null;

              return (
                <div
                  key={slotTime}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: isBooked ? 'rgba(13, 148, 136, 0.12)' : 'var(--card-subtle)',
                    border: `1px solid ${isBooked ? 'var(--teal)' : 'var(--border)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isBooked ? 'var(--teal)' : 'var(--tx-primary)' }}>
                      {slotTime}
                    </span>
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: isBooked ? 'var(--teal)' : 'var(--tx-muted)'
                    }} />
                  </div>
                  
                  {isBooked ? (
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {patient ? patient.name : 'Booked'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--tx-muted)' }}>{bookedAppt.service}</div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenBookModal(slotTime)}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '3px 6px', fontSize: 10.5, marginTop: 4, width: '100%' }}
                    >
                      + Book
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Appointments List Table */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, margin: 0, color: 'var(--tx-primary)' }}>
            Scheduled Consultations & Procedures ({filteredAppointments.length})
          </h3>
        </div>

        {filteredAppointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx-muted)' }}>
            <CalendarIcon size={36} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: 13 }}>No appointments matching your filters.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date & Slot</th>
                  <th>Patient Info</th>
                  <th>Service / Treatment</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map(appt => {
                  const patient = patients.find(p => p.id === appt.patientId);
                  return (
                    <tr key={appt.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--tx-primary)' }}>{appt.date}</div>
                        <div style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 600 }}>{appt.time}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--tx-primary)' }}>{patient ? patient.name : 'Unknown Patient'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--tx-muted)' }}>{patient ? patient.phone : ''}</div>
                      </td>
                      <td>
                        <span className="badge badge-indigo">{appt.service}</span>
                        <div style={{ fontSize: 10.5, color: 'var(--tx-muted)', marginTop: 2 }}>
                          Fee: ₹{prices[appt.service] || 500}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          appt.status === 'Completed' ? 'badge-emerald' :
                          appt.status === 'Cancelled' ? 'badge-rose' : 'badge-teal'
                        }`}>
                          {appt.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--tx-secondary)', maxWidth: 200 }}>
                        {appt.notes || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {appt.status === 'Booked' && (
                            <>
                              <button
                                onClick={() => onUpdateStatus(appt.id, 'Completed')}
                                className="btn btn-success btn-sm"
                                title="Mark Completed (Raises Invoice & Deducts Supplies)"
                              >
                                <CheckCircle size={13} />
                                <span>Complete</span>
                              </button>
                              <button
                                onClick={() => handleOpenReschedule(appt)}
                                className="btn btn-secondary btn-sm"
                                title="Reschedule Date/Time"
                              >
                                <RotateCcw size={13} />
                              </button>
                              {patient && (
                                <button
                                  onClick={() => onSendReminder(patient.phone, `Reminder from Dr. Raj: Your dental appointment is confirmed for ${appt.date} at ${appt.time}.`)}
                                  className="btn btn-outline btn-sm"
                                  title="Send WhatsApp Reminder"
                                >
                                  <MessageSquare size={13} />
                                </button>
                              )}
                              <button
                                onClick={() => onUpdateStatus(appt.id, 'Cancelled')}
                                className="btn btn-danger btn-sm"
                                title="Cancel Appointment"
                              >
                                <XCircle size={13} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onDeleteAppointment(appt.id)}
                            className="btn btn-outline btn-sm"
                            style={{ color: 'var(--rose)', borderColor: 'rgba(244,63,94,0.3)' }}
                            title="Delete Record"
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

      {/* Book Appointment Modal */}
      {showBookModal && (
        <div className="modal-overlay" onClick={() => setShowBookModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, marginBottom: 16, color: 'var(--tx-primary)' }}>
              Book Dental Consultation / Procedure
            </h3>
            <form onSubmit={handleCreateAppointment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Select Patient *
                </label>
                <select
                  className="select"
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                    Time Slot *
                  </label>
                  <select
                    className="select"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    required
                  >
                    {slots.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Treatment / Service *
                </label>
                <select
                  className="select"
                  value={formService}
                  onChange={(e) => setFormService(e.target.value)}
                  required
                >
                  {Object.keys(prices).length > 0 ? (
                    Object.keys(prices).map(svc => (
                      <option key={svc} value={svc}>{svc} (₹{prices[svc]})</option>
                    ))
                  ) : (
                    <>
                      <option value="Checkup">Checkup (₹500)</option>
                      <option value="Cleaning">Cleaning (₹1200)</option>
                      <option value="Root canal">Root canal (₹6500)</option>
                      <option value="Whitening">Whitening (₹4000)</option>
                      <option value="Filling">Filling (₹1500)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Clinical Notes / Complaints
                </label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="e.g., patient complains of upper right tooth sensitivity to cold"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowBookModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="modal-overlay" onClick={() => setRescheduleTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, marginBottom: 16, color: 'var(--tx-primary)' }}>
              Reschedule Appointment
            </h3>
            <form onSubmit={handleConfirmReschedule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  New Date *
                </label>
                <input
                  type="date"
                  className="input"
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  New Time Slot *
                </label>
                <select
                  className="select"
                  value={reschedTime}
                  onChange={(e) => setReschedTime(e.target.value)}
                  required
                >
                  {slots.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setRescheduleTarget(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save New Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
