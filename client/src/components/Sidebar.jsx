import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Target,
  Users,
  MessageSquare,
  Bot,
  Package,
  CreditCard,
  Settings,
  Moon,
  Sun,
  LogOut,
  Sparkles,
  Activity
} from 'lucide-react';

export default function Sidebar({
  currentView,
  setCurrentView,
  theme,
  toggleTheme,
  onLogout,
  counts = {},
  doctorName = 'Dr. Raj'
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'appointments', label: 'Appointments', icon: Calendar, badge: counts.todayAppts },
    { id: 'leads', label: 'AI Lead Agent', icon: Target, badge: counts.totalLeads, highlight: true },
    { id: 'patients', label: 'Patients', icon: Users, badge: counts.recallDue ? `${counts.recallDue} due` : null },
    { id: 'whatsapp', label: 'WhatsApp Bot', icon: MessageSquare },
    { id: 'ai-copilot', label: 'Dental AI Copilot', icon: Bot, highlight: true },
    { id: 'inventory', label: 'Inventory', icon: Package, badge: counts.lowStock ? `${counts.lowStock} low` : null },
    { id: 'billing', label: 'Billing & Invoices', icon: CreditCard },
    { id: 'settings', label: 'Practice Settings', icon: Settings }
  ];

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          boxShadow: '0 4px 14px rgba(6, 182, 212, 0.4)'
        }}>
          <Activity size={22} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 18, color: '#ffffff', letterSpacing: '-0.02em' }}>
              Denta<span style={{ color: '#06b6d4' }}>Desk</span>
            </span>
            <span style={{
              background: 'rgba(6, 182, 212, 0.15)',
              color: '#06b6d4',
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid rgba(6, 182, 212, 0.3)'
            }}>AI</span>
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Autonomous Dental Practice</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
        <div style={{ padding: '0 18px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em' }}>
          Clinical Operations
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              style={{
                width: 'calc(100% - 24px)',
                background: isActive ? 'linear-gradient(90deg, rgba(13, 148, 136, 0.25) 0%, rgba(6, 182, 212, 0.12) 100%)' : 'transparent',
                border: 'none',
                textAlign: 'left'
              }}
            >
              <Icon size={18} style={{ color: isActive ? '#06b6d4' : '#94a3b8', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
              {item.badge && (
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 9999,
                  background: isActive ? '#0d9488' : 'rgba(255,255,255,0.1)',
                  color: '#ffffff'
                }}>
                  {item.badge}
                </span>
              )}
              {item.highlight && !item.badge && (
                <Sparkles size={14} style={{ color: '#06b6d4', opacity: 0.8 }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Doctor & Footer Section */}
      <div style={{ padding: '16px 16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          marginBottom: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1 0%, #0d9488 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
              color: '#ffffff'
            }}>
              DR
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{doctorName}</div>
              <div style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                Active Clinical Session
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggleTheme}
            className="btn btn-secondary btn-sm"
            style={{ flex: 1, padding: '7px 10px', fontSize: 12, justifyContent: 'center' }}
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button
            onClick={onLogout}
            className="btn btn-outline btn-sm"
            style={{ padding: '7px 10px', color: '#f43f5e', borderColor: 'rgba(244,63,94,0.3)' }}
            title="Sign Out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
