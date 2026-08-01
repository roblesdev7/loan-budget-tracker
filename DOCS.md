# Loan & Budget — Documentación del proyecto

## Stack

| Capa          | Tecnología                                   |
| ------------- | -------------------------------------------- |
| Frontend      | React 18 + Vite + Tailwind CSS               |
| Backend       | PHP 8.1+ (sin frameworks)                    |
| Base de datos | MySQL 8.0+                                   |
| Hosting       | Hostinger Shared Hosting                     |
| Auth          | JWT (HMAC-SHA256, sin dependencias externas) |

---

## Estructura de carpetas

```
loan-n-budget/
├── database/
│   └── schema.sql                  ← Schema completo MySQL
├── backend/
│   ├── .htaccess                   ← URL routing + bloqueo de archivos sensibles
│   ├── .env.example                ← Plantilla de variables de entorno
│   ├── index.php                   ← Router principal
│   ├── config/
│   │   ├── config.php              ← Carga .env + configuración centralizada
│   │   └── Database.php            ← Singleton PDO
│   ├── helpers/
│   │   ├── JWT.php                 ← HMAC-SHA256, sin dependencias externas
│   │   └── Response.php           ← Helpers json(), success(), error()
│   ├── middleware/
│   │   └── Auth.php               ← Validador Bearer token
│   └── controllers/
│       ├── AuthController.php      ← register (argon2id) + login
│       ├── ExchangeRateController.php
│       ├── CategoryController.php
│       ├── DebtController.php
│       ├── IncomeController.php
│       ├── ExpenseController.php
│       └── DashboardController.php
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                 ← Router + layouts + rutas protegidas
│       ├── index.css               ← Tailwind base + fix iOS zoom
│       ├── api/
│       │   └── client.js           ← fetch wrapper con Bearer token
│       ├── context/
│       │   ├── AuthContext.jsx     ← JWT en localStorage
│       │   └── AppContext.jsx      ← Rate sticky, categorías, deudas, dashboard
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Header.jsx      ← Tasa USD/DOP + saludo + logout
│       │   │   └── BottomNav.jsx   ← Navegación inferior mobile
│       │   └── ui/
│       │       ├── CurrencyInput.jsx  ← Input dual DOP/USD con tasa sticky
│       │       └── QuickAction.jsx   ← Grid de acceso rápido por categoría
│       └── pages/
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Dashboard.jsx       ← Balance + stats + preview deudas
│           ├── AddIncome.jsx
│           ├── AddExpense.jsx      ← Con lógica diferenciada por tipo de deuda
│           ├── Debts.jsx           ← Lista con barra de progreso + link pago
│           └── AddDebt.jsx
├── deploy.sh                       ← Script de deploy automatizado
├── deploy.config                   ← Config local (en .gitignore)
├── deploy.config.example           ← Plantilla de deploy.config
└── setup-db.sh                     ← Setup inicial de BD en servidor
```

---

## Base de datos — 7 tablas

### Estrategia Three-Column Ledger

Toda tabla de transacciones tiene estos 4 campos obligatorios:

| Campo             | Tipo              | Descripción                                                           |
| ----------------- | ----------------- | --------------------------------------------------------------------- |
| `original_amount` | DECIMAL(14,2)     | Monto en la moneda original                                           |
| `currency`        | ENUM('DOP','USD') | Moneda de la transacción                                              |
| `exchange_rate`   | DECIMAL(10,4)     | Tasa al momento del registro (1.0 para DOP)                           |
| `base_amount_dop` | DECIMAL(14,2)     | `original_amount × exchange_rate`, calculado en el backend al guardar |

### Tablas

