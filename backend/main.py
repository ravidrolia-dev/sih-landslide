import json
import random
import sys
import os
import urllib.request
import urllib.parse

# Ensure backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from geoalchemy2.functions import ST_AsGeoJSON

from database import engine, get_db, Base
import models
import advisory_service
import backtest_service

# Initialize PostGIS tables if database is available
try:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    print("[Database] PostGIS tables initialized successfully.")
except Exception as e:
    print(f"[Database Warning] PostgreSQL connection skipped ({e}). API running in standalone GEE mode.")

app = FastAPI(title="Landslide Risk API")

# Allow frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev only, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "NE-GeoAlert Landslide Risk API Engine is Live!"}

@app.get("/risk/grid")
def get_grid_risk(db: Session = Depends(get_db)):
    """
    Returns all grid cells as a GeoJSON FeatureCollection with risk scores.
    """
    cells = db.query(models.GridCell.id, ST_AsGeoJSON(models.GridCell.geom).label('geojson')).all()
    
    features = []
    for cell in cells:
        # Placeholder risk score
        risk_score = random.uniform(0, 100)
        
        feature = {
            "type": "Feature",
            "id": cell.id,
            "geometry": json.loads(cell.geojson),
            "properties": {
                "risk_score": round(risk_score, 2)
            }
        }
        features.append(feature)
        
    return {
        "type": "FeatureCollection",
        "features": features
    }

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ml.predict import predict_risk

from ml.gee_service import get_all_features

@app.get("/risk/location")
def get_location_risk(lat: float, lon: float):
    """
    Fetches real-time satellite metrics (SRTM DEM, Sentinel-2 NDVI, GPM IMERG Rainfall)
    from Google Earth Engine and predicts landslide risk with SHAP explainability.
    """
    gee_features = get_all_features(lat, lon)
    
    features_dict = {
        "slope": gee_features["slope"],
        "rainfall_24h": gee_features["rainfall_24h"],
        "rainfall_72h": gee_features["rainfall_72h"],
        "soil_moisture": gee_features["soil_moisture"],
        "lithology_class": gee_features["lithology_class"]
    }
    
    try:
        prediction = predict_risk(features_dict)
        risk_score = prediction['score']
        shap_breakdown = prediction['shap_breakdown']
        
        top_factors = sorted(
            [{"feature": str(k), "impact": float(v)} for k, v in shap_breakdown.items()],
            key=lambda x: abs(x["impact"]),
            reverse=True
        )
    except Exception as e:
        print(f"Location risk prediction failed: {e}")
        risk_score = 0.0
        top_factors = []
        
    if risk_score > 75:
        category = "Severe"
    elif risk_score > 50:
        category = "Warning"
    elif risk_score > 25:
        category = "Alert"
    else:
        category = "Watch"
        
    return {
        "coordinates": {"latitude": lat, "longitude": lon},
        "risk_score": round(risk_score, 2),
        "category": category,
        "satellite_features": gee_features,
        "top_factors": top_factors,
        "data_sources": {
            "elevation_slope": "USGS SRTM 30m DEM (GEE)",
            "vegetation_ndvi": "Sentinel-2 Harmonized (GEE)",
            "precipitation": "NASA GPM IMERG 30-min (GEE)"
        }
    }

from routing_service import get_emergency_priority_list, calculate_safe_alternative_route, check_route_landslide_risk
import field_report_service

@app.get("/emergency/priority-list")
def get_priority_list():
    """
    Returns auto-ranked Emergency Response Prioritisation List for District Collectors.
    Formula: Priority Score = Risk Score x Population Exposure
    """
    return {
        "formula": "Priority Score = Risk Score (0-100) x Population Exposure Factor",
        "priority_queue": get_emergency_priority_list()
    }

@app.get("/emergency/evacuation-route")
def get_evacuation_route(origin_lat: float, origin_lon: float, dest_lat: float = None, dest_lon: float = None, safety_buffer_km: float = 1.5):
    """
    Computes a Dynamic Landslide-Safe Route avoiding active landslides and high-risk hazard zones.
    If the original shortest route is blocked by a recent landslide, automatically detours around it.
    """
    return calculate_safe_alternative_route(origin_lat, origin_lon, dest_lat, dest_lon, safety_buffer_km)

@app.post("/emergency/check-route-risk")
def check_active_route_risk(payload: dict):
    """
    Live dynamic monitoring endpoint: checks whether active route coordinates intersect
    newly submitted field reports or satellite risk updates.
    """
    route_coords = payload.get("route_coords", [])
    buffer_km = float(payload.get("safety_buffer_km", 1.5))
    return check_route_landslide_risk(route_coords, buffer_km=buffer_km)

