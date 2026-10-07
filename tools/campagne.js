// Campagne d'équilibrage : un joueur automatique fait toute la partie (déménagements, nouveaux magasins,
// responsables, entrepôts) et on note quand chaque palier tombe.
// Usage : node tools/campagne.js [villes séparées par des virgules] [difficultés] [graines] [années]
// Exemple : node tools/campagne.js rennes,lyon,albi normal,difficile 1,2,3 8
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const racine = path.join(__dirname, "..");
const fichiers = ["data/config.js", "data/produits.js", "data/villes.js", "data/clients.js", "data/evenements.js", "data/deco.js", "data/concurrents.js", "src/sim/simulation.js"];
function charger() {
  const ctx = { console, Math, Date, JSON };
  ctx.window = ctx;
  vm.createContext(ctx);
  fichiers.forEach(f => vm.runInContext(fs.readFileSync(path.join(racine, f), "utf8"), ctx, { filename: f }));
  return ctx;
}

const [villesArg = "rennes,lyon,albi,paris", diffArg = "normal", grainesArg = "1,2,3", anneesArg = "8", entrepotsArg = "oui"] = process.argv.slice(2);

function partie(villeId, difficulte, graine, annees) {
  const ctx = charger(), Sim = ctx.TMI.Sim, D = ctx.TMI_DATA, C = D.config;
  const s = Sim.nouvellePartie({ villeId, difficulte, graine });
  const jPM = C.temps.joursParMois;
  const r = { villeId, difficulte, graine, paliers: {}, faillite: null, demenagements: [], ouvertures: [], minTresorerie: Infinity, prets: 0 };

  // Le magasin de départ est géré « à la main » par le joueur automatique (comme tools/simuler.js),
  // les suivants par un responsable dès qu'un candidat se présente.
  const offre = [["portable_bureau", 1, 5], ["pc_fixe", 1, 4], ["portable_gaming", 1, 2], ["carte_graphique", 1, 3],
                 ["ssd", 0, 8], ["ecran", 1, 5], ["clavier_souris", 1, 8], ["casque", 1, 6],
                 ["portable_bureau", 0, 5], ["processeur", 1, 3], ["ram", 0, 6], ["ecran", 0, 4], ["casque", 0, 6], ["portable_gaming", 2, 2],
                 ["pc_fixe", 2, 2], ["carte_graphique", 2, 2], ["ssd", 1, 5], ["clavier_souris", 2, 4], ["processeur", 0, 3], ["portable_bureau", 2, 3]];
  function gererPremier() {
    if (s.actif !== 0) Sim.changerMagasin(s, 0);
    if (Sim.aUnResponsable(s)) return;
    const g = Sim.gammesOuvertes(s) - 1, vus = {}, choix = [], cible = {};
    offre.slice(0, s.rayons.length).forEach(o => {
      const id = o[0] + "_" + Math.min(o[1], g);
      if (vus[id]) return; vus[id] = true; choix.push(id); cible[id] = Math.ceil(o[2] * Math.max(1, D.typesVilles[D.villes.find(v => v.id === s.villeId).type].clientsParJour / 26));
    });
    // Un rayon qui a encore du stock est écoulé avant de passer au produit suivant (nouvelle gamme) :
    // sinon le stock d'entrée de gamme reste en réserve, invendable, et immobilise la trésorerie.
    choix.forEach((id, i) => {
      const actuel = s.rayons[i];
      if (actuel === id) return;
      if (actuel && (s.stock[actuel] || 0) > 0 && choix.indexOf(actuel) < 0) { choix[i] = null; return; }
      Sim.placerRayon(s, i, id);
    });
    // Réserve : les salaires du mois sont prélevés en fin de mois, on garde de quoi les payer
    // (sinon, en grande ville, le stock absorbe toute la trésorerie et le mois finit dans le rouge).
    const reserve = 3000 + s.employes.reduce((a, e) => a + e.salaire, 0);
    choix.forEach(id => {
      if (!id) return;
      const enCours = s.commandes.filter(c => c.prodId === id && !c.pourJob).reduce((a, c) => a + c.qte, 0);
      const manque = Math.min(cible[id] - (s.stock[id] || 0) - enCours, Math.floor((s.argent - reserve) / Sim.coutAchat(s, id)));
      if (manque > 0) Sim.commander(s, id, manque);
    });
    const tv = D.villes.find(v => v.id === s.villeId).type, bonus = { paris: 2, grande: 1 }[tv] || 0;
    const besoin = { vendeur: 1 + bonus + ["petit", "moyen", "grand"].indexOf(s.local), caissier: (s.local === "grand" ? 2 : 1) + (tv === "paris" ? 1 : 0) };
    ["vendeur", "caissier"].forEach(poste => {
      if (s.employes.filter(e => e.poste === poste).length >= besoin[poste]) return;
      const c = s.candidats.filter(c => c.poste === poste).sort((a, b) => b.niveau - a.niveau)[0];
      if (c) Sim.embaucher(s, c.id);
    });
  }
  // Responsable dans chaque magasin qui n'en a pas ; il gère le reste
  function responsables() {
    for (let i = 0; i < s.magasins.length; i++) {
      Sim.changerMagasin(s, i);
      if (!Sim.aUnResponsable(s)) {
        const c = s.candidats.filter(x => x.poste === "responsable").sort((a, b) => b.niveau - a.niveau)[0];
        if (c) Sim.embaucher(s, c.id);
      }
      if (Sim.aUnResponsable(s)) {
        // un magasin piloté recrute un vendeur de plus quand il grandit
        const nv = s.employes.filter(e => e.poste === "vendeur").length;
        if (nv < 1 + ["petit", "moyen", "grand"].indexOf(s.local)) {
          const c = s.candidats.filter(x => x.poste === "vendeur").sort((a, b) => b.niveau - a.niveau)[0];
          if (c) Sim.embaucher(s, c.id);
        }
      }
    }
    Sim.changerMagasin(s, 0);
  }
  // Prochaine ville : d'abord la région de départ (palier 2), puis une région nouvelle (paliers 3 et 4)
  function prochaineVille() {
    const occupees = new Set(s.magasins.map((m, i) => Sim.magasin(s, i).villeId));
    const parReg = Sim.magasinsParRegion(s);
    const regDepart = D.villes.find(v => v.id === villeId).region;
    let candidates = D.villes.filter(v => !occupees.has(v.id));
    if ((parReg[regDepart] || 0) < 3) candidates = candidates.filter(v => v.region === regDepart);
    else candidates = candidates.filter(v => !parReg[v.region]);
    if (!candidates.length) candidates = D.villes.filter(v => !occupees.has(v.id));
    const score = v => D.typesVilles[v.type].clientsParJour * (1 - D.typesVilles[v.type].concurrence) / v.loyer;
    return candidates.sort((a, b) => score(b) - score(a))[0];
  }

  gererPremier();   // on s'installe avant d'ouvrir les portes
  const fin = annees * 12 * jPM;
  for (let j = 0; j < fin && !s.fin; j++) {
    Sim.avancerJours(s, 1);
    if (s.fin) break;
    gererPremier();
    if (s.jour % 7 === 1) responsables();
    // déménagement du premier magasin
    if (s.jour % jPM === 1) {
      Sim.changerMagasin(s, 0);
      const suivant = Sim.localSuivant(s);
      if (suivant && !Sim.ferme(s) && s.argent > Sim.coutDemenagement(s, suivant).total + 25000) {
        Sim.demenager(s, suivant); r.demenagements.push([suivant, s.jour]);
      }
    }
    // nouveau magasin
    if (s.jour % jPM === 2) {
      const v = prochaineVille();
      if (v) {
        const co = Sim.conditionsOuverture(s, v.id);
        if (co.ok && s.argent > co.cout.total + 25000) { Sim.ouvrirMagasin(s, v.id); r.ouvertures.push([v.id, s.jour]); responsables(); }
      }
    }
    // logistique (palier 3) : un entrepôt et une camionnette dans la région de départ
    if (entrepotsArg === "oui" && s.palier >= 3 && s.jour % jPM === 3) {
      const reg = D.villes.find(v => v.id === villeId).region;
      Sim.initLog(s);
      if (!s.entrepots[reg] && s.argent > 60000) { Sim.construireEntrepot(s, reg, villeId); Sim.acheterVehicule(s, "camionnette"); }
    }
    const ev = Sim.vider(s).evenements;
    if (process.env.DETAIL) ev.filter(e => e.type === "bilan").forEach(e => console.log("  mois", e.total.numero, "CA", Math.round(e.total.ca), "rés.", Math.round(e.total.resultat), "trés.", e.total.tresorerie, "mag.", s.magasins.length, "rép.", e.total.reputation, "partis", e.total.perdusAttente));
    ev.forEach(e => {
      if (e.type === "palier") r.paliers[e.palier] = s.jour;
      if (e.type === "victoire") r.paliers[4] = s.jour;
      if (e.type === "pret") r.prets++;
    });
    r.minTresorerie = Math.min(r.minTresorerie, s.argent);
  }
  if (s.fin) r.faillite = s.jour;
  r.magasins = s.magasins.length;
  r.tresorerie = Math.round(s.argent);
  r.jours = s.jour;
  const be = s.bilansEnseigne || [];
  r.resultat12 = Math.round(be.slice(-12).reduce((a, b) => a + b.resultat, 0));
  r.ca12 = Math.round(be.slice(-12).reduce((a, b) => a + b.ca, 0));
  r.repMoy = Math.round(Sim.reputationMoyenne(s));
  r.regions = Sim.regionsAvecMagasin(s).length;
  return r;
}

const fmt = j => j == null ? "—" : (j / (12 * 28)).toFixed(1) + " an";
console.log("Ville      | Diff.     | Gr. | Palier 2 | Palier 3 | Palier 4 | Faillite | Mag. | Rég. | Rép. | CA 12 mois | Résultat 12 mois | Trésorerie | Min trés. | Prêts");
villesArg.split(",").forEach(v => diffArg.split(",").forEach(d => grainesArg.split(",").forEach(g => {
  const r = partie(v, d, +g, +anneesArg);
  console.log([v.padEnd(10), d.padEnd(9), String(g).padStart(3), fmt(r.paliers[2]).padStart(8), fmt(r.paliers[3]).padStart(8), fmt(r.paliers[4]).padStart(8),
    fmt(r.faillite).padStart(8), String(r.magasins).padStart(4), String(r.regions).padStart(4), String(r.repMoy).padStart(4),
    String(r.ca12).padStart(10), String(r.resultat12).padStart(16), String(r.tresorerie).padStart(10), String(Math.round(r.minTresorerie)).padStart(9), String(r.prets).padStart(5)].join(" | "));
})));
