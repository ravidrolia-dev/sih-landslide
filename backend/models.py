from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, date

class GeoJSONPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]

class GeoJSONPoint(BaseModel):
    type: str = "Point"
    coordinates: List[float]

class GridCell(BaseModel):
    id: int
    geom: GeoJSONPolygon
    slope: Optional[float] = None
    aspect: Optional[float] = None
    elevation: Optional[float] = None
    lithology_class: Optional[str] = None

class RainfallReading(BaseModel):
    id: int
    cell_id: int
    timestamp: datetime
    mm: float

class SoilMoistureReading(BaseModel):
    id: int
    cell_id: int
    timestamp: datetime
    value: float

class LandslideEvent(BaseModel):
    id: int
    geom: GeoJSONPoint
    date: date
    source: str
