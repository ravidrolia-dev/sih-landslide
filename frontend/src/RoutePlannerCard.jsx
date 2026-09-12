import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from './config';

export const ROUTE_LOCATIONS = [
  { name: "Shillong (Meghalaya)", lat: 25.5788, lon: 91.8933 },
  { name: "Guwahati (Assam)", lat: 26.1445, lon: 91.7362 },
  { name: "Kohima (Nagaland)", lat: 25.6747, lon: 94.1100 },
  { name: "Dimapur (Nagaland)", lat: 25.9064, lon: 93.7270 },
  { name: "Haflong (Assam)", lat: 25.1645, lon: 93.0176 },
  { name: "Silchar (Assam)", lat: 24.8333, lon: 92.7789 },
  { name: "Tezpur (Assam)", lat: 26.6338, lon: 92.8001 },
  { name: "Imphal (Manipur)", lat: 24.8170, lon: 93.9368 },
  { name: "Aizawl (Mizoram)", lat: 23.744, lon: 92.703 },
  { name: "Itanagar (Arunachal)", lat: 27.0844, lon: 93.6053 },
  { name: "Tawang (Arunachal)", lat: 27.5860, lon: 91.8594 },
  { name: "Gangtok (Sikkim)", lat: 27.3389, lon: 88.6065 },
  { name: "Agartala (Tripura)", lat: 23.8315, lon: 91.2868 }
];

