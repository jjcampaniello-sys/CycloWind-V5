// Direction segment route
function getSegmentDirection(p1, p2){
    const dy = p2[0] - p1[0];
    const dx = p2[1] - p1[1];
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if(angle < 0){
        angle += 360;
    }

    return angle;
}

// Extraction de toutes les variantes gérées de manière sécurisée en arrière-plan
async function getAlternativeRoute(start, endLat, endLon) {
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU5N2JkNDJjYTM5MzRjYTFhODQ1MTE2YjViNmQ2ZGJjIiwiaCI6Im11cm11cjY0In0=";
    const url = "https://api.openrouteservice.org/v2/directions/cycling-regular/geojson";

    const body = {
        coordinates: [
            [start.lng, start.lat],
            [endLon, endLat]
        ],
        // Structure officielle d'alternative validée par l'API v2 d'ORS GeoJSON
        alternative_routes: {
            target_count: 3,    
            share_factor: 0.6,  
            weight_factor: 1.4  
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

        const line = L.polyline(
            [latlngs[i], latlngs[i+1]],
            { color: color, weight: 6 }
        ).addTo(window.routeGroup);

        routeLayers.push(line);
    }
}

function drawGrayRoute(latlngs){
    const line = L.polyline(latlngs, { color: "gray", weight: 5 }).addTo(window.routeGroup);
    routeLayers.push(line);
}

// Calcul trajet principal d'origine restauré
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
    
    // Requête unique unifiée pour les 3 routes pour éviter la saturation réseau
    const data = await getAlternativeRoute(start, endLat, endLon);
    
    if (!data || !data.features || data.features.length === 0) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    // EXTRACTION SÉCURISÉE ET PARALLÈLE DES 3 ITINÉRAIRES ENTIERS
    // Route 1 (Principale)
    const feature1 = data.features[0];
    const latlngs1 = feature1.geometry.coordinates.map(point => [point[1], point[0]]);
    const score1 = calculateWindScore(latlngs1);

    // Route 2 (Alternative A)
    let latlngs2 = latlngs1; 
    let score2 = score1;
    let feature2 = feature1;
    if (data.features.length > 1) {
        feature2 = data.features[1];
        latlngs2 = feature2.geometry.coordinates.map(point => [point[1], point[0]]);
        score2 = calculateWindScore(latlngs2);
    }

    // Route 3 (Alternative B)
    let latlngs3 = latlngs1;
    let score3 = score1;
    let feature3 = feature1;
    if (data.features.length > 2) {
        feature3 = data.features[2];
        latlngs3 = feature3.geometry.coordinates.map(point => [point[1], point[0]]);
        score3 = calculateWindScore(latlngs3);
    }

    // Sauvegarde persistante globale pour le bouton de bascule
    window.allTracksPersist = [latlngs1, latlngs2, latlngs3];
    window.allScoresPersist = [score1, score2, score3];
    window.allFeaturesPersist = [feature1, feature2, feature3];
    window.currentRoute = latlngs1.map(p => ({ lat: p[0], lng: p[1] }));

    // Appel météo synchrone d'origine
    const firstDir = getSegmentDirection(latlngs1[0], latlngs1[1]);
    await getWind(start.lat, start.lng, firstDir);
    
    // Nettoyage et premier tracé couleur
    window.routeGroup.clearLayers();
    drawWindRoute(latlngs1);
    
    // Tracé passif des alternatives en arrière-plan en gris
    if (data.features.length > 1) drawGrayRoute(latlngs2);
    if (data.features.length > 2) drawGrayRoute(latlngs3);

    // LOGIQUE DE RECOMMANDATION INTELLIGENTE
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

    // MISE À JOUR TEXTUELLE DYNAMIQUE PAR SÉLECTION
    function updateWindText(viewIndex) {
        const activeFeature = window.allFeaturesPersist[viewIndex];
        const activeScore = window.allScoresPersist[viewIndex];
        const distanceKm = (activeFeature.properties.summary.distance / 1000).toFixed(1);

        const rawGain = ((score1 - activeScore) / score1) * 100;
        let gainText = "";

        if (viewIndex === 0) {
            gainText = "⏱️ Option la plus directe au compteur";
        } else if (Math.abs(rawGain) < 5) { 
            gainText = "🌬️ Exposition au vent équivalente";
        } else if (rawGain >= 5) {
            gainText = `🌱 Économie de vent : -${Math.abs(rawGain).toFixed(0)}% d'effort`;
        } else {
            gainText = `⚠️ Attention : +${Math.abs(rawGain).toFixed(0)}% d'effort vent`;
        }

        const nomsVues = ["Initiale", "Alternative A", "Alternative B"];

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

    // Déploiement initial du texte
    updateWindText(0);

    // VUE D'ENSEMBLE AUTOMATIQUE SANS BLOCAGE SYNTAXIQUE
    if (latlngs1 && latlngs1.length > 0) {
        const bounds = L.latLngBounds(latlngs1);
        
        // Déclaration du padding en pixels natifs pour contourner les filtres automatiques
        const margePixelX = 50;
        const margePixelY = 50;
        const objetPadding = L.point(margePixelX, margePixelY);

        window.map.fitBounds(bounds, { 
            padding: objetPadding,
            maxZoom: 15
        });
    }

    // LOGIQUE DE COMMUTATION ROTATIVE SUR 3 POSITIONS
    const toggleBtn = document.getElementById("toggleRouteBtn");
    
    if (data.features.length > 1) {
        toggleBtn.style.display = "block";
        let currentTrackView = 0;
        const maxViews = data.features.length;

        toggleBtn.innerText = "Voir l'Alternative A";

        toggleBtn.onclick = function() {
            window.routeGroup.clearLayers();
            if (typeof routeLayers !== 'undefined') { routeLayers = []; }

            currentTrackView = (currentTrackView + 1) % maxViews;
            drawWindRoute(window.allTracksPersist[currentTrackView]);

            for (let i = 0; i < maxViews; i++) {
                if (i !== currentTrackView) {
                    drawGrayRoute(window.allTracksPersist[i]);
                }
            }

            const prochainsNoms = ["l'Alternative A", "l'Alternative B", "la Route Initiale"];
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

// SUIVI GPS MOBILE SÉCURISÉ EN COULEUR
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

        // Décalage en pixels réels pour empêcher les cadres du bas de masquer la flèche bleue
        setTimeout(() => {
            const deplaceX = 0;
            const deplaceY = -85;
            window.map.panBy([deplaceX, deplaceY], { animate: true });
        }, 250);
    } else {
        window.isNavigating = false;
        btn.innerText = "Démarrer";
        btn.style.backgroundColor = "#2ecc71"; 

