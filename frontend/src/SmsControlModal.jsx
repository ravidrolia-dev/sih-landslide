import React, { useState, useEffect } from 'react';

const SmsControlModal = ({ isOpen, onClose, initialData = {} }) => {
  const [phoneNumber, setPhoneNumber] = useState('+919876543210');
  const [channel, setChannel] = useState('msg91'); // 'msg91' or 'twilio'
  const [locationName, setLocationName] = useState(initialData.locationName || 'Nongpoh Hill Cut, Meghalaya');
  const [latitude, setLatitude] = useState(initialData.lat || 25.7120);
  const [longitude, setLongitude] = useState(initialData.lon || 91.8980);
  const [riskScore, setRiskScore] = useState(initialData.riskScore || 84.5);
  
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatchLogs, setDispatchLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Update initial data when modal opens with custom location
  useEffect(() => {
    if (initialData.locationName) setLocationName(initialData.locationName);
    if (initialData.lat) setLatitude(initialData.lat);
    if (initialData.lon) setLongitude(initialData.lon);
    if (initialData.riskScore) setRiskScore(initialData.riskScore);
  }, [initialData]);

  // Fetch SMS Dispatch History Logs
  const fetchSmsLogs = () => {
    setLoadingLogs(true);
    fetch('http://localhost:8000/sms/logs')
      .then(res => res.json())
      .then(data => {
        setDispatchLogs(data.logs || []);
        setLoadingLogs(false);
      })
      .catch(err => {
        console.error("Failed to fetch SMS logs:", err);
        setLoadingLogs(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      fetchSmsLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const constructPayloadText = () => {
    const loc = locationName || `Coords (${Number(latitude).toFixed(3)}N, ${Number(longitude).toFixed(3)}E)`;
    return `🚨 EMERGENCY LANDSLIDE ALERT [NE-GeoAlert]: Severe Risk (${Number(riskScore).toFixed(1)}%) detected at ${loc}. Immediate evacuation advised. DEOC Hotline: 1070`;
  };

  const handleDispatchSMS = async (e) => {
    e.preventDefault();
    setDispatching(true);
    setDispatchResult(null);

    const payload = {
      phone_number: phoneNumber,
      location_name: locationName,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      risk_score: parseFloat(riskScore),
      channel: channel
    };

    try {
      const response = await fetch('http://localhost:8000/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`SMS Dispatch Failed (Status ${response.status})`);
      }

      const data = await response.json();
      setDispatchResult(data);
      fetchSmsLogs();
    } catch (err) {
      console.error(err);
      setDispatchResult({ status: 'ERROR', message: err.message });
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="sms-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sms-modal-header">
          <div className="brand-group">
            <span className="sms-icon">📱</span>
            <div>
              <h3>Dual-Channel SMS Emergency Dispatcher</h3>
              <p>MSG91 DLT (India National) & Twilio SMS (Global Gateway) • Auto-Triggers on Severe Risk (&gt;75%)</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Dispatch Form & Mobile Handset Screen Split */}
        <div className="sms-grid-layout">
          {/* Left: Dispatch Settings Form */}
          <form className="sms-form-card" onSubmit={handleDispatchSMS}>
            <h4 className="card-subheading">⚙️ Alert Dispatch Controls</h4>

            <div className="form-field">
              <label className="field-label">📞 Recipient Mobile Phone Number:</label>
              <input 
                type="tel"
                className="form-input"
                placeholder="+919876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label className="field-label">🔀 Gateway Provider Channel:</label>
              <div className="channel-switch-buttons">
                <button
                  type="button"
                  className={`channel-btn msg91 ${channel === 'msg91' ? 'active' : ''}`}
                  onClick={() => setChannel('msg91')}
                >
                  🇮🇳 MSG91 DLT (India Telecoms)
                </button>
                <button
                  type="button"
                  className={`channel-btn twilio ${channel === 'twilio' ? 'active' : ''}`}
                  onClick={() => setChannel('twilio')}
                >
                  🌐 Twilio SMS (Global)
                </button>
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-field">
                <label className="field-label">📍 Target Hazard Location:</label>
                <input 
                  type="text"
                  className="form-input"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label className="field-label">⚠️ Satellite Risk Score (%):</label>
                <input 
                  type="number" step="0.1"
                  className="form-input"
                  value={riskScore}
                  onChange={(e) => setRiskScore(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className={`send-sms-btn ${dispatching ? 'sending' : ''}`}
              disabled={dispatching}
            >
              {dispatching ? '⚡ Routing Carrier Handshake...' : '🚀 Dispatch Emergency SMS Alert Now'}
            </button>

            {dispatchResult && (
              <div className={`dispatch-res-box ${dispatchResult.status === 'SUCCESS' ? 'success' : 'error'}`}>
                {dispatchResult.status === 'SUCCESS' ? (
                  <>
                    <div className="res-header">✅ {dispatchResult.message}</div>
                    <div className="res-meta">
                      <span>Status: <strong>{dispatchResult.dispatch_details?.status}</strong></span> • 
                      <span> ACK ID: <code>{dispatchResult.dispatch_details?.carrier_ack_id}</code></span> • 
                      <span> Mode: <code>{dispatchResult.dispatch_details?.dispatch_mode}</code></span>
                    </div>
                  </>
                ) : (
                  <div>⚠️ Dispatch Failed: {dispatchResult.message}</div>
                )}
              </div>
            )}
          </form>

          {/* Right: Mobile Handset Screen Live Preview */}
          <div className="handset-preview-card">
            <h4 className="card-subheading">📱 Handset Text Screen Preview</h4>

            <div className="mobile-frame">
              <div className="mobile-notch"></div>
              <div className="mobile-header-bar">
                <span>9:41 AM</span>
                <span>📶 5G • 🔋 98%</span>
              </div>
              <div className="sms-chat-area">
                <div className="sender-tag-pill">
                  {channel === 'msg91' ? 'SENDER: NEALERT (MSG91 DLT)' : 'SENDER: +1 (800) 555-0199 (Twilio)'}
                </div>

                <div className="sms-bubble alert-bubble">
                  <p className="sms-text">{constructPayloadText()}</p>
                  <span className="sms-time">Now • Carrier Delivery Receipt Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carrier Dispatch History Log */}
        <div className="dispatch-log-section">
          <div className="log-header">
            <h4 className="card-subheading">📋 Live Carrier Dispatch History Log</h4>
            <button className="refresh-logs-btn" onClick={fetchSmsLogs} disabled={loadingLogs}>
              {loadingLogs ? '⚡ Fetching...' : '🔄 Refresh Logs'}
            </button>
          </div>

          <div className="log-table-wrapper">
            <table className="sms-log-table">
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Recipient Phone</th>
                  <th>Hazard Location</th>
                  <th>Risk %</th>
                  <th>Channel</th>
                  <th>Carrier Status</th>
                  <th>Message ACK ID</th>
                </tr>
              </thead>
              <tbody>
                {dispatchLogs.map((log) => (
                  <tr key={log.dispatch_id}>
                    <td className="time-cell">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="phone-cell">{log.phone_number}</td>
                    <td>{log.location_name}</td>
                    <td className="risk-cell">{log.risk_score}%</td>
                    <td>
                      <span className={`channel-badge ${log.channel.toLowerCase().includes('msg91') ? 'msg91' : 'twilio'}`}>
                        {log.channel}
                      </span>
                    </td>
                    <td>
                      <span className="status-delivered-tag">
                        ✅ {log.status}
                      </span>
                    </td>
                    <td><code className="ack-code">{log.carrier_ack_id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-close-btn" onClick={onClose}>Close Dispatcher</button>
        </div>
      </div>
    </div>
  );
};

export default SmsControlModal;
