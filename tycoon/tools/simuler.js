// Fait tourner la simulation seule, sans écran, pour vérifier que l'économie tient.
// Usage : node tools/simuler.js [ville] [mois] [difficulte] [graine] [agrandir]
// Exemple : node tools/simuler.js rennes 6 normal 42
//           node tools/simuler.js rennes 12 normal 42 agrandir   (déménage dès que la trésorerie le permet)
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const racine = path.join(__dirname, "..");
const ctx = { console, Math, Date, JSON };
ctx.window = ctx;
vm.createContext(ctx);
["data/config.js", "data/produits.js", "data/villes.js", "data/clients.js", "data/evenements.js", "data/deco.js", "src/sim/simulation.js"]
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(racine, f), "utf8"), ctx, { filename: f }));

const Sim = ctx.TMI.Sim;
const [villeId = "rennes", moisArg = "6", difficulte = "normal", graine = "42", agrandir = ""] = process.argv.slice(2);
const s = Sim.nouvellePartie({ villeId, difficulte, graine: +graine });
const cat = Sim.catalogue().liste;

// Joueur automatique simple : 8 types de produits, la gamme visée dès qu'elle est débloquée,
// réassort quand le stock baisse.
// Les 8 premiers servent au petit local ; les suivants remplissent les emplacements d'un local plus grand.
const offre = [["portable_bureau", 1, 5], ["pc_fixe", 1, 4], ["portable_gaming", 1, 2], ["carte_graphique", 1, 3],
               ["ssd", 0, 8], ["ecran", 1, 5], ["clavier_souris", 1, 8], ["casque", 1, 6],
               ["portable_bureau", 0, 5], ["processeur", 1, 3], ["ram", 0, 6], ["ecran", 0, 4], ["casque", 0, 6], ["portable_gaming", 2, 2],
               ["pc_fixe", 2, 2], ["carte_graphique", 2, 2], ["ssd", 1, 5], ["clavier_souris", 2, 4], ["processeur", 0, 3], ["portable_bureau", 2, 3]];
let choix = [], cible = {};
function majChoix() {
  const g = Sim.gammesOuvertes(s) - 1, vus = {};
  choix = []; cible = {};
  offre.slice(0, s.rayons.length).forEach(o => {
    const id = o[0] + "_" + Math.min(o[1], g);
    if (vus[id]) return; vus[id] = true; choix.push(id); cible[id] = o[2];
  });
  choix.forEach((id, i) => { if (s.rayons[i] !== id) Sim.placerRayon(s, i, id); });
}
function reassort() {
  majChoix();
  choix.forEach(id => {
    const enCours = s.commandes.filter(c => c.prodId === id).reduce((a, c) => a + c.qte, 0);
    const manque = cible[id] - (s.stock[id] || 0) - enCours;
    if (manque > 0) Sim.commander(s, id, manque);
  });
}
function recruter() {
  const besoin = { vendeur: 1 + ["petit", "moyen", "grand"].indexOf(s.local), caissier: s.local === "grand" ? 2 : 1 };
  ["vendeur", "caissier"].forEach(poste => {
    if (s.employes.filter(e => e.poste === poste).length >= besoin[poste]) return;
    const c = s.candidats.filter(c => c.poste === poste).sort((a, b) => b.niveau - a.niveau)[0];
    if (c) Sim.embaucher(s, c.id);
  });
}
reassort(); recruter();

const mois = +moisArg;
for (let j = 0; j < mois * 28 && !s.fin; j++) {
  Sim.avancerJours(s, 1);
  reassort(); recruter();
  const suivant = Sim.localSuivant(s);
  if (agrandir && suivant && !Sim.ferme(s) && s.jour % 28 === 1 && s.argent > Sim.coutDemenagement(s, suivant).total + 15000) {
    Sim.demenager(s, suivant); console.log(`  → jour ${s.jour + 1} : déménagement vers ${suivant}`);
  }
  const evs = Sim.vider(s).evenements;
  evs.filter(e => e.type === "deblocage").forEach(e => console.log(`  → jour ${s.jour + 1} : ${e.nom} débloquée`));
  evs.filter(e => e.type === "evenement").forEach(e => console.log(`  → ${Sim.dateTexte(s.jour)} (jour ${s.jour + 1}) : ${e.nom} jusqu'au ${Sim.dateTexte(e.fin)}`));
}

const v = Sim.ville(s);
console.log(`\n${v.nom} (${v.type}, loyer ${v.loyer} € en petit local, ${Sim.local(s).nom.toLowerCase()} à la fin) — difficulté ${difficulte}, graine ${graine}\n`);
console.log("Mois |   CA (€) | Coût ventes | Salaires | Loyer+ch. | Résultat | Trésorerie | Ventes | Clients | Partis (attente) | Introuv. | Rép.");
s.bilans.forEach(b => console.log(
  [String(b.numero).padStart(4), String(Math.round(b.ca)).padStart(8), String(Math.round(b.cogs)).padStart(11),
   String(b.salaires).padStart(8), String(b.loyer + b.charges).padStart(9), String(Math.round(b.resultat)).padStart(8),
   String(b.tresorerie).padStart(10), String(b.ventes).padStart(6), String(b.clients).padStart(7),
   String(b.perdusAttente).padStart(16), String(b.introuvables).padStart(8), String(b.reputation).padStart(4)].join(" | ")));
console.log(`\nÉquipe : ${s.employes.map(e => `${e.nom} (${e.poste}, niv ${e.niveau}, moral ${Math.round(e.moral)}, charge ${Math.round((e.charge || 0) * 100)} %)`).join(" ; ")}`);
console.log(`Gammes ouvertes : ${Sim.gammesOuvertes(s)} / 3`);
console.log(`Stock : ${Math.round(Sim.valeurStock(s))} € · Dette : ${s.dette} € · ${s.fin ? "FIN : " + s.fin.raison : "partie en cours"}`);
