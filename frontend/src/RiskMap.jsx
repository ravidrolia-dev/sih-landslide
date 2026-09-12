import React, { useEffect } from 'react';
import { MapContainer, TileLayer, LayersControl, WMSTileLayer, Marker, Popup, GeoJSON, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component to auto-fly map or fit bounds to active evacuation route
const MapViewUpdater = ({ targetLoc, routeData }) => {
  const map = useMap();
  useEffect(() => {
    if (routeData && routeData.safe_route_geojson && routeData.safe_route_geojson.geometry?.coordinates) {
      const coords = routeData.safe_route_geojson.geometry.coordinates.map(c => [c[1], c[0]]);
      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13, duration: 1.5 });
        return;
      }
    } else if (routeData && routeData.route_geojson && routeData.route_geojson.geometry?.coordinates) {
      const coords = routeData.route_geojson.geometry.coordinates.map(c => [c[1], c[0]]);
      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13, duration: 1.5 });
        return;
      }
    }
    if (targetLoc && targetLoc.lat && targetLoc.lon) {
      map.flyTo([targetLoc.lat, targetLoc.lon], 11, { duration: 1.5 });
    }
  }, [targetLoc?.lat, targetLoc?.lon, routeData]);
  return null;
};

// Custom SVG pin marker for Leaflet
const createCustomIcon = (color = '#ef4444', iconSymbol = null) => {
  if (iconSymbol === 'landslide') {
    const hazardSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#dc2626" width="36" height="36">
        <path d="M12 2L1 21h22L12 2zm0 3.5L20 19H4L12 5.5zM11 10h2v4h-2zm0 5h2v2h-2z"/>
      </svg>`;
    return L.divIcon({
      className: 'custom-leaflet-marker hazard-block-marker',
      html: hazardSvg,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>`;
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const { BaseLayer, Overlay } = LayersControl;

const getCategoryColor = (cat) => {
  switch (cat) {
    case 'Severe': return '#ef4444'; // Red
    case 'Warning': return '#f97316'; // Orange
    case 'Alert': return '#eab308'; // Yellow
    default: return '#10b981'; // Green
  }
};

const CustomMapControls = ({ 
  onScanLocation, 
  locatingUser, 
  activeBaseMap, 
  setActiveBaseMap, 
  showRiskGrid, 
  setShowRiskGrid 
}) => {
  const map = useMap();
  const [isLayersPanelOpen, setIsLayersPanelOpen] = React.useState(false);
  
  const handleZoomIn = (e) => {
    e.stopPropagation();
    map.zoomIn();
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    map.zoomOut();
  };

  const handleLocateUser = (e) => {
    e.stopPropagation();
    if (onScanLocation) {
      onScanLocation();
    }
  };

  const handleResetView = (e) => {
    e.stopPropagation();
    map.flyTo([26.0, 92.8], 7, { duration: 1.2 });
  };

  const handleToggleFullscreen = (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  };

  return (
    <div className="custom-map-controls-stack">
      <button className="control-btn" onClick={handleZoomIn} title="Zoom In">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <button className="control-btn" onClick={handleZoomOut} title="Zoom Out">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      {/* Layers Switcher SVG Button */}
      <button 
        className={`control-btn ${isLayersPanelOpen ? 'active' : ''}`}
        onClick={(e) => { e.stopPropagation(); setIsLayersPanelOpen(!isLayersPanelOpen); }}
        title="Map Base & Imagery Layers"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      </button>

      <button 
        className={`control-btn ${locatingUser ? 'locating' : ''}`} 
        onClick={handleLocateUser} 
        title="My Location (Live GPS)"
        disabled={locatingUser}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8"></circle>
          <line x1="12" y1="2" x2="12" y2="5"></line>
          <line x1="12" y1="19" x2="12" y2="22"></line>
          <line x1="2" y1="12" x2="5" y2="12"></line>
          <line x1="19" y1="12" x2="22" y2="12"></line>
          <circle cx="12" cy="12" r="2.5" fill="currentColor"></circle>
        </svg>
      </button>

      <button className="control-btn" onClick={handleResetView} title="Reset Region View (NER)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
        </svg>
      </button>

      <button className="control-btn" onClick={handleToggleFullscreen} title="Fullscreen Toggle">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
      </button>

      {/* Floating Glassmorphism Layers Selector Panel */}
      {isLayersPanelOpen && (
        <div className="floating-layer-menu-glass" onClick={(e) => e.stopPropagation()}>
          <div className="layer-menu-header">
            <span className="layer-menu-title">MAP BASE & LAYERS</span>
            <button className="layer-menu-close" onClick={() => setIsLayersPanelOpen(false)}>✕</button>
          </div>

          <div className="layer-section-label">BASE MAP</div>
          <div className="layer-options-group">
            <button 
              className={`layer-opt-btn ${activeBaseMap === 'satellite' ? 'selected' : ''}`}
              onClick={() => setActiveBaseMap('satellite')}
            >
              <span className="opt-icon">🛰️</span>
              <span className="opt-label">Satellite (Esri)</span>
            </button>

            <button 
              className={`layer-opt-btn ${activeBaseMap === 'topo' ? 'selected' : ''}`}
              onClick={() => setActiveBaseMap('topo')}
            >
              <span className="opt-icon">⛰️</span>
              <span className="opt-label">Topographic (OpenTopo)</span>
            </button>

            <button 
              className={`layer-opt-btn ${activeBaseMap === 'osm' ? 'selected' : ''}`}
              onClick={() => setActiveBaseMap('osm')}
            >
              <span className="opt-icon">🗺️</span>
              <span className="opt-label">Streets (OpenStreetMap)</span>
            </button>
          </div>

          <div className="layer-section-label" style={{ marginTop: '10px' }}>DATA OVERLAYS</div>
          <div className="layer-options-group">
            <button 
              className={`layer-opt-btn ${showRiskGrid ? 'selected' : ''}`}
              onClick={() => setShowRiskGrid(!showRiskGrid)}
            >
              <span className="opt-icon">{showRiskGrid ? '🟢' : '⚪'}</span>
              <span className="opt-label">Landslide Risk Grid</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const RiskMap = ({ selectedLocation, onLocationSelect, heatmapData, routeData, fieldReports, onClearRoute, onScanLocation, locatingUser }) => {
  const center = [26.0, 92.8]; 
  const zoom = 7;
  const [activeBaseMap, setActiveBaseMap] = React.useState('satellite');
  const [showRiskGrid, setShowRiskGrid] = React.useState(true);

  const geoJsonStyle = (feature) => {
    const color = getCategoryColor(feature.properties.category);
    return {
      fillColor: color,
      weight: 1,
      opacity: 0.85,
      color: color,
      fillOpacity: 0.45
    };
  };

  const onEachFeature = (feature, layer) => {
    const p = feature.properties;
    const catColor = getCategoryColor(p.category);
    layer.bindTooltip(`
      <div style="font-family: system-ui, sans-serif; padding: 4px; line-height: 1.4;">
        <strong style="color: #ffffff; font-size: 12px;">${p.district} (${p.state})</strong><br/>
        <span style="color: ${catColor}; font-weight: bold; font-size: 11px;">Risk Score: ${p.risk_score}% (${p.category})</span>
      </div>
    `, { sticky: true, opacity: 0.95 });

    layer.on({
      click: () => {
        onLocationSelect(p.center_lat, p.center_lon, `${p.district} (${p.state}) Grid`);
      }
    });
  };

  // Safe Route coordinates
  const safeCoords = routeData?.safe_route_geojson?.geometry?.coordinates?.map(c => [c[1], c[0]]) ||
                    routeData?.route_geojson?.geometry?.coordinates?.map(c => [c[1], c[0]]) || [];

  // Original Blocked Route coordinates (if rerouted)
  const origCoords = routeData?.original_route_geojson?.geometry?.coordinates?.map(c => [c[1], c[0]]) || [];

  // Affected Landslide Hazard points
  const affectedHazards = routeData?.affected_hazards || [];

  return (
    <div className="gis-map-container">
      <MapContainer center={center} zoom={zoom} zoomControl={false} style={{ height: '100%', width: '100%', borderRadius: '0' }}>
        <MapClickHandler onLocationSelect={onLocationSelect} />
        <MapViewUpdater targetLoc={selectedLocation} routeData={routeData} />
        <CustomMapControls 
          onScanLocation={onScanLocation} 
          locatingUser={locatingUser}
          activeBaseMap={activeBaseMap}
          setActiveBaseMap={setActiveBaseMap}
          showRiskGrid={showRiskGrid}
          setShowRiskGrid={setShowRiskGrid}
        />
        
        {/* Dynamic Tile Layer rendering based on custom layer switcher */}
        {activeBaseMap === 'satellite' && (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri World Imagery</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        {activeBaseMap === 'topo' && (
          <TileLayer
            attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxZoom={17}
          />
        )}
        {activeBaseMap === 'osm' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        {/* Heatmap GeoJSON Layer */}
        {showRiskGrid && heatmapData && heatmapData.features && (
          <GeoJSON 
            key={JSON.stringify(heatmapData.summary || heatmapData.features.length)}
            data={heatmapData} 
            style={geoJsonStyle} 
            onEachFeature={onEachFeature} 
          />
        )}

        {/* Render Original Blocked Route as a Faded Red Dashed Polyline if Rerouted */}
        {routeData?.is_rerouted && origCoords.length > 0 && (
          <Polyline 
            positions={origCoords} 
            pathOptions={{ color: '#ef4444', weight: 4, opacity: 0.7, dashArray: '8, 8' }} 
          />
        )}

        {/* Render Safe Alternative Route in Solid Vibrant Blue/Emerald */}
        {safeCoords.length > 0 && (
          <>
            <Polyline 
              positions={safeCoords} 
              pathOptions={{ color: '#0284c7', weight: 8, opacity: 0.6 }} 
            />
            <Polyline 
              positions={safeCoords} 
              pathOptions={{ color: '#38bdf8', weight: 5, opacity: 1.0 }} 
            />
          </>
        )}

        {/* Destination Relief Hub Marker */}
        {routeData && routeData.destination && (
          <Marker 
            position={[routeData.destination.latitude, routeData.destination.longitude]}
            icon={createCustomIcon('#3b82f6')}
          >
            <Popup>
              <div style={{ padding: '6px', textAlign: 'center' }}>
                <strong style={{ fontSize: '13px', color: '#2563eb' }}>
                  🏁 Safe Destination Hub: {routeData.destination.nearest_safe_hub}
                </strong>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  Safe Distance: <strong>{routeData.distance_km} km</strong><br/>
                  ETA: <strong>{routeData.estimated_time_mins} mins</strong>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Intersecting Landslide Hazard Blockage Markers (🔴/💥) */}
        {affectedHazards.map((h, idx) => (
          <Marker
            key={`hazard_block_${idx}`}
            position={[h.latitude, h.longitude]}
            icon={createCustomIcon('#dc2626', 'landslide')}
          >
            <Popup>
              <div style={{ padding: '6px', maxWidth: '240px', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontWeight: 'bold' }}>
                  <span style={{ fontSize: '16px' }}>💥</span>
                  <span>ACTIVE LANDSLIDE BLOCKAGE</span>
                </div>
                <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginTop: '4px' }}>
                  {h.title || h.location_name}
                </strong>
                <p style={{ fontSize: '11px', color: '#475569', margin: '4px 0' }}>
                  {h.description}
                </p>
                <div style={{ fontSize: '11px', color: '#991b1b', background: '#fee2e2', padding: '4px', borderRadius: '4px' }}>
                  ⚠️ Proximity to Original Route: <strong>{h.distance_to_route_km || 0.5} km</strong>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Field Report Camera Incident Markers */}
        {fieldReports && fieldReports.map((report) => (
          <Marker
            key={report.id}
            position={[report.latitude, report.longitude]}
            icon={createCustomIcon(report.severity === 'CRITICAL' ? '#dc2626' : report.severity === 'HIGH' ? '#ea580c' : '#eab308')}
          >
            <Popup>
              <div style={{ padding: '6px', maxWidth: '220px', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>📸</span>
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>{report.title}</strong>
                </div>

                {report.image_url && (
                  <img 
                    src={report.image_url} 
                    alt={report.title} 
                    style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }}
                  />
                )}

                <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
                  <strong>Severity:</strong> <span style={{ color: report.severity === 'CRITICAL' ? '#dc2626' : '#ea580c', fontWeight: 'bold' }}>{report.severity}</span><br/>
                  <strong>Reporter:</strong> {report.reporter_name}<br/>
                  <strong>Coords:</strong> {report.latitude.toFixed(4)}°, {report.longitude.toFixed(4)}°
                </div>

                <p style={{ fontSize: '11px', color: '#334155', margin: '4px 0 0 0', lineHeight: '1.3' }}>
                  {report.description}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Selected Location Marker Pin */}
        {selectedLocation && (
          <Marker 
            position={[selectedLocation.lat, selectedLocation.lon]} 
            icon={createCustomIcon(getCategoryColor(selectedLocation.category))}
          >
            <Popup>
              <div style={{ padding: '4px', textAlign: 'center' }}>
                <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                  {selectedLocation.name || 'Queried Location'}
                </strong>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lon.toFixed(4)}°E
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Floating Active Evacuation Route Banner */}
      {routeData && (
        <div className={`floating-route-card ${routeData.is_rerouted ? 'rerouted' : routeData.status === 'NO_SAFE_ROUTE_AVAILABLE' ? 'blocked' : ''}`}>
          <div className="route-card-main">
            <div className="route-header-line">
              {routeData.status === 'NO_SAFE_ROUTE_AVAILABLE' ? (
                <span className="route-badge no-route">🔴 NO SAFE ROUTE AVAILABLE</span>
              ) : routeData.is_rerouted ? (
                <span className="route-badge warning">⚠️ ROUTE AUTOMATICALLY CHANGED</span>
              ) : (
                <span className="route-badge safe">🟢 SAFE ROUTE</span>
              )}
            </div>

            {routeData.status === 'NO_SAFE_ROUTE_AVAILABLE' ? (
              <p className="route-reroute-msg red">
                🔴 All available highway routes are currently affected by active landslide hazards. Evacuation suspended.
              </p>
            ) : routeData.is_rerouted ? (
              <p className="route-reroute-msg amber">
                {routeData.reroute_reason || "Recent landslide detected on original route. We've selected a safer alternative."}
              </p>
            ) : null}

            {routeData.status !== 'NO_SAFE_ROUTE_AVAILABLE' && (
              <div className="route-metrics-row">
                <div className="r-metric">
                  <span className="r-lbl">Destination:</span>
                  <span className="r-val text-blue">{routeData.destination?.nearest_safe_hub}</span>
                </div>
                <div className="r-metric">
                  <span className="r-lbl">Distance:</span>
                  <span className="r-val text-amber">{routeData.distance_km} km</span>
                  {routeData.additional_distance_km > 0 && (
                    <span className="add-metric text-red"> (+{routeData.additional_distance_km} km detour)</span>
                  )}
                </div>
                <div className="r-metric">
                  <span className="r-lbl">ETA:</span>
                  <span className="r-val text-emerald">{routeData.estimated_time_mins} mins</span>
                  {routeData.additional_time_mins > 0 && (
                    <span className="add-metric text-red"> (+{routeData.additional_time_mins}m)</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="clear-route-icon-btn" onClick={onClearRoute} title="Clear Evacuation Route">
            ✕ Clear
          </button>
        </div>
      )}

      {/* Note: Legend is rendered cleanly in App.jsx floating UI stack */}
    </div>
  );
};

export default RiskMap;
