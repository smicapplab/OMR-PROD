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

## 🔐 Security & Visibility Matrix (RBAC)

The system enforces strict data boundaries based on the user's assigned **Visibility Scope**.

| Role | Visibility Scope | Data Access | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `NATIONAL` | Full nationwide access. | Manage Registry, Approve Appliances, Reset System. |
| **NATIONAL_AUDITOR**| `NATIONAL` | All nationwide scans. | Read-only access to all audit logs and grading details. |
| **DEPED_MONITOR** | `REGIONAL` | Assigned Region only. | Read-only analytics and sync stream for their region. |
| **SCHOOL_ADMIN** | `SCHOOL` | Assigned School(s). | Review/Approve bubble corrections; Manage local ops. |
| **EDGE_OPERATOR** | `APPLIANCE` | Local machine only. | Capture papers, verify bubble confidence, file corrections. |

---

## 📟 Appliance Lifecycle (The Circle of Trust)

To ensure system integrity, every Edge Appliance must be authorized through a formal "knocking" process.

### 1. Self-Registration (The Knock)
On the Edge Appliance:
```bash
# Register the machine name (e.g. MSHS-BOX-01)
python enroll.py http://cloud-hub-address:4000
```
The machine receives a unique **Machine Secret**, stored securely in its local environment. The record is created as `PENDING` in the Cloud.

### 2. National Approval (The Key)
1. A National Admin locates the machine in the **Appliance Registry**.
2. The Admin clicks **Approve & Deploy**, assigning the machine to its authorized Schools or Regions.
3. Status moves to `ACTIVE`.

### 3. State Synchronization (The Feedback)
Every 30 seconds, the Edge performs a heartbeat sync:
*   **Upload**: Pushes new scans and local **Activity Logs** (audit trails).
*   **Download**: Pulls **Resolutions** (HQ decisions). If HQ approves a correction, the Edge locks the local record and clears the "Pending" flags.

---

## 📡 Data Integrity & QA Workflows

### Orphaned Paper Workflow
The Cloud Hub **never assumes** institutional identity. If a student bubbles an invalid School Code or the machine services multiple schools:
1.  The scan is accepted but marked as `orphaned`.
2.  It is routed to the **Correction Queue** for National QA review.
3.  QA manually assigns the record to the correct school based on student metadata.

### Side-by-Side Validation
Any manual correction filed by an Edge Operator is automatically flagged for HQ verification:
*   **Interface**: Side-by-side comparison of **Original OMR** vs. **Field Correction**.
*   **Reference**: High-resolution zoomable/pannable official master scan provided as visual evidence.
*   **Finality**: Once HQ "Commits," the record is re-graded using the authoritative Grading Service.

---

## 🛠 Developer Operations

### Workspace Management
This is an **npm workspace**. To initialize the environment:
```bash
npm install
npm run build
```

### Database Reset (Local Testing)
**Cloud Hub (Postgres)**: Wipes the DB, pushes schema, seeds NCR/R-IV-A, test schools, and Super Admin.
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
*   **Edge Operator**: `operator1@mshs.edu.ph` / `password123` (Assigned to MACHINE-00001)
