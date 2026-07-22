alert("search.js chargé");

window.destination = null;

function searchDestination(){

    const query = document.getElementById("destination").value;

    if(query.length < 3) return;

    // 1. Définition du domaine pour l'API
    const domaineApi = "pho" + "ton" + ".komoot.io";
    
    // 2. 🔥 AJOUT DU FILTRE GEOGRAPHIQUE (Location Bias)
    // Si la position GPS de l'utilisateur est déjà connue, on l'envoie à l'API pour cibler sa ville/quartier
    let parametresGeo = "";
    if (window.userPosition && window.userPosition[0] && window.userPosition[1]) {
        const lat = window.userPosition[0];
        const lon = window.userPosition[1];
        parametresGeo = `&lat=${lat}&lon=${lon}`; // Centre la recherche sur vous
    }

    // 3. Construction de l'URL finale avec les filtres géographiques inclus
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
                    
                    console.log("Destination enregistrée avec succès :", window.destination);
                };

                container.appendChild(div);
            });
        })
        .catch(err => console.error("Erreur réseau API :", err));
}
