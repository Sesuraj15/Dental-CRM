// API Client for DentaDesk AI Backend
const API_BASE = '';

export const getToken = () => localStorage.getItem('dentadesk_token') || '';
export const setToken = (t) => {
  if (t) localStorage.setItem('dentadesk_token', t);
  else localStorage.removeItem('dentadesk_token');
};

export async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      // Unauthorized
      localStorage.removeItem('dentadesk_token');
    }
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: async (username, password) => {
    const res = await request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) setToken(res.token);
    return res;
  },
  logout: () => setToken(''),

  // Bootstrap
  bootstrap: () => request('/api/bootstrap'),

  // Patients
  createPatient: (data) => request('/api/patients', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id, data) => request(`/api/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePatient: (id) => request(`/api/patients/${id}`, { method: 'DELETE' }),
  recallPatient: (id, message) => request(`/api/patients/${id}/recall`, { method: 'POST', body: JSON.stringify({ message }) }),
  getRecallDue: () => request('/api/recall/due'),
  runRecallBatch: (thresholdDays) => request('/api/recall/run', { method: 'POST', body: JSON.stringify({ thresholdDays }) }),

  // Appointments
  createAppointment: (data) => request('/api/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id, data) => request(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAppointment: (id) => request(`/api/appointments/${id}`, { method: 'DELETE' }),
  getSlots: (date) => request(`/api/slots?date=${encodeURIComponent(date)}`),

  // Leads
  createLead: (data) => request('/api/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id, data) => request(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLead: (id) => request(`/api/leads/${id}`, { method: 'DELETE' }),
  convertLead: (id, apptData) => request(`/api/leads/${id}/convert`, { method: 'POST', body: JSON.stringify(apptData || {}) }),
  engageLead: (id) => request(`/api/leads/${id}/engage`, { method: 'POST' }),
  aiFollowupLead: (id) => request(`/api/leads/${id}/ai-followup`, { method: 'POST' }),
  syncSheet: () => request('/api/leads/sync-sheet', { method: 'POST' }),
  importLeadsCSV: (text) => request('/api/leads/import', { method: 'POST', body: JSON.stringify({ text }) }),

  // Inventory
  createInventoryItem: (data) => request('/api/inventory', { method: 'POST', body: JSON.stringify(data) }),
  updateInventoryItem: (id, data) => request(`/api/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteInventoryItem: (id) => request(`/api/inventory/${id}`, { method: 'DELETE' }),

  // Invoices
  createInvoice: (data) => request('/api/invoices', { method: 'POST', body: JSON.stringify(data) }),
  payInvoice: (id, method) => request(`/api/invoices/${id}/pay`, { method: 'PATCH', body: JSON.stringify({ method }) }),

  // Settings
  getSettings: () => request('/api/settings'),
  updateSettings: (payload) => request('/api/settings', { method: 'PATCH', body: JSON.stringify(payload) }),

  // WhatsApp & Chats
  sendChatMessage: (phone, text) => request(`/api/chats/${phone}/send`, { method: 'POST', body: JSON.stringify({ text }) }),
  simulateInboundChat: (payload) => request('/api/chats/simulate', { method: 'POST', body: JSON.stringify(payload) }),
  getWAStatus: () => request('/api/wa/status'),
  testWAText: (phone, text) => request('/api/wa/test', { method: 'POST', body: JSON.stringify({ phone, text }) }),

  // Automations
  getAutomations: () => request('/api/automations'),
  runAutomation: (task) => request(`/api/automations/run/${task}`, { method: 'POST' }),

  // AI Copilot
  aiTriage: (symptoms) => request('/api/ai/triage', { method: 'POST', body: JSON.stringify({ symptoms }) }),
  aiRecallOptimizer: (recallDays) => request('/api/ai/recall-optimizer', { method: 'POST', body: JSON.stringify({ recallDays }) }),
  aiTreatmentPlan: (services, notes) => request('/api/ai/treatment-plan', { method: 'POST', body: JSON.stringify({ services, notes }) }),
  aiChat: (message) => request('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message }) })
};
