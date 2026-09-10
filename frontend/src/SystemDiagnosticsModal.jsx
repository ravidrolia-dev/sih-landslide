import React from 'react';
import { API_BASE_URL } from './config';

const SystemDiagnosticsModal = ({ isOpen, onClose, backendStatus, heatmapSummary, offlineQueueCount }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="diagnostics-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="diagnostics-modal-header">
          <div className="header-title-group">
            <span className="diag-icon">⚙️</span>
            <div>
              <h3>System Diagnostics & Advanced Metrics</h3>
              <p>Technical engine parameters, database connections & satellite feed diagnostics</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="diagnostics-grid">
          {/* API & Backend Service Status */}
          <div className="diag-card">
            <h4>🖥️ API Backend Engine</h4>
            <div className="diag-metric">
              <span className="lbl">Service Health:</span>
              <span className={`val-pill ${backendStatus?.online ? 'green' : 'red'}`}>
                {backendStatus?.online ? 'ONLINE (200 OK)' : 'OFFLINE'}
              </span>
            </div>
            <div className="diag-metric">
              <span className="lbl">API Message:</span>
              <span className="val-text">{backendStatus?.message || 'N/A'}</span>
            </div>
            <div className="diag-metric">
              <span className="lbl">Base URL:</span>
              <code>{API_BASE_URL}</code>
            </div>
          </div>

          {/* Earth Engine Satellite Feed */}
          <div className="diag-card">
            <h4>🛰️ GEE Satellite Feed Status</h4>
            <div className="diag-metric">
              <span className="lbl">Region Coverage:</span>
              <span className="val-text">All 8 North-Eastern States</span>
            </div>
            <div className="diag-metric">
              <span className="lbl">Grid Cells Active:</span>
              <span className="val-text">{heatmapSummary?.total_cells || 0} Cells</span>
            </div>
            <div className="diag-metric">
              <span className="lbl">Feed Cache Age:</span>
              <span className="val-text">{heatmapSummary?.cache_age_seconds !== undefined ? `${heatmapSummary.cache_age_seconds}s` : 'Live'}</span>
            </div>
            <div className="diag-metric">
              <span className="lbl">Satellite Sources:</span>
              <span className="val-text">USGS SRTM, Sentinel-2, GPM IMERG</span>
            </div>
          </div>

          {/* Client IndexedDB Offline Store */}
          <div className="diag-card">
            <h4>📡 IndexedDB Offline Queue</h4>
            <div className="diag-metric">
              <span className="lbl">Queue Engine:</span>
              <span className="val-text">IndexedDB (NE_GeoAlert_OfflineDB)</span>
            </div>
            <div className="diag-metric">
              <span className="lbl">Pending Reports:</span>
              <span className="val-pill yellow">{offlineQueueCount || 0} Items</span>
            </div>
            <div className="diag-metric">
              <span className="lbl">Auto-Sync Status:</span>
              <span className="val-text">Active (Triggers on 'online' event)</span>
            </div>
          </div>

          {/* Machine Learning & Routing Engine */}
          <div className="diag-card">
            <h4>🤖 ML & Routing Infrastructure</h4>
            <div className="diag-metric">
              <span className="lbl">Model Architecture:</span>
              <span className="val-text">XGBoost Classifier + SHAP Explainability</span>
            </div>
            <div className="diag-metric">
              <span className="lbl">Evacuation Routing:</span>
              <span className="val-text">NetworkX Dijkstra + OSRM Highway API</span>
            </div>
            <div className="diag-metric">
              <span className="lbl">SMS Gateway Mode:</span>
              <span className="val-text">Dual-Channel (Twilio / MSG91)</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-close-btn" onClick={onClose}>Close Diagnostics</button>
        </div>
      </div>
    </div>
  );
};

export default SystemDiagnosticsModal;
