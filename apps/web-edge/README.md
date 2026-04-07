# OMR-PROD: Edge Appliance (Web)

The local operator interface for school-site data capture and verification.

## 🚀 Key Features
- **Bubble Editor**: Fine-grained OMR correction for low-confidence scans.
- **Quality Management**: Dedicated "Errored Sheets" queue for identifying and correcting scans falling below the 10% confidence threshold.
- **Secure Navigation**: Unified Sidebar with real-time notification badges for pending administrative actions.
- **Activity Log Slider**: Full forensic audit trail for all local operator actions.
- **Offline Reliability**: Local SQLite storage ensures zero data loss during network outages.
- **Self-Enrollment**: Built-in machine identification and HQ authorization flow.

## 🛠 Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: Vanilla CSS + shadcn/ui
- **Icons**: Lucide
- **Database (Client)**: SQLite (accessed via the `api-edge` Python backend)

## 🏁 Getting Started
```bash
npm run dev
```
Accessible at `http://localhost:3000` (default).

## 🔐 Default Test Credentials
- **Edge Operator**: `operator1@mshs.edu.ph` / `password123`
- **School Admin**: `admin.777@omr-prod.gov.ph` / `password123`
