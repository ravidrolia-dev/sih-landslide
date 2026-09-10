import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import RiskMap from './RiskMap';
import RiskPanel from './RiskPanel';
import EmergencyPanel from './EmergencyPanel';
import FieldReportPanel from './FieldReportPanel';
import SmsControlModal from './SmsControlModal';
import SystemDiagnosticsModal from './SystemDiagnosticsModal';
import RoutePlannerCard from './RoutePlannerCard';

const PRESET_LOCATIONS = [
  { name: "Shillong (Meghalaya)", lat: 25.5788, lon: 91.8933 },
  { name: "Kohima (Nagaland)", lat: 25.6747, lon: 94.1100 },
  { name: "Dimapur (Nagaland)", lat: 25.9064, lon: 93.7270 },
  { name: "Haflong (Assam)", lat: 25.1645, lon: 93.0176 },
  { name: "Lachen (Sikkim)", lat: 27.7315, lon: 88.54865 },
  { name: "Tamenglong (Manipur)", lat: 24.98793, lon: 93.49529 },
  { name: "Aizawl (Mizoram)", lat: 23.744, lon: 92.703 },
  { name: "Itanagar (Arunachal)", lat: 27.0844, lon: 93.6053 },
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

const TIER_OPTIONS = ["All Tiers", "Severe", "Warning", "Alert", "Watch"];

function App() {
  const [selectedLocation, setSelectedLocation] = useState({ lat: 25.5788, lon: 91.8933, name: "Shillong (Meghalaya)" });
  const [riskData, setRiskData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [activeRouteData, setActiveRouteData] = useState(null);
  const [fieldReports, setFieldReports] = useState([]);
  const [activeTab, setActiveTab] = useState('gis');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedState, setSelectedState] = useState("All 8 NER States");
  const [selectedCategory, setSelectedCategory] = useState("All Tiers");

  // Modals state
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsModalData, setSmsModalData] = useState({});
  const [diagModalOpen, setDiagModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [error, setError] = useState(null);

  // Live Alert notification
  const [liveAlertMessage, setLiveAlertMessage] = useState(null);

  // Ref to track current active route for live rechecks
  const activeRouteRef = useRef(activeRouteData);
  useEffect(() => {
    activeRouteRef.current = activeRouteData;
  }, [activeRouteData]);

  // Fetch ground-truth field reports & trigger dynamic route re-check
  const fetchFieldReports = async () => {
    try {
      const res = await fetch('http://localhost:8000/reports/list');
      if (res.ok) {
        const data = await res.json();
        const reports = data.reports || [];
        setFieldReports(reports);

        // If a route is active, re-check for newly submitted landslides
        if (activeRouteRef.current && activeRouteRef.current.origin) {
          recheckActiveRoute(activeRouteRef.current.origin.latitude, activeRouteRef.current.origin.longitude);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch field reports:", err);
    }
  };

  useEffect(() => {
    fetchFieldReports();
  }, []);

  // Fetch Spatial Risk Heatmap GeoJSON from backend
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
        console.error("Failed to fetch heatmap:", err);
        setScanning(false);
      });
  };

  useEffect(() => {
    fetchHeatmap(false);
  }, [selectedState, selectedCategory]);

  // Fetch Location Risk
  const fetchRiskForLocation = async (lat, lon, name = null) => {
    setLoading(true);
    setError(null);
    setSelectedLocation({ lat, lon, name: name || `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E` });

    try {
      const response = await fetch(`http://localhost:8000/risk/location?lat=${lat}&lon=${lon}`);
      if (!response.ok) throw new Error("Failed to extract location risk metrics");
      const data = await response.json();
      setRiskData(data);
      if (data && data.category) {
        setSelectedLocation(prev => ({ ...prev, category: data.category }));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to reach risk service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskForLocation(25.5788, 91.8933, "Shillong (Meghalaya)");
  }, []);

  // Scan Real-Time User GPS
  const handleScanUserLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your device.");
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        setLocatingUser(false);
        fetchRiskForLocation(lat, lon, `🎯 Live GPS (${lat}°, ${lon}°)`);
      },
      (err) => {
        setLocatingUser(false);
        setError("GPS position unavailable: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Safe Route Calculation
  const handleSelectRoute = async (originLat, originLon, originName = null, destLat = null, destLon = null, destName = null) => {
    setLoading(true);
    setError(null);
    setLiveAlertMessage(null);
    try {
      let url = `http://localhost:8000/emergency/evacuation-route?origin_lat=${originLat}&origin_lon=${originLon}`;
      if (destLat !== null && destLat !== undefined && destLon !== null && destLon !== undefined) {
        url += `&dest_lat=${destLat}&dest_lon=${destLon}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to compute evacuation route");
      const routeResult = await response.json();
      setActiveRouteData(routeResult);
      setSelectedLocation({
        lat: originLat,
        lon: originLon,
        name: originName || "Evacuation Origin"
      });
      setActiveTab('gis');
    } catch (err) {
      console.error(err);
      setError(err.message || "Routing service failed.");
    } finally {
      setLoading(false);
    }
  };

  // Re-check Active Route Dynamically when new reports arrive
  const recheckActiveRoute = async (originLat, originLon) => {
    try {
      let url = `http://localhost:8000/emergency/evacuation-route?origin_lat=${originLat}&origin_lon=${originLon}`;
      if (activeRouteRef.current?.destination?.latitude && activeRouteRef.current?.destination?.longitude) {
        url += `&dest_lat=${activeRouteRef.current.destination.latitude}&dest_lon=${activeRouteRef.current.destination.longitude}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const routeResult = await response.json();
        if (routeResult.is_rerouted && (!activeRouteRef.current || !activeRouteRef.current.is_rerouted)) {
          setLiveAlertMessage("⚡ Live Alert: New landslide detected on your route! Safer alternative route automatically calculated.");
        }
        setActiveRouteData(routeResult);
      }
    } catch (err) {
      console.warn("Live route re-check failed:", err);
    }
  };

  // Live Geocoding Search Handler for Main Search Bar
  const searchDebounceRef = useRef(null);
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (val.trim().length >= 2) {
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`http://localhost:8000/geocode/search?q=${encodeURIComponent(val)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.results || []);
          }
        } catch (err) {
          console.warn("Header search geocode error:", err);
        }
      }, 250);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectSearchResult = (loc) => {
    setSearchQuery(loc.name);
    setSearchResults([]);
    fetchRiskForLocation(loc.latitude || loc.lat, loc.longitude || loc.lon, loc.name);
  };

  const openAlertModal = (customData = {}) => {
    setSmsModalData({
      locationName: customData.locationName || selectedLocation.name,
      lat: customData.lat || selectedLocation.lat,
      lon: customData.lon || selectedLocation.lon,
      riskScore: customData.riskScore || riskData?.risk_score || 84.5
    });
    setSmsModalOpen(true);
  };

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <header className="app-navbar">
        <div className="navbar-brand" onClick={() => setActiveTab('gis')}>
          <span className="brand-icon">⛰️</span>
          <div className="brand-text-group">
            <span className="brand-title">NE-GeoAlert</span>
            <span className="brand-tagline">Northeast India Landslide Risk & Evacuation GIS</span>
          </div>
        </div>

        <nav className="navbar-nav">
          <button 
            className={`nav-item ${activeTab === 'gis' ? 'active' : ''}`}
            onClick={() => setActiveTab('gis')}
          >
            🗺️ Map View
          </button>
          <button 
            className={`nav-item ${activeTab === 'emergency' ? 'active' : ''}`}
            onClick={() => setActiveTab('emergency')}
          >
            🚨 Emergency Ops
          </button>
          <button 
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            📷 Field Reports
          </button>
          <button 
            className="nav-item alerts-btn"
            onClick={() => openAlertModal()}
          >
            🔔 SMS Dispatch
          </button>
        </nav>

        <div className="navbar-right">
          <button 
            className={`btn-my-location ${locatingUser ? 'locating' : ''}`}
            onClick={handleScanUserLocation}
            disabled={locatingUser}
          >
            {locatingUser ? '🛰️ Locking...' : '📍 My Location'}
          </button>

          <button 
            className="btn-settings-icon"
            onClick={() => setDiagModalOpen(true)}
            title="System Diagnostics & Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Toolbar / Control Bar (GIS View) */}
      {activeTab === 'gis' && (
        <div className="gis-control-toolbar">
          {/* Location Search Container */}
          <div className="search-input-box">
            <span className="search-icon">🔍</span>
            <input 
              type="text"
              className="search-field"
              placeholder="Search location, district, or road..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button className="btn-clear-search" onClick={() => setSearchQuery('')}>✕</button>
            )}

            {searchResults.length > 0 && (
              <div className="search-results-dropdown">
                {searchResults.map((loc, idx) => (
                  <div 
                    key={idx} 
                    className="search-item"
                    onClick={() => handleSelectSearchResult(loc)}
                  >
                    <span className="search-item-icon">📍</span>
                    <div className="search-item-info">
                      <span className="search-item-title">{loc.name}</span>
                      {loc.subtitle && <span className="search-item-sub">{loc.subtitle}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Presets Row */}
          <div className="preset-chips-row">
            <span className="chips-label">Presets:</span>
            {PRESET_LOCATIONS.slice(0, 6).map((loc, idx) => (
              <button
                key={idx}
                className={`preset-chip ${selectedLocation.name === loc.name ? 'active' : ''}`}
                onClick={() => fetchRiskForLocation(loc.lat, loc.lon, loc.name)}
              >
                {loc.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Coverage Filters */}
          <div className="toolbar-filters">
            <select 
              className="filter-select-dropdown"
              value={selectedState} 
              onChange={e => setSelectedState(e.target.value)}
            >
              {STATE_OPTIONS.map((st, i) => (
                <option key={i} value={st}>{st}</option>
              ))}
            </select>

            <div className="tier-filter-buttons">
              {TIER_OPTIONS.map((cat, i) => (
                <button
                  key={i}
                  className={`btn-tier-filter ${cat.toLowerCase()} ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {liveAlertMessage && (
        <div className="live-route-alert-banner">
          <span>{liveAlertMessage}</span>
          <button onClick={() => setLiveAlertMessage(null)}>✕</button>
        </div>
      )}

      {/* Main View Content */}
      <main className="app-main-workspace">
        {activeTab === 'gis' ? (
          <div className="gis-main-grid">
            {/* GIS Map Canvas (Left Column) */}
            <div className="gis-map-column">
              <RiskMap 
                selectedLocation={selectedLocation} 
                heatmapData={heatmapData}
                routeData={activeRouteData}
                fieldReports={fieldReports}
                onLocationSelect={(lat, lon, name) => fetchRiskForLocation(lat, lon, name)}
                onClearRoute={() => setActiveRouteData(null)}
              />
            </div>

            {/* Risk Intelligence Panel & Route Planner (Right Column) */}
            <div className="gis-panel-column">
              <RoutePlannerCard 
                selectedLocation={selectedLocation}
                onCalculateRoute={handleSelectRoute}
                activeRouteData={activeRouteData}
                onClearRoute={() => setActiveRouteData(null)}
                loading={loading}
              />
              <RiskPanel 
                data={riskData} 
                loading={loading} 
                error={error} 
                locationName={selectedLocation.name}
                onOpenSmsModal={openAlertModal}
                onFindSafeRoute={(lat, lon, name) => handleSelectRoute(lat, lon, name)}
              />
            </div>
          </div>
        ) : activeTab === 'emergency' ? (
          <div className="tab-page-wrapper">
            <EmergencyPanel 
              onSelectRoute={handleSelectRoute}
              activeRouteData={activeRouteData}
              onOpenSmsModal={openAlertModal}
              onSwitchToMap={() => setActiveTab('gis')}
            />
          </div>
        ) : (
          <div className="tab-page-wrapper">
            <FieldReportPanel 
              onReportSubmitted={fetchFieldReports}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <SmsControlModal 
        isOpen={smsModalOpen}
        onClose={() => setSmsModalOpen(false)}
        initialData={smsModalData}
      />

      <SystemDiagnosticsModal 
        isOpen={diagModalOpen}
        onClose={() => setDiagModalOpen(false)}
      />
    </div>
  );
}

export default App;
