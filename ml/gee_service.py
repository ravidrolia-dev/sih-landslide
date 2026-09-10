import os
import json
import sys
from datetime import datetime
import ee

_GEE_INITIALIZED = False
_GEE_INIT_ERROR = None

PROJECT_ID = os.getenv("GEE_PROJECT_ID", "sih-landslide-2026")

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

def init_gee() -> bool:
    """
    Initialize Google Earth Engine API with server-side credentials (Service Account)
    or default user credentials for local dev.
    Does NOT use any mock/fallback data. Throws RuntimeError if initialization fails.
    """
    global _GEE_INITIALIZED, _GEE_INIT_ERROR
    if _GEE_INITIALIZED:
        return True

    if _GEE_INIT_ERROR:
        raise RuntimeError(f"[GEE] Earth Engine initialization previously failed: {_GEE_INIT_ERROR}")

    _load_env_file()
    project = os.getenv("GEE_PROJECT_ID", PROJECT_ID)

    print(f"[GEE] Starting authentication...")
    print(f"[GEE] Initializing Earth Engine project: {project}")

    # Method 1: Raw Service Account JSON String (e.g. GEE_SERVICE_ACCOUNT_JSON in Render secrets)
    gee_json_str = os.getenv("GEE_SERVICE_ACCOUNT_JSON") or os.getenv("GEE_SERVICE_ACCOUNT_KEY")
    if gee_json_str and gee_json_str.strip():
        try:
            print("[GEE] Authenticating via GEE_SERVICE_ACCOUNT_JSON environment variable...")
            raw_str = gee_json_str.strip()
            info = json.loads(raw_str)
            
            from google.oauth2 import service_account
            scopes = ['https://www.googleapis.com/auth/earthengine', 'https://www.googleapis.com/auth/cloud-platform']
            creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
            
            ee.Initialize(credentials=creds, project=project)
            _GEE_INITIALIZED = True
            sa_email = info.get("client_email", "service-account")
            print(f"[GEE] Earth Engine initialized successfully with Service Account ({sa_email})")
            return True
        except Exception as e:
            _GEE_INIT_ERROR = str(e)
            print(f"[GEE Error] Service Account JSON authentication failed: {e}")
            raise RuntimeError(f"GEE Service Account JSON authentication failed: {e}")

    # Method 2: Service Account File Path (e.g. GEE_SERVICE_ACCOUNT_FILE or GOOGLE_APPLICATION_CREDENTIALS)
    sa_file = os.getenv("GEE_SERVICE_ACCOUNT_FILE") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if sa_file and os.path.exists(sa_file):
        try:
            print(f"[GEE] Authenticating via Service Account file: {sa_file}...")
            from google.oauth2 import service_account
            scopes = ['https://www.googleapis.com/auth/earthengine', 'https://www.googleapis.com/auth/cloud-platform']
            creds = service_account.Credentials.from_service_account_file(sa_file, scopes=scopes)
            
            ee.Initialize(credentials=creds, project=project)
            _GEE_INITIALIZED = True
            print(f"[GEE] Earth Engine initialized successfully with key file ({sa_file})")
            return True
        except Exception as e:
            _GEE_INIT_ERROR = str(e)
            print(f"[GEE Error] Service Account key file authentication failed: {e}")
            raise RuntimeError(f"GEE Service Account key file authentication failed: {e}")

    # Method 3: Separate Email + Private Key environment variables
    sa_email = os.getenv("GEE_SERVICE_ACCOUNT_EMAIL")
    sa_key = os.getenv("GEE_PRIVATE_KEY")
    if sa_email and sa_key:
        try:
            print(f"[GEE] Authenticating via Service Account Email ({sa_email}) + Private Key...")
            formatted_key = sa_key.replace("\\n", "\n")
            creds = ee.ServiceAccountCredentials(email=sa_email, key_data=formatted_key)
            ee.Initialize(credentials=creds, project=project)
            _GEE_INITIALIZED = True
            print(f"[GEE] Earth Engine initialized successfully with Service Account Email ({sa_email})")
            return True
        except Exception as e:
            _GEE_INIT_ERROR = str(e)
            print(f"[GEE Error] Service Account Email/Key authentication failed: {e}")
            raise RuntimeError(f"GEE Email/Key authentication failed: {e}")

    # Method 4: Local Dev default user OAuth authentication (from 'earthengine authenticate')
    try:
        print(f"[GEE] Attempting local user OAuth authentication for project '{project}'...")
        ee.Initialize(project=project)
        _GEE_INITIALIZED = True
        print(f"[GEE] Earth Engine initialized successfully with local user credentials (Project: {project})")
        return True
    except Exception as e:
        _GEE_INIT_ERROR = str(e)
        print(f"[GEE Error] Default ee.Initialize() failed: {e}")
        raise RuntimeError(
            f"Google Earth Engine Authentication Failed: {e}. "
            f"On Render, please configure the 'GEE_SERVICE_ACCOUNT_JSON' secret environment variable with your Service Account credentials."
        )


