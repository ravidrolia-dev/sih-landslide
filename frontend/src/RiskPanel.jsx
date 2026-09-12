import React, { useState } from 'react';
import { API_BASE_URL } from './config';

const RiskPanel = ({ data, loading, error, locationName, onFindSafeRoute, onOpenSmsModal }) => {
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

  if (loading) {
    return (
      <div className="panel-card loading-panel">
        <div className="gis-spinner"></div>
        <h4>Extracting Satellite Intel...</h4>
        <p className="subtext">Querying Real-Time GEE Sentinel & XGBoost Risk Prediction</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-card error-panel">
        <h4>Unable to Assess Location</h4>
        <p className="subtext">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel-card empty-panel">
        <div className="empty-icon">📍</div>
        <h4>Select a Location on the GIS Map</h4>
        <p className="subtext">Click anywhere on the North-East region map or search a district to view real-time landslide risk intelligence and compute safe evacuation routes.</p>
      </div>
    );
  }

  const { coordinates, risk_score, category, satellite_features, top_factors } = data;

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'Severe': return { label: 'CRITICAL', class: 'badge-critical', icon: '🔴', color: '#ef4444' };
      case 'Warning': return { label: 'HIGH RISK', class: 'badge-high', icon: '🟠', color: '#f97316' };
      case 'Alert': return { label: 'MODERATE', class: 'badge-medium', icon: '🟡', color: '#eab308' };
      default: return { label: 'LOW RISK', class: 'badge-low', icon: '🟢', color: '#10b981' };
    }
  };

  const badge = getCategoryBadge(category);

  const downloadPdfAdvisory = () => {
    const lat = coordinates?.latitude;
    const lon = coordinates?.longitude;
    const loc = encodeURIComponent(locationName || 'Queried Location');
    window.open(`${API_BASE_URL}/advisory/pdf?lat=${lat}&lon=${lon}&location_name=${loc}`, '_blank');
  };

  return (
    <div className="risk-intelligence-panel">
      {/* Location Header */}
      <div className="intel-header">
        <div className="location-info">
          <h2 className="loc-name">{locationName || 'Queried Location'}</h2>
          <span className="loc-coords">
            📍 {coordinates?.latitude?.toFixed(4)}°N, {coordinates?.longitude?.toFixed(4)}°E
          </span>
        </div>
        <div className={`badge-pill ${badge.class}`}>
          {badge.icon} {badge.label}
        </div>
      </div>

      {/* Main ML Risk Score Display */}
      <div className="risk-score-card">
        <div className="score-top">
          <div className="score-val-box">
            <span className="score-number" style={{ color: badge.color }}>
              {risk_score}%
            </span>
            <span className="score-label">ML Landslide Vulnerability</span>
          </div>
        </div>

        <div className="score-bar-track">
          <div 
            className="score-bar-fill"
            style={{ width: `${Math.max(risk_score, 5)}%`, backgroundColor: badge.color }}
          />
        </div>

        <div className="score-bar-legend">
          <span className="leg-item green">🟢 Low (&lt;25%)</span>
          <span className="leg-item yellow">🟡 Mod (25-50%)</span>
          <span className="leg-item orange">🟠 High (50-75%)</span>
          <span className="leg-item red">🔴 Crit (&gt;75%)</span>
        </div>
      </div>

      {/* Decision Environmental Metrics Grid */}
      <div className="env-metrics-grid">
        <div className="env-metric-item">
          <span className="env-icon">🌧️</span>
          <div className="env-data">
            <span className="env-lbl">72h Rainfall</span>
            <span className="env-val">{satellite_features?.rainfall_72h?.toFixed(1) || '0.0'} mm</span>
          </div>
        </div>

        <div className="env-metric-item">
          <span className="env-icon">📐</span>
          <div className="env-data">
            <span className="env-lbl">Slope Angle</span>
            <span className="env-val">{satellite_features?.slope?.toFixed(1) || '0.0'}°</span>
          </div>
        </div>

        <div className="env-metric-item">
          <span className="env-icon">⛰️</span>
          <div className="env-data">
            <span className="env-lbl">Elevation</span>
            <span className="env-val">{satellite_features?.elevation?.toFixed(0) || '0'} m</span>
          </div>
        </div>

        <div className="env-metric-item">
          <span className="env-icon">🍃</span>
          <div className="env-data">
            <span className="env-lbl">NDVI Index</span>
            <span className="env-val">{satellite_features?.ndvi?.toFixed(3) || '0.450'}</span>
          </div>
        </div>
      </div>

      {/* Status Hazard Notice */}
      <div className={`hazard-status-banner ${category?.toLowerCase() || 'low'}`}>
        {risk_score > 75 ? (
          <span>🔴 <strong>CRITICAL HAZARD:</strong> High landslide risk detected. Safe evacuation route recommended.</span>
        ) : risk_score > 50 ? (
          <span>🟠 <strong>HIGH HAZARD:</strong> Debris flow risk elevated in hill cuts & slopes.</span>
        ) : (
          <span>🟢 <strong>NORMAL CONDITIONS:</strong> No active critical landslide warnings in immediate area.</span>
        )}
      </div>

      {/* Primary Action Buttons */}
      <div className="intel-actions-group">
        <button 
          className="btn-intel-action primary-route"
          onClick={() => onFindSafeRoute && onFindSafeRoute(coordinates?.latitude, coordinates?.longitude, locationName)}
        >
          🗺️ Find Safe Evacuation Route
        </button>

        <div className="action-row-split">
          <button 
            className="btn-intel-action alert-btn"
            onClick={() => onOpenSmsModal && onOpenSmsModal({ locationName, lat: coordinates?.latitude, lon: coordinates?.longitude, riskScore: risk_score })}
          >
            🚨 Send Alert
          </button>

          <button className="btn-intel-action pdf-btn" onClick={downloadPdfAdvisory}>
            📄 Download PDF
          </button>
        </div>
      </div>

      {/* SHAP Feature Risk Contributors (Always Visible) */}
      <div className="shap-drivers-section">
        <button 
          className="btn-shap-toggle"
          onClick={() => setShowDetailedAnalysis(!showDetailedAnalysis)}
        >
          <span>📊 Risk Factor Analysis (SHAP Drivers)</span>
          <span>{showDetailedAnalysis ? '▲' : '▼'}</span>
        </button>

        {showDetailedAnalysis && (
          <div className="shap-drivers-list">
            {top_factors && top_factors.length > 0 ? (
              top_factors.map((item, idx) => {
                const isPositive = item.impact > 0;
                return (
                  <div key={idx} className="shap-driver-item">
                    <div className="driver-meta">
                      <span className="driver-name">{item.feature.replace(/_/g, ' ').toUpperCase()}</span>
                      <span className="driver-impact" style={{ color: isPositive ? '#ef4444' : '#10b981' }}>
                        {isPositive ? '+' : ''}{item.impact.toFixed(3)}
                      </span>
                    </div>
                    <div className="driver-bar-track">
                      <div 
                        className="driver-bar-fill"
                        style={{
                          width: `${Math.min(Math.abs(item.impact) * 30, 100)}%`,
                          backgroundColor: isPositive ? '#ef4444' : '#10b981'
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-shap-data">Standard baseline risk parameters applied.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskPanel;
