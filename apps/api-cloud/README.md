# OMR-PROD: National Hub API

The core NestJS backend for the National Hub, providing authoritative grading, RBAC, and synchronization services.

## 🚀 Key Features
- **Authoritative Grading**: Centralized service ensuring 100% consistent score calculation.
- **Sync Controller**: High-performance endpoint for machine registration, scan result synchronization, and heartbeat monitoring.
- **Audit Logging**: Comprehensive database-level tracking of all manual corrections and system actions.
- **RBAC**: Multi-layered authorization logic with visibility scoping.

## 🛠 Tech Stack
- **Framework**: NestJS
- **ORM**: Drizzle (PostgreSQL)
- **Shared Package**: `@omr-prod/contracts` (API Interfaces)

## 🏎️ Optimizations
- **N+1 Batching**: Refactored sync endpoints to batch database lookups by unique identifiers.
- **Selective Fetching**: Optimized SELECT statements to avoid loading large JSONB blobs unless specifically required for detail views.
- **Batch Inserts**: Implemented batching for correction logs to minimize database round-trips.

## 🏁 Getting Started
```bash
npm run start:dev
```
Accessible at `http://localhost:4000` (default).
