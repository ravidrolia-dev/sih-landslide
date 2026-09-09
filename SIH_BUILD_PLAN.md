# SIH 2026 - AI-Based Early Warning & Landslide Risk Monitoring System
## Prototype Build Plan & Feature Mapping Document
**Problem Statement Owner:** Ministry of Development of North Eastern Region (MDoNER)  
**Category / Theme:** Software — Disaster Management  

---

## 🌟 Executive Summary
A cloud-based geospatial platform that fuses satellite precipitation data (NASA GPM IMERG V07), antecedent soil saturation, vegetation density (Sentinel-2 NDVI), and terrain geomorphology (USGS SRTM 30m DEM) with an XGBoost Machine Learning model to predict landslide-prone zones across the **8 North Eastern Region (NER) states** in real-time.

---

## 📊 Feature Mapping (Build Plan vs. Implemented System)

### Tier 1 — Core Pipeline (100% Implemented)
| # | Feature Name | Build Plan Description | Implementation Status & Code Location |
|---|---|---|---|
| **1** | **GIS Risk Dashboard** | Interactive map with color-coded risk heatmap & markers | ✅ **Implemented** in [`RiskMap.jsx`](file:///a:/SIH2026/SIH_landslide/sih_26/frontend/src/RiskMap.jsx) (Leaflet + OpenTopoMap + GSI Geology WMS) |
| **2** | **ML Risk Prediction Engine** | Trained classifier outputting 0–100 risk score | ✅ **Implemented** in [`train.py`](file:///a:/SIH2026/SIH_landslide/sih_26/ml/train.py) & [`predict.py`](file:///a:/SIH2026/SIH_landslide/sih_26/ml/predict.py) (XGBoost 0-100 risk score) |
| **3** | **Backend + Spatial Database** | REST API + PostGIS storing grid cells & risk scores | ✅ **Implemented** in [`main.py`](file:///a:/SIH2026/SIH_landslide/sih_26/backend/main.py) & [`models.py`](file:///a:/SIH2026/SIH_landslide/sih_26/backend/models.py) (FastAPI + GeoJSON + PostGIS) |
| **4** | **Threshold-Based Alerting** | Auto-categorized risk levels (Watch, Alert, Warning, Severe) | ✅ **Implemented** in [`RiskPanel.jsx`](file:///a:/SIH2026/SIH_landslide/sih_26/frontend/src/RiskPanel.jsx) (IMD Color Tiers + AI Advisories) |
| **5** | **Real-Time User Location Scan** | Instant GPS location scan with live satellite risk prediction | ✅ **Implemented** in [`App.jsx`](file:///a:/SIH2026/SIH_landslide/sih_26/frontend/src/App.jsx) (`navigator.geolocation` + GEE satellite scan) |

---

### Tier 2 — High-Impact Differentiators (Implemented)
| # | Feature Name | Build Plan Description | Implementation Status & Code Location |
|---|---|---|---|
| **6** | **Explainable Risk Scores (XAI)** | Per-location breakdown of contributing factors via SHAP | ✅ **Implemented** in [`predict.py`](file:///a:/SIH2026/SIH_landslide/sih_26/ml/predict.py) & [`RiskPanel.jsx`](file:///a:/SIH2026/SIH_landslide/sih_26/frontend/src/RiskPanel.jsx) (SHAP TreeExplainer feature importance bars) |
| **7** | **Historical Backtesting** | Model re-run against historical landslide dates | ✅ **Implemented** in [`backtest.py`](file:///a:/SIH2026/SIH_landslide/sih_26/ml/backtest.py) (ROC-AUC, PR-AUC & Precision-Recall evaluation) |
| **8** | **Live Satellite & GEE Integration** | Real-time extraction of DEM, NDVI, and rainfall | ✅ **Implemented** in [`gee_service.py`](file:///a:/SIH2026/SIH_landslide/sih_26/ml/gee_service.py) (SRTM 30m DEM, Sentinel-2, GPM IMERG V07) |
| **9** | **Geological & Road Overlay** | GSI Geology layer and OSM road network overlay | ✅ **Implemented** in [`RiskMap.jsx`](file:///a:/SIH2026/SIH_landslide/sih_26/frontend/src/RiskMap.jsx) (Geological Survey of India WMS integration) |
| **10**| **All 8 NER States Coverage** | Grid filtering across Meghalaya, Assam, Sikkim, etc. | ✅ **Implemented** in [`App.jsx`](file:///a:/SIH2026/SIH_landslide/sih_26/frontend/src/App.jsx) (State coverage dropdown & category filters) |

---

### Tier 3 — Pitch Deck & Future Roadmap
* **IoT Physical Soil-Moisture Mesh**: Sensor network simulated via antecedent moisture proxy.
* **Dual-Channel SMS Gateway**: MSG91 / Twilio sandbox integration for feature phone alerts.
* **Offline Field Reporting App**: Progressive Web App (PWA) with IndexedDB offline queueing.
* **Emergency Response Routing**: Shortest-path routing (Dijkstra / NetworkX) around blocked road segments.

---

## 🏛️ System Architecture Layers

```
[ Data Sources: USGS SRTM DEM | Sentinel-2 NDVI | NASA GPM IMERG V07 | GSI Geology ]
                                       │
                                       ▼
                   [ Ingestion & Earth Engine API Layer ]
                         (ml/gee_service.py)
                                       │
                                       ▼
             [ Spatial Database: PostGIS + GeoAlchemy2 + GeoJSON ]
                                       │
                                       ▼
             [ AI ML Risk Engine: XGBoost Classifier + SHAP XAI ]
                    (ml/train.py, ml/predict.py)
                                       │
                                       ▼
             [ Backend REST API: FastAPI (http://localhost:8000) ]
              • GET /risk/location  (Live GPS & GEE Scan)
              • GET /risk/heatmap   (Multi-State GeoJSON Grid)
              • GET /advisory       (AI Disaster Mitigation Advice)
                                       │
                                       ▼
        [ Interactive GIS Dashboard: React 19 + Vite + Leaflet ]
              • 🎯 Real-Time GPS User Scan
              • 🗺️ Live GEE Spatial Heatmap & GSI WMS
              • 📊 SHAP Explainability & Advisory Panel
```

---

## 🚀 Quick Execution Guide

```powershell
# 1. Start Backend API (FastAPI)
cd backend
python -m uvicorn main:app --reload --port 8000

# 2. Start Frontend Dashboard (React + Vite)
cd frontend
npm run dev
```

* **Frontend App:** `http://localhost:5173`
* **Swagger API Docs:** `http://localhost:8000/docs`
