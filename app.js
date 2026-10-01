let campusData = null;
let currentActivePath = null;
let currentFloorIndex = 0;

const routeButton = document.getElementById("routeButton");
const result = document.getElementById("result");
const routeInfo = document.getElementById("routeInfo");
const reportButton = document.getElementById("reportButton");
const reportMessage = document.getElementById("reportMessage");
const reportedIssuesBox = document.getElementById("reportedIssues");

let reportedIssues = [];

// -----------------------------
// LOAD GEOJSON
// -----------------------------
async function loadCampus() {
    try {
        const response = await fetch("campus.geojson");
        campusData = await response.json();
        console.log("AccessTwin campus loaded:", campusData);
    } catch (error) {
        console.error(error);
        if (result) {
            result.innerHTML = "❌ Could not load campus.geojson";
        }
    }
}

// -----------------------------
// GET NODE BY ID
// -----------------------------
function getNode(id) {
    if (!campusData || !campusData.features) return null;
    return campusData.features.find(feature => feature.properties.id === id);
}

// -----------------------------
// BUILD GRAPH FROM GEOJSON
// -----------------------------
function buildGraph(profile = "wheelchair") {
    const graph = {};

    campusData.features.forEach(feature => {
        const id = feature.properties.id;
        graph[id] = [];
    });

    campusData.features.forEach(feature => {
        if (feature.geometry.type !== "LineString") {
            return;
        }

        const props = feature.properties;
        const source = props.source;
        const target = props.target;

        const sourceNode = getNode(source);
        const targetNode = getNode(target);

        // Check if nodes themselves are available
        const sourceStatus = sourceNode ? (sourceNode.properties.current_status || "available") : "available";
        const targetStatus = targetNode ? (targetNode.properties.current_status || "available") : "available";
        const edgeStatus = props.current_status || "available";

        if (sourceStatus !== "available" || targetStatus !== "available" || edgeStatus !== "available") {
            return;
        }

        // Accessibility profile filtering:
        // Profiles requiring step-free infrastructure (ramps & elevators only)
        const stepFreeProfiles = ["wheelchair", "elderly", "temporary", "caregiver"];
        if (stepFreeProfiles.includes(profile)) {
            if (props.wheelchair_accessible !== true) {
                return;
            }
        }

        const distance = props.distance_meters || props.distance || 1;

        if (!graph[source]) graph[source] = [];
        if (!graph[target]) graph[target] = [];

        graph[source].push({
            node: target,
            distance: distance
        });

        graph[target].push({
            node: source,
            distance: distance
        });
    });

    return graph;
}

// -----------------------------
// SHORTEST PATH (DIJKSTRA)
// -----------------------------
function findShortestPath(graph, start, destination) {
    if (!graph[start] || !graph[destination]) return null;

    const distances = {};
    const previous = {};
    const unvisited = new Set(Object.keys(graph));

    Object.keys(graph).forEach(node => {
        distances[node] = Infinity;
        previous[node] = null;
    });

    distances[start] = 0;

    while (unvisited.size > 0) {
        let current = null;
        let smallestDistance = Infinity;

        for (const node of unvisited) {
            if (distances[node] < smallestDistance) {
                smallestDistance = distances[node];
                current = node;
            }
        }

        if (current === null || distances[current] === Infinity) {
            break;
        }

        unvisited.delete(current);

        if (current === destination) {
            break;
        }

        for (const connection of graph[current]) {
            const alt = distances[current] + connection.distance;
            if (alt < distances[connection.node]) {
                distances[connection.node] = alt;
                previous[connection.node] = current;
            }
        }
    }

    if (distances[destination] === Infinity) {
        return null;
    }

    const path = [];
    let current = destination;
    while (current !== null) {
        path.unshift(current);
        current = previous[current];
    }

    return path;
}

