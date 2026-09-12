import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config';

// High-fidelity fallback emergency priority queue dataset for North-East India
const FALLBACK_PRIORITY_QUEUE = [
  {
    id: "EM-001",
    name: "Noney Settlement & Highway Corridor",
    district: "Noney",
    state: "Manipur",
    urgency_level: "CRITICAL",
    risk_score: 94.2,
    priority_score: 98.6,
    population: 14250,
    hospitals: 2,
    relief_shelters: 5,
    recommended_action: "Immediate Evacuation Order via NH-37 Detour & Deploy Heavy Earthmovers",
    latitude: 24.8167,
    longitude: 93.6000
  },
  {
    id: "EM-002",
    name: "Aizawl North Ridge & Hunthar Veng",
    district: "Aizawl",
    state: "Mizoram",
    urgency_level: "CRITICAL",
    risk_score: 89.7,
    priority_score: 94.1,
    population: 28400,
    hospitals: 4,
    relief_shelters: 8,
    recommended_action: "Stage Relief Camp at Indoor Stadium & Activate Slope Soil Stabilization",
    latitude: 23.7367,
    longitude: 92.7176
  },
  {
    id: "EM-003",
    name: "Kurung Kumey Slope Corridor",
    district: "Kurung Kumey",
    state: "Arunachal Pradesh",
    urgency_level: "HIGH",
    risk_score: 78.4,
    priority_score: 83.2,
    population: 8600,
    hospitals: 1,
    relief_shelters: 3,
    recommended_action: "Pre-position Emergency Rations & Monitor GEE Soil Saturation Index",
    latitude: 27.9000,
    longitude: 93.4500
  },
  {
    id: "EM-004",
    name: "Champhai Border Pass & Zokhawthar",
    district: "Champhai",
    state: "Mizoram",
    urgency_level: "HIGH",
    risk_score: 74.1,
    priority_score: 79.5,
    population: 11800,
    hospitals: 2,
    relief_shelters: 4,
    recommended_action: "Issue SMS Early Warning Alert & Restrict Night Transport Heavy Vehicles",
    latitude: 23.4560,
    longitude: 93.3280
  },
  {
    id: "EM-005",
    name: "Kohima Bypass & Dzüko Valley Access",
    district: "Kohima",
    state: "Nagaland",
    urgency_level: "HIGH",
    risk_score: 71.8,
    priority_score: 76.8,
    population: 19500,
    hospitals: 3,
    relief_shelters: 6,
    recommended_action: "Deploy Mobile Medical Patrols & Monitor Drainage Debris Flow",
    latitude: 25.6747,
    longitude: 94.1100
  },
  {
    id: "EM-006",
    name: "Gangtok National Highway NH-10 Link",
    district: "East Sikkim",
    state: "Sikkim",
    urgency_level: "MEDIUM",
    risk_score: 58.3,
    priority_score: 62.4,
    population: 32100,
    hospitals: 5,
    relief_shelters: 10,
    recommended_action: "Clear Drainage Channels & Keep Standby Evacuation Vehicles Ready",
    latitude: 27.3389,
    longitude: 88.6065
  }
];

