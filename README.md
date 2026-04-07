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

## 🌐 Live Demo System

Explore the production-simulated environment at these addresses:

### [National Cloud Hub](https://cloud.139.162.17.189.nip.io/)
*   **Role**: Centralized cloud infrastructure for nationwide grading, regional monitoring, and authoritative audits.
*   **Credentials**: `admin@omr-prod.gov.ph` / `password123`

### [Edge Appliance](https://edge.139.162.17.189.nip.io/)
*   **Role**: Local school-site capture layer. Simulates the physical hardware used by operators to scan, locally verify, and sync paper data to the hub.
*   **Credentials**: `operator1@mshs.edu.ph` / `password123`

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

### Errored Sheets Workflow
Scans with recognition confidence below 10% are automatically isolated for manual review.
*   **Edge Isolation**: Errored images are moved to a dedicated `errored/` directory and synced to the cloud with an `errored` status.
*   **Edge Correction**: Operators can use the integrated **Bubble Editor** to perform a best-effort correction before sync.
*   **Authoritative Review**: National QA must perform an authoritative review (Correct or Mark Invalid) before the record is finalized.

### Side-by-Side Validation
Manual field corrections are automatically flagged for HQ verification:
*   **Interface**: Side-by-side comparison of **Original Capture** vs. **Field Correction**.
*   **Reference**: Access to the high-resolution **Official Master Scan** as visual proof.
*   **Finality**: HQ "Commit" triggers the **Authoritative Grading Service** for immediate score recalculation.

---

## 🍎 macOS Installation

### 1. Install Homebrew
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Docker Desktop
```bash
brew install --cask docker
```
Start the Docker Desktop application after installation.

### 3. Install Node.js (via fnm)
```bash
brew install fnm
# Add to ~/.zshrc or ~/.bash_profile:
# eval "$(fnm env --use-on-cd)"
fnm install --lts
fnm use --lts
```

### 4. Install Python 3 & PM2
```bash
brew install python
npm install -g pm2
```

### 5. First-Time Setup
Run once after cloning. Creates `.env` files, installs all dependencies, sets up the Python venv, and seeds both databases.
```bash
./scripts/init.sh
```

### 6. Daily Development
```bash
./scripts/dev.sh
```
Clears stale ports, auto-generates and applies any pending schema migrations, then starts all four services with hot reload.

### Run as Demo (PM2)
```bash
./scripts/demo.sh
```
Runs all four services as persistent PM2 processes on a single machine.

---

## 🐧 Linux Standalone Installation (Debian/RHEL/Linode)

### 1. Install Docker & Docker Compose
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER && newgrp docker
```

### 2. Install Node.js Dependencies & fnm
```bash
# Debian/Ubuntu:
sudo apt update && sudo apt install curl unzip -y
# RHEL/Fedora:
sudo dnf install curl unzip -y

curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install --lts
fnm use --lts
```

### 3. Verify Python 3 & venv
```bash
python3 --version
# Debian/Ubuntu:
sudo apt update && sudo apt install python3-venv -y
# RHEL/Fedora:
sudo dnf install python3 -y
```

### 4. Install PM2
```bash
npm install -g pm2
```

### 5. First-Time Setup
```bash
./scripts/init.sh
```

### 6. Daily Development
```bash
./scripts/dev.sh
```

### Run as Demo (PM2)
```bash
./scripts/demo.sh
```

---

## 🌐 Remote / Linode Deployment

When running on a remote server (e.g., a Linode VPS), all service URLs must be updated so browsers can reach the APIs. Edit these four files after running `./scripts/init.sh`:

**`apps/api-cloud/.env`** — Cloud API server config
```env
PORT=4000
CORS_ORIGINS="http://<server-ip>:3000,http://<server-ip>:3001"
```

**`apps/web-cloud/.env.local`** — Cloud frontend points to the Cloud API
```env
NEXT_PUBLIC_API_URL=http://<server-ip>:4000
```

**`apps/web-edge/.env.local`** — Edge frontend points to the Edge API
```env
NEXT_PUBLIC_API_URL=http://<server-ip>:8000
NEXT_PUBLIC_MACHINE_ID=MACHINE-00001
```

**`apps/api-edge/.env`** — Edge API syncs back to the Cloud API
```env
CLOUD_API_URL=http://<server-ip>:4000
CORS_ORIGINS="http://<server-ip>:3000,http://<server-ip>:3001"
```

Replace `<server-ip>` with your Linode's public IP address. Then start everything with `./scripts/demo.sh`.

> **Firewall**: Make sure ports `3000`, `3001`, `4000`, and `8000` are open in your server's firewall / security group.

### Securing with Nginx and Free SSL (Let's Encrypt)
To safely expose the applications over standard HTTPS ports (443) and encrypt all traffic, install Nginx as a reverse proxy alongside Certbot.

#### 1. Install Dependencies
```bash
# Debian/Ubuntu:
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# RHEL/Fedora/AlmaLinux:
sudo dnf install epel-release -y
sudo dnf install nginx certbot python3-certbot-nginx -y
```

#### 2. Configure Nginx Server Blocks
Create a new configuration file for your domains (e.g., `sudo nano /etc/nginx/sites-available/omr-prod`):
```nginx
# Cloud Front-End
server {
    listen 80;
    server_name cloud.yourdomain.com;
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Cloud API
server {
    listen 80;
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Edge Front-End
server {
    listen 80;
    server_name edge.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Edge API
server {
    listen 80;
    server_name edge-api.yourdomain.com;
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/omr-prod /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 3. Request Free SSL Certificates
Run Certbot to automatically verify your domains and rewrite the Nginx configuration with proper HTTPS SSL certificates:
```bash
sudo certbot --nginx -d cloud.yourdomain.com -d api.yourdomain.com -d edge.yourdomain.com -d edge-api.yourdomain.com
```
*Note: Ensure your domain DNS A records are pointing to your server's public IP address before running Certbot, and that your `.env` frontend URLs are updated to match the new `https://` domain names rather than raw IPs.*

---

## 🛠 Developer Operations

### Scripts Overview

| Script | When to use |
| :--- | :--- |
| `scripts/init.sh` | **Once** on a fresh clone — sets up `.env` files, installs deps, creates Python venv, seeds both DBs |
| `scripts/dev.sh` | **Every day** — starts all services with hot reload; auto-migrates schema changes |
| `scripts/reset-db.sh` | Wipe and reseed **both** databases (Cloud + Edge) with no confirmation prompt |
| `scripts/demo.sh` | Run all four services via **PM2** on a single machine for demos / remote servers |

### Database Reset
Wipes Cloud (Postgres) and Edge (SQLite), reapplies migrations, and reseeds all demo data:
```bash
./scripts/reset-db.sh
```

### Default Test Credentials
*   **National Admin**: `admin@omr-prod.gov.ph` / `password123`
*   **National Auditor**: `auditor@omr-prod.gov.ph` / `password123`
*   **Regional Monitor**: `monitor.ncr@omr-prod.gov.ph` / `password123`
*   **School Admin**: `admin.777@omr-prod.gov.ph` / `password123`
*   **Edge Operator**: `operator1@mshs.edu.ph` / `password123` (linked to MACHINE-00001)

### Scan Directories
Raw scans, processed images, and results are stored at the **project root** (not inside any app):

```
raw_scans/   ← drop files here to simulate scanner input
uploads/     ← scans staged for cloud sync
success/     ← processed scans (served as static files by api-edge)
error/       ← scans that failed OMR processing
```

These directories are created automatically by `./scripts/init.sh`.