// -----------------------------
// DRAW ROUTE VISUALLY (SVG)
// -----------------------------
function drawRoute() {
    const map = document.getElementById("map");
    const svg = document.getElementById("routeSvg");
    const routeContainer = document.getElementById("accessRoute");
    if (!map) return;
    if (routeContainer) routeContainer.innerHTML = "";
    if (svg) svg.innerHTML = "";

    // Clear start / destination GPS markers
    document.querySelectorAll(".node, .dest-card").forEach(el => {
        el.classList.remove("is-start", "is-destination");
    });

    if (!currentActivePath || currentActivePath.length < 2) {
        return;
    }

    // Set GPS active departure and arrival markers
    const startEl = document.getElementById(`node_${currentActivePath[0]}`);
    if (startEl) startEl.classList.add("is-start");

    const destEl = document.getElementById(`node_${currentActivePath[currentActivePath.length - 1]}`);
    if (destEl) destEl.classList.add("is-destination");

    const mapRect = map.getBoundingClientRect();

    function getCenter(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2 - mapRect.left,
            y: rect.top + rect.height / 2 - mapRect.top
        };
    }

    const activeWaypoints = new Map();

    for (let i = 0; i < currentActivePath.length - 1; i++) {
        const uId = currentActivePath[i];
        const vId = currentActivePath[i + 1];

        const elU = document.getElementById(`node_${uId}`);
        const elV = document.getElementById(`node_${vId}`);

        if (elU && elV && elU.offsetParent !== null && elV.offsetParent !== null) {
            const p1 = getCenter(elU);
            const p2 = getCenter(elV);

            activeWaypoints.set(uId, p1);
            activeWaypoints.set(vId, p2);

            if (svg) {
                // 1. Navigation wide glow trail
                const glow = document.createElementNS("http://www.w3.org/2000/svg", "line");
                glow.setAttribute("x1", p1.x);
                glow.setAttribute("y1", p1.y);
                glow.setAttribute("x2", p2.x);
                glow.setAttribute("y2", p2.y);
                glow.setAttribute("class", "route-glow");
                svg.appendChild(glow);

                // 2. Navigation solid core ribbon
                const core = document.createElementNS("http://www.w3.org/2000/svg", "line");
                core.setAttribute("x1", p1.x);
                core.setAttribute("y1", p1.y);
                core.setAttribute("x2", p2.x);
                core.setAttribute("y2", p2.y);
                core.setAttribute("class", "route-core");
                svg.appendChild(core);

                // 3. Navigation animated forward flow dashes
                const dash = document.createElementNS("http://www.w3.org/2000/svg", "line");
                dash.setAttribute("x1", p1.x);
                dash.setAttribute("y1", p1.y);
                dash.setAttribute("x2", p2.x);
                dash.setAttribute("y2", p2.y);
                dash.setAttribute("class", "route-dash");
                svg.appendChild(dash);
            }
        }
    }

    // Waypoint dots at turn nodes
    if (svg) {
        activeWaypoints.forEach(p => {
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", p.x);
            dot.setAttribute("cy", p.y);
            dot.setAttribute("r", 4.5);
            dot.setAttribute("class", "route-waypoint");
            svg.appendChild(dot);
        });
    }
}

// -----------------------------
// GET ROUTE DISTANCE (METERS)
// -----------------------------
function getPathDistance(path) {
    if (!path || path.length < 2 || !campusData) return 0;
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        const edge = campusData.features.find(f =>
            f.geometry.type === "LineString" &&
            ((f.properties.source === u && f.properties.target === v) ||
             (f.properties.source === v && f.properties.target === u))
        );
        if (edge) {
            total += (edge.properties.distance_meters || edge.properties.distance || 1);
        }
    }
    return total;
}