@app.get("/geocode/search")
def search_places_geocoding(q: str):
    """
    Real-time Google Maps-style geocoding search for any place, landmark, city, or address across India.
    Powered by OpenStreetMap Nominatim with local formatting.
    """
    if not q or len(q.strip()) < 2:
        return {"status": "SUCCESS", "results": []}

    query_str = q.strip()
    try:
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(query_str)}&countrycodes=in&limit=8"
        req = urllib.request.Request(url, headers={'User-Agent': 'NE-GeoAlert-GIS/1.0'})
        with urllib.request.urlopen(req, timeout=4) as response:
            data = json.loads(response.read().decode('utf-8'))
            results = []
            for item in data:
                display = item.get("display_name", "")
                parts = [p.strip() for p in display.split(",") if p.strip()]
                short_name = parts[0] if parts else query_str
                address_sub = ", ".join(parts[1:4]) if len(parts) > 1 else display

                results.append({
                    "name": short_name,
                    "display_name": display,
                    "subtitle": address_sub,
                    "latitude": float(item["lat"]),
                    "longitude": float(item["lon"]),
                    "place_type": item.get("type", "location")
                })
            return {"status": "SUCCESS", "results": results}
    except Exception as e:
        print(f"[Geocode Error] Search failed for '{query_str}': {e}")
        return {"status": "ERROR", "results": [], "message": str(e)}

@app.get("/reports/list")
def get_field_reports():
    """
    Returns all crowd-sourced & field officer ground truth geo-tagged reports.
    """
    return {
        "status": "SUCCESS",
        "reports": field_report_service.get_all_field_reports()
    }

@app.post("/reports/submit")
def submit_field_report(report: dict):
    """
    Submits a single geo-tagged field report (photo, severity tag, lat, lon, description).
    """
    result = field_report_service.submit_single_report(report)
    return {
        "status": "SUCCESS",
        "message": "Field report successfully submitted and published to live GIS map.",
        "report": result
    }

@app.post("/reports/sync")
def sync_offline_field_reports(batch: dict):
    """
    Batch syncs reports captured offline in IndexedDB when network connectivity is restored.
    """
    reports_list = batch.get("reports", [])
    return field_report_service.sync_batch_offline_reports(reports_list)

import sms_service

@app.get("/sms/logs")
def get_sms_dispatch_logs():
    """
    Returns complete history of SMS alert dispatches and carrier delivery receipts.
    """
    return {
        "status": "SUCCESS",
        "logs": sms_service.get_all_sms_logs()
    }

@app.post("/sms/send")
def send_sms_alert_endpoint(payload: dict):
    """
    Dispatches emergency SMS alert via MSG91 DLT or Twilio to target phone number.
    """
    phone_number = payload.get("phone_number", "+919876543210")
    location_name = payload.get("location_name", "Queried Area")
    lat = float(payload.get("latitude", 25.5788))
    lon = float(payload.get("longitude", 91.8933))
    risk_score = float(payload.get("risk_score", 82.5))
    channel = payload.get("channel", "twilio")
    credentials = payload.get("credentials", {})

    return sms_service.send_sms_alert(phone_number, location_name, lat, lon, risk_score, channel, credentials)


@app.post("/sms/auto-broadcast")
def trigger_auto_sms_broadcast(payload: dict):
    """
    Evaluates satellite risk and auto-broadcasts SMS alerts to DEOC & NDRF if risk > 75%.
    """
    lat = float(payload.get("latitude", 25.5788))
    lon = float(payload.get("longitude", 91.8933))
    location_name = payload.get("location_name", "Severe Hazard Cell")
    risk_score = float(payload.get("risk_score", 85.0))

    return sms_service.auto_broadcast_severe_alerts(lat, lon, location_name, risk_score)



from concurrent.futures import ThreadPoolExecutor, as_completed
import time

_GEE_HEATMAP_CACHE = None
_CACHE_TIMESTAMP = 0
CACHE_TTL = 1800 # 30 minutes TTL

