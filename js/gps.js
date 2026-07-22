// gps.js

let currentHeading = 0;
// utilise la variable créée dans app.js//let bikeArrow = null;
let gpsWatchId = null;

// 🔥 NOUVEL ÉTAT POUR LE BOUTON DÉMARRER
window.isNavigating = false;
let isFirstLoad = true;


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
            enableHighAccuracy:true,
            maximumAge:1000,
            timeout:10000
        }
    );
}

// ----------------------------
function startCompass(){
    window.addEventListener("deviceorientation", function(event){
        if(event.alpha !== null){
            currentHeading = 360 - event.alpha;
            updateBikeArrow();
        }
    }, true);
}

// ----------------------------
function onPositionUpdate(position){
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    // 🔥 STOCKAGE GLOBAL
    window.userPosition = [lat, lon];
    console.log("Position stockée :", window.userPosition);
    console.log("Position :", lat, lon);

    if(!window.map){
        console.error("map NON prête");
        return;
    }

    updateBikeArrowPosition(lat, lon);

    // 🔥 AMÉLIORATION SÉCURISÉE :
    // 1. Cadre sur vous au tout premier démarrage de l'application
    if (isFirstLoad) {
        window.map.setView([lat, lon], 16);
        isFirstLoad = false;
    }

    // 2. Suit vos mouvements uniquement si vous avez cliqué sur "Démarrer"
    if (window.isNavigating) {
        window.map.setView([lat, lon], 17);
    }
}

// ----------------------------
function updateBikeArrowPosition(lat, lon){
    if(!bikeArrow){
        bikeArrow = L.marker([lat,lon], {
            icon: L.divIcon({
                className:"bike-icon",
                html:`
                <div style="
                transform:rotate(${currentHeading}deg);
                font-size:32px;
                color:blue;">
                ➤
                </div>`,
                iconSize:[40,40],
                iconAnchor:[20,20]
            })
        }).addTo(window.map);
    }
    else{
        bikeArrow.setLatLng([lat,lon]);
        updateBikeArrow();
    }
}

// ----------------------------
function updateBikeArrow(){
    if(!bikeArrow) return;

    const icon = L.divIcon({
        className:"bike-icon",
        html:`
        <div style="
        transform:rotate(${currentHeading}deg);
        font-size:32px;
        color:blue;">
        ➤
        </div>`,
        iconSize:[40,40],
        iconAnchor:[20,20]
    });

    bikeArrow.setIcon(icon);
}
