import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  FileCheck
} from 'lucide-react';

export default function BillingView({
  invoices = [],
  patients = [],
  prices = {},
  onCreateInvoice,
  onPayInvoice
}) {
  const [filterPaid, setFilterPaid] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [patientId, setPatientId] = useState('');
  const [service, setService] = useState('Checkup');
  const [amount, setAmount] = useState('500');
  const [method, setMethod] = useState('UPI');
  const [notes, setNotes] = useState('');

  const totalCollected = invoices.reduce((sum, i) => sum + (i.paid ? (i.amount || 0) : 0), 0);
  const pendingReceivable = invoices.reduce((sum, i) => sum + (!i.paid ? (i.amount || 0) : 0), 0);

  const filteredInvoices = invoices.filter(inv => {
    const matchesFilter = filterPaid === 'ALL' ? true : filterPaid === 'PAID' ? inv.paid : !inv.paid;
    const patient = patients.find(p => p.id === inv.patientId);
    const matchesSearch = searchQuery
      ? (patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         inv.service?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         String(inv.id).includes(searchQuery))
      : true;
    return matchesFilter && matchesSearch;
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!patientId || !amount) return alert('Patient and amount required');
    onCreateInvoice({
      patientId: +patientId,
      service,
      amount: +amount,
      method,
      paid: true,
      notes
    });
    setShowCreateModal(false);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Stats */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Collected Revenue</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx-primary)' }}>₹{totalCollected.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--emerald)', marginTop: 2 }}>Paid via UPI, Cards & Cash</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--amber)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Pending Receivables</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx-primary)' }}>₹{pendingReceivable.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 2 }}>Unsettled treatment invoices</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--indigo)' }}>
            <FileCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Total Invoices</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx-primary)' }}>{invoices.length}</div>
            <div style={{ fontSize: 11.5, color: 'var(--indigo)', marginTop: 2 }}>Raised for clinical services</div>
          </div>
        </div>
      </div>

      {/* Top Filter and Actions Bar */}
      <div className="glass-card" style={{ padding: 18, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setFilterPaid('ALL')}
            className={`btn btn-sm ${filterPaid === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
          >
            All Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setFilterPaid('PAID')}
            className={`btn btn-sm ${filterPaid === 'PAID' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Paid ({invoices.filter(i => i.paid).length})
          </button>
          <button
            onClick={() => setFilterPaid('UNPAID')}
            className={`btn btn-sm ${filterPaid === 'UNPAID' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Unpaid ({invoices.filter(i => !i.paid).length})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--tx-muted)' }} />
            <input
              type="text"
              className="input"
              placeholder="Search invoice or patient..."
              style={{ paddingLeft: 32 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
            <Plus size={14} />
            <span>+ Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="glass-card" style={{ padding: 20 }}>
        {filteredInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx-muted)' }}>
            <CreditCard size={36} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: 13 }}>No invoices found matching current filter.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Patient</th>
                  <th>Treatment Procedure</th>
                  <th>Amount</th>
                  <th>Payment Method</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const patient = patients.find(p => p.id === inv.patientId);
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 700, color: 'var(--teal)' }}>
                        #{inv.id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--tx-primary)' }}>{patient ? patient.name : 'Unknown'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--tx-muted)' }}>{patient ? patient.phone : ''}</div>
                      </td>
                      <td>
                        <span className="badge badge-indigo">{inv.service}</span>
                        {inv.notes && <div style={{ fontSize: 10.5, color: 'var(--tx-muted)', marginTop: 2 }}>{inv.notes}</div>}
                      </td>
                      <td style={{ fontWeight: 800, fontSize: 14, color: 'var(--tx-primary)' }}>
                        ₹{inv.amount ? inv.amount.toLocaleString('en-IN') : 0}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--tx-secondary)' }}>{inv.method || 'Pending'}</span>
                      </td>
                      <td>
                        <span className={`badge ${inv.paid ? 'badge-emerald' : 'badge-amber'}`}>
                          {inv.paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!inv.paid ? (
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => onPayInvoice(inv.id, 'UPI')}
                              className="btn btn-success btn-sm"
                              style={{ padding: '4px 8px', fontSize: 11 }}
                            >
                              Mark UPI
                            </button>
                            <button
                              onClick={() => onPayInvoice(inv.id, 'Cash')}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: 11 }}
                            >
                              Mark Cash
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 600 }}>
                            ✓ Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Custom Invoice Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, marginBottom: 16, color: 'var(--tx-primary)' }}>
              Create Dental Treatment Invoice
            </h3>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Select Patient *
                </label>
                <select
                  className="select"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Procedure / Treatment *
                </label>
                <input
                  type="text"
                  className="input"
                  value={service}
                  onChange={(e) => {
                    setService(e.target.value);
                    if (prices[e.target.value]) setAmount(prices[e.target.value]);
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                    Fee Amount (₹) *
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                    Payment Mode
                  </label>
                  <select
                    className="select"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Debit / Credit Card</option>
                    <option value="NetBanking">Net Banking</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Notes / Receipt Remarks
                </label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="e.g., Post-op medication prescribed; follow up in 2 weeks"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
