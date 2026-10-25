/**
 * DentaDesk AI Dental Clinical Agent & Copilot
 * Provides clinical symptom triage, smart patient recall optimization,
 * conversion-focused WhatsApp reply drafting, treatment planning, and clinic intelligence.
 * Works 100% locally with deep clinical heuristics, with optional external LLM API integration.
 */

const CLINICAL_PROCEDURES = {
  'toothache_severe': {
    urgency: 'URGENT',
    urgencyScore: 85,
    diagnosis: 'Acute Irreversible Pulpitis / Apical Periodontitis',
    procedure: 'Root canal therapy or Pulp extirpation with Diagnostic X-ray (IOPA)',
    recommendedService: 'Root canal',
    estimatedDuration: '45-60 mins (Visit 1 of 2)',
    homeCare: 'Avoid hot/cold foods. Rinse with lukewarm water. Take prescribed OTC analgesic (e.g. Ibuprofen 400mg + Paracetamol 500mg after food). Do NOT apply aspirin or heat directly on the gum.',
    redFlags: 'Watch for facial swelling spreading to eye or neck, or difficulty swallowing—seek emergency care immediately.'
  },
  'swelling_facial': {
    urgency: 'EMERGENCY',
    urgencyScore: 98,
    diagnosis: 'Acute Odontogenic Abscess / Facial Space Infection',
    procedure: 'Emergency incision & drainage, pulp debridement or surgical extraction with antibiotic coverage',
    recommendedService: 'Root canal',
    estimatedDuration: 'Immediate emergency visit',
    homeCare: 'Apply a cold compress outside the cheek (15 mins on, 15 mins off). Do NOT use warm packs. Keep head elevated. Do not delay professional dental care.',
    redFlags: 'Difficulty breathing, difficulty opening mouth (trismus), fever, or swelling reaching under the eye or jaw.'
  },
  'broken_tooth': {
    urgency: 'URGENT',
    urgencyScore: 75,
    diagnosis: 'Uncomplicated or Complicated Crown Fracture',
    procedure: 'Composite resin aesthetic restoration, dental crown or pulp cap depending on pulp exposure',
    recommendedService: 'Filling',
    estimatedDuration: '30-45 mins',
    homeCare: 'If broken piece is found, store it in clean water or cold milk and bring it. Cover sharp edge with dental wax or sugarless chewing gum to protect cheek and tongue.',
    redFlags: 'Visible bleeding point inside the broken tooth indicates pulpal exposure needing root canal.'
  },
  'bleeding_gums': {
    urgency: 'ROUTINE',
    urgencyScore: 40,
    diagnosis: 'Chronic Marginal Gingivitis / Early Periodontitis',
    procedure: 'Ultrasonic Scaling & Polishing + Oral Hygiene Instructions + Chlorhexidine mouthwash',
    recommendedService: 'Cleaning',
    estimatedDuration: '30-40 mins',
    homeCare: 'Do NOT stop brushing; use an ultra-soft toothbrush with gentle circular strokes. Floss daily. Rinse with warm salt water twice daily for 5 days.',
    redFlags: 'Tooth mobility or foul taste/pus discharge indicates advanced periodontal bone loss.'
  },
  'sensitivity_cold_sweet': {
    urgency: 'ROUTINE',
    urgencyScore: 45,
    diagnosis: 'Dentin Hypersensitivity / Cervical Abrasion / Early Dental Caries',
    procedure: 'Tooth desensitizing fluoride varnish application or GIC/Composite cervical restoration',
    recommendedService: 'Filling',
    estimatedDuration: '20-30 mins',
    homeCare: 'Use potassium nitrate desensitizing toothpaste (apply with finger on sensitive spot for 2 mins before brushing). Avoid acidic beverages and hard bristle brushes.',
    redFlags: 'Lingering pain lasting more than 30 seconds after cold stimulus indicates pulpal inflammation.'
  },
  'wisdom_tooth_pain': {
    urgency: 'URGENT',
    urgencyScore: 70,
    diagnosis: 'Acute Pericoronitis of Impacted Third Molar',
    procedure: 'Operculectomy, local debridement with betadine irrigation or Surgical Disimpaction',
    recommendedService: 'Consultation',
    estimatedDuration: '30 mins initial relief, 45 mins if extraction scheduled',
    homeCare: 'Gentle warm salt water mouth baths every 3 hours. Do not chew hard foods on that side.',
    redFlags: 'Inability to open mouth wider than 2 fingers or difficulty swallowing.'
  },
  'staining_yellow': {
    urgency: 'ROUTINE',
    urgencyScore: 20,
    diagnosis: 'Extrinsic Enamel Staining / Discoloration',
    procedure: 'In-office Dental Bleaching (Laser/LED Whitening) or Air polishing',
    recommendedService: 'Whitening',
    estimatedDuration: '45-60 mins',
    homeCare: 'Avoid dark tea, coffee, wine, and smoking for 48 hours post-whitening.',
    redFlags: 'None.'
  },
  'routine_checkup': {
    urgency: 'ROUTINE',
    urgencyScore: 15,
    diagnosis: 'Preventive Health Assessment',
    procedure: 'Comprehensive oral examination, intraoral camera screening, periodontal probing, scaling',
    recommendedService: 'Checkup',
    estimatedDuration: '20-30 mins',
    homeCare: 'Maintain twice daily brushing and daily flossing.',
    redFlags: 'None.'
  }
};

