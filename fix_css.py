with open('src/index.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Find the start of the mobile query and slice it off
mobile_idx = css.find('/* Mobile & Layout Classes */')
if mobile_idx == -1:
    mobile_idx = css.find('/* Mobile adjustments */')

if mobile_idx != -1:
    css = css[:mobile_idx]

robust_css = """
/* Mobile adjustments */
@media (max-width: 767px) {
  body { 
    height: auto; 
    overflow-y: auto; 
    overflow-x: hidden; 
  }
  
  .app-container { 
    height: auto !important; 
    max-height: none !important; 
    overflow: visible !important; 
    padding: 0.5rem !important; 
    max-width: 100vw;
  }
  
  .hud-dashboard-grid { 
    grid-template-columns: 100% !important; 
    height: auto !important; 
    gap: 1.5rem !important;
  }
  
  .hud-dashboard-grid > div { 
    width: 100% !important; 
    max-width: 100% !important; 
    overflow: visible !important; 
  }

  .hud-btn-grid { 
    grid-template-columns: 1fr !important; 
    gap: 0.5rem !important;
  }
  @media (min-width: 450px) {
    .hud-btn-grid {
      grid-template-columns: 1fr 1fr !important;
    }
  }
  
  .hud-top-bar { 
    flex-direction: column !important; 
    gap: 1rem !important; 
    align-items: flex-start !important; 
    position: relative !important; 
    width: 100% !important;
  }
  
  .hud-top-bar .header { 
    position: static !important; 
    transform: none !important; 
    margin: 0 !important;
    text-align: left !important;
  }

  .hud-tabs { 
    overflow-x: auto !important; 
    white-space: nowrap !important; 
    padding-bottom: 8px !important; 
    justify-content: flex-start !important; 
    width: 100% !important; 
  }
  
  .weather-hud {
    flex-wrap: wrap !important;
    gap: 1rem !important;
    justify-content: flex-start !important;
  }

  .weather-stat { 
    min-width: 45% !important; 
    align-items: flex-start !important;
  }

  .weather-divider {
    display: none !important; 
  }

  .security-grid { 
    grid-template-columns: 100% !important; 
    height: auto !important; 
    overflow: visible !important; 
  }
  
  .map-hud-wrapper {
    height: 300px !important;
  }
  
  .top-bar-indicators {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
}
"""

with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(css + robust_css)

print("CSS updated with !important overrides for mobile")
