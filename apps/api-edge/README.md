# OMR-PROD: Edge Appliance API

The local Python-based API for the Edge Appliance, managing scanner coordination, SQLite storage, and Cloud Hub synchronization.

## 🚀 Key Features
- **Scanner Integration**: Managed via dedicated scripts for physical paper ingestion.
- **Local Persistence**: SQLite database for offline capture logs and forensic activity tracking.
- **Smart Synchronization**: Heartbeat-driven upload of scans and Activity Logs; download of HQ Resolutions and Personnel lists.
- **Quality Guardrails**: Automatic isolation of scans with < 10% recognition confidence into a dedicated `errored/` storage directory.
- **Auth Proxy**: Facilitates local operator login using HQ-synced credentials.

## 🛠 Tech Stack
- **Framework**: FastAPI (Python)
- **ORM**: SQLAlchemy (SQLite)
- **Security**: JWT-based authentication with local mirroring.

## 🏁 Getting Started
```bash
python run_edge.py
```
Accessible at `http://localhost:8000` (default).
