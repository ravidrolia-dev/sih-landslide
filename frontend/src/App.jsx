import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import RiskMap from './RiskMap';
import RiskPanel from './RiskPanel';
import EmergencyPanel from './EmergencyPanel';
import FieldReportPanel from './FieldReportPanel';
import SmsControlModal from './SmsControlModal';
import SystemDiagnosticsModal from './SystemDiagnosticsModal';
import RoutePlannerCard from './RoutePlannerCard';
import BacktestPanel from './BacktestPanel';
import { API_BASE_URL } from './config';

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

  // Floating Panels & UI Expansion State (Zoom Earth Style)
  const [isRoutePlannerOpen, setIsRoutePlannerOpen] = useState(false);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);

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
    if (activeRouteData) {
      setIsRoutePlannerOpen(true);
    }
  }, [activeRouteData]);

  // Fetch ground-truth field reports & trigger dynamic route re-check
  const fetchFieldReports = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/list`);
      if (res.ok) {
        const data = await res.json();
        const reports = data.reports || [];
        setFieldReports(reports);

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
    let url = `${API_BASE_URL}/risk/heatmap`;
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
    setIsInfoCardCollapsed(false);
    setSelectedLocation({ lat, lon, name: name || `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E` });

    try {
      const response = await fetch(`${API_BASE_URL}/risk/location?lat=${lat}&lon=${lon}`);
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
    setIsRoutePlannerOpen(true);
    try {
      let url = `${API_BASE_URL}/emergency/evacuation-route?origin_lat=${originLat}&origin_lon=${originLon}`;
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
      let url = `${API_BASE_URL}/emergency/evacuation-route?origin_lat=${originLat}&origin_lon=${originLon}`;
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
          const res = await fetch(`${API_BASE_URL}/geocode/search?q=${encodeURIComponent(val)}`);
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
    <div className="app-layout zoom-earth-layout">
      {/* 100% Viewport Fullscreen Interactive Map Canvas */}
      <div className="fullscreen-map-wrapper">
        <RiskMap 
          selectedLocation={selectedLocation} 
          heatmapData={heatmapData}
          routeData={activeRouteData}
          fieldReports={fieldReports}
          onLocationSelect={(lat, lon, name) => fetchRiskForLocation(lat, lon, name)}
          onClearRoute={() => setActiveRouteData(null)}
          onScanLocation={handleScanUserLocation}
          locatingUser={locatingUser}
        />
      </div>

      {/* Top Floating Glass Navbar */}
      <header className="floating-navbar-glass">
        <div className="floating-brand" onClick={() => setActiveTab('gis')}>
          <span className="brand-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3l4 8 5-5 5 15H2L8 3z"></path>
            </svg>
          </span>
          <span className="brand-title-text">NE-GeoAlert</span>
        </div>

        <nav className="floating-nav-pills">
          <button 
            className={`floating-nav-btn ${activeTab === 'gis' ? 'active' : ''}`}
            onClick={() => setActiveTab('gis')}
            title="Map View"
          >
            <span className="nav-btn-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                <line x1="8" y1="2" x2="8" y2="18"></line>
                <line x1="16" y1="6" x2="16" y2="22"></line>
              </svg>
            </span>
            <span className="nav-btn-text">Map View</span>
          </button>

          <button 
            className={`floating-nav-btn ${activeTab === 'emergency' ? 'active' : ''}`}
            onClick={() => setActiveTab('emergency')}
            title="Emergency Ops"
          >
            <span className="nav-btn-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </span>
            <span className="nav-btn-text">Emergency Ops</span>
          </button>

          <button 
            className={`floating-nav-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
            title="Field Reports"
          >
            <span className="nav-btn-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </span>
            <span className="nav-btn-text">Field Reports</span>
          </button>

          <button 
            className={`floating-nav-btn ${activeTab === 'backtest' ? 'active' : ''}`}
            onClick={() => setActiveTab('backtest')}
            title="Model Backtest"
          >
            <span className="nav-btn-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </span>
            <span className="nav-btn-text">Model Backtest</span>
          </button>

          <button 
            className="floating-nav-btn alerts-pill"
            onClick={() => openAlertModal()}
            title="SMS Dispatch"
          >
            <span className="nav-btn-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-9 4a2 2 0 0 1-4 0"></path>
              </svg>
            </span>
            <span className="nav-btn-text">SMS Dispatch</span>
          </button>
        </nav>
      </header>

      {/* GIS Mode Floating Controls */}
      {activeTab === 'gis' && (
        <>
          {/* Search Bar (Floating Upper-Left) */}
          <div className="floating-search-box">
            <span className="search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input 
              type="text"
              className="floating-search-input"
              placeholder="Search location, district, road..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button className="btn-clear-search" onClick={() => setSearchQuery('')}>✕</button>
            )}

            {/* Dropdown Auto-Complete Results */}
            {searchResults.length > 0 && (
              <div className="floating-search-results">
                {searchResults.map((loc, idx) => (
                  <div 
                    key={idx} 
                    className="search-item"
                    onClick={() => handleSelectSearchResult(loc)}
                  >
                    <span className="search-item-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                    </span>
                    <div className="search-item-info">
                      <span className="search-item-title">{loc.name}</span>
                      {loc.subtitle && <span className="search-item-sub">{loc.subtitle}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Floating Risk & State Filters (Upper-Right) */}
          <div className="floating-filters-bar">
            <select 
              className="floating-filter-select"
              value={selectedState} 
              onChange={e => setSelectedState(e.target.value)}
            >
              {STATE_OPTIONS.map((st, i) => (
                <option key={i} value={st}>{st}</option>
              ))}
            </select>

            <div className="floating-tier-chips">
              {TIER_OPTIONS.map((cat, i) => (
                <button
                  key={i}
                  className={`floating-tier-btn ${cat.toLowerCase()} ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Floating Route Planner Button & Collapsible Glass Panel (Right Side) */}
          <div className="floating-route-container">
            <button 
              className={`floating-route-toggle-btn ${isRoutePlannerOpen ? 'active' : ''}`}
              onClick={() => setIsRoutePlannerOpen(prev => !prev)}
              title="Landslide-Safe Route Planner"
            >
              <span className="route-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
                </svg>
              </span>
              <span className="hover-label">Landslide-Safe Route</span>
            </button>

            {isRoutePlannerOpen && (
              <div className="floating-route-drawer-glass">
                <div className="drawer-header">
                  <h3>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                      <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
                    </svg>
                    Landslide-Safe Route Planner
                  </h3>
                  <button className="btn-close-drawer" onClick={() => setIsRoutePlannerOpen(false)}>✕</button>
                </div>
                <RoutePlannerCard 
                  selectedLocation={selectedLocation}
                  onCalculateRoute={handleSelectRoute}
                  activeRouteData={activeRouteData}
                  onClearRoute={() => setActiveRouteData(null)}
                  loading={loading}
                />
              </div>
            )}
          </div>

          {/* Floating Location Risk Information Card (Bottom-Right) */}
          {riskData && (
            <div className="floating-info-card-container">
              {isInfoCardCollapsed ? (
                <div className="floating-chip-mini" onClick={() => setIsInfoCardCollapsed(false)}>
                  <span className="chip-pin">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  </span>
                  <span className="chip-name">{selectedLocation.name || 'Queried Point'}</span>
                  <span className={`chip-badge ${riskData.category?.toLowerCase()}`}>
                    {riskData.category || 'RISK'} ({riskData.risk_score}%)
                  </span>
                  <span className="expand-icon">▲</span>
                </div>
              ) : (
                <div className="floating-info-card-glass">
                  <div className="info-card-bar">
                    <span className="card-bar-title">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      Location Intel
                    </span>
                    <button className="collapse-btn" onClick={() => setIsInfoCardCollapsed(true)} title="Collapse Card">▼</button>
                  </div>
                  <RiskPanel 
                    data={riskData} 
                    loading={loading} 
                    error={error} 
                    locationName={selectedLocation.name}
                    onOpenSmsModal={openAlertModal}
                    onFindSafeRoute={(lat, lon, name) => {
                      setIsRoutePlannerOpen(true);
                      handleSelectRoute(lat, lon, name);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Floating Compact Risk Legend (Bottom-Left) */}
          <div className="floating-legend-container">
            {isLegendExpanded ? (
              <div className="floating-legend-glass">
                <div className="legend-header" onClick={() => setIsLegendExpanded(false)}>
                  <span className="legend-title">● Risk Legend</span>
                  <span className="collapse-icon">▼</span>
                </div>
                <div className="legend-items">
                  <div className="leg-row"><span className="dot watch">●</span> Low (&lt;25%)</div>
                  <div className="leg-row"><span className="dot alert">●</span> Moderate (25–50%)</div>
                  <div className="leg-row"><span className="dot warning">●</span> High (50–75%)</div>
                  <div className="leg-row"><span className="dot severe">●</span> Critical (&gt;75%)</div>
                  <div className="leg-row"><span className="dot hazard" style={{ color: '#ef4444' }}>★</span> Landslide Blockage</div>
                </div>
              </div>
            ) : (
              <div className="floating-legend-pill" onClick={() => setIsLegendExpanded(true)}>
                <span className="dot watch">●</span>
                <span className="legend-label">Risk</span>
                <span className="expand-icon">▲</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Floating Overlay Pages for non-GIS Tabs (Emergency Ops, Field Reports, Model Backtest) */}
      {activeTab !== 'gis' && (
        <div className="floating-tab-page-container">
          <div className="tab-page-glass-body">
            <button className="btn-close-tab-page" onClick={() => setActiveTab('gis')}>
              ✕ Return to Fullscreen Map
            </button>
            {activeTab === 'emergency' ? (
              <EmergencyPanel 
                onSelectRoute={handleSelectRoute}
                activeRouteData={activeRouteData}
                onOpenSmsModal={openAlertModal}
                onSwitchToMap={() => setActiveTab('gis')}
              />
            ) : activeTab === 'reports' ? (
              <FieldReportPanel onReportSubmitted={fetchFieldReports} />
            ) : (
              <BacktestPanel />
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <SmsControlModal isOpen={smsModalOpen} onClose={() => setSmsModalOpen(false)} initialData={smsModalData} />
      <SystemDiagnosticsModal isOpen={diagModalOpen} onClose={() => setDiagModalOpen(false)} />
    </div>
  );
}

export default App;

