import React, { useState, useEffect } from 'react';

const EmergencyPanel = ({ onSelectRoute, activeRouteData }) => {
  const [priorityQueue, setPriorityQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [computingRouteFor, setComputingRouteFor] = useState(null);

  const fetchPriorityList = () => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:8000/emergency/priority-list')
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch emergency priority list");
        return res.json();
      })
      .then(data => {
        setPriorityQueue(data.priority_queue || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPriorityList();
  }, []);

  const handleComputeRoute = (item) => {
    setComputingRouteFor(item.id);
    onSelectRoute(item.latitude, item.longitude, item.name);
    setTimeout(() => {
      setComputingRouteFor(null);
    }, 1200);
  };

  const getUrgencyBadgeClass = (urgency) => {
    switch (urgency) {
      case 'CRITICAL': return 'urgency-badge critical';
      case 'HIGH': return 'urgency-badge high';
      case 'MEDIUM': return 'urgency-badge medium';
      default: return 'urgency-badge low';
    }
  };

  return (
    <div className="emergency-panel-container">
      <div className="emergency-header">
        <div>
          <h2 className="emergency-title">🚨 Emergency Operations & Evacuation Control</h2>
          <p className="emergency-subtitle">
            Auto-Ranked Settlement Queue • <code className="formula-tag">Priority Score = ML Risk Score (0-100) × Population Exposure</code>
          </p>
        </div>
        <button className="refresh-queue-btn" onClick={fetchPriorityList} disabled={loading}>
          {loading ? '⚡ Updating Queue...' : '🔄 Refresh Priority Queue'}
        </button>
      </div>

      {/* Active Route Summary Box */}
      {activeRouteData && (
        <div className="active-route-card">
          <div className="route-card-header">
            <span className="route-title">🗺️ Dijkstra Safe Evacuation Route Active</span>
            <span className="route-status-tag">{activeRouteData.status}</span>
          </div>

          <div className="route-grid-metrics">
            <div className="route-metric">
              <span className="metric-lbl">Origin Settlement</span>
              <span className="metric-val">{activeRouteData.origin?.nearest_node || 'Location'}</span>
            </div>
            <div className="route-metric">
              <span className="metric-lbl">Safe Evacuation Hub</span>
              <span className="metric-val text-blue">{activeRouteData.destination?.nearest_safe_hub || 'Relief Hub'}</span>
            </div>
            <div className="route-metric">
              <span className="metric-lbl">Total Safe Distance</span>
              <span className="metric-val text-amber">{activeRouteData.distance_km} km</span>
            </div>
            <div className="route-metric">
              <span className="metric-lbl">Est. Transit Time</span>
              <span className="metric-val text-emerald">{activeRouteData.estimated_time_mins} mins</span>
            </div>
            <div className="route-metric">
              <span className="metric-lbl">Avoided Hazard Zones</span>
              <span className="metric-val text-red">⚠️ {activeRouteData.avoided_hazard_zones} Hazards Detoured</span>
            </div>
          </div>

          {activeRouteData.waypoints && activeRouteData.waypoints.length > 0 && (
            <div className="waypoints-trail">
              <span className="trail-lbl">🛣️ Safe Path Waypoints:</span>
              <div className="trail-chips">
                {activeRouteData.waypoints.map((wp, idx) => (
                  <span key={idx} className="wp-chip">
                    {wp} {idx < activeRouteData.waypoints.length - 1 ? '➔' : '🏁'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Priority Table Queue */}
      <div className="priority-table-wrapper">
        {loading ? (
          <div className="emergency-loading">
            <div className="spinner"></div>
            <span>Calculating Real-Time GEE Satellite Risk & Population Exposure for All NER Settlements...</span>
          </div>
        ) : error ? (
          <div className="emergency-error">
            <span>⚠️ {error}</span>
            <button onClick={fetchPriorityList}>Retry</button>
          </div>
        ) : (
          <table className="priority-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Settlement / District</th>
                <th>Urgency</th>
                <th>ML Risk %</th>
                <th>Population</th>
                <th>Priority Score</th>
                <th>Recommended Disaster Action</th>
                <th>Evacuation Routing</th>
              </tr>
            </thead>
            <tbody>
              {priorityQueue.map((item, index) => (
                <tr key={item.id} className={index === 0 ? 'top-priority-row' : ''}>
                  <td className="rank-cell">#{index + 1}</td>
                  <td>
                    <div className="settlement-name">{item.name}</div>
                    <div className="settlement-sub">{item.district}, {item.state}</div>
                  </td>
                  <td>
                    <span className={getUrgencyBadgeClass(item.urgency_level)}>
                      {item.urgency_level}
                    </span>
                  </td>
                  <td>
                    <span className="risk-num">{item.risk_score}%</span>
                  </td>
                  <td>
                    <div className="pop-num">{item.population.toLocaleString()} citizens</div>
                    <div className="infra-sub">🏥 {item.hospitals} Hospitals | 🎪 {item.relief_shelters} Shelters</div>
                  </td>
                  <td>
                    <div className="priority-score-pill">
                      {item.priority_score}
                    </div>
                  </td>
                  <td className="action-cell">
                    <span className="action-text">{item.recommended_action}</span>
                  </td>
                  <td>
                    <button 
                      className={`route-action-btn ${computingRouteFor === item.id ? 'computing' : ''}`}
                      onClick={() => handleComputeRoute(item)}
                      disabled={computingRouteFor === item.id}
                    >
                      {computingRouteFor === item.id ? '⚡ Routing...' : '🗺️ Safe Route'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EmergencyPanel;
