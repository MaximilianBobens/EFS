"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const currentState = {};
    let useUTC = true;

    // Elemente
    const metarContainer = document.getElementById("metarContainer");
    const icaoInput = document.getElementById("icaoInput");
    const btnGetMetar = document.getElementById("btnGetMetar");
    const callsignSearch = document.getElementById("callsignSearch");
    const mainContainer = document.getElementById("main-container");
    const clockEl = document.getElementById("clock");

    // Mapping of views to the bays that should be visible
    const viewBays = {
        'DLV': ['departures-bay', 'cleared-departures-bay', 'pushback-bay'],
        'GND': ['pushback-bay', 'taxi-bay', 'arrivals-bay'],
        'TWR': ['taxi-bay', 'arrivals-bay', 'rwy-1129-departures-bay', 'rwy-1634-departures-bay', 'airborne-bay']
    };

    // Event-Listener registrieren
    btnGetMetar.addEventListener("click", () => {
        const icao = icaoInput.value.trim().toUpperCase();
        if (icao) {
            fetchMetar(icao);
        } else {
            alert("Bitte einen gültigen ICAO-Code eingeben.");
        }
    });

    document.getElementById("btnDlv").addEventListener("click", switchToDlv);
    document.getElementById("btnGnd").addEventListener("click", switchToGnd);
    document.getElementById("btnTwr").addEventListener("click", switchToTwr);
    document.getElementById("btnPlus").addEventListener("click", onPlusClick);
    document.getElementById("btnToggleTime").addEventListener("click", toggleTime);

    callsignSearch.addEventListener("input", () => {
        const filterText = callsignSearch.value.toLowerCase();
        document.querySelectorAll(".flight-strip").forEach(strip => {
            const callsign = strip.dataset.callsign.toLowerCase();
            strip.style.display = callsign.includes(filterText) ? "flex" : "none";
        });
    });

    setInterval(updateClock, 1000);
    updateClock();

    fetchVatsimData();
    setInterval(fetchVatsimData, 15000);

    // Initialize drop event listeners for all bay sections once
    initDropZones();

    // Initialize with DLV view
    switchToDlv();

    async function fetchVatsimData() {
        try {
            const response = await fetch("https://data.vatsim.net/v3/vatsim-data.json");
            const data = await response.json();
            updateFlightStrips(data.pilots);
        } catch (error) {
            console.error("Error fetching VATSIM data:", error);
        }
    }

    async function fetchMetar(icao) {
        const url = `https://metar.vatsim.net/${icao}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Fehler beim Abrufen des METAR für ${icao}: ${response.statusText}`);
            }
            const metar = await response.text();
            displayMetar(icao, metar);
        } catch (error) {
            console.error("Fehler:", error);
            metarContainer.innerHTML = `<h3>METAR für ${icao}</h3><p>Fehler beim Abrufen der Daten.</p>`;
        }
    }

    function displayMetar(icao, metar) {
        metarContainer.innerHTML = `<h3>METAR für ${icao}</h3><pre>${metar}</pre>`;
    }

    function updateFlightStrips(pilots) {
        const newState = {};
        pilots.forEach(pilot => {
            if (!pilot.flight_plan) return;
            const distance = calculateDistance(pilot.latitude, pilot.longitude, 48.1103, 16.5697);
            if (pilot.flight_plan.arrival === "LOWW" && distance <= 12) {
                newState[pilot.callsign] = currentState[pilot.callsign] || "arrivals";
            } else if (pilot.flight_plan.departure === "LOWW") {
                newState[pilot.callsign] = currentState[pilot.callsign] || "departures";
            }
        });

        Object.keys(newState).forEach(callsign => {
            if (!document.querySelector(`.flight-strip[data-callsign="${callsign}"]`)) {
                const pilot = pilots.find(p => p.callsign === callsign);
                if (pilot) {
                    addFlightStrip(pilot, newState[callsign]);
                }
            }
        });

        Object.assign(currentState, newState);
    }

    async function addFlightStrip(pilot, sectionId) {
        const strip = document.createElement("div");
        strip.className = "flight-strip";
        strip.draggable = true;
        strip.dataset.callsign = pilot.callsign;
        strip.dataset.departure = pilot.flight_plan.departure || "N/A";
        strip.dataset.arrival = pilot.flight_plan.arrival || "N/A";

        const activeRunway = await fetchActiveRunway(pilot.flight_plan.departure);
        const firstWaypoint = getFirstWaypoint(pilot.flight_plan);

        // Format the flight strip – the info row includes the cleared checkbox inline
        strip.innerHTML = `
            <div class="strip-details">
                <strong>${pilot.callsign}</strong>
            </div>
            <div class="info">
                <div>
                    ${pilot.flight_plan.arrival || "N/A"} ${firstWaypoint} | ${pilot.flight_plan.aircraft_faa || "N/A"} | ${pilot.transponder || "----"}
                    <span class="cleared-container">
                        <input type="checkbox" class="cleared-checkbox">
                        <label class="cleared-label">Cleared</label>
                    </span>
                </div>
            </div>
            <div class="actions">
                <button class="remove-btn">X</button>
            </div>
        `;

        // Attach drag start/end listeners to the flight strip only
        strip.addEventListener("dragstart", e => {
            e.dataTransfer.setData("text/plain", strip.dataset.callsign);
            strip.classList.add("dragging");
        });
        strip.addEventListener("dragend", () => {
            strip.classList.remove("dragging");
        });

        // Cleared checkbox event listener
        const clearedCheckbox = strip.querySelector(".cleared-checkbox");
        clearedCheckbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                const clearedBay = document.getElementById("cleared-departures");
                if (clearedBay) {
                    clearedBay.appendChild(strip);
                    currentState[pilot.callsign] = "cleared-departures";
                }
            } else {
                const departureBay = document.getElementById("departures");
                if (departureBay) {
                    departureBay.appendChild(strip);
                    currentState[pilot.callsign] = "departures";
                }
            }
        });

        // Remove button event listener
        const removeBtn = strip.querySelector(".remove-btn");
        removeBtn.addEventListener("click", () => {
            strip.remove();
            delete currentState[pilot.callsign];
        });

        // QNH Indicator remains as before
        const qnhIndicator = document.createElement("div");
        qnhIndicator.className = "qnh-indicator";
        qnhIndicator.textContent = "QNH";
        qnhIndicator.style.position = "absolute";
        qnhIndicator.style.top = "8px";
        qnhIndicator.style.right = "8px";
        qnhIndicator.style.background = "#4CAF50";
        qnhIndicator.style.color = "#fff";
        qnhIndicator.style.padding = "4px 8px";
        qnhIndicator.style.borderRadius = "4px";
        qnhIndicator.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.3)";
        qnhIndicator.style.fontSize = "0.8rem";
        qnhIndicator.style.cursor = "pointer";
        qnhIndicator.style.transition = "opacity 0.3s ease";
        qnhIndicator.addEventListener("click", () => {
            qnhIndicator.style.opacity = "0";
            setTimeout(() => { qnhIndicator.remove(); }, 300);
        });
        strip.appendChild(qnhIndicator);

        const baySection = document.getElementById(sectionId);
        if (baySection) {
            baySection.appendChild(strip);
        }
    }

    async function fetchActiveRunway(icao) {
        const url = `https://atis.vatsim.net/${icao}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Fehler beim Abrufen der ATIS-Daten für ${icao}: ${response.statusText}`);
            }
            const atisData = await response.text();
            const runwayMatch = atisData.match(/Runway\s+(\d+[LRC]?)/i);
            return runwayMatch ? runwayMatch[1] : "Unbekannt";
        } catch (error) {
            console.error("Fehler beim Abrufen der ATIS-Daten:", error);
            return "N/A";
        }
    }

    function getFirstWaypoint(flightPlan) {
        if (!flightPlan || !flightPlan.route) return "N/A";
        const waypoints = flightPlan.route.split(" ");
        return waypoints.length > 0 ? waypoints[0] : "N/A";
    }

    // This function attaches drop event listeners only once to each bay-section.
    function initDropZones() {
        const dropzones = document.querySelectorAll(".bay-section");
        dropzones.forEach(dropzone => {
            dropzone.addEventListener("dragover", e => {
                e.preventDefault();
                dropzone.classList.add("dragging");
            });
            dropzone.addEventListener("dragleave", () => {
                dropzone.classList.remove("dragging");
            });
            dropzone.addEventListener("drop", e => {
                e.preventDefault();
                dropzone.classList.remove("dragging");
                const callsign = e.dataTransfer.getData("text/plain");
                const flightStrip = document.querySelector(`.flight-strip[data-callsign="${callsign}"]`);
                if (flightStrip) {
                    dropzone.appendChild(flightStrip);
                    currentState[callsign] = dropzone.id;
                }
            });
        });
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const toRad = value => (value * Math.PI) / 180;
        const R = 3440.065;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function switchToDlv() {
        switchLayout('DLV');
        mainContainer.classList.remove('grid-cols-5');
        mainContainer.classList.add('grid-cols-3');
    }

    function switchToGnd() {
        switchLayout('GND');
        mainContainer.classList.remove('grid-cols-5');
        mainContainer.classList.add('grid-cols-3');
    }

    function switchToTwr() {
        switchLayout('TWR');
        mainContainer.classList.remove('grid-cols-3');
        mainContainer.classList.add('grid-cols-5');
    }

    function switchLayout(layout) {
        const allBays = document.querySelectorAll('.bay');
        allBays.forEach(bay => {
            if (viewBays[layout].includes(bay.id)) {
                bay.style.display = 'flex';
            } else {
                bay.style.display = 'none';
            }
        });
    }

    function onPlusClick() {
        const callsign = prompt("Callsign eingeben:", "OEGUT");
        if (!callsign) return;
        const departure = prompt("Departure ICAO:", "LOWW");
        if (!departure) return;
        const arrival = prompt("Arrival ICAO:", "LOWW");
        if (!arrival) return;
        const aircraftType = prompt("Aircraft Type:", "A320");
        if (!aircraftType) return;
        const squawk = prompt("Squawk Code:", "1000");
        if (!squawk) return;

        const newPilot = {
            callsign: callsign,
            flight_plan: {
                departure: departure,
                arrival: arrival,
                aircraft_faa: aircraftType,
            },
            transponder: squawk
        };

        addFlightStrip(newPilot, "departures");
        currentState[callsign] = "departures";
    }

    function updateClock() {
        const now = new Date();
        const hours = String(useUTC ? now.getUTCHours() : now.getHours()).padStart(2, "0");
        const minutes = String(useUTC ? now.getUTCMinutes() : now.getMinutes()).padStart(2, "0");
        const seconds = String(useUTC ? now.getUTCSeconds() : now.getSeconds()).padStart(2, "0");
        clockEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    function toggleTime() {
        useUTC = !useUTC;
        document.getElementById("btnToggleTime").textContent = useUTC ? "UTC" : "LOCAL";
        updateClock();
    }
    
});
