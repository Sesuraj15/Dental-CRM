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
    <div className="modal-overlay" style={{ background: 'rgba(9, 13, 22, 0.85)' }}>
      <div className="modal-content" style={{ maxWidth: 420, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 4px 16px rgba(6, 182, 212, 0.4)'
          }}>
            <Activity size={28} />
          </div>
          <h2 style={{ fontSize: 22, margin: '0 0 6px', color: 'var(--tx-primary)' }}>
            DentaDesk AI
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--tx-muted)' }}>
            Autonomous Practice CRM • Dr. Raj
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
