# 🏪 Aswaq Enterprise
### منصة إعلانات مبوبة مبنية بأعلى معايير الإنتاج

[![CI](https://github.com/your-org/aswaq/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/aswaq/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://typescriptlang.org)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React SPA)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / WebSocket
┌────────────────────────▼────────────────────────────────────┐
│              Express API (Modular Monolith)                  │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│   │   Auth   │ │   Ads    │ │  Users   │ │   Notif.     │  │
│   └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  Middleware: Correlation ID → Helmet → Rate Limit    │  │
│   │             → Cookie Parser → CSRF → Logger          │  │
│   └──────────────────────────────────────────────────────┘  │
└──────────────┬─────────────────┬───────────────────────────┘
               │                 │
   ┌───────────▼──────┐  ┌───────▼──────────────────────────┐
   │   PostgreSQL 16   │  │         Redis 7                  │
   │  (Source of Truth)│  │  Cache · Rate Limit · Sessions   │
   └───────────────────┘  └──────────────────────────────────┘
               │
   ┌───────────▼───────────────────────────────────────────┐
   │            Outbox Worker (5s poll)                    │
   │  PostgreSQL → OutboxEvent → Meilisearch (Search)      │
   └───────────────────────────────────────────────────────┘
```

---

## ✨ المميزات الرئيسية

| الميزة | التقنية |
| :--- | :--- |
| 🔐 المصادقة | JWT (Access 15m + Refresh 7d) + HMAC-SHA256 hashing |
| 🛡️ الأمان | Helmet + CSRF + Rate Limiting + Bcrypt+Pepper |
| 🔄 Token Security | Reuse Detection + Session Family Revocation |
| 🔍 البحث | Meilisearch (Arabic full-text) عبر Outbox Pattern |
| ⚡ الوقت الفعلي | Socket.IO + Redis Adapter |
| 📦 Queue Jobs | BullMQ (Image processing, Notifications) |
| 📊 المراقبة | Winston Logger + Correlation IDs + Health Check |
| 🐳 الحاويات | Docker Multi-stage + Docker Compose |
| 🚀 CI/CD | GitHub Actions (Lint → Test → Build → Deploy) |
| 📚 التوثيق | Swagger/OpenAPI 3.0 at `/api/docs` |

---

## 🚀 بدء سريع

### المتطلبات
- Node.js ≥ 20
- PostgreSQL 16
- Redis 7
- Meilisearch v1.8 (اختياري)

### 1. استنساخ المشروع
```bash
git clone https://github.com/your-org/aswaq.git
cd aswaq
```

### 2. إعداد البيئة
```bash
cp .env.example .env
# عدّل .env وضع بيانات قاعدة البيانات الصحيحة
```

### 3. تثبيت الحزم
```bash
npm install
```

### 4. تهيئة قاعدة البيانات
```bash
npx prisma db push        # Dev (بدون migrations)
# أو في الإنتاج:
npx prisma migrate deploy
```

### 5. تشغيل المشروع
```bash
npm run dev               # Development (Vite HMR + Express)
```

---

## 🐳 تشغيل بـ Docker

```bash
# كل الخدمات (App + DB + Redis + Meilisearch)
docker compose up

# مع واجهة Adminer لإدارة قاعدة البيانات
docker compose --profile dev up

# إنتاج
docker compose -f docker-compose.yml up -d
```

---

## 🧪 الاختبارات

```bash
# Unit Tests (بدون قاعدة بيانات)
npm test -- --testPathPattern="tests/unit"

# Integration Tests (يتطلب قاعدة بيانات)
DATABASE_URL=... npm test -- --testPathPattern="tests/integration"

# E2E Tests (Playwright)
npx playwright test tests/e2e/

# جميع الاختبارات
npm test
```

---

## 📚 توثيق الـ API

بعد تشغيل السيرفر:

| الرابط | الوصف |
| :--- | :--- |
| `http://localhost:3000/api/docs` | Swagger UI التفاعلي |
| `http://localhost:3000/api/docs.json` | OpenAPI JSON (Postman Import) |
| `http://localhost:3000/api/v1/health` | Health Check كامل |

---

## 🗂️ هيكل المشروع

```
aswaq/
├── .github/workflows/    # GitHub Actions CI/CD
├── prisma/
│   └── schema.prisma     # قاعدة البيانات (source of truth)
├── server/
│   ├── app.ts            # Bootstrap & middleware chain
│   ├── swagger.ts        # OpenAPI 3.0 setup
│   ├── controllers/      # Express route handlers
│   ├── middleware/       # correlation, csrf, auth, error, validation
│   ├── workers/          # Outbox worker (search sync)
│   ├── services/         # Business logic
│   ├── dto/              # Data Transfer Objects (validation)
│   └── lib/              # Logger, etc.
├── src/
│   ├── App.tsx           # React SPA entry
│   ├── lib/              # Prisma, Redis, Meilisearch, Queues
│   └── components/       # UI components
├── tests/
│   ├── unit/             # Unit tests (no DB)
│   ├── integration/      # Integration tests (real DB)
│   └── e2e/              # Playwright E2E tests
├── Dockerfile            # Multi-stage production build
├── docker-compose.yml    # All services
└── .env.example          # Environment variables template
```

---

## 🔐 Security Model

```
Register/Login → Bcrypt(password + PEPPER) → Store hash
Login success  → AccessToken (15m JWT) + RefreshToken (UUID, hashed HMAC-SHA256)
Refresh        → Validate hash → Revoke old → Issue new pair
Reuse detected → Revoke ENTIRE session family → Force re-login
CSRF           → Double-submit cookie on all state-changing requests
Rate limit     → 2000 req/15min global, 20 req/min on auth routes
```

---

## 🤝 المساهمة

1. افتح Issue تصف المشكلة أو الميزة
2. انسخ المشروع `git checkout -b feature/my-feature`
3. اكتب tests تغطي التغيير
4. افتح Pull Request للـ `develop` branch

---

## 📄 الترخيص

MIT License – حر الاستخدام للمشاريع التجارية والشخصية.

## Production Environment Validation

Before deploying, validate required production environment variables:

```bash
npm run check-env
```

This validates OAuth redirect/domain values, API/admin URLs, JWT/DB secrets, and required Vite Firebase build vars used by web/admin builds.

