# OMR-PROD: National Cloud Hub (Web)

The central management interface for the OMR-PROD National Hub.

## 🚀 Key Features
- **Validation Queues**: Specialized side-by-side interfaces for HQ verification of field corrections.
- **Institutional Management**: Map Machine Identities to schools, manage regional monitors, and oversee nationwide registries.
- **Analytics & Monitoring**: Track sync health and examination status across all schools in real-time.
- **RBAC Enforcement**: Dynamic UI visibility based on user roles (National, Regional, School).
  - **School Admins**: Propose bubble corrections (Submit Only).
  - **Regional Monitors**: Verify and approve corrections for their region.
  - **National Admins**: Authoritative control over all nationwide data and registry.

## 🛠 Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: Vanilla CSS + shadcn/ui
- **Icons**: Lucide
- **API Connectivity**: Standardized `apiFetch` using the `contracts` shared package.

## 🏁 Getting Started
```bash
npm run dev
```
Accessible at `http://localhost:3000` (default).

## 🔐 Default Test Credentials
- **National Admin**: `admin@omr-prod.gov.ph` / `password123`
- **National Auditor**: `auditor@omr-prod.gov.ph` / `password123`
- **Regional Monitor**: `monitor.ncr@omr-prod.gov.ph` / `password123`
- **School Admin**: `admin.777@omr-prod.gov.ph` / `password123`
- **Edge Operator**: `operator1@mshs.edu.ph` / `password123`
