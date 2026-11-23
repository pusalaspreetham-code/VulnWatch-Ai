# VulnWatch-AI

Vulnerability advisory monitoring web application.

---

## Tech Stack
- **Frontend:** React 19 + Vite + React Router + Lucide Icons (Minimalist Light Theme)
- **Backend:** Node.js + Express 5
- **Database:** PostgreSQL (direct `pg` client pool, no ORM/Prisma)
- **Authentication:** Custom Email OTP-verified Auth with bcrypt (salt rounds 12) + HTTP-only JWT cookies
- **Monitored Stack Management:** Full CRUD software inventory scoped to authenticated user
- **Product Catalog:** Curated software catalog with categories and known versions
- **Security Advisory Collection:** Automated scraping of official vendor security pages via Firecrawl, with deterministic parsing, deduplication, and audit logging

---

## Features

### 1. Main Dashboard (`/`)
- **Executive Summary:** Live count of monitored software items with quick-glance chips.
- **Empty State:** Clean onboarding card for users with 0 monitored items with a direct link to add software.
- **Account Overview:** Displays actual authenticated user data (Email, Verified & Active status, Analyst ID `#<id>`, and Registration Date). No hardcoded values.
- **Account Security:** In-session password updates verified via email OTP sent to the user's registered email address.

### 2. Searchable Product Catalog & Version Selectors
- **Searchable Autocomplete:** Fast backend search across 57+ enterprise products covering Operating Systems, Databases, Web Servers, Languages/Runtimes, Frameworks, Containerization, Infrastructure Tools, Security, and Developer Apps.
- **Version Selector Pills:** When selecting a catalog product (e.g. PHP, PostgreSQL, Nginx, Node.js, Ubuntu), common release versions appear as clickable chips for instant selection, while still allowing custom patch versions.
- **Custom / Unlisted Product Mode:** Allows users to track custom, in-house, or unlisted software with validated vendor and version fields.

### 3. Technology Stack Management (`/stack`)
- **Add / Edit / Delete:** Manage software inventory with validation and delete safety confirmations.
- **Search & Filter:** Real-time search across monitored technologies (product name, vendor, version, category, notes).
- **Multi-Tenant Isolation:** Strictly parameterized queries scoped to `req.user.id`.

---

## API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Submit email & password, dispatch verification OTP |
| `POST` | `/api/auth/verify-registration-otp` | Public | Verify OTP and activate account |
| `POST` | `/api/auth/login` | Public | Authenticate user, issue HTTP-only JWT cookie |
| `POST` | `/api/auth/logout` | Authenticated | Clear session cookie |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile |
| `POST` | `/api/auth/forgot-password/request-otp` | Public | Request password reset OTP |
| `POST` | `/api/auth/forgot-password/reset` | Public | Reset password with OTP |
| `POST` | `/api/auth/change-password/request-otp` | Authenticated | Request password change OTP |
| `POST` | `/api/auth/change-password/verify` | Authenticated | Update password with OTP |
| `POST` | `/api/auth/resend-otp` | Public/Auth | Resend OTP (enforces 60s cooldown) |

### Software Catalog (`/api/catalog`)
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/catalog` | Authenticated | Search catalog by query `?q=` and optional `?category=` |
| `GET` | `/api/catalog/categories` | Authenticated | Retrieve list of catalog categories with product counts |
| `GET` | `/api/catalog/:id` | Authenticated | Retrieve single catalog product with known versions |

### Technology Stack (`/api/stack`)
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/stack` | Authenticated | List all monitored software for logged-in user (joined with catalog metadata) |
| `POST` | `/api/stack` | Authenticated | Add a new software product (catalog-linked or custom) to stack |
| `GET` | `/api/stack/:id` | Authenticated | Retrieve single monitored stack item |
| `PUT` | `/api/stack/:id` | Authenticated | Update vendor, product name, version, or notes |
| `DELETE` | `/api/stack/:id` | Authenticated | Delete a monitored stack item |

### Security Advisories (`/api/advisories`)
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/advisories` | Authenticated | List collected advisories (supports `?vendor=`, `?severity=`, `?cve=`, `?limit=`, `?offset=`) |
| `GET` | `/api/advisories/:id` | Authenticated | Retrieve a single advisory with affected products |
| `POST` | `/api/advisories/collect` | Authenticated | Trigger manual advisory collection from all configured official vendor sources |
| `GET` | `/api/advisories/runs` | Authenticated | List past advisory collection audit runs |
| `GET` | `/api/advisories/sources` | Authenticated | List the configured official vendor security sources |

### Vulnerability Detection & Matching (`/api/matches`)
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/matches/run` | Authenticated | Run deterministic version-range scan against user's monitored stack |
| `GET` | `/api/matches` | Authenticated | List matched advisories (supports `?status=`, `?severity=`, `?search=`) |
| `GET` | `/api/matches/summary` | Authenticated | Severity breakdown & status summary counts |
| `GET` | `/api/matches/coverage` | Authenticated | Stack coverage breakdown (supported feeds vs pending catalog items) |
| `GET` | `/api/matches/:id` | Authenticated | Retrieve single match with affected products & advisory details |
| `PATCH` | `/api/matches/:id/status` | Authenticated | Update status (`vulnerable`, `confirmed`, `not_affected`, `dismissed`) with audit trail |

---

## Running the Application

### 1. Backend Setup
```bash
cd backend
npm install
npm run migrate         # Ensures database tables are up to date
npm run seed:catalog    # Populates the 57+ software catalog items with known versions
npm run dev             # Starts Express API server on port 5000
```

> **Running Automated Tests:**
> ```bash
> cd backend
> npm run test:auth        # Tests auth flows, OTP limits, and hashing
> npm run test:stack       # Tests stack CRUD operations and user isolation
> npm run test:catalog     # Tests catalog search, version chips, and stack linking
> npm run test:advisories  # Tests advisory scraping, parsing, deduplication, and audit log
> npm run test:matches     # Tests version-range evaluation, detection, and stack coverage
> ```

> **Advisory Collection Commands:**
> ```bash
> cd backend
> npm run collect:advisories   # Manually trigger collection from all official vendor sources
> ```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev             # Starts Vite dev server on http://localhost:5173
```
