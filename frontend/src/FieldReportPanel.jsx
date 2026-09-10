import React, { useState, useEffect } from 'react';
import { saveReportOffline, getPendingOfflineReports, syncOfflineQueueToServer } from './offlineStore';
import { API_BASE_URL } from './config';

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
  const [notification, setNotification] = useState(null);
  const [error, setError] = useState(null);

  // Form State
  const [hazardType, setHazardType] = useState('Landslide');
  const [reporterName, setReporterName] = useState('Insp. R. Sangma (SDMA)');
  const [severity, setSeverity] = useState('CRITICAL');
  const [latitude, setLatitude] = useState('25.5788');
  const [longitude, setLongitude] = useState('91.8933');
  const [locationName, setLocationName] = useState('Shillong Bypass, Meghalaya');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(PRESET_SAMPLE_PHOTOS[0].url);
  const [acquiringGps, setAcquiringGps] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerAutoSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshReportsData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/list`);
      if (res.ok) {
        const data = await res.json();
        setServerReports(data.reports || []);
      }
    } catch (err) {
      console.warn("Unable to fetch server reports:", err.message);
    }

    try {
      const offlineItems = await getPendingOfflineReports();
      setPendingQueue(offlineItems);
    } catch (err) {
      console.error("Store read error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshReportsData();
  }, []);

  const triggerAutoSync = async () => {
    setSyncing(true);
    try {
      const res = await syncOfflineQueueToServer();
      if (res && res.synced_count > 0) {
        setNotification(`✓ Automatically synced ${res.synced_count} offline report(s) to central database`);
        if (onReportSubmitted) onReportSubmitted();
      }
    } catch (err) {
      console.error("Auto sync failed:", err);
    } finally {
      setSyncing(false);
      refreshReportsData();
    }
  };

  const handleAcquireGPS = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your device.");
      return;
    }
    setAcquiringGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lon = pos.coords.longitude.toFixed(4);
        setLatitude(lat);
        setLongitude(lon);
        setLocationName(`GPS Lock (${lat}°N, ${lon}°E)`);
        setAcquiringGps(false);
        setNotification(`✓ GPS position acquired: ${lat}°N, ${lon}°E`);
      },
      (err) => {
        setAcquiringGps(false);
        setError("GPS lock failed: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setError(null);
    setNotification(null);

    const reportPayload = {
      title: `${hazardType} at ${locationName}`,
      reporter_name: reporterName,
      severity: severity,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      location_name: locationName,
      description: description || `${hazardType} reported by field team.`,
      image_url: imageUrl,
      timestamp: new Date().toISOString(),
      source: isOnline ? "Field App" : "Offline Queue"
    };

    if (!isOnline) {
      try {
        await saveReportOffline(reportPayload);
        setNotification("✓ Report saved offline. Will sync automatically when connected.");
        setDescription('');
        refreshReportsData();
      } catch (err) {
        setError("Could not save report offline: " + err.message);
      }
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/reports/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportPayload)
      });

      if (!res.ok) throw new Error(`Server returned status ${res.status}`);

      setNotification("✓ Hazard report submitted successfully and published to live GIS map!");
      setDescription('');
      refreshReportsData();
      if (onReportSubmitted) onReportSubmitted();
    } catch (err) {
      try {
        await saveReportOffline(reportPayload);
        setNotification("✓ Offline — Report saved locally. Will sync automatically when connected.");
        refreshReportsData();
      } catch (idbErr) {
        setError("Failed to save report: " + idbErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL': return { label: '🔴 Critical', class: 'badge-critical' };
      case 'HIGH': return { label: '🟠 High', class: 'badge-high' };
      case 'MEDIUM': return { label: '🟡 Moderate', class: 'badge-medium' };
      default: return { label: '🟢 Low', class: 'badge-low' };
    }
  };

  return (
    <div className="field-reporting-view">
      {/* Top Banner */}
      <div className="field-hero-banner">
        <div className="banner-left">
          <span className="hero-icon">📷</span>
          <div>
            <h2>GEO-TAGGED FIELD REPORTING & GROUND INTEL</h2>
            <p>Ground-Truth Crowd-Sourced & Field Officer Landslide Intel • Works 100% Offline in Remote Dead Zones</p>
          </div>
        </div>

        <div className="status-pills-row">
          <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
            <span className="dot"></span>
            <span>{isOnline ? '🌐 ONLINE DIRECT SYNC' : '📡 OFFLINE QUEUE ACTIVE'}</span>
          </div>

          {pendingQueue.length > 0 && (
            <span className="queue-pill">⏳ Pending Sync: {pendingQueue.length}</span>
          )}

          <button 
            className="btn-sync-now"
            onClick={triggerAutoSync}
            disabled={syncing || !isOnline || pendingQueue.length === 0}
          >
            {syncing ? '⚡ Syncing...' : '🔄 Sync Queue Now'}
          </button>
        </div>
      </div>

      {!isOnline && (
        <div className="offline-banner">
          📡 Offline — Report will sync automatically when connected.
        </div>
      )}

      {notification && (
        <div className="notification-banner success">
          {notification}
        </div>
      )}

      {error && (
        <div className="notification-banner error">
          ⚠️ {error}
        </div>
      )}

      {/* Main Form & Feed Split Grid */}
      <div className="field-grid-layout">
        {/* Form Column */}
        <div className="field-form-card">
          <h3 className="card-title">📝 Submit Geo-Tagged Field Hazard Report</h3>

          <form onSubmit={handleSubmitReport} className="clean-field-form">
            {/* Photo Upload Zone */}
            <div className="field-group">
              <label>📸 Photo / Video Upload</label>
              <div className="photo-upload-container">
                {imageUrl ? (
                  <div className="photo-preview-box">
                    <img src={imageUrl} alt="Hazard Preview" className="preview-img" />
                    <label htmlFor="field-photo-input" className="overlay-change-btn">
                      📷 Change Photo
                    </label>
                  </div>
                ) : (
                  <label htmlFor="field-photo-input" className="placeholder-upload-box">
                    <span className="icon">📷</span>
                    <span className="text">Tap to Take or Upload Photo</span>
                  </label>
                )}
                <input 
                  type="file" 
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  id="field-photo-input"
                  style={{ display: 'none' }}
                />

                <div className="sample-photo-select">
                  <span>Or select sample field photo:</span>
                  <select 
                    className="clean-select"
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

            {/* Reporter & Hazard Type Row */}
            <div className="form-row-2">
              <div className="field-group">
                <label>Hazard Type</label>
                <select 
                  className="clean-select"
                  value={hazardType}
                  onChange={(e) => setHazardType(e.target.value)}
                >
                  <option value="Landslide">Landslide</option>
                  <option value="Rockfall">Rockfall / Boulder Collapse</option>
                  <option value="Mudslide">Mudslide / Debris Flow</option>
                  <option value="Road Blockage">Road Blockage / Cave-In</option>
                  <option value="Flash Flood">Flash Flood Passage</option>
                </select>
              </div>

              <div className="field-group">
                <label>Reporter / Officer Name</label>
                <input 
                  type="text"
                  className="clean-input"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Severity Tag Buttons */}
            <div className="field-group">
              <label>Severity Level</label>
              <div className="severity-selector-grid">
                {[
                  { id: 'CRITICAL', label: '🔴 Critical' },
                  { id: 'HIGH', label: '🟠 High' },
                  { id: 'MEDIUM', label: '🟡 Moderate' },
                  { id: 'LOW', label: '🟢 Low' }
                ].map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`btn-sev-chip ${s.id.toLowerCase()} ${severity === s.id ? 'active' : ''}`}
                    onClick={() => setSeverity(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location & GPS */}
            <div className="field-group">
              <div className="group-header-row">
                <label>Target Hazard Location</label>
                <button 
                  type="button" 
                  className="btn-gps-fetch"
                  onClick={handleAcquireGPS}
                  disabled={acquiringGps}
                >
                  {acquiringGps ? '🛰️ Locking...' : '📍 Acquire GPS'}
                </button>
              </div>
              <div className="location-coords-box">
                <span className="coords-text">📍 {locationName} ({latitude}°N, {longitude}°E)</span>
              </div>
            </div>

            {/* Description */}
            <div className="field-group">
              <label>Ground Observations & Impact Details</label>
              <textarea 
                className="clean-textarea"
                rows="3"
                placeholder="Describe slope instability, boulder size, road blockages, or affected vehicles..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="btn-submit-field-report"
              disabled={loading}
            >
              {loading ? 'Submitting Report...' : !isOnline ? 'Save Report (Offline Mode)' : '🚀 SUBMIT HAZARD REPORT'}
            </button>
          </form>
        </div>

        {/* Feed Column */}
        <div className="field-feed-card">
          <div className="feed-header-row">
            <h3>📡 Live Ground-Truth Incident Feed</h3>
            <button className="btn-refresh-feed" onClick={refreshReportsData}>
              🔄 Refresh
            </button>
          </div>

          <div className="feed-list-container">
            {pendingQueue.map((item) => (
              <div key={item.offline_id} className="feed-card-box offline-pending">
                <div className="feed-thumb-box">
                  <img src={item.image_url} alt="Report" />
                  <span className="chip-offline">Offline</span>
                </div>
                <div className="feed-info-box">
                  <div className="feed-top-row">
                    <h4>{item.title}</h4>
                    <span className={`badge-pill ${getSeverityBadge(item.severity).class}`}>
                      {getSeverityBadge(item.severity).label}
                    </span>
                  </div>
                  <p className="feed-loc">📍 {item.location_name}</p>
                  <p className="feed-desc">{item.description}</p>
                  <span className="feed-subtext">Saved in IndexedDB • Will auto-upload on reconnection</span>
                </div>
              </div>
            ))}

            {serverReports.map((item) => (
              <div key={item.id} className="feed-card-box synced-live">
                <div className="feed-thumb-box">
                  <img src={item.image_url} alt="Report" />
                  <span className="chip-live">Live Map</span>
                </div>
                <div className="feed-info-box">
                  <div className="feed-top-row">
                    <h4>{item.title}</h4>
                    <span className={`badge-pill ${getSeverityBadge(item.severity).class}`}>
                      {getSeverityBadge(item.severity).label}
                    </span>
                  </div>
                  <p className="feed-loc">📍 {item.location_name}</p>
                  <p className="feed-desc">{item.description}</p>
                  <span className="feed-subtext">🕒 {new Date(item.timestamp).toLocaleString()} • {item.reporter_name}</span>
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
