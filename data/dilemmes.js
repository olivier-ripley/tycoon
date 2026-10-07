// Dilemmes — modifiable sans toucher au code.
// De temps en temps, une situation demande une décision : une fenêtre s'ouvre (le temps s'arrête) et chaque choix a ses conséquences.
//
// Dans les textes : {ville}, {employe}, {poste}, {montant}, {produit}, {lot}, {prixLot}, {chaine} sont remplacés.
// Conditions (facultatives) : employe (un employé dans le magasin, éventuellement d'un poste), rival (une enseigne rivale dans la ville),
//   palier, reputationMin, stock (un produit en stock), mois (mois du calendrier, 1 = janvier).
// montant : [min, max] tiré au hasard (arrondi à 100 €), multiplié par « echelle » selon la taille de la ville.
// Effets d'un choix :
//   cout       : argent dépensé ("montant", "prixLot" ou un nombre ; négatif = argent gagné)
//   reputation : points de réputation du magasin
//   affluence  : { bonus: 0.3, jours: 14 } = +30 % de clients dans ce magasin pendant 14 jours
//   moral      : moral de toute l'équipe du magasin ; moralEmploye : moral de l'employé concerné
//   salaire    : hausse du salaire de l'employé concerné (0.1 = +10 %) ; depart : l'employé quitte le magasin
//   lot        : le lot de produits est livré en réserve
//   alea       : { chance: 0.7, succes: { ...effets, resultat }, echec: { ...effets, resultat } }
//   resultat   : texte affiché après le choix
window.TMI_DATA = window.TMI_DATA || {};

