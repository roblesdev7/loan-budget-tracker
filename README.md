# Loan & Budget Tracker

Personal finance app for tracking income, expenses, debts, and recurring bills in **DOP** and **USD**. Built for mobile-first use with multi-user support and admin-managed accounts.

**Live demo:** [joseroblesm.com/finance](https://joseroblesm.com/finance)

---

## Features

- **Dashboard** — available balance, monthly breakdown (variable / fixed / debt), upcoming bills, budget progress
- **Income & expenses** — dual-currency entries with sticky USD→DOP exchange rate
- **Debts** — credit cards, bank loans, informal debts; payment history and balance updates
- **Recurring bills** — monthly subscriptions and yearly renewals (hosting, domains, IA tools)
- **Debt installments** — scheduled monthly loan/card payments separate from principal reductions
- **Analytics** — month-over-month trends and category breakdowns
- **Settings** — categories, budgets, fixed payments, account management
- **Admin users** — invite-only registration; admin can create isolated accounts for family members
- **CSV export** — download income/expense history

---

## Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | React 18, Vite, Tailwind CSS        |
| Backend  | PHP 8.1+ (plain PHP, no framework)  |
| Database | MySQL 8.0+                          |
| Auth     | JWT (HMAC-SHA256, no external deps) |
| Hosting  | Hostinger shared hosting            |

---

## Project structure

```
loan-budget-tracker/
├── frontend/          React SPA (Vite, base path /finance/)
├── backend/           PHP REST API
├── portal/            Domain landing page
├── database/
│   ├── schema.sql     Full MySQL schema
│   ├── migrations/    Incremental migrations (001–006)
│   └── scripts/       Admin setup helpers
├── deploy.sh          Deploy to Hostinger via rsync
├── deploy.config.example
├── docker-compose.yml Local MySQL + PHP dev server
└── DOCS.md            Detailed technical documentation (Spanish)
```

---

## Getting started

### Prerequisites

- Node.js 18+
- PHP 8.1+
- MySQL 8.0+
- (Optional) Docker & Docker Compose

### 1. Clone the repo

```bash
git clone https://github.com/roblesdev7/loan-budget-tracker.git
cd loan-budget-tracker
```

### 2. Backend setup

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your DB credentials and JWT secret
```

Generate a JWT secret:

```bash
openssl rand -hex 32
```

Required `.env` variables:

```env
JWT_SECRET=your-secret-here
DB_HOST=localhost
DB_PORT=3306
DB_NAME=financeapp
DB_USER=finance
DB_PASS=your-password
ALLOWED_ORIGINS=http://localhost:5173
ALLOW_PUBLIC_REGISTRATION=true   # set false in production
```

### 3. Database setup

```bash
mysql -u root -p financeapp < database/schema.sql
```

Then run migrations in order:

```bash
for f in database/migrations/*.sql; do mysql -u root -p financeapp < "$f"; done
```

### 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`. Point `VITE_API_URL` to your API (defaults to `/api`).

### 5. Docker (optional)

```bash
docker compose up -d
# API at http://localhost:8000
# MySQL at localhost:3306
```

---

## Deploy (Hostinger)

1. Copy deploy config:

   ```bash
   cp deploy.config.example deploy.config
   # Edit SSH alias and remote paths
   ```

2. Configure the server `.env` at `public_html/api/.env` (see `backend/.env.example`).

3. Deploy:

   ```bash
   ./deploy.sh
   ```

4. Run any pending migrations on the server:

   ```bash
   mysql -u USER -p DB_NAME < database/migrations/006_user_roles.sql
   ```

### URL layout (production)

| Path                  | Purpose              |
| --------------------- | -------------------- |
| `/`                   | Portal home page     |
| `/finance/`           | React app            |
| `/api/index.php`      | PHP API              |

---

## Admin setup

After migration `006_user_roles.sql`:

```bash
mysql -u USER -p DB_NAME < database/scripts/promote_admin.sql
cd public_html/api && php scripts/setup_admin_password.php 'YourStrongPassword12!'
```

Set `ALLOW_PUBLIC_REGISTRATION=false` in the server `.env` to disable public sign-up. Create additional users from **Settings → Usuarios** in the app.

---

## Migrations

| File | Description |
| ---- | ----------- |
| `001_recurring_categories.sql` | Recurring expense category type |
| `002_phase_features.sql` | Recurring bills + budget caps |
| `003_debt_recurring_bills.sql` | Debt-linked recurring bills |
| `004_billing_frequency.sql` | Monthly / yearly billing |
| `005_extra_recurring_categories.sql` | IA, Hosting, Domains categories |
| `006_user_roles.sql` | Admin / user roles |

---

## Security

- Passwords hashed with **Argon2id**
- JWT authentication on all protected routes
- PDO prepared statements throughout
- CORS restricted to `ALLOWED_ORIGINS`
- Secrets excluded via `.gitignore` (`deploy.config`, `.env`, build output)

Never commit `deploy.config` or `.env` files.

---

## CI

GitHub Actions runs on push/PR (`.github/workflows/ci.yml`):

- Frontend build
- PHP syntax check

---

## Documentation

For API endpoints, database schema, business logic, and deploy details, see **[DOCS.md](./DOCS.md)**.

---

## License

Private project — all rights reserved.
