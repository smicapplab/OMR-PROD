# OMR-PROD: National Forensic Exam System

A production-grade, distributed Optical Mark Recognition (OMR) system designed for nationwide exam administration. This system features **Offline-First Edge Appliances** for school-site capture and a **National Cloud Hub** for authoritative grading and analytics.

## 🏗 System Architecture

### 1. Edge Appliance (The Capture Layer)
*   **Role**: Physical hardware deployed at school sites or division offices.
*   **Context**: Scans papers, performs local OMR, and generates forensic SHA-256 hashes.
*   **Data Strategy**: Decoupled from institutional IDs locally to maximize performance. It uses a **Machine Identity** for all cloud communication.
*   **Local Storage**: SQLite database storing capture logs, operator audit trails, and raw images.

### 2. National Hub (The Authoritative Layer)
*   **Role**: Centralized cloud infrastructure for grading, monitoring, and long-term storage.
*   **Context**: Manages the "Human Registry" (RBAC) and "Appliance Registry".
*   **Data Strategy**: Resolves stable **School Codes** from Edge payloads into internal UUIDs for database integrity.
*   **Security**: Enforces visibility boundaries (National, Regional, Institutional).

---

## 🔐 Security & Visibility Matrix (RBAC)

The system enforces strict data boundaries based on the user's assigned **Visibility Scope**.

| Role | Visibility Scope | Data Access | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `NATIONAL` | All nationwide scans. | Manage Registry, Approve Appliances, Reset System. |
| **NATIONAL_AUDITOR**| `NATIONAL` | All nationwide scans. | Read-only access to all forensic logs and grading details. |
| **DEPED_MONITOR** | `REGIONAL` | All schools in assigned Region. | Read-only analytics and sync stream for their region. |
| **SCHOOL_ADMIN** | `SCHOOL` | Scans for assigned School(s). | Review/Approve bubble corrections; Manage local ops. |
| **EDGE_OPERATOR** | `APPLIANCE` | Local machine scans only. | Capture papers, verify bubble confidence, trigger sync. |

---

## 📟 Appliance Enrollment Workflow

To prevent unauthorized data injection, every Edge Appliance must be approved by a National Administrator.

### 1. Edge Request (Self-Registration)
On the Edge Appliance terminal:
```bash
# Register the machine name (e.g. NCR-BOX-001)
python enroll.py http://cloud-hub-address:4000
```
This generates a unique **Machine Secret** and creates a `PENDING` record in the Cloud Hub.

### 2. National Approval
1. Log in to the **National Hub** as `SUPER_ADMIN`.
2. Navigate to **Appliance Registry**.
3. Locate the new machine in the **Pending Approval** queue.
4. Click **Approve & Deploy**, assigning the machine to its authorized Schools or Regions.

### 3. Authorized Sync
Once `ACTIVE`, the machine can sync. The Cloud Hub verifies the `X-Machine-Secret` header on every request.

---

## 📡 Data Integrity & Sync Logic

*   **Stable Identifiers**: Edge machines send stable **School Codes** (e.g., `305312`) in the sync payload.
*   **Resilient Lookup**: The Cloud Hub attempts to resolve the payload ID to a UUID. If the payload ID is missing or "orphaned" (e.g. after a DB reset), the Hub automatically assigns the data to the machine's primary authorized school.
*   **Forensic Naming**: Raw images are renamed locally to their **SHA-256 hash** before being moved to the `success/` folder to prevent name collisions and ensure a permanent forensic link.

---

## 🛠 Developer Operations

### Cloud Hub Reset (Postgres)
Wipes the cloud database, pushes the schema, and seeds standard regions, schools, and the Super Admin.
```bash
./scripts/reset-db-demo.sh
```

### Edge Machine Reset (SQLite)
Wipes local scans, initializes SQLite, and configures the machine as `MACHINE-00001` for testing.
```bash
./scripts/reset-edge-demo.sh
```

### Default Test Credentials
*   **National Admin**: `admin@omr-prod.gov.ph` / `admin-secure-password`
*   **Regional Monitor**: `monitor.ncr@omr-prod.gov.ph` / `password123`
*   **School Admin**: `admin.777@omr-prod.gov.ph` / `password123`
*   **Edge Operator**: `operator1@mshs.edu.ph` / `password123`
