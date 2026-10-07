// Villes jouables — modifiable sans toucher au code.
// type : petite | moyenne | grande | paris (voir typesVilles)
// loyer : loyer mensuel du petit local (€) ; profil : clientèle dominante ; lat / lon : position sur la carte.
window.TMI_DATA = window.TMI_DATA || {};

TMI_DATA.typesVilles = {
  petite:  { nom: "Petite ville",                    clientsParJour: 16, concurrence: 0.10 },
  moyenne: { nom: "Ville moyenne",                   clientsParJour: 26, concurrence: 0.22 },
  grande:  { nom: "Grande ville",                    clientsParJour: 40, concurrence: 0.32 },
  paris:   { nom: "Paris et très grande métropole",  clientsParJour: 66, concurrence: 0.42 }
};

// Régions (métropole). Le palier 2 « Enseigne locale » demande 3 magasins dans une même région.
TMI_DATA.regions = {
  idf: "Île-de-France", hdf: "Hauts-de-France", normandie: "Normandie", grandest: "Grand Est",
  bretagne: "Bretagne", pdl: "Pays de la Loire", cvl: "Centre-Val de Loire", bfc: "Bourgogne-Franche-Comté",
  naq: "Nouvelle-Aquitaine", occitanie: "Occitanie", ara: "Auvergne-Rhône-Alpes", paca: "Provence-Alpes-Côte d'Azur", corse: "Corse"
};

