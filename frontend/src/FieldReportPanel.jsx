import React, { useState, useEffect } from 'react';
import { saveReportOffline, getPendingOfflineReports, syncOfflineQueueToServer } from './offlineStore';

const PRESET_SAMPLE_PHOTOS = [
  { name: "📸 Mudslide (NH-6 Hill Cut)", url: "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?w=600&auto=format&fit=crop&q=60" },
  { name: "📸 Railway Soil Slump (Haflong)", url: "https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?w=600&auto=format&fit=crop&q=60" },
  { name: "📸 Rockfall Debris (Lachen Route)", url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=60" }
];

const FieldReportPanel = ({ onReportSubmitted }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [serverReports, setServerReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [reporterName, setReporterName] = useState('Insp. R. Sangma (SDMA MeG)');
  const [severity, setSeverity] = useState('HIGH');
  const [latitude, setLatitude] = useState('25.5788');
  const [longitude, setLongitude] = useState('91.8933');
  const [locationName, setLocationName] = useState('Shillong Bypass, Meghalaya');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(PRESET_SAMPLE_PHOTOS[0].url);
  const [acquiringGps, setAcquiringGps] = useState(false);

  // Monitor network online/offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setMessage("🌐 Connection restored! Syncing IndexedDB queue...");
      triggerAutoSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setMessage("📡 Offline mode active. All new reports will be queued in IndexedDB.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch central server reports & check IndexedDB pending queue
  const refreshReportsData = async () => {
    setLoading(true);
    try {
      // 1. Fetch server reports
      const res = await fetch('http://localhost:8000/reports/list');
      if (res.ok) {
        const data = await res.json();
        setServerReports(data.reports || []);
      }
    } catch (err) {
      console.warn("Unable to fetch server reports:", err.message);
    }

    // 2. Fetch local IndexedDB pending queue
    try {
      const offlineItems = await getPendingOfflineReports();
      setPendingQueue(offlineItems);
    } catch (err) {
      console.error("IndexedDB read error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshReportsData();
  }, []);

  // Trigger IndexedDB sync to server
  const triggerAutoSync = async () => {
    setSyncing(true);
    try {
      const res = await syncOfflineQueueToServer();
      if (res && res.synced_count > 0) {
        setMessage(`⚡ Successfully auto-synced ${res.synced_count} offline report(s) to central database!`);
        if (onReportSubmitted) onReportSubmitted();
      }
    } catch (err) {
      console.error("Auto sync failed:", err);
    } finally {
      setSyncing(false);
      refreshReportsData();
    }
  };

  // Acquire current device GPS position
  const handleAcquireGPS = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setAcquiringGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lon = pos.coords.longitude.toFixed(4);
        setLatitude(lat);
        setLongitude(lon);
        setLocationName(`Geo-Tagged GPS (${lat}°N, ${lon}°E)`);
        setAcquiringGps(false);
        setMessage(`🎯 GPS acquired: ${lat}°N, ${lon}°E (±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setAcquiringGps(false);
        setError("GPS lock failed: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle local photo file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Field Report (Online HTTP vs Offline IndexedDB Queue)
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const reportPayload = {
      title: title || `Field Report @ ${latitude}°, ${longitude}°`,
      reporter_name: reporterName,
      severity: severity,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      location_name: locationName,
      description: description || "No detailed description provided.",
      image_url: imageUrl,
      timestamp: new Date().toISOString(),
      source: isOnline ? "Online Mobile Officer App" : "Offline IndexedDB Queue"
    };

    if (!isOnline) {
      // OFFLINE MODE: Save to IndexedDB
      try {
        const savedItem = await saveReportOffline(reportPayload);
        setMessage(`📡 Saved to IndexedDB offline queue! Item [${savedItem.offline_id}] will auto-sync when network connection returns.`);
        setTitle('');
        setDescription('');
        refreshReportsData();
      } catch (err) {
        setError("Failed to save report to IndexedDB: " + err.message);
      }
      return;
    }

    // ONLINE MODE: Direct HTTP post to FastAPI backend
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8000/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportPayload)
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      setMessage("✅ Field report submitted and published to live GIS map!");
      setTitle('');
      setDescription('');
      refreshReportsData();
      if (onReportSubmitted) onReportSubmitted();
    } catch (err) {
      console.warn("Network error during submission, falling back to IndexedDB:", err.message);
      // Network call failed: Save fallback to IndexedDB!
      try {
        const fallbackItem = await saveReportOffline(reportPayload);
        setMessage(`⚡ Network request failed (${err.message}). Safely stored in IndexedDB offline queue for auto-sync!`);
        refreshReportsData();
      } catch (idbErr) {
        setError("Network & IndexedDB fallback failed: " + idbErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="field-report-container">
      {/* Header & Status Indicator */}
      <div className="report-header">
        <div>
          <h2 className="report-title">📸 Geo-Tagged Photo Field Reporting & Offline Sync</h2>
          <p className="report-subtitle">
            Ground-Truth Crowd-Sourced & Field Officer Landslide Intel • Works 100% Offline in Remote Dead Zones
          </p>
        </div>

        <div className="status-badges-group">
          <div className={`network-pill ${isOnline ? 'online' : 'offline'}`}>
            <span className="dot"></span>
            <span>{isOnline ? '🌐 ONLINE MODE' : '📡 OFFLINE MODE (INDEXEDDB QUEUE ACTIVE)'}</span>
          </div>

          <div className="pending-badge">
            <span>⏳ Pending Sync: <strong>{pendingQueue.length}</strong></span>
          </div>

          <button 
            className="sync-btn"
            onClick={triggerAutoSync}
            disabled={syncing || !isOnline || pendingQueue.length === 0}
          >
            {syncing ? '⚡ Syncing...' : '🔄 Sync Queue Now'}
          </button>
        </div>
      </div>

      {message && (
        <div className="report-banner success-banner">
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="report-banner error-banner">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Main Form & Feed Split Grid */}
      <div className="report-grid">
        {/* Left: Geo-tagged Photo Form */}
        <div className="form-card">
          <h3 className="card-heading">📝 Create Geo-Tagged Field Report</h3>

          <form onSubmit={handleSubmitReport} className="report-form">
            {/* Photo / Video Attachment */}
            <div className="form-field">
              <label className="field-label">📸 Photo / Video Upload:</label>
              
              <div className="image-preview-box">
                {imageUrl ? (
                  <img src={imageUrl} alt="Field preview" className="preview-img" />
                ) : (
                  <div className="placeholder-preview">No Photo Attached</div>
                )}
              </div>

              <div className="photo-actions">
                <input 
                  type="file" 
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  id="photo-file-input"
                  style={{ display: 'none' }}
                />
                <label htmlFor="photo-file-input" className="file-upload-btn">
                  📁 Choose File from Device
                </label>

                <div className="preset-photos-dropdown">
                  <select 
                    className="preset-select"
                    onChange={(e) => setImageUrl(e.target.value)}
                    value={imageUrl}
                  >
                    {PRESET_SAMPLE_PHOTOS.map((p, idx) => (
                      <option key={idx} value={p.url}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Title & Reporter */}
            <div className="form-row-2">
              <div className="form-field">
                <label className="field-label">📌 Incident Title / Landmark:</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="e.g. NH-6 Nongpoh Mudslide Collapse"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label className="field-label">👤 Officer / Submitter Name:</label>
                <input 
                  type="text"
                  className="form-input"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Severity Tag & GPS */}
            <div className="form-row-2">
              <div className="form-field">
                <label className="field-label">⚠️ Severity Tag:</label>
                <div className="severity-selector">
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                    <button
                      type="button"
                      key={sev}
                      className={`sev-tag-btn ${sev.toLowerCase()} ${severity === sev ? 'active' : ''}`}
                      onClick={() => setSeverity(sev)}
                    >
                      {sev === 'CRITICAL' ? '🚨 CRITICAL' : sev === 'HIGH' ? '⚠️ HIGH' : sev === 'MEDIUM' ? '📢 MEDIUM' : '👁️ LOW'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <div className="gps-label-group">
                  <label className="field-label">📍 Geo-Tagged Coordinates:</label>
                  <button 
                    type="button"
                    className="gps-fetch-btn"
                    onClick={handleAcquireGPS}
                    disabled={acquiringGps}
                  >
                    {acquiringGps ? '🛰️ Locking...' : '🎯 Acquire GPS'}
                  </button>
                </div>
                <div className="coords-inputs">
                  <input 
                    type="number" step="any"
                    className="form-input coord-input"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="Latitude"
                    required
                  />
                  <input 
                    type="number" step="any"
                    className="form-input coord-input"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="Longitude"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Detailed Description */}
            <div className="form-field">
              <label className="field-label">📝 Ground Observations & Impact Details:</label>
              <textarea 
                className="form-textarea"
                rows="3"
                placeholder="Describe slope instability, boulder size, road blockages, casualties, or nearby village exposure..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className={`submit-report-btn ${!isOnline ? 'offline-btn' : ''}`}
              disabled={loading}
            >
              {loading 
                ? '⚡ Submitting...' 
                : !isOnline 
                  ? '📡 Save Report Offline in IndexedDB Queue' 
                  : '🚀 Submit Geo-Tagged Report to Central GIS Map'}
            </button>
          </form>
        </div>

        {/* Right: Live Ground-Truth Feed Queue */}
        <div className="feed-card">
          <div className="feed-header">
            <h3 className="card-heading">📡 Live Ground-Truth Incident Feed</h3>
            <button className="refresh-feed-btn" onClick={refreshReportsData}>
              🔄 Refresh
            </button>
          </div>

          <div className="feed-list">
            {/* Pending Offline IndexedDB Queue First */}
            {pendingQueue.map((item) => (
              <div key={item.offline_id} className="feed-item pending-item">
                <div className="feed-thumb-box">
                  <img src={item.image_url} alt="Offline report" className="feed-thumb" />
                  <span className="queue-tag-badge">⏳ Pending Sync</span>
                </div>
                <div className="feed-details">
                  <div className="feed-item-header">
                    <span className="feed-item-title">{item.title}</span>
                    <span className={`sev-badge ${item.severity.toLowerCase()}`}>{item.severity}</span>
                  </div>
                  <div className="feed-item-meta">
                    <span>📍 {item.latitude.toFixed(4)}°N, {item.longitude.toFixed(4)}°E</span>
                    <span>👤 {item.reporter_name}</span>
                  </div>
                  <p className="feed-item-desc">{item.description}</p>
                  <span className="offline-notice-text">
                    ⚡ Saved in IndexedDB • Will auto-upload on network reconnection
                  </span>
                </div>
              </div>
            ))}

            {/* Synced Central Server Reports */}
            {serverReports.map((item) => (
              <div key={item.id} className="feed-item synced-item">
                <div className="feed-thumb-box">
                  <img src={item.image_url} alt="Server report" className="feed-thumb" />
                  <span className="synced-tag-badge">✅ Live GIS Map</span>
                </div>
                <div className="feed-details">
                  <div className="feed-item-header">
                    <span className="feed-item-title">{item.title}</span>
                    <span className={`sev-badge ${item.severity.toLowerCase()}`}>{item.severity}</span>
                  </div>
                  <div className="feed-item-meta">
                    <span>📍 {item.latitude.toFixed(4)}°N, {item.longitude.toFixed(4)}°E</span>
                    <span>👤 {item.reporter_name}</span>
                  </div>
                  <p className="feed-item-desc">{item.description}</p>
                  <span className="timestamp-text">
                    🕒 {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldReportPanel;
