# Architecture Decision Records (ADRs)

## ADR-01: Framework Selection
- **Decision:** Fastify for backend; React 18 + Vite for frontend.
- **Rationale:** Sub-millisecond API response times, shared TypeScript interfaces, and low server memory usage.

## ADR-02: Zero Floating-Point Arithmetic Policy
- **Decision:** Strict enforcement of `decimal.js` for all financial, weight, and tax computations.
- **Rationale:** JavaScript native `Number` precision issues (e.g. `0.1 + 0.2 !== 0.3`) cause stock and ledger balance drift over thousands of retail transactions.

## ADR-03: Single-Branch Architecture Scope
- **Decision:** Excluded multi-branch sync, RFID gates, Karigar manufacturing, chit funds, and AI/voice billing.
- **Rationale:** Maximizes reliability, UI speed, and immediate stability for single-branch jewellery showrooms.

## ADR-04: Opaque Tag Security Model
- **Decision:** Barcodes and QR codes store only opaque tokens (`pos://t/<UUID>`), never direct weights, gold rates, or customer PII.
- **Rationale:** Prevents unauthorized price scraping and tampering; data is resolved server-side after authentication and shop tenant verification.
