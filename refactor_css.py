import re

with open('src/index.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Slice off everything after "/* Responsive Full-Screen HUD Modifications */"
cutoff = css.find("/* Responsive Full-Screen HUD Modifications */")
if cutoff != -1:
    css = css[:cutoff]

# Now we need to modify the base classes in the first half of CSS to be mobile-first.
# We will use regex or simple string replacements to patch the base classes.

# 1. Body
css = re.sub(r'body \{[\s\S]*?\}', '''body {
  font-family: var(--font-main);
  background: var(--bg-dark);
  background-image: 
    linear-gradient(rgba(14, 165, 233, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  color: var(--text-main);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-x: hidden;
  overflow-y: auto;
}''', css, count=1)

# 2. app-container
css = re.sub(r'\.app-container \{[\s\S]*?\}', '''.app-container {
  width: 100%;
  max-width: 100vw;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0 auto;
}''', css)

# 3. hud-dashboard-grid
css = re.sub(r'\.hud-dashboard-grid \{[\s\S]*?\}', '''.hud-dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}''', css)

# 4. hud-top-bar
css = re.sub(r'\.hud-top-bar \{[\s\S]*?\}', '''.hud-top-bar {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 4px;
  position: relative;
  width: 100%;
}''', css)

# 5. header
css = re.sub(r'\.header \{[\s\S]*?\}', '''.header {
  text-align: left;
  margin-bottom: 0;
}''', css)

# 6. hud-tabs
css = re.sub(r'\.hud-tabs \{[\s\S]*?\}', '''.hud-tabs {
  display: flex;
  gap: 1rem;
  border-bottom: 1px solid rgba(14, 165, 233, 0.2);
  padding-bottom: 8px;
  margin-bottom: 1rem;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
  width: 100%;
}''', css)

# 7. weather-hud
css = re.sub(r'\.weather-hud \{[\s\S]*?\}', '''.weather-hud {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(14, 165, 233, 0.3);
  border-radius: 4px;
}''', css)

# 8. weather-stat
css = re.sub(r'\.weather-stat \{[\s\S]*?\}', '''.weather-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 45%;
}''', css)

# 9. weather-divider
css = re.sub(r'\.weather-divider \{[\s\S]*?\}', '''.weather-divider {
  display: none;
}''', css)


# Append Media Queries
media_queries = """
/* Responsive Breakpoints (Mobile First) */

/* TABLET */
@media (min-width: 768px) {
  .app-container {
    padding: 1rem;
    gap: 1.5rem;
  }
  
  .hud-dashboard-grid {
    grid-template-columns: 1fr 1fr;
  }
  
  .hud-btn-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .hud-top-bar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  
  .hud-top-bar .header {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
  }
  
  .weather-hud {
    flex-wrap: nowrap;
    justify-content: space-around;
    align-items: center;
  }
  
  .weather-stat {
    min-width: auto;
    align-items: center;
  }
  
  .weather-divider {
    display: block;
  }
}

/* DESKTOP (Zero Scroll HUD) */
@media (min-width: 1024px) {
  body {
    height: 100vh;
    overflow: hidden;
    align-items: stretch;
  }
  
  .app-container {
    height: 100vh;
    max-height: 100vh;
    overflow: hidden;
    padding: 1rem;
    max-width: 1600px;
  }
  
  .hud-dashboard-grid {
    grid-template-columns: 3fr 2fr;
    height: calc(100vh - 150px);
    overflow: hidden;
  }
  
  .hud-dashboard-grid > div:first-child {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .map-hud-wrapper {
    flex: 1 1 auto;
    height: auto;
    min-height: 0;
  }
  
  .hud-dashboard-grid > div:last-child {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    padding-right: 10px;
  }
  
  .hud-relay-btn {
    padding: 0.75rem 1rem;
  }
}

/* ULTRAWIDE / 4K */
@media (min-width: 1920px) {
  .app-container {
    max-width: 2400px;
    padding: 2rem;
  }
  
  .header h1 {
    font-size: 2.5rem;
  }
  
  .glass-card {
    padding: 2rem;
  }
}
"""

with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(css + media_queries)

print("CSS rewritten to mobile-first successfully.")
