// Catalogue de produits — modifiable sans toucher au code.
// prix = prix de vente de référence (€) pour les gammes entrée / milieu / haut.
// Le coût d'achat est calculé à partir de la marge par défaut de la catégorie (voir config.js).
// Toutes les marques sont fictives.
window.TMI_DATA = window.TMI_DATA || {};

TMI_DATA.categories = {
  ordinateurs:   { nom: "Portables et PC fixes",     conseil: true  },
  composants:    { nom: "Composants",                conseil: true  },
  peripheriques: { nom: "Périphériques et écrans",   conseil: false }
};

TMI_DATA.gammes = ["Entrée", "Milieu", "Haut"];

TMI_DATA.typesProduits = [
  { id: "portable_bureau", nom: "Portable bureautique",     categorie: "ordinateurs",   prix: [350, 600, 900],
    marques: ["Lumio Nova 14", "Lumio Nova 15 Plus", "Lumio Nova Prime 16"],                    courts: ["Nova 14", "Nova 15+", "Nova Prime"] },
  { id: "portable_gaming", nom: "Portable gaming",          categorie: "ordinateurs",   prix: [800, 1300, 2000],
    marques: ["Drakor Blaze 15 · VTX 3050", "Drakor Storm 16 · VTX 4060", "Drakor Overlord 18 · VTX 4080"], courts: ["Blaze 15", "Storm 16", "Overlord"] },
  { id: "pc_fixe",         nom: "PC fixe prêt à l'emploi",  categorie: "ordinateurs",   prix: [500, 900, 1500],
    marques: ["Bastion Home H3", "Bastion Studio S5", "Bastion Forge X9"],                       courts: ["Home H3", "Studio S5", "Forge X9"] },
  { id: "carte_graphique", nom: "Carte graphique",          categorie: "composants",    prix: [250, 550, 1200],
    marques: ["Voltix VTX 3050 8 Go", "Voltix VTX 4070 12 Go", "Voltix VTX 4090 24 Go"],         courts: ["VTX 3050", "VTX 4070", "VTX 4090"] },
  { id: "processeur",      nom: "Processeur",               categorie: "composants",    prix: [150, 300, 550],
    marques: ["Cortan K3 5300", "Cortan K5 7600", "Cortan K9 7950X"],                            courts: ["K3 5300", "K5 7600", "K9 7950X"] },
  { id: "ram",             nom: "Mémoire vive",             categorie: "composants",    prix: [40, 90, 180],
    marques: ["Memora Pulse 8 Go DDR4", "Memora Pulse 16 Go DDR5", "Memora Pulse RGB 32 Go DDR5"], courts: ["Pulse 8Go", "Pulse 16Go", "Pulse 32Go"] },
  { id: "ssd",             nom: "Stockage SSD",             categorie: "composants",    prix: [50, 110, 220],
    marques: ["Flashor Q1 500 Go", "Flashor Q3 1 To NVMe", "Flashor Q7 2 To NVMe"],              courts: ["Q1 500Go", "Q3 1To", "Q7 2To"] },
  { id: "ecran",           nom: "Écran",                    categorie: "peripheriques", prix: [120, 250, 500],
    marques: ["Optika V22 Full HD", "Optika V27 QHD 165 Hz", "Optika V32 4K"],                   courts: ["V22 FHD", "V27 QHD", "V32 4K"] },
  { id: "clavier_souris",  nom: "Clavier et souris",        categorie: "peripheriques", prix: [30, 80, 160],
    marques: ["Tapik Duo Basic", "Tapik Duo Silent", "Tapik Méca RGB"],                          courts: ["Duo Basic", "Duo Silent", "Méca RGB"] },
  { id: "casque",          nom: "Casque audio",             categorie: "peripheriques", prix: [30, 90, 200],
    marques: ["Auralis A1", "Auralis A3 Surround", "Auralis A7 Pro sans fil"],                   courts: ["Auralis A1", "Auralis A3", "Auralis A7"] }
];

// Fournisseurs : le prototype n'en utilise qu'un. Ajouter des lignes ici pour en proposer d'autres.
TMI_DATA.fournisseurs = [
  { id: "grossiste_centre", nom: "Grossiste Info Centre", delaiJours: 2, fiabilite: 0.9, remise: 0 }
];
