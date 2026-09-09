import React, { useEffect } from 'react';
import { MapContainer, TileLayer, LayersControl, WMSTileLayer, Marker, Popup, GeoJSON, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component to auto-fly map to selected location or fit bounds to active evacuation route
const MapViewUpdater = ({ targetLoc, routeData }) => {
  const map = useMap();
  useEffect(() => {
    if (routeData && routeData.route_geojson && routeData.route_geojson.geometry.coordinates) {
      const coords = routeData.route_geojson.geometry.coordinates.map(c => [c[1], c[0]]);
      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, duration: 1.5 });
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
const createCustomIcon = (color = '#ef4444') => {
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
    case 'Severe': return '#ef4444';
    case 'Warning': return '#f97316';
    case 'Alert': return '#eab308';
    default: return '#10b981';
  }
};

const RiskMap = ({ selectedLocation, onLocationSelect, heatmapData, routeData }) => {
  // Center map on overall North-East India region
  const center = [26.0, 92.8]; 
  const zoom = 7;

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
      <div style="font-family: sans-serif; padding: 4px; line-height: 1.4;">
        <strong style="color: ${catColor}; font-size: 13px;">${p.district} (${p.state}) • ${p.category}</strong><br/>
        <span>Real-Time GEE Risk: <strong>${p.risk_score}%</strong></span><br/>
        <span style="font-size: 11px; color: #64748b;">Slope: ${p.slope}° | 72h Rain: ${p.rainfall_72h}mm</span>
      </div>
    `, { sticky: true });

    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        onLocationSelect(p.center_lat, p.center_lon, `${p.district} (${p.state}) Grid`);
      }
    });
  };

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', borderRadius: '12px' }}>
      <MapClickHandler onLocationSelect={onLocationSelect} />
      <MapViewUpdater targetLoc={selectedLocation} routeData={routeData} />
      
      <LayersControl position="topright">
        <BaseLayer checked name="OpenTopoMap (Topographic)">
          <TileLayer
            attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxZoom={17}
          />
        </BaseLayer>

        <BaseLayer name="Satellite (Esri Imagery)">
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </BaseLayer>

        <BaseLayer name="Streets (OpenStreetMap)">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </BaseLayer>

        {/* Heatmap GeoJSON Layer */}
        {heatmapData && heatmapData.features && (
          <Overlay checked name="Real-Time GEE Satellite Grid">
            <GeoJSON 
              key={JSON.stringify(heatmapData.summary || heatmapData.features.length)}
              data={heatmapData} 
              style={geoJsonStyle} 
              onEachFeature={onEachFeature} 
            />
          </Overlay>
        )}

        <Overlay name="GSI Geology WMS Layer">
          <WMSTileLayer
            url="http://ogc.bgs.ac.uk/cgi-bin/BGS_GSI_Geology/wms?language=eng&"
            layers="IND_GSI_2M_Geology"
            format="image/png"
            transparent={true}
            opacity={0.6}
            attribution="Geological Survey of India"
          />
        </Overlay>
      </LayersControl>

      {/* 100% Real Turn-By-Turn Highway Evacuation Route Polyline & Safe Shelter Destination Marker */}
      {routeData && routeData.route_geojson && (
        <>
          {/* Outer glow stroke line */}
          <Polyline 
            positions={routeData.route_geojson.geometry.coordinates.map(c => [c[1], c[0]])} 
            pathOptions={{ color: '#0284c7', weight: 8, opacity: 0.6 }} 
          />
          {/* Inner solid high-visibility road polyline */}
          <Polyline 
            positions={routeData.route_geojson.geometry.coordinates.map(c => [c[1], c[0]])} 
            pathOptions={{ color: '#38bdf8', weight: 5, opacity: 1.0 }} 
          />
          {routeData.destination && (
            <Marker 
              position={[routeData.destination.latitude, routeData.destination.longitude]}
              icon={createCustomIcon('#3b82f6')}
            >
              <Popup>
                <div style={{ padding: '6px', textAlign: 'center' }}>
                  <strong style={{ fontSize: '13px', color: '#2563eb' }}>
                    🏁 Safe Relief Hub: {routeData.destination.nearest_safe_hub}
                  </strong>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                    Safe Evacuation Distance: <strong>{routeData.distance_km} km</strong><br/>
                    Est. Transit Time: <strong>{routeData.estimated_time_mins} mins</strong>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </>
      )}

      {/* Selected Location Marker Pin */}
      {selectedLocation && (
        <Marker 
          position={[selectedLocation.lat, selectedLocation.lon]} 
          icon={createCustomIcon(getCategoryColor(selectedLocation.category))}
        >
          <Popup>
            <div style={{ padding: '4px', textAlign: 'center' }}>
              <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                {selectedLocation.name || 'Queried Point'}
              </strong>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lon.toFixed(4)}°E
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Heatmap Legend Box */}
      <div className="map-legend">
        <span className="legend-title">Live Risk Legend</span>
        <div className="legend-items">
          <span className="legend-item"><span className="legend-color" style={{ background: '#ef4444' }}></span> Severe (&gt;75%)</span>
          <span className="legend-item"><span className="legend-color" style={{ background: '#f97316' }}></span> Warning (50-75%)</span>
          <span className="legend-item"><span className="legend-color" style={{ background: '#eab308' }}></span> Alert (25-50%)</span>
          <span className="legend-item"><span className="legend-color" style={{ background: '#10b981' }}></span> Watch (&lt;25%)</span>
        </div>
      </div>
    </MapContainer>
  );
};

export default RiskMap;
