alert("search.js chargé");

window.destination = null;

function searchDestination(){

    const rawQuery = document.getElementById("destination").value.trim();

    if(rawQuery.length < 3) return;

    const domaineApi = "pho" + "ton" + ".komoot.io";
    let urlComplete = "";

    // 🔥 DECOUPAGE INTELLIGENT DE L'ADRESSE
    // Cherche si la ligne commence par un numéro suivi d'une rue (ex: "12 rue de la paix paris")
    const matchAdresse = rawQuery.match(/^(\d+)\s+(.+)$/);

    if (matchAdresse) {
        const numero = matchAdresse[1]; // Ex: "12"
        const reste = matchAdresse[2];   // Ex: "rue de la paix paris"
        
        // On bascule sur l'endpoint /structured pour forcer la reconnaissance du numéro de maison
        urlComplete = `https://${domaineApi}/structured?street=${encodeURIComponent(reste)}&housenumber=${encodeURIComponent(numero)}&limit=5&lang=fr`;
    } else {
        // Si l'utilisateur n'écrit pas de numéro, on utilise la recherche classique d'origine
        urlComplete = `https://${domaineApi}/api/?q=${encodeURIComponent(rawQuery)}&limit=5&lang=fr`;
    }

    // Ajout de la priorité locale géographique si le GPS est prêt
    if (window.userPosition && window.userPosition[0]) {
        urlComplete += `&lat=${window.userPosition[0]}&lon=${window.userPosition[1]}`;
    }

    fetch(urlComplete)
        .then(res => res.json())
        .then(data => {

            const container = document.getElementById("suggestions");
            container.innerHTML = "";

            const uniqueAddresses = new Set();

            if (!data.features || data.features.length === 0) {
                console.log("Aucun résultat trouvé pour cette adresse.");
                return;
            }

            data.features.forEach(place => {

                const name = place.properties.name || "";
                const housenumber = place.properties.housenumber || ""; 
                const city = place.properties.city || "";

                // Reconstruction propre pour l'affichage (Numéro Rue Ville)
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
