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
  
    // Construction sécurisée sans aucun crochet brut pour l'envoi API
    const coordStart = Array(start.lng, start.lat);
    const coordEnd = Array(endLon, endLat);

    const body = {
        coordinates: Array(coordStart, coordEnd),
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
        const direction = getSegmentDirection(latlngs[i], latlngs[i+1]);
        const cost = windCost(direction, currentWindDirection, currentWindSpeed);
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
    if(scoreNormal <= 0) return 0;
    const gain = ((scoreNormal - scoreAlternative) / scoreNormal) * 100;
    return Math.max(0, gain);
}

function drawWindRoute(latlngs){
    for(let i = 0; i < latlngs.length - 1; i++){
        const direction = getSegmentDirection(latlngs[i], latlngs[i+1]);
        const cost = windCost(direction, currentWindDirection, currentWindSpeed);

        let color = "green";
        if(cost > 20) color = "red";
        else if(cost > 8) color = "orange";

        const pointA = latlngs[i];
        const pointB = latlngs[i+1];

        const line = L.polyline(
            Array(pointA, pointB),
            { color: color, weight: 6 }
        ).addTo(window.routeGroup);

        routeLayers.push(line);
    }
}

function drawGrayRoute(latlngs){
    const line = L.polyline(latlngs, { color: "gray", weight: 5 }).addTo(window.routeGroup);
    routeLayers.push(line);
}

// Calcul trajet principal
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
        lat: window.userLat,
        lng: window.userLon
    };
    
    alert("Départ : " + start.lat + " / " + start.lng);
    const endLat = window.destination.lat;
    const endLon = window.destination.lon;
    
    const allRoutesData = await getAlternativeRoute(start, endLat, endLon);
    
    if (!allRoutesData || !allRoutesData.features || allRoutesData.features.length === 0) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    // 🔥 FIX TECHNIQUE : Réintégration propre des index [1] (Latitude) et [0] (Longitude)
    // Extraction Route 1
    const feature1 = allRoutesData.features;
    const latlngs1 = feature1.geometry.coordinates.map(p => Array(p, p));
    const score1 = calculateWindScore(latlngs1);

    // Extraction Route 2
    let latlngs2 = latlngs1; 
    let score2 = score1;
    let feature2 = feature1;
    if (allRoutesData.features.length > 1) {
        feature2 = allRoutesData.features;
        latlngs2 = feature2.geometry.coordinates.map(p => Array(p, p));
        score2 = calculateWindScore(latlngs2);
    }

    // Extraction Route 3
    let latlngs3 = latlngs1;
    let score3 = score1;
    let feature3 = feature1;
    if (allRoutesData.features.length > 2) {
        feature3 = allRoutesData.features;
        latlngs3 = feature3.geometry.coordinates.map(p => Array(p, p));
        score3 = calculateWindScore(latlngs3);
    }

    window.allTracksPersist = Array(latlngs1, latlngs2, latlngs3);
    window.allScoresPersist = Array(score1, score2, score3);
    window.allFeaturesPersist = Array(feature1, feature2, feature3);
    window.currentRoute = latlngs1.map(p => ({ lat: p, lng: p }));

    const firstDir = getSegmentDirection(latlngs1, latlngs1);
    await getWind(start.lat, start.lng, firstDir);
    
    window.routeGroup.clearLayers();
    drawWindRoute(latlngs1);
    
    if (allRoutesData.features.length > 1) drawGrayRoute(latlngs2);
    if (allRoutesData.features.length > 2) drawGrayRoute(latlngs3);

    // ANALYSE COMPARATIVE
    let bestIndex = 0;
    let bestScore = score1;
    let recommendation = "🚴 Trajet initial recommandé (le plus rapide)";

    if (score2 < score1 * 0.95) {
        bestIndex = 1;
        bestScore = score2;
        recommendation = "🌱 Alternative A recommandée pour éviter le vent";
    }
    if (score3 < bestScore * 0.95) {
        bestIndex = 2;
        bestScore = score3;
        recommendation = "🌳 Alternative B recommandée, idéale contre les rafales";
    }

    function updateWindText(viewIndex) {
        const activeFeature = window.allFeaturesPersist[viewIndex];
        const activeScore = window.allScoresPersist[viewIndex];
        const distanceKm = (activeFeature.properties.summary.distance / 1000).toFixed(1);

        const rawGain = ((score1 - activeScore) / score1) * 100;
        let gainText = "";

        if (viewIndex === 0) {
            gainText = "⏱️ Option la plus directe";
        } else if (Math.abs(rawGain) < 5) { 
            gainText = "🌬️ Exposition identique à la route de base";
        } else if (rawGain >= 5) {
            gainText = `🌱 Économie de vent : -${Math.abs(rawGain).toFixed(0)}% d'effort`;
        } else {
            gainText = `⚠️ Attention : +${Math.abs(rawGain).toFixed(0)}% d'effort vent`;
        }

        const nomsVues = Array("Initiale", "Alternative A", "Alternative B");

        document.getElementById("windInfo").innerHTML = `
            ${recommendation}
            <br>
            📍 Vue : Route ${nomsVues[viewIndex]}
            <br>
            📏 Distance : ${distanceKm} km
            <br>
            ${gainText}
            <br>
            📊 Indice effort vent : ${activeScore.toFixed(1)}
        `;
    }

    updateWindText(0);

    if (latlngs1 && latlngs1.length > 0) {
        const bounds = L.latLngBounds(latlngs1);
        const margePixelX = 50;
        const margePixelY = 50;
        const objetPadding = L.point(margePixelX, margePixelY);

        window.map.fitBounds(bounds, { 
            padding: objetPadding,
            maxZoom: 15
        });
    }

    const toggleBtn = document.getElementById("toggleRouteBtn");
    
    if (allRoutesData.features.length > 1) {
        toggleBtn.style.display = "block";
        let currentTrackView = 0;
        const maxViews = allRoutesData.features.length;

        toggleBtn.innerText = "Voir l'Alternative A";

        toggleBtn.onclick = function() {
            window.routeGroup.clearLayers();
            if (typeof routeLayers !== 'undefined') { routeLayers = Array(); }

            currentTrackView = (currentTrackView + 1) % maxViews;
            drawWindRoute(window.allTracksPersist[currentTrackView]);

            for (let i = 0; i < maxViews; i++) {
                if (i !== currentTrackView) {
                    drawGrayRoute(window.allTracksPersist[i]);
                }
            }

            const prochainsNoms = Array("l'Alternative A", "l'Alternative B", "la Route Initiale");
            let textIdx = currentTrackView;
            if (maxViews === 2 && currentTrackView === 1) textIdx = 1;
            toggleBtn.innerText = "Voir " + prochainsNoms[textIdx];

            updateWindText(currentTrackView);
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
            const decalageX = 0;
            const decalageY = -85;
            window.map.panBy(Array(decalageX, decalageY), { animate: true });
        }, 250);
    } else {
        window.isNavigating = false;
        btn.innerText = "Démarrer";
        btn.style.backgroundColor = "#2ecc71"; 

        if (window.allTracksPersist && window.allTracksPersist) {
            const margePixelX = 50;
            const margePixelY = 50;
            const objetPadding = L.point(margePixelX, margePixelY);

            window.map.fitBounds(L.latLngBounds(window.allTracksPersist), { 
                padding: objetPadding,
                maxZoom: 15
            });
        }
    }
}
