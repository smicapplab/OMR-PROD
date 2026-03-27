# OMR-PROD: National Examination System

A production-grade, distributed Optical Mark Recognition (OMR) system designed for nationwide exam administration. This system features **Offline-First Edge Appliances** for school-site capture and a **National Cloud Hub** for authoritative grading, audit management, and regional monitoring.

## 🏗 System Architecture

### 1. Edge Appliance (The Capture Layer)
*   **Role**: Physical hardware deployed at school sites or division offices.
*   **Context**: Scans papers, performs local OMR, and generates integrity SHA-256 hashes.
*   **Decoupled Logic**: The appliance is institutional-neutral; it identifies itself via a **Machine Identity** and sends raw capture data to the center.
*   **Local Storage**: SQLite database storing capture logs, operator audit trails, and raw images.
*   **Bidirectional Sync**: Pushes capture data and audit logs; pulls authorized personnel lists and HQ resolutions.

### 2. National Hub (The Authoritative Layer)
*   **Role**: Centralized cloud infrastructure for grading, monitoring, and long-term storage.
*   **Human Registry**: Implements a strict RBAC model with multi-level visibility scoping.
*   **Grading Engine**: Centralized **Grading Service** ensures 100% score consistency between field capture and HQ audits.
*   **Correction Hub**: Manages specialized queues for institutional assignment and bubble verification.

---

## 🔐 Security & Visibility Matrix (Detailed RBAC)

The system enforces strict data boundaries and functional privileges based on the user's assigned **Role** and **Visibility Scope**.

| Role | Visibility Scope | Data Access Rights | System Privileges |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `NATIONAL` | **Full Read/Write**: Access to all nationwide records, scans, and master images. | Manage institutional registries, approve appliances, provision all users, modify answer keys, and finalize/approve all QA queues. |
| **NATIONAL_AUDITOR**| `NATIONAL` | **Full Read-Only**: Access to all nationwide records and the complete forensic audit trail. | View-only access to all registries and queues. Cannot modify data or approve corrections. |
| **DEPED_MONITOR** | `REGIONAL` | **Regional Read/Write**: Access to analytics and records for assigned Region(s). | Monitor sync progress, submit proposed bubble corrections, and **approve** QA corrections for schools within their region. |
| **SCHOOL_ADMIN** | `SCHOOL` | **Institutional Read/Write**: Access only to students assigned to their specific institution. | Manage local operators, oversee institutional sync, and **submit** proposed bubble corrections for HQ review. Cannot approve their own submissions. |
| **EDGE_OPERATOR** | `APPLIANCE` | **Physical Local Access**: Access only to scans captured on the specific physical unit they are logged into. | Perform OMR scans, verify bubble confidence, and file manual data corrections locally. |

### Scoping Summary:
*   **National Personnel**: Global oversight (National Registry).
*   **Regional Monitors**: Regional authority (Submit & Approve for their region).
*   **School Admins**: Institutional management (Submit for their school; requires Regional/National approval).
*   **Edge Operators**: Field capture (Local OMR verification).

---

## 📟 Appliance Lifecycle (The Circle of Trust)

### 1. Self-Registration (The Knock)
New hardware must request access. On the Edge Appliance:
```bash
python enroll.py http://cloud-hub-address:4000
```
This generates a unique **Machine Secret** and creates a `PENDING` record in the National Hub.

### 2. National Approval (The Key)
A `SUPER_ADMIN` reviews the request in the **Appliance Registry**, verifies the physical serial number, and clicks **Approve & Deploy**, assigning the unit to its authorized Schools/Regions.

### 3. State Synchronization (The Feedback)
Every 30 seconds, the Edge performs a heartbeat:
*   **Upload**: Pushes new scans and **Activity Logs** (local audit trails).
*   **Download**: Pulls **HQ Resolutions**. If HQ approves a correction, the Edge locks the local record and clears the "Pending" status.

---

## 📡 Data Integrity & QA Workflows

### Orphaned Paper Workflow
If a student bubbles an invalid School Code, the Cloud Hub accepts the data but marks it as `orphaned`. 
*   **Correction Queue**: Orphaned scans are held for manual school assignment by National QA.
*   **Audit**: Every institutional assignment is permanently logged in the **Audit History**.