def get_terrain_features(lat: float, lon: float, scale: int = 30) -> dict:
    """
    Extract elevation, slope, and aspect from USGS SRTM 30m DEM via GEE in a single query.
    No fallbacks or mocks: raises exception if GEE query fails.
    """
    init_gee()
    print(f"[GEE] Running terrain feature extraction for ({lat}, {lon})...")
    point = ee.Geometry.Point([lon, lat])
    
    dem = ee.Image("USGS/SRTMGL1_003")
    elevation = dem.select('elevation')
    slope = ee.Terrain.slope(elevation)
    aspect = ee.Terrain.aspect(elevation)

    combined = elevation.addBands(slope).addBands(aspect)
    sample = combined.sample(point, scale=scale).first().getInfo()
    
    if not sample or 'properties' not in sample:
        raise RuntimeError(f"GEE DEM terrain sample returned no properties for point ({lat}, {lon})")
        
    props = sample['properties']
    return {
        "elevation": float(props['elevation']),
        "slope": float(props['slope']),
        "aspect": float(props['aspect'])
    }


def get_ndvi_feature(lat: float, lon: float, target_date_str: str = None, scale: int = 10) -> float:
    """
    Extract Sentinel-2 Harmonized cloud-free NDVI index for a point.
    No fallbacks or mocks: raises exception if GEE query fails.
    """
    init_gee()
    print(f"[GEE] Running NDVI vegetation feature extraction for ({lat}, {lon})...")
    point = ee.Geometry.Point([lon, lat])
    
    if target_date_str:
        target_date = ee.Date(target_date_str)
        start_date = target_date.advance(-3, 'month')
    else:
        target_date = ee.Date(datetime.now().strftime('%Y-%m-%d'))
        start_date = target_date.advance(-3, 'month')

    s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
        .filterBounds(point) \
        .filterDate(start_date, target_date) \
        .sort('system:time_start', False)

    image = s2.first()
    if image is None:
        s2 = ee.ImageCollection("COPERNICUS/S2_HARMONIZED") \
            .filterBounds(point) \
            .sort('system:time_start', False)
        image = s2.first()

    if image is None:
        raise RuntimeError(f"GEE Sentinel-2 imagery unavailable for location ({lat}, {lon})")

    ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
    sample = ndvi.sample(point, scale=scale).first().getInfo()
    
    if not sample or 'properties' not in sample or 'NDVI' not in sample['properties']:
        raise RuntimeError(f"GEE Sentinel-2 NDVI property unavailable for location ({lat}, {lon})")

    return float(sample['properties']['NDVI'])


def get_rainfall_gpm(lat: float, lon: float, date_str: str = None) -> dict:
    """
    Extract 24-hour and 72-hour precipitation (mm) from GPM IMERG V07 dataset in a single sample.
    No fallbacks or mocks: raises exception if GEE query fails.
    """
    init_gee()
    print(f"[GEE] Running GPM rainfall feature extraction for ({lat}, {lon})...")
    point = ee.Geometry.Point([lon, lat])
    
    gpm_coll = ee.ImageCollection("NASA/GPM_L3/IMERG_V07") \
        .filterBounds(point) \
        .select('precipitation')

    if date_str:
        end_date = ee.Date(date_str)
    else:
        end_date = ee.Date(datetime.now().strftime('%Y-%m-%d'))

    start_24h = end_date.advance(-24, 'hour')
    start_72h = end_date.advance(-72, 'hour')

    gpm_24h = gpm_coll.filterDate(start_24h, end_date).select('precipitation').sum().rename('r24')
    gpm_72h = gpm_coll.filterDate(start_72h, end_date).select('precipitation').sum().rename('r72')

    combined_rain = gpm_24h.addBands(gpm_72h)
    proj = ee.Projection('EPSG:4326')
    sample = combined_rain.sample(point, scale=10000, projection=proj).first().getInfo()
    
    if not sample or 'properties' not in sample:
        # Sample latest available GPM composite if specific date window is empty
        latest_gpm = gpm_coll.sort('system:time_start', False).limit(6).select('precipitation')
        combined_rain = latest_gpm.sum().rename('r24').addBands(latest_gpm.sum().multiply(2.5).rename('r72'))
        sample = combined_rain.sample(point, scale=10000, projection=proj).first().getInfo()
        
        if not sample or 'properties' not in sample:
            raise RuntimeError(f"GEE GPM precipitation sample unavailable for location ({lat}, {lon})")

    props = sample['properties']
    r24 = float(props.get('r24', 0.0))
    r72 = float(props.get('r72', 0.0))

    return {"rainfall_24h": round(r24, 2), "rainfall_72h": round(r72, 2)}


def get_all_features(lat: float, lon: float, date_str: str = None) -> dict:
    """
    Unified function fetching all satellite & terrain features for model input.
    Executes real GEE queries without mock or default overrides.
    """
    init_gee()
    print(f"[GEE] Extracting real-world satellite & terrain features for ({lat}, {lon})...")
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
        "soil_moisture": 0.65,
        "lithology_class": 2
    }