/**
 * Triage Patient Symptoms
 */
function triageSymptoms(symptomText = '') {
  const text = String(symptomText).toLowerCase();
  let matched = null;

  if (/swell|puff|face|eye|abscess|pus|fever|lump/.test(text)) {
    matched = CLINICAL_PROCEDURES['swelling_facial'];
  } else if (/wisdom|pericoron|back molar|jaw hinge|trismus|can'?t open/.test(text)) {
    matched = CLINICAL_PROCEDURES['wisdom_tooth_pain'];
  } else if (/sever|throbb|unbearab|night pain|shoot|pulpat|sharp throbbing|can'?t sleep/.test(text)) {
    matched = CLINICAL_PROCEDURES['toothache_severe'];
  } else if (/broke|crack|chipp|fractur|knocked|fall|fell|trauma/.test(text)) {
    matched = CLINICAL_PROCEDURES['broken_tooth'];
  } else if (/bleed|spit blood|gum|gingiv|red gum|floss blood/.test(text)) {
    matched = CLINICAL_PROCEDURES['bleeding_gums'];
  } else if (/sensitiv|cold|hot|sweet|twinge|ice cream/.test(text)) {
    matched = CLINICAL_PROCEDURES['sensitivity_cold_sweet'];
  } else if (/yellow|whiten|stain|dull|brown spot|bright/.test(text)) {
    matched = CLINICAL_PROCEDURES['staining_yellow'];
  } else if (/pain|ache|hurt|cavity/.test(text)) {
    matched = CLINICAL_PROCEDURES['toothache_severe'];
  } else {
    matched = CLINICAL_PROCEDURES['routine_checkup'];
  }

  return {
    symptoms: symptomText,
    urgency: matched.urgency,
    urgencyScore: matched.urgencyScore,
    probableDiagnosis: matched.diagnosis,
    recommendedProcedure: matched.procedure,
    recommendedService: matched.recommendedService,
    estimatedChairTime: matched.estimatedDuration,
    immediateHomeCare: matched.homeCare,
    redFlagsToWatch: matched.redFlags,
    timestamp: Date.now()
  };
}

/**
 * Smart Recall Optimizer:
 * Analyzes all patients to find who is overdue, categorizes clinical risk,
 * and generates high-converting WhatsApp recall messages.
 */
