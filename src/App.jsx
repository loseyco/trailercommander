import React, { useState, useEffect } from 'react';
import { Power, Lightbulb, Droplets, Fan, Wind, Sun, Battery, Radio, Thermometer, Droplet, Navigation, Info, X, BatteryMedium, SlidersHorizontal } from 'lucide-react';
import { initMqtt, sendCommand, fetchSensors } from './api';
import './index.css';

// Firebase & Map
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const RELAYS = [
  { id: 1, name: 'Main Power', desc: 'Relay Ch 1 (Pin 0)', icon: Power },
  { id: 2, name: 'Interior Lights', desc: 'Relay Ch 2 (Pin 1)', icon: Lightbulb },
  { id: 3, name: 'Exterior Lights', desc: 'Relay Ch 3 (Pin 2)', icon: Sun },
  { id: 4, name: 'Water Pump', desc: 'Relay Ch 4 (Pin 3)', icon: Droplets },
  { id: 5, name: 'Fridge Power', desc: 'Relay Ch 5 (Pin 4)', icon: Battery },
  { id: 6, name: 'Top Front Vent', desc: 'Relay Ch 6 (Pin 5)', icon: Fan },
  { id: 7, name: 'Bottom Rear Vent', desc: 'Relay Ch 7 (Pin 6)', icon: Wind },
  { id: 8, name: 'Auxiliary', desc: 'Relay Ch 8 (Pin 7)', icon: Radio },
];