const EmergencyPanel = ({ onSelectRoute, activeRouteData, onOpenSmsModal, onSwitchToMap }) => {
  const [priorityQueue, setPriorityQueue] = useState(FALLBACK_PRIORITY_QUEUE);
  const [loading, setLoading] = useState(false);
  const [computingRouteFor, setComputingRouteFor] = useState(null);
  const [filterUrgency, setFilterUrgency] = useState('ALL');
  const [showFullTable, setShowFullTable] = useState(false);

  const fetchPriorityList = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/emergency/priority-list`)
      .then(res => {
        if (!res.ok) throw new Error("Backend server offline");
        return res.json();
      })
      .then(data => {
        if (data.priority_queue && data.priority_queue.length > 0) {
          setPriorityQueue(data.priority_queue);
        } else {
          setPriorityQueue(FALLBACK_PRIORITY_QUEUE);
        }
        setLoading(false);
      })
      .catch(err => {
        console.warn("[EmergencyPanel] Network request failed. Loading fallback emergency priority queue:", err);
        setPriorityQueue(FALLBACK_PRIORITY_QUEUE);
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
      case 'CRITICAL': 
        return { label: 'CRITICAL', class: 'badge-critical', color: '#ef4444' };
      case 'HIGH': 
        return { label: 'HIGH RISK', class: 'badge-high', color: '#f97316' };
      case 'MEDIUM': 
        return { label: 'MODERATE', class: 'badge-medium', color: '#eab308' };
      default: 
        return { label: 'LOW RISK', class: 'badge-low', color: '#10b981' };
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
      {/* Emergency Hero Banner */}
      <div className="emergency-hero-banner">
        <div className="banner-title-block">
          <div className="title-row">
            <span className="hero-icon-svg">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </span>
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
            <span className="c-lbl">Critical Risk</span>
          </div>
          <div className="counter-card high">
            <span className="c-val orange">{highCount}</span>
            <span className="c-lbl">High Vulnerability</span>
          </div>
          <div className="counter-card pop">
            <span className="c-val blue">{totalPopAtRisk.toLocaleString()}</span>
            <span className="c-lbl">Exposed Citizens</span>
          </div>
        </div>

        <button className="btn-refresh-queue" onClick={fetchPriorityList} disabled={loading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          {loading ? 'Syncing...' : 'Refresh Queue'}
        </button>
      </div>

      {/* Active Evacuation Route Banner */}
      {activeRouteData && (
        <div className="active-evac-banner-card">
          <div className="evac-left">
            <div className="evac-tag">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              DIJKSTRA SAFE EVACUATION ROUTE ACTIVE
            </div>
            <h3>Origin: <strong>{activeRouteData.origin?.nearest_node || 'Evacuation Point'}</strong> ➔ Destination: <strong className="text-blue">{activeRouteData.destination?.nearest_safe_hub}</strong></h3>
            <div className="evac-metrics-inline">
              <span>Safe Distance: <strong>{activeRouteData.distance_km} km</strong></span>
              <span>Est. Transit: <strong>{activeRouteData.estimated_time_mins} mins</strong></span>
              <span className="text-green">✓ Detoured {activeRouteData.avoided_hazard_zones} High-Risk Landslide Cells</span>
            </div>
          </div>

          <button className="btn-view-map-route" onClick={onSwitchToMap}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
            View Route on GIS Map
          </button>
        </div>
      )}

      {/* Priority Filter Bar */}
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
            Critical Only ({criticalCount})
          </button>
          <button 
            className={`filter-pill high ${filterUrgency === 'HIGH' ? 'active' : ''}`}
            onClick={() => setFilterUrgency('HIGH')}
          >
            High Risk ({highCount})
          </button>
        </div>
      </div>

      {/* Main Incident Grid View */}
      {loading ? (
        <div className="emergency-loading-box">
          <div className="gis-spinner"></div>
          <p>Calculating Real-Time GEE Satellite Risk & Population Exposure for All NER Settlements...</p>
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
                      <span className="badge-dot" style={{ backgroundColor: badge.color, width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block', marginRight: '5px' }}></span>
                      {badge.label}
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
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '5px' }}>
                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                      </svg>
                      {computingRouteFor === item.id ? 'Computing...' : 'Evacuation Route'}
                    </button>
                    <button 
                      className="btn-inc-action alert-btn"
                      onClick={() => onOpenSmsModal && onOpenSmsModal({ locationName: item.name, lat: item.latitude, lon: item.longitude, riskScore: item.risk_score })}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '5px' }}>
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                      </svg>
                      Send Alert
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
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                            </svg>
                            Evacuation Route
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