function analyzeRecalls(patients = [], appointments = [], recallDaysLimit = 180) {
  const now = Date.now();
  const dayMs = 864e5;
  const overduePatients = [];

  for (const p of patients) {
    if (!p.lastVisit) {
      // Patients with no recorded visit date might be new or need initial hygiene baseline
      continue;
    }
    const visitDate = new Date(p.lastVisit.includes('T') ? p.lastVisit : p.lastVisit + 'T00:00');
    if (isNaN(visitDate.getTime())) continue;

    const daysSince = Math.floor((now - visitDate.getTime()) / dayMs);
    const targetThreshold = p.recallDays || recallDaysLimit;

    // Has an upcoming booked appointment?
    const hasUpcoming = appointments.some(a => a.patientId === p.id && a.status === 'Booked' && new Date(a.date + 'T23:59') >= now);
    if (hasUpcoming) continue;

    // Already recalled in past 21 days?
    const daysSinceRecall = p.recalledAt ? Math.floor((now - p.recalledAt) / dayMs) : 999;
    const isOverdue = daysSince >= targetThreshold;

    let priority = 'Normal';
    let suggestedService = 'Checkup';
    let pitchReason = 'Routine 6-month preventive checkup and dental cleaning';

    if (p.lastService === 'Root canal') {
      priority = 'High';
      suggestedService = 'Checkup';
      pitchReason = 'Post-Root Canal crown assessment & apical healing review';
    } else if (p.lastService === 'Cleaning' && daysSince >= 180) {
      priority = 'Medium';
      suggestedService = 'Cleaning';
      pitchReason = 'Calculus & tartar re-accumulation prevention';
    } else if (daysSince >= 365) {
      priority = 'High';
      suggestedService = 'Checkup';
      pitchReason = 'Over 1 year since last dental checkup';
    }

    if (isOverdue) {
      const firstName = (p.name || 'Patient').split(' ')[0];
      const draftMessage = `Hi ${firstName}! 😊 It has been ${daysSince} days since your last dental visit for ${p.lastService || 'checkup'}. Regular checkups keep your teeth healthy and prevent cavities from growing. We have open consultation slots this week at DentaDesk. Reply BOOK to reserve your convenient time! 🦷`;

      overduePatients.push({
        patientId: p.id,
        name: p.name,
        phone: p.phone,
        lastVisit: p.lastVisit,
        lastService: p.lastService || 'Checkup',
        daysSinceVisit: daysSince,
        daysOverdue: daysSince - targetThreshold,
        priority,
        suggestedService,
        pitchReason,
        recalledAt: p.recalledAt,
        daysSinceLastRecall: daysSinceRecall === 999 ? 'Never' : `${daysSinceRecall} days ago`,
        suggestedMessage: draftMessage
      });
    }
  }

  // Sort by days overdue descending and priority
  overduePatients.sort((a, b) => {
    const pWeight = { High: 3, Medium: 2, Normal: 1 };
    return (pWeight[b.priority] * 1000 + b.daysOverdue) - (pWeight[a.priority] * 1000 + a.daysOverdue);
  });

  return {
    totalOverdue: overduePatients.length,
    highPriorityCount: overduePatients.filter(x => x.priority === 'High').length,
    patients: overduePatients
  };
}

/**
 * AI WhatsApp Reply Drafter
 */
function draftWhatsAppReply(scenario, context = {}) {
  const name = (context.name || 'there').split(' ')[0];
  const service = context.service || 'consultation';
  const price = context.price ? `₹${context.price}` : 'competitive rates';

  switch (scenario) {
    case 'pain_fear':
      return `Hi ${name}, we completely understand dental visits can feel stressful! 🙏 Our clinic uses gentle, modern numbing techniques and painless rotary tools so you won't feel discomfort. Dr. and our team will walk you through every step comfortably. Would morning or afternoon suit you best for a quick gentle check? 🦷`;

    case 'price_inquiry':
      return `Hi ${name}! Thanks for inquiring about ${service}. Our standard package starts at approximately ${price}, which includes a comprehensive digital exam and personalized consultation. Would you like to book a quick slot this week to evaluate your teeth? Reply BOOK or let us know your preferred day! 😊`;

    case 'reschedule_prompt':
      return `Hi ${name}, no problem at all! We'd be glad to reschedule your appointment. We have slots open tomorrow and later this week. Please reply with whether mornings or evenings work better for you, and we will lock in your slot right away. 👍`;

    case 'post_op_care':
      return `Hi ${name}! We hope you are resting comfortably after your treatment today. 🌟 Quick reminders: Keep biting firmly on the gauze for 45 minutes, avoid spitting or using a straw today, stick to soft, cool foods, and take your prescribed medication on time. If you have any questions, reply here anytime!`;

    case 'no_show_followup':
      return `Hi ${name}, we missed you today at your scheduled appointment! We hope everything is okay. Your oral health is important to us—would you like to reschedule for tomorrow or this weekend? Reply BOOK to choose a fresh time slot. 🦷`;

    case 'lead_welcome':
    default:
      return `Hi ${name}! Thank you for reaching out to DentaDesk Dental Clinic. 🦷 We are currently offering complimentary digital consultations for new patients. What dental concern can we assist you with today? Reply BOOK to see available appointment slots!`;
  }
}