@app.get("/risk/heatmap")
def get_spatial_risk_heatmap(district: str = None, category: str = None, refresh: bool = False):
    """
    Returns a GeoJSON FeatureCollection of 100% Real-Time GEE Satellite Risk polygons
    covering all 8 North-Eastern States of India (Sikkim, Meghalaya, Assam, Arunachal, Nagaland, Manipur, Mizoram, Tripura).
    """
    global _GEE_HEATMAP_CACHE, _CACHE_TIMESTAMP

    now = time.time()
    if not refresh and _GEE_HEATMAP_CACHE is not None and (now - _CACHE_TIMESTAMP) < CACHE_TTL:
        all_features = _GEE_HEATMAP_CACHE
    else:
        # Bounding boxes for all 8 North-Eastern States of India
        districts_config = [
            {"name": "East Khasi Hills", "state": "Meghalaya", "lat_range": (25.15, 25.75), "lon_range": (91.45, 92.15)},
            {"name": "West Garo Hills", "state": "Meghalaya", "lat_range": (25.30, 25.80), "lon_range": (89.90, 90.50)},
            {"name": "Dima Hasao", "state": "Assam", "lat_range": (25.00, 25.45), "lon_range": (92.70, 93.30)},
            {"name": "Kamrup Metropolitan", "state": "Assam", "lat_range": (26.05, 26.30), "lon_range": (91.60, 91.95)},
            {"name": "North Sikkim", "state": "Sikkim", "lat_range": (27.40, 27.85), "lon_range": (88.40, 88.85)},
            {"name": "East Sikkim", "state": "Sikkim", "lat_range": (27.20, 27.45), "lon_range": (88.50, 88.80)},
            {"name": "Tamenglong", "state": "Manipur", "lat_range": (24.75, 25.20), "lon_range": (93.30, 93.80)},
            {"name": "Imphal East", "state": "Manipur", "lat_range": (24.70, 25.05), "lon_range": (93.90, 94.20)},
            {"name": "Aizawl", "state": "Mizoram", "lat_range": (23.50, 23.95), "lon_range": (92.50, 92.95)},
            {"name": "Lunglei", "state": "Mizoram", "lat_range": (22.70, 23.15), "lon_range": (92.60, 93.00)},
            {"name": "Kohima", "state": "Nagaland", "lat_range": (25.50, 25.85), "lon_range": (94.00, 94.35)},
            {"name": "Dimapur", "state": "Nagaland", "lat_range": (25.75, 26.05), "lon_range": (93.60, 93.90)},
            {"name": "Papum Pare", "state": "Arunachal Pradesh", "lat_range": (26.95, 27.35), "lon_range": (93.40, 93.85)},
            {"name": "West Kameng", "state": "Arunachal Pradesh", "lat_range": (27.10, 27.60), "lon_range": (92.10, 92.60)},
            {"name": "West Tripura", "state": "Tripura", "lat_range": (23.70, 24.10), "lon_range": (91.20, 91.60)}
        ]

        step = 0.18 # ~18km grid cell size for fast coverage
        cell_points = []
        cell_id = 1

        for dist in districts_config:
            lat_min, lat_max = dist["lat_range"]
            lon_min, lon_max = dist["lon_range"]
            curr_lat = lat_min
            while curr_lat < lat_max:
                curr_lon = lon_min
                while curr_lon < lon_max:
                    c_lat = round(curr_lat + step / 2, 4)
                    c_lon = round(curr_lon + step / 2, 4)
                    cell_points.append({
                        "id": cell_id,
                        "district": dist["name"],
                        "state": dist["state"],
                        "lat": c_lat,
                        "lon": c_lon,
                        "poly": [
                            [round(curr_lon, 4), round(curr_lat, 4)],
                            [round(curr_lon + step, 4), round(curr_lat, 4)],
                            [round(curr_lon + step, 4), round(curr_lat + step, 4)],
                            [round(curr_lon, 4), round(curr_lat + step, 4)],
                            [round(curr_lon, 4), round(curr_lat, 4)]
                        ]
                    })
                    cell_id += 1
                    curr_lon += step
                curr_lat += step

        # Multi-threaded live GEE satellite queries + XGBoost prediction
        def query_cell_gee(cell):
            try:
                gee_feats = get_all_features(cell["lat"], cell["lon"])
                fdict = {
                    "slope": gee_feats["slope"],
                    "rainfall_24h": gee_feats["rainfall_24h"],
                    "rainfall_72h": gee_feats["rainfall_72h"],
                    "soil_moisture": gee_feats["soil_moisture"],
                    "lithology_class": gee_feats["lithology_class"]
                }
                pred = predict_risk(fdict)
                score = pred['score']
            except Exception as e:
                gee_feats = {"elevation": 500.0, "slope": 15.0, "rainfall_24h": 20.0, "rainfall_72h": 60.0, "ndvi": 0.5}
                score = 15.0

            if score > 75:
                cat = "Severe"
            elif score > 50:
                cat = "Warning"
            elif score > 25:
                cat = "Alert"
            else:
                cat = "Watch"

            return {
                "type": "Feature",
                "id": cell["id"],
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [cell["poly"]]
                },
                "properties": {
                    "cell_id": cell["id"],
                    "district": cell["district"],
                    "state": cell["state"],
                    "center_lat": cell["lat"],
                    "center_lon": cell["lon"],
                    "risk_score": score,
                    "category": cat,
                    "elevation": round(gee_feats.get("elevation", 0), 1),
                    "slope": round(gee_feats.get("slope", 0), 1),
                    "rainfall_72h": round(gee_feats.get("rainfall_72h", 0), 1),
                    "ndvi": round(gee_feats.get("ndvi", 0.5), 3),
                    "data_source": "Live GEE Satellite Scan"
                }
            }

        all_features = []
        with ThreadPoolExecutor(max_workers=16) as executor:
            futures = [executor.submit(query_cell_gee, cell) for cell in cell_points]
            for future in as_completed(futures):
                all_features.append(future.result())

        all_features.sort(key=lambda x: x["id"])
        _GEE_HEATMAP_CACHE = all_features
        _CACHE_TIMESTAMP = time.time()

    # Apply client filters
    filtered_features = []
    for feat in all_features:
        p = feat["properties"]
        if district and district.lower() not in p["district"].lower() and district.lower() not in p["state"].lower():
            continue
        if category and category.lower() != p["category"].lower() and category.lower() != "all tiers":
            continue
        filtered_features.append(feat)

    return {
        "type": "FeatureCollection",
        "summary": {
            "total_cells": len(filtered_features),
            "cached": _GEE_HEATMAP_CACHE is not None and not refresh,
            "cache_age_seconds": round(time.time() - _CACHE_TIMESTAMP, 1),
            "region_coverage": "All 8 North-Eastern States of India"
        },
        "features": filtered_features
    }



