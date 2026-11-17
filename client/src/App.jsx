import React, { useState, useEffect, useCallback } from 'react';
import { api, getToken } from './api';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginModal from './components/LoginModal';

// Views
import DashboardView from './views/DashboardView';
import AppointmentsView from './views/AppointmentsView';
import LeadsView from './views/LeadsView';
import PatientsView from './views/PatientsView';
import WhatsAppSimulatorView from './views/WhatsAppSimulatorView';
import DentalAICopilotView from './views/DentalAICopilotView';
import InventoryView from './views/InventoryView';
import BillingView from './views/BillingView';
import SettingsView from './views/SettingsView';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('dentadesk_theme') || 'dark');
  const [currentView, setCurrentView] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    me: null,
    patients: [],
    appointments: [],
    leads: [],
    inventory: [],
    notifications: [],
    invoices: [],
    chats: {},
    slots: [],
    prices: {},
    settings: { clinicName: 'DentaDesk Dental Care', doctorName: 'Dr. Raj' },
    waLive: false,
    automations: {},
    metrics: {}
  });

  const [toasts, setToasts] = useState([]);

  // Toast notification helper
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  // Set theme attribute on root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dentadesk_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Bootstrap data fetcher
  const fetchBootstrapData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.bootstrap();
      setData(res);
      setIsAuthenticated(true);
    } catch (err) {
      if (err.message?.includes('sign in') || err.message?.includes('401')) {
        setIsAuthenticated(false);
      } else {
        showToast('Error loading practice data: ' + err.message, 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  // Initial load and periodic synchronization poll
  useEffect(() => {
    if (isAuthenticated) {
      fetchBootstrapData();
      const interval = setInterval(() => {
        fetchBootstrapData(true);
      }, 10000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchBootstrapData]);

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    showToast('Signed out of practice portal');
  };

  // ==================== PATIENTS HANDLERS ====================
  const handleCreatePatient = async (patientData) => {
    try {
      await api.createPatient(patientData);
      showToast(`Registered patient: ${patientData.name}`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdatePatient = async (id, updateData) => {
    try {
      await api.updatePatient(id, updateData);
      showToast('Patient record updated', 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeletePatient = async (id) => {
    if (!window.confirm('Are you sure you want to delete this patient record?')) return;
    try {
      await api.deletePatient(id);
      showToast('Patient record removed', 'info');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRecallPatient = async (id) => {
    try {
      const res = await api.recallPatient(id);
      showToast(res.note || 'WhatsApp recall dispatched successfully!', 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRunBatchRecall = async () => {
    try {
      const res = await api.runRecallBatch();
      showToast(`Recall batch complete: Contacted ${res.contacted || 0} overdue patients`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==================== APPOINTMENTS HANDLERS ====================
  const handleBookAppointment = async (apptData) => {
    try {
      await api.createAppointment(apptData);
      showToast(`Booked ${apptData.service} for ${apptData.date} at ${apptData.time}`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateAppointmentStatus = async (id, status) => {
    try {
      await api.updateAppointment(id, { status });
      showToast(`Appointment status updated to ${status}`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRescheduleAppointment = async (id, newDate, newTime) => {
    try {
      await api.updateAppointment(id, { date: newDate, time: newTime });
      showToast(`Rescheduled to ${newDate} at ${newTime}`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAppointment = async (id) => {
    if (!window.confirm('Delete this appointment record?')) return;
    try {
      await api.deleteAppointment(id);
      showToast('Appointment removed', 'info');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==================== LEADS HANDLERS ====================
  const handleCreateLead = async (leadData) => {
    try {
      await api.createLead(leadData);
      showToast(`Lead ingested: ${leadData.name}`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateLead = async (id, updateData) => {
    try {
      await api.updateLead(id, updateData);
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm('Delete this lead?')) return;
    try {
      await api.deleteLead(id);
      showToast('Lead removed', 'info');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleConvertLead = async (id) => {
    try {
      await api.convertLead(id);
      showToast('Lead converted to patient record!', 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAIFollowup = async (id) => {
    try {
      const res = await api.aiFollowupLead(id);
      showToast(res.message || 'AI follow-up dispatched on WhatsApp', 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSyncSheet = async () => {
    try {
      const res = await api.syncSheet();
      showToast(`Synced ${res.created || 0} leads from Google Sheet`, 'info');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleImportCSV = async (text) => {
    try {
      const res = await api.importLeadsCSV(text);
      showToast(`Imported ${res.created || 0} leads`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleTriggerFullCycle = async () => {
    try {
      const res = await api.runAutomation('leadFollowup');
      showToast('AI Lead Nurture Cycle executed across active leads', 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==================== INVENTORY HANDLERS ====================
  const handleCreateInventoryItem = async (itemData) => {
    try {
      await api.createInventoryItem(itemData);
      showToast(`Added supply item: ${itemData.name}`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateInventoryItem = async (id, updateData) => {
    try {
      await api.updateInventoryItem(id, updateData);
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteInventoryItem = async (id) => {
    if (!window.confirm('Delete this inventory item?')) return;
    try {
      await api.deleteInventoryItem(id);
      showToast('Supply item deleted', 'info');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==================== BILLING HANDLERS ====================
  const handleCreateInvoice = async (invData) => {
    try {
      await api.createInvoice(invData);
      showToast(`Invoice raised for ₹${invData.amount}`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handlePayInvoice = async (id, method) => {
    try {
      await api.payInvoice(id, method);
      showToast(`Payment recorded via ${method}`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==================== SETTINGS HANDLERS ====================
  const handleSaveSettings = async (payload) => {
    try {
      await api.updateSettings(payload);
      showToast('Practice settings and pricing saved', 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==================== WHATSAPP & AUTOMATION HANDLERS ====================
  const handleSendChatMessage = async (phone, text) => {
    try {
      await api.sendChatMessage(phone, text);
      showToast('Clinic message sent', 'info');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSimulateInboundChat = async (payload) => {
    try {
      await api.simulateInboundChat(payload);
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRunAutomationTask = async (task) => {
    try {
      await api.runAutomation(task);
      showToast(`Executed autonomous task: ${task}`, 'success');
      fetchBootstrapData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (!isAuthenticated) {
    return <LoginModal onLoginSuccess={() => fetchBootstrapData()} />;
  }

  const counts = {
    todayAppts: data.metrics?.todayAppts || data.appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length,
    recallDue: data.metrics?.recallDue || 0,
    totalLeads: data.leads.filter(l => ['New', 'Contacted', 'Engaged'].includes(l.status)).length,
    lowStock: data.inventory.filter(i => i.qty <= i.min).length
  };

  return (
    <div className="app-shell">
      {/* Ambient Animated Background Mesh */}
      <div className="ambient-background-layer" aria-hidden="true">
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
        <div className="ambient-orb orb-4" />
        <div className="ambient-grid-overlay" />
      </div>

      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
        counts={counts}
        doctorName="Dr. Raj"
      />

      {/* Main App Workspace */}
      <div className="app-main-wrapper">
        <Header
          currentView={currentView}
          clinicName={data.settings?.clinicName}
          doctorName="Dr. Raj"
          waLive={data.waLive}
          notifications={data.notifications || []}
          onOpenNewAppointment={() => setCurrentView('appointments')}
          onOpenNewLead={() => setCurrentView('leads')}
          onTriggerAutomation={handleTriggerFullCycle}
        />

        <main className="app-content">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--tx-muted)' }}>
              <div style={{
                width: 44,
                height: 44,
                border: '3px solid var(--border)',
                borderTopColor: 'var(--teal)',
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 0.8s linear infinite'
              }} />
              <p style={{ fontSize: 14 }}>Connecting to DentaDesk Clinical Engine...</p>
            </div>
          ) : (
            <>
              {currentView === 'dashboard' && (
                <DashboardView
                  data={data}
                  onNavigate={setCurrentView}
                  onOpenAppointmentModal={() => setCurrentView('appointments')}
                  onTriggerRecallBatch={handleRunBatchRecall}
                  onTriggerFollowups={handleTriggerFullCycle}
                />
              )}

              {currentView === 'appointments' && (
                <AppointmentsView
                  appointments={data.appointments || []}
                  patients={data.patients || []}
                  prices={data.prices || {}}
                  slots={data.slots || []}
                  onBookAppointment={handleBookAppointment}
                  onUpdateStatus={handleUpdateAppointmentStatus}
                  onReschedule={handleRescheduleAppointment}
                  onDeleteAppointment={handleDeleteAppointment}
                  onSendReminder={(phone, text) => handleSendChatMessage(phone, text)}
                />
              )}

              {currentView === 'leads' && (
                <LeadsView
                  leads={data.leads || []}
                  patients={data.patients || []}
                  onCreateLead={handleCreateLead}
                  onUpdateLead={handleUpdateLead}
                  onDeleteLead={handleDeleteLead}
                  onConvertLead={handleConvertLead}
                  onAIFollowup={handleAIFollowup}
                  onSyncSheet={handleSyncSheet}
                  onImportCSV={handleImportCSV}
                  onTriggerFullCycle={handleTriggerFullCycle}
                />
              )}

              {currentView === 'patients' && (
                <PatientsView
                  patients={data.patients || []}
                  appointments={data.appointments || []}
                  invoices={data.invoices || []}
                  onCreatePatient={handleCreatePatient}
                  onUpdatePatient={handleUpdatePatient}
                  onDeletePatient={handleDeletePatient}
                  onRecallPatient={handleRecallPatient}
                  onRunBatchRecall={handleRunBatchRecall}
                />
              )}

              {currentView === 'whatsapp' && (
                <WhatsAppSimulatorView
                  chats={data.chats || {}}
                  patients={data.patients || []}
                  leads={data.leads || []}
                  waLive={data.waLive}
                  doctorName="Dr. Raj"
                  onSendMessage={handleSendChatMessage}
                  onSimulateInbound={handleSimulateInboundChat}
                  onNavigateToAppointments={() => setCurrentView('appointments')}
                />
              )}

              {currentView === 'ai-copilot' && (
                <DentalAICopilotView prices={data.prices || {}} />
              )}

              {currentView === 'inventory' && (
                <InventoryView
                  inventory={data.inventory || []}
                  onCreateItem={handleCreateInventoryItem}
                  onUpdateItem={handleUpdateInventoryItem}
                  onDeleteItem={handleDeleteInventoryItem}
                />
              )}

              {currentView === 'billing' && (
                <BillingView
                  invoices={data.invoices || []}
                  patients={data.patients || []}
                  prices={data.prices || {}}
                  onCreateInvoice={handleCreateInvoice}
                  onPayInvoice={handlePayInvoice}
                />
              )}

              {currentView === 'settings' && (
                <SettingsView
                  settings={data.settings || {}}
                  prices={data.prices || {}}
                  automations={data.automations || {}}
                  waLive={data.waLive}
                  onSaveSettings={handleSaveSettings}
                  onRunAutomationTask={handleRunAutomationTask}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating Toast Alerts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: t.type === 'error' ? 'var(--rose)' : t.type === 'success' ? 'var(--emerald)' : 'var(--teal)'
            }} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
