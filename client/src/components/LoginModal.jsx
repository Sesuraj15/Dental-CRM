import React, { useState } from 'react';
import { Activity, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../api';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username) return setError('Username is required');
    setLoading(true);
    setError('');

    try {
      await api.login(username, password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ background: 'var(--bg)', position: 'fixed', inset: 0, overflow: 'hidden' }}>
      {/* Ambient Animated Background Mesh */}
      <div className="ambient-background-layer" aria-hidden="true">
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
        <div className="ambient-grid-overlay" />
      </div>

      <div className="modal-content glass-card" style={{ maxWidth: 420, padding: 36, position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--indigo) 0%, var(--cyan) 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 6px 20px var(--indigo-glow)'
          }}>
            <Activity size={28} />
          </div>
          <h2 style={{ fontSize: 24, margin: '0 0 6px', color: 'var(--tx-primary)' }}>
            DentaDesk AI
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--tx-muted)' }}>
            Autonomous Practice Portal • Dr. Raj
          </p>
        </div>

        {error && (
          <div style={{
            padding: 10,
            borderRadius: 6,
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            color: 'var(--rose)',
            fontSize: 12.5,
            marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
              Account Username
            </label>
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--tx-muted)' }} />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: 34 }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="owner / admin"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', marginBottom: 4 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--tx-muted)' }} />
              <input
                type="password"
                className="input"
                style={{ paddingLeft: 34 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8, padding: 11, fontSize: 14 }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Practice Hub'}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        <div style={{
          marginTop: 20,
          padding: 12,
          borderRadius: 8,
          background: 'var(--card-subtle)',
          border: '1px solid var(--border)',
          fontSize: 11.5,
          color: 'var(--tx-muted)',
          textAlign: 'center'
        }}>
          <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, color: 'var(--teal)' }} />
          Session protected with cryptographic JWT & bcrypt encryption.
        </div>
      </div>
    </div>
  );
}
