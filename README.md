# OMR-PROD: Distributed Forensic Exam System

A production-grade, distributed Optical Mark Recognition (OMR) system designed for nationwide exam administration. This system features **Offline-First Edge Appliances** for school-site capture and a **National Cloud Hub** for authoritative grading and monitoring.

## 🌟 Key Features

- **Offline-First Edge Hub**: Process exam sheets locally at school sites without internet connectivity.
- **Forensic Integrity**: Every scan is hashed (SHA-256) at the point of capture to ensure data immutability.
- **Hierarchical Sync**: Automated bidirectional sync between Edge Appliances and the National Hub.
- **Authoritative Cloud Grading**: Grading logic is centralized in the cloud to prevent local tampering.
- **Audit Trail**: Full manual correction history with operator identification.
- **Advanced OMR Engine**: OpenCV-based processing with 4-point fiducial alignment and confidence scoring.

## 🏗 System Architecture

- **`apps/api-edge` (Python/FastAPI)**: Runs on local appliances. Handles OMR processing and local auth.
- **`apps/api-cloud` (NestJS)**: The National Hub backend. Handles global state and authoritative grading.
- **`apps/web-edge` (Next.js)**: Local operator console for scanning and manual verification.
- **`apps/web-cloud` (Next.js)**: National monitoring dashboard and management portal.
- **`packages/database`**: Shared Drizzle ORM schema for both PostgreSQL (Cloud) and SQLite (Edge).

## 🚀 Getting Started

### Prerequisites

- Node.js (v20+)
- pnpm or npm
- Docker & Docker Compose
- Python 3.9+ (for Edge API)

### 1. Database Setup

Start the National Hub database:
```bash
docker-compose up -d
```

Initialize the cloud schema:
```bash
cd OMR-PROD
npm run db:push
```

### 2. Environment Configuration

Copy the example environment files:
```bash
cp .env.example .env
cp apps/api-cloud/.env.example apps/api-cloud/.env
cp apps/web-edge/.env.local.example apps/web-edge/.env.local
```

### 3. Installation & Development

Install dependencies from the root:
```bash
npm install
```

Start all services in development mode:
```bash
npm run dev
```

## 🌐 Access Portals

- **Edge Console**: `http://localhost:3000` (Local scanning & correction)
- **National Hub**: `http://localhost:3001` (Global monitoring)
- **Cloud API**: `http://localhost:4000` (National backend)
- **Edge API**: `http://localhost:8000` (Local appliance backend)

## 🔐 Forensic Integrity Workflow

1. **Capture**: Scanner drops image in `uploads/` folder.
2. **Hash**: System generates SHA-256 of the raw master image.
3. **Process**: OMR engine extracts bubble data and generates a low-res WebP proxy.
4. **Verify**: Local operator corrects any ambiguous bubbles (Audit log created).
5. **Sync**: Master image, proxy, and data are pushed to Cloud Hub using the **Machine Secret**.
6. **Grade**: Cloud Hub verifies SHA-256 and performs authoritative grading against master keys.

## 📟 Machine Enrollment (Edge-to-Cloud)

To ensure secure data transmission, every Edge Appliance must be enrolled in the National Hub before it can sync data.

### 1. Authorize on Cloud Portal
1. Log in to the **National Hub** (`localhost:3001`) as a `SUPER_ADMIN`.
2. Navigate to **Edge Appliances**.
3. Click **Authorize Appliance**, enter a unique Machine ID (e.g., `EDGE-NCR-001`), and select the target School.
4. Copy the generated **Enrollment Token**.

### 2. Enroll via Edge CLI
On the physical Edge Appliance, run the enrollment script:
```bash
cd apps/api-edge
# Usage: python enroll.py <TOKEN> <CLOUD_URL>
python enroll.py ABCD-1234 http://cloud-hub-address:4000
```
This will exchange the one-time token for a permanent **Machine Secret**, stored in `apps/api-edge/.env`.

## 👥 User Roles & Access Control

The system uses a hierarchical role structure to maintain security:

| Role | Scope | Key Capabilities |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | National | Manage Regions, Schools, Users, and Answer Keys. |
| **REGIONAL_DIRECTOR** | Regional | View-only access to all school stats within their assigned region. |
| **SCHOOL_ADMIN** | Institutional | Approve/Override local OMR corrections; Manage local operators. |
| **EDGE_OPERATOR** | Appliance | Perform scans, verify bubble confidence, and trigger syncs. |

### Assigning Operators
Operators are created in the **National Hub** under **User Registry**. 
- Set the `Visibility Scope` to `SCHOOL`.
- Assign the `Scope Value` to the specific School ID.
- Once created, the Edge Appliance will automatically pull these credentials during its next sync cycle (every 30 seconds).