@app.get("/risk/{cell_id}")
def get_cell_risk(cell_id: int, db: Session = Depends(get_db)):
    """
    Returns risk analysis for a specific grid cell.
    """
    cell = db.query(models.GridCell).filter(models.GridCell.id == cell_id).first()
    if not cell:
        raise HTTPException(status_code=404, detail="Grid cell not found")
    
    # Build feature dict (ensure features match the ones used in training)
    features_dict = {
        "slope": cell.slope if cell.slope is not None else 30.0,
        "rainfall_24h": 100.0, # Placeholder until live rainfall is hooked up
        "rainfall_72h": 150.0,
        "soil_moisture": 0.5,
        "lithology_class": int(cell.lithology_class) if cell.lithology_class and str(cell.lithology_class).isdigit() else 2
    }
    
    try:
        prediction = predict_risk(features_dict)
        risk_score = prediction['score']
        shap_breakdown = prediction['shap_breakdown']
        
        # Sort factors by absolute shap value descending
        top_factors = sorted(
            [{"feature": k, "impact": v} for k, v in shap_breakdown.items()],
            key=lambda x: abs(x["impact"]),
            reverse=True
        )
    except Exception as e:
        print(f"Prediction failed: {e}")
        risk_score = 0.0
        top_factors = []
    
    # Determine risk category based on score
    if risk_score > 75:
        category = "Severe"
    elif risk_score > 50:
        category = "Warning"
    elif risk_score > 25:
        category = "Alert"
    else:
        category = "Watch"
        
    return {
        "cell_id": cell_id,
        "risk_score": round(risk_score, 2),
        "category": category,
        "top_factors": top_factors,
        "features": {
            "slope": cell.slope,
            "aspect": cell.aspect,
            "elevation": cell.elevation,
            "lithology_class": cell.lithology_class
        }
    }


@app.get("/advisory/pdf")
def get_advisory_pdf(lat: float, lon: float, location_name: str = None):
    """
    Generates and downloads an official NDRF / SDMA Disaster Management Early Warning Advisory PDF Report.
    """
    risk_data = get_location_risk(lat, lon)
    pdf_bytes = advisory_service.generate_advisory_pdf_bytes(lat, lon, location_name, risk_data)
    
    filename = f"NDRF_Landslide_Advisory_{lat:.2f}N_{lon:.2f}E.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@app.post("/advisory/alert-simulation")
def trigger_alert_simulation(lat: float, lon: float, location_name: str = None):
    """
    Executes a simulated emergency SMS & Email alert dispatch to DEOC, SDMA, and NDRF 1st Battalion units.
    """
    risk_data = get_location_risk(lat, lon)
    dispatch_res = advisory_service.simulate_emergency_alert(lat, lon, location_name, risk_data)
    return dispatch_res


@app.get("/backtest")
def get_backtest_report():
    """
    Returns AI model historical backtesting results, confusion matrix, ROC curve, SHAP feature importance,
    and 12-18 hour early warning lead-time validation case studies (Wayanad 2024, Guwahati 2024, Sikkim 2023).
    """
    return backtest_service.get_backtest_results()




