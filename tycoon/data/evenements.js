// Événements — modifiable sans toucher au code.
// Le calendrier du jeu commence en mars (config.temps.moisDepart). Un mois de jeu = 28 jours.
//
// Effets possibles d'un événement :
//   affluence  : multiplie le nombre de clients (1.2 = +20 %)
//   profils    : multiplie la part d'un profil de client ({ etudiants: 1.8 })
//   envies     : multiplie l'envie pour un type de produit ({ portable_bureau: 1.5 })
//   prix       : multiplie le prix du marché d'un type de produit : coût d'achat ET prix de référence des clients
//   delai      : jours de livraison en plus pour ces types de produits
//   sensibilite: multiplie la sensibilité au prix des clients (1.4 = ils comparent davantage)
//   reputation : points de réputation gagnés au début de l'événement
window.TMI_DATA = window.TMI_DATA || {};

TMI_DATA.evenements = {
  annonceJours: 7,        // les événements de saison sont annoncés une semaine avant

  // Chaque année, aux mêmes dates (mois : 1 = janvier ; jours : du … au … du mois de 28 jours)
  saisons: [
    { id: "soldes", nom: "Soldes d'hiver", mois: 1, jours: [8, 28],
      texte: "Plus de monde en boutique, mais les clients guettent les bonnes affaires.",
      affluence: 1.2, sensibilite: 1.3 },
    { id: "ete", nom: "Creux de l'été", mois: 8, jours: [1, 28],
      texte: "Beaucoup de clients sont en vacances : la boutique est plus calme.",
      affluence: 0.75 },
    { id: "rentree", nom: "Rentrée scolaire", mois: 9, jours: [1, 21],
      texte: "Les étudiants s'équipent : portables, claviers et casques partent vite.",
      affluence: 1.15, profils: { etudiants: 1.8 }, envies: { portable_bureau: 1.6, clavier_souris: 1.3, casque: 1.2 } },
    { id: "blackfriday", nom: "Black Friday", mois: 11, jours: [22, 28],
      texte: "Affluence record ! Les clients comparent les prix plus que d'habitude.",
      affluence: 1.7, sensibilite: 1.4 },
    { id: "noel", nom: "Fêtes de fin d'année", mois: 12, jours: [1, 24],
      texte: "Les familles achètent leurs cadeaux : PC gaming, écrans, casques et claviers.",
      affluence: 1.35, profils: { familles: 1.6 }, envies: { portable_gaming: 1.5, casque: 1.4, ecran: 1.3, clavier_souris: 1.3 } }
  ],

  // Tirés au hasard (un seul à la fois, jamais pendant le premier mois)
  chanceParMois: 0.7,
  aleatoires: [
    { id: "penurie_gpu", nom: "Pénurie de cartes graphiques", poids: 3, duree: [21, 42], annonce: 7,
      annonceTexte: "Rumeur chez ton fournisseur : les usines de cartes graphiques tournent au ralenti. Une pénurie se prépare dans une semaine : c'est le moment de faire du stock.",
      texte: "Les cartes graphiques et les PC gaming coûtent plus cher et les livraisons traînent. Ton stock acheté avant la crise vaut de l'or.",
      prix: { carte_graphique: 1.45, portable_gaming: 1.25 }, delai: { carte_graphique: 3, portable_gaming: 2 }, envies: { carte_graphique: 0.8 } },
    { id: "penurie_memoire", nom: "Pénurie de mémoire", poids: 2, duree: [21, 35], annonce: 7,
      annonceTexte: "Rumeur chez ton fournisseur : la mémoire et les SSD vont manquer d'ici une semaine.",
      texte: "La mémoire vive et les SSD coûtent plus cher et arrivent plus tard.",
      prix: { ram: 1.5, ssd: 1.35 }, delai: { ram: 2, ssd: 2 } },
    { id: "promo", nom: "Promo du fournisseur", poids: 3, duree: [7, 7], annonce: 0,
      categorieAuHasard: true, remise: 0.85,
      texte: "Ton fournisseur fait −15 % sur une catégorie pendant une semaine : idéal pour remplir la réserve." },
    { id: "jeu", nom: "Sortie d'un jeu très attendu", poids: 2, duree: [14, 14], annonce: 5,
      annonceTexte: "Un jeu très attendu sort dans quelques jours : les joueurs vont vouloir s'équiper.",
      texte: "Les joueurs se ruent sur les cartes graphiques, les PC gaming et les casques.",
      profils: { joueurs: 1.6 }, envies: { carte_graphique: 1.6, portable_gaming: 1.4, casque: 1.2 } },
    { id: "presse", nom: "Article dans le journal local", poids: 2, duree: [7, 7], annonce: 0, reputationMin: 55,
      texte: "Le journal local parle de ta boutique : plus de passage cette semaine et un coup de pouce à la réputation.",
      affluence: 1.25, reputation: 3 }
  ]
};
