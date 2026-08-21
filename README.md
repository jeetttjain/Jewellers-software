# Kamal Jewellers — POS & Inventory System

Production-grade Point of Sale (POS) and serialized Inventory Management System designed specifically for single-branch retail jewellery showrooms.

---

## 🌟 Key Capabilities
- **⚡ Rapid Scan Terminal:** Sub-$300\text{ms}$ item identification, live board rate calculation, and customer Agree/Disagree decision flow.
- **⚖️ Milligram Precision Math:** `decimal.js` engine guaranteeing zero rounding errors on weights ($0.001\text{g}$) and currency values.
- **🏷️ Tiny Jewellery Tag Engine:** Automatic generation of 2-inch dumbbell and butterfly labels with compact Code 128 barcodes and Micro-QR codes.
- **🛒 POS Billing & Split Tender:** Multi-item cart, customer attachment, old gold scrap deduction, and split payment across Cash, UPI, Card, and Credit.
- **🔒 Secure Opaque Tag Model:** Physical QR codes contain zero private weights or prices; resolved securely via authenticated server APIs.
- **📜 Immutable Financial Ledger:** Historical transactions, gold rates at time of sale, and audit logs are permanently locked.

---

## 🛠️ Architecture & Tech Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, React Router v6
- **Backend:** Node.js, Fastify, TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Precision:** `decimal.js`
- **Validation:** Zod schemas
- **Monorepo:** npm workspaces (`apps/*`, `packages/*`)

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

### 3. Running Development
```bash
# Start all apps concurrently
npm run dev

# Frontend: http://localhost:5173
# Backend API: http://localhost:3001
```

### 4. Running Unit Tests
```bash
npm test
```
Demo Owner PIN: 1234
Demo Cashier PIN: 5678
---

## 📁 Repository Structure
```
/
├── apps/
│   ├── web/                     # React 18 + Vite frontend
│   └── api/                     # Fastify backend API server
├── packages/
│   ├── shared/                  # Enums, DTOs, Decimal precision math
│   ├── validation/              # Zod validation schemas
│   └── config/                  # Base tsconfig and lint rules
├── drizzle/                     # Database migrations
├── docs/                        # Architecture & API documentation
├── tests/                       # Global test suites
├── .env.example
├── package.json
└── README.md
```