const RoutePlannerCard = ({ 
  selectedLocation, 
  onCalculateRoute, 
  activeRouteData, 
  onClearRoute,
  loading 
}) => {
  // Source Location State
  const [sourceSearch, setSourceSearch] = useState("Shillong (Meghalaya)");
  const [sourceLoc, setSourceLoc] = useState({ name: "Shillong (Meghalaya)", lat: 25.5788, lon: 91.8933 });
  const [sourceResults, setSourceResults] = useState([]);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);

  // Destination Location State
  const [destSearch, setDestSearch] = useState("Guwahati (Assam)");
  const [destLoc, setDestLoc] = useState({ name: "Guwahati (Assam)", lat: 26.1445, lon: 91.7362 });
  const [destResults, setDestResults] = useState([]);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [isAutoHub, setIsAutoHub] = useState(false);

  const sourceDebounceTimer = useRef(null);
  const destDebounceTimer = useRef(null);

  // Sync clicked location from map to source
  useEffect(() => {
    if (selectedLocation && selectedLocation.lat && selectedLocation.lon) {
      setSourceLoc({
        name: selectedLocation.name || `📍 Clicked (${selectedLocation.lat.toFixed(3)}°, ${selectedLocation.lon.toFixed(3)}°)`,
        lat: selectedLocation.lat,
        lon: selectedLocation.lon
      });
      setSourceSearch(selectedLocation.name || `📍 Clicked Point (${selectedLocation.lat.toFixed(3)}°, ${selectedLocation.lon.toFixed(3)}°)`);
    }
  }, [selectedLocation?.lat, selectedLocation?.lon]);

  // Live Geocoding Search for Source
  const handleSourceInputChange = (e) => {
    const val = e.target.value;
    setSourceSearch(val);

    if (sourceDebounceTimer.current) clearTimeout(sourceDebounceTimer.current);
    if (val.trim().length >= 2) {
      sourceDebounceTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/geocode/search?q=${encodeURIComponent(val)}`);
          if (res.ok) {
            const data = await res.json();
            setSourceResults(data.results || []);
            setShowSourceDropdown(true);
          }
        } catch (err) {
          console.warn("Source geocode error:", err);
        }
      }, 250);
    } else {
      setSourceResults([]);
      setShowSourceDropdown(false);
    }
  };

  const handleSelectSourceItem = (item) => {
    const locObj = {
      name: item.name,
      lat: item.latitude,
      lon: item.longitude,
      display: item.display_name
    };
    setSourceLoc(locObj);
    setSourceSearch(item.name);
    setShowSourceDropdown(false);
  };

  // Live Geocoding Search for Destination
  const handleDestInputChange = (e) => {
    const val = e.target.value;
    setDestSearch(val);
    setIsAutoHub(false);

    if (destDebounceTimer.current) clearTimeout(destDebounceTimer.current);
    if (val.trim().length >= 2) {
      destDebounceTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/geocode/search?q=${encodeURIComponent(val)}`);
          if (res.ok) {
            const data = await res.json();
            setDestResults(data.results || []);
            setShowDestDropdown(true);
          }
        } catch (err) {
          console.warn("Destination geocode error:", err);
        }
      }, 250);
    } else {
      setDestResults([]);
      setShowDestDropdown(false);
    }
  };

  const handleSelectDestItem = (item) => {
    const locObj = {
      name: item.name,
      lat: item.latitude,
      lon: item.longitude,
      display: item.display_name
    };
    setDestLoc(locObj);
    setDestSearch(item.name);
    setIsAutoHub(false);
    setShowDestDropdown(false);
  };

  const handleSelectAutoHub = () => {
    setIsAutoHub(true);
    setDestSearch("🏥 Auto Nearest Relief Hub");
    setDestLoc(null);
    setShowDestDropdown(false);
  };

  // Swap Source and Destination
  const handleSwap = () => {
    if (isAutoHub) return;
    const tempSearch = sourceSearch;
    const tempLoc = sourceLoc;

    setSourceSearch(destSearch);
    setSourceLoc(destLoc);

    setDestSearch(tempSearch);
    setDestLoc(tempLoc);
  };

  // Trigger Safe Route Calculation
  const handleCalculate = () => {
    if (!sourceLoc) return;

    let destLat = null;
    let destLon = null;
    let destName = null;

    if (!isAutoHub && destLoc) {
      destLat = destLoc.lat;
      destLon = destLoc.lon;
      destName = destLoc.name;
    }

    onCalculateRoute(sourceLoc.lat, sourceLoc.lon, sourceLoc.name, destLat, destLon, destName);
  };

  return (
    <div className="route-planner-card">
      <div className="planner-inputs-container">
        {/* Source Input (Origin) */}
        <div className="input-group-row search-relative">
          <span className="dot-indicator green">🟢</span>
          <div className="input-field-wrapper">
            <label className="input-lbl">SOURCE (ORIGIN)</label>
            <input 
              type="text"
              className="geocode-search-input"
              placeholder="Search any starting place, station, landmark..."
              value={sourceSearch}
              onChange={handleSourceInputChange}
              onFocus={() => sourceResults.length > 0 && setShowSourceDropdown(true)}
            />
          </div>

          {showSourceDropdown && sourceResults.length > 0 && (
            <div className="geocode-dropdown-list">
              {sourceResults.map((item, idx) => (
                <div 
                  key={idx} 
                  className="geocode-item"
                  onClick={() => handleSelectSourceItem(item)}
                >
                  <span className="item-icon">📍</span>
                  <div className="item-text">
                    <span className="item-title">{item.name}</span>
                    <span className="item-sub">{item.subtitle}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Swap Action Button */}
        <div className="planner-swap-row">
          <button 
            className="btn-swap-locations"
            onClick={handleSwap}
            title="Swap Source and Destination"
            disabled={isAutoHub}
          >
            ⇅
          </button>
          <span className="swap-divider-line"></span>
        </div>

        {/* Destination Input */}
        <div className="input-group-row search-relative">
          <span className="dot-indicator red">🔴</span>
          <div className="input-field-wrapper">
            <div className="dest-lbl-row">
              <label className="input-lbl">DESTINATION</label>
              <button 
                className={`btn-auto-hub-pill ${isAutoHub ? 'active' : ''}`}
                onClick={handleSelectAutoHub}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Auto Relief Hub
              </button>
            </div>
            <input 
              type="text"
              className="geocode-search-input"
              placeholder="Search any destination city, address, hub..."
              value={destSearch}
              onChange={handleDestInputChange}
              onFocus={() => destResults.length > 0 && setShowDestDropdown(true)}
            />
          </div>

          {showDestDropdown && destResults.length > 0 && (
            <div className="geocode-dropdown-list">
              <div className="geocode-item special-hub" onClick={handleSelectAutoHub}>
                <span className="item-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </span>
                <div className="item-text">
                  <span className="item-title">Auto Nearest Relief Hub</span>
                  <span className="item-sub">Automatically finds closest safe emergency hub</span>
                </div>
              </div>
              {destResults.map((item, idx) => (
                <div 
                  key={idx} 
                  className="geocode-item"
                  onClick={() => handleSelectDestItem(item)}
                >
                  <span className="item-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  </span>
                  <div className="item-text">
                    <span className="item-title">{item.name}</span>
                    <span className="item-sub">{item.subtitle}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Presets Row */}
        <div className="quick-presets-strip">
          <span className="quick-lbl">Quick Presets:</span>
          {ROUTE_LOCATIONS.slice(0, 5).map((loc, idx) => (
            <button 
              key={idx} 
              className="btn-preset-mini"
              onClick={() => {
                setDestLoc(loc);
                setDestSearch(loc.name);
                setIsAutoHub(false);
              }}
            >
              ➔ {loc.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="planner-actions">
        <button 
          className="btn-find-route-submit"
          onClick={handleCalculate}
          disabled={loading}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
            <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
          </svg>
          {loading ? 'Calculating Safe Route...' : 'Calculate Landslide-Safe Route'}
        </button>

        {activeRouteData && (
          <button 
            className="btn-clear-active-route"
            onClick={onClearRoute}
            title="Clear Route from Map"
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default RoutePlannerCard;