### Side-by-Side Validation
Manual field corrections are automatically flagged for HQ verification:
*   **Interface**: Side-by-side comparison of **Original Capture** vs. **Field Correction**.
*   **Reference**: Access to the high-resolution **Official Master Scan** as visual proof.
*   **Finality**: HQ "Commit" triggers the **Authoritative Grading Service** for immediate score recalculation.

---

## 🚀 Recent Modernization & Optimizations

We recently completed a systematic upgrade of the OMR-PROD codebase to improve stability, transparency, and performance.

### 🛠️ Key Improvements:
- **Harmonized Audit Trail**: Ported the premium Edge ActivityLog Slider and recursive delta-comparison logic to the Cloud Hub, ensuring a unified forensic experience.
- **Backend Performance**: 
  - Resolved **N+1 query patterns** in sync and search endpoints.
  - Refined **SELECT statements** to fetch only necessary summary fields, reducing bandwidth for large JSONB datasets.
  - Implemented **Batch Insertion** for high-volume activity logs.
- **Runtime Reliability**: Fixed critical date-parsing bugs and payload mismatches (`createdAt` vs `created_at`) across the Python/TypeScript bridge.
- **Full TypeScript Adoption**: Systematic removal of legacy `any` types and unused variables across the monorepo for improved maintainability.

---

## 🍎 MacOS Installation

This section provides instructions for setting up OMR-PROD on macOS.

### 1. Install Homebrew
Homebrew is the essential package manager for macOS.
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Docker Desktop
OMR-PROD uses Docker for the Cloud Hub database. Install it via Homebrew Cask or download from the official website.
```bash
brew install --cask docker
```
*Make sure to start the Docker Desktop application after installation.*

### 3. Install Node.js (via fnm)
We recommend **fnm** for managing Node.js versions.
```bash
brew install fnm
# Add eval "$(fnm env --use-on-cd)" to your ~/.zshrc or ~/.bash_profile
fnm install --lts
fnm use --lts
```

### 4. Install Python 3 & PM2
```bash
brew install python
npm install -g pm2
```

### 5. Deployment Workflow
```bash
# 1. Initialize Database (Cloud Hub)
./scripts/reset-db-demo.sh

# 2. Install Dependencies & Build
npm install
npm run build

# 3. Run the Demo
./scripts/run-demo.sh
```

---

## 🐧 Linux Standalone Installation (Debian/RHEL/Linode)

This section provides distribution-agnostic instructions for setting up OMR-PROD on a clean Linux system (e.g., Linode, VPS, or local server).

### 1. Install Docker & Docker Compose
The most agnostic way to install Docker on Linux is using the official convenience script:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER && newgrp docker # Allow running docker without sudo
```

### 2. Install Node.js (via fnm)
We recommend **fnm** (Fast Node Manager) as it is a single-binary version manager that works across all shells.
```bash
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc # Or restart your shell
fnm install --lts
fnm use --lts
```

### 3. Verify Python 3 & venv
Most modern Linux distributions come with Python 3.10+. Ensure it is installed along with the venv module:
```bash
python3 --version
# On Debian/Ubuntu: sudo apt update && sudo apt install python3-venv -y
# On RHEL/Fedora: sudo dnf install python3 -y
```

### 4. Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### 5. Deployment Workflow
Once the environment is ready, follow these steps to deploy the OMR-PROD demo:

```bash
# 1. Initialize Database (Cloud Hub)
./scripts/reset-db-demo.sh

# 2. Install Dependencies & Build
npm install
npm run build

# 3. Run the Demo
./scripts/run-demo.sh
```

---

## 🛠 Developer Operations

### Workspace Management
```bash
npm install && npm run build
```

### Database Reset (Local Testing)
**Cloud Hub (Postgres)**: Wipes DB, pushes schema, seeds NCR/R4A, test schools, and Super Admin.
```bash
./scripts/reset-db-demo.sh
```

**Edge Machine (SQLite)**: Wipes local data, initializes `MACHINE-00001`, and pulls authorized operators.
```bash
./scripts/reset-edge-demo.sh
```

### Default Test Credentials
*   **National Admin**: `admin@omr-prod.gov.ph` / `password123`
*   **National Auditor**: `auditor@omr-prod.gov.ph` / `password123`
*   **Regional Monitor**: `monitor.ncr@omr-prod.gov.ph` / `password123`
*   **School Admin**: `admin.777@omr-prod.gov.ph` / `password123`
*   **Edge Operator**: `operator1@mshs.edu.ph` / `password123` (Linked to MACHINE-00001)
