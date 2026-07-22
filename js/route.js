// route.js - Direction segment route
function getSegmentDirection(p1, p2){
    const dy = p2[0] - p1[0];
    const dx = p2[1] - p1[1];
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if(angle < 0){
        angle += 360;
    }

    return angle;
}

async function getAlternativeRoute(start, endLat, endLon) {
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU5N2JkNDJjYTM5MzRjYTFhODQ1MTE2YjViNmQ2ZGJjIiwiaCI6Im11cm11cjY0In0=";
    const url = "https://openrouteservice.org";
  
    const body = {
        coordinates: [
            [start.lng, start.lat],
            [endLon, endLat]
        ],
        alternative_routes: {
            target_count: 3,    
            share_factor: 0.4,  
            weight_factor: 1.8  
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    return data; 
}

function calculateWindScore(latlngs){
    let totalCost = 0;
    let count = 0;

    for(let i = 0; i < latlngs.length - 1; i++){
        const direction = getSegmentDirection(
            latlngs[i],
            latlngs[i+1]
        );

        const cost = windCost(
            direction,
            currentWindDirection,
            currentWindSpeed
        );

        totalCost += cost;
        count++;
    }

    return totalCost / count;
}

function chooseBestRoute(normalRoute, alternativeRoute, normalScore, alternativeScore){
    const normalTime = normalRoute.duration;
    const alternativeTime = alternativeRoute.duration;

    const windGain = normalScore - alternativeScore;

    if(windGain > 3 && alternativeTime < normalTime * 1.2){
        return "alternative";
    }

    return "normal";
}

function calculateWindGain(scoreNormal, scoreAlternative){
    if(scoreNormal <= 0){
        return 0;
    }
    const gain = ((scoreNormal - scoreAlternative) / scoreNormal) * 100;
    return Math.max(0, gain);
}

function drawWindRoute(latlngs){
    for(let i = 0; i < latlngs.length - 1; i++){
        const direction = getSegmentDirection(
            latlngs[i],
            latlngs[i+1]
        );

        const cost = windCost(
            direction,
            currentWindDirection,
            currentWindSpeed
        );

        let color;
        if(cost > 20){
            color = "red";
        }
        else if(cost > 8){
            color = "orange";
        }
        else{
            color = "green";
        }

        const line = L.polyline(
            [latlngs[i], latlngs[i+1]],
            {
                color: color,
                weight: 6
            }
        ).addTo(window.routeGroup);

        routeLayers.push(line);
    }
}

// Calcul trajet principaux
async function getRoute(){
    alert("getRoute démarré");
    if(!window.userPosition){
        alert("Définissez votre position d'abord");
        return;
    }
    
    if(!window.destination){
        alert("Choisissez une destination dans la liste");
        return;
    }
    
    const start = {   
        lat: window.userPosition[0],
        lng: window.userPosition[1]
    };
    
    alert("Départ : " + start.lat + " / " + start.lng);
    const endLat = window.destination.lat;
    const endLon = window.destination.lon;
    
    const allRoutesData = await getAlternativeRoute(start, endLat, endLon);
    
    if (!allRoutesData.features || allRoutesData.features.length === 0) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    const normalFeature = allRoutesData.features[0];
    const coordsNormal = normalFeature.geometry.coordinates;
    const latlngsNormal = coordsNormal.map(point => [point[1], point[0]]);

    let latlngsAlternative = latlngsNormal; 
    let alternativeFeature = normalFeature;

    if (allRoutesData.features.length > 1) {
        alternativeFeature = allRoutesData.features[1];
        const coordsAlt = alternativeFeature.geometry.coordinates;
        latlngsAlternative = coordsAlt.map(point => [point[1], point[0]]);
    }

    window.latlngsNormalPersist = latlngsNormal;
    window.latlngsAlternativePersist = latlngsAlternative;
    window.currentRoute = latlngsNormal.map(p => ({ lat: p[0], lng: p[1] }));

    const firstDir = getSegmentDirection(latlngsNormal[0], latlngsNormal[1]);
    await getWind(start.lat, start.lng, firstDir);
    
    window.routeGroup.clearLayers();
    drawWindRoute(latlngsNormal);

    const normalScore = calculateWindScore(latlngsNormal);
    const alternativeScore = calculateWindScore(latlngsAlternative);

    const routesArrayMock = { duration: normalFeature.properties.summary.duration };
    const alternativeMock = { duration: alternativeFeature.properties.summary.duration };

    const choice = chooseBestRoute(
        routesArrayMock,
        alternativeMock,
        normalScore,
        alternativeScore
    );

    const windGain = calculateWindGain(normalScore, alternativeScore);

    let recommendation = choice === "alternative" && allRoutesData.features.length > 1
        ? "🌱 CycloWind recommande l'alternative"
        : "🚴 CycloWind recommande ce trajet";

    function updateWindText(currentView, activeScore) {
        const featureActive = currentView === "normale" ? normalFeature : alternativeFeature;
        const distanceKm = (featureActive.properties.summary.distance / 1000).toFixed(1);

        const rawGain = ((normalScore - alternativeScore) / normalScore) * 100;
        let gainText = "";

        if (allRoutesData.features.length <= 1) {
            gainText = "🌬️ Aucune route alternative disponible";
        } 
        else if (Math.abs(rawGain) < 5) { 
            gainText = "🌬️ Exposition au vent équivalente sur les deux trajets";
        } 
        else if (rawGain >= 5) {
            gainText = `🌱 Économie de vent : -${Math.abs(rawGain).toFixed(0)}% d'effort sur l'alternative`;
        } 
        else {
            gainText = `⚠️ Attention : +${Math.abs(rawGain).toFixed(0)}% d'effort vent sur l'alternative`;
        }

        document.getElementById("windInfo").innerHTML = `
            ${recommendation}
            <br>
            📍 Vue : Route ${currentView}
            <br>
            📏 Distance : ${distanceKm} km
            <br>
            ${gainText}
            <br>
            📊 Indice effort vent : ${activeScore.toFixed(1)}
        `;
    }

    updateWindText("normale", normalScore);

    if (latlngsNormal && latlngsNormal.length > 0) {
        const bounds = L.latLngBounds(latlngsNormal);
        window.map.fitBounds(bounds, { 
            padding:,
            maxZoom: 15
        });
    }

    const toggleBtn = document.getElementById("toggleRouteBtn");
    
    if (allRoutesData.features.length > 1) {
        toggleBtn.style.display = "block";
        let showingAlternative = false;
        toggleBtn.innerText = "Voir la route alternative";

        toggleBtn.onclick = function() {
            window.routeGroup.clearLayers();
            if (typeof routeLayers !== 'undefined') { routeLayers = []; }

            if (!showingAlternative) {
                drawWindRoute(window.latlngsAlternativePersist);
                toggleBtn.innerText = "Voir la route normale";
                updateWindText("alternative", alternativeScore);
                showingAlternative = true;
            } else {
                drawWindRoute(window.latlngsNormalPersist);
                toggleBtn.innerText = "Voir la route alternative";
                updateWindText("normale", normalScore);
                showingAlternative = false;
            }
        };
    } else {
        toggleBtn.style.display = "none";
    }

    window.drawWindRoute = drawWindRoute;
}

function startNavigation() {
    const btn = document.getElementById("startNavBtn");
    if (!btn) return;

    if (!window.userPosition) {
        alert("Position GPS non détectée. Impossible de démarrer.");
        return;
    }

    if (!window.isNavigating) {
        window.isNavigating = true;
        btn.innerText = "Arrêter";
        btn.style.backgroundColor = "#e74c3c"; 

        window.map.setView(window.userPosition, 16);

        setTimeout(() => {
            window.map.panBy([0, -85], { animate: true });
        }, 250);
    } else {
        window.isNavigating = false;
        btn.innerText = "Démarrer";
        btn.style.backgroundColor = "#2ecc71"; 

        if (window.latlngsNormalPersist) {
            window.map.fitBounds(L.latLngBounds(window.latlngsNormalPersist), { 
                padding:,
                maxZoom: 15
            });
        }
    }
}
