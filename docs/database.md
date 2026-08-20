# Database Architecture & Entity Specifications

## 1. Database Engine & Connection
- **Engine:** PostgreSQL 15+
- **ORM:** Drizzle ORM (`drizzle-orm/postgres-js`)
- **Connection pooling:** `postgres.js` with automated reconnect and query parameterization.

## 2. Core Entities (Phase 0 Scaffold)
- **`shops`:** Store identity, GSTIN, default tax rate (e.g. $3.00\%$), invoice prefix (`KJ`).
- **`users`:** Store personnel with roles (`ADMIN`, `MANAGER`, `CLERK`) and 4-digit PIN access.
- **`gold_rates`:** Historical daily board rates for 24K, 22K, 18K gold, silver, and platinum.
- **`audit_logs`:** Write-once immutable event ledger recording actor, timestamp, action type, and state differentials.

## 3. Data Precision Constraints
- **Weights:** Defined as `NUMERIC(12, 3)` to preserve milligram accuracy ($0.001\text{g}$).
- **Currency & Ledgers:** Defined as `NUMERIC(14, 2)` to eliminate currency rounding discrepancies.