/**
 * Treatment Plan & Multi-Stage Cost Estimator
 */
function generateTreatmentPlan(selectedServices = [], prices = {}, patientNotes = '') {
  let totalAmount = 0;
  const stages = [];

  const visitMap = {
    'Checkup': { visit: 1, chairTime: '20 min', phase: 'Diagnostic & Examination' },
    'Cleaning': { visit: 1, chairTime: '35 min', phase: 'Oral Prophylaxis & Hygiene' },
    'Consultation': { visit: 1, chairTime: '20 min', phase: 'Clinical Consultation' },
    'Filling': { visit: 1, chairTime: '35 min', phase: 'Restorative Restoration' },
    'Whitening': { visit: 1, chairTime: '50 min', phase: 'Cosmetic Aesthetic Bleaching' },
    'Root canal': { visit: 2, chairTime: '50 min', phase: 'Endodontic Therapy (2-3 Visits)' },
    'Ortho review': { visit: 1, chairTime: '30 min', phase: 'Orthodontic & Aligner Assessment' }
  };

  selectedServices.forEach((service, index) => {
    const cost = prices[service] || 500;
    totalAmount += cost;
    const meta = visitMap[service] || { visit: 1, chairTime: '30 min', phase: 'General Dental Procedure' };

    stages.push({
      stepNumber: index + 1,
      service,
      phase: meta.phase,
      recommendedVisit: `Visit ${meta.visit}`,
      chairTime: meta.chairTime,
      cost
    });
  });

  return {
    totalEstimate: totalAmount,
    numberOfProcedures: selectedServices.length,
    planSummary: stages,
    patientNotes: patientNotes || 'No specific contraindications recorded.',
    paymentOptions: ['Single Payment (5% Courtesy)', 'Per-Visit Installments', '0% EMI Options Available']
  };
}

/**
 * Interactive Dental AI Copilot Chat
 */