TMI_DATA.villes = [
  { id: "paris",        nom: "Paris",            region: "idf",       type: "paris",   loyer: 5600, profil: "professionnels", lat: 48.857, lon: 2.352 },
  { id: "versailles",   nom: "Versailles",       region: "idf",       type: "moyenne", loyer: 2400, profil: "familles", lat: 48.805, lon: 2.120 },
  { id: "meaux",        nom: "Meaux",            region: "idf",       type: "petite",  loyer: 1300, profil: "familles", lat: 48.960, lon: 2.879 },
  { id: "cergy",        nom: "Cergy",            region: "idf",       type: "petite",  loyer: 1400, profil: "etudiants", lat: 49.036, lon: 2.063 },
  { id: "lille",        nom: "Lille",            region: "hdf",       type: "grande",  loyer: 2900, profil: "joueurs", lat: 50.629, lon: 3.057 },
  { id: "amiens",       nom: "Amiens",           region: "hdf",       type: "moyenne", loyer: 1300, profil: "etudiants", lat: 49.894, lon: 2.296 },
  { id: "arras",        nom: "Arras",            region: "hdf",       type: "petite",  loyer: 750,  profil: "familles", lat: 50.291, lon: 2.777 },
  { id: "rouen",        nom: "Rouen",            region: "normandie", type: "moyenne", loyer: 1500, profil: "etudiants", lat: 49.443, lon: 1.099 },
  { id: "caen",         nom: "Caen",             region: "normandie", type: "moyenne", loyer: 1400, profil: "joueurs", lat: 49.183, lon: -0.370 },
  { id: "cherbourg",    nom: "Cherbourg",        region: "normandie", type: "petite",  loyer: 700,  profil: "professionnels", lat: 49.639, lon: -1.616 },
  { id: "strasbourg",   nom: "Strasbourg",       region: "grandest",  type: "grande",  loyer: 2700, profil: "etudiants", lat: 48.573, lon: 7.752 },
  { id: "reims",        nom: "Reims",            region: "grandest",  type: "moyenne", loyer: 1450, profil: "familles", lat: 49.258, lon: 4.032 },
  { id: "metz",         nom: "Metz",             region: "grandest",  type: "moyenne", loyer: 1350, profil: "professionnels", lat: 49.120, lon: 6.176 },
  { id: "rennes",       nom: "Rennes",           region: "bretagne",  type: "moyenne", loyer: 1800, profil: "etudiants", lat: 48.117, lon: -1.678 },
  { id: "brest",        nom: "Brest",            region: "bretagne",  type: "moyenne", loyer: 1250, profil: "joueurs", lat: 48.39, lon: -4.486 },
  { id: "vannes",       nom: "Vannes",           region: "bretagne",  type: "petite",  loyer: 850,  profil: "professionnels", lat: 47.658, lon: -2.76 },
  { id: "nantes",       nom: "Nantes",           region: "pdl",       type: "grande",  loyer: 2800, profil: "familles", lat: 47.218, lon: -1.554 },
  { id: "angers",       nom: "Angers",           region: "pdl",       type: "moyenne", loyer: 1400, profil: "etudiants", lat: 47.478, lon: -0.563 },
  { id: "lemans",       nom: "Le Mans",          region: "pdl",       type: "moyenne", loyer: 1250, profil: "joueurs", lat: 48.006, lon: 0.199 },
  { id: "laval",        nom: "Laval",            region: "pdl",       type: "petite",  loyer: 650,  profil: "joueurs", lat: 48.073, lon: -0.77 },
  { id: "tours",        nom: "Tours",            region: "cvl",       type: "moyenne", loyer: 1500, profil: "familles", lat: 47.394, lon: 0.685 },
  { id: "orleans",      nom: "Orléans",          region: "cvl",       type: "moyenne", loyer: 1400, profil: "professionnels", lat: 47.903, lon: 1.909 },
  { id: "bourges",      nom: "Bourges",          region: "cvl",       type: "petite",  loyer: 700,  profil: "familles", lat: 47.081, lon: 2.399 },
  { id: "dijon",        nom: "Dijon",            region: "bfc",       type: "moyenne", loyer: 1400, profil: "familles", lat: 47.322, lon: 5.041 },
  { id: "besancon",     nom: "Besançon",         region: "bfc",       type: "moyenne", loyer: 1250, profil: "etudiants", lat: 47.238, lon: 6.024 },
  { id: "auxerre",      nom: "Auxerre",          region: "bfc",       type: "petite",  loyer: 650,  profil: "familles", lat: 47.798, lon: 3.567 },
  { id: "bordeaux",     nom: "Bordeaux",         region: "naq",       type: "grande",  loyer: 3400, profil: "professionnels", lat: 44.838, lon: -0.579 },
  { id: "limoges",      nom: "Limoges",          region: "naq",       type: "moyenne", loyer: 1200, profil: "professionnels", lat: 45.834, lon: 1.262 },
  { id: "poitiers",     nom: "Poitiers",         region: "naq",       type: "moyenne", loyer: 1150, profil: "etudiants", lat: 46.580, lon: 0.340 },
  { id: "pau",          nom: "Pau",              region: "naq",       type: "petite",  loyer: 800,  profil: "familles", lat: 43.295, lon: -0.371 },
  { id: "toulouse",     nom: "Toulouse",         region: "occitanie", type: "grande",  loyer: 3000, profil: "etudiants", lat: 43.605, lon: 1.444 },
  { id: "montpellier",  nom: "Montpellier",      region: "occitanie", type: "grande",  loyer: 2700, profil: "etudiants", lat: 43.611, lon: 3.877 },
  { id: "perpignan",    nom: "Perpignan",        region: "occitanie", type: "moyenne", loyer: 1200, profil: "familles", lat: 42.699, lon: 2.895 },
  { id: "albi",         nom: "Albi",             region: "occitanie", type: "petite",  loyer: 750,  profil: "familles", lat: 43.929, lon: 2.148 },
  { id: "lyon",         nom: "Lyon",             region: "ara",       type: "grande",  loyer: 3600, profil: "etudiants", lat: 45.764, lon: 4.836 },
  { id: "clermont",     nom: "Clermont-Ferrand", region: "ara",       type: "moyenne", loyer: 1350, profil: "joueurs", lat: 45.778, lon: 3.087 },
  { id: "chambery",     nom: "Chambéry",         region: "ara",       type: "petite",  loyer: 900,  profil: "etudiants", lat: 45.564, lon: 5.917 },
  { id: "marseille",    nom: "Marseille",        region: "paca",      type: "grande",  loyer: 3200, profil: "familles", lat: 43.296, lon: 5.37 },
  { id: "nice",         nom: "Nice",             region: "paca",      type: "grande",  loyer: 3300, profil: "professionnels", lat: 43.710, lon: 7.262 },
  { id: "avignon",      nom: "Avignon",          region: "paca",      type: "moyenne", loyer: 1300, profil: "joueurs", lat: 43.949, lon: 4.806 },
  { id: "ajaccio",      nom: "Ajaccio",          region: "corse",     type: "moyenne", loyer: 1700, profil: "familles", lat: 41.919, lon: 8.738 },
  { id: "bastia",       nom: "Bastia",           region: "corse",     type: "petite",  loyer: 800,  profil: "familles", lat: 42.697, lon: 9.451 },
  { id: "portovecchio", nom: "Porto-Vecchio",    region: "corse",     type: "petite",  loyer: 950,  profil: "familles", lat: 41.591, lon: 9.279 }
];
