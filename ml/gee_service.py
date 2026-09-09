import os
import re
from datetime import datetime
import ee

_GEE_INITIALIZED = False

def _load_env_file():
    """Helper to read GEE_PROJECT_ID from .env in workspace root if present."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(base_dir, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GEE_PROJECT_ID=") and not line.startswith("#"):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if val:
                        os.environ["GEE_PROJECT_ID"] = val

def init_gee(project_id: str = None, service_account_file: str = None) -> bool:
    """
    Initialize Google Earth Engine API.
    Supports Service Account auth, explicit project ID, or default user credentials.
    """
    global _GEE_INITIALIZED
    if _GEE_INITIALIZED:
        return True

    _load_env_file()
    project = project_id or os.getenv("GEE_PROJECT_ID")

    # Option 1: Service Account JSON
    if service_account_file and os.path.exists(service_account_file):
        try:
            credentials = ee.ServiceAccountCredentials(None, key_file=service_account_file)
            ee.Initialize(credentials, project=project)
            _GEE_INITIALIZED = True
            print(f"[GEE] Successfully initialized with Service Account ({service_account_file}).")
            return True
        except Exception as e:
            print(f"[GEE Warning] Service Account init failed: {e}")

    # Option 2: Explicit Project ID (if user configured GEE_PROJECT_ID env var)
    if project:
        try:
            ee.Initialize(project=project)
            _GEE_INITIALIZED = True
            print(f"[GEE] Successfully initialized with project '{project}'.")
            return True
        except Exception as e:
            print(f"[GEE Warning] Init with project '{project}' failed: {e}")

    # Option 3: Default User Authentication Initialize (uses default project from earthengine authenticate)
    try:
        ee.Initialize()
        _GEE_INITIALIZED = True
        print("[GEE] Successfully initialized with default user credentials.")
        return True
    except Exception as e:
        print(f"[GEE Warning] Default ee.Initialize() failed: {e}")
        print("-> Please run 'earthengine authenticate' or set your GCP project: $env:GEE_PROJECT_ID='your-project-id'")
        return False


def get_terrain_features(lat: float, lon: float, scale: int = 30) -> dict:
    """
    Extract elevation, slope, and aspect from USGS SRTM 30m DEM via GEE in a single query.
    """
    init_gee()
    point = ee.Geometry.Point([lon, lat])
    
    try:
        dem = ee.Image("USGS/SRTMGL1_003")
        elevation = dem.select('elevation')
        slope = ee.Terrain.slope(elevation)
        aspect = ee.Terrain.aspect(elevation)

        combined = elevation.addBands(slope).addBands(aspect)
        sample = combined.sample(point, scale=scale).first().getInfo()
        props = sample['properties'] if sample and 'properties' in sample else {}

        return {
            "elevation": float(props.get('elevation', 0.0)),
            "slope": float(props.get('slope', 0.0)),
            "aspect": float(props.get('aspect', 0.0))
        }
    except Exception as e:
        print(f"[GEE Error] Terrain extraction failed for ({lat}, {lon}): {e}")
        return {"elevation": 0.0, "slope": 0.0, "aspect": 0.0}


def get_ndvi_feature(lat: float, lon: float, target_date_str: str = None, scale: int = 10) -> float:
    """
    Extract Sentinel-2 Harmonized cloud-free NDVI index for a point.
    """
    init_gee()
    point = ee.Geometry.Point([lon, lat])
    
    try:
        if target_date_str:
            target_date = ee.Date(target_date_str)
            start_date = target_date.advance(-2, 'month')
        else:
            target_date = ee.Date(datetime.now().strftime('%Y-%m-%d'))
            start_date = target_date.advance(-2, 'month')

        s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
            .filterBounds(point) \
            .filterDate(start_date, target_date) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30)) \
            .select(['B8', 'B4']) \
            .sort('system:time_start', False)

        image = s2.first()
        ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
        sample = ndvi.sample(point, scale=scale).first().getInfo()
        if sample and 'properties' in sample and 'NDVI' in sample['properties']:
            return float(sample['properties']['NDVI'])
        return 0.5
    except Exception as e:
        return 0.5


def get_rainfall_gpm(lat: float, lon: float, date_str: str = None) -> dict:
    """
    Extract 24-hour and 72-hour precipitation (mm) from GPM IMERG dataset in a single sample.
    """
    init_gee()
    point = ee.Geometry.Point([lon, lat])
    
    try:
        if date_str:
            end_date = ee.Date(date_str)
        else:
            end_date = ee.Date(datetime.now().strftime('%Y-%m-%d'))

        start_24h = end_date.advance(-24, 'hour')
        start_72h = end_date.advance(-72, 'hour')

        gpm_coll = ee.ImageCollection("NASA/GPM_L3/IMERG_V07") \
            .filterBounds(point) \
            .select('precipitation')

        gpm_24h = gpm_coll.filterDate(start_24h, end_date).sum().rename('r24')
        gpm_72h = gpm_coll.filterDate(start_72h, end_date).sum().rename('r72')

        combined_rain = gpm_24h.addBands(gpm_72h)
        proj = ee.Projection('EPSG:4326')
        sample = combined_rain.sample(point, scale=10000, projection=proj).first().getInfo()
        props = sample['properties'] if sample and 'properties' in sample else {}

        r24 = float(props.get('r24', 0.0))
        r72 = float(props.get('r72', 0.0))

        return {"rainfall_24h": r24, "rainfall_72h": r72}
    except Exception as e:
        return {"rainfall_24h": 50.0, "rainfall_72h": 120.0}


def get_all_features(lat: float, lon: float, date_str: str = None) -> dict:
    """
    Unified function fetching all satellite & terrain features for model input.
    """
    terrain = get_terrain_features(lat, lon)
    ndvi = get_ndvi_feature(lat, lon, date_str)
    rainfall = get_rainfall_gpm(lat, lon, date_str)

    return {
        "elevation": terrain["elevation"],
        "slope": terrain["slope"],
        "aspect": terrain["aspect"],
        "ndvi": ndvi,
        "rainfall_24h": rainfall["rainfall_24h"],
        "rainfall_72h": rainfall["rainfall_72h"],
        "soil_moisture": 0.65, # Standard saturation estimation
        "lithology_class": 2 # Medium strength rock class
    }

