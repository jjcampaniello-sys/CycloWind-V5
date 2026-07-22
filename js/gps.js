// gps.js

let currentHeading = 0;
let gpsWatchId = null;
let isFirstLoad = true;

window.isNavigating = false;

alert("GPS démarre");

function startGPS(){
    if(!navigator.geolocation){
        alert("GPS non disponible");
        return;
    }

    gpsWatchId = navigator.geolocation.watchPosition(
        onPositionUpdate,
        function(error){
            alert("Erreur GPS : " + error.message);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000
        }
    );
}

function startCompass(){
    window.addEventListener("deviceorientation", function(event){
        if(event.alpha !== null){
            currentHeading = 360 - event.alpha;
            updateBikeArrow();
        }
    }, true);
}

function onPositionUpdate(position){
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    // Stockage dans les variables globales pour route.js
    window.userLat = lat;
    window.userLon = lon;
    window.userPosition = Array(lat, lon);
    
    console.log("Position stockée :", lat, lon);

    if(!window.map){
        console.error("map NON prête");
        return;
    }

    updateBikeArrowPosition(lat, lon);

    if (isFirstLoad) {
        window.map.setView([lat, lon], 16);
        isFirstLoad = false;
    }

    if (window.isNavigating) {
        window.map.setView([lat, lon], 16, { animate: false });
        // Déplacement en pixels pour remonter la flèche au-dessus des bandeaux
        const pixelX = 0;
        const pixelY = -30;
        window.map.panBy(Array(pixelX, pixelY), { animate: false });
    }
}

function updateBikeArrowPosition(lat, lon){
    if(!window.bikeArrow){
        // Utilisation de variables d'affichage sécurisées
        const dimensionsIcone = Array(40, 40);
        const ancrageIcone = Array(20, 20);

        window.bikeArrow = L.marker([lat, lon], {
            icon: L.divIcon({
                className: "bike-icon",
                html: `<div style="transform:rotate(${currentHeading}deg); font-size:32px; color:blue;">➤</div>`,
                iconSize: dimensionsIcone,
                iconAnchor: ancrageIcone
            })
        }).addTo(window.map);
    } else {
        window.bikeArrow.setLatLng([lat, lon]);
        updateBikeArrow();
    }
}

function updateBikeArrow(){
    if(!window.bikeArrow) return;
    
    const dimensionsIcone = Array(40, 40);
    const ancrageIcone = Array(20, 20);

    const icon = L.divIcon({
        className: "bike-icon",
        html: `<div style="transform:rotate(${currentHeading}deg); font-size:32px; color:blue;">➤</div>`,
        iconSize: dimensionsIcone,
                iconAnchor: ancrageIcone
    });

    window.bikeArrow.setIcon(icon);
}
