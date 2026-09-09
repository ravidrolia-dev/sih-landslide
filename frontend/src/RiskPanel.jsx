import React, { useState } from 'react';

const RiskPanel = ({ data, loading, error, locationName, onOpenSmsModal }) => {
  const [alertModal, setAlertModal] = useState(null);
  const [dispatching, setDispatching] = useState(false);

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

  const downloadPdfAdvisory = () => {
    const lat = coordinates?.latitude;
    const lon = coordinates?.longitude;
    const loc = encodeURIComponent(locationName || 'Queried Location');
    window.open(`http://localhost:8000/advisory/pdf?lat=${lat}&lon=${lon}&location_name=${loc}`, '_blank');
  };

  const triggerAlertSimulation = async () => {
    setDispatching(true);
    try {
      const lat = coordinates?.latitude;
      const lon = coordinates?.longitude;
      const loc = encodeURIComponent(locationName || 'Queried Location');
      const res = await fetch(`http://localhost:8000/advisory/alert-simulation?lat=${lat}&lon=${lon}&location_name=${loc}`, { method: 'POST' });
      const alertData = await res.json();
      setAlertModal(alertData);
    } catch (err) {
      alert("Failed to execute alert simulation: " + err.message);
    } finally {
      setDispatching(false);
    }
  };

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

      {/* Emergency Action Buttons */}
      <div className="action-buttons">
        <button className="pdf-btn" onClick={downloadPdfAdvisory}>
          📄 Download NDRF/SDMA Advisory (PDF)
        </button>

        <button 
          className="sms-dispatch-btn"
          onClick={() => onOpenSmsModal && onOpenSmsModal({ locationName, lat: coordinates?.latitude, lon: coordinates?.longitude, riskScore: risk_score })}
        >
          📱 Dual-Channel SMS Dispatcher
        </button>

        <button 
          className={`alert-btn ${dispatching ? 'dispatching' : ''}`} 
          onClick={triggerAlertSimulation}
          disabled={dispatching}
        >
          {dispatching ? '📱 Dispatching Alert...' : '🚨 Trigger Emergency Alert Simulation'}
        </button>
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

      {/* Emergency Dispatch Simulation Modal */}
      {alertModal && (
        <div className="modal-backdrop" onClick={() => setAlertModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🚨 Emergency Response Alert Dispatched</h3>
              <button className="close-btn" onClick={() => setAlertModal(null)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="dispatch-badge">
                STATUS: {alertModal.status} | TX-ID: {alertModal.transaction_id}
              </div>
              
              <h4>Recipients Notified ({alertModal.recipients_notified} Emergency Units):</h4>
              <ul className="recipient-list">
                {alertModal.recipients?.map((r, i) => (
                  <li key={i}>
                    <strong>{r.unit}</strong> — <span>{r.phone}</span> | <span>{r.email}</span>
                  </li>
                ))}
              </ul>

              <h4>📲 Simulated SMS Alert Payload:</h4>
              <pre className="payload-box">{alertModal.sms_payload}</pre>

              <h4>📧 Simulated Email Notice Payload:</h4>
              <pre className="payload-box">
                Subject: {alertModal.email_payload?.subject}{"\n\n"}
                {alertModal.email_payload?.body}
              </pre>
            </div>

            <div className="modal-footer">
              <button className="modal-close-btn" onClick={() => setAlertModal(null)}>Close Simulation Window</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskPanel;
