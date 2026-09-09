# SIH 2026 - Landslide Risk Assessment & Early Warning System

An AI/ML & Geospatial Early Warning System designed to predict landslide risk, generate real-time grid and village-level risk scores, and present dynamic alerts for disaster management authorities and citizens.

👉 **[View Full SIH Prototype Build Plan & Feature List Document](file:///a:/SIH2026/SIH_landslide/sih_26/SIH_BUILD_PLAN.md)**

---

## 🏗️ System Architecture

- **Frontend**: React + Vite (Interactive GIS Mapbox/Leaflet UI, analytics charts, alerts).
- **Backend API**: FastAPI (Python) with GeoJSON rendering, dynamic risk calculation, and PostGIS integration.
- **Database**: PostgreSQL with PostGIS extension for spatial queries (point-in-polygon, buffer zones) & TimescaleDB for time-series feeds.
- **ML & Data Layer**: Google Earth Engine (GEE) Python API, SRTM DEM terrain features, IMD/NASA IMERG rainfall triggers, NASA SMAP soil moisture, and XGBoost ML Classifier with SHAP explainability.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL with PostGIS extension (optional for standalone GEE mode)

### 2. Environment Setup

#### Setup Python Virtual Environment (`.venv`)
```powershell
# Create virtual environment in root
python -m venv .venv

# Activate virtual environment
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# On Linux/macOS:
source .venv/bin/activate

# Install backend & ML dependencies
pip install -r backend/requirements.txt
```

#### Configure Environment Variables (`.env`)
Ensure you have a `.env` file in the project root:
```env
# Google Earth Engine Configuration
GEE_PROJECT_ID=sih-landslide-2026
```

---

## 🏃 Running the Application

### Running the Backend API
```powershell
# Activate .venv first
.\.venv\Scripts\Activate.ps1

# Start FastAPI server with live reload
python -m uvicorn backend.main:app --reload --port 8000
```
- Interactive API Documentation (Swagger UI): `http://localhost:8000/docs`
- Redoc API Documentation: `http://localhost:8000/redoc`

### Running the Frontend Dashboard
```powershell
cd frontend

# Install dependencies (first time only)
npm install

# Start Vite dev server
npm run dev
```
- Frontend Dashboard: `http://localhost:5173`

---

## 🤖 ML Pipeline & Earth Engine Integration

1. **Test GEE Authentication**:
   ```powershell
   python ml/test_gee.py
   ```
2. **Prepare Dataset**:
   ```powershell
   python ml/prepare_data.py
   ```
3. **Train XGBoost Model**:
   ```powershell
   python ml/train.py
   ```
4. **Run Risk Prediction Inference**:
   ```powershell
   python ml/predict.py
   ```

---

## 🛡️ Security & Privacy
- **Secrets Management**: Credentials, environment-specific variables, and GEE project keys are managed strictly via `.env` and kept out of version control.
- **Git Ignore**: `.venv/`, `.env`, `node_modules/`, editor settings (`.vscode/`), and model binaries (`*.joblib`) are excluded via `.gitignore`.
