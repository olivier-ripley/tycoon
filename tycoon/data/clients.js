// Profils de clients — modifiable sans toucher au code.
// conversion : chance de base d'acheter ; sensibilitePrix : plus c'est haut, plus un prix au-dessus
// de la référence fait fuir ; patience : minutes d'attente avant de partir ;
// envies : poids de chaque type de produit ; gammes : poids entrée / milieu / haut.
window.TMI_DATA = window.TMI_DATA || {};

TMI_DATA.profilsClients = {
  etudiants: {
    nom: "Étudiants", couleur: "#3b82f6",
    conversion: 0.55, sensibilitePrix: 6, patience: 22,
    envies: { portable_bureau: 5, portable_gaming: 2, ecran: 1, clavier_souris: 2, casque: 2, ssd: 1 },
    gammes: [0.6, 0.35, 0.05]
  },
  joueurs: {
    nom: "Joueurs", couleur: "#a855f7",
    conversion: 0.5, sensibilitePrix: 3, patience: 28,
    envies: { portable_gaming: 3, carte_graphique: 4, processeur: 2, ram: 2, ssd: 2, ecran: 2, clavier_souris: 2, casque: 2 },
    gammes: [0.25, 0.5, 0.25]
  },
  professionnels: {
    nom: "Professionnels", couleur: "#0f766e",
    conversion: 0.6, sensibilitePrix: 2, patience: 15,
    envies: { portable_bureau: 4, pc_fixe: 3, processeur: 1, ram: 1, ssd: 1, ecran: 2, clavier_souris: 1 },
    gammes: [0.2, 0.5, 0.3]
  },
  familles: {
    nom: "Familles et particuliers", couleur: "#ea580c",
    conversion: 0.55, sensibilitePrix: 4, patience: 24,
    envies: { portable_bureau: 3, pc_fixe: 3, ecran: 1, clavier_souris: 1, casque: 1, ssd: 1 },
    gammes: [0.5, 0.4, 0.1]
  }
};

// Part du profil dominant de la ville dans la clientèle (le reste se partage entre les autres).
TMI_DATA.partProfilDominant = 0.4;

// Atelier : montage de PC sur mesure — modifiable sans toucher au code.
// Un PC sur mesure = processeur + carte graphique + mémoire vive + SSD pris dans le stock.
// Carte mère, boîtier et alimentation sont compris dans le forfait (coût et prix selon la gamme du processeur).
TMI_DATA.montage = {
  composants: ["processeur", "carte_graphique", "ram", "ssd"],
  // exigences : écart de gamme minimum par rapport à la gamme visée par le client (null = peu importe).
  // sensibilite : plus c'est haut, plus un prix au-dessus du budget fait refuser.
  usages: {
    jeu:         { nom: "Jeu",         exigences: { carte_graphique: 0, processeur: -1, ram: -1, ssd: -1 }, sensibilite: 5 },
    bureautique: { nom: "Bureautique", exigences: { processeur: 0, ssd: 0, ram: -1, carte_graphique: null }, sensibilite: 6 },
    etudes:      { nom: "Études",      exigences: { processeur: -1, carte_graphique: -1, ram: -1, ssd: -1 }, sensibilite: 8 }
  },
  usagesParProfil: {
    joueurs:        { jeu: 85, etudes: 10, bureautique: 5 },
    etudiants:      { etudes: 55, jeu: 35, bureautique: 10 },
    professionnels: { bureautique: 80, jeu: 10, etudes: 10 },
    familles:       { bureautique: 45, etudes: 30, jeu: 25 }
  },
  attraitProfil: { joueurs: 1.6, etudiants: 1.1, professionnels: 0.8, familles: 0.9 },  // selon la clientèle dominante de la ville
  demandesParClient: 0.022,    // demandes de montage pour un client attendu en boutique
  maxDemandes: 4,              // demandes en attente de réponse au maximum
  dureeDemandeJours: 2,        // le client attend ta proposition jusqu'au soir du surlendemain
  essais: 2,                   // propositions possibles avant que le client renonce
  delaiJours: 3,               // PC à livrer au plus tard le soir du 3e jour
  dureeMontage: 300,           // minutes de travail à vitesse ×1
  dureeSav: 120,
  forfait:    [170, 240, 330], // prix de référence du forfait montage (entrée / milieu / haut)
  coutInclus: [100, 150, 220], // coût de la carte mère, du boîtier et de l'alimentation
  erreurParNiveau: [0.18, 0.12, 0.07, 0.04, 0.02],   // risque qu'un PC revienne en SAV, niveau 1 à 5
  retourSavJours: [1, 3],
  chancePiece: 0.5,            // chance qu'un SAV demande une pièce neuve (payée au prix d'achat)
  remiseRetard: 0.1,
  pannes: ["ne démarre plus", "écran noir au démarrage", "plante en pleine partie", "chauffe et s'éteint", "câble mal branché"],
  reputation: { livraison: 0.4, retard: -2, retourSav: -2.5, savTermine: 0.5, sansReponse: -0.3, insuffisant: -0.2 }
};

