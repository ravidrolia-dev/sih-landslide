import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config';

const SmsControlModal = ({ isOpen, onClose, initialData = {} }) => {
  const [phoneNumber, setPhoneNumber] = useState('+919352526219');
  const [channel, setChannel] = useState('twilio');
  const [locationName, setLocationName] = useState(initialData.locationName || 'Shillong');
  const [latitude, setLatitude] = useState(initialData.lat || 25.5788);
  const [longitude, setLongitude] = useState(initialData.lon || 91.8933);
  const [riskScore, setRiskScore] = useState(initialData.riskScore || 84.5);
  
  // Custom Live API Credentials (collapsible)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [twilioFromPhone, setTwilioFromPhone] = useState('');
  const [msg91Key, setMsg91Key] = useState('');

  const [customMessage, setCustomMessage] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

  useEffect(() => {
    if (initialData.locationName) setLocationName(initialData.locationName);
    if (initialData.lat) setLatitude(initialData.lat);
    if (initialData.lon) setLongitude(initialData.lon);
    if (initialData.riskScore) setRiskScore(initialData.riskScore);
  }, [initialData]);

  useEffect(() => {
    const loc = locationName || `Coords (${Number(latitude).toFixed(3)}°N, ${Number(longitude).toFixed(3)}°E)`;
    setCustomMessage(`🚨 EMERGENCY LANDSLIDE WARNING [NE-GeoAlert]: High landslide vulnerability (${Number(riskScore).toFixed(1)}%) identified near ${loc}. Evacuate to nearest safe shelter immediately. Help Line: 1070.`);
  }, [locationName, latitude, longitude, riskScore]);

  if (!isOpen) return null;

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
      channel: channel,
      credentials: {
        twilio_sid: twilioSid,
        twilio_token: twilioToken,
        twilio_phone: twilioFromPhone,
        msg91_key: msg91Key
      }
    };

    try {
      const response = await fetch(`${API_BASE_URL}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Dispatch failed with status ${response.status}`);

      const data = await response.json();
      setDispatchResult(data);
    } catch (err) {
      console.error(err);
      setDispatchResult({ status: 'ERROR', message: err.message });
    } finally {
      setDispatching(false);
    }
  };

  const getRiskBadge = (score) => {
    if (score >= 70) return { label: 'CRITICAL', class: 'badge-critical', icon: '🔴' };
    if (score >= 40) return { label: 'HIGH RISK', class: 'badge-high', icon: '🟠' };
    if (score >= 20) return { label: 'MODERATE', class: 'badge-medium', icon: '🟡' };
    return { label: 'LOW RISK', class: 'badge-low', icon: '🟢' };
  };

  const badge = getRiskBadge(riskScore);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="sms-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="sms-card-header">
          <div className="title-row">
            <span className="sms-card-icon">🚨</span>
            <div>
              <h3>EMERGENCY SMS ALERT DISPATCHER</h3>
              <p>Broadcast high-priority disaster warning SMS to affected area</p>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>

        {/* Primary Form */}
        <form onSubmit={handleDispatchSMS} className="clean-sms-form">
          <div className="alert-meta-grid">
            <div className="meta-box">
              <span className="meta-lbl">Target Location</span>
              <span className="meta-val">📍 {locationName}</span>
            </div>

            <div className="meta-box">
              <span className="meta-lbl">Risk Severity</span>
              <span className={`badge-pill ${badge.class}`}>
                {badge.icon} {badge.label} ({Number(riskScore).toFixed(1)}%)
              </span>
            </div>

            <div className="meta-box">
              <span className="meta-lbl">Target Recipients</span>
              <span className="meta-val">👥 ~1,240 citizens</span>
            </div>
          </div>

          <div className="field-group">
            <label>Recipient Mobile Phone Number</label>
            <input 
              type="tel"
              className="clean-input"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+919352526219"
              required
            />
          </div>

          <div className="field-group">
            <label>Alert Message Content</label>
            <textarea 
              className="clean-textarea sms-message-box"
              rows="4"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              required
            ></textarea>
          </div>

          <button 
            type="submit" 
            className={`btn-send-alert ${dispatching ? 'sending' : ''}`}
            disabled={dispatching}
          >
            {dispatching ? '⚡ DISPATCHING ALERT...' : '🚨 SEND EMERGENCY ALERT'}
          </button>

          {/* Success Banner */}
          {dispatchResult && dispatchResult.status === 'SUCCESS' && (
            <div className="alert-success-banner">
              <div className="banner-title">✓ Alert Sent Successfully</div>
              <p>1,240 recipients notified in {locationName} cell.</p>
            </div>
          )}

          {dispatchResult && dispatchResult.status === 'ERROR' && (
            <div className="alert-error-banner">
              ⚠️ Alert Dispatch Error: {dispatchResult.message}
            </div>
          )}
        </form>

        {/* Gateway & Delivery Accordion */}
        <div className="technical-details-accordion">
          <button 
            type="button" 
            className="btn-accordion-toggle"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          >
            {showTechnicalDetails ? '▲ Hide Gateway Configuration' : '▼ Delivery & Gateway Configuration'}
          </button>

          {showTechnicalDetails && (
            <div className="accordion-content">
              <div className="channel-select-group">
                <label>SMS Gateway Provider</label>
                <div className="channel-buttons">
                  <button
                    type="button"
                    className={`btn-channel ${channel === 'twilio' ? 'active' : ''}`}
                    onClick={() => setChannel('twilio')}
                  >
                    Twilio SMS (Global)
                  </button>
                  <button
                    type="button"
                    className={`btn-channel ${channel === 'msg91' ? 'active' : ''}`}
                    onClick={() => setChannel('msg91')}
                  >
                    MSG91 DLT (India)
                  </button>
                </div>
              </div>

              {channel === 'twilio' ? (
                <div className="creds-form">
                  <input 
                    type="text" 
                    placeholder="Twilio Account SID"
                    value={twilioSid}
                    onChange={(e) => setTwilioSid(e.target.value)}
                    className="clean-input sm"
                  />
                  <input 
                    type="password" 
                    placeholder="Twilio Auth Token"
                    value={twilioToken}
                    onChange={(e) => setTwilioToken(e.target.value)}
                    className="clean-input sm"
                  />
                  <input 
                    type="text" 
                    placeholder="Twilio From Number (+1...)"
                    value={twilioFromPhone}
                    onChange={(e) => setTwilioFromPhone(e.target.value)}
                    className="clean-input sm"
                  />
                </div>
              ) : (
                <div className="creds-form">
                  <input 
                    type="password" 
                    placeholder="MSG91 Auth Key"
                    value={msg91Key}
                    onChange={(e) => setMsg91Key(e.target.value)}
                    className="clean-input sm"
                  />
                </div>
              )}

              {dispatchResult && dispatchResult.dispatch_details && (
                <div className="raw-tech-details">
                  <div>Status: <strong>{dispatchResult.dispatch_details.status}</strong></div>
                  <div>ACK ID: <code>{dispatchResult.dispatch_details.carrier_ack_id}</code></div>
                  <div>Mode: <code>{dispatchResult.dispatch_details.dispatch_mode}</code></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmsControlModal;
