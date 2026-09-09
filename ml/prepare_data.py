import pandas as pd
import numpy as np
import geopandas as gpd
from shapely.geometry import Point
import ee
import os
import re
import random
import time

def parse_date(date_str):
    if pd.isna(date_str):
        return None
    date_str = str(date_str).strip()
    
    # "2018-06-15/16" -> "2018-06-15"
    m = re.match(r"^(\d{4}-\d{2}-\d{2})/\d{2}$", date_str)
    if m:
        return m.group(1)
        
    # "2019-07/2019" -> "2019-07-01"
    m = re.match(r"^(\d{4}-\d{2})/\d{4}$", date_str)
    if m:
        return m.group(1) + "-01"
        
    # "2021-06/07" -> "2021-06-01"
    m = re.match(r"^(\d{4}-\d{2})/\d{2}$", date_str)
    if m:
        return m.group(1) + "-01"
        
    # "2018-06" -> "2018-06-01"
    m = re.match(r"^(\d{4}-\d{2})$", date_str)
    if m:
        return m.group(1) + "-01"
        
    # "2018-07-11" -> "2018-07-11"
    m = re.match(r"^(\d{4}-\d{2}-\d{2})$", date_str)
    if m:
        return m.group(1)
        
    return None

def get_gee_features(lat, lon, target_date_str):
    point = ee.Geometry.Point([lon, lat])
    
    # 1. Terrain (SRTM)
    try:
        dem = ee.Image("USGS/SRTMGL1_003")
        elevation = dem.select('elevation')
        slope = ee.Terrain.slope(elevation)
        aspect = ee.Terrain.aspect(elevation)
        
        elev_val = elevation.sample(point, scale=30).first().getInfo()['properties']['elevation']
        slope_val = slope.sample(point, scale=30).first().getInfo()['properties']['slope']
        aspect_val = aspect.sample(point, scale=30).first().getInfo()['properties']['aspect']
    except Exception as e:
        elev_val, slope_val, aspect_val = None, None, None
        print(f"  [Error] Failed to fetch terrain for ({lat}, {lon}): {e}")

    # 2. NDVI (Sentinel-2)
    ndvi_val = None
    if target_date_str:
        try:
            target_date = ee.Date(target_date_str)
            start_date = target_date.advance(-6, 'month')
            
            s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
                .filterBounds(point) \
                .filterDate(start_date, target_date) \
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
                .sort('system:time_start', False)
                
            count = s2.size().getInfo()
            if count > 0:
                image = ee.Image(s2.first())
                ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
                sample = ndvi.sample(point, scale=10).first()
                if sample:
                    info = sample.getInfo()
                    if info and 'properties' in info and 'NDVI' in info['properties']:
                        ndvi_val = info['properties']['NDVI']
            else:
                print(f"  [Warning] No cloud-free S2 images found for ({lat}, {lon}) before {target_date_str}")
        except Exception as e:
            print(f"  [Error] Failed to fetch NDVI for ({lat}, {lon}): {e}")
            
    return elev_val, slope_val, aspect_val, ndvi_val

def main():
    print("Initializing Google Earth Engine...")
    try:
        ee.Initialize(project='sih-landslide-project') # Try to initialize, standard fallback
    except Exception as e:
        try:
            ee.Initialize() # Try default project
        except Exception as e:
            print("Earth Engine Initialization failed. Please run 'earthengine authenticate' first.")
            raise e
        
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_file = os.path.join(BASE_DIR, "data", "raw", "landslideData.txt")
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Raw data not found at {input_file}")
        
    print(f"Loading data from {input_file}")
    df = pd.read_csv(input_file)
    df['is_landslide'] = 1
    
    # 1. Parse dates
    df['parsed_date'] = df['date'].apply(parse_date)
    unparseable = df[df['parsed_date'].isna()]
    if not unparseable.empty:
        print(f"Warning: {len(unparseable)} rows have unparseable dates.")
        
    # Stats
    total_pos = len(df)
    exact_coords = len(df[df['coordinate_quality'] == 'exact'])
    approx_coords = total_pos - exact_coords
    print(f"\nPositive Events: {total_pos}")
    print(f"Coordinate Quality: {exact_coords} 'exact', {approx_coords} 'approx-*'")
    
    # 2. Negative sampling (2km buffer)
    print("\nGenerating negative samples...")
    gdf_pos = gpd.GeoDataFrame(df, geometry=[Point(xy) for xy in zip(df['longitude'], df['latitude'])], crs="EPSG:4326")
    gdf_pos_proj = gdf_pos.to_crs(epsg=32646) # UTM Zone 46N (approx equal area for NER)
    exclusion_zone = gdf_pos_proj.buffer(2000).unary_union # 2000 meters = 2km
    
    valid_dates = df['parsed_date'].dropna().tolist()
    n_negatives = total_pos * 3
    negatives = []
    
    while len(negatives) < n_negatives:
        lat = random.uniform(22, 29)
        lon = random.uniform(88, 97)
        pt = Point(lon, lat)
        pt_proj = gpd.GeoDataFrame(geometry=[pt], crs="EPSG:4326").to_crs(epsg=32646).geometry[0]
        
        if not pt_proj.within(exclusion_zone):
            negatives.append({
                'latitude': lat,
                'longitude': lon,
                'is_landslide': 0,
                'parsed_date': random.choice(valid_dates),
                'coordinate_quality': 'generated'
            })
            
    df_neg = pd.DataFrame(negatives)
    print(f"Generated {len(df_neg)} negative samples.")
    
    # Combine datasets
    combined_df = pd.concat([df, df_neg], ignore_index=True)
    
    # 3. GEE Extraction
    print("\nExtracting features from Earth Engine (this may take a few minutes)...")
    elevations, slopes, aspects, ndvis = [], [], [], []
    failed_points = []
    
    for idx, row in combined_df.iterrows():
        print(f"Processing point {idx+1}/{len(combined_df)} (Lat: {row['latitude']:.4f}, Lon: {row['longitude']:.4f})...")
        elev, slope, aspect, ndvi = get_gee_features(row['latitude'], row['longitude'], row['parsed_date'])
        
        if elev is None or ndvi is None:
            failed_points.append(idx)
            
        elevations.append(elev)
        slopes.append(slope)
        aspects.append(aspect)
        ndvis.append(ndvi)
        time.sleep(0.1) # Small delay to respect rate limits
        
    combined_df['elevation'] = elevations
    combined_df['slope'] = slopes
    combined_df['aspect'] = aspects
    combined_df['ndvi'] = ndvis
    
    # Summary
    print("\n=== Extraction Summary ===")
    print(f"Total rows in dataset: {len(combined_df)}")
    print(f"Positives: {total_pos} | Negatives: {len(df_neg)}")
    print(f"Failed GEE Extractions: {len(failed_points)}")
    if failed_points:
        print("Failed Point Indices:", failed_points)
        print("Rows with failures:")
        print(combined_df.iloc[failed_points][['latitude', 'longitude', 'parsed_date']])
        
    # Save
    out_dir = os.path.join(BASE_DIR, "data", "processed")
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "training_data.csv")
    combined_df.to_csv(out_file, index=False)
    print(f"\nSaved feature table to {out_file}")

if __name__ == "__main__":
    main()
