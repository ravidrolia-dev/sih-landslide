import sys
import os

# Add ml directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from gee_service import init_gee, get_all_features, get_terrain_features, get_ndvi_feature, get_rainfall_gpm

def main():
    print("=" * 60)
    print("      GOOGLE EARTH ENGINE (GEE) INTEGRATION VERIFIER     ")
    print("=" * 60)
    
    project_id = os.getenv("GEE_PROJECT_ID")
    print(f"[*] Target GEE Cloud Project: '{project_id or 'Default User Project'}'")
    print("[*] Initializing Earth Engine API...")
    
    success = init_gee(project_id=project_id)
    
    if not success:
        print("\n[!] GEE Connection Status: FAILED / NOT AUTHENTICATED")
        print("\n--- NEXT STEPS TO CONNECT GOOGLE EARTH ENGINE ---")
        print("1. Open your command prompt / terminal.")
        print("2. Run the authentication command:")
        print("     earthengine authenticate")
        print("3. Log in with your Google account that has GEE access.")
        print("4. Set your Google Cloud Project ID in environment variables:")
        print("     $env:GEE_PROJECT_ID=\"your-gcp-project-id\"   (PowerShell)")
        print("   or edit 'sih-landslide-project' in ml/gee_service.py")
        return
        
    print("\n[OK] GEE Connection Status: CONNECTED & INITIALIZED!")
    
    # Test coordinates: Shillong, Meghalaya (North-East Region)
    test_lat = 25.5788
    test_lon = 91.8933
    print(f"\n[*] Extracting live satellite metrics for Shillong, NER (Lat: {test_lat}, Lon: {test_lon})...")
    
    features = get_all_features(test_lat, test_lon)
    
    print("\n=== EXTRACTED SATELLITE FEATURES ===")
    print(f"  • USGS SRTM Elevation:  {features['elevation']:.1f} meters")
    print(f"  • USGS SRTM Slope:      {features['slope']:.2f} degrees")
    print(f"  • USGS SRTM Aspect:     {features['aspect']:.1f} degrees")
    print(f"  • Sentinel-2 NDVI:      {features['ndvi']:.4f}")
    print(f"  • GPM IMERG 24h Rain:   {features['rainfall_24h']:.2f} mm")
    print(f"  • GPM IMERG 72h Rain:   {features['rainfall_72h']:.2f} mm")
    print(f"  • Soil Moisture Sat:    {features['soil_moisture'] * 100:.1f} %")
    print("=" * 60)
    print("Google Earth Engine integration is operational!")

if __name__ == "__main__":
    main()
