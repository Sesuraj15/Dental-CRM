import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Check,
  CheckCheck,
  Sparkles,
  Phone,
  Zap,
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function WhatsAppSimulatorView({
  chats = {},
  patients = [],
  leads = [],
  waLive = false,
  doctorName = 'Dr. Raj',
  onSendMessage,
  onSimulateInbound,
  onNavigateToAppointments
}) {
  // Get all known phone numbers
  const chatPhones = Object.keys(chats);
  const allPhones = Array.from(new Set([
    ...chatPhones,
    ...patients.map(p => p.phone),
    ...leads.map(l => l.phone)
  ])).filter(Boolean);

  const [activePhone, setActivePhone] = useState(allPhones[0] || '9876543210');
  const [outgoingText, setOutgoingText] = useState('');
  const [inboundText, setInboundText] = useState('');

  const activeMessages = chats[activePhone] || [];

  const activeContact =
    patients.find(p => p.phone === activePhone) ||
    leads.find(l => l.phone === activePhone) ||
    { name: 'Patient / Inquirer', phone: activePhone };

  const handleSendClinicMessage = (e) => {
    e.preventDefault();
    if (!outgoingText.trim()) return;
    onSendMessage(activePhone, outgoingText.trim());
    setOutgoingText('');
  };

  const handleSimulateInboundMessage = (textToSimulate, btnPayload = null) => {
    const text = textToSimulate || inboundText;
    if (!text && !btnPayload) return;
    onSimulateInbound({
      phone: activePhone,
      text: text || '',
      btn: btnPayload,
      name: activeContact.name
    });
    setInboundText('');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Info Banner */}
      <div className="glass-card" style={{
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: '#25D366',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(37,211,102,0.3)'
          }}>
            <MessageSquare size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-primary)' }}>
                Interactive WhatsApp Simulator & Live Chat
              </span>
              <span className={`badge ${waLive ? 'badge-emerald' : 'badge-amber'}`}>
                {waLive ? 'Live Cloud API' : 'Dry-Run Engine Active'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-muted)' }}>
              Simulate patient replies, auto-book slots with Dr. Raj, and test autonomous conversational bot logic.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateToAppointments()}
          className="btn btn-outline btn-sm"
          style={{ borderColor: 'var(--teal)', color: 'var(--teal)' }}
        >
          <Calendar size={14} />
          <span>Go to Appointments Scheduler</span>
        </button>
      </div>

      {/* Main Split Chat Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px minmax(0, 1fr)',
        gap: 20,
        height: 'calc(100vh - 240px)',
        minHeight: 580
      }}>
        {/* Left Contacts List */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--card-subtle)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-primary)' }}>
              Active Conversations ({allPhones.length})
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {allPhones.map(phone => {
              const contact =
                patients.find(p => p.phone === phone) ||
                leads.find(l => l.phone === phone) ||
                { name: 'Patient', phone };
              const history = chats[phone] || [];
              const lastMsg = history[history.length - 1];
              const isSelected = activePhone === phone;

              return (
                <div
                  key={phone}
                  onClick={() => setActivePhone(phone)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(13, 148, 136, 0.12)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--teal)' : '3px solid transparent',
                    transition: 'background 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: isSelected ? 700 : 600, fontSize: 13, color: 'var(--tx-primary)' }}>
                      {contact.name}
                    </span>
                    {lastMsg && (
                      <span style={{ fontSize: 10, color: 'var(--tx-muted)' }}>
                        {new Date(lastMsg.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--tx-muted)', marginBottom: 2 }}>{phone}</div>
                  <div style={{
                    fontSize: 11.5,
                    color: 'var(--tx-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {lastMsg ? (lastMsg.dir === 'in' ? '👤 ' : '🤖 ') + lastMsg.text : 'No messages yet'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Active Conversation Window */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Chat Header */}
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14
              }}>
                {activeContact.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-primary)' }}>
                  {activeContact.name}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--tx-muted)' }}>
                  {activePhone} • Doctor: {doctorName}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="badge badge-teal">WhatsApp Webhook Active</span>
            </div>
          </div>

          {/* Messages Stream */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--bg)'
          }}>
            {activeMessages.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--tx-muted)', maxWidth: 360 }}>
                <Bot size={36} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, margin: 0 }}>No chat messages recorded for this number yet.</p>
                <p style={{ fontSize: 11.5, marginTop: 4 }}>
                  Use the quick simulation chips below to simulate inbound questions from this patient!
                </p>
              </div>
            ) : (
              activeMessages.map((msg, idx) => {
                const isInbound = msg.dir === 'in';
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isInbound ? 'flex-start' : 'flex-end',
                      maxWidth: '75%',
                      alignSelf: isInbound ? 'flex-start' : 'flex-end'
                    }}
                  >
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 14,
                      fontSize: 13,
                      lineHeight: 1.45,
                      background: isInbound ? 'var(--card-bg)' : 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                      color: isInbound ? 'var(--tx-primary)' : '#ffffff',
                      border: isInbound ? '1px solid var(--border)' : 'none',
                      boxShadow: 'var(--shadow-sm)',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {msg.text}

                      {/* Interactive Buttons Preview if present */}
                      {msg.buttons && msg.buttons.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {msg.buttons.map((b, bIdx) => (
                            <button
                              key={bIdx}
                              onClick={() => handleSimulateInboundMessage(b.title, b.id)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                background: 'rgba(255,255,255,0.18)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                color: '#ffffff',
                                fontSize: 11.5,
                                fontWeight: 600,
                                cursor: 'pointer',
                                textAlign: 'center'
                              }}
                            >
                              👉 {b.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'var(--tx-muted)',
                      marginTop: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      {new Date(msg.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {!isInbound && <CheckCheck size={12} style={{ color: 'var(--teal)' }} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Simulation Chips */}
          <div style={{
            padding: '8px 16px',
            background: 'var(--card-subtle)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-muted)' }}>Simulate Patient:</span>
            {[
              'Hi, I have a bad toothache',
              'Can I book an appointment tomorrow?',
              'Available slots?',
              '1', // selects slot 1
              'Yes, confirm my booking',
              'What are your checkup fees?'
            ].map(prompt => (
              <button
                key={prompt}
                onClick={() => handleSimulateInboundMessage(prompt)}
                className="btn btn-outline btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                "{prompt}"
              </button>
            ))}
          </div>

          {/* Message Input Bottom Bars */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            <form onSubmit={handleSendClinicMessage} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="input"
                placeholder={`Reply to ${activeContact.name} as Clinic (Dr. Raj)...`}
                value={outgoingText}
                onChange={(e) => setOutgoingText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0 16px' }}>
                <Send size={15} />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
