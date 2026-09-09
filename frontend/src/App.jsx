import React, { useState, useEffect } from 'react';
import './App.css';
import RiskMap from './RiskMap';
import RiskPanel from './RiskPanel';
import EmergencyPanel from './EmergencyPanel';

const PRESET_LOCATIONS = [
  { name: "Shillong (Meghalaya)", lat: 25.5788, lon: 91.8933 },
  { name: "Haflong (Assam)", lat: 25.1645, lon: 93.0176 },
  { name: "Lachen (Sikkim)", lat: 27.7315, lon: 88.54865 },
  { name: "Tamenglong (Manipur)", lat: 24.98793, lon: 93.49529 },
  { name: "Aizawl (Mizoram)", lat: 23.744, lon: 92.703 },
  { name: "Itanagar (Arunachal)", lat: 27.0844, lon: 93.6053 },
  { name: "Kohima (Nagaland)", lat: 25.6747, lon: 94.1100 },
  { name: "Agartala (Tripura)", lat: 23.8315, lon: 91.2868 }
];

const STATE_OPTIONS = [
  "All 8 NER States",
  "Meghalaya",
  "Assam",
  "Sikkim",
  "Arunachal Pradesh",
  "Nagaland",
  "Manipur",
  "Mizoram",
  "Tripura"
];

const CATEGORY_FILTERS = ["All Tiers", "Severe", "Warning", "Alert", "Watch"];

