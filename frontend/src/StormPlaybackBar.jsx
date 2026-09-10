import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// 24-Hour Storm Rainfall Model Helper
export const getStormMetricsForHour = (hour) => {
  // Peak rainfall occurs around Hour 16 (4:00 PM)
  const peakHour = 16;
  const sigma = 4;
  const maxHourlyRain = 85; // mm/hr at peak
  
  const hourlyRain = Math.max(1, Math.round(maxHourlyRain * Math.exp(-Math.pow(hour - peakHour, 2) / (2 * Math.pow(sigma, 2)))));
  
  // Calculate cumulative rainfall up to current hour
  let cumulativeRain = 0;
  for (let h = 0; h <= hour; h++) {
    const hRain = Math.max(1, Math.round(maxHourlyRain * Math.exp(-Math.pow(h - peakHour, 2) / (2 * Math.pow(sigma, 2)))));
    cumulativeRain += hRain;
  }
  
  const soilSaturation = Math.min(100, Math.round(15 + (cumulativeRain / 320) * 85));
  
  let phaseName = "";
  let phaseIcon = "";
  let severityLevel = "";
  let bannerAlert = null;
  
  if (hour <= 5) {
    phaseName = "🌤️ Pre-Storm Drizzle (Light Rain)";
    phaseIcon = "🌤️";
    severityLevel = "Low Risk (Watch)";
  } else if (hour <= 11) {
    phaseName = "🌦️ Monsoon Downpour (Moderate)";
    phaseIcon = "🌦️";
    severityLevel = "Moderate Risk (Alert)";
  } else if (hour <= 16) {
    phaseName = "🌩️ Torrential Cloudburst (Heavy)";
    phaseIcon = "🌩️";
    severityLevel = "High Risk (Warning)";
    if (hour === 14) {
      bannerAlert = "⚡ STORM WARNING (14:00): Soil saturation reached 70%. High slope areas in Dima Hasao & East Khasi Hills are deteriorating rapidly!";
    } else if (hour === 16) {
      bannerAlert = "🚨 CRITICAL LANDSLIDE ALERT (16:00): Cloudburst peak (85mm/hr)! 8 hill slope cells crossed CRITICAL (85%+) Threshold!";
    }
  } else {
    phaseName = "⚡ Peak Cloudburst & Debris Flows";
    phaseIcon = "⚡";
    severityLevel = "Critical Emergency (Severe)";
    if (hour === 19) {
      bannerAlert = "⚠️ ROAD DISRUPTION (19:00): Active landslide reported on NH-27 (Haflong Pass). Route planner auto-avoidance engaged.";
    }
  }

  return {
    hour,
    formattedTime: `${String(hour).padStart(2, '0')}:00`,
    hourlyRain,
    cumulativeRain,
    soilSaturation,
    phaseName,
    phaseIcon,
    severityLevel,
    bannerAlert
  };
};

const StormPlaybackBar = ({
  isActive,
  onToggleActive,
  currentHour,
  setCurrentHour,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed,
  onStormMetricsChange
}) => {
  const timerRef = useRef(null);

  // Auto-play tick timer
  useEffect(() => {
    if (isActive && isPlaying) {
      const intervalMs = 1000 / playbackSpeed;
      timerRef.current = setInterval(() => {
        setCurrentHour(prev => {
          if (prev >= 24) {
            setIsPlaying(false);
            return 24;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isPlaying, playbackSpeed, setCurrentHour, setIsPlaying]);

  // Trigger metrics update whenever current hour changes
  useEffect(() => {
    if (isActive) {
      const metrics = getStormMetricsForHour(currentHour);
      if (onStormMetricsChange) {
        onStormMetricsChange(metrics);
      }
    }
  }, [currentHour, isActive, onStormMetricsChange]);

  if (!isActive) return null;

  const currentMetrics = getStormMetricsForHour(currentHour);

  const handleSliderChange = (e) => {
    setCurrentHour(parseInt(e.target.value, 10));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentHour(0);
  };

  return (
    <div className="storm-playback-bar-container">
      <div className="storm-bar-header">
        <div className="storm-title-group">
          <span className="storm-badge-live">⚡ LIVE STORM REPLAY</span>
          <span className="storm-subtitle">24-Hour Historical Downpour & Landslide Risk Simulator</span>
        </div>

        <div className="storm-metrics-pills">
          <div className="storm-pill">
            <span className="pill-lbl">Current Hour:</span>
            <span className="pill-val text-cyan">{currentMetrics.formattedTime}</span>
          </div>

          <div className="storm-pill">
            <span className="pill-lbl">Hourly Rain:</span>
            <span className="pill-val text-blue">{currentMetrics.hourlyRain} mm/h</span>
          </div>

          <div className="storm-pill">
            <span className="pill-lbl">Cumulative Rain:</span>
            <span className="pill-val text-amber">{currentMetrics.cumulativeRain} mm</span>
          </div>

          <div className="storm-pill">
            <span className="pill-lbl">Soil Saturation:</span>
            <span className={`pill-val ${currentMetrics.soilSaturation > 75 ? 'text-red' : currentMetrics.soilSaturation > 50 ? 'text-amber' : 'text-emerald'}`}>
              {currentMetrics.soilSaturation}%
            </span>
          </div>

          <div className="storm-pill phase-pill">
            <span className="pill-val">{currentMetrics.phaseName}</span>
          </div>
        </div>

        <button className="btn-close-storm" onClick={() => { setIsPlaying(false); onToggleActive(false); }} title="Exit Storm Playback">
          ✕ Exit Demo
        </button>
      </div>

      {/* Timeline Controls Row */}
      <div className="storm-bar-controls-row">
        {/* Playback Action Buttons */}
        <div className="playback-btn-group">
          <button 
            className={`btn-play-pause ${isPlaying ? 'playing' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play Storm'}
          </button>

          <button className="btn-reset-playback" onClick={handleReset} title="Reset to 00:00">
            ↺ Reset
          </button>
        </div>

        {/* 24-Hour Slider */}
        <div className="slider-wrapper">
          <input 
            type="range"
            min="0"
            max="24"
            step="1"
            value={currentHour}
            onChange={handleSliderChange}
            className="storm-timeline-slider"
          />
          <div className="slider-labels">
            <span>00:00 (Calm)</span>
            <span>06:00 (Drizzle)</span>
            <span>12:00 (Downpour)</span>
            <span className="text-red-bold">16:00 (Cloudburst Peak)</span>
            <span>20:00 (Flood)</span>
            <span>24:00 (End)</span>
          </div>
        </div>

        {/* Speed Selector Chips */}
        <div className="speed-chips-group">
          <span className="speed-lbl">Speed:</span>
          {[1, 2, 4].map(spd => (
            <button
              key={spd}
              className={`chip-speed ${playbackSpeed === spd ? 'active' : ''}`}
              onClick={() => setPlaybackSpeed(spd)}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StormPlaybackBar;
