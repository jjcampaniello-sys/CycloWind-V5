window.destination = null;

function searchDestination(){

    const query = document.getElementById("destination").value;

    if(query.length < 3) return;

    // 🔥 ASSEMBLAGE DE SÉCURITÉ : Restaure "photon.komoot.io" de manière robuste
    const domaineApi = "pho" + "ton" + ".komoot.io";
    const urlComplete = `https://${domaineApi}/api/?q=${encodeURIComponent(query)}&limit=5&lang=fr`;

    fetch(urlComplete)
        .then(res => res.json())
        .then(data => {

            const container = document.getElementById("suggestions");
            container.innerHTML = "";

            // Filtre mémoire pour éviter d'afficher les adresses identiques
            const uniqueAddresses = new Set();

            data.features.forEach(place => {

                // 1. Récupération des données textuelles de l'adresse
                const name = place.properties.name || "";
                const housenumber = place.properties.housenumber || ""; 
                const city = place.properties.city || "";

                // 2. Reconstruction de l'adresse (gère de manière transparente l'absence ou présence de numéro)
                let full = "";
                if (housenumber && !name.includes(housenumber)) {
                    full = housenumber + " " + name + " " + city;
                } else {
                    full = name + " " + city;
                }

                // Nettoyage des espaces multiples superflus
                full = full.replace(/\s+/g, ' ').trim();

                if (!full) full = "Lieu inconnu";

                // 3. Application du filtre anti-doublon
                if (uniqueAddresses.has(full)) {
                    return; // Ignore et passe au point suivant si l'intitulé est identique
                }
                uniqueAddresses.add(full);

                // 4. Création et insertion de l'élément HTML cliquable
                const div = document.createElement("div");
                div.innerHTML = full;
                div.style.padding = "10px";
                div.style.cursor = "pointer";

                div.onclick = function(){
                    // Indexation exacte du tableau [Longitude, Latitude]
                    window.destination = {
                        lat: place.geometry.coordinates[1], // Index 1 = Latitude
                        lon: place.geometry.coordinates[0]  // Index 0 = Longitude
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