// -----------------------------
// DISPLAY ROUTE SUMMARY
// -----------------------------
function displayRoute(path) {
    const names = path.map(id => {
        const node = getNode(id);
        return node ? node.properties.name : id;
    });

    const totalDistance = getPathDistance(path);
    const estMinutes = (totalDistance / 60).toFixed(1);
    const usesElevator2 = path.includes("elevator_2_ground") || path.includes("elevator_2_first");

    const profileSelect = document.getElementById("profile");
    const profileLabel = profileSelect ? profileSelect.options[profileSelect.selectedIndex]?.text : "Wheelchair";

    const badgeHtml = usesElevator2
        ? `<div class="impact-badge detour">⚠ Detour via Elevator 2 (${totalDistance}m • ~${estMinutes} min)</div>`
        : `<div class="impact-badge optimal">✓ Optimal Accessible Route (${totalDistance}m • ~${estMinutes} min)</div>`;

    const profileBadge = `<div style="font-size: 11px; font-weight: 700; color: #475569; margin-top: 4px;">Profile: <em>${profileLabel}</em></div>`;

    if (result) {
        result.innerHTML = `✓ <strong>Route Active</strong><br>${badgeHtml}${profileBadge}<br><br>${names.join(" → ")}`;
    }

    const stepIcons = {
        entrance: "🚪",
        ramp: "♿",
        elevator: "🛗",
        stairs: "🪜",
        corridor: "✦",
        room: "🏁"
    };

    const turnByTurnHtml = `
        <div class="turn-by-turn">
            ${path.map((id, index) => {
                const node = getNode(id);
                const name = node ? node.properties.name : id;
                const type = node ? (node.properties.node_type || node.properties.type || "corridor") : "corridor";
                const icon = stepIcons[type] || "📍";
                const isFirst = index === 0;
                const isLast = index === path.length - 1;
                const stepClass = isFirst ? "start-step" : isLast ? "end-step" : "";
                const tag = isFirst ? "Depart" : isLast ? "Arrive" : "Waypoint";

                return `
                    <div class="nav-step ${stepClass}">
                        <span class="step-idx">${index + 1}</span>
                        <span>${icon}</span>
                        <strong>${name}</strong>
                        <small>${tag}</small>
                    </div>
                `;
            }).join("")}
        </div>
    `;

    if (routeInfo) {
        routeInfo.innerHTML =
            `<strong>Live Turn-by-Turn Route</strong><br>${badgeHtml}${profileBadge}` + turnByTurnHtml;
    }
}

// -----------------------------
// CALCULATE AND DISPLAY ROUTE
// -----------------------------
function calculateAndDisplayRoute() {
    if (!campusData) {
        if (result) result.innerHTML = "Please wait for campus data to load.";
        return;
    }

    const startSelect = document.getElementById("start");
    const destSelect = document.getElementById("destination");
    const profileSelect = document.getElementById("profile");

    const start = startSelect ? startSelect.value : "entrance_main";
    const destination = destSelect ? destSelect.value : "lab_101";
    const profile = profileSelect ? profileSelect.value : "wheelchair";

    const graph = buildGraph(profile);
    const path = findShortestPath(graph, start, destination);

    if (!path) {
        currentActivePath = null;
        if (result) {
            result.innerHTML = "❌ No currently available accessible route found.";
        }
        if (routeInfo) {
            routeInfo.innerHTML = "The destination cannot currently be reached using accessible infrastructure.";
        }
        drawRoute();
        return;
    }

    currentActivePath = path;
    displayRoute(path);
    drawRoute();
}

// -----------------------------
// ROUTE BUTTON & DROPDOWN CHANGE EVENTS
// -----------------------------
if (routeButton) {
    routeButton.addEventListener("click", calculateAndDisplayRoute);
}

["start", "destination", "profile"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener("change", calculateAndDisplayRoute);
    }
});

// -----------------------------
// FLOOR TOGGLES
// -----------------------------
const floorButtons = document.querySelectorAll(".floor");
const groundFloor = document.getElementById("groundFloor");
const firstFloor = document.getElementById("firstFloor");

floorButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
        floorButtons.forEach(b => b.classList.remove("active"));
        button.classList.add("active");

        currentFloorIndex = index;

        if (index === 1) {
            if (groundFloor) groundFloor.style.display = "none";
            if (firstFloor) firstFloor.style.display = "flex";
        } else {
            if (groundFloor) groundFloor.style.display = "flex";
            if (firstFloor) firstFloor.style.display = "none";
        }

        setTimeout(drawRoute, 30);
    });
});

