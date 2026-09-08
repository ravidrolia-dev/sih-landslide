import React from 'react';
import { MapContainer, TileLayer, LayersControl, WMSTileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const { BaseLayer, Overlay } = LayersControl;

const RiskMap = () => {
  const center = [25.5, 91.9]; // Center on Meghalaya/NER region
  const zoom = 8;

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '600px', width: '100%', borderRadius: '8px' }}>
      <LayersControl position="topright">
        {/* Default Base Layer: OpenTopoMap */}
        <BaseLayer checked name="OpenTopoMap">
          <TileLayer
            attribution='Map data: &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxZoom={17}
          />
        </BaseLayer>

        {/* Alternate Base Layer: Satellite (Esri World Imagery) */}
        <BaseLayer name="Satellite (Esri)">
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </BaseLayer>

        {/* Alternate Base Layer: Streets (OSM) */}
        <BaseLayer name="Streets (OSM)">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </BaseLayer>

        {/* WMS Overlay: GSI Geology */}
        <Overlay name="GSI Geology" checked>
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
    </MapContainer>
  );
};

export default RiskMap;
