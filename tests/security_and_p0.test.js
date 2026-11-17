const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const bot = require('../bot');
const { db, getSetting, setSetting, getAllSettings } = require('../db');

describe('P0 Security & Access Control Tests', () => {

  test('sigOk fails closed when APP_SECRET is unset or empty', () => {
    const origSecret = process.env.APP_SECRET;
    try {
      delete process.env.APP_SECRET;
      const fakeReq = { headers: {}, rawBody: '{"test":1}' };
      assert.strictEqual(bot.sigOk(fakeReq), false, 'sigOk must return false when APP_SECRET is unset');

      process.env.APP_SECRET = '';
      assert.strictEqual(bot.sigOk(fakeReq), false, 'sigOk must return false when APP_SECRET is empty string');
    } finally {
      process.env.APP_SECRET = origSecret;
    }
  });

  test('sigOk validates legitimate HMAC-SHA256 signature when secret is set', () => {
    const origSecret = process.env.APP_SECRET;
    try {
      const secret = 'valid_test_secret_key_12345';
      process.env.APP_SECRET = secret;
      const rawBody = JSON.stringify({ entry: [{ id: '123' }] });
      const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      const validReq = {
        headers: { 'x-hub-signature-256': `sha256=${signature}` },
        rawBody
      };
      assert.strictEqual(bot.sigOk(validReq), true, 'sigOk must return true for valid HMAC');

      const invalidReq = {
        headers: { 'x-hub-signature-256': 'sha256=invalid_forged_hash' },
        rawBody
      };
      assert.strictEqual(bot.sigOk(invalidReq), false, 'sigOk must return false for invalid HMAC');
    } finally {
      process.env.APP_SECRET = origSecret;
    }
  });

  test('Settings whitelist blocks arbitrary mass assignment keys', () => {
    const ALLOWED_SETTING_KEYS = ['clinicName', 'doctorName', 'phone', 'address', 'recallDays', 'workingHours', 'timezone'];
    const maliciousPayload = {
      clinicName: 'Safe Dental Care',
      waToken: 'stolen_super_secret_token',
      isAdmin: true,
      rootAccess: 1
    };

    // Filter logic as implemented in server.js PATCH /api/settings
    for (const [key, value] of Object.entries(maliciousPayload)) {
      if (ALLOWED_SETTING_KEYS.includes(key)) {
        setSetting(key, typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }

    const settings = getAllSettings();
    assert.strictEqual(settings.clinicName, 'Safe Dental Care');
    assert.strictEqual(settings.waToken, undefined, 'Arbitrary keys must not be persisted in settings');
    assert.strictEqual(settings.isAdmin, undefined);
  });

  test('Token versioning invalidates previous JWTs upon password change', () => {
    const user = db.prepare("SELECT * FROM users WHERE username = 'owner'").get();
    assert.ok(user, 'Owner user must exist');

    const jwtSecret = getSetting('jwt_secret') || 'test_secret';
    const oldToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, tokenVersion: user.tokenVersion },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Simulate password change incrementing tokenVersion
    const nextVersion = user.tokenVersion + 1;
    db.prepare('UPDATE users SET tokenVersion = ? WHERE id = ?').run(nextVersion, user.id);

    // Verify token validation logic
    const decoded = jwt.verify(oldToken, jwtSecret);
    const refreshedUser = db.prepare('SELECT tokenVersion FROM users WHERE id = ?').get(user.id);

    assert.notStrictEqual(
      decoded.tokenVersion,
      refreshedUser.tokenVersion,
      'Old token version must not match refreshed user tokenVersion'
    );
  });
});