// -----------------------------
// VISITOR / ADMIN VIEW TOGGLE
// -----------------------------
const visitorButton = document.getElementById("visitorButton");
const adminButton = document.getElementById("adminButton");
const adminPanel = document.getElementById("adminPanel");
const visitorPanel = document.getElementById("visitorPanel");

if (adminPanel) adminPanel.style.display = "none";
if (visitorPanel) visitorPanel.style.display = "block";

if (visitorButton) {
    visitorButton.addEventListener("click", () => {
        if (adminPanel) adminPanel.style.display = "none";
        if (visitorPanel) visitorPanel.style.display = "block";
        visitorButton.style.background = "#2563eb";
        visitorButton.style.color = "white";
        visitorButton.style.boxShadow = "0 2px 6px rgba(37, 99, 235, 0.25)";
        adminButton.style.background = "transparent";
        adminButton.style.color = "#64748b";
        adminButton.style.boxShadow = "none";
    });
}

if (adminButton) {
    adminButton.addEventListener("click", () => {
        if (adminPanel) adminPanel.style.display = "block";
        if (visitorPanel) visitorPanel.style.display = "none";
        adminButton.style.background = "#2563eb";
        adminButton.style.color = "white";
        adminButton.style.boxShadow = "0 2px 6px rgba(37, 99, 235, 0.25)";
        visitorButton.style.background = "transparent";
        visitorButton.style.color = "#64748b";
        visitorButton.style.boxShadow = "none";
    });
}

// -----------------------------
// ADMIN INFRASTRUCTURE CONTROLS
// -----------------------------
const updateStatusButton = document.getElementById("updateStatus");
const adminInfrastructure = document.getElementById("adminInfrastructure");
const adminStatus = document.getElementById("adminStatus");
const adminMessage = document.getElementById("adminMessage");

const elevator1Status = document.getElementById("elevator1Status");
const elevator2Status = document.getElementById("elevator2Status");
const rampAStatus = document.getElementById("rampAStatus");
const rampBStatus = document.getElementById("rampBStatus");

function applyInfrastructureStatus(infrastructure, status) {
    if (!campusData) return;

    let targetNodeIds = [];
    if (infrastructure === "elevator_1") {
        targetNodeIds = ["elevator_1_ground", "elevator_1_first"];
    } else if (infrastructure === "elevator_2") {
        targetNodeIds = ["elevator_2_ground", "elevator_2_first"];
    } else if (infrastructure === "ramp_a") {
        targetNodeIds = ["ramp_a"];
    } else if (infrastructure === "ramp_b") {
        targetNodeIds = ["ramp_b"];
    }

    campusData.features.forEach(feature => {
        const id = feature.properties.id;
        if (targetNodeIds.includes(id)) {
            feature.properties.current_status = status;
        }
    });

    campusData.features.forEach(feature => {
        if (feature.geometry.type !== "LineString") return;
        const source = feature.properties.source;
        const target = feature.properties.target;
        if (targetNodeIds.includes(source) || targetNodeIds.includes(target)) {
            feature.properties.current_status = status;
        }
    });

    targetNodeIds.forEach(id => {
        const el = document.getElementById(`node_${id}`);
        if (el) {
            if (status === "available") {
                el.classList.remove("unavailable");
            } else {
                el.classList.add("unavailable");
            }
        }
    });

    const badgeText = status === "available" ? "AVAILABLE" : status === "maintenance" ? "UNDER MAINTENANCE" : "TEMPORARILY BLOCKED";
    const badgeClass = status === "available" ? "available" : "unavailable";

    if (infrastructure === "elevator_1" && elevator1Status) {
        elevator1Status.textContent = badgeText;
        elevator1Status.className = badgeClass;
    } else if (infrastructure === "elevator_2" && elevator2Status) {
        elevator2Status.textContent = badgeText;
        elevator2Status.className = badgeClass;
    } else if (infrastructure === "ramp_a" && rampAStatus) {
        rampAStatus.textContent = badgeText;
        rampAStatus.className = badgeClass;
    } else if (infrastructure === "ramp_b" && rampBStatus) {
        rampBStatus.textContent = badgeText;
        rampBStatus.className = badgeClass;
    }
}