TMI_DATA.dilemmes = {
  chanceParJour: 0.045,          // environ un dilemme toutes les trois semaines de jeu
  premierJour: 21,               // pas de dilemme pendant les trois premières semaines
  delaiMemeDilemme: 168,         // jours avant qu'un même dilemme puisse revenir (6 mois)
  echelle: { petite: 0.7, moyenne: 0.85, grande: 1, paris: 1.3 },
  liste: [
    { id: "youtubeur", poids: 3, titre: "Un youtubeur tech te contacte",
      texte: "Une chaîne tech de {ville} (80 000 abonnés) propose une vidéo sponsorisée dans ta boutique, pour {montant}. Ses vidéos marchent… pas toujours.",
      montant: [2500, 4500],
      choix: [
        { texte: "Accepter · {montant}", cout: "montant",
          alea: { chance: 0.7,
            succes: { affluence: { bonus: 0.35, jours: 14 }, reputation: 3, resultat: "La vidéo cartonne : du monde vient de toute la ville pendant deux semaines !" },
            echec: { reputation: 0, resultat: "La vidéo passe inaperçue. Dommage, l'argent est dépensé." } } },
        { texte: "Refuser poliment", resultat: "Le youtubeur ira voir ailleurs. Rien ne change." }
      ] },
    { id: "augmentation", poids: 3, titre: "Demande d'augmentation", employe: true,
      texte: "{employe} ({poste}) estime faire du bon travail et demande une augmentation de 15 %.",
      choix: [
        { texte: "Accorder +15 %", salaire: 0.15, moralEmploye: 30, resultat: "{employe} est ravi·e et redouble d'efforts." },
        { texte: "Proposer +7 %", salaire: 0.07, moralEmploye: 8, resultat: "{employe} accepte le compromis, sans enthousiasme." },
        { texte: "Refuser", moralEmploye: -30, resultat: "{employe} est déçu·e : son moral baisse, attention à une démission." }
      ] },
    { id: "client-mecontent", poids: 3, titre: "Un client mécontent",
      texte: "Un client affirme que l'ordinateur acheté chez toi est arrivé rayé et exige un remboursement de {montant}. Il menace de laisser un avis assassin.",
      montant: [400, 900],
      choix: [
        { texte: "Rembourser · {montant}", cout: "montant", reputation: 2, resultat: "Le client repart satisfait et le dit autour de lui." },
        { texte: "Bon d'achat de 100 €", cout: 100, alea: { chance: 0.5,
            succes: { reputation: 1, resultat: "Le client accepte le bon d'achat. Ouf." },
            echec: { reputation: -3, resultat: "Le client refuse et publie un avis très négatif." } } },
        { texte: "Refuser", reputation: -4, resultat: "L'avis négatif tombe le soir même." }
      ] },
    { id: "destockage", poids: 2, titre: "Un lot à prix cassé", stock: true,
      texte: "Ton fournisseur liquide un lot de {lot} × {produit} à −40 %, soit {prixLot} le lot. Offre valable aujourd'hui seulement.",
      choix: [
        { texte: "Acheter le lot · {prixLot}", cout: "prixLot", lot: true, resultat: "Le lot arrive dans ta réserve : belle marge en perspective." },
        { texte: "Pas cette fois", resultat: "Un concurrent achètera le lot." }
      ] },
    { id: "ecole", poids: 2, titre: "Une école cherche des ordinateurs",
      texte: "Le collège de {ville} équipe sa salle informatique et te demande un geste : un don de matériel d'une valeur de {montant}.",
      montant: [1200, 2200],
      choix: [
        { texte: "Faire le don · {montant}", cout: "montant", reputation: 6, resultat: "Le journal local en parle : ta réputation grimpe." },
        { texte: "Proposer une remise à la place", reputation: 1, resultat: "L'école apprécie le geste, sans plus." },
        { texte: "Refuser", resultat: "L'école ira voir ailleurs." }
      ] },
    { id: "debauchage", poids: 2, titre: "Un concurrent débauche ton équipe", employe: true, rival: true,
      texte: "{chaine} propose à {employe} ({poste}) un poste mieux payé. {employe} hésite et te demande ce que tu en penses.",
      choix: [
        { texte: "Contre-offre : +12 %", salaire: 0.12, moralEmploye: 20, resultat: "{employe} reste, flatté·e par ta confiance." },
        { texte: "Le laisser partir", depart: true, resultat: "{employe} rejoint {chaine}. Il faudra recruter." }
      ] },
    { id: "normes", poids: 2, titre: "Contrôle de sécurité annoncé",
      texte: "Un contrôle des installations électriques est prévu. Mettre l'atelier aux normes coûterait {montant}.",
      montant: [1500, 2500],
      choix: [
        { texte: "Mettre aux normes · {montant}", cout: "montant", resultat: "Le contrôle se passe sans souci." },
        { texte: "Tenter sa chance", alea: { chance: 0.6,
            succes: { resultat: "Le contrôleur ne remarque rien. Tu as eu de la chance." },
            echec: { cout: 5000, reputation: -3, resultat: "Amende de 5 000 € et fermeture de l'atelier le temps d'une visite : mauvaise publicité." } } }
      ] },
    { id: "clim", poids: 2, titre: "La climatisation tombe en panne", mois: [6, 7, 8],
      texte: "En pleine chaleur, la climatisation de la boutique lâche. Le réparateur peut venir aujourd'hui pour {montant}, ou la semaine prochaine pour bien moins cher.",
      montant: [900, 1500],
      choix: [
        { texte: "Réparer aujourd'hui · {montant}", cout: "montant", resultat: "La fraîcheur revient, les clients aussi." },
        { texte: "Attendre la semaine prochaine · 300 €", cout: 300, affluence: { bonus: -0.25, jours: 7 }, moral: -10, resultat: "Une semaine étouffante : moins de clients et une équipe à bout." }
      ] },
    { id: "salon", poids: 2, titre: "Salon informatique de {ville}", palier: 1,
      texte: "Le salon informatique de la ville propose un stand pour {montant}. Bonne vitrine, mais l'équipe sera mobilisée.",
      montant: [1800, 3200],
      choix: [
        { texte: "Prendre un stand · {montant}", cout: "montant", affluence: { bonus: 0.25, jours: 10 }, reputation: 2, moral: -5, resultat: "Le stand attire du monde : la boutique en profite pendant dix jours." },
        { texte: "Passer son tour", resultat: "Tu restes concentré·e sur la boutique." }
      ] },
    { id: "influenceuse", poids: 2, titre: "Une influenceuse gaming", reputationMin: 55,
      texte: "Une streameuse de {ville} propose de jouer en direct avec un PC de ta boutique, à condition que tu le lui offres (valeur {montant}).",
      montant: [900, 1600],
      choix: [
        { texte: "Offrir le PC · {montant}", cout: "montant", alea: { chance: 0.6,
            succes: { affluence: { bonus: 0.3, jours: 10 }, reputation: 2, resultat: "Le live fait un carton chez les joueurs : ils débarquent en masse." },
            echec: { resultat: "Le live est passé presque inaperçu." } } },
        { texte: "Refuser", resultat: "Elle trouvera un autre sponsor." }
      ] },
    { id: "stagiaire", poids: 1, titre: "Une demande de stage",
      texte: "Un étudiant en informatique cherche un stage d'un mois. Gratifié {montant}, il aiderait l'équipe mais il faudra le former.",
      montant: [600, 900],
      choix: [
        { texte: "L'accueillir · {montant}", cout: "montant", moral: 10, reputation: 2, resultat: "Le stagiaire est motivé : l'équipe souffle un peu et les étudiants du coin en parlent." },
        { texte: "Pas le temps", resultat: "Il trouvera un autre stage." }
      ] }
  ]
};
