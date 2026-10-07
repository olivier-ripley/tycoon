// Réglages d'équilibrage — modifiable sans toucher au code.
window.TMI_DATA = window.TMI_DATA || {};

TMI_DATA.config = {
  // Comptes et sauvegarde en ligne (Supabase). La clé « publishable » est publique : elle peut être dans le jeu.
  // Ne jamais mettre ici la clé secrète (service_role).
  enLigne: {
    url: "https://fycvgbkykypnlyvegkje.supabase.co",
    cle: "sb_publishable_sR0kEkBlifnCtYFscCoW7Q_ZS-cojy9",
    table: "sauvegardes"
  },

  temps: {
    ouverture: 9 * 60,            // 9h00
    fermeture: 19 * 60,           // 19h00
    minutesParSecondeX1: 5,       // 600 min d'ouverture = 2 min réelles à ×1
    joursParMois: 28,             // 4 semaines
    nomsJours: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"],
    moisDepart: 3,                // la partie commence en mars
    nomsMois: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    affluenceJour: [0.85, 0.85, 1.0, 0.95, 1.1, 1.45, 0.8]
  },

  difficultes: {
    // rythme : délai entre deux ouvertures de magasin ; siege : frais de structure de l'enseigne
    facile:    { nom: "Facile",    budget: 40000, concurrence: -0.08, faillite: "pret", rythme: 0.75, siege: 0.75 },
    normal:    { nom: "Normal",    budget: 30000, concurrence: 0,     faillite: "fin",  rythme: 1,    siege: 1 },
    difficile: { nom: "Difficile", budget: 20000, concurrence: 0.08,  faillite: "fin",  rythme: 1.3,  siege: 1.4 }
  },

  departMinimum: 10000,   // trésorerie minimum après l'installation pour lancer une partie (premier stock)

  // Trois tailles de local. Le loyer de chaque ville est celui du petit local ; facteurLoyer le multiplie.
  // affluence : clients en plus grâce à une vitrine plus grande. On grandit en déménageant (bureau, onglet Local).
  locaux: {
    petit: { nom: "Petit local", emplacements: 8,  plan: [14, 10], capaciteClients: 10, amenagement: 3000,  charges: 350,  depotMoisLoyer: 2, facteurLoyer: 1,   affluence: 1 },
    moyen: { nom: "Local moyen", emplacements: 14, plan: [17, 13], capaciteClients: 18, amenagement: 9000,  charges: 650,  depotMoisLoyer: 2, facteurLoyer: 1.8, affluence: 1.25 },
    grand: { nom: "Grand local", emplacements: 20, plan: [22, 14], capaciteClients: 28, amenagement: 18000, charges: 1000, depotMoisLoyer: 2, facteurLoyer: 2.8, affluence: 1.5 }
  },
  ordreLocaux: ["petit", "moyen", "grand"],
  joursDemenagement: 2,          // boutique fermée pendant le déménagement (jours d'ouverture perdus)
  hausseLoyerAnnuelle: 0.03,     // le loyer augmente chaque année (12 mois de jeu)

  // Marge brute par défaut de chaque catégorie (le coût d'achat en découle).
  margesParDefaut: { ordinateurs: 0.14, composants: 0.12, peripheriques: 0.25 },
  margeMin: 0.0,
  margeMax: 0.45,

  postes: {
    vendeur:  { nom: "Vendeur",  salaireBase: 1800 },
    caissier: { nom: "Caissier", salaireBase: 1650 },
    technicien: { nom: "Technicien", salaireBase: 1950 },
    responsable: { nom: "Responsable", salaireBase: 2600, apartirDe: 2 }   // candidats dès le 2e magasin
  },
  // Pilotage automatique d'un magasin par son responsable
  pilotage: {
    stockCible: 6,          // unités visées par produit en rayon
    reserve: 5000,          // le responsable ne commande pas si la trésorerie passe sous ce seuil
    assortiment: 1          // gamme visée quand il remplit un rayon vide (0 entrée, 1 milieu, 2 haut)
  },
  hausseSalaireParNiveau: 0.12,
  seuilsXp: [0, 150, 450, 1000, 2000],     // XP pour atteindre les niveaux 1 à 5
  candidatsParSemaine: 4,

  durees: {            // minutes de jeu, avant la vitesse de l'employé
    parcourirMin: 4, parcourirMax: 10,
    conseil: 12,
    caisse: 3
  },

  reputation: {
    depart: 50,
    venteReussie: 0.05,
    bonusConseil: 0.04,
    departAttente: -1.5,
    introuvable: -0.02,
    tropCher: -0.1
  },

  pret: { montant: 10000, mensualite: 600, detteMax: 40000 },   // en facile ; au-delà de detteMax, la banque refuse : faillite

  // Ouvrir d'autres magasins (depuis la carte de France)
  expansion: {
    moisPositifs: 3,        // mois positifs de l'enseigne avant le deuxième magasin
    reputation: 60,         // réputation minimum dans au moins un magasin
    partReputation: 0.3,    // un nouveau magasin démarre à 50 + 30 % de l'avance de ton meilleur magasin
    stockConseille: 8000,   // budget de stock conseillé (affiché au joueur, non obligatoire)
    fraisOuverture: 20000,  // recrutement, travaux, enseigne lumineuse : en plus du dépôt et de l'aménagement
    delaiEntreOuvertures: 112, // jours minimum entre deux ouvertures (4 mois, selon la difficulté)
    fraisSiege: 800,        // frais de structure par mois et par magasin au-delà du premier (direction, comptabilité)…
    fraisSiegeHausse: 60    // …plus ce montant par magasin supplémentaire : un grand réseau coûte plus cher à piloter
  },
  paliers: {
    1: { nom: "Boutique de quartier" },
    2: { nom: "Enseigne locale", magasinsRegion: 3 },
    3: { nom: "Réseau régional", regions: 2, caAnnuel: 5000000 },   // magasins dans 2 régions et CA des 12 derniers mois
    4: { nom: "Leader national", regions: 9, reputationMoyenne: 70, caAnnuel: 20000000 }   // 9 régions sur 13, réputation moyenne 70, CA sur 12 mois
  },

  // Logistique (palier 3) : entrepôts régionaux et flotte de transport
  logistique: {
    entrepot: { amenagement: 15000, loyer: 2200, charges: 300, capacite: 1500, remiseGros: 0.08, minGros: 20 },
    vehicules: {
      camionnette: { nom: "Camionnette", prix: 24000, entretien: 350, capacite: 60,  portee: "region", panne: 0.015,
                     texte: "Petits volumes, dans la région de l'entrepôt. Livraison le lendemain." },
      camion:      { nom: "Camion",      prix: 65000, entretien: 900, capacite: 200, portee: "france", panne: 0.02,
                     texte: "Gros volumes, partout en France. Livraison le lendemain dans la région, en 2 jours ailleurs." }
    },
    delaiRegion: 1, delaiFrance: 2,     // jours de trajet
    dureePanne: [1, 3],                 // jours d'immobilisation
    revente: 0.5                        // un véhicule revendu rapporte la moitié de son prix
  },

  // Déblocage du catalogue par gamme : on commence avec l'entrée de gamme.
  // Une gamme se débloque dès qu'UNE de ses conditions est remplie. Avant, ses produits restent cachés.
  deblocages: [
    { gamme: 1, nom: "gamme milieu", conditions: { moisPositifs: 1, reputation: 60 },
      texte: "un premier mois positif ou 60 de réputation" },
    { gamme: 2, nom: "haut de gamme", conditions: { moisPositifs: 3, reputation: 75 },
      texte: "trois mois positifs ou 75 de réputation" }
  ],

  objectifs: [
    { id: "rayon",       texte: "Placer un produit en rayon" },
    { id: "commande",    texte: "Passer une première commande de stock" },
    { id: "vendeur",     texte: "Embaucher un vendeur" },
    { id: "caissier",    texte: "Embaucher un caissier" },
    { id: "ventes10",    texte: "Réaliser 10 ventes" },
    { id: "technicien",  texte: "Embaucher un technicien" },
    { id: "montage1",    texte: "Livrer un premier PC monté sur mesure" },
    { id: "reparation10", texte: "Réaliser 10 réparations" },
    { id: "pub1",        texte: "Lancer une première campagne de publicité" },
    { id: "moisPositif", texte: "Équilibrer le mois (résultat positif)" },
    { id: "rep60",       texte: "Atteindre 60 de réputation" },
    { id: "ventes100",   texte: "Réaliser 100 ventes" },
    { id: "tresor50k",   texte: "Avoir 50 000 € de trésorerie" },
    { id: "magasin2",    texte: "Ouvrir un deuxième magasin" },
    { id: "palier2",     texte: "Atteindre le palier 2 : 3 magasins dans une même région" },
    { id: "palier3",     texte: "Atteindre le palier 3 : réseau régional" },
    { id: "entrepot1",   texte: "Construire un premier entrepôt régional" },
    { id: "palier4",     texte: "Devenir leader national : 9 régions, réputation moyenne de 70" }
  ],

  prenoms: ["Camille", "Hugo", "Léa", "Nathan", "Inès", "Lucas", "Chloé", "Mathis", "Manon", "Yanis",
            "Sarah", "Théo", "Jade", "Karim", "Emma", "Louis", "Nora", "Enzo", "Zoé", "Samir",
            "Lina", "Maxime", "Clara", "Rayan", "Julie", "Antoine", "Amira", "Paul", "Elsa", "Bilal"],
  noms: ["Martin", "Bernard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Michel", "Garcia",
         "Roux", "Fournier", "Girard", "Bonnet", "Dupont", "Lambert", "Fontaine", "Rousseau", "Blanc", "Mercier"]
};
