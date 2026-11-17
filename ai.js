/**
 * DentaDesk AI Dental Clinical Agent & Copilot
 * Provides clinical symptom triage, smart patient recall optimization,
 * conversion-focused WhatsApp reply drafting, treatment planning, and clinic practice intelligence.
 *
 * Patient-facing communications adhere strictly to healthcare safety guidelines:
 * - Bot collects symptoms and concerns to flag urgency for clinical staff.
 * - No unsolicited drug dosing or automated clinical diagnoses sent to patients.
 * - Clinician-approved static guidance with appropriate medical disclaimers.
 */

const { getSetting } = require('./db');

const CLINICAL_CATEGORIES = {
  'toothache_severe': {
    urgency: 'URGENT',
    urgencyScore: 85,
    categoryName: 'Acute Tooth Pain / Pulpal Concern',
    recommendedService: 'Root canal',
    estimatedDuration: '45-60 mins',
    patientGuidance: 'Rinse gently with lukewarm water. Avoid hot, cold, or hard foods. Avoid applying heat or tablets directly against your gums. Our dental surgeon will examine you in person.',
    redFlags: 'Watch for facial swelling spreading to the eye or neck, or difficulty swallowing—seek emergency medical attention immediately.'
  },
  'swelling_facial': {
    urgency: 'EMERGENCY',
    urgencyScore: 98,
    categoryName: 'Facial Swelling / Potential Odontogenic Infection',
    recommendedService: 'Consultation',
    estimatedDuration: 'Immediate emergency triage',
    patientGuidance: 'Keep your head elevated. You may gently hold a cool compress outside your cheek. Do not apply hot packs. Prompt in-person dental evaluation is essential.',
    redFlags: 'Difficulty breathing, difficulty opening mouth (trismus), fever, or swelling extending into the eye or neck requires immediate emergency care.'
  },
  'broken_tooth': {
    urgency: 'URGENT',
    urgencyScore: 75,
    categoryName: 'Tooth Fracture / Dental Trauma',
    recommendedService: 'Filling',
    estimatedDuration: '30-45 mins',
    patientGuidance: 'If a broken piece is intact, preserve it in clean milk or water and bring it with you. Avoid chewing on that side. Cover sharp edges with dental wax or sugarless gum to protect your tongue and cheeks.',
    redFlags: 'Visible bleeding inside the tooth or throbbing pain may require urgent endodontic evaluation.'
  },
  'bleeding_gums': {
    urgency: 'ROUTINE',
    urgencyScore: 40,
    categoryName: 'Gingival / Periodontal Health',
    recommendedService: 'Cleaning',
    estimatedDuration: '30-40 mins',
    patientGuidance: 'Continue brushing gently with a soft-bristled toothbrush. You may rinse with warm salt water after meals. A professional scaling and exam will address the underlying cause.',
    redFlags: 'Loose teeth or persistent pus discharge indicates advanced periodontal concerns.'
  },
  'sensitivity_cold_sweet': {
    urgency: 'ROUTINE',
    urgencyScore: 45,
    categoryName: 'Dentin Hypersensitivity / Early Enamel Concern',
    recommendedService: 'Filling',
    estimatedDuration: '20-30 mins',
    patientGuidance: 'Avoid very hot, cold, acidic, or sweet foods. Use a soft brush with gentle circular motions. Our dentist will check for enamel wear or early cavities.',
    redFlags: 'Lingering pain lasting several minutes after cold exposure suggests pulpal inflammation.'
  },
  'wisdom_tooth_pain': {
    urgency: 'URGENT',
    urgencyScore: 70,
    categoryName: 'Third Molar / Wisdom Tooth Discomfort',
    recommendedService: 'Consultation',
    estimatedDuration: '30-45 mins',
    patientGuidance: 'Gently rinse with warm salt water after meals. Avoid chewing hard foods in that area.',
    redFlags: 'Inability to open mouth wider than two fingers or difficulty swallowing warrants immediate in-person review.'
  },
  'staining_yellow': {
    urgency: 'ROUTINE',
    urgencyScore: 20,
    categoryName: 'Cosmetic / Aesthetic Dental Care',
    recommendedService: 'Whitening',
    estimatedDuration: '45-60 mins',
    patientGuidance: 'Our clinic offers professional shade evaluation and gentle brightening procedures.',
    redFlags: 'None.'
  },
  'routine_checkup': {
    urgency: 'ROUTINE',
    urgencyScore: 15,
    categoryName: 'Preventive Oral Hygiene & Checkup',
    recommendedService: 'Checkup',
    estimatedDuration: '20-30 mins',
    patientGuidance: 'Routine checkups every 6 months keep your teeth healthy and catch cavities before they cause pain.',
    redFlags: 'None.'
  }
};