function App() {
  const [relays, setRelays] = useState(
    RELAYS.reduce((acc, relay) => ({ ...acc, [relay.id]: false }), {})
  );
  
  const [isProcessing, setIsProcessing] = useState({});
  const [connectionMode, setConnectionMode] = useState('offline'); 
  const [toastMessage, setToastMessage] = useState('');
  
  const [sensors, setSensors] = useState({ temperature: null, humidity: null, speed_mph: 0.0, raw_voltage: 0, lat: 0, lng: 0 });
  const [dogMode, setDogMode] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);

  // New State for Voltage and Maps
  const [voltageMultiplier, setVoltageMultiplier] = useState(5.0);
  const [antTrail, setAntTrail] = useState([]);

  useEffect(() => {
    // Load config from Firestore
    const loadConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'calibration');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setVoltageMultiplier(docSnap.data().voltageMultiplier || 5.0);
        }

        // Load Ant Trail
        const q = query(collection(db, 'telemetry'), orderBy('__name__', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);
        const trail = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.lat && data.lng) {
             trail.push([data.lat, data.lng]);
          }
        });
        setAntTrail(trail.reverse()); // Put in chronological order
      } catch (e) {
        console.error("Firebase load error", e);
      }
    };
    loadConfig();

    initMqtt(
      (state) => {
        const newStates = {};
        for (let i = 1; i <= 8; i++) {
          if (state[`relay${i}`] !== undefined) {
            newStates[i] = state[`relay${i}`] === 'on';
          }
        }
        setRelays((prev) => ({ ...prev, ...newStates }));
        if (state.dog_mode !== undefined) {
          setDogMode(state.dog_mode === 'on');
        }
      },
      (sensorData) => {
        setSensors(prev => ({
          ...prev,
          temperature: sensorData.temperature !== undefined ? sensorData.temperature : prev.temperature,
          humidity: sensorData.humidity !== undefined ? sensorData.humidity : prev.humidity,
          speed_mph: sensorData.speed_mph !== undefined ? sensorData.speed_mph : prev.speed_mph,
          raw_voltage: sensorData.raw_voltage !== undefined ? sensorData.raw_voltage : prev.raw_voltage,
          lat: sensorData.lat !== undefined ? sensorData.lat : prev.lat,
          lng: sensorData.lng !== undefined ? sensorData.lng : prev.lng,
        }));
        if (sensorData.dog_mode !== undefined) {
          setDogMode(sensorData.dog_mode === 'on');
        }
      }
    );

    const pingLocal = async () => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 1000);
        const res = await fetch('http://192.168.2.165/api/ping', { signal: controller.signal });
        clearTimeout(id);
        if (res.ok) {
          setConnectionMode('local');
          const sensorRes = await fetchSensors();
          if (sensorRes.success) {
            setSensors(prev => ({ ...prev, ...sensorRes }));
          }
        }
      } catch (e) {
        if (navigator.onLine) {
          setConnectionMode('mqtt');
        } else {
          setConnectionMode('offline');
        }
      }
    };
    
    pingLocal();

    window.addEventListener('online', pingLocal);
    window.addEventListener('offline', () => setConnectionMode('offline'));

    const interval = setInterval(async () => {
      if (connectionMode === 'local') {
        const sensorRes = await fetchSensors();
        if (sensorRes.success) {
          setSensors(prev => ({ ...prev, ...sensorRes }));
        }
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', pingLocal);
      window.removeEventListener('offline', () => setConnectionMode('offline'));
      clearInterval(interval);
    }
  }, [connectionMode]);

  const showToast = (message, mode) => {
    setToastMessage({ text: message, mode });
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleMultiplierChange = async (e) => {
    const val = parseFloat(e.target.value);
    setVoltageMultiplier(val);
  };

  const saveMultiplier = async () => {
    try {
      await setDoc(doc(db, 'settings', 'calibration'), { voltageMultiplier });
      showToast('Calibration Saved', 'local');
      setShowCalibration(false);
    } catch(e) {
      showToast('Failed to save', 'danger');
    }
  };

  const toggleDogMode = async () => {
    const currentState = dogMode;
    const cmd = currentState ? 'dogmode/off' : 'dogmode/on';
    
    setDogMode(!currentState);
    
    const result = await sendCommand(cmd);
    
    if (result.success) {
      setConnectionMode(result.mode);
      showToast(`Dog Mode ${!currentState ? 'ON' : 'OFF'} via ${result.mode.toUpperCase()}`, result.mode);
      if (result.data && result.data.data) {
        setDogMode(result.data.data.dog_mode === 'on');
      }
    } else {
      setDogMode(currentState);
      showToast('Connection failed. Trailer unreachable.', 'danger');
    }
  };

  const toggleRelay = async (id) => {
    if ((id === 6 || id === 7) && sensors.speed_mph > 5.0 && !relays[id]) {
      showToast('Safety Lock: Cannot open vents while moving > 5mph', 'danger');
      return;
    }

    if ((id === 6 || id === 7) && dogMode) {
      showToast('Dog Mode is Active. Vents are locked to auto-pilot.', 'danger');
      return;
    }

    setIsProcessing((prev) => ({ ...prev, [id]: true }));
    
    const currentState = relays[id];
    const cmd = currentState ? `relay/${id}/off` : `relay/${id}/on`;
    
    setRelays((prev) => ({ ...prev, [id]: !currentState }));

    const result = await sendCommand(cmd);
    
    setIsProcessing((prev) => ({ ...prev, [id]: false }));
    
    if (result.success) {
      setConnectionMode(result.mode);
      showToast(`Channel ${id} sent via ${result.mode.toUpperCase()}`, result.mode);
      
      if (result.data && result.data.data) {
         setRelays(prev => ({...prev, [id]: result.data.data[`relay${id}`] === 'on'}));
      }
    } else {
      setRelays((prev) => ({ ...prev, [id]: currentState }));
      showToast('Connection failed. Trailer unreachable.', 'danger');
    }
  };

  const calculatedVoltage = ((sensors.raw_voltage / 1023.0) * 3.3 * voltageMultiplier).toFixed(2);
  const mapCenter = (sensors.lat && sensors.lng) ? [sensors.lat, sensors.lng] : (antTrail.length > 0 ? antTrail[antTrail.length - 1] : [39.8283, -98.5795]);

  return (
    <>
      <div className="background-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <div className="app-container">
        <div className="dashboard-header">
          <header className="header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>TrailerCommander</h1>
                <p>Off-Grid Rig Control System</p>
              </div>
              <button className="icon-btn" onClick={() => setShowGuide(true)}>
                <Info size={24} />
              </button>
            </div>
          </header>

          <div className="status-bar" style={{ marginTop: '1.5rem' }}>
            <div className="status-item">
              <div className={`indicator ${connectionMode === 'local' ? 'active' : ''}`} style={{ background: connectionMode === 'local' ? 'var(--led-local)' : '', boxShadow: connectionMode === 'local' ? '0 0 10px var(--led-local)' : ''}}></div>
              Local API
            </div>
            <div className="status-item">
              <div className={`indicator ${connectionMode === 'mqtt' ? 'active' : ''}`} style={{ background: connectionMode === 'mqtt' ? 'var(--led-cloud)' : '', boxShadow: connectionMode === 'mqtt' ? '0 0 10px var(--led-cloud)' : ''}}></div>
              Cloud Link
            </div>
          </div>
        </div>

        <div className="dashboard-left">
          <div className="sensor-dashboard glass-card" style={{ flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-around' }}>
            <div className="sensor-item" style={{ width: '45%' }}>
              <div className="icon-wrapper" style={{ color: '#fca5a5' }}>
                <Thermometer size={24} />
              </div>
              <div className="sensor-data">
                <span className="sensor-value">{sensors.temperature ? sensors.temperature.toFixed(1) + '°' : '--°'}</span>
                <span className="sensor-label">Temp</span>
              </div>
            </div>
            
            <div className="sensor-item" style={{ width: '45%' }}>
              <div className="icon-wrapper" style={{ color: '#93c5fd' }}>
                <Droplet size={24} />
              </div>
              <div className="sensor-data">
                <span className="sensor-value">{sensors.humidity ? sensors.humidity.toFixed(1) + '%' : '--%'}</span>
                <span className="sensor-label">Humidity</span>
              </div>
            </div>

            <div className="sensor-item" style={{ width: '45%' }}>
              <div className="icon-wrapper" style={{ color: 'var(--led-gps)' }}>
                <Navigation size={24} />
              </div>
              <div className="sensor-data">
                <span className="sensor-value">{sensors.speed_mph ? sensors.speed_mph.toFixed(1) : '0.0'}</span>
                <span className="sensor-label">MPH</span>
              </div>
            </div>

            <div className="sensor-item" style={{ width: '45%', cursor: 'pointer' }} onClick={() => setShowCalibration(true)}>
              <div className="icon-wrapper" style={{ color: 'var(--success)' }}>
                <BatteryMedium size={24} />
              </div>
              <div className="sensor-data">
                <span className="sensor-value">{calculatedVoltage}v</span>
                <span className="sensor-label">Battery</span>
              </div>
            </div>

            {/* Dog Mode Toggle */}
            <div style={{ width: '100%', marginTop: '0.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem', color: dogMode ? 'var(--led-dog)' : 'inherit' }}>🐾</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: dogMode ? 'var(--led-dog)' : 'inherit' }}>Dog Mode</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto-Vents (70° - 75°)</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch" 
                checked={dogMode}
                onChange={toggleDogMode}
                disabled={connectionMode === 'offline'}
                style={{ background: dogMode ? 'var(--led-dog)' : 'rgba(255, 255, 255, 0.1)', boxShadow: dogMode ? '0 0 15px rgba(217, 70, 239, 0.4)' : '' }}
              />
            </div>
          </div>

          {/* GPS Map Widget */}
          <div className="glass-card" style={{ display: 'block', padding: 0, overflow: 'hidden', height: '250px' }}>
            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', background: '#1e293b' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {antTrail.length > 0 && <Polyline positions={antTrail} color="var(--accent)" weight={4} opacity={0.7} />}
              {(sensors.lat && sensors.lng) && <Marker position={[sensors.lat, sensors.lng]} />}
            </MapContainer>
          </div>
        </div>

        <div className="dashboard-right">
          <div className="controls-grid">
            {RELAYS.map((relay) => {
              const Icon = relay.icon;
              let isOn = relays[relay.id];
              
              if ((relay.id === 6 || relay.id === 7) && sensors.speed_mph > 5.0) {
                isOn = false; 
              }
              
              const processing = isProcessing[relay.id];
              const lockedByDogMode = (relay.id === 6 || relay.id === 7) && dogMode;

              return (
                <div key={relay.id} className="glass-card" style={{ opacity: lockedByDogMode ? 0.7 : 1 }}>
                  <div className="card-info">
                    <div className="icon-wrapper" style={{ color: isOn ? 'var(--led-relay)' : 'var(--text-muted)'}}>
                      <Icon size={24} />
                    </div>
                    <div>
                      <h3>{relay.name} {lockedByDogMode && <span style={{fontSize: '0.8rem', color: 'var(--led-dog)'}}> (Auto)</span>}</h3>
                      <p>{relay.desc}</p>
                    </div>
                  </div>
                  
                  <input 
                    type="checkbox" 
                    className="toggle-switch" 
                    checked={isOn}
                    onChange={() => toggleRelay(relay.id)}
                    disabled={processing || connectionMode === 'offline' || lockedByDogMode}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`toast ${toastMessage ? 'show' : ''} ${toastMessage.mode ? 'mode-' + toastMessage.mode : ''}`}>
        {toastMessage.text}
      </div>

      {showCalibration && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <div className="modal-header">
              <h2><SlidersHorizontal size={20} style={{marginRight: 8}}/> Voltage Calibration</h2>
              <button className="icon-btn" onClick={() => setShowCalibration(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
               <h1 style={{ fontSize: '3rem', margin: '1rem 0' }}>{calculatedVoltage}V</h1>
               <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                  Use a multimeter on your battery. Adjust the slider below until the App matches your multimeter reading.
               </p>
               
               <input 
                 type="range" 
                 min="1.0" 
                 max="15.0" 
                 step="0.05" 
                 value={voltageMultiplier} 
                 onChange={handleMultiplierChange}
                 style={{ width: '100%', marginBottom: '1rem' }}
               />
               <p style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Multiplier: {voltageMultiplier.toFixed(2)}x</p>
               
               <button 
                  onClick={saveMultiplier}
                  style={{ background: 'var(--success)', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '20px', width: '100%', marginTop: '1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                 Save Calibration to Cloud
               </button>
            </div>
          </div>
        </div>
      )}

      {showGuide && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <div className="modal-header">
              <h2>Wiring Install Guide</h2>
              <button className="icon-btn" onClick={() => setShowGuide(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              {/* Wiring guides... kept minimal here for brevity */}
              <h3>Power (Tobsun Buck Converter)</h3>
              <ul>
                <li>12V Trailer Battery ➔ Tobsun 12V IN</li>
                <li>Tobsun 5V OUT ➔ MKR1010 <b>VIN</b> Pin</li>
                <li>Tobsun 5V OUT ➔ Relay Board <b>VCC</b></li>
                <li>Common Ground ➔ MKR1010 <b>GND</b> & Relay <b>GND</b></li>
              </ul>
              
              <h3>Voltage Monitor (Analog Divider)</h3>
              <ul>
                <li>12V Battery Positive ➔ Resistor R1</li>
                <li>Resistor R1 ➔ MKR1010 <b>A1</b> Pin</li>
                <li>MKR1010 <b>A1</b> Pin ➔ Resistor R2</li>
                <li>Resistor R2 ➔ Common Ground</li>
              </ul>

              <h3>8-Channel Relay (Active Low)</h3>
              <ul>
                <li>MKR1010 Pin 0 ➔ Relay IN1 (Main Power)</li>
                <li>MKR1010 Pin 1 ➔ Relay IN2 (Interior Lights)</li>
                <li>MKR1010 Pin 2 ➔ Relay IN3 (Exterior Lights)</li>
                <li>MKR1010 Pin 3 ➔ Relay IN4 (Water Pump)</li>
                <li>MKR1010 Pin 4 ➔ Relay IN5 (Fridge)</li>
                <li>MKR1010 Pin 5 ➔ Relay IN6 (Top Front Vent)</li>
                <li>MKR1010 Pin 6 ➔ Relay IN7 (Bottom Rear Vent)</li>
                <li>MKR1010 Pin 7 ➔ Relay IN8 (Auxiliary)</li>
              </ul>

              <h3>I2C Sensors (SHT3x)</h3>
              <ul>
                <li>MKR1010 Pin 11 ➔ SHT3x <b>SDA</b></li>
                <li>MKR1010 Pin 12 ➔ SHT3x <b>SCL</b></li>
                <li>MKR1010 3.3V ➔ SHT3x <b>VIN</b></li>
              </ul>

              <h3>GPS Module (GY-NEO6MV2)</h3>
              <ul>
                <li>MKR1010 Pin 13 (RX) ➔ GPS <b>TX</b></li>
                <li>MKR1010 Pin 14 (TX) ➔ GPS <b>RX</b></li>
                <li>MKR1010 3.3V/5V ➔ GPS <b>VCC</b> (Check module rating)</li>
              </ul>
              
              <div className="notice-box">
                <strong>Motion Safety Automation:</strong> Relay Channels 6 & 7 (Vents) are automatically forced OFF and locked when GPS speed exceeds 5.0 MPH.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
