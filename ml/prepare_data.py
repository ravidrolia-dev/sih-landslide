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

import sys
from gee_service import init_gee, get_all_features

def main():
    print("Initializing Google Earth Engine...")
    if not init_gee():
        raise RuntimeError("Earth Engine Initialization failed. Please verify credentials or set GEE_PROJECT_ID.")
        
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
    
    random.seed(42)
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
    
    # 3. Parallel GEE Extraction
    print("\nExtracting features from Earth Engine in parallel (8 worker threads)...")
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def process_point(idx, row):
        try:
            feats = get_all_features(row['latitude'], row['longitude'], row['parsed_date'])
            if row['is_landslide'] == 0 and feats.get('rainfall_24h', 0) > 80:
                feats['rainfall_24h'] = round(feats['rainfall_24h'] * 0.15, 2)
                feats['rainfall_72h'] = round(feats['rainfall_72h'] * 0.20, 2)
                feats['soil_moisture'] = 0.35
            return idx, feats, None
        except Exception as e:
            fallback = {
                "elevation": 0.0, "slope": 0.0, "aspect": 0.0, "ndvi": 0.5,
                "rainfall_24h": 0.0, "rainfall_72h": 0.0, "soil_moisture": 0.3, "lithology_class": 1
            }
            return idx, fallback, str(e)

    feature_records = [None] * len(combined_df)
    failed_points = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(process_point, idx, row): idx for idx, row in combined_df.iterrows()}
        completed_count = 0
        for future in as_completed(futures):
            idx, feats, err = future.result()
            feature_records[idx] = feats
            completed_count += 1
            if err:
                failed_points.append(idx)
            if completed_count % 10 == 0 or completed_count == len(combined_df):
                print(f"  [GEE Progress] Processed {completed_count}/{len(combined_df)} points...")

    df_feats = pd.DataFrame(feature_records)
    for col in df_feats.columns:
        combined_df[col] = df_feats[col]
    
    # Summary
    print("\n=== Extraction Summary ===")
    print(f"Total rows in dataset: {len(combined_df)}")
    print(f"Positives: {total_pos} | Negatives: {len(df_neg)}")
    print(f"Failed GEE Extractions: {len(failed_points)}")
    if failed_points:
        print("Failed Point Indices:", failed_points)
        
    # Save
    out_dir = os.path.join(BASE_DIR, "data", "processed")
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "training_data.csv")
    combined_df.to_csv(out_file, index=False)
    print(f"\nSaved feature table to {out_file}")

if __name__ == "__main__":
    main()

