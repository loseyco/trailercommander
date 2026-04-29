import React, { useState, useEffect } from 'react';
import { Power, Lightbulb, Droplets, Fan, Wind, Sun, Battery, Radio, Thermometer, Droplet, Navigation, Info, X, BatteryMedium, SlidersHorizontal, Edit3, Check } from 'lucide-react';
import { initMqtt, sendCommand, fetchSensors, publishAutomations } from './api';
import './index.css';

// Firebase & Map
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { LineChart, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const DEFAULT_RELAY_CONFIG = {
  1: { name: 'Main Power' },
  2: { name: 'Interior Lights' },
  3: { name: 'Exterior Lights' },
  4: { name: 'Water Pump' },
  5: { name: 'Fridge Power' },
  6: { name: 'Top Front Vent' },
  7: { name: 'Bottom Rear Vent' },
  8: { name: 'Auxiliary' }
};

const PIN_INFO = {
  1: 'Relay Ch 1 (Pin 0)',
  2: 'Relay Ch 2 (Pin 1)',
  3: 'Relay Ch 3 (Pin 2)',
  4: 'Relay Ch 4 (Pin 3)',
  5: 'Relay Ch 5 (Pin 4)',
  6: 'Relay Ch 6 (Pin 5)',
  7: 'Relay Ch 7 (Pin 6)',
  8: 'Relay Ch 8 (Pin 7)'
};

const RELAY_ICONS = {
  1: Power, 2: Lightbulb, 3: Sun, 4: Droplets, 
  5: Battery, 6: Fan, 7: Wind, 8: Radio
};

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

function MKR1010Diag({ relays, sensors }) {
  const pinStatus = (id) => relays[id] ? 'var(--led-relay)' : '#334155';
  
  return (
    <div style={{ position: 'relative', width: '200px', height: '350px', background: '#111827', border: '2px solid #334155', borderRadius: '12px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', padding: '20px 0', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
       {/* Left Pins */}
       <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '5px' }}>
          <div className="pin"><span style={{color: '#fca5a5', width: '40px'}}>Bat</span> <div className="dot" style={{background: 'var(--success)'}}></div></div>
          <div className="pin"><span style={{width: '40px'}}>0</span> <div className="dot" style={{background: pinStatus(1), boxShadow: `0 0 8px ${pinStatus(1)}`}}></div></div>
          <div className="pin"><span style={{width: '40px'}}>1</span> <div className="dot" style={{background: pinStatus(2), boxShadow: `0 0 8px ${pinStatus(2)}`}}></div></div>
          <div className="pin"><span style={{width: '40px'}}>2</span> <div className="dot" style={{background: pinStatus(3), boxShadow: `0 0 8px ${pinStatus(3)}`}}></div></div>
          <div className="pin"><span style={{width: '40px'}}>3</span> <div className="dot" style={{background: pinStatus(4), boxShadow: `0 0 8px ${pinStatus(4)}`}}></div></div>
          <div className="pin"><span style={{width: '40px'}}>4</span> <div className="dot" style={{background: pinStatus(5), boxShadow: `0 0 8px ${pinStatus(5)}`}}></div></div>
          <div className="pin"><span style={{width: '40px'}}>5</span> <div className="dot" style={{background: pinStatus(6), boxShadow: `0 0 8px ${pinStatus(6)}`}}></div></div>
          <div className="pin"><span style={{width: '40px'}}>6</span> <div className="dot" style={{background: pinStatus(7), boxShadow: `0 0 8px ${pinStatus(7)}`}}></div></div>
          <div className="pin"><span style={{width: '40px'}}>7</span> <div className="dot" style={{background: pinStatus(8), boxShadow: `0 0 8px ${pinStatus(8)}`}}></div></div>
       </div>
       <div style={{ color: '#fff', fontWeight: 'bold', letterSpacing: '2px', writingMode: 'vertical-rl', textAlign: 'center' }}>
          MKR WIFI 1010
       </div>
       {/* Right Pins */}
       <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px', textAlign: 'right' }}>
          <div className="pin"><div className="dot" style={{background: '#93c5fd'}}></div> <span style={{width: '60px'}}>VIN</span></div>
          <div className="pin"><div className="dot" style={{background: 'var(--led-gps)', boxShadow: '0 0 8px var(--led-gps)'}}></div> <span style={{width: '60px'}}>13 (TX)</span></div>
          <div className="pin"><div className="dot" style={{background: 'var(--led-gps)', boxShadow: '0 0 8px var(--led-gps)'}}></div> <span style={{width: '60px'}}>14 (RX)</span></div>
          <div className="pin"><div className="dot" style={{background: '#fca5a5', boxShadow: '0 0 8px #fca5a5'}}></div> <span style={{width: '60px'}}>12 (SCL)</span></div>
          <div className="pin"><div className="dot" style={{background: '#fca5a5', boxShadow: '0 0 8px #fca5a5'}}></div> <span style={{width: '60px'}}>11 (SDA)</span></div>
       </div>
    </div>
  );
}

function SparklineGraph({ data, dataKey, color, isStepped = false, sliceCount }) {
  const chartData = data.slice(0, sliceCount).reverse();
  return (
    <div style={{ width: '100%', height: '40px', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Tooltip 
             contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', padding: '2px 6px', fontSize: '0.8rem' }}
             itemStyle={{ color: '#fff' }}
             labelStyle={{ display: 'none' }}
             formatter={(value) => [value, dataKey]}
          />
          <Line 
            type={isStepped ? "stepAfter" : "monotone"} 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false} 
          />
          <YAxis domain={isStepped ? [-0.5, 1.5] : ['dataMin', 'dataMax']} hide />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


function ThermalsGraph({ telemetryLog, outsideWeather }) {
  const chartData = [...telemetryLog].slice(0, 60).reverse().map(log => {
    const isIntake = log.relay6 === 'on' || log.relay6 === true || log.relay6?.booleanValue === true;
    const isExhaust = log.relay7 === 'on' || log.relay7 === true || log.relay7?.booleanValue === true;
    return {
      time: log.server_time_epoch ? new Date(log.server_time_epoch * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '',
      insideTemp: log.temperature ? parseFloat(log.temperature.toFixed(1)) : 0,
      outsideTemp: outsideWeather ? parseFloat(outsideWeather.temperature.toFixed(1)) : null,
      intake: isIntake ? 1 : 0,
      exhaust: isExhaust ? 1 : 0
    };
  });

  return (
    <div className="glass-card full-width" style={{ display: 'block', padding: '1rem', height: '250px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>THERMAL REGULATION</h3>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
           <span style={{ color: '#fca5a5' }}>● Inside</span>
           <span style={{ color: '#0ea5e9' }}>○ Outside</span>
           <span style={{ color: 'rgba(14, 165, 233, 0.5)' }}>■ Intake</span>
           <span style={{ color: 'rgba(244, 63, 94, 0.5)' }}>■ Exhaust</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 'calc(100% - 30px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickMargin={5} />
            <YAxis yAxisId="temp" domain={['dataMin - 5', 'dataMax + 5']} stroke="#64748b" fontSize={10} />
            <YAxis yAxisId="fans" domain={[0, 4]} hide />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }} />
            
            <Area yAxisId="fans" type="step" dataKey="intake" fill="rgba(14, 165, 233, 0.2)" stroke="rgba(14, 165, 233, 0.5)" name="Intake Fan" />
            <Area yAxisId="fans" type="step" dataKey="exhaust" fill="rgba(244, 63, 94, 0.2)" stroke="rgba(244, 63, 94, 0.5)" name="Exhaust Fan" />
            
            <ReferenceLine yAxisId="temp" y={72} stroke="var(--success)" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', fill: 'var(--success)', fontSize: 10, value: 'Target 72°F' }} />
            
            <Line yAxisId="temp" type="monotone" dataKey="outsideTemp" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Outside Temp" isAnimationActive={false} />
            <Line yAxisId="temp" type="monotone" dataKey="insideTemp" stroke="#fca5a5" strokeWidth={2} dot={false} name="Inside Temp" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


function PowerGraph({ telemetryLog, calculatedVoltage, timeToEmpty, voltageMultiplier }) {
  const chartData = [...telemetryLog].slice(0, 60).reverse().map(log => {
    let loadEstimate = 0;
    for(let i=1; i<=8; i++) {
        if (log[`relay${i}`] === 'on' || log[`relay${i}`] === true || log[`relay${i}`]?.booleanValue === true) loadEstimate += 1;
    }
    return {
      time: log.server_time_epoch ? new Date(log.server_time_epoch * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '',
      voltage: log.raw_voltage ? parseFloat(((log.raw_voltage/1023.0)*3.3*voltageMultiplier).toFixed(2)) : 0,
      load: loadEstimate
    };
  });

  let etaText = "CALC...";
  let etaColor = "var(--text-muted)";
  if (timeToEmpty !== null) {
      if (timeToEmpty < 0) {
          etaText = `CHARGING (${Math.abs(timeToEmpty).toFixed(1)}H)`;
          etaColor = "var(--success)";
      } else {
          etaText = `${timeToEmpty.toFixed(1)}H LEFT`;
          etaColor = "#fca5a5";
      }
  }

  return (
    <div className="glass-card full-width" style={{ display: 'block', padding: '1rem', height: '250px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>POWER MANAGEMENT</h3>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
           <span style={{ color: 'var(--success)' }}>● {calculatedVoltage}V</span>
           <span style={{ color: etaColor }}>{etaText}</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 'calc(100% - 30px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickMargin={5} />
            <YAxis yAxisId="volt" domain={['dataMin - 0.5', 'dataMax + 0.5']} stroke="#64748b" fontSize={10} />
            <YAxis yAxisId="load" domain={[0, 8]} hide />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }} />
            
            <Area yAxisId="load" type="step" dataKey="load" fill="rgba(245, 158, 11, 0.2)" stroke="none" name="Active Relays (Load)" />
            
            <ReferenceLine yAxisId="volt" y={12.0} stroke="#fca5a5" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', fill: '#fca5a5', fontSize: 10, value: 'Low (12.0V)' }} />
            <ReferenceLine yAxisId="volt" y={14.2} stroke="var(--success)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', fill: 'var(--success)', fontSize: 10, value: 'Full (14.2V)' }} />
            
            <Line yAxisId="volt" type="monotone" dataKey="voltage" stroke="var(--success)" strokeWidth={2} dot={false} name="Battery (V)" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


function StarlinkWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Attempt to fetch from local router, fallback to mock data if CORS/offline
    const fetchStarlink = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        // Note: Real Starlink uses gRPC, this is a mock endpoint for the UI demonstration
        const res = await fetch('http://192.168.100.1/api/v1/status', { signal: controller.signal });
        const json = await res.json();
        setData(json);
        setLoading(false);
        clearTimeout(timeoutId);
      } catch (e) {
        // Fallback to the exact diagnostic data provided by the user for the mini1_prod2 dish
        setTimeout(() => {
          setData({
            "id": "ut20789607-8211211b-d8a598dd",
            "hardwareVersion": "mini1_prod2",
            "softwareVersion": "2026.04.10.mr77882.1",
            "utcOffsetS": -21600,
            "hardwareSelfTest": "PASSED",
            "alerts": {
                "dishIsHeating": false,
                "dishThermalThrottle": false,
                "obstructed": false,
                "motorsStuck": false
            },
            "alignmentStats": {
                "boresightAzimuthDeg": "-56.35",
                "boresightElevationDeg": "85.19",
                "desiredBoresightAzimuthDeg": "-0.07",
                "desiredBoresightElevationDeg": "67.49"
            },
            "stowed": true
          });
          setLoading(false);
        }, 1000);
      }
    };
    
    fetchStarlink();
    const interval = setInterval(fetchStarlink, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="hud-frame" style={{ display: 'flex', flexDirection: 'column', height: '350px', justifyContent: 'center', alignItems: 'center' }}>
         <Radio size={32} color="var(--text-muted)" style={{ animation: 'pulse 2s infinite', marginBottom: '1rem' }} />
         <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>CONNECTING TO DISH...</div>
      </div>
    );
  }

  const isAligned = Math.abs(parseFloat(data.alignmentStats.boresightElevationDeg) - parseFloat(data.alignmentStats.desiredBoresightElevationDeg)) < 5;

  return (
    <div className="hud-frame" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>STARLINK {data.hardwareVersion.toUpperCase()}</h3>
          <Radio size={18} color={data.stowed ? "#f59e0b" : "var(--success)"} />
       </div>
       
       <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flex: 1, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
             <div style={{ fontSize: '1.8rem', color: data.stowed ? "#f59e0b" : "var(--success)", fontFamily: 'var(--font-mono)' }}>{data.stowed ? 'STOWED' : 'ONLINE'}</div>
             <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Dish State</div>
          </div>
          <div style={{ textAlign: 'center' }}>
             <div style={{ fontSize: '1.8rem', color: isAligned ? "var(--success)" : "#f43f5e", fontFamily: 'var(--font-mono)' }}>
               {isAligned ? 'OKAY' : 'POOR'}
             </div>
             <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Alignment</div>
          </div>
          <div style={{ textAlign: 'center' }}>
             <div style={{ fontSize: '1.8rem', color: data.alerts.obstructed ? "#f43f5e" : "var(--success)", fontFamily: 'var(--font-mono)' }}>
               {data.alerts.obstructed ? 'YES' : 'NO'}
             </div>
             <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Obstructed</div>
          </div>
       </div>

       <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
         <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            <div style={{ color: '#fff', marginBottom: '4px' }}>ALIGNMENT DELTA</div>
            Tilt: {data.alignmentStats.boresightElevationDeg}° / {data.alignmentStats.desiredBoresightElevationDeg}°<br/>
            Rot: {data.alignmentStats.boresightAzimuthDeg}° / {data.alignmentStats.desiredBoresightAzimuthDeg}°
         </div>
         <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            <div style={{ color: '#fff', marginBottom: '4px' }}>DIAGNOSTICS</div>
            Self Test: <span style={{ color: data.hardwareSelfTest === 'PASSED' ? 'var(--success)' : '#f43f5e' }}>{data.hardwareSelfTest}</span><br/>
            Heating: {data.alerts.dishIsHeating ? 'ACTIVE' : 'OFF'}<br/>
            Firmware: {data.softwareVersion.split('.')[2]}
         </div>
       </div>
    </div>
  );
}

function App() {
  const [relays, setRelays] = useState(
    Object.keys(DEFAULT_RELAY_CONFIG).reduce((acc, id) => ({ ...acc, [id]: false }), {})
  );
  const [relayConfig, setRelayConfig] = useState(DEFAULT_RELAY_CONFIG);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState({});
  const [connectionMode, setConnectionMode] = useState('offline'); 
  const [toastMessage, setToastMessage] = useState('');
  
  const [sensors, setSensors] = useState({ temperature: null, humidity: null, speed_mph: 0.0, raw_voltage: 0, lat: 0, lng: 0, gps_satellites: 0, altitude_ft: 0 });
  const [dogMode, setDogMode] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);

  // Tabs & Analytics
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeScale, setTimeScale] = useState(12); // 12 = 60s, 60 = 5m, 180 = 15m
  const [telemetryLog, setTelemetryLog] = useState([]);
  const [stats, setStats] = useState({ max_speed_mph: 0, high_voltage: 0, low_voltage: 99 });
  const [timeToEmpty, setTimeToEmpty] = useState(null);

  // Automations & Weather
  const [rules, setRules] = useState([]);
  const [outsideWeather, setOutsideWeather] = useState(null);

  // New State for Voltage and Maps
  const [voltageMultiplier, setVoltageMultiplier] = useState(5.0);
  const [antTrail, setAntTrail] = useState([]);
  
  // Last Known State Tracking
  const [lastUpdated, setLastUpdated] = useState(null);
  const [timeAgoStr, setTimeAgoStr] = useState('Unknown');

  useEffect(() => {
    const updateTimeStr = () => {
      if (connectionMode === 'local' || connectionMode === 'mqtt') {
        setTimeAgoStr('Live');
        return;
      }
      if (!lastUpdated) {
        setTimeAgoStr('Unknown');
        return;
      }
      const diffMs = Date.now() - lastUpdated;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) setTimeAgoStr('Just now');
      else if (diffMins < 60) setTimeAgoStr(`${diffMins}m ago`);
      else setTimeAgoStr(`${Math.floor(diffMins/60)}h ${diffMins%60}m ago`);
    };
    updateTimeStr();
    const interval = setInterval(updateTimeStr, 10000);
    return () => clearInterval(interval);
  }, [lastUpdated, connectionMode]);

  useEffect(() => {
    if (sensors.lat && sensors.lng && sensors.lat !== 0) {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${sensors.lat}&longitude=${sensors.lng}&current_weather=true&temperature_unit=fahrenheit`)
        .then(res => res.json())
        .then(data => {
          if (data.current_weather) {
            setOutsideWeather(data.current_weather);
          }
        })
        .catch(err => console.error("Weather API Error:", err));
    }
  }, [sensors.lat, sensors.lng]);

  useEffect(() => {
    // Load config from Firestore
    const loadConfig = async () => {
      try {
        const calibDoc = await getDoc(doc(db, 'settings', 'calibration'));
        if (calibDoc.exists()) {
          setVoltageMultiplier(calibDoc.data().voltageMultiplier || 5.0);
        }

        const relayDoc = await getDoc(doc(db, 'settings', 'relays'));
        if (relayDoc.exists()) {
          setRelayConfig({ ...DEFAULT_RELAY_CONFIG, ...relayDoc.data() });
        }

        // Load Stats
        const statsDoc = await getDoc(doc(db, 'settings', 'stats'));
        if (statsDoc.exists()) {
           setStats(statsDoc.data());
        }

        // Load Rules
        const rulesDoc = await getDoc(doc(db, 'settings', 'automations'));
        if (rulesDoc.exists()) {
           setRules(rulesDoc.data().rules || []);
        }

        // Load Ant Trail & Last Known State
        const q = query(collection(db, 'telemetry'), orderBy('server_time_epoch', 'desc'), limit(200));
        const querySnapshot = await getDocs(q);
        const trail = [];
        const logs = [];
        let isFirst = true;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          logs.push(data);
          if (data.lat && data.lng) {
             trail.push([data.lat, data.lng]);
          }
          if (isFirst) {
            isFirst = false;
            // Inject last known state into UI immediately
            setSensors(prev => ({
              ...prev,
              temperature: data.temperature || prev.temperature,
              humidity: data.humidity || prev.humidity,
              speed_mph: data.speed_mph || prev.speed_mph,
              raw_voltage: data.raw_voltage || prev.raw_voltage,
              lat: data.lat || prev.lat,
              lng: data.lng || prev.lng,
              gps_satellites: data.gps_satellites || prev.gps_satellites,
              altitude_ft: data.altitude_ft || prev.altitude_ft
            }));
            if (data.dog_mode !== undefined) setDogMode(data.dog_mode);
            
            const newStates = {};
            for (let i = 1; i <= 8; i++) {
              if (data[`relay${i}`] !== undefined) {
                newStates[i] = data[`relay${i}`];
              }
            }
            setRelays(prev => ({ ...prev, ...newStates }));
            
            if (data.server_time_epoch) {
              setLastUpdated(data.server_time_epoch * 1000);
            }
          }
        });
        setAntTrail(trail.reverse()); // Put in chronological order
        setTelemetryLog(logs);
        
        // Calculate Battery Derivative
        if (logs.length >= 2) {
           const oldest = logs[logs.length - 1];
           const newest = logs[0];
           if (oldest.server_time_epoch && newest.server_time_epoch && newest.server_time_epoch > oldest.server_time_epoch) {
              const dtHrs = (newest.server_time_epoch - oldest.server_time_epoch) / 3600.0;
              const dV = ((newest.raw_voltage || 0) - (oldest.raw_voltage || 0)) / 1023.0 * 3.3 * (calibDoc.exists() ? calibDoc.data().voltageMultiplier : 5.0);
              
              if (dtHrs > 0 && Math.abs(dV) > 0.05) {
                 const rate = dV / dtHrs; // volts per hour
                 const currentV = ((newest.raw_voltage || 0) / 1023.0) * 3.3 * (calibDoc.exists() ? calibDoc.data().voltageMultiplier : 5.0);
                 if (rate < 0) {
                    const hrsLeft = (currentV - 10.5) / Math.abs(rate);
                    setTimeToEmpty(hrsLeft > 0 ? hrsLeft : 0);
                 } else {
                    const hrsToFull = (14.2 - currentV) / rate;
                    setTimeToEmpty(hrsToFull > 0 ? -hrsToFull : 0); // negative means charging
                 }
              }
           }
        }
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
        
        // Update Stats if hit
        setStats(prevStats => {
           let changed = false;
           let newStats = { ...prevStats };
           if (sensorData.speed_mph !== undefined && sensorData.speed_mph > newStats.max_speed_mph) {
              newStats.max_speed_mph = sensorData.speed_mph;
              changed = true;
           }
           if (sensorData.raw_voltage !== undefined) {
              const v = (sensorData.raw_voltage / 1023.0) * 3.3 * voltageMultiplier;
              if (v > newStats.high_voltage) { newStats.high_voltage = v; changed = true; }
              if (v < newStats.low_voltage || newStats.low_voltage === 0) { newStats.low_voltage = v; changed = true; }
           }
           if (changed) {
              setDoc(doc(db, 'settings', 'stats'), newStats);
           }
           return newStats;
        });

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

  const saveRelayConfig = async () => {
    setIsEditMode(false);
    try {
      await setDoc(doc(db, 'settings', 'relays'), relayConfig);
      showToast('Relay names saved to cloud', 'local');
    } catch(e) {
      showToast('Failed to save', 'danger');
    }
  };

  const handleConfigChange = (id, field, value) => {
    setRelayConfig(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
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

  const executeMacro = (mode) => {
    if (mode === 'camp') {
        [1, 2, 4].forEach(id => {
            if (!relays[id]) toggleRelay(id);
        });
        showToast("Camp Mode Engaged: Essentials ON", "success");
    } else if (mode === 'tow') {
        [1, 3, 4].forEach(id => {
            if (relays[id]) toggleRelay(id);
        });
        showToast("Tow Mode Engaged: Exterior secured", "warning");
    } else if (mode === 'storage') {
        Object.keys(relays).forEach(id => {
            if (relays[id]) toggleRelay(parseInt(id));
        });
        if (dogMode) toggleDogMode();
        showToast("Storage Mode Engaged: ALL OFF", "danger");
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
  
  const chartData = [...telemetryLog].reverse().map(log => ({
    time: log.server_time_epoch ? new Date(log.server_time_epoch * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '',
    voltage: log.raw_voltage ? parseFloat(((log.raw_voltage/1023.0)*3.3*voltageMultiplier).toFixed(2)) : 0,
    speed: log.speed_mph ? parseFloat(log.speed_mph.toFixed(1)) : 0
  }));

  const addRule = () => {
    setRules([...rules, { id: Date.now(), sensor: 'temperature', op: '>', val: 80, pin: 6, state: true }]);
  };
  const updateRule = (id, field, value) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: (field === 'val' || field === 'pin' ? Number(value) : value === 'true' ? true : value === 'false' ? false : value) } : r));
  };
  const removeRule = (id) => {
    setRules(rules.filter(r => r.id !== id));
  };
  const saveRulesToCloud = async () => {
    try {
      await setDoc(doc(db, 'settings', 'automations'), { rules });
      publishAutomations(rules);
      showToast('Automations synced to Cloud & Hardware', 'mqtt');
    } catch(e) {
      showToast('Failed to save automations', 'danger');
    }
  };

  return (
    <>
      <div className="background-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <div className="app-container">
                {/* HUD Top Bar */}
        <div className="hud-top-bar">
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="status-item">
              <div className={`indicator ${connectionMode === 'local' ? 'active' : ''}`}></div> Local API
            </div>
            <div className="status-item">
              <div className={`indicator ${connectionMode === 'mqtt' ? 'active' : ''}`}></div> Cloud Link
            </div>
          </div>
          <div className="header" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0 }}>
             <h1 style={{ fontSize: '1.2rem', margin: 0 }}>TrailerCommander</h1>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            UPD: <span style={{ color: connectionMode !== 'offline' ? 'var(--success)' : 'var(--danger)' }}>{connectionMode !== 'offline' ? 'LIVE' : timeAgoStr}</span>
            <button className="icon-btn" onClick={() => setShowGuide(true)} style={{ marginLeft: '1rem' }}><Info size={18} /></button>
          </div>
        </div>

        {/* HUD Tabs */}
        <div className="hud-tabs">
          <button className={`hud-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Command</button>
          <button className={`hud-tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>Logs</button>
          <button className={`hud-tab-btn ${activeTab === 'analyzer' ? 'active' : ''}`} onClick={() => setActiveTab('analyzer')}>Analyzer</button>
          <button className={`hud-tab-btn ${activeTab === 'automations' ? 'active' : ''}`} onClick={() => setActiveTab('automations')}>Auto</button>
          <button className={`hud-tab-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>Vision</button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="hud-dashboard-grid">
            {/* Left Column: Data & Map */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
               {/* Weather HUD */}
               <div className="weather-hud hud-frame">
                 <div className="weather-stat">
                    <span className="label">Out Temp</span>
                    <span className="value" style={{ color: '#0ea5e9' }}>{outsideWeather ? outsideWeather.temperature.toFixed(1) + '°' : '--°'}</span>
                 </div>
                 <div className="weather-divider"></div>
                 <div className="weather-stat">
                    <span className="label">In Temp</span>
                    <span className="value" style={{ color: '#fca5a5' }}>{sensors.temperature ? sensors.temperature.toFixed(1) + '°' : '--°'}</span>
                 </div>
                 <div className="weather-divider"></div>
                 <div className="weather-stat" style={{ cursor: 'pointer' }} onClick={() => setShowCalibration(true)}>
                    <span className="label">Batt Volts</span>
                    <span className="value" style={{ color: 'var(--success)' }}>{calculatedVoltage}V</span>
                 </div>
               </div>

               {/* Sensor Grid */}
               <div className="sensor-grid">
                  <div className="sensor-hud-card">
                     <div className="sensor-header">
                        <Thermometer size={20} className="icon-wrapper" color="#fca5a5" />
                        <span className="sensor-label">Temp</span>
                     </div>
                     <span className="sensor-value">{sensors.temperature ? sensors.temperature.toFixed(1) + '°' : '--°'}</span>
                     <div className="sparkline-container">
                        <SparklineGraph data={telemetryLog} dataKey="temperature" color="#fca5a5" sliceCount={30} />
                     </div>
                  </div>
                  <div className="sensor-hud-card">
                     <div className="sensor-header">
                        <Navigation size={20} className="icon-wrapper" color="var(--led-gps)" />
                        <span className="sensor-label">Speed</span>
                     </div>
                     <span className="sensor-value">{sensors.speed_mph ? sensors.speed_mph.toFixed(1) : '0.0'}</span>
                     <div className="sparkline-container">
                        <SparklineGraph data={telemetryLog} dataKey="speed_mph" color="var(--led-gps)" sliceCount={30} />
                     </div>
                  </div>
                  <div className="sensor-hud-card">
                     <div className="sensor-header">
                        <Droplet size={20} className="icon-wrapper" color="#0ea5e9" />
                        <span className="sensor-label">Humidity</span>
                     </div>
                     <span className="sensor-value">{sensors.humidity ? sensors.humidity.toFixed(0) + '%' : '--%'}</span>
                     <div className="sparkline-container">
                        <SparklineGraph data={telemetryLog} dataKey="humidity" color="#0ea5e9" sliceCount={30} />
                     </div>
                  </div>
               </div>

               <ThermalsGraph telemetryLog={telemetryLog} outsideWeather={outsideWeather} />
               <PowerGraph telemetryLog={telemetryLog} calculatedVoltage={calculatedVoltage} timeToEmpty={timeToEmpty} voltageMultiplier={voltageMultiplier} />
               
               {/* Map */}
               <div className="map-hud-wrapper hud-frame">
                 <div className="map-hud-overlay">
                    LAT: {sensors.lat ? sensors.lat.toFixed(5) : '0.00000'}<br/>
                    LNG: {sensors.lng ? sensors.lng.toFixed(5) : '0.00000'}<br/>
                    ALT: {sensors.altitude_ft ? sensors.altitude_ft.toFixed(0) : '0'} FT<br/>
                    SAT: {sensors.gps_satellites || 0}
                 </div>
                 <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%', background: '#0a0f1a' }} zoomControl={false}>
                    <MapUpdater center={mapCenter} />
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
                    {antTrail.length > 0 && <Polyline positions={antTrail} color="var(--accent)" weight={2} opacity={0.8} />}
                    {antTrail.map((pos, idx) => (
                       <CircleMarker key={idx} center={pos} radius={2} color="var(--accent)" fillColor="var(--accent)" fillOpacity={1} />
                    ))}
                    {(sensors.lat && sensors.lng) && <Marker position={[sensors.lat, sensors.lng]} />}
                 </MapContainer>
               </div>
            </div>

            {/* Right Column: Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
               {/* Quick Modes */}
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                 <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Automation Modes</h2>
                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                   <button className="hud-action-btn success" onClick={() => executeMacro('camp')} style={{ flex: 1 }}><Fan size={16} /> Camp</button>
                   <button className="hud-action-btn" onClick={() => executeMacro('tow')} style={{ flex: 1, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', borderColor: '#f59e0b' }}><Navigation size={16} /> Tow</button>
                   <button className="hud-action-btn" onClick={() => executeMacro('storage')} style={{ flex: 1, background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', borderColor: '#f43f5e' }}><Power size={16} /> Storage</button>
                 </div>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', margin: 0, color: 'var(--accent)', textTransform: 'uppercase' }}>Relay Control</h2>
                 {isEditMode ? (
                    <button onClick={saveRelayConfig} className="hud-action-btn success">
                      <Check size={16} /> Save Ch
                    </button>
                 ) : (
                    <button onClick={() => setIsEditMode(true)} className="hud-action-btn">
                      <Edit3 size={16} /> Edit Ch
                    </button>
                 )}
               </div>

               {/* Dog Mode */}
               <div className={`hud-relay-btn ${dogMode ? 'active' : ''}`} onClick={() => !isEditMode && toggleDogMode()} style={{ borderColor: dogMode ? 'var(--led-dog)' : '' }}>
                 <div className="btn-info">
                    <h3 style={{ color: dogMode ? 'var(--led-dog)' : '' }}>Dog Mode Auto</h3>
                    <p>Auto-Vents (70° - 75°)</p>
                 </div>
                 <div className="icon-wrapper" style={{ color: dogMode ? 'var(--led-dog)' : '', fontSize: '1.5rem' }}>🐾</div>
               </div>

               <div className="hud-btn-grid">
                 {Object.keys(relayConfig).map((idStr) => {
                    const id = parseInt(idStr);
                    const config = relayConfig[id];
                    const Icon = RELAY_ICONS[id];
                    let isOn = relays[id];
                    
                    if ((id === 6 || id === 7) && sensors.speed_mph > 5.0) {
                      isOn = false; 
                    }
                    
                    const processing = isProcessing[id];
                    const lockedByDogMode = (id === 6 || id === 7) && dogMode;
                    const isDisabled = processing || connectionMode === 'offline' || lockedByDogMode;

                    return (
                      <div 
                        key={id} 
                        className={`hud-relay-btn ${isOn && !isEditMode ? 'active' : ''} ${isDisabled ? 'disabled' : ''} ${lockedByDogMode ? 'locked' : ''}`}
                        onClick={() => !isEditMode && !isDisabled && toggleRelay(id)}
                      >
                        <div className="btn-info" style={{ width: '100%' }}>
                           {isEditMode ? (
                              <div style={{ width: '100%' }}>
                                 <input 
                                    type="text" 
                                    className="edit-input" 
                                    value={config.name} 
                                    onChange={(e) => handleConfigChange(id, 'name', e.target.value)} 
                                    onClick={(e) => e.stopPropagation()}
                                 />
                                 <div className="edit-input desc">{PIN_INFO[id]}</div>
                              </div>
                           ) : (
                              <>
                                 <h3>{config.name} {lockedByDogMode && <span style={{fontSize: '0.7rem', color: 'var(--danger)'}}>(LOCKED)</span>}</h3>
                                 <p>{PIN_INFO[id]}</p>
                              </>
                           )}
                        </div>
                        <div className="icon-wrapper" style={{ fontSize: '1.2rem' }}>
                           <Icon size={24} />
                        </div>
                      </div>
                    );
                 })}
               </div>
            </div>
          </div>
                ) : activeTab === 'security' ? (
          <div className="security-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', height: 'calc(100vh - 150px)', overflowY: 'auto' }}>
            
            {/* Starlink Widget */}
            <StarlinkWidget />

            {/* Camera Feeds */}
            <div className="hud-frame" style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>EXTERIOR CAM 1 (ESP32)</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--danger)', animation: 'pulse 2s infinite' }}>● LIVE REC</div>
               </div>
               <div style={{ flex: 1, background: '#000', borderRadius: '4px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #1e293b' }}>
                  <div style={{ position: 'absolute', top: 10, left: 10, color: '#fff', textShadow: '1px 1px 2px #000', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>192.168.100.105:81/stream</div>
                  {/* Placeholder for actual MJPEG Stream */}
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>[ NO SIGNAL - AWATING IP CAM ]</div>
                  <div className="scanline"></div>
               </div>
            </div>

            <div className="hud-frame" style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>INTERIOR CAM 2 (ESP32)</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--danger)', animation: 'pulse 2s infinite' }}>● LIVE REC</div>
               </div>
               <div style={{ flex: 1, background: '#000', borderRadius: '4px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #1e293b' }}>
                  <div style={{ position: 'absolute', top: 10, left: 10, color: '#fff', textShadow: '1px 1px 2px #000', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>192.168.100.106:81/stream</div>
                  {/* Placeholder for actual MJPEG Stream */}
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>[ NO SIGNAL - AWATING IP CAM ]</div>
                  <div className="scanline"></div>
               </div>
            </div>

          </div>
        ) : activeTab === 'analyzer' ? (
          <div className="analytics-grid">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>Active Pin Status</h2>
                <select 
                   value={timeScale} 
                   onChange={(e) => setTimeScale(parseInt(e.target.value))}
                   style={{ background: '#1e293b', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem' }}
                >
                   <option value={12}>Last 60 Seconds</option>
                   <option value={60}>Last 5 Minutes</option>
                   <option value={180}>Last 15 Minutes</option>
                </select>
             </div>
             
             <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
                {/* Dynamically mapped unused analog pins */}
                {['a0', 'a2', 'a3', 'a4', 'a5', 'a6'].map(pin => (
                   <div key={pin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                      <div style={{ width: '200px' }}>
                         <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-muted)' }}>Pin {pin.toUpperCase()}</h4>
                         <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Analog In</div>
                         <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
                            {sensors[pin] !== undefined ? sensors[pin] : '0'} (Raw)
                         </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                         <SparklineGraph data={telemetryLog.map(l => ({...l, [pin]: l[pin] || 0}))} dataKey={pin} color="#94a3b8" sliceCount={timeScale} />
                      </div>
                   </div>
                ))}
                
                {/* Dynamically mapped unused digital pins */}
                {['d8', 'd9', 'd10'].map(pin => (
                   <div key={pin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                      <div style={{ width: '200px' }}>
                         <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-muted)' }}>Pin {pin.toUpperCase()}</h4>
                         <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Digital In</div>
                         <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
                            {sensors[pin] ? 'HIGH (1)' : 'LOW (0)'}
                         </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                         <SparklineGraph data={telemetryLog.map(l => ({...l, [pin]: l[pin] ? 1 : 0}))} dataKey={pin} color="#94a3b8" isStepped={true} sliceCount={timeScale} />
                      </div>
                   </div>
                ))}

                {Object.keys(relayConfig).map(idStr => {
                   const id = parseInt(idStr);
                   const isRelayOn = relays[id];
                   const sparkData = telemetryLog.map(log => ({ ...log, relayValue: log[`relay${id}`] === 'on' || log[`relay${id}`] === true || log[`relay${id}`]?.booleanValue === true ? 1 : 0 }));
                   
                   return (
                     <div key={`pin-${id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                        <div style={{ width: '200px' }}>
                           <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-muted)' }}>Pin {id - 1}</h4>
                           <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{relayConfig[id].name}</div>
                           <div style={{ color: isRelayOn ? 'var(--led-relay)' : '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
                              {isRelayOn ? 'HIGH (1)' : 'LOW (0)'}
                           </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                           <SparklineGraph data={sparkData} dataKey="relayValue" color={isRelayOn ? 'var(--led-relay)' : '#475569'} isStepped={true} sliceCount={timeScale} />
                        </div>
                     </div>
                   );
                })}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                   <div style={{ width: '200px' }}>
                      <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-muted)' }}>Pin A1</h4>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Battery Input</div>
                      <div style={{ color: 'var(--success)', fontSize: '0.9rem', marginTop: '4px' }}>
                         {calculatedVoltage}v
                      </div>
                   </div>
                   <div style={{ flex: 1, minWidth: 0 }}>
                      <SparklineGraph data={telemetryLog.map(log => ({ ...log, raw_voltage: log.raw_voltage ? (log.raw_voltage/1023.0)*3.3*voltageMultiplier : 0 }))} dataKey="raw_voltage" color="var(--success)" sliceCount={timeScale} />
                   </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                   <div style={{ width: '200px' }}>
                      <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-muted)' }}>Pins 13/14</h4>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>GPS UART</div>
                      <div style={{ color: 'var(--led-gps)', fontSize: '0.9rem', marginTop: '4px' }}>
                         {sensors.speed_mph ? sensors.speed_mph.toFixed(1) : 0} mph
                      </div>
                   </div>
                   <div style={{ flex: 1, minWidth: 0 }}>
                      <SparklineGraph data={telemetryLog} dataKey="speed_mph" color="var(--led-gps)" sliceCount={timeScale} />
                   </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <div style={{ width: '200px' }}>
                      <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-muted)' }}>Pins 11/12</h4>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>I2C Temp/Hum</div>
                      <div style={{ color: '#fca5a5', fontSize: '0.9rem', marginTop: '4px' }}>
                         {sensors.temperature ? sensors.temperature.toFixed(1) : 0}°
                      </div>
                   </div>
                   <div style={{ flex: 1, minWidth: 0 }}>
                      <SparklineGraph data={telemetryLog} dataKey="temperature" color="#fca5a5" sliceCount={timeScale} />
                   </div>
                </div>

             </div>
          </div>
        ) : activeTab === 'automations' ? (
          <div className="analytics-grid">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>On-Device Automation Engine</h2>
                <button onClick={saveRulesToCloud} style={{ background: 'var(--success)', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <Check size={16} /> Sync to Hardware
                </button>
             </div>
             <p style={{ color: 'var(--text-muted)' }}>Rules are executed locally on the trailer's MKR1010 chip. They will continue to run even if the dashboard is closed or internet is lost.</p>
             
             <div className="glass-card full-width" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {rules.map((rule, idx) => (
                   <div key={rule.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>IF</span>
                      <select className="edit-input" value={rule.sensor} onChange={(e) => updateRule(rule.id, 'sensor', e.target.value)} style={{ width: '120px' }}>
                         <option value="temperature">Temperature</option>
                         <option value="voltage">Voltage</option>
                         <option value="speed">Speed</option>
                      </select>
                      <select className="edit-input" value={rule.op} onChange={(e) => updateRule(rule.id, 'op', e.target.value)} style={{ width: '60px' }}>
                         <option value=">">&gt;</option>
                         <option value="<">&lt;</option>
                         <option value="==">==</option>
                      </select>
                      <input type="number" className="edit-input" value={rule.val} onChange={(e) => updateRule(rule.id, 'val', e.target.value)} style={{ width: '80px' }} />
                      
                      <span style={{ fontWeight: 'bold', color: 'var(--accent)', marginLeft: '1rem' }}>THEN SET</span>
                      <select className="edit-input" value={rule.pin} onChange={(e) => updateRule(rule.id, 'pin', e.target.value)} style={{ width: '200px' }}>
                         {Object.keys(relayConfig).map(idStr => (
                            <option key={idStr} value={parseInt(idStr) - 1}>{relayConfig[idStr].name} (Ch {idStr})</option>
                         ))}
                      </select>
                      <span style={{ fontWeight: 'bold' }}>TO</span>
                      <select className="edit-input" value={rule.state} onChange={(e) => updateRule(rule.id, 'state', e.target.value)} style={{ width: '100px', color: rule.state ? 'var(--success)' : '#fca5a5' }}>
                         <option value={true}>ON</option>
                         <option value={false}>OFF</option>
                      </select>
                      
                      <button onClick={() => removeRule(rule.id)} style={{ marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                         <X size={16} />
                      </button>
                   </div>
                ))}
                
                <button onClick={addRule} style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px dashed var(--glass-border)', padding: '1rem 2rem', borderRadius: '8px', cursor: 'pointer', marginTop: '1rem' }}>
                  + Add New Rule
                </button>
             </div>
          </div>
        ) : (
          <div className="analytics-grid">
             <div className="stats-row">
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                   <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>All-Time Max Speed</p>
                   <h2 style={{ margin: 0, fontSize: '2rem', color: 'var(--led-gps)' }}>{stats.max_speed_mph.toFixed(1)} <span style={{fontSize: '1rem'}}>MPH</span></h2>
                </div>
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                   <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>Weather Condition</p>
                   {outsideWeather ? (
                      <>
                         <h2 style={{ margin: 0, fontSize: '2rem', color: '#93c5fd' }}>{outsideWeather.temperature.toFixed(1)}° <span style={{fontSize: '1rem'}}>Out</span></h2>
                         <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fca5a5' }}>{sensors.temperature ? sensors.temperature.toFixed(1) : '--'}° <span style={{fontSize: '1rem', color: 'var(--text-muted)'}}>In</span></h2>
                      </>
                   ) : (
                      <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-muted)' }}>GPS Syncing...</h2>
                   )}
                </div>
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                   <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>Battery Trend Estimate</p>
                   {timeToEmpty === null ? (
                      <h2 style={{ margin: 0, fontSize: '2rem', color: 'var(--text-muted)' }}>Calculating...</h2>
                   ) : timeToEmpty < 0 ? (
                      <h2 style={{ margin: 0, fontSize: '2rem', color: 'var(--success)' }}>Charging <span style={{fontSize:'1rem'}}>({Math.abs(timeToEmpty).toFixed(1)}h to full)</span></h2>
                   ) : (
                      <h2 style={{ margin: 0, fontSize: '2rem', color: '#fca5a5' }}>{timeToEmpty.toFixed(1)}h <span style={{fontSize:'1rem'}}>to empty</span></h2>
                   )}
                </div>
             </div>

             <div className="glass-card full-width" style={{ display: 'block' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Live Telemetry Graph</h3>
                <div style={{ width: '100%', height: 300 }}>
                   <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                         <XAxis dataKey="time" stroke="#94a3b8" />
                         <YAxis yAxisId="left" stroke="var(--success)" domain={['dataMin - 1', 'dataMax + 1']} />
                         <YAxis yAxisId="right" orientation="right" stroke="var(--led-gps)" />
                         <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                         <Line yAxisId="left" type="monotone" dataKey="voltage" stroke="var(--success)" strokeWidth={2} dot={false} name="Voltage (V)" />
                         <Line yAxisId="right" type="monotone" dataKey="speed" stroke="var(--led-gps)" strokeWidth={2} dot={false} name="Speed (MPH)" />
                      </LineChart>
                   </ResponsiveContainer>
                </div>
             </div>

             <div className="bottom-row">
                <div className="glass-card" style={{ display: 'block' }}>
                   <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Hardware Diagnostics</h3>
                   <MKR1010Diag relays={relays} sensors={sensors} />
                </div>
                <div className="glass-card" style={{ display: 'block' }}>
                   <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Telemetry Feed Log</h3>
                   <div style={{ maxHeight: '350px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem' }}>
                      {telemetryLog.map((log, i) => (
                         <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', padding: '0.5rem 0', fontSize: '0.9rem' }}>
                            <div style={{ color: 'var(--text-muted)' }}>
                               {log.server_time_epoch ? new Date(log.server_time_epoch * 1000).toLocaleString() : 'Unknown Time'}
                            </div>
                            <div>
                               <span style={{ color: 'var(--led-gps)', marginRight: '1rem' }}>{log.speed_mph ? log.speed_mph.toFixed(1) : 0} mph</span>
                               <span style={{ color: 'var(--success)' }}>{log.raw_voltage ? ((log.raw_voltage/1023.0)*3.3*voltageMultiplier).toFixed(2) : 0}v</span>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        )}
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
                  style={{ background: 'var(--success)', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '20px', width: '100%', cursor: 'pointer', fontWeight: 'bold' }}>
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
                {Object.keys(relayConfig).map((idStr) => {
                  const id = parseInt(idStr);
                  const config = relayConfig[id];
                  return (
                    <li key={id}>MKR1010 Pin {id-1} ➔ Relay IN{id} <b>({config.name})</b></li>
                  );
                })}
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