function App() {
  const [backendStatus, setBackendStatus] = useState({ online: false, message: "Connecting to API..." });
  const [selectedLocation, setSelectedLocation] = useState({ lat: 25.5788, lon: 91.8933, name: "Shillong (Meghalaya)" });
  const [riskData, setRiskData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [activeRouteData, setActiveRouteData] = useState(null);
  const [activeTab, setActiveTab] = useState('gis'); // 'gis' or 'emergency'
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedState, setSelectedState] = useState("All 8 NER States");
  const [selectedCategory, setSelectedCategory] = useState("All Tiers");

  const [locatingUser, setLocatingUser] = useState(false);
  const [locationStatus, setLocationStatus] = useState(null);

  // Check Backend Health
  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then(res => res.json())
      .then(data => setBackendStatus({ online: true, message: data.message }))
      .catch(err => setBackendStatus({ online: false, message: 'Backend Offline (http://localhost:8000)' }));
  }, []);

  // Scan Real-Time User GPS Location
  const handleScanUserLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLocatingUser(true);
    setError(null);
    setLocationStatus("Acquiring GPS Signal...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(4));
        const lon = Number(position.coords.longitude.toFixed(4));
        const accuracy = Math.round(position.coords.accuracy);

        const statusMsg = `🎯 GPS Locked: ${lat}°N, ${lon}°E (±${accuracy}m accuracy)`;
        setLocationStatus(statusMsg);
        setLocatingUser(false);

        // Extract GEE Satellite metrics & XGBoost risk prediction for user's real-time position
        fetchRiskForLocation(
          lat, 
          lon, 
          `🎯 My Live GPS Location (${lat}°, ${lon}°)`
        );
      },
      (err) => {
        setLocatingUser(false);
        setLocationStatus(null);
        let errMsg = "Unable to retrieve your location.";
        if (err.code === 1) {
          errMsg = "GPS permission denied. Please allow location access in your browser.";
        } else if (err.code === 2) {
          errMsg = "GPS position unavailable. Check network or location services.";
        } else if (err.code === 3) {
          errMsg = "GPS location request timed out.";
        }
        setError(errMsg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Fetch Spatial Risk Heatmap GeoJSON from Live GEE
  const fetchHeatmap = (forceRefresh = false) => {
    setScanning(true);
    let url = 'http://localhost:8000/risk/heatmap';
    const params = new URLSearchParams();
    if (selectedState !== "All 8 NER States") {
      params.append('district', selectedState);
    }
    if (selectedCategory !== "All Tiers") {
      params.append('category', selectedCategory);
    }
    if (forceRefresh) {
      params.append('refresh', 'true');
    }
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setHeatmapData(data);
        setScanning(false);
      })
      .catch(err => {
        console.error("Failed to fetch GEE heatmap:", err);
        setScanning(false);
      });
  };

  useEffect(() => {
    fetchHeatmap(false);
  }, [selectedState, selectedCategory]);

  // Fetch GEE Location Risk for single point
  const fetchRiskForLocation = async (lat, lon, name = null) => {
    setLoading(true);
    setError(null);
    setSelectedLocation({ lat, lon, name });

    try {
      const response = await fetch(`http://localhost:8000/risk/location?lat=${lat}&lon=${lon}`);
      if (!response.ok) {
        throw new Error(`API Error ${response.status}: Failed to extract satellite risk metrics`);
      }
      const data = await response.json();
      setRiskData(data);
      if (data && data.category) {
        setSelectedLocation(prev => ({ ...prev, category: data.category }));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to reach backend risk service.");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch for Shillong
  useEffect(() => {
    fetchRiskForLocation(25.5788, 91.8933, "Shillong (Meghalaya)");
  }, []);

  // Fetch Dijkstra evacuation route for a settlement
  const handleSelectRoute = async (lat, lon, name) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/emergency/evacuation-route?origin_lat=${lat}&origin_lon=${lon}`);
      if (!response.ok) {
        throw new Error(`Routing API Error ${response.status}: Failed to compute evacuation path`);
      }
      const routeResult = await response.json();
      setActiveRouteData(routeResult);
      setSelectedLocation({
        lat: lat,
        lon: lon,
        name: `📍 Evacuation Origin: ${name}`
      });
      // Switch back to GIS Map tab to display the interactive route polyline
      setActiveTab('gis');
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to calculate Dijkstra evacuation route.");
    } finally {
      setLoading(false);
    }
  };

  const clearEvacuationRoute = () => {
    setActiveRouteData(null);
  };

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">⛰️</span>
          <div>
            <h1>NE-GeoAlert</h1>
            <p>100% Real-Time GEE Satellite Risk Scan & Emergency Evacuation Control</p>
          </div>
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="tab-navigation">
          <button 
            className={`nav-tab-btn ${activeTab === 'gis' ? 'active' : ''}`}
            onClick={() => setActiveTab('gis')}
          >
            🌐 Live GIS Map & ML Risk
          </button>
          <button 
            className={`nav-tab-btn emergency-tab ${activeTab === 'emergency' ? 'active' : ''}`}
            onClick={() => setActiveTab('emergency')}
          >
            🚨 Emergency Operations & Evacuation Control
          </button>
        </div>

        <div className="header-status">
          <button 
            className={`gps-scan-btn ${locatingUser ? 'locating' : ''}`}
            onClick={handleScanUserLocation}
            disabled={locatingUser}
            title="Scan your current GPS location and fetch satellite risk & prediction"
          >
            {locatingUser ? '🛰️ Locating GPS Signal...' : '🎯 Scan My Real-Time Location'}
          </button>

          <button 
            className={`rescan-btn ${scanning ? 'scanning' : ''}`}
            onClick={() => fetchHeatmap(true)}
            disabled={scanning}
          >
            {scanning ? '⚡ Scanning GEE Satellites...' : '⚡ Rescan GEE Satellite Feed'}
          </button>

          <div className={`status-pill ${backendStatus.online ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            <span>{backendStatus.message}</span>
          </div>
        </div>
      </header>

      {/* Preset & Filter Bar (Shown in GIS mode) */}
      {activeTab === 'gis' && (
        <div className="filter-panel">
          {locationStatus && (
            <div className="gps-status-banner">
              <span>{locationStatus}</span>
            </div>
          )}

          {activeRouteData && (
            <div className="active-route-banner">
              <span>
                🚨 <strong>Active Evacuation Route:</strong> Path panned to safe hub <strong>{activeRouteData.destination?.nearest_safe_hub}</strong> ({activeRouteData.distance_km} km, {activeRouteData.estimated_time_mins} mins transit time).
              </span>
              <button className="clear-route-btn" onClick={clearEvacuationRoute}>
                ❌ Clear Route Overlay
              </button>
            </div>
          )}

          <div className="preset-bar">
            <span className="preset-label">📍 Quick Location Presets:</span>
            <div className="preset-buttons">
              <button
                className={`preset-btn gps-preset ${selectedLocation.name?.startsWith('🎯') ? 'active' : ''}`}
                onClick={handleScanUserLocation}
                disabled={locatingUser}
              >
                🎯 My Live GPS Location
              </button>

              {PRESET_LOCATIONS.map((loc, idx) => (
                <button
                  key={idx}
                  className={`preset-btn ${selectedLocation.name === loc.name ? 'active' : ''}`}
                  onClick={() => fetchRiskForLocation(loc.lat, loc.lon, loc.name)}
                >
                  {loc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Spatial Grid Filters */}
          <div className="grid-filters">
            <div className="filter-group">
              <span className="filter-label">🗺️ State Coverage Filter:</span>
              <select 
                className="filter-select"
                value={selectedState} 
                onChange={e => setSelectedState(e.target.value)}
              >
                {STATE_OPTIONS.map((st, i) => (
                  <option key={i} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">⚠️ Risk Tier Filter:</span>
              <div className="tier-buttons">
                {CATEGORY_FILTERS.map((cat, i) => (
                  <button
                    key={i}
                    className={`tier-btn ${cat.toLowerCase().replace(' ', '-')} ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main View Content */}
      {activeTab === 'gis' ? (
        <main className="dashboard-grid">
          {/* Map View */}
          <div className="map-card">
            <div className="card-header">
              <span className="card-title">
                🌐 Live GEE Satellite Grid ({heatmapData?.features?.length || 0} Cells across All 8 States)
              </span>
              {heatmapData?.summary?.cache_age_seconds !== undefined && (
                <span className="hint-tag">
                  {scanning ? 'Updating live satellite feed...' : `GEE Feed Age: ${heatmapData.summary.cache_age_seconds}s`}
                </span>
              )}
            </div>
            <div className="map-wrapper">
              <RiskMap 
                selectedLocation={selectedLocation} 
                heatmapData={heatmapData}
                routeData={activeRouteData}
                onLocationSelect={(lat, lon, name) => fetchRiskForLocation(lat, lon, name)}
              />
            </div>
          </div>

          {/* Intelligence Side Panel */}
          <div className="side-panel">
            <RiskPanel 
              data={riskData} 
              loading={loading} 
              error={error} 
              locationName={selectedLocation.name}
            />
          </div>
        </main>
      ) : (
        <EmergencyPanel 
          onSelectRoute={handleSelectRoute}
          activeRouteData={activeRouteData}
        />
      )}
    </div>
  );
}

export default App;