if (updateStatusButton) {
    updateStatusButton.addEventListener("click", function () {
        const infrastructure = adminInfrastructure.value;
        const status = adminStatus.value;
        applyInfrastructureStatus(infrastructure, status);

        if (adminMessage) {
            const prettyName = infrastructure.replace("_", " ").toUpperCase();
            adminMessage.innerHTML = `✓ <strong>${prettyName}</strong> status updated to <strong>${status}</strong>.`;
        }

        calculateAndDisplayRoute();
    });
}

// -----------------------------
// ONE-CLICK DEMO PRESETS
// -----------------------------
const presetNormal = document.getElementById("presetNormal");
const presetElevator1Down = document.getElementById("presetElevator1Down");
const presetTotalOutage = document.getElementById("presetTotalOutage");
const presetButtons = [presetNormal, presetElevator1Down, presetTotalOutage];

function setPresetActive(btn) {
    presetButtons.forEach(b => b?.classList.remove("active"));
    btn?.classList.add("active");
}

if (presetNormal) {
    presetNormal.addEventListener("click", () => {
        setPresetActive(presetNormal);
        applyInfrastructureStatus("elevator_1", "available");
        applyInfrastructureStatus("elevator_2", "available");
        applyInfrastructureStatus("ramp_a", "available");
        applyInfrastructureStatus("ramp_b", "available");
        calculateAndDisplayRoute();
    });
}

if (presetElevator1Down) {
    presetElevator1Down.addEventListener("click", () => {
        setPresetActive(presetElevator1Down);
        applyInfrastructureStatus("elevator_1", "maintenance");
        applyInfrastructureStatus("elevator_2", "available");
        calculateAndDisplayRoute();
    });
}

if (presetTotalOutage) {
    presetTotalOutage.addEventListener("click", () => {
        setPresetActive(presetTotalOutage);
        applyInfrastructureStatus("elevator_1", "maintenance");
        applyInfrastructureStatus("elevator_2", "maintenance");
        calculateAndDisplayRoute();
    });
}

// -----------------------------
// REPORTING
// -----------------------------
if (reportButton) {
    reportButton.addEventListener("click", function () {
        reportedIssues.push({
            issue: "Accessibility barrier reported",
            location: "Current facility route",
            status: "Reported"
        });

        if (reportMessage) {
            reportMessage.innerHTML =
                "⚠ Accessibility issue reported.<br>" +
                "Facility Admin has been notified for verification.";
        }

        renderReportedIssues();
    });
}

function renderReportedIssues() {
    if (!reportedIssuesBox) return;

    if (reportedIssues.length === 0) {
        reportedIssuesBox.innerHTML = "No new accessibility reports.";
        return;
    }

    reportedIssuesBox.innerHTML = reportedIssues
        .map((report, index) => `
            <div class="report-item">
                <strong>Report #${index + 1}</strong><br>
                ${report.issue}<br>
                <small>${report.location} • <span id="reportStatus${index}">${report.status}</span></small>
                <br>
                ${report.status === "Reported" ? `<button onclick="resolveReport(${index})">Verify & Resolve</button>` : `<small style="color: #166534; font-weight: bold;">✓ Verified & Resolved</small>`}
            </div>
        `)
        .join("");
}

window.resolveReport = function(index) {
    if (reportedIssues[index]) {
        reportedIssues[index].status = "Resolved";
        renderReportedIssues();
    }
};

// Redraw route on window resize
window.addEventListener("resize", () => {
    drawRoute();
});

// Quick destination selection from 1st floor destination cards
document.querySelectorAll(".dest-card").forEach(card => {
    card.addEventListener("click", () => {
        const destId = card.id.replace("node_", "");
        const destSelect = document.getElementById("destination");
        if (destSelect) {
            destSelect.value = destId;
            calculateAndDisplayRoute();
        }
    });
});

// Initialize
loadCampus().then(() => {
    calculateAndDisplayRoute();
});