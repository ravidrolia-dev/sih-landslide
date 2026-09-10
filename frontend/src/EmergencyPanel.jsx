import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config';

const EmergencyPanel = ({ onSelectRoute, activeRouteData, onOpenSmsModal, onSwitchToMap }) => {
  const [priorityQueue, setPriorityQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [computingRouteFor, setComputingRouteFor] = useState(null);
  const [filterUrgency, setFilterUrgency] = useState('ALL');
  const [showFullTable, setShowFullTable] = useState(false);

  const fetchPriorityList = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/emergency/priority-list`)
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
    if (onSelectRoute) {
      onSelectRoute(item.latitude, item.longitude, item.name);
    }
    if (onSwitchToMap) {
      onSwitchToMap();
    }
    setTimeout(() => {
      setComputingRouteFor(null);
    }, 800);
  };

  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case 'CRITICAL': return { label: 'CRITICAL', class: 'badge-critical', icon: '🔴' };
      case 'HIGH': return { label: 'HIGH RISK', class: 'badge-high', icon: '🟠' };
      case 'MEDIUM': return { label: 'MODERATE', class: 'badge-medium', icon: '🟡' };
      default: return { label: 'LOW RISK', class: 'badge-low', icon: '🟢' };
    }
  };

  // Calculations for counter header
  const criticalCount = priorityQueue.filter(i => i.urgency_level === 'CRITICAL').length;
  const highCount = priorityQueue.filter(i => i.urgency_level === 'HIGH').length;
  const totalIncidents = priorityQueue.length;
  const totalPopAtRisk = priorityQueue.reduce((acc, i) => acc + (i.population || 0), 0);

  // Filtered queue
  const filteredQueue = priorityQueue.filter(i => {
    if (filterUrgency === 'ALL') return true;
    return i.urgency_level === filterUrgency;
  });

  return (
    <div className="emergency-operations-view">
      {/* Emergency Header Bar */}
      <div className="emergency-hero-banner">
        <div className="banner-title-block">
          <div className="title-row">
            <span className="hero-icon">🚨</span>
            <div>
              <h2>EMERGENCY OPERATIONS & EVACUATION CONTROL</h2>
              <p>Real-Time Hazard Prioritization & Disaster Evacuation Command Center</p>
            </div>
          </div>
        </div>

        {/* Counter Summary Stats */}
        <div className="emergency-summary-counters">
          <div className="counter-card total">
            <span className="c-val">{totalIncidents}</span>
            <span className="c-lbl">Active Settlements</span>
          </div>
          <div className="counter-card critical">
            <span className="c-val red">{criticalCount}</span>
            <span className="c-lbl">🔴 Critical</span>
          </div>
          <div className="counter-card high">
            <span className="c-val orange">{highCount}</span>
            <span className="c-lbl">🟠 High Vulnerability</span>
          </div>
          <div className="counter-card pop">
            <span className="c-val blue">{totalPopAtRisk.toLocaleString()}</span>
            <span className="c-lbl">Exposed Citizens</span>
          </div>
        </div>

        <button className="btn-refresh-queue" onClick={fetchPriorityList} disabled={loading}>
          {loading ? '⚡ Syncing...' : '🔄 Refresh Queue'}
        </button>
      </div>

      {/* Active Route Summary Banner (If Dijkstra/OSRM Evacuation Route is computed) */}
      {activeRouteData && (
        <div className="active-evac-banner-card">
          <div className="evac-left">
            <div className="evac-tag">🛣️ DIJKSTRA SAFE EVACUATION ROUTE ACTIVE</div>
            <h3>Origin: <strong>{activeRouteData.origin?.nearest_node || 'Evacuation Point'}</strong> ➔ Destination: <strong className="text-blue">{activeRouteData.destination?.nearest_safe_hub}</strong></h3>
            <div className="evac-metrics-inline">
              <span>Safe Distance: <strong>{activeRouteData.distance_km} km</strong></span>
              <span>Est. Transit: <strong>{activeRouteData.estimated_time_mins} mins</strong></span>
              <span className="text-green">✓ Detoured {activeRouteData.avoided_hazard_zones} High-Risk Landslide Cells</span>
            </div>
          </div>

          <button className="btn-view-map-route" onClick={onSwitchToMap}>
            🗺️ View Route on GIS Map
          </button>
        </div>
      )}

      {/* Incident Controls & Filter Toolbar */}
      <div className="emergency-filter-bar">
        <span className="filter-title">Priority Filter:</span>
        <div className="filter-pills">
          <button 
            className={`filter-pill ${filterUrgency === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterUrgency('ALL')}
          >
            All Incidents ({totalIncidents})
          </button>
          <button 
            className={`filter-pill critical ${filterUrgency === 'CRITICAL' ? 'active' : ''}`}
            onClick={() => setFilterUrgency('CRITICAL')}
          >
            🔴 Critical Only ({criticalCount})
          </button>
          <button 
            className={`filter-pill high ${filterUrgency === 'HIGH' ? 'active' : ''}`}
            onClick={() => setFilterUrgency('HIGH')}
          >
            🟠 High Risk ({highCount})
          </button>
        </div>
      </div>

      {/* Main Incident Grid View */}
      {loading ? (
        <div className="emergency-loading-box">
          <div className="gis-spinner"></div>
          <p>Calculating Real-Time GEE Satellite Risk & Population Exposure for All NER Settlements...</p>
        </div>
      ) : error ? (
        <div className="emergency-error-box">
          <span>⚠️ {error}</span>
          <button onClick={fetchPriorityList} className="btn-retry">Retry Fetching Queue</button>
        </div>
      ) : (
        <>
          <div className="incidents-cards-grid">
            {filteredQueue.map((item, idx) => {
              const badge = getUrgencyBadge(item.urgency_level);
              return (
                <div key={item.id} className={`incident-command-card ${item.urgency_level?.toLowerCase() || ''}`}>
                  {/* Top Bar */}
                  <div className="inc-card-top">
                    <span className={`badge-pill ${badge.class}`}>
                      {badge.icon} {badge.label}
                    </span>
                    <span className="rank-badge">Priority #{idx + 1}</span>
                  </div>

                  {/* Body */}
                  <div className="inc-card-body">
                    <h3 className="inc-location-title">{item.name}</h3>
                    <p className="inc-location-sub">{item.district}, {item.state}</p>

                    <div className="action-recommendation-box">
                      <span className="rec-lbl">Recommended Disaster Action:</span>
                      <p className="rec-desc">{item.recommended_action}</p>
                    </div>

                    <div className="inc-metrics-grid">
                      <div className="inc-metric">
                        <span className="m-lbl">ML Risk</span>
                        <span className="m-val red">{item.risk_score}%</span>
                      </div>
                      <div className="inc-metric">
                        <span className="m-lbl">Population</span>
                        <span className="m-val">{item.population.toLocaleString()}</span>
                      </div>
                      <div className="inc-metric">
                        <span className="m-lbl">Priority Score</span>
                        <span className="m-val amber">{item.priority_score}</span>
                      </div>
                      <div className="inc-metric">
                        <span className="m-lbl">Relief Infra</span>
                        <span className="m-val">🏥 {item.hospitals} | 🎪 {item.relief_shelters}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="inc-card-actions">
                    <button 
                      className="btn-inc-action primary-route"
                      onClick={() => handleComputeRoute(item)}
                      disabled={computingRouteFor === item.id}
                    >
                      {computingRouteFor === item.id ? '⚡ Computing...' : '🗺️ Evacuation Route'}
                    </button>
                    <button 
                      className="btn-inc-action alert-btn"
                      onClick={() => onOpenSmsModal && onOpenSmsModal({ locationName: item.name, lat: item.latitude, lon: item.longitude, riskScore: item.risk_score })}
                    >
                      🚨 Send Alert
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Toggle Full Administrative Queue Table */}
          <div className="table-accordion-section">
            <button 
              className="btn-toggle-admin-table" 
              onClick={() => setShowFullTable(!showFullTable)}
            >
              {showFullTable ? '▲ Hide Full Administrative Priority Queue Table' : '▼ View Full Administrative Priority Queue Table (District Officials)'}
            </button>

            {showFullTable && (
              <div className="admin-table-container">
                <table className="admin-priority-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Settlement / District</th>
                      <th>Urgency</th>
                      <th>ML Risk</th>
                      <th>Population</th>
                      <th>Priority Score</th>
                      <th>Recommended Action</th>
                      <th>Evacuation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorityQueue.map((item, index) => (
                      <tr key={item.id} className={index === 0 ? 'row-top-priority' : ''}>
                        <td className="cell-rank">#{index + 1}</td>
                        <td>
                          <div className="cell-name">{item.name}</div>
                          <div className="cell-sub">{item.district}, {item.state}</div>
                        </td>
                        <td>
                          <span className={`badge-pill ${getUrgencyBadge(item.urgency_level).class}`}>
                            {item.urgency_level}
                          </span>
                        </td>
                        <td><span className="cell-risk-num">{item.risk_score}%</span></td>
                        <td>{item.population.toLocaleString()} citizens</td>
                        <td><span className="cell-score-pill">{item.priority_score}</span></td>
                        <td className="cell-action">{item.recommended_action}</td>
                        <td>
                          <button 
                            className="btn-table-evac-action"
                            onClick={() => handleComputeRoute(item)}
                          >
                            🗺️ Evacuation Route
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EmergencyPanel;