| Tabla                | Propósito                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `users`              | Multi-usuario con contraseña argon2id                                                              |
| `exchange_rates`     | Historial completo de tasas USD→DOP. La más reciente es el sticky default                          |
| `income_categories`  | Categorías de ingreso configurables por usuario                                                    |
| `expense_categories` | Categorías de gasto con `category_type`: `daily` o `debt_related`                                  |
| `debts`              | Tabla única con discriminador `debt_type`. Three-Column Ledger en el principal + balance corriente |
| `income`             | Ingresos con Three-Column Ledger                                                                   |
| `expenses`           | Gastos con Three-Column Ledger + `expense_type` que activa la lógica de deuda                      |

### Constraints clave en DB

- **`chk_debt_linkage`** — Si `expense_type != 'daily'`, `debt_id` es obligatorio (y viceversa)
- **`chk_dop_rate`** — Fuerza `exchange_rate = 1.0` cuando `currency = 'DOP'`
- **`chk_credit_limit`** — `credit_limit` solo existe en `credit_card`
- **`seed_default_categories()`** — Stored procedure que se llama al registrar un usuario

---

## API Endpoints

Base URL producción: `https://joseroblesm.com/api/index.php`

### Públicos

| Método | Ruta             | Descripción         |
| ------ | ---------------- | ------------------- |
| POST   | `/auth/register` | Registro de usuario |
| POST   | `/auth/login`    | Login, devuelve JWT |

### Protegidos (requieren `Authorization: Bearer <token>`)

| Método | Ruta                      | Descripción                       |
| ------ | ------------------------- | --------------------------------- |
| GET    | `/dashboard`              | Balance disponible + resumen      |
| GET    | `/exchange-rates/latest`  | Última tasa registrada (sticky)   |
| GET    | `/exchange-rates`         | Historial últimas 30 tasas        |
| POST   | `/exchange-rates`         | Registrar nueva tasa manualmente  |
| GET    | `/categories/income`      | Categorías de ingreso del usuario |
| POST   | `/categories/income`      | Crear categoría de ingreso        |
| PUT    | `/categories/income/:id`  | Editar categoría de ingreso       |
| GET    | `/categories/expense`     | Categorías de gasto del usuario   |
| POST   | `/categories/expense`     | Crear categoría de gasto          |
| PUT    | `/categories/expense/:id` | Editar categoría de gasto         |
| GET    | `/debts`                  | Listar deudas                     |
| GET    | `/debts/:id`              | Ver deuda individual              |
| POST   | `/debts`                  | Crear deuda                       |
| PUT    | `/debts/:id`              | Editar deuda                      |
| DELETE | `/debts/:id`              | Eliminar deuda                    |
| GET    | `/income`                 | Listar ingresos (últimos 100)     |
| POST   | `/income`                 | Registrar ingreso                 |
| PUT    | `/income/:id`             | Editar ingreso                    |
| DELETE | `/income/:id`             | Eliminar ingreso                  |
| GET    | `/expenses`               | Listar gastos (últimos 100)       |
| POST   | `/expenses`               | Registrar gasto                   |
| DELETE | `/expenses/:id`           | Eliminar gasto                    |

### Body de `/expenses` (POST)

```json
{
  "category_id": 5,
  "expense_type": "debt_payment",
  "debt_id": 2,
  "description": "Cuota enero",
  "expense_date": "2026-07-26",
  "original_amount": 15000,
  "currency": "DOP",
  "exchange_rate": 1.0,
  "new_balance": 380000.0
}
```

> `new_balance` solo aplica para préstamos bancarios (`bank_loan_personal`, `bank_loan_vehicle`, `bank_loan_mortgage`). En ese caso el backend establece el balance directamente en lugar de deducir automáticamente.

---

## Lógica de negocio

### Compute on Entry

El `base_amount_dop` se calcula **al guardar** en el backend:

```
base_amount_dop = original_amount × exchange_rate
```

Nunca se calcula dinámicamente al leer.

### Balance disponible

```
Balance = Total Income (base_amount_dop) − Total Expenses (base_amount_dop)
```

### Actualización de deuda al pagar

