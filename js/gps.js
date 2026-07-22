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

    window.userPosition = [lat, lon];
    console.log("Position stockée :", window.userPosition);

    if(!window.map){
        console.error("map NON prête");
        return;
    }

    updateBikeArrowPosition(lat, lon);

    if (isFirstLoad) {
        window.map.setView([lat, lon], 16);
        isFirstLoad = false;
    }

    // Suivi régulier en navigation avec décalage de pixels
    if (window.isNavigating) {
        window.map.setView([lat, lon], 16, { animate: false });
        window.map.panBy([0, -85], { animate: false });
    }
}

function updateBikeArrowPosition(lat, lon){
    if(!bikeArrow){
        bikeArrow = L.marker([lat, lon], {
            icon: L.divIcon({
                className: "bike-icon",
                html: `
                <div style="transform:rotate(${currentHeading}deg); font-size:32px; color:blue;">
                ➤
                </div>`,
                iconSize: [40, 40], // 🔥 RÉPARÉ
                iconAnchor: [20, 20] // 🔥 RÉPARÉ
            })
        }).addTo(window.map);
    } else {
        bikeArrow.setLatLng([lat, lon]);
        updateBikeArrow();
    }
}

function updateBikeArrow(){
    if(!bikeArrow) return;

    const icon = L.divIcon({
        className: "bike-icon",
        html: `
        <div style="transform:rotate(${currentHeading}deg); font-size:32px; color:blue;">
        ➤
        </div>`,
        iconSize: [40, 40], // 🔥 RÉPARÉ
        iconAnchor: [20, 20] // 🔥 RÉPARÉ
    });

    bikeArrow.setIcon(icon);
}
