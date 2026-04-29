with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app = f.read()

# Replace inline style for header
app = app.replace(
    '<div className="header" style={{ position: \'absolute\', left: \'50%\', transform: \'translateX(-50%)\', margin: 0 }}>',
    '<div className="header">'
)

# Replace inline style for automation modes container
app = app.replace(
    '<div style={{ display: \'flex\', gap: \'0.5rem\' }}>\n                   <button className="hud-action-btn success"',
    '<div className="automation-modes-grid">\n                   <button className="hud-action-btn success"'
)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app)

print("App.jsx inline styles fixed")
