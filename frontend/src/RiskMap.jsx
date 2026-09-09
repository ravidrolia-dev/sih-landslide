import React, { useEffect } from 'react';
import { MapContainer, TileLayer, LayersControl, WMSTileLayer, Marker, Popup, GeoJSON, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component to auto-fly map to selected or user location
const MapViewUpdater = ({ targetLoc }) => {
  const map = useMap();
  useEffect(() => {
    if (targetLoc && targetLoc.lat && targetLoc.lon) {
      map.flyTo([targetLoc.lat, targetLoc.lon], 11, { duration: 1.5 });
    }
  }, [targetLoc?.lat, targetLoc?.lon]);
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

const RiskMap = ({ selectedLocation, onLocationSelect, heatmapData }) => {
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
      <MapViewUpdater targetLoc={selectedLocation} />
      
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