/**
 * Triage Patient Symptoms with robust word boundaries (no misfiring on 'Facebook', 'common cold', or 'fell')
 */
function triageSymptoms(symptomText = '') {
  const text = String(symptomText).toLowerCase();
  let matched = null;

  // Exact phrase and word-boundary matching to prevent false positives
  if (/\b(swelling|swollen|puffiness|facial\s*swelling|swollen\s*(face|cheek|jaw|gum|gums)|abscess|pus|fever\s*with\s*(tooth|pain))\b/i.test(text)) {
    matched = CLINICAL_CATEGORIES['swelling_facial'];
  } else if (/\b(wisdom\s*tooth|wisdom\s*teeth|pericoronitis|back\s*molar\s*pain|trismus|can'?t\s*open\s*mouth)\b/i.test(text)) {
    matched = CLINICAL_CATEGORIES['wisdom_tooth_pain'];
  } else if (/\b(sever\w*|throbb\w*|unbearab\w*|night\s*pain|shoot\w*\s*pain|sharp\s*throbbing|can'?t\s*sleep\s*pain|extreme\s*toothache)\b/i.test(text)) {
    matched = CLINICAL_CATEGORIES['toothache_severe'];
  } else if (/\b(broken|broke|cracked|chipped|fractur\w*|knocked\s*out|dental\s*trauma|trauma\s*to\s*(tooth|teeth|jaw)|fell\s*and\s*(hit|hurt|broke))\b/i.test(text)) {
    matched = CLINICAL_CATEGORIES['broken_tooth'];
  } else if (/\b(bleed\w*\s*gum|gums?\s*bleed\w*|spit\w*\s*blood|gingivit\w*|red\s*gum\w*|floss\w*\s*bleed\w*)\b/i.test(text)) {
    matched = CLINICAL_CATEGORIES['bleeding_gums'];
  } else if (/\b(sensitiv\w*|sensitive\s*to\s*(cold|hot|sweet)|cold\s*sensitivity|hot\s*sensitivity|twinge|ice\s*cream\s*pain)\b/i.test(text)) {
    matched = CLINICAL_CATEGORIES['sensitivity_cold_sweet'];
  } else if (/\b(yellow\w*|whiten\w*|stain\w*|dull\s*teeth|brown\s*spot\w*|brighten)\b/i.test(text)) {
    matched = CLINICAL_CATEGORIES['staining_yellow'];
  } else if (/\b(pain|ache|toothache|cavity|hurt\w*|decay\w*)\b/i.test(text)) {
    matched = CLINICAL_CATEGORIES['toothache_severe'];
  } else {
    matched = CLINICAL_CATEGORIES['routine_checkup'];
  }

  return {
    symptoms: symptomText,
    urgency: matched.urgency,
    urgencyScore: matched.urgencyScore,
    categoryName: matched.categoryName,
    recommendedService: matched.recommendedService,
    estimatedChairTime: matched.estimatedDuration,
    immediateHomeCare: matched.patientGuidance,
    redFlagsToWatch: matched.redFlags,
    timestamp: Date.now()
  };
}

/**
 * Smart Recall Optimizer
 */
function analyzeRecalls(patients = [], appointments = [], recallDaysLimit = 180) {
  const now = Date.now();
  const dayMs = 864e5;
  const overduePatients = [];

  for (const p of patients) {
    if (!p.lastVisit) continue;
    const visitDate = new Date(p.lastVisit.includes('T') ? p.lastVisit : p.lastVisit + 'T00:00');
    if (isNaN(visitDate.getTime())) continue;

    const daysSince = Math.floor((now - visitDate.getTime()) / dayMs);
    const targetThreshold = p.recallDays || recallDaysLimit;

    const hasUpcoming = appointments.some(a => a.patientId === p.id && a.status === 'Booked' && new Date(a.date + 'T23:59') >= now);
    if (hasUpcoming) continue;

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
      const draftMessage = `Hi ${firstName}! 😊 It has been ${daysSince} days since your last dental visit. Routine checkups keep your teeth healthy and prevent concerns from developing. We have open consultation slots this week. Reply BOOK to reserve your visit! 🦷`;

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
 * AI WhatsApp Reply Drafter for staff
 */
function draftWhatsAppReply(scenario, context = {}) {
  const name = (context.name || 'there').split(' ')[0];
  const service = context.service || 'consultation';
  const price = context.price ? `₹${context.price}` : 'competitive rates';

  switch (scenario) {
    case 'pain_fear':
      return `Hi ${name}, we completely understand dental visits can feel stressful! 🙏 Our clinic uses gentle, modern numbing techniques and quiet rotary instruments so you are completely at ease. Our team will walk you through every step comfortably. Would morning or afternoon suit you best for a gentle consultation? 🦷`;

    case 'price_inquiry':
      return `Hi ${name}! Thanks for inquiring about ${service}. Our standard pricing starts at approximately ${price}, which includes a comprehensive digital exam and consultation. Would you like to book a slot this week? Reply BOOK or let us know your preferred day! 😊`;

    case 'reschedule_prompt':
      return `Hi ${name}, no problem at all! We'd be glad to reschedule your appointment. We have slots open tomorrow and later this week. Please let us know whether mornings or afternoons suit you best, and we will update your slot right away. 👍`;

    case 'post_op_care':
      return `Hi ${name}! We hope you are resting comfortably after your treatment today. 🌟 Quick reminders: Keep biting firmly on the gauze for 45 minutes, avoid spitting or using a straw today, stick to soft, cool foods, and follow the instructions provided by your dentist. Reply here if you have any questions!`;

    case 'no_show_followup':
      return `Hi ${name}, we missed you today at your scheduled appointment! We hope everything is well. Your oral health is important to us—would you like to reschedule for tomorrow or later this week? Reply BOOK to choose an open slot. 🦷`;

    case 'lead_welcome':
    default:
      return `Hi ${name}! Thank you for reaching out. 🦷 What dental concern can we assist you with today? Reply BOOK to view available appointment slots!`;
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
    'Whitening': { visit: 1, chairTime: '50 min', phase: 'Cosmetic Bleaching' },
    'Root canal': { visit: 2, chairTime: '60 min', phase: 'Endodontic Therapy (2 Visits)' },
    'Ortho review': { visit: 1, chairTime: '30 min', phase: 'Orthodontic Assessment' }
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
    paymentOptions: ['Full Settlement (5% Courtesy)', 'Per-Visit Installments', '0% EMI Options Available']
  };
}

/**
 * Interactive Clinical Copilot Chat (for authorized clinic staff only)
 */
async function chatWithCopilot(userQuery = '', clinicData = {}) {
  const query = userQuery.toLowerCase().trim();

  if (/triage|pain|symptom|bleed|swell|broken|wisdom/.test(query)) {
    const triage = triageSymptoms(userQuery);
    return {
      reply: `🩺 **Clinical Triage Summary**\n\n` +
        `• **Urgency Level:** ${triage.urgency} (Score: ${triage.urgencyScore}/100)\n` +
        `• **Clinical Category:** ${triage.categoryName}\n` +
        `• **Suggested Procedure:** ${triage.recommendedService}\n` +
        `• **Estimated Duration:** ${triage.estimatedChairTime}\n\n` +
        `💡 **Patient Guidance Advice:**\n${triage.immediateHomeCare}\n\n` +
        `⚠️ **Red Flags:** ${triage.redFlagsToWatch}\n\n` +
        `*Clinical Decision Support only. A licensed clinician must examine patient before establishing diagnosis or treatment.*`,
      action: 'triage_completed',
      data: triage
    };
  }

  if (/recall|overdue|retention/.test(query)) {
    const recalls = analyzeRecalls(clinicData.patients || [], clinicData.appointments || []);
    return {
      reply: `🔄 **Recall Engine Summary**\n\n` +
        `Found **${recalls.totalOverdue} patient(s)** overdue for routine dental recall.\n` +
        `• High Priority: **${recalls.highPriorityCount}**\n\n` +
        `Use the Patients or Automations tab to review individual recall dispatches.`,
      action: 'recall_summary',
      data: recalls
    };
  }

  if (/antibiotic|amoxicillin|dosage|painkiller|ibuprofen|drug|medication/.test(query)) {
    return {
      reply: `💊 **Clinical Dental Pharmacology Reference (Clinician Reference Only)**\n\n` +
        `• **Odontogenic Pain Management:** First-line OTC options (e.g., NSAID or Paracetamol) taken according to manufacturer directions with food.\n` +
        `• **Antibiotic Stewardship:** Indicated only for acute spreading infections, systemic signs (fever, lymphadenopathy, cellulitis), or immunocompromised patients. Routine pulpitis or localized apical periodontitis does not warrant antibiotics.\n` +
        `• **Safety Checklist:** Verify patient allergies (especially beta-lactams), gastrointestinal history, kidney/liver function, and pregnancy status before prescribing any medication.\n\n` +
        `*⚠️ Strictly for licensed clinician reference. Never transmit unsupervised dosing instructions to patients via automated bots.*`,
      action: 'pharmacology_reference'
    };
  }

  return {
    reply: `👋 **DentaDesk AI Clinical Assistant**\n\n` +
      `Available clinical tools:\n` +
      `1. **Clinical Triage:** Describe symptoms (e.g., "swollen cheek and severe molar pain") to check urgency category.\n` +
      `2. **Recall Analysis:** Review patients overdue for routine hygiene.\n` +
      `3. **Staff Communication Drafter:** Draft personalized messages for patient inquiries.\n` +
      `4. **Treatment Plans:** Generate multi-stage estimates for procedures.`,
    action: 'general_help'
  };
}

/**
 * Lead Diagnostic & Concern Classifier for WhatsApp Bot
 * Collects symptoms, flags urgency internally, and returns clinician-approved static guidance (NO dosing, NO medical diagnosis).
 */
function analyzeLeadConcern(text = '', leadName = '') {
  const t = String(text || '').trim().toLowerCase();
  const firstName = (leadName || 'there').split(' ')[0];

  let queryText = text;
  if (/^1\b|^option\s*1/i.test(t)) {
    queryText = 'severe toothache cavity sensitive throbbing pain';
  } else if (/^2\b|^option\s*2/i.test(t)) {
    queryText = 'routine checkup dental cleaning tartar scaling hygiene';
  } else if (/^3\b|^option\s*3/i.test(t)) {
    queryText = 'missing tooth dental implant crown replacement broken tooth';
  } else if (/^4\b|^option\s*4/i.test(t)) {
    queryText = 'bleeding gums swollen gums bad breath sore gum';
  } else if (/^5\b|^option\s*5/i.test(t)) {
    queryText = 'crooked teeth invisible aligners braces teeth whitening';
  }

  const triage = triageSymptoms(queryText);
  const doctorName = getSetting('doctorName', 'Dr. Raj');
  const clinicName = getSetting('clinicName', 'DentaDesk Dental Care');

  // Safe patient-facing message: NO dosing, NO speculative diagnosis, clinician-approved home care
  const reply =
    `Thank you for letting us know, ${firstName}! 🦷\n\n` +
    `We have noted your concern for ${doctorName} and our clinical team at ${clinicName}.\n\n` +
    `💡 **Immediate Guidance:**\n` +
    `${triage.immediateHomeCare}\n\n` +
    `To ensure you receive the right care, our dental team will conduct a comprehensive in-person clinical examination. Here are our earliest available appointments:`;

  return {
    triage,
    reply,
    issueSummary: `${triage.categoryName} [${triage.urgency}] (${triage.recommendedService})`,
    recommendedService: triage.recommendedService,
    urgency: triage.urgency
  };
}

/**
 * Autonomous Multi-Stage Follow-up Generator for leads
 */
function generateAutonomousLeadFollowup(lead, clinicName = 'DentaDesk Dental Care', doctorName = 'Dr. Raj') {
  const firstName = (lead.name || 'there').split(' ')[0];
  const count = lead.followupCount || 0;
  const stage = lead.aiStage || 'INQUIRY_SENT';
  const issue = lead.clinicalIssue || 'dental care';

  if (stage === 'INQUIRY_SENT' || stage === 'NEW') {
    if (count <= 1) {
      return `Hi ${firstName}! Clinic desk here at ${clinicName}. 🦷\n\nWe wanted to quickly check in—are you experiencing any tooth discomfort or looking for a routine cleaning & checkup?\n\nSharing your dental concern helps our team prepare for you!`;
    }
    if (count === 2) {
      return `Hello ${firstName}! 😊 Quick tip from ${clinicName}: Dental concerns like cavities or gum irritation are easiest and least costly to address when examined early.\n\nWould you like a consultation slot this week? Reply YES to view available times! 🦷`;
    }
    return `Hi ${firstName}, we have a few priority consultation slots open with ${doctorName} this week. If you would like to reserve a time for your dental visit, reply BOOK anytime! 🦷`;
  }

  if (stage === 'SLOTS_OFFERED') {
    if (count <= 1) {
      return `Hi ${firstName}! Following up regarding your appointment at ${clinicName}. 🦷\n\nWe held open consultation slots for you. Would morning or afternoon suit your schedule better?`;
    }
    if (count === 2) {
      return `Hello ${firstName}! We want to ensure your dental concerns are addressed comfortably.\n\nIf the previous times did not fit your schedule, reply with your preferred day or time and we will find an open slot for you! 🦷`;
    }
    return `Hi ${firstName}, ${doctorName} is holding a few limited slots this week. Reply with your preferred time to confirm your visit, or call us if you have any questions! 🦷`;
  }

  return `Hi ${firstName}, greetings from ${clinicName}! Let us know if you need to schedule a dental visit or have any questions. Reply anytime! 🦷`;
}

module.exports = {
  CLINICAL_CATEGORIES,
  triageSymptoms,
  analyzeRecalls,
  draftWhatsAppReply,
  generateTreatmentPlan,
  chatWithCopilot,
  analyzeLeadConcern,
  generateAutonomousLeadFollowup
};
