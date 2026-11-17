# DentaDesk: Dental Clinic CRM & ERP with WhatsApp Auto-Booking & AI Triage

Production-ready Dental Clinic Management System built for dental practices. Features patient records, appointment scheduling, billing, multi-role RBAC, WhatsApp automated booking, 24-hour reminders, 6-month hygiene recalls, and lead ingestion from Meta Ads, Google Ads, and spreadsheets.

---

## 1. Quick Start

```bash
npm install
npm run build             # Builds client into public/
npm test                  # Runs unit & security tests
npm start                 # Starts server on http://localhost:3000
```

On first start, credentials are read from `.env` or generated and stored securely in SQLite.
Without `WA_TOKEN` and `WA_PHONE_ID`, the system runs safely in **dry-run mode**: all WhatsApp messages are simulated, logged with delivery status in SQLite, and inspectable in the practice portal.

### Docker Run
```bash
docker build -t dentadesk .
docker run -p 3000:3000 --env-file .env -v $(pwd)/data:/app/data dentadesk
```

---

## 2. Security & Compliance Architecture (P0 Addressed)

- **Fail-Closed Webhook Verification**: Meta webhooks strictly verify HMAC-SHA256 signatures (`x-hub-signature-256`) against `APP_SECRET`. Unset secrets fail closed (401/403).
- **Generic Webhook Auth**: Timing-safe verification of `x-api-key` against `GENERIC_API_KEY`. Unset keys, empty keys, or default `"change-me"` values fail closed.
- **Production Boot Lockout**: If `NODE_ENV=production`, the server halts startup if required secrets (`APP_SECRET`, `WA_VERIFY_TOKEN`, `GENERIC_API_KEY`, `JWT_SECRET`) are missing or set to defaults.
- **Role-Based Access Control (RBAC)**:
  - `Owner`: Full access to clinic settings, user management, audit logs, billing, financial metrics, and record deletions.
  - `Doctor`: Clinical access, patient history, appointment scheduling, treatment plans, clinical notes, and invoice creation.
  - `Admin` / `Receptionist`: Patient check-in, appointment management, inventory tracking, and lead outreach (cost/financial fields stripped).
- **Secret Protection & Mass Assignment Guard**: Settings routes strictly whitelist allowable keys (`clinicName`, `doctorName`, `phone`, `address`, `recallDays`, `workingHours`, `timezone`). Secrets are kept strictly in environment variables.
- **JWT Invalidation**: Password changes increment `tokenVersion`, instantly invalidating previous active tokens.
- **Consent & STOP / Opt-Out Compliance**:
  - Per-patient consent recording (`consentGivenAt`, `consentSource`).
  - Automated STOP / UNSUBSCRIBE handling immediately flags `optOut = 1` and stops all marketing and automated reminders.
- **Audit Trail & Soft Deletion**: Every mutation (create, edit, soft-delete, login) is recorded in `audit_logs`.

---

## 3. Clinical Safety & Bot Intelligence

- **No Patient-Facing Dosing or Medical Diagnoses**: The WhatsApp bot collects symptoms solely to flag urgency internally (`ROUTINE`, `URGENT`, `EMERGENCY`) and route to clinic staff. All patient-facing responses provide static, clinician-approved home care advice and appointment booking with Dr. Raj. Prescriptive drug dosages (e.g. Ibuprofen/Paracetamol) and specific diagnoses are never sent to patients.
- **Robust Regex Boundary Matching**: Prevents false positive clinical matches on benign words (e.g., "Facebook" does not trigger facial swelling; "common cold" does not trigger enamel sensitivity; "fell asleep" does not trigger trauma fracture).
- **Auto-Booking Safeguards**:
  - Casual words ("ok", "yes", "sure", "fine") only auto-book if slots were explicitly offered to the user in the last 15 minutes.
  - Anchored slot requests prevent "next Monday" from triggering pagination.
  - Cancellation confirmation: Texting "cancel" prompts the patient to confirm (`YES CANCEL`) before releasing their appointment.

---

## 4. WhatsApp Cloud API & 24-Hour Window

1. **Meta Cloud API Setup**: Set `WA_TOKEN`, `WA_PHONE_ID`, `APP_SECRET`, and `WA_VERIFY_TOKEN` in `.env`.
2. **Template Compliance**:
   - First-time outreach and messages outside the Meta 24-hour customer service window automatically use pre-approved templates (`lead_welcome`, `recall_checkup`, `appointment_reminder`).
   - Free-text and interactive buttons are used only within the active 24-hour window.
3. **Delivery Status Tracking**: Messages are logged in SQLite only after delivery confirmation (`sent`, `delivered`, `failed`, or `dry_run`).

---

## 5. Storage & Database (SQLite Migration)

- High-performance SQLite database via Node's native `DatabaseSync` engine (`data/dentadesk.sqlite`).
- Structured relational schema with foreign keys, indexes, and WAL journal mode (`PRAGMA journal_mode = WAL`).
- Automatic daily backups in `data/backups/`.
- Safe signal handlers for both `SIGINT` and `SIGTERM`.
- Deduplicated billing and inventory: completing an appointment raises exactly one invoice and deducts inventory strictly according to the service's bill of materials (e.g., Cleaning does not deduct anaesthetic cartridges).
- Lead protection: imported Google Sheet rows are tracked by SHA-256 hash to prevent deleted leads from being re-imported.

---

## 6. Attribution & Conversions API

- Captures Meta `campaign_id`, `ad_id`, `form_id` and Google `gclid`.
- Dispatches `Lead -> Schedule -> Purchase` conversion events back to Meta Conversions API (CAPI) and Google Offline Conversions.

---

## 7. Testing & CI

```bash
npm test                  # Runs 14 comprehensive unit & security tests
```

Continuous Integration runs on GitHub Actions (`.github/workflows/ci.yml`) across Node 20.x and 22.x.
