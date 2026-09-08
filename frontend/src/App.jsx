import { useState, useEffect } from 'react'
import './App.css'
import RiskMap from './RiskMap'

function App() {
  const [healthStatus, setHealthStatus] = useState("Checking backend...")

  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then(response => response.json())
      .then(data => setHealthStatus(data.message))
      .catch(err => setHealthStatus("Backend not reachable: " + err.message))
  }, [])

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Landslide Risk Dashboard</h1>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
        <p style={{ margin: 0 }}>Backend Status: <strong>{healthStatus}</strong></p>
      </div>

      <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <RiskMap />
      </div>
    </div>
  )
}

export default App
