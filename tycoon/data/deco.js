// Décoration du magasin — modifiable sans toucher au code.
//
// Chaque objet rapporte des points d'ambiance (pts). L'ambiance du magasin va de 0 à 100 % :
//   ambiance = 1 − exp(−points / (echelle × taille du local))  → les premiers objets comptent le plus.
// Effets à 100 % d'ambiance (bonus modérés) :
//   conversion : les clients achètent un peu plus volontiers
//   reputation : les gains de réputation sont plus forts
//   patience   : (avec les objets « attente ») les clients attendent plus longtemps
//   affluence  : (avec les objets « vitrine ») plus de passants entrent
//   themes     : un coin à thème attire son public et le fait acheter un peu plus
// taille : [largeur, profondeur] en cases ; entretien : coût par mois (électricité, consommables).
window.TMI_DATA = window.TMI_DATA || {};

TMI_DATA.deco = {
  echelle: 14,
  tailleLocal: { petit: 1, moyen: 1.4, grand: 1.8 },
  effets: { conversion: 0.08, reputation: 0.3, patienceAmbiance: 0.15, patienceAttente: 0.2, ptsAttente: 6,
            affluenceVitrine: 0.1, ptsVitrine: 6, themeConversion: 0.12, themeProfil: 0.3, ptsTheme: 4 },
  revente: 0.5,           // part du prix récupérée en revendant (et au déménagement)

  sols: {
    carrelage: { nom: "Carrelage clair", prix: 0, pts: 0, c1: "#e9eef5", c2: "#dde4ee" },
    parquet:   { nom: "Parquet chêne", prix: 2500, pts: 3, c1: "#c99a6b", c2: "#b88a5c", motif: "lames" },
    beton:     { nom: "Béton ciré", prix: 3500, pts: 4, c1: "#b9bec6", c2: "#b1b6be", motif: "uni" },
    gaming:    { nom: "Sol gaming LED", prix: 6000, pts: 5, c1: "#23263a", c2: "#2b2f48", motif: "led", theme: "joueurs", entretien: 40 }
  },
  murs: {
    blanc:   { nom: "Blanc", prix: 0, pts: 0, c: "#eef2f8" },
    nuit:    { nom: "Bleu nuit", prix: 800, pts: 1, c: "#2d3a5c" },
    sauge:   { nom: "Vert sauge", prix: 800, pts: 1, c: "#a9c2a6" },
    terra:   { nom: "Terracotta", prix: 800, pts: 1, c: "#d39a7b" },
    brique:  { nom: "Brique", prix: 2000, pts: 2, c: "#b5654a", motif: "brique" }
  },

  familles: { mobilier: "Mobilier", lumiere: "Lumière", affichage: "Affichage", theme: "Coins à thème", mural: "Aux murs : néons, affiches, écrans" },
  objets: {
    plante:      { nom: "Plante", famille: "mobilier", prix: 150, pts: 1, taille: [1, 1] },
    grande_plante: { nom: "Grande plante", famille: "mobilier", prix: 400, pts: 2, taille: [1, 1] },
    banc:        { nom: "Banc", famille: "mobilier", prix: 500, pts: 1, taille: [2, 1], effet: "attente" },
    canape:      { nom: "Canapé d'attente", famille: "mobilier", prix: 1200, pts: 3, taille: [2, 1], effet: "attente" },
    cafe:        { nom: "Borne café", famille: "mobilier", prix: 900, pts: 2, taille: [1, 1], effet: "attente", entretien: 20 },
    aquarium:    { nom: "Aquarium", famille: "mobilier", prix: 2200, pts: 3, taille: [1, 1], entretien: 15 },
    lampadaire:  { nom: "Lampadaire", famille: "lumiere", prix: 350, pts: 1, taille: [1, 1], entretien: 8 },
    neon:        { nom: "Néon sur pied", famille: "lumiere", prix: 1500, pts: 3, taille: [1, 1], effet: "vitrine", entretien: 25 },
    chevalet:    { nom: "Affiche promo", famille: "affichage", prix: 200, pts: 1, taille: [1, 1], effet: "vitrine" },
    ecran_pub:   { nom: "Écran publicitaire", famille: "affichage", prix: 2500, pts: 3, taille: [1, 1], effet: "vitrine", entretien: 40 },
    borne_jeu:   { nom: "Borne d'arcade", famille: "affichage", prix: 3000, pts: 3, taille: [1, 1], theme: "joueurs", entretien: 15 },
    coin_gaming: { nom: "Coin gaming", famille: "theme", prix: 4500, pts: 4, taille: [2, 2], theme: "joueurs", entretien: 30,
                   texte: "Fauteuil et PC RGB : attire les joueurs." },
    coin_pro:    { nom: "Coin pro", famille: "theme", prix: 4000, pts: 4, taille: [2, 2], theme: "professionnels", entretien: 20,
                   texte: "Bureau et double écran : rassure les professionnels." },
    coin_etudiant: { nom: "Coin étudiant", famille: "theme", prix: 2500, pts: 3, taille: [2, 2], theme: "etudiants", entretien: 10,
                   texte: "Table haute, poufs et prises : les étudiants s'y installent." },
    coin_famille: { nom: "Espace enfants", famille: "theme", prix: 2000, pts: 3, taille: [2, 2], theme: "familles",
                   texte: "Tapis de jeu et cubes : les parents prennent leur temps." }
  },
  // Objets muraux (mur: true) : taille = [largeur, hauteur] en mètres, haut = hauteur du centre.
  // Ils se posent sur les murs nord, ouest et est de la salle (pas sur la vitrine).
  // neon : couleur de la lueur (le néon éclaire le mur autour de lui).
  muraux: {
    affiche_jeu:   { nom: "Affiche de jeu", famille: "mural", prix: 150, pts: 1, taille: [0.9, 1.25], haut: 1.9, mur: true, theme: "joueurs" },
    affiche_promo: { nom: "Affiche promo", famille: "mural", prix: 150, pts: 1, taille: [0.9, 1.25], haut: 1.9, mur: true, effet: "vitrine" },
    cadre_employe: { nom: "Employé du mois", famille: "mural", prix: 120, pts: 1, taille: [0.7, 0.85], haut: 1.75, mur: true },
    tableau:       { nom: "Tableau moderne", famille: "mural", prix: 600, pts: 2, taille: [1.5, 1.0], haut: 1.9, mur: true },
    etagere_murale:{ nom: "Étagère murale", famille: "mural", prix: 450, pts: 1, taille: [1.8, 0.9], haut: 1.85, mur: true,
                     texte: "Figurines, plantes et vieux PC de collection." },
    ecran_mural:   { nom: "Écran mural", famille: "mural", prix: 1800, pts: 3, taille: [1.7, 1.0], haut: 2.0, mur: true, effet: "vitrine", entretien: 30 },
    ruban_led:     { nom: "Ruban LED", famille: "mural", prix: 600, pts: 2, taille: [3, 0.15], haut: 2.78, mur: true, entretien: 10, neon: "#3dd6ff" },
    neon_eclair:   { nom: "Néon éclair", famille: "mural", prix: 900, pts: 2, taille: [0.8, 1.2], haut: 2.0, mur: true, entretien: 10, neon: "#ffd23d" },
    neon_gameon:   { nom: "Néon GAME ON", famille: "mural", prix: 1400, pts: 3, taille: [2.0, 0.8], haut: 2.15, mur: true, theme: "joueurs", entretien: 15, neon: "#ff3d9a" },
    neon_bienvenue:{ nom: "Néon « Bienvenue »", famille: "mural", prix: 1200, pts: 3, taille: [2.4, 0.7], haut: 2.2, mur: true, effet: "vitrine", entretien: 15, neon: "#7a5cff" },
    neon_coeur:    { nom: "Néon cœur pixel", famille: "mural", prix: 800, pts: 2, taille: [0.9, 0.8], haut: 2.0, mur: true, entretien: 10, neon: "#ff4d6d" }
  },

  // Déco offerte à l'ouverture d'un magasin
  depart: [{ type: "plante", coin: "so" }, { type: "plante", coin: "se" }]
};

// Les objets muraux font partie du même catalogue
Object.keys(TMI_DATA.deco.muraux).forEach(function (k) { TMI_DATA.deco.objets[k] = TMI_DATA.deco.muraux[k]; });
