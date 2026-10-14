# CrimePulse Frontend 💻

Responsive client application for **CrimePulse**, built with **React 19**, **Vite**, **Tailwind CSS**, and **Lucide React**.

---

## 🛠️ Features

- **Authentication Flow**: User registration and login forms with client-side validation, password visibility toggles, and Bcrypt 72-byte limit compliance.
- **Session Management**: Session restoration on application startup via `GET /api/auth/me`. Automatic session purge on token expiry.
- **Route Protection**: Dedicated route guards (`ProtectedRoute`, `PublicOnlyRoute`) preserving requested target URLs.
- **Crime Prediction Console**: Historical prediction interface with geospatial parameter inputs, verified sample loader, inline field errors, and loading state locks.
- **Prediction Visualization**: Prominent dominant crime highlight card with a pure-CSS horizontal-bar breakdown of 6 target crime class probabilities.
- **Audit History Log**: Paginated table and mobile card views of persisted analyses with date/time formatting, status badges (`COMPLETED`, `PENDING`, `FAILED`), and inspection modals.
- **Responsible Use Disclosures**: Ethical advisory notices embedded in both prediction and inspection views.

---

## ⚙️ Configuration & Environment

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Express API Gateway Base URL | `http://localhost:5000/api` |

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start Vite development server (Port 3000)
npm run dev

# Run Oxlint code quality verification
npm run lint

# Run all automated test suites
npm test

# Build production bundle
npm run build
```

---

## 🧪 Test Suite

The frontend includes 191 automated test assertions across three suites:
1. `tests/authFrontend.test.js`: Form validation, token persistence, and Express auth integration (56 tests).
2. `tests/predictFrontend.test.js`: Parameter checks, error mappings, probability rendering, and live ML integration (70 tests).
3. `tests/historyFrontend.test.js`: Pagination, detail lookup, multi-tenant isolation, safe 404s, and status handling (65 tests).
