const { test, describe } = require('node:test');
const assert = require('node:assert');

const core = require('../core');
const bot = require('../bot');
const ai = require('../ai');
const { db } = require('../db');

describe('Bot Booking Logic & Clinical Safety Tests', () => {

  test('findMatchingSlot does NOT auto-book on casual words if no slots were recently offered', () => {
    const casualWords = ['ok', 'fine', 'sure', 'yes', 'yeah', 'okay', 'yep'];
    for (const word of casualWords) {
      // Empty offered pool or no offeredAt timestamp
      const match = core.findMatchingSlot(word, [], null);
      assert.strictEqual(match, null, `Casual word "${word}" must not auto-book without offered slots`);

      // Expired offer (e.g., 20 minutes ago)
      const expiredTime = Date.now() - (20 * 60 * 1000);
      const sampleSlots = [{ date: '2026-11-20', time: '10:00' }];
      const expiredMatch = core.findMatchingSlot(word, sampleSlots, expiredTime);
      assert.strictEqual(expiredMatch, null, `Casual word "${word}" must not match expired slot offers`);
    }
  });

  test('findMatchingSlot auto-books priority slot when slots were offered within 15 minutes', () => {
    const sampleSlots = [
      { date: '2026-11-20', time: '10:00' },
      { date: '2026-11-20', time: '11:00' }
    ];
    const recentTime = Date.now() - (2 * 60 * 1000); // 2 minutes ago
    const match = core.findMatchingSlot('yes', sampleSlots, recentTime);

    assert.ok(match, 'Recent offer must match affirmative word');
    assert.strictEqual(match.date, '2026-11-20');
    assert.strictEqual(match.time, '10:00');
  });

  test('Date query with "next monday" matches date criteria, NOT more slots', () => {
    const query = 'next monday 10:00';
    // Test anchored regex from bot.js
    const isMoreSlots = /\b(more|next\s*(slots?|page|options?)|more\s*slots?)\b|^next$/i.test(query) &&
      !/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|week)\b/i.test(query);

    assert.strictEqual(isMoreSlots, false, '"next monday" must NOT trigger more slots pagination');

    const matched = core.findMatchingSlot(query, []);
    assert.ok(matched, 'Should match a slot for next Monday');
    assert.strictEqual(matched.time, '10:00');
  });

  test('AI triage regexes do NOT misfire on benign non-dental words', () => {
    // 1. "Facebook" should NOT match facial swelling
    const facebookTriage = ai.triageSymptoms('I saw your ad on Facebook');
    assert.notStrictEqual(facebookTriage.categoryName, 'Facial Swelling / Potential Odontogenic Infection');

    // 2. "common cold" should NOT match cold tooth sensitivity
    const coldTriage = ai.triageSymptoms('I have a common cold and cough');
    assert.notStrictEqual(coldTriage.categoryName, 'Dentin Hypersensitivity / Early Enamel Concern');

    // 3. "fell asleep" should NOT match broken tooth trauma
    const fellTriage = ai.triageSymptoms('I fell asleep early last night');
    assert.notStrictEqual(fellTriage.categoryName, 'Tooth Fracture / Dental Trauma');
  });

  test('AI triage accurately identifies genuine dental emergencies', () => {
    const swellingTriage = ai.triageSymptoms('My cheek has acute facial swelling and high fever');
    assert.strictEqual(swellingTriage.urgency, 'EMERGENCY');

    const brokenTriage = ai.triageSymptoms('My front tooth cracked and chipped after a dental trauma impact');
    assert.strictEqual(brokenTriage.urgency, 'URGENT');
  });

  test('Patient-facing messages NEVER contain drug doses or raw clinical diagnoses', () => {
    const assessment = ai.analyzeLeadConcern('severe throbbing toothache and cavity', 'Priya');

    // Must NOT contain pharmacological dosages
    assert.doesNotMatch(assessment.reply, /ibuprofen/i, 'Must not prescribe Ibuprofen');
    assert.doesNotMatch(assessment.reply, /paracetamol/i, 'Must not prescribe Paracetamol');
    assert.doesNotMatch(assessment.reply, /\d+mg/i, 'Must not specify milligram drug dosages');

    // Must NOT state presumptive medical diagnosis to patient
    assert.doesNotMatch(assessment.reply, /Acute Irreversible Pulpitis/i);
    assert.doesNotMatch(assessment.reply, /Odontogenic Abscess/i);

    // Must contain supportive static guidance
    assert.match(assessment.reply, /Immediate Guidance/i);
    assert.match(assessment.reply, /clinical examination/i);
  });
});
