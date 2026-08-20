# Development Guide

## 1. Prerequisites
- Node.js (v18+ or v20+ recommended)
- PostgreSQL 15+ (local or containerized)
- npm (v9+)

## 2. Setup & Installation
```bash
# 1. Clone & Enter repository
cd "f:/Jewellery software"

# 2. Copy environment file
cp .env.example .env

# 3. Install all workspace dependencies
npm install
```

## 3. Running Development Servers
```bash
# Run both Frontend & Backend concurrently
npm run dev

# Run Frontend only (Vite at http://localhost:5173)
npm run dev:web

# Run Backend only (Fastify at http://localhost:3001)
npm run dev:api
```

## 4. Database Commands (Drizzle ORM)
```bash
# Generate migrations based on schema changes
npm run db:generate

# Apply migrations to PostgreSQL
npm run db:migrate

# Launch Drizzle Studio DB explorer
npm run db:studio
```

## 5. Running Tests
```bash
# Run all Vitest suites across workspace
npm test

# Run tests in watch mode
npm run test:watch
```
