# Kumari Packers and Movers

House-shifting and logistics platform: public website, one login for **Customer / Admin / Driver**, booking lifecycle (quote → accept → pay → confirm → dispatch → deliver), invoices, consent-based tracking, reviews, support, damage reports, audit log and CSV reports.

**Stack:** React 18 + Vite + Tailwind + Framer Motion + Recharts · Django + DRF + JWT · MySQL 8 · optional Celery/Redis.

```
backend/    Django API (apps: core, accounts, catalog, bookings, payments, support) + 58 tests
frontend/   React app (public site, /app customer, /admin, /driver) + Vitest tests
docker-compose.yml   MySQL + Redis + API + worker + nginx/web
```

## 1. Run locally (MySQL)

### 1.1 Create the database and a restricted user
```sql
CREATE DATABASE kumari_movers CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'kumari_user'@'localhost' IDENTIFIED BY 'CHOOSE-A-STRONG-PASSWORD';
GRANT ALL PRIVILEGES ON kumari_movers.* TO 'kumari_user'@'localhost';   -- only this schema
-- tests create/drop test_kumari_movers, so also: GRANT ALL ON `test\_kumari_movers`.* TO 'kumari_user'@'localhost';
FLUSH PRIVILEGES;
```

### 1.2 Configure
```bash
cp .env.example .env        # then edit: DB_PASSWORD, DJANGO_SECRET_KEY, ...
python -c "import secrets; print(secrets.token_urlsafe(60))"   # use as DJANGO_SECRET_KEY
```
Credentials only ever live in `.env` (git-ignored). Nothing is hard-coded.

### 1.3 Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
# Ubuntu needs: sudo apt install default-libmysqlclient-dev pkg-config build-essential
pip install -r requirements.txt
python manage.py migrate
python manage.py create_admin --email you@company.com --name "Your Name" --phone 98XXXXXXXX   # prompts for password
python manage.py seed_defaults      # services, PLACEHOLDER pricing, FAQs, inventory list, config (no fake customers/reviews)
python manage.py runserver          # http://localhost:8000  ·  API docs: /api/docs/
```
> **Review prices in Admin → Pricing rules and the GST % in Business settings before quoting real customers.** The seeded numbers are placeholders.

### 1.4 Frontend
```bash
cd frontend && npm install && npm run dev      # http://localhost:5173 (proxies /api to :8000)
```

### 1.5 First steps in the app
1. Sign in as the admin → **Vehicles** (add a truck) → **Drivers** (create driver + temporary password, then ✔ approve).
2. Customers register themselves at `/register` (role is always CUSTOMER; it cannot be chosen by the client).
3. Customer requests a quote → admin **Prepare quotation** → customer accepts → pays → admin assigns a driver → driver runs the job from `/driver`.

## 2. Roles & security model
| Area | Who | Enforced by |
|---|---|---|
| `/app/*` | Customer | API permission `IsCustomer` + queryset scoped to own records |
| `/admin/*` | Admin | `IsAdminRole` |
| `/driver/*` | Driver | `IsDriver` + only bookings assigned to that driver |

The React route guards are a UX convenience only; **every** API call re-checks role and ownership (other users' records return 404).
- Access token (15 min) is kept in memory only; refresh token is an **HttpOnly, SameSite cookie** limited to `/api/v1/auth/`, rotated and blacklisted. Refresh requires `X-Requested-With`.
- Login: generic failure message, throttling, 5-failure lockout (15 min). Passwords validated and hashed (PBKDF2).
- Booking status changes go through one state machine with row locks, allowed-transition-by-role, stale-view check (409) and audit log.
- Money is `Decimal`, computed server-side. Payment success only after gateway signature verification / verified webhook; webhooks are idempotent.
- Uploads: JPEG/PNG/WebP by magic bytes, ≤5 MB, stored under random names.
- CSV exports neutralise spreadsheet formulas and are audit-logged.
- Tracking: location stored only if the driver has consented **and** the job is live; customers see the last ping with its time, or a clear "unavailable" message. Run `python manage.py purge_old_pings` on a schedule for retention.

## 3. Integrations (what needs YOUR credentials)
| Feature | Status | To enable |
|---|---|---|
| MySQL | Ready | `DB_*` in `.env` |
| Online payments | Razorpay adapter implemented, **untested against the live gateway** | `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` (use test keys first). Webhook URL: `https://YOUR-DOMAIN/api/v1/payments/webhook/` events `payment.captured`, `payment.failed`, `refund.processed`. Without keys the API answers "Online payments are not configured yet" and nothing is faked. |
| Email | Console backend by default | set `EMAIL_*` (SMTP) |
| SMS / WhatsApp | Not implemented (preference stored only) | needs a provider adapter |
| Maps / distance | Not integrated: admin enters distance in the quotation; Maps links open Google Maps | optional |
| Celery/Redis | Optional | `CELERY_BROKER_URL` |

## 4. Tests
```bash
cd backend && python manage.py test            # 58 tests (auth, permissions/IDOR, booking flow, pricing, payments)
cd frontend && npm test                        # 15 tests (forms, role redirects, schemas, safe redirects)
```
Backend tests can run on SQLite for speed (`TEST_DB_ENGINE=sqlite`) or against MySQL (default). **Verify migrations on a real MySQL 8 instance in your environment** – they were developed/tested on SQLite in the build sandbox.

## 5. Docker
```bash
cp .env.example .env     # set DB_PASSWORD, DJANGO_SECRET_KEY, DJANGO_ALLOWED_HOSTS, CORS/CSRF origins
docker compose up -d --build
docker compose exec backend python manage.py create_admin --email you@company.com --name "You"
docker compose exec backend python manage.py seed_defaults
# site: http://localhost:8080
```
nginx serves the SPA and proxies `/api` so the browser sees a single origin.

## 6. Production checklist
- [ ] `DJANGO_DEBUG=False`, long random `DJANGO_SECRET_KEY`, correct `DJANGO_ALLOWED_HOSTS`
- [ ] HTTPS in front (Let's Encrypt/Cloudflare); `COOKIE_SECURE=True`; set `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` / `FRONTEND_URL` to your https origin
- [ ] Reverse proxy sets `X-Forwarded-Proto` (the supplied nginx.conf forwards it; add TLS termination)
- [ ] MySQL user limited to the app schema; DB not exposed publicly; daily backups
- [ ] Razorpay live keys + webhook secret; test one real small payment and one refund
- [ ] SMTP configured; password-reset email tested
- [ ] Prices, GST %, advance %, cancellation window reviewed in Admin
- [ ] Cron: `purge_old_pings`, DB backups; log shipping/monitoring
- [ ] Change the default admin password; create separate admin accounts per person

### Backup & recovery
```bash
mysqldump --single-transaction -u kumari_user -p kumari_movers | gzip > kumari_$(date +%F).sql.gz   # backup
gunzip < kumari_2026-01-01.sql.gz | mysql -u kumari_user -p kumari_movers                            # restore
# also back up the media/ volume (damage photos, delivery proof)
```

## 7. Troubleshooting
| Symptom | Fix |
|---|---|
| `Error loading MySQLdb module` | `pip install mysqlclient` (needs `default-libmysqlclient-dev`), or set `DB_ENGINE=sqlite` for a quick local look |
| Logged out on refresh in production | API and site must share a site/origin (use the nginx proxy); `COOKIE_SECURE` only with HTTPS |
| `CORS`/`CSRF` errors | origins in `.env` must match the browser origin exactly (scheme + host + port) |
| "Online payments are not configured" | add Razorpay keys |
| Uploaded photos 404 in production | `/media/` must be served by nginx from the shared media volume (see compose) |
