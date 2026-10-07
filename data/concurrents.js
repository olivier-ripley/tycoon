// Enseignes concurrentes — modifiable sans toucher au code.
// La moitié de la concurrence d'une ville (typesVilles.concurrence) vient de petits indépendants invisibles ;
// l'autre moitié est remplacée par les vrais magasins des enseignes ci-dessous, qui bougent au fil des mois.
//
// logo : image carrée facultative (PNG, fond transparent) ; tant que le fichier n'existe pas, le jeu affiche l'initiale sur la couleur.
//
// Force d'un magasin rival : 0 à 100. À force 50, il retire « impact » de clients à ta boutique de la ville
// (0.10 = −10 %). Il ferme quand sa force passe sous « forceFermeture ».
window.TMI_DATA = window.TMI_DATA || {};

TMI_DATA.concurrents = {
  chaines: [
    { id: "megapc", logo: "img/rivaux/megapc.png", nom: "MégaPC", initiale: "M", couleur: "#e8504a", style: "Discount",
      texte: "Prix cassés et peu de conseil : ses clients comparent les prix.",
      impact: 0.09, pressionPrix: 0.25,                    // à force 50 : les clients de la ville sont 25 % plus sensibles au prix
      villes: { petite: 0.6, moyenne: 1, grande: 1, paris: 1 } },
    { id: "technoplus", logo: "img/rivaux/technoplus.png", nom: "TechnoPlus", initiale: "T", couleur: "#6c5ce7", style: "Grande surface",
      texte: "Grands magasins high-tech dans les grandes villes : il attire le plus de monde.",
      impact: 0.12, pressionPrix: 0,
      villes: { petite: 0.1, moyenne: 0.5, grande: 1.4, paris: 1.6 } },
    { id: "infoproxi", logo: "img/rivaux/infoproxi.png", nom: "Info Proxi", initiale: "P", couleur: "#2bb3b1", style: "Proximité",
      texte: "Petites boutiques de quartier, jusque dans les petites villes.",
      impact: 0.08, pressionPrix: 0,
      villes: { petite: 1.4, moyenne: 1.2, grande: 0.7, paris: 0.6 } }
  ],
  partRivaux: 0.5,                 // part de la concurrence d'une ville remplacée par les magasins rivaux
  depart: { petite: 0.5, moyenne: 1.1, grande: 1.6, paris: 1.8 },   // magasins rivaux par ville en début de partie (en moyenne)
  forceDepart: [35, 65],
  forceDepartChezToi: 45,          // dans ta ville de départ, les rivaux démarrent au plus à cette force
  graceMois: 6,                    // pendant les premiers mois : ni soldes ni nouveau rival dans tes villes
  maxParVille: 3,
  // Chaque mois
  croissance: 1,                   // force gagnée par mois (± hasard)
  hasard: 2.5,
  pressionReputation: 0.15,        // dans une ville où tu as un magasin : force perdue par point de réputation au-dessus de 50
  forceFermeture: 12,
  ouvertureParMois: 0.12,          // chance par enseigne et par mois d'ouvrir un magasin (× rythme de la difficulté)
  attraitTesVilles: 2.5,           // les rivaux préfèrent s'installer là où tu es
  poidsVilles: { petite: 0.6, moyenne: 1, grande: 1.6, paris: 2 },
  soldes: { chanceParVille: 0.12, jours: 7, impact: 0.08 },   // soldes d'un rival dans une de tes villes
  // Rachat d'un magasin rival (à partir du palier 2)
  rachat: { palierMin: 2, base: 12000, parForce: 300, moisLoyer: 4, reputation: 6 }
};
