# AccessTwin ♿🏢
**Dynamic Indoor Accessibility Intelligence & Digital Twin Platform**

AccessTwin is a facility-specific indoor navigation digital twin designed to solve accessibility barriers in real-time. Unlike static floor plans or generic maps, AccessTwin bridges live physical infrastructure state (elevators, ramps, corridors) with personalized mobility requirements.

---

## 🌟 Key Features

1. **Multi-Route Facility Graph (GeoJSON)**:
   - Covers multiple entrances (Main Entrance, Side Entrance), dual accessible ramps (Ramp A, Ramp B), elevator cores (Elevator 1, Elevator 2), and central stairs across Ground and 1st floors.
   - 5 key upper-floor destination suites: Computer Lab 101, Central Library, Lecture Hall A, Admin Office, and Accessible Restroom.

2. **Persona-Driven Routing Engine**:
   - **Wheelchair**: Strict step-free routes using ramps & elevators with minimum turning radii.
   - **Elderly (Step-Free)**: Minimizes stairs and long walks.
   - **Temporary Limitation**: Step-free preference with proximity indicators.
   - **Caregiver / Family**: Step-free navigation optimized for assisted transit.
   - **Standard Visitor**: Unrestricted pathing including central staircase.

3. **Live Infrastructure State & Dynamic Rerouting**:
   - Real-time status toggling for lifts and ramps (`Available`, `Under Maintenance`, `Temporarily Blocked`).
   - Automatic Dijkstra rerouting when an elevator fails (e.g., automatically detouring through Elevator 2 if Elevator 1 is down, and showing barrier alerts if both are unavailable).
   - Detour metrics and turn-by-turn navigation guidance cards.

4. **Crowdsourced Incident Feedback Loop**:
   - Visitors can report live physical obstacles on their route.
   - Facility managers can view incident tickets and click "Verify & Resolve".

5. **Modern Navigation Blueprint UI**:
   - Crisp Apple Maps / Google Maps indoor navigation theme with white panels, royal blue highlights, architectural CAD background grid, and animated SVG route trails with live radar pulses.
   - 1-click **Judge Demo Presets** for immediate live scenario demonstration.

---

## 🚀 Getting Started

No build tools, npm packages, or external database required! It runs natively in any modern browser.

### Option 1: Python HTTP Server (Recommended)
```bash
# Clone the repository
git clone https://github.com/Tanmay2024/Access-Twin.git

# Navigate into the project folder
cd Access-Twin

# Start local server
python -m http.server 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

### Option 2: Live Server (VS Code / IDE)
Right-click `index.html` and select **"Open with Live Server"**.

---

## 📂 Project Structure

```text
AccessTwin/
├── index.html        # Main application layout, floor views & demo bar
├── style.css         # Modern navigation UI theme & architectural styling
├── app.js            # Dijkstra graph engine, real-time status & route animation
├── campus.geojson    # Complete indoor facility nodes and accessible edges
├── .gitignore        # Git ignore rules
└── README.md         # Project documentation
```

---

## 👥 Authors & Contributors
Developed by Tanmay ([@Tanmay2024](https://github.com/Tanmay2024)).
