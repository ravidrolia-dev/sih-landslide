import React from 'react';

const RiskPanel = ({ data, loading, error, locationName }) => {
  if (loading) {
    return (
      <div className="panel-card loading-panel">
        <div className="spinner"></div>
        <h3>Fetching GEE Satellite Intelligence...</h3>
        <p>Querying USGS SRTM DEM, Sentinel-2 NDVI, & NASA GPM Rainfall</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-card error-panel">
        <h3>Error Fetching Satellite Data</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel-card empty-panel">
        <div className="empty-icon">📍</div>
        <h3>Select a Location on the GIS Map</h3>
        <p>Click anywhere in the North-East Region or choose a preset city to extract real-time GEE satellite metrics and predict landslide susceptibility.</p>
      </div>
    );
  }

  const { coordinates, risk_score, category, satellite_features, top_factors, data_sources } = data;

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'Severe': return '#ef4444';
      case 'Warning': return '#f97316';
      case 'Alert': return '#eab308';
      default: return '#10b981';
    }
  };

  const badgeColor = getCategoryColor(category);

  return (
    <div className="panel-card active-panel">
      {/* Location Header */}
      <div className="panel-header">
        <div>
          <h2>{locationName || 'Queried Location'}</h2>
          <span className="coords-tag">
            {coordinates?.latitude?.toFixed(4)}°N, {coordinates?.longitude?.toFixed(4)}°E
          </span>
        </div>
        <div className="risk-badge" style={{ backgroundColor: `${badgeColor}20`, color: badgeColor, borderColor: `${badgeColor}50` }}>
          {category} ({risk_score}%)
        </div>
      </div>

      {/* Risk Score Gauge Meter */}
      <div className="gauge-container">
        <div className="gauge-bar-bg">
          <div 
            className="gauge-bar-fill" 
            style={{ width: `${Math.max(risk_score, 4)}%`, backgroundColor: badgeColor }} 
          />
        </div>
        <div className="gauge-labels">
          <span>0% Low</span>
          <span>50% Moderate</span>
          <span>100% Extreme</span>
        </div>
      </div>

      {/* Satellite Metrics Grid */}
      <div className="section-title">📡 Live GEE Satellite Metrics</div>
      <div className="metrics-grid">
        <div className="metric-box">
          <span className="metric-icon">🏔️</span>
          <div className="metric-details">
            <span className="metric-label">Elevation</span>
            <span className="metric-val">{satellite_features?.elevation?.toFixed(0)} m</span>
          </div>
        </div>

        <div className="metric-box">
          <span className="metric-icon">📐</span>
          <div className="metric-details">
            <span className="metric-label">Slope</span>
            <span className="metric-val">{satellite_features?.slope?.toFixed(1)}°</span>
          </div>
        </div>

        <div className="metric-box">
          <span className="metric-icon">🌧️</span>
          <div className="metric-details">
            <span className="metric-label">Rainfall (24h)</span>
            <span className="metric-val">{satellite_features?.rainfall_24h?.toFixed(1)} mm</span>
          </div>
        </div>

        <div className="metric-box">
          <span className="metric-icon">⛈️</span>
          <div className="metric-details">
            <span className="metric-label">Rainfall (72h)</span>
            <span className="metric-val">{satellite_features?.rainfall_72h?.toFixed(1)} mm</span>
          </div>
        </div>

        <div className="metric-box">
          <span className="metric-icon">🌿</span>
          <div className="metric-details">
            <span className="metric-label">Sentinel-2 NDVI</span>
            <span className="metric-val">{satellite_features?.ndvi?.toFixed(3)}</span>
          </div>
        </div>

        <div className="metric-box">
          <span className="metric-icon">💧</span>
          <div className="metric-details">
            <span className="metric-label">Soil Moisture</span>
            <span className="metric-val">{(satellite_features?.soil_moisture * 100)?.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* SHAP Explainability Section */}
      <div className="section-title">📊 SHAP Feature Risk Contributors</div>
      <div className="shap-list">
        {top_factors?.map((item, idx) => {
          const isHigh = item.impact > 0;
          return (
            <div key={idx} className="shap-item">
              <div className="shap-meta">
                <span className="shap-name">{item.feature.replace('_', ' ').toUpperCase()}</span>
                <span className="shap-impact" style={{ color: isHigh ? '#ef4444' : '#10b981' }}>
                  {isHigh ? '+' : ''}{item.impact.toFixed(3)}
                </span>
              </div>
              <div className="shap-bar-bg">
                <div 
                  className="shap-bar-fill"
                  style={{
                    width: `${Math.min(Math.abs(item.impact) * 25, 100)}%`,
                    backgroundColor: isHigh ? '#ef4444' : '#10b981'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Provenance Footer */}
      <div className="data-sources">
        <span className="source-tag">DEM: {data_sources?.elevation_slope}</span>
        <span className="source-tag">NDVI: {data_sources?.vegetation_ndvi}</span>
        <span className="source-tag">Rain: {data_sources?.precipitation}</span>
      </div>
    </div>
  );
};

export default RiskPanel;
