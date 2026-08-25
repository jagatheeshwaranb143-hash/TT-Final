# SmartSchedule — Live Application Deployment & Verification

SmartSchedule is now fully configured, bootstrapped, and running live on your local machine!

---

## 🚀 Live Services Status

| Service | URL | Status | Details |
| :--- | :--- | :---: | :--- |
| **Backend API** | [http://127.0.0.1:8000](http://127.0.0.1:8000) | **ONLINE** | FastAPI 0.115 + SQLAlchemy 2.0 (SQLite Async) |
| **Interactive Docs** | [http://127.0.0.1:8000/api/docs](http://127.0.0.1:8000/api/docs) | **ONLINE** | Swagger UI with OpenAPI 3.1.0 |
| **Web Dashboard** | [http://localhost:3000](http://localhost:3000) | **ONLINE** | Next.js 14 App Router + Tailwind CSS |

---

## 🔑 Demo Login Credentials

The local database has been pre-seeded with initial accounts for testing:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@smartschedule.dev` | `admin123` | Full institution & user control |
| **Head of Department (HOD)** | `hod@smartschedule.dev` | `hod123` | Department timetable & faculty management |
| **Faculty** | `faculty@smartschedule.dev` | `faculty123` | Personal timetable & availability view |

---

## 🖥️ Quick Launch Scripts

Convenience scripts are ready in your workspace folder:

```powershell
# Launch both backend and web together in separate windows:
.\start_all.ps1

# Or run individually:
.\start_backend.ps1   # Runs FastAPI on http://127.0.0.1:8000
.\start_web.ps1       # Runs Next.js on http://localhost:3000
```