| Tipo de deuda | Comportamiento                                                                              |
| ------------- | ------------------------------------------------------------------------------------------- |
| `credit_card` | Se descuenta el monto pagado automáticamente                                                |
| `informal`    | Se descuenta el monto pagado automáticamente                                                |
| `bank_loan_*` | El usuario ingresa el nuevo saldo que muestra el estado de cuenta del banco (`new_balance`) |

### Tasa sticky

- Cada vez que se guarda una transacción en USD, la tasa usada se persiste en `exchange_rates`
- El campo de tasa en el formulario se auto-rellena con la última tasa registrada

---

## Tipos de deuda

| `debt_type`          | Descripción                     | Campos exclusivos                                     |
| -------------------- | ------------------------------- | ----------------------------------------------------- |
| `credit_card`        | Tarjeta de crédito revolving    | `credit_limit`                                        |
| `bank_loan_personal` | Préstamo personal bancario      | —                                                     |
| `bank_loan_vehicle`  | Préstamo de vehículo            | —                                                     |
| `bank_loan_mortgage` | Hipoteca                        | —                                                     |
| `informal`           | Deuda informal (persona física) | `creditor_name`, `creditor_address`, `creditor_phone` |

---

## Categorías por defecto (al registrar usuario)

**Ingresos:** Salario, Freelance, Negocio, Inversión, Otro

**Gastos diarios:** Vivienda, Vehículo, Electricidad, Médico, Dependientes, Alimentación, Otro gasto

**Gastos de deuda:** Cuota préstamo, Abono capital, Pago tarjeta

---

## Deploy

### Configuración (`deploy.config`)

```bash
SSH_ALIAS="wordpress"           # Alias en ~/.ssh/config
REMOTE_BACKEND="/home/u158097960/domains/joseroblesm.com/public_html/api"
REMOTE_FRONTEND="/home/u158097960/domains/joseroblesm.com/public_html"
APP_PUBLIC_URL="https://joseroblesm.com"
API_PUBLIC_URL="https://joseroblesm.com/api/index.php"
```

### Comandos

```bash
# Deploy completo (build frontend + rsync backend + rsync frontend)
./deploy.sh

# Setup inicial de BD (solo una vez, desde el servidor)
bash ~/setup-db.sh
```

### `.env` en servidor

```
/home/u158097960/domains/joseroblesm.com/public_html/api/.env
```

```env
JWT_SECRET=<openssl rand -hex 32>
DB_HOST=localhost
DB_PORT=3306
DB_NAME=u158097960_financeapp
DB_USER=u158097960_nitro5
DB_PASS=<password>
ALLOWED_ORIGINS=https://joseroblesm.com
```

### SSH Config (`~/.ssh/config`)

```
Host wordpress
    HostName 157.173.209.95
    User u158097960
    Port 65002
    IdentityFile ~/.ssh/id_ed25519_wordpress
    IdentitiesOnly yes
```

---

## UI/UX — Decisiones de diseño

- **Mobile-first** con max-width de 448px (max-w-lg) centrado en desktop
- **`inputMode="decimal"`** en todos los inputs numéricos para teclado nativo en móvil
- **Font-size mínimo 16px** en inputs para prevenir auto-zoom en iOS
- **Safe area insets** (`env(safe-area-inset-bottom)`) para notched phones
- **Distinct visual** para campos USD (azul) vs DOP (verde)
- **QuickAction grid** con targets grandes (min-h 68px) para categorías frecuentes
- **Campo ámbar** para `new_balance` en préstamos bancarios, visualmente diferenciado

---

## Seguridad

- Contraseñas hasheadas con `PASSWORD_ARGON2ID`
- JWT con HMAC-SHA256 (implementación propia, sin dependencias)
- `hash_equals()` para comparación de tokens (previene timing attacks)
- PDO con prepared statements en todas las queries
- CORS restringido a `ALLOWED_ORIGINS`
- `.env` con permisos `600` en servidor
- `Options -Indexes` en `.htaccess` (bloquea directory listing)
- `deploy.config` en `.gitignore` (nunca se sube a Git)