async function chatWithCopilot(userQuery = '', clinicData = {}) {
  const query = userQuery.toLowerCase().trim();

  // If external API key is configured in .env (e.g. GEMINI_API_KEY or OPENAI_API_KEY), we could optionally forward.
  // For instant, resilient, local execution with zero latency, we provide a rich clinical AI reasoning engine:
  if (/triage|pain|symptom|bleed|swell|broken|wisdom/.test(query)) {
    const triage = triageSymptoms(userQuery);
    return {
      reply: `🩺 **Clinical Triage Assessment**\n\n` +
        `• **Urgency Level:** ${triage.urgency} (Score: ${triage.urgencyScore}/100)\n` +
        `• **Likely Condition:** ${triage.probableDiagnosis}\n` +
        `• **Recommended In-Clinic Procedure:** ${triage.recommendedProcedure}\n` +
        `• **Estimated Chair Time:** ${triage.estimatedChairTime}\n\n` +
        `💡 **Immediate Home Care Advice:**\n${triage.immediateHomeCare}\n\n` +
        `⚠️ **Red Flags:** ${triage.redFlagsToWatch}`,
      action: 'triage_completed',
      data: triage
    };
  }

  if (/recall|overdue|retention/.test(query)) {
    const recalls = analyzeRecalls(clinicData.patients || [], clinicData.appointments || []);
    return {
      reply: `🔄 **AI Recall Engine Status**\n\n` +
        `Found **${recalls.totalOverdue} patient(s)** overdue for routine dental recall.\n` +
        `• High Priority Patients: **${recalls.highPriorityCount}**\n\n` +
        `Top recommendation: Send batch WhatsApp recall to re-engage patients whose last cleaning or checkup was over 6 months ago. Click "Run Recall Now" on the dashboard or use the Patients tab to review individual messages.`,
      action: 'recall_summary',
      data: recalls
    };
  }

  if (/antibiotic|amoxicillin|dosage|painkiller|ibuprofen|drug|medication/.test(query)) {
    return {
      reply: `💊 **Clinical Dental Pharmacology Guidelines**\n\n` +
        `• **First-Line Analgesic:** Ibuprofen 400mg + Paracetamol 500mg taken together every 6-8 hours with food (superior synergy for odontogenic pain).\n` +
        `• **First-Line Odontogenic Antibiotic:** Amoxicillin 500mg TID (3 times/day) for 5 days. For penicillin-allergic patients: Clindamycin 300mg QID or Azithromycin 500mg OD.\n` +
        `• **Antibiotic Prophylaxis (Infective Endocarditis risk):** Single dose Amoxicillin 2g orally 30-60 mins prior to invasive dental procedure.\n` +
        `*Always verify patient renal function, allergies, and pregnancy status.*`,
      action: 'pharmacology_reference'
    };
  }

  if (/revenue|kpi|growth|marketing|conversion|ad/.test(query)) {
    const totalLeads = (clinicData.leads || []).length;
    const bookedLeads = (clinicData.leads || []).filter(l => ['Booked', 'Won'].includes(l.status)).length;
    const convRate = totalLeads ? Math.round((bookedLeads / totalLeads) * 100) : 0;

    return {
      reply: `📈 **Clinic Practice Intelligence & Growth Insights**\n\n` +
        `• **Lead Conversion Rate:** ${convRate}% (${bookedLeads} booked out of ${totalLeads} total leads)\n` +
        `• **Key Growth Levers:**\n` +
        `  1. **Speed to Lead:** Responding to Meta/Google leads within 5 minutes increases booking rates by 390%. Keep WhatsApp auto-engage active!\n` +
        `  2. **Active Recalls:** Every recall converted brings ~₹1,200 to ₹6,500 in hygiene and restorative revenue.\n` +
        `  3. **No-Show Mitigation:** 24h automated reminders have been shown to cut clinic no-shows by 65%.`,
      action: 'growth_intelligence'
    };
  }

  // Fallback intelligent clinical answer
  return {
    reply: `👋 **DentaDesk Dental AI Assistant at your service!**\n\n` +
      `Here is how I can assist your clinic right now:\n` +
      `1. **Clinical Triage:** Type any patient symptoms (e.g., *"sharp throbbing molar pain"* or *"swollen lower jaw"*) for triage advice.\n` +
      `2. **Recall Management:** Ask *"Who is due for recall?"* to scan your database.\n` +
      `3. **WhatsApp Drafting:** Ask *"Draft reply for dental fear"* or *"Cost inquiry message"*.\n` +
      `4. **Drug Dosages:** Ask about dental antibiotics, painkillers, or post-extraction protocols.\n` +
      `5. **Revenue & Lead Tips:** Ask how to improve ad conversion and lower clinic no-shows.`,
    action: 'general_help'
  };
}

/**
 * Lead Diagnostic & Symptom Classifier
 * Translates numeric options (1-5) or free-form text from prospective leads
 * into clinical diagnosis, procedure recommendation, and empathetic WhatsApp copy.
 */
