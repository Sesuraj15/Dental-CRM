# DentaDesk: Dental Clinic CRM + ERP with WhatsApp auto-booking

Patients, leads, appointments, billing, inventory, role-based Admin/Owner dashboards, a WhatsApp booking bot,
automatic recall / reminders / no-show follow-up, and automatic lead capture from Meta Ads, Google Ads and Google Drive.

## 1. Run it
```bash
npm install
cp .env.example .env      # edit values
npm start                 # http://localhost:3000
```
First start prints the owner and admin passwords (or uses OWNER_PASSWORD / ADMIN_PASSWORD from .env).
Change them in **Team & Access**. Without `WA_TOKEN` the app runs in **dry-run mode**: every WhatsApp message is
printed in the console and visible in the WhatsApp tab, so you can test everything before going live.
Docker: `docker build -t dentadesk . && docker run -p 3000:3000 --env-file .env -v $PWD/data:/app/data dentadesk`

## 2. Deploy (needed for webhooks)
Meta and Google must reach your server over **HTTPS**. Use Render, Railway, Fly.io or a VPS with Caddy/Nginx.
Keep the `data/` folder on a persistent disk and back it up daily.

## 3. WhatsApp Cloud API setup
1. developers.facebook.com: create an app, add **WhatsApp**. Get `WA_PHONE_ID` and a permanent system-user `WA_TOKEN`.
2. Webhook callback URL: `https://YOUR-DOMAIN/webhooks/whatsapp`, verify token = `WA_VERIFY_TOKEN`; subscribe to **messages**.
   Put the app secret in `APP_SECRET` so signatures are verified.
3. Create and get approved these **message templates** (names can be changed in .env):
   - `lead_welcome`: "Hi {{1}}, thanks for your interest in our dental clinic! Tap Book now to pick a time." + quick-reply button **Book now**
   - `recall_checkup`: "Hi {{1}}, it has been a while since your last visit. Tap Book now to schedule a check-up." + quick-reply **Book now**
   - `appointment_reminder`: "Hi {{1}}, reminder: your appointment is on {{2}} at {{3}}. Reply CANCEL or RESCHEDULE to change."
   - optional `WA_NOTIFY_TEMPLATE` with one variable, used to alert admin/owner outside the 24-hour window.
4. Set `NOTIFY_NUMBERS` to the admin and owner numbers (country code, no +). They get a WhatsApp message on every booking, cancellation, new lead and no-show.

Flow: template goes out, patient taps **Book now**, bot offers 3 free slots as buttons, patient taps one,
appointment is created, slot locked, admin and owner alerted. Patient can also reply CANCEL, RESCHEDULE or MORE.

## 4. Lead sources
| Source | How it arrives |
|---|---|
| Meta Lead Ads (Facebook/Instagram) | Subscribe your Page to the `leadgen` field with callback `https://YOUR-DOMAIN/webhooks/meta-leads` (same verify token). Set `META_PAGE_TOKEN` (leads_retrieval permission). |
| Google Ads lead forms | In the lead form's webhook integration set URL `https://YOUR-DOMAIN/webhooks/google-ads` and key = `GOOGLE_ADS_KEY`. |
| Google Drive / Sheets | Publish the sheet to the web as CSV (columns `name,phone`) and set `SHEET_CSV_URL`. Polled every 10 minutes, duplicates skipped. |
| Anything else (Zapier, Make, website, Justdial) | POST `{"name","phone","source"}` to `/webhooks/generic` with header `x-api-key: GENERIC_API_KEY`. |
| Manual | CSV import or Add lead in the Leads tab. |

New leads are de-duplicated by phone number, appear in the pipeline, and (if `AUTO_ENGAGE=true`) get the welcome template automatically.
Set `COST_META` / `COST_GOOGLE` to your average cost per lead to see cost per booking (Owner only).

## 5. Automation schedule (timezone from `TZ`)
- 10:00 daily: recall patients last seen `RECALL_DAYS` (default 180) ago with no upcoming visit (max once per 30 days)
- hourly: 24-hour appointment reminders
- 21:30 daily: mark missed appointments as No-show and offer to rebook
- every 10 min: Google Sheet sync

## 6. Roles
- **Admin**: dashboard, leads, patients, appointments, WhatsApp, inventory. No billing, revenue or ad spend.
- **Owner**: everything plus billing, revenue, ad spend, source ROI and password management.
Permissions are enforced on the server (JWT, bcrypt, login rate limit).

## 7. Before using real patient data
- Run behind HTTPS only. Keep `.env` secret.
- Data is stored in `data/db.json`, fine for one clinic. For multiple branches, move `db.js` to PostgreSQL.
- Get patient consent for WhatsApp messages (add a consent line to ad forms) and follow local health-data laws (DPDP Act in India, HIPAA/GDPR elsewhere).
- Marketing templates must follow Meta's WhatsApp Business policy.

## Files
`server.js` API and auth · `bot.js` WhatsApp booking bot · `leads.js` lead webhooks and sheet sync · `core.js` booking logic and alerts ·
`scheduler.js` recalls, reminders, no-shows · `wa.js` WhatsApp sender · `db.js` storage · `public/index.html` dashboards
