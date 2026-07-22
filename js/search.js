alert("search.js chargé");

window.destination = null;

function searchDestination(){

    let query = document.getElementById("destination").value.trim();

    if(query.length < 3) return;

    // 🔥 CORRECTIF CRITIQUE : Si la recherche commence par un numéro (ex: "12 rue de la paix")
    // On détecte le numéro et on le bascule à la fin pour que l'API Photon comprenne à 100%
    const matchNumeroDebut = query.match(/^(\d+)\s+(.+)$/);
    if (matchNumeroDebut) {
        const numero = matchNumeroDebut[1]; // Capture le numéro (ex: "12")
        const resteAdresse = matchNumeroDebut[2]; // Capture la rue (ex: "rue de la paix")
        query = `${resteAdresse} ${numero}`; // Reconstruit l'adresse pour l'API -> "rue de la paix 12"
        console.log("Adresse formatée pour Photon :", query);
    }

    const domaineApi = "pho" + "ton" + ".komoot.io";
    
    let parametresGeo = "";
    if (window.userPosition && window.userPosition[0] && window.userPosition[1]) {
        parametresGeo = `&lat=${window.userPosition[0]}&lon=${window.userPosition[1]}`;
    }

    const urlComplete = `https://${domaineApi}/api/?q=${encodeURIComponent(query)}&limit=5&lang=fr${parametresGeo}`;

    fetch(urlComplete)
        .then(res => res.json())
        .then(data => {

            const container = document.getElementById("suggestions");
            container.innerHTML = "";

            const uniqueAddresses = new Set();

            data.features.forEach(place => {

                const name = place.properties.name || "";
                const housenumber = place.properties.housenumber || ""; 
                const city = place.properties.city || "";

                // Reconstruction propre de l'affichage pour l'utilisateur (Numéro Rue Ville)
                let full = "";
                if (housenumber && !name.includes(housenumber)) {
                    full = housenumber + " " + name + " " + city;
                } else {
                    full = name + " " + city;
                }

                full = full.replace(/\s+/g, ' ').trim();

                if (!full) full = "Lieu inconnu";

                if (uniqueAddresses.has(full)) {
                    return; 
                }
                uniqueAddresses.add(full);

                const div = document.createElement("div");
                div.innerHTML = full;
                div.style.padding = "10px";
                div.style.cursor = "pointer";

                div.onclick = function(){
                    window.destination = {
                        lat: place.geometry.coordinates[1], 
                        lon: place.geometry.coordinates[0]  
                    };

                    document.getElementById("destination").value = full;
                    container.innerHTML = "";
                    
                    console.log("Destination enregistrée :", window.destination);
                };

                container.appendChild(div);
            });
        })
        .catch(err => console.error("Erreur réseau API :", err));
}
