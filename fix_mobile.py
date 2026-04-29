import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app = f.read()

app = app.replace(
    "<div style={{ display: 'flex', gap: '2rem', width: '100%' }}>",
    '<div className="weather-hud-inner">'
)
app = app.replace(
    "<div style={{ display: 'flex', gap: '0.5rem' }}>\n                   <button className=\"hud-action-btn success\"",
    '<div className="automation-modes-grid">\n                   <button className="hud-action-btn success"'
)
app = app.replace(
    "<div style={{ display: 'flex', gap: '1rem' }}>\n            <div className=\"status-item\">",
    '<div className="top-bar-indicators">\n            <div className="status-item">'
)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app)


with open('src/index.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Find the start of the mobile query and slice it off
mobile_idx = css.find('/* Mobile adjustments */')
if mobile_idx != -1:
    css = css[:mobile_idx]

# Append the robust mobile fixes
robust_css = """
/* Mobile & Layout Classes */
.weather-hud-inner {
  display: flex;
  gap: 1rem;
  width: 100%;
  justify-content: space-between;
  flex-wrap: wrap;
}
.automation-modes-grid {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.automation-modes-grid > button {
  flex: 1 1 auto;
  min-width: 100px;
  justify-content: center;
}
.top-bar-indicators {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Mobile adjustments */
@media (max-width: 767px) {
  body { 
    height: auto; 
    overflow-y: auto; 
    overflow-x: hidden; /* Prevent horizontal scroll */
  }
  
  .app-container { 
    height: auto; 
    max-height: none; 
    overflow: visible; 
    padding: 0.5rem; 
    max-width: 100vw;
  }
  
  .hud-dashboard-grid { 
    grid-template-columns: 100%; 
    height: auto; 
    gap: 1rem;
  }
  
  .hud-dashboard-grid > div { 
    width: 100%; 
    max-width: 100%; 
    overflow: hidden; 
  }
  
  .hud-dashboard-grid > div:last-child { 
    overflow: visible; 
    padding-right: 0;
  }

  .hud-btn-grid { 
    grid-template-columns: 1fr; /* 1 column on very small screens */
    gap: 0.5rem;
  }
  @media (min-width: 450px) {
    .hud-btn-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  
  .hud-top-bar { 
    flex-direction: column; 
    gap: 0.5rem; 
    align-items: flex-start; 
    position: relative; 
    width: 100%;
  }
  
  .hud-top-bar .header { 
    position: static; 
    transform: none; 
  }

  .hud-tabs { 
    overflow-x: auto; 
    white-space: nowrap; 
    padding-bottom: 8px; 
    justify-content: flex-start; 
    width: 100%; 
    -webkit-overflow-scrolling: touch;
  }
  
  .hud-tab-btn {
    flex: 0 0 auto;
  }

  .weather-stats { 
    flex-wrap: wrap; 
    gap: 1rem; 
  }
  
  .weather-stat { 
    min-width: 45%; 
    align-items: flex-start !important;
  }

  .weather-divider {
    display: none; /* Hide dividers on mobile to save space */
  }

  .security-grid { 
    grid-template-columns: 100% !important; 
    height: auto !important; 
    overflow: visible !important; 
  }

  /* Make sure charts shrink correctly */
  .recharts-responsive-container {
    max-width: 100%;
  }
  
  /* Scale down map wrapper */
  .map-hud-wrapper {
    height: 300px !important;
  }
}
"""

with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(css + robust_css)

print("Mobile scaling fixed")
