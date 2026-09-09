import json
import random
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from geoalchemy2.functions import ST_AsGeoJSON

from database import engine, get_db, Base
import models

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

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend is running!"}

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

