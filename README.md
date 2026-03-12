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
| **SUPER_ADMIN** | `NATIONAL` | **Full Read/Write**: Access to all nationwide records, scans, and master images. | Manage institutional registries, approve appliances, provision all users, modify answer keys, and finalize all QA queues. |
| **NATIONAL_AUDITOR**| `NATIONAL` | **Full Read-Only**: Access to all nationwide records and the complete forensic audit trail. | View-only access to all registries and queues. Cannot modify data, approve corrections, or change system configuration. |
| **DEPED_MONITOR** | `REGIONAL` / `SCHOOL` | **Role-Filtered Read-Only**: Access to analytics and records for assigned Region(s) or School(s). | Monitor sync progress, view student scores, and track regional performance. Cannot edit bubbles or manage personnel. |
| **SCHOOL_ADMIN** | `SCHOOL` | **Institutional Read/Write**: Access only to students assigned to their specific institution. | Review/Approve field corrections, manage local operators, and oversee the institutional sync status. Access restricted to their home school. |
| **EDGE_OPERATOR** | `APPLIANCE` | **Physical Local Access**: Access only to scans captured on the specific physical unit they are logged into. | Perform OMR scans, verify bubble confidence, and file manual data corrections. Cannot access the National Hub directly. |

### Scoping Summary:
*   **National Personnel**: See the "Global Stream" (unfiltered).
*   **Regional/Division Personnel**: See the "Regional Stream" (filtered by geographic boundaries).
*   **Institutional Personnel**: See the "School Stream" (filtered by school code).
*   **Field Personnel**: Bound to the **Appliance Identity**.

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
*   **National Admin**: `admin@omr-prod.gov.ph` / `admin-secure-password`
*   **Regional Monitor**: `monitor.ncr@omr-prod.gov.ph` / `password123`
*   **School Admin**: `admin.777@omr-prod.gov.ph` / `password123`
*   **Edge Operator**: `operator1@mshs.edu.ph` / `password123` (Linked to MACHINE-00001)
