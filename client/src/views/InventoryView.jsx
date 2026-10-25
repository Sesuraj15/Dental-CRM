import React, { useState } from 'react';
import {
  Package,
  Plus,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Edit2,
  TrendingDown,
  Layers
} from 'lucide-react';

export default function InventoryView({
  inventory = [],
  onCreateItem,
  onUpdateItem,
  onDeleteItem
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [min, setMin] = useState('5');
  const [perVisit, setPerVisit] = useState('0');
  const [unit, setUnit] = useState('units');

  const lowStockItems = inventory.filter(i => i.qty <= i.min);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!name) return alert('Item name is required');
    onCreateItem({
      name,
      qty: +qty || 0,
      min: +min || 5,
      perVisit: +perVisit || 0,
      unit: unit || 'units'
    });
    setShowAddModal(false);
    setName('');
    setQty('');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Banner */}
      <div className="glass-card" style={{
        padding: '20px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
            <Package size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, margin: 0, color: 'var(--tx-primary)' }}>
              Operatory Consumables & Supplies ({inventory.length} SKUs)
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx-muted)' }}>
              Automatically deducted when Dr. Raj completes patient treatment appointments
            </p>
          </div>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
          <Plus size={14} />
          <span>+ Add Supply Item</span>
        </button>
      </div>

      {/* Low Stock Warning Banner if applicable */}
      {lowStockItems.length > 0 && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <AlertTriangle size={20} style={{ color: 'var(--rose)', flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: 'var(--tx-primary)' }}>
            <b>Attention:</b> {lowStockItems.length} dental supplies are below safe threshold: {lowStockItems.map(i => i.name).join(', ')}.
          </div>
        </div>
      )}

      {/* Inventory Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16
      }}>
        {inventory.map(item => {
          const isLow = item.qty <= item.min;
          return (
            <div
              key={item.id}
              className="glass-card"
              style={{
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                borderColor: isLow ? 'rgba(244, 63, 94, 0.4)' : 'var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: 15, margin: 0, color: 'var(--tx-primary)' }}>{item.name}</h4>
                  <div style={{ fontSize: 11.5, color: 'var(--tx-muted)', marginTop: 2 }}>
                    Per visit usage: {item.perVisit > 0 ? `${item.perVisit} ${item.unit}` : 'On demand'}
                  </div>
                </div>
                <span className={`badge ${isLow ? 'badge-rose' : 'badge-emerald'}`}>
                  {isLow ? 'Low Stock' : 'Adequate'}
                </span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--card-subtle)'
              }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: isLow ? 'var(--rose)' : 'var(--teal)' }}>
                  {item.qty}
                </span>
                <span style={{ fontSize: 12, color: 'var(--tx-muted)' }}>{item.unit} in stock</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--tx-muted)' }}>
                  Min safe: {item.min}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onUpdateItem(item.id, { qty: item.qty + 5 })}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                  >
                    +5 Stock
                  </button>
                  <button
                    onClick={() => onUpdateItem(item.id, { qty: Math.max(0, item.qty - 1) })}
                    className="btn btn-outline btn-sm"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                  >
                    -1 Stock
                  </button>
                </div>
                <button
                  onClick={() => onDeleteItem(item.id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--tx-muted)', cursor: 'pointer', padding: 4 }}
                  title="Remove Item"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Supply Item Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, marginBottom: 16, color: 'var(--tx-primary)' }}>
              Add Operatory Supply Item
            </h3>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                  Item Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Dental Bibs, Composite Resin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                    Current Stock
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                    Unit of Measurement
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g., box, pieces, tubes"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                    Min Threshold (Alert)
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
                    Per Visit Auto Deduction
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={perVisit}
                    onChange={(e) => setPerVisit(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