// Publicité — modifiable sans toucher au code.
// L'effet d'une campagne = effetMax × (1 − e^(−budgetParJour ÷ (echelle × facteur de la ville))) :
// les premiers euros rapportent beaucoup, les suivants de moins en moins.
// effetMax 0,3 = jusqu'à +30 % de clients en boutique ; atelier = part de cet effet sur les demandes de l'atelier.
TMI_DATA.publicite = {
  types: {
    tracts: { nom: "Tracts et affichage local", detail: "Distribués dans le quartier : peu cher, effet modéré.", effetMax: 0.3, echelle: 35,  atelier: 0.25,
              budgetDefaut: 500,  budgetMin: 100, budgetMax: 3000 },
    radio:  { nom: "Journal ou radio locale",   detail: "Toute la ville l'entend : plus cher, effet fort, l'atelier aussi en profite.", effetMax: 0.8, echelle: 140, atelier: 0.5,
              budgetDefaut: 2000, budgetMin: 500, budgetMax: 12000 }
  },
  durees: [7, 14, 28],
  dureeDefaut: 14,
  facteurVille: { petite: 0.6, moyenne: 1, grande: 1.6, paris: 2.6 },  // une grande ville coûte plus cher à toucher
  montee: 2,       // jours pour atteindre le plein effet
  traine: 3,       // jours pendant lesquels l'effet s'estompe après la fin
  cibleSurProfil: 0.75   // part des clients attirés qui ont le profil visé (le reste : tout profil)
};

// Atelier : réparations et garantie — modifiable sans toucher au code.
// prixRef : tarif habituel de la main-d'œuvre (€) ; cout : consommables (€) ; duree : minutes à vitesse ×1 ;
// delai : jours promis au client ; niveauMin : niveau de technicien exigé ; part : part des demandes.
TMI_DATA.reparations = {
  types: {
    logiciel:  { nom: "Logiciel",                detail: "Virus, lenteurs, réinstallation du système", prixRef: 60,  cout: 5,  duree: 60,  delai: 1, niveauMin: 1, part: 40 },
    nettoyage: { nom: "Nettoyage et entretien",  detail: "Dépoussiérage, pâte thermique",              prixRef: 40,  cout: 8,  duree: 40,  delai: 1, niveauMin: 1, part: 25 },
    piece:     { nom: "Remplacement de pièce",   detail: "SSD, mémoire ou carte graphique prise dans ton stock (facturée en plus)", prixRef: 50, cout: 5, duree: 90, delai: 2, niveauMin: 1, part: 25 },
    donnees:   { nom: "Récupération de données", detail: "Sauvetage de fichiers sur un disque abîmé",  prixRef: 250, cout: 20, duree: 360, delai: 4, niveauMin: 3, part: 10 }
  },
  piecesRemplacees: { ssd: 50, ram: 35, carte_graphique: 15 },   // quelle pièce change le client
  demandesParClient: 0.06,     // réparations déposées pour un client attendu en boutique
  sensibilitePrix: 3,          // plus c est haut, plus un tarif au-dessus du marché fait fuir
  bonusPetitPrix: 0.8,         // un tarif bas attire plus de monde (jusqu'à +30 %)
  limitesFile: [3, 6, 10, 99], // choix proposés : ne plus rien prendre au-delà de N travaux en file
  limiteFileDefaut: 6,
  erreurFacteur: 0.6,          // risque d'erreur d'une réparation = risque d'un montage × ce facteur
  remiseRetard: 0.1,
  pannes: ["ne démarre plus", "redevient lent", "fait un bruit anormal", "écran bleu au démarrage", "chauffe à nouveau"],
  garantie: {
    chance: 0.03,                                           // part des ordinateurs et écrans vendus qui reviennent
    categories: ["ordinateurs"], types: ["ecran"],
    jours: [3, 20],                                          // délai avant le retour
    chancePiece: 0.4
  },
  reputation: { aLHeure: 0.2, retard: -1.5, retourSav: -1.5, refusPlein: -0.05 }
};
