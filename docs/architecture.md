# System Architecture — Single-Branch Retail Jewellery POS & Inventory System

## 1. High-Level Overview
The system is built as a deterministic, high-throughput Point of Sale and Inventory management suite tailored for retail jewellery shops. It couples milligram-precision arithmetic ($0.001\text{g}$) with a sub-$300\text{ms}$ scan-to-quote workflow.

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                          │
│  React 18 + Vite + TypeScript + Tailwind CSS               │
│  • High-contrast showroom UI                                │
│  • Keyboard-first desktop bindings (F1–F10)                 │
│  • Touch-first iPad/mobile layout & camera QR viewfinder   │
│  • Centralized API Client with Idempotency Support          │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON API (REST)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       SERVER LAYER                          │
│  Node.js + Fastify + TypeScript                             │
│  • Helmet security headers & CORS                           │
│  • HTTP-only secure cookie sessions                         │
│  • JSON Schema validation (Zod & AJV)                       │
│  • Sub-millisecond deterministic pricing calculator         │
└──────────────────────────────┬──────────────────────────────┘
                               │ Drizzle ORM (Type-Safe SQL)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                         │
│  PostgreSQL 15+                                             │
│  • NUMERIC(12,3) for milligram weights (0.001g)             │
│  • NUMERIC(14,2) for financial ledger and GST accounting    │
│  • Row-level sequential billing locks                       │
│  • Write-once immutable audit logs                          │
└─────────────────────────────────────────────────────────────┘
```

## 2. Core Operational Modules
1. **Rapid Price Scanner (`/scan`):** Hardware laser and camera QR input $\to$ live board rate lookup $\to$ instant price calculation with Agree/Disagree action.
2. **POS Billing Terminal (`/billing/new`):** Multi-item cart, customer attachment, old gold trade-in credit, and split-tender payment.
3. **Inventory Master (`/inventory`):** Serialized piece tracking, gross/stone/net weights, HUID verification, and tiny 2-inch dumbbell/butterfly tag generation.
4. **Daily Board Rates (`/rates`):** Owner-approved $24\text{K}, 22\text{K}, 18\text{K}$, and silver rates with historical audit log.
5. **Old Gold Assay (`/old-gold/new`):** Customer scrap metal testing, purity assay, and buyback valuation.
6. **Customer Ledgers (`/customers/:id`):** Dues tracking, partial payment receipts, and balance settlement.
