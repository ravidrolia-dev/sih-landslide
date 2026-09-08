from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date
from geoalchemy2 import Geometry
from database import Base

class GridCell(Base):
    __tablename__ = "grid_cells"

    id = Column(Integer, primary_key=True, index=True)
    geom = Column(Geometry('POLYGON', srid=4326), nullable=False)
    slope = Column(Float)
    aspect = Column(Float)
    elevation = Column(Float)
    lithology_class = Column(String)

class RainfallReading(Base):
    __tablename__ = "rainfall_readings"

    id = Column(Integer, primary_key=True, index=True)
    cell_id = Column(Integer, ForeignKey("grid_cells.id"))
    timestamp = Column(DateTime)
    mm = Column(Float)

class SoilMoistureReading(Base):
    __tablename__ = "soil_moisture_readings"

    id = Column(Integer, primary_key=True, index=True)
    cell_id = Column(Integer, ForeignKey("grid_cells.id"))
    timestamp = Column(DateTime)
    value = Column(Float)

class LandslideEvent(Base):
    __tablename__ = "landslide_events"

    id = Column(Integer, primary_key=True, index=True)
    geom = Column(Geometry('POINT', srid=4326), nullable=False)
    date = Column(Date)
    source = Column(String)