function analyzeLeadConcern(text = '', leadName = '') {
  const t = String(text || '').trim().toLowerCase();
  const firstName = (leadName || 'there').split(' ')[0];

  // Map numeric quick replies to clinical symptom descriptions
  let queryText = text;
  if (/^1\b|^option\s*1/i.test(t)) {
    queryText = 'severe toothache cavity sensitive to cold and hot throbbing pain';
  } else if (/^2\b|^option\s*2/i.test(t)) {
    queryText = 'routine checkup dental cleaning tartar scaling stains hygiene';
  } else if (/^3\b|^option\s*3/i.test(t)) {
    queryText = 'missing tooth dental implant crown replacement broken tooth';
  } else if (/^4\b|^option\s*4/i.test(t)) {
    queryText = 'bleeding gums gingivitis swollen gums bad breath sore gum';
  } else if (/^5\b|^option\s*5/i.test(t)) {
    queryText = 'crooked teeth invisible aligners braces teeth whitening smile design';
  }

  const triage = triageSymptoms(queryText);

  const reply =
    `Thank you for letting us know, ${firstName}! 🦷\n\n` +
    `🩺 **Clinical Assessment:** ${triage.probableDiagnosis}\n` +
    `• **Recommended Procedure:** ${triage.recommendedProcedure}\n` +
    `• **Urgency:** ${triage.urgency}\n` +
    `💡 **Immediate Home Advice:** ${triage.immediateHomeCare}\n\n` +
    `Let's get this examined by Dr. Raj at DentaDesk before it worsens. Here are our earliest available appointments:`;

  return {
    triage,
    reply,
    issueSummary: `${triage.probableDiagnosis} (${triage.recommendedService})`,
    recommendedService: triage.recommendedService
  };
}

/**
 * Autonomous Multi-Stage Follow-up Generator
 * Generates context-aware, empathetic WhatsApp follow-up messages for leads who haven't finished booking.
 */
function generateAutonomousLeadFollowup(lead, clinicName = 'DentaDesk Dental Care') {
  const firstName = (lead.name || 'there').split(' ')[0];
  const count = lead.followupCount || 0;
  const stage = lead.aiStage || 'INQUIRY_SENT';
  const issue = lead.clinicalIssue || 'dental care';

  if (stage === 'INQUIRY_SENT' || stage === 'NEW') {
    if (count <= 1) {
      return `Hi ${firstName}! Dr. Raj's clinic desk here at ${clinicName}. 🦷\n\nWe wanted to quickly check in—are you experiencing any tooth pain, sensitivity, or looking for a routine teeth cleaning?\n\nReplying with your dental concern helps our team prepare for you so we can give you the best care!`;
    }
    if (count === 2) {
      return `Hello ${firstName}! 😊 Quick tip from ${clinicName}: Dental issues like tooth decay or bleeding gums are easiest and least costly to treat when caught early.\n\nWould you like a quick 15-minute consultation slot this week? Reply YES to see available times! 🦷`;
    }
    return `Hi ${firstName}, we have a few priority dental exam slots open with Dr. Raj tomorrow. If you'd like to reserve a time for your teeth checkup, reply BOOK anytime! 🦷`;
  }

  if (stage === 'SLOTS_OFFERED') {
    if (count <= 1) {
      return `Hi ${firstName}! Following up regarding your ${issue} at ${clinicName}. 🦷\n\nWe held open consultation slots for you tomorrow. Would a morning (10:00 AM) or afternoon (2:00 PM) slot suit your schedule better?`;
    }
    if (count === 2) {
      return `Hello ${firstName}! We want to ensure your ${issue} gets resolved comfortably before it worsens.\n\nIf the earlier times didn't fit your day, let us know what day or time works best and our AI agent will find an open slot for you! 🦷`;
    }
    return `Hi ${firstName}, Dr. Raj is holding a few limited slots for ${issue} this week. Reply with your preferred time to confirm your visit, or call us if you have any questions! 🦷`;
  }

  return `Hi ${firstName}, greetings from ${clinicName}! Let us know if you need to schedule a dental visit or have any questions about your teeth. Reply anytime! 🦷`;
}

module.exports = {
  CLINICAL_PROCEDURES,
  triageSymptoms,
  analyzeRecalls,
  draftWhatsAppReply,
  generateTreatmentPlan,
  chatWithCopilot,
  analyzeLeadConcern,
  generateAutonomousLeadFollowup
};
