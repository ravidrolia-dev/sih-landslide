import json
import random
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from geoalchemy2.functions import ST_AsGeoJSON

from database import engine, get_db, Base
import models

# It's good practice to ensure PostGIS extension is loaded before creating tables.
# The postgis docker image creates it by default, but just in case:
with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    conn.commit()

# Create all tables in the database
Base.metadata.create_all(bind=engine)

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
