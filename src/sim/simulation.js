// Simulation du magasin — aucune dépendance à l'écran.
// Tourne aussi bien dans le navigateur que dans Node (voir tools/simuler.js).
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};
  var D = function () { return root.TMI_DATA; };

  // ---------------------------------------------------------------- Hasard reproductible
  function rng(s) {               // mulberry32, l'état est rangé dans la sauvegarde
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    var t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function entre(s, a, b) { return a + rng(s) * (b - a); }
  function tirerPoids(s, poids) {             // { cle: poids } -> cle
    var total = 0, k;
    for (k in poids) total += poids[k];
    var r = rng(s) * total;
    for (k in poids) { r -= poids[k]; if (r <= 0) return k; }
    return k;
  }
  function borne(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---------------------------------------------------------------- Catalogue
  var cacheCatalogue = null;
  function catalogue() {
    if (cacheCatalogue) return cacheCatalogue;
    var d = D(), liste = [], parId = {};
    d.typesProduits.forEach(function (t) {
      t.prix.forEach(function (prix, g) {
        var marge = d.config.margesParDefaut[t.categorie];
        var p = {
          id: t.id + "_" + g, typeId: t.id, typeNom: t.nom, gamme: g, court: (t.courts || t.marques)[g],
          nom: t.marques[g], categorie: t.categorie,
          prixRef: prix, cout: Math.round(prix * (1 - marge))
        };
        liste.push(p); parId[p.id] = p;
      });
    });
    cacheCatalogue = { liste: liste, parId: parId };
    return cacheCatalogue;
  }
  function produit(id) { return catalogue().parId[id]; }

  // Prix du marché (événements : pénuries…) : coût de gros et prix de référence des clients
  function coutMarche(s, p) { if (typeof p === "string") p = produit(p); return Math.round(p.cout * (modifs(s).prix[p.typeId] || 1)); }
  function prixMarche(s, p) { if (typeof p === "string") p = produit(p); return Math.round(p.prixRef * (modifs(s).prix[p.typeId] || 1)); }
  // Ce que tu paies au fournisseur aujourd'hui (promo comprise)
  function coutAchat(s, p) { if (typeof p === "string") p = produit(p); return Math.round(coutMarche(s, p) * (modifs(s).remise[p.typeId] || 1)); }
  // Coût moyen des unités en stock (les achats faits à des prix différents se mélangent)
  function coutStock(s, pid) { var m = s.coutMoyen && s.coutMoyen[pid]; return m != null ? m : produit(pid).cout; }
  function prixVente(s, p) {
    if (typeof p === "string") p = produit(p);
    if (s.prixFixes[p.id] != null) return s.prixFixes[p.id];
    return Math.round(coutMarche(s, p) / (1 - s.marges[p.categorie]));
  }

  function ville(s) {
    var v = D().villes.filter(function (x) { return x.id === s.villeId; })[0];
    return v;
  }
  function local(s) { return D().config.locaux[s.local]; }
  // Loyer mensuel du local actuel : loyer de la ville × taille du local × hausses annuelles
  function loyerLocal(s, taille) {
    var loc = D().config.locaux[taille || s.local];
    return Math.round(ville(s).loyer * (loc.facteurLoyer || 1) * (s.indexLoyer || 1));
  }
  function ferme(s) { return s.fermeJusqu != null && s.jour <= s.fermeJusqu; }

  // ---------------------------------------------------------------- Temps
  function maintenant(s) { return s.jour * 1440 + s.minuteJour; }
  function infosDate(s) {
    var c = D().config.temps;
    var mois = Math.floor(s.jour / c.joursParMois);
    var jourMois = s.jour % c.joursParMois;
    return {
      mois: mois + 1, annee: Math.floor((mois + (c.moisDepart || 1) - 1) / 12) + 1,
      semaine: Math.floor(jourMois / 7) + 1,
      jourDuMois: jourMois + 1,
      jourSemaine: s.jour % 7,
      nomJour: c.nomsJours[s.jour % 7],
      moisCal: moisCalendrier(s.jour), nomMois: (c.nomsMois || [])[moisCalendrier(s.jour) - 1] || "",
      heure: Math.floor(s.minuteJour / 60), minute: s.minuteJour % 60
    };
  }

  // ---------------------------------------------------------------- Journal
  var silencieux = false;   // pendant le pilotage automatique : on résume au lieu de tout noter
  function noter(s, texte, type) {
    if (silencieux) return;
    var i = infosDate(s);
    s.journal.unshift({ jour: s.jour, quand: "J" + (s.jour + 1) + " " + pad(i.heure) + "h" + pad(i.minute), texte: prefixe + texte, type: type || "info" });
    if (s.journal.length > 120) s.journal.length = 120;
    s.evenements.push({ texte: texte, type: type || "info" });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // ---------------------------------------------------------------- Employés
  function salaireAttendu(poste, niveau) {
    var c = D().config;
    return Math.round(c.postes[poste].salaireBase * (1 + c.hausseSalaireParNiveau * (niveau - 1)));
  }
  function vitesse(e) {
    return (0.85 + 0.1 * (e.niveau - 1)) * (0.75 + 0.5 * e.moral / 100);
  }
  function nouveauCandidat(s, poste) {
    var c = D().config;
    var r = rng(s), niveau = r < 0.55 ? 1 : r < 0.85 ? 2 : r < 0.97 ? 3 : 4;
    var nom = c.prenoms[Math.floor(rng(s) * c.prenoms.length)] + " " + c.noms[Math.floor(rng(s) * c.noms.length)];
    return {
      id: "e" + (s.prochainId++), nom: nom, poste: poste, niveau: niveau,
      xp: c.seuilsXp[niveau - 1], salaire: Math.round(salaireAttendu(poste, niveau) * entre(s, 0.95, 1.15) / 10) * 10,
      moral: 70, tache: null, occupe: 0
    };
  }
  function renouvelerCandidats(s) {
    var nbMag = s.magasins ? s.magasins.length : 1;
    var postes = Object.keys(D().config.postes).filter(function (k) { return nbMag >= (D().config.postes[k].apartirDe || 1); }), n = D().config.candidatsParSemaine;
    s.candidats = [];
    for (var i = 0; i < n; i++) {
      var poste = i < postes.length ? postes[i] : postes[Math.floor(rng(s) * postes.length)];
      s.candidats.push(nouveauCandidat(s, poste));
    }
  }
  function gagnerXp(s, e, n) {
    var seuils = D().config.seuilsXp;
    e.xp += n || 1;
    if (e.niveau < seuils.length && e.xp >= seuils[e.niveau]) {
      e.niveau++;
      var nouveau = salaireAttendu(e.poste, e.niveau);
      if (e.salaire < nouveau) e.salaire = nouveau;
      noter(s, e.nom + " passe au niveau " + e.niveau + " ; son salaire monte à " + e.salaire + " €.", "bon");
    }
  }

  // ---------------------------------------------------------------- Nouvelle partie
  function nouvellePartie(opts) {
    var d = D(), c = d.config;
    var diff = c.difficultes[opts.difficulte] ? opts.difficulte : "normal";
    var s = {
      version: 2,
      rng: (opts.graine != null ? opts.graine : Math.floor(Math.random() * 2e9)) | 0,
      difficulte: diff, villeId: opts.villeId, local: "petit",
      jour: 0, minuteJour: c.temps.ouverture,
      argent: c.difficultes[diff].budget, reputation: c.reputation.depart, dette: 0,
      stock: {}, rayons: [], prixFixes: {}, marges: {},
      commandes: [], employes: [], candidats: [], clients: [], file: [],
      mois: null, bilans: [], salairesDus: 0,
      journal: [], evenements: [], objectifsFaits: {},
      stats: { ventes: 0, ca: 0, clients: 0, moisPositifs: 0, montages: 0, retoursSav: 0, reparations: 0 },
      atelier: nouvelAtelier(), pubs: [], pubsFinies: [],
      gammes: 1,          // nombre de gammes débloquées (1 = entrée seulement)
      fin: null, prochainId: 1
    };
    var v = ville(s);
    if (!v) throw new Error("Ville inconnue : " + opts.villeId);
    var loc = local(s);
    for (var i = 0; i < loc.emplacements; i++) s.rayons.push(null);
    Object.keys(c.margesParDefaut).forEach(function (k) { s.marges[k] = c.margesParDefaut[k]; });
    s.mois = nouveauMois();

    var depot = v.loyer * loc.depotMoisLoyer;
    s.depot = depot; s.indexLoyer = 1;
    s.argent -= depot + loc.amenagement;
    s.mois.installation = depot + loc.amenagement;
    payerLoyerEtCharges(s);
    renouvelerCandidats(s);
    noter(s, "Ouverture de ta boutique à " + v.nom + ". Dépôt de garantie et aménagement : " + (depot + loc.amenagement) + " €.", "info");
    s.ouvertLe = 0; s.palier = 1;
    initMagasins(s);
    initRivaux(s);
    return s;
  }
  function nouveauMois() {
    return { ca: 0, cogs: 0, achats: 0, salaires: 0, loyer: 0, charges: 0, pret: 0, installation: 0,
             ventes: 0, clients: 0, perdusAttente: 0, introuvables: 0, refus: 0, horsCapacite: 0,
             caMontage: 0, montages: 0, sav: 0, caReparations: 0, reparations: 0, repRefusees: 0, repTropCher: 0, garanties: 0, pub: 0, clientsPub: 0 };
  }
  function nouvelAtelier() {
    var R = D().reparations, a = { demandes: [], travaux: [], retours: [], garanties: [], tarifs: {}, ouvert: {}, limiteFile: R.limiteFileDefaut };
    Object.keys(R.types).forEach(function (k) { a.tarifs[k] = R.types[k].prixRef; a.ouvert[k] = true; });
    return a;
  }
  // Résultat d'un mois : CA − coût des produits vendus − salaires − loyer − charges − pièces de SAV
  function resultatMois(m, salaires) {
    return m.ca - m.cogs - (salaires != null ? salaires : m.salaires) - m.loyer - m.charges - (m.sav || 0) - (m.pub || 0);
  }
  // Mise à niveau d'une sauvegarde de la phase 1
  function migrer(s) {
    migrerAncien(s);
    if (s.palier == null) s.palier = 1;
    initMagasins(s);
    initRivaux(s);
    return s;
  }
  function migrerAncien(s) {
    if (!s.pubs) { s.pubs = []; s.pubsFinies = []; if (s.mois && s.mois.pub == null) { s.mois.pub = 0; s.mois.clientsPub = 0; } }
    if (s.atelier && !s.atelier.tarifs) {          // sauvegarde de la phase 2 (montage seul)
      var a0 = nouvelAtelier();
      ["garanties", "tarifs", "ouvert", "limiteFile"].forEach(function (k) { s.atelier[k] = a0[k]; });
      s.stats.reparations = s.stats.reparations || 0;
      s.evenements = s.evenements || [];
      s.evenements.push({ type: "reparations" });
      noter(s, "L'atelier accepte maintenant les réparations : règle tes tarifs dans l'onglet Atelier.", "info");
    }
    if (s.atelier) return s;
    s.atelier = nouvelAtelier();
    s.stats.montages = s.stats.montages || 0; s.stats.retoursSav = s.stats.retoursSav || 0;
    ["caMontage", "montages", "sav"].forEach(function (k) { if (s.mois[k] == null) s.mois[k] = 0; });
    s.version = 2;
    if (!s.candidats.some(function (c) { return c.poste === "technicien"; })) s.candidats.push(nouveauCandidat(s, "technicien"));
    s.evenements = s.evenements || [];
    s.evenements.push({ type: "atelier" });
    noter(s, "Ton atelier ouvre : embauche un technicien pour monter des PC sur mesure.", "info");
    return s;
  }
  function payerLoyerEtCharges(s) {
    var loc = local(s), loyer = loyerLocal(s);
    var entretien = D().deco ? ambiance(s).entretien : 0;
    s.argent -= loyer + loc.charges + entretien;
    s.mois.loyer += loyer; s.mois.charges += loc.charges + entretien;
  }
  function rembourserPret(s) {
    if (!(s.dette > 0)) return;
    var m = Math.min(s.dette, D().config.pret.mensualite);
    s.argent -= m; s.dette -= m;
    noter(s, "Remboursement du prêt bancaire : " + m + " € (reste " + s.dette + " €).", "info");
  }


  // ---------------------------------------------------------------- Plan de la salle de vente
  // Cotes de la salle (en cases) selon la taille du local : partagées par la vue 2D, la vue 3D et la déco.
  var cachePlan = {};
  function plan(taille, emplacements) {
    var cle = taille + ":" + emplacements;
    if (cachePlan[cle]) return cachePlan[cle];
    var loc = D().config.locaux[taille] || D().config.locaux.petit, X = loc.plan[0], Y = loc.plan[1];
    var A = { x: X - 3.4, y: 0, w: 3.4, d: 4.6, h: 100 };
    var C = { x: X - 3.6, y: Y - 3.4, w: 3, d: 0.8, h: 28 };
    var T = { x: 4.4, y: Y - 2.7, w: 2.9, d: 0.75 };
    var P = { dim: { x: X, y: Y }, atelier: A, caisse: C, table: T, porte: { x: 2.1, l: 2.2 }, entree: { x: 3.2, y: Y + 0.7 },
              DX: A.x - 10.6, DXC: C.x - 10.4, DYC: C.y - 6.6, DYT: T.y - 7.3, rayons: [], rangees: [] };
    for (var sy = 1.3; sy + 1.7 <= T.y - 0.3 + 1e-9; sy += 3.5) {
      P.rangees.push(sy);
      for (var sx = 0.7; sx + 2.1 <= A.x - 0.3 + 1e-9; sx += 2.5) P.rayons.push({ x: sx, y: sy, w: 2.1, d: 0.8, h: 30 });
    }
    P.rayons = P.rayons.slice(0, emplacements || P.rayons.length);
    // Zones où l'on ne peut pas poser de déco : meubles, places des clients et des employés, passages
    var b = P.bloques = [];
    P.rayons.forEach(function (r) { b.push({ x: r.x - 0.1, y: r.y - 0.1, w: r.w + 0.2, d: r.d + 1.1, nom: "rayon" }); });
    b.push({ x: C.x - 0.4, y: C.y - 0.9, w: C.w + 0.6, d: C.d + 1.9, nom: "caisse" });
    b.push({ x: C.x - 3.8, y: C.y + 1.6, w: 4.2, d: 0.8, nom: "file de la caisse" });
    b.push({ x: T.x - 1.4, y: T.y - 0.3, w: T.w + 1.7, d: T.d + 0.9, nom: "table et vendeurs" });
    b.push({ x: A.x - 0.1, y: 0, w: X - A.x + 0.1, d: A.d + 0.6, nom: "atelier" });
    b.push({ x: P.porte.x, y: Y - 2.2, w: P.porte.l, d: 2.2, nom: "entrée" });
    b.push({ x: 0, y: 0.3, w: 0.9, d: 3.3, nom: "portes" });
    // Murs décorables (u = position le long du mur) et ce qui y est déjà accroché
    P.murs = {
      N: { long: X, bloques: [[2.3, 7.5, "l'enseigne"], [A.x - 0.1, X, "l'atelier"]] },
      O: { long: Y, bloques: [[0.3, 3.5, "les portes"], [5.7, 8.8, "la fenêtre"], [Math.min(9.4, Y - 0.6) - 0.4, Math.min(9.4, Y - 0.6) + 0.4, "l'horloge"]] },
      E: { long: Y, bloques: [[0, A.d + 0.2, "l'atelier"]] }
    };
    cachePlan[cle] = P;
    return P;
  }

  // ---------------------------------------------------------------- Décoration
  function DECO() { return D().deco; }
  function nouvelleDeco(s) {
    var P = plan(s.local, s.rayons.length), X = P.dim.x, Y = P.dim.y, d = { sol: "carrelage", murs: "blanc", objets: [] };
    ((DECO() && DECO().depart) || []).forEach(function (o) {
      d.objets.push({ id: "d" + (s.prochainId++), type: o.type, x: o.coin === "se" ? X - 1 : 0, y: Y - 1, rot: 0 });
    });
    return d;
  }
  function deco(s) { if (!s.deco) s.deco = nouvelleDeco(s); return s.deco; }
  function empriseDeco(type, x, y, rot) {
    var t = DECO().objets[type].taille, w = t[0], d = t[1];
    if (DECO().objets[type].mur) return { x: x, y: 0, w: w, d: 0.1, mur: true };
    if (rot % 2) { w = t[1]; d = t[0]; }
    return { x: x, y: y, w: w, d: d };
  }
  function croise(a, b) { return a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6; }
  function placeDeco(s, type, x, y, rot, ignorer, mur) {
    if (!DECO().objets[type]) return { ok: false, raison: "Objet inconnu." };
    if (DECO().objets[type].mur) return placeMurale(s, type, x, mur, ignorer);
    var P = plan(s.local, s.rayons.length), e = empriseDeco(type, x, y, rot || 0);
    if (Math.abs(x * 2 - Math.round(x * 2)) > 1e-6 || Math.abs(y * 2 - Math.round(y * 2)) > 1e-6) return { ok: false, raison: "Position invalide." };
    if (x < 0 || y < 0 || x + e.w > P.dim.x + 1e-6 || y + e.d > P.dim.y + 1e-6) return { ok: false, raison: "En dehors de la boutique." };
    for (var i = 0; i < P.bloques.length; i++) if (croise(e, P.bloques[i])) return { ok: false, raison: "Place réservée : " + P.bloques[i].nom + "." };
    var objs = deco(s).objets;
    for (var j = 0; j < objs.length; j++) {
      var o = objs[j];
      if (o.id !== ignorer && !DECO().objets[o.type].mur && croise(e, empriseDeco(o.type, o.x, o.y, o.rot))) return { ok: false, raison: "Il y a déjà un objet ici." };
    }
    return { ok: true };
  }
  function placeMurale(s, type, u, mur, ignorer) {
    var P = plan(s.local, s.rayons.length), M = P.murs[mur], w = DECO().objets[type].taille[0];
    if (!M) return { ok: false, raison: "Choisis un mur de la salle." };
    if (Math.abs(u * 2 - Math.round(u * 2)) > 1e-6) return { ok: false, raison: "Position invalide." };
    if (u < 0.1 - 1e-6 || u + w > M.long - 0.1 + 1e-6) return { ok: false, raison: "Trop près du coin." };
    for (var i = 0; i < M.bloques.length; i++) { var b = M.bloques[i]; if (u < b[1] - 1e-6 && b[0] < u + w - 1e-6) return { ok: false, raison: "Il y a déjà " + b[2] + " sur ce mur." }; }
    var objs = deco(s).objets;
    for (var j = 0; j < objs.length; j++) {
      var o = objs[j], d2 = DECO().objets[o.type];
      if (o.id === ignorer || !d2.mur || o.mur !== mur) continue;
      if (u < o.x + d2.taille[0] - 1e-6 && o.x < u + w - 1e-6) return { ok: false, raison: "Il y a déjà un objet ici." };
    }
    return { ok: true };
  }
  // Note d'ambiance du magasin courant et détail des effets
  function ambiance(s) {
    var C = DECO(), r = { pts: 0, attente: 0, vitrine: 0, themes: {}, parTheme: {}, entretien: 0, niveau: 0, conversion: 0, reputation: 0, patience: 0, affluence: 0 };
    if (!C) return r;
    var dc = deco(s); r.objets = dc.objets.length;
    function ajoute(def) {
      if (!def) return;
      r.pts += def.pts || 0; r.entretien += def.entretien || 0;
      if (def.effet === "attente") r.attente += def.pts;
      if (def.effet === "vitrine") r.vitrine += def.pts;
      if (def.theme) r.themes[def.theme] = (r.themes[def.theme] || 0) + def.pts;
    }
    ajoute(C.sols[dc.sol]); ajoute(C.murs[dc.murs]);
    dc.objets.forEach(function (o) { ajoute(C.objets[o.type]); });
    r.echelle = C.echelle * (C.tailleLocal[s.local] || 1);
    r.niveau = 1 - Math.exp(-r.pts / r.echelle);
    var E = C.effets;
    r.conversion = E.conversion * r.niveau;
    r.reputation = E.reputation * r.niveau;
    r.patience = E.patienceAmbiance * r.niveau + E.patienceAttente * Math.min(1, r.attente / E.ptsAttente);
    r.affluence = E.affluenceVitrine * Math.min(1, r.vitrine / E.ptsVitrine);
    Object.keys(r.themes).forEach(function (k) { r.parTheme[k] = Math.min(1, r.themes[k] / E.ptsTheme); });
    return r;
  }
  function payerDeco(s, prix) {
    if (prix > s.argent) return false;
    s.argent -= prix; s.mois.installation = (s.mois.installation || 0) + prix;
    return true;
  }
  function acheterDeco(s, type, x, y, rot, mur) {
    var def = DECO().objets[type];
    if (!def) return { ok: false, raison: "Objet inconnu." };
    var p = placeDeco(s, type, x, y, rot, null, mur);
    if (!p.ok) return p;
    if (!payerDeco(s, def.prix)) return { ok: false, raison: "Trésorerie insuffisante : il faut " + def.prix + " €." };
    var o = { id: "d" + (s.prochainId++), type: type, x: x, y: def.mur ? 0 : y, rot: def.mur ? 0 : rot || 0 };
    if (def.mur) o.mur = mur;
    deco(s).objets.push(o);
    return { ok: true, objet: o };
  }
  function deplacerDeco(s, id, x, y, rot, mur) {
    var o = deco(s).objets.filter(function (k) { return k.id === id; })[0];
    if (!o) return { ok: false, raison: "Objet introuvable." };
    var mural = DECO().objets[o.type].mur;
    if (mural && !mur) mur = o.mur;
    var p = placeDeco(s, o.type, x, y, rot, id, mur);
    if (!p.ok) return p;
    o.x = x;
    if (mural) o.mur = mur; else { o.y = y; o.rot = rot || 0; }
    return { ok: true, objet: o };
  }
  function vendreDeco(s, id) {
    var objs = deco(s).objets, i = objs.map(function (k) { return k.id; }).indexOf(id);
    if (i < 0) return { ok: false, raison: "Objet introuvable." };
    var gain = Math.round(DECO().objets[objs[i].type].prix * DECO().revente);
    objs.splice(i, 1);
    s.argent += gain;
    return { ok: true, gain: gain };
  }
  function choisirRevetement(s, genre, id) {
    var liste = genre === "sol" ? DECO().sols : DECO().murs, def = liste[id], dc = deco(s);
    if (!def) return { ok: false, raison: "Revêtement inconnu." };
    if (dc[genre] === id) return { ok: true };
    if (!payerDeco(s, def.prix)) return { ok: false, raison: "Trésorerie insuffisante : il faut " + def.prix + " €." };
    dc[genre] = id;
    return { ok: true };
  }
  // Après un déménagement : les objets qui ne tiennent plus sont revendus
  function recaserDeco(s) {
    var dc = deco(s), garde = [], gain = 0;
    dc.objets.forEach(function (o) {
      dc.objets = garde.concat([]);       // on teste chaque objet contre ceux déjà gardés
      if (placeDeco(s, o.type, o.x, o.y, o.rot, o.id, o.mur).ok) garde.push(o);
      else gain += Math.round(DECO().objets[o.type].prix * DECO().revente);
    });
    dc.objets = garde;
    if (gain) { s.argent += gain; noter(s, "Une partie de ta déco ne trouve pas sa place dans le nouveau local : revendue " + gain + " €.", "info"); }
  }

  // ---------------------------------------------------------------- Plusieurs magasins
  // Les champs propres à chaque magasin. Ceux du magasin « courant » sont aussi recopiés au premier
  // niveau de l'état : le reste du code travaille sur « s » comme s'il n'y avait qu'une boutique.
  // Le temps, la trésorerie, le journal, les gammes et les événements sont communs à l'enseigne.
  var CHAMPS_MAGASIN = ["villeId", "local", "stock", "rayons", "prixFixes", "marges", "commandes", "employes", "candidats",
    "clients", "file", "mois", "bilans", "salairesDus", "atelier", "pubs", "pubsFinies", "reputation", "depot",
    "indexLoyer", "fermeJusqu", "coutMoyen", "ouvertLe", "pilotage", "deco"];
  var prefixe = "";      // nom de la ville devant les messages quand l'enseigne a plusieurs magasins
  function ranger(s) { var m = s.magasins[s.courant]; CHAMPS_MAGASIN.forEach(function (k) { m[k] = s[k]; }); }
  function charger(s, i) { s.courant = i; var m = s.magasins[i]; CHAMPS_MAGASIN.forEach(function (k) { s[k] = m[k]; }); }
  function initMagasins(s) {
    if (!s.magasins) { s.magasins = [{}]; s.actif = 0; s.courant = 0; }
    if (s.courant == null) s.courant = s.actif || 0;
    ranger(s);                                  // le premier niveau fait foi pour le magasin courant
    if (s.courant !== s.actif) charger(s, s.actif);
  }
  // Exécute fn pour chaque magasin, puis revient au magasin affiché
  function pourChaque(s, fn) {
    var n = s.magasins.length;
    if (n === 1) { fn(s); return; }
    ranger(s);
    for (var i = 0; i < n; i++) {
      charger(s, i);
      prefixe = ville(s).nom + " · ";
      var avant = s.evenements.length;
      fn(s);
      for (var k = avant; k < s.evenements.length; k++) {
        var e = s.evenements[k];
        e.magasin = s.villeId;
        if (e.texte && e.texte.indexOf(prefixe) !== 0) e.texte = prefixe + e.texte;
      }
      ranger(s);
    }
    prefixe = "";
    charger(s, s.actif);
  }
  // Lecture d'un magasin quelconque (le magasin courant se lit au premier niveau)
  function magasin(s, i) { return i === s.courant ? s : s.magasins[i]; }
  // Vue complète d'un magasin (champs de l'enseigne + champs du magasin), pour l'affichage
  function vueMagasin(s, i) {
    if (i === s.courant) return s;
    var v = Object.create(s);
    CHAMPS_MAGASIN.forEach(function (k) { v[k] = s.magasins[i][k]; });
    return v;
  }
  function reputationMax(s) {
    return s.magasins ? Math.max.apply(null, s.magasins.map(function (m, i) { return magasin(s, i).reputation; })) : s.reputation;
  }
  function villeParId(id) { return D().villes.filter(function (v) { return v.id === id; })[0]; }
  function changerMagasin(s, i) {
    if (!s.magasins[i] || i === s.actif) return;
    ranger(s); s.actif = i; charger(s, i);
  }
  // Conditions et coût pour ouvrir un magasin dans une ville
  // opts.rachat : prix de rachat d'un magasin rival (on reprend son local : ni aménagement ni frais d'ouverture)
  function conditionsOuverture(s, villeId, opts) {
    var c = D().config, x = c.expansion, v = villeParId(villeId), loc = c.locaux.petit;
    opts = opts || {};
    var r = { ok: true, raisons: [] };
    if (!v) return { ok: false, raisons: ["Ville inconnue."] };
    if (s.magasins.some(function (m, i) { return magasin(s, i).villeId === villeId; })) { r.ok = false; r.raisons.push("Tu as déjà un magasin ici."); }
    if ((s.stats.moisPositifs || 0) < x.moisPositifs) { r.ok = false; r.raisons.push(x.moisPositifs + " mois positifs (tu en as " + (s.stats.moisPositifs || 0) + ")"); }
    if (reputationMax(s) < x.reputation) { r.ok = false; r.raisons.push(x.reputation + " de réputation dans un de tes magasins (meilleure : " + Math.round(reputationMax(s)) + ")"); }
    r.cout = { depot: v.loyer * loc.depotMoisLoyer, amenagement: opts.rachat != null ? 0 : loc.amenagement, premierLoyer: v.loyer + loc.charges,
               frais: opts.rachat != null ? 0 : x.fraisOuverture || 0, rachat: opts.rachat || 0 };
    r.cout.total = r.cout.depot + r.cout.amenagement + r.cout.premierLoyer + r.cout.frais + r.cout.rachat;
    var derniere = Math.max.apply(null, s.magasins.map(function (m, i) { return magasin(s, i).ouvertLe || 0; }));
    var delai = Math.round((x.delaiEntreOuvertures || 0) * (c.difficultes[s.difficulte].rythme || 1));
    if (s.magasins.length > 1 && delai && s.jour - derniere < delai) {
      r.ok = false; r.raisons.push("Ton dernier magasin vient d'ouvrir : prochaine ouverture possible le jour " + (derniere + delai + 1));
    }
    r.stockConseille = x.stockConseille;
    if (s.argent < r.cout.total) { r.ok = false; r.raisons.push("Trésorerie : " + r.cout.total + " € nécessaires"); }
    return r;
  }
  // opts.rachat / opts.depuis : reprise du local d'un magasin rival racheté (voir racheterRival)
  function ouvrirMagasin(s, villeId, opts) {
    opts = opts || {};
    var co = conditionsOuverture(s, villeId, opts);
    if (!co.ok) return { ok: false, raison: "Pas encore possible : " + co.raisons.join(" ; ") + "." };
    var c = D().config, loc = c.locaux.petit, v = villeParId(villeId);
    ranger(s);
    var marges = {}; Object.keys(s.marges).forEach(function (k) { marges[k] = s.marges[k]; });
    var m = {
      villeId: villeId, local: "petit", stock: {}, rayons: [], prixFixes: {}, marges: marges, commandes: [], employes: [],
      candidats: [], clients: [], file: [], mois: nouveauMois(), bilans: [], salairesDus: 0, atelier: nouvelAtelier(),
      pubs: [], pubsFinies: [], depot: co.cout.depot, indexLoyer: 1, fermeJusqu: null, coutMoyen: {}, ouvertLe: s.jour,
      // une enseigne connue démarre un peu au-dessus de la moyenne
      reputation: Math.round(c.reputation.depart + Math.max(0, reputationMax(s) - c.reputation.depart) * c.expansion.partReputation)
    };
    for (var k = 0; k < loc.emplacements; k++) m.rayons.push(null);
    s.magasins.push(m);
    var i = s.magasins.length - 1;
    charger(s, i);
    var installation = co.cout.depot + co.cout.amenagement + co.cout.frais + co.cout.rachat;
    s.argent -= installation;
    s.mois.installation = installation;
    payerLoyerEtCharges(s);
    renouvelerCandidats(s);
    if (opts.depuis) noter(s, "Tu rachètes le magasin " + opts.depuis + " de " + v.nom + " et reprends son local : rachat, dépôt et premier loyer " + co.cout.total + " €. Embauche une équipe et remplis les rayons !", "bon");
    else noter(s, "Nouveau magasin à " + v.nom + " : dépôt, aménagement et premier loyer " + co.cout.total + " €. Embauche une équipe et remplis les rayons !", "bon");
    ranger(s);
    charger(s, s.actif);
    verifierPalier(s);
    return { ok: true, index: i };
  }
  // Palier 2 « Enseigne locale » : 3 magasins dans une même région
  function magasinsParRegion(s) {
    var r = {};
    s.magasins.forEach(function (m, i) { var reg = villeParId(magasin(s, i).villeId).region; r[reg] = (r[reg] || 0) + 1; });
    return r;
  }
  function verifierPalier(s) {
    if (!s.magasins) return;
    verifierPalier4(s);
    verifierPalier3(s);
    if ((s.palier || 1) >= 2) return;
    var r = magasinsParRegion(s), reg = Object.keys(r).filter(function (k) { return r[k] >= D().config.paliers[2].magasinsRegion; })[0];
    if (!reg) return;
    s.palier = 2;
    var nomReg = D().regions[reg];
    noter(s, "Palier 2 atteint : « " + D().config.paliers[2].nom + " ». Ton enseigne compte trois magasins en " + nomReg + ".", "bon");
    s.evenements.push({ type: "palier", palier: 2, region: nomReg });
  }

  // ---------------------------------------------------------------- Enseignes concurrentes
  // Des magasins rivaux (MégaPC, TechnoPlus, Info Proxi…) dans les villes : ils prennent des clients,
  // se renforcent, ouvrent ailleurs, ferment quand ta réputation les étouffe, et peuvent être rachetés.
  // Ils appartiennent à l'enseigne : s.rivaux reste au premier niveau de l'état.
  function CONC() { return D().concurrents; }
  function chaine(id) { return CONC().chaines.filter(function (c) { return c.id === id; })[0]; }
  function initRivaux(s) {
    if (s.rivaux || !CONC()) return;
    var C = CONC();
    s.rivaux = { magasins: [], soldes: [], prochainId: 1 };
    D().villes.forEach(function (v) {
      var n = C.depart[v.type] || 0, nb = Math.floor(n) + (rng(s) < n - Math.floor(n) ? 1 : 0);
      for (var k = 0; k < Math.min(nb, C.maxParVille); k++) {
        var r = installerRival(s, v.id, choisirChaine(s, v));
        if (r && v.id === s.villeId && C.forceDepartChezToi) r.force = Math.min(r.force, C.forceDepartChezToi);
      }
    });
  }
  function choisirChaine(s, v) {
    var poids = {}, presents = rivauxVille(s, v.id).map(function (r) { return r.chaine; });
    CONC().chaines.forEach(function (c) { if (presents.indexOf(c.id) < 0) poids[c.id] = c.villes[v.type] || 0.01; });
    return Object.keys(poids).length ? tirerPoids(s, poids) : null;
  }
  function installerRival(s, villeId, chaineId) {
    if (!chaineId) return null;
    var f = CONC().forceDepart, r = { id: "r" + (s.rivaux.prochainId++), chaine: chaineId, villeId: villeId, force: Math.round(entre(s, f[0], f[1])), depuis: s.jour };
    s.rivaux.magasins.push(r);
    return r;
  }
  function rivauxVille(s, villeId) { return s.rivaux ? s.rivaux.magasins.filter(function (r) { return r.villeId === villeId; }) : []; }
  function soldesVille(s, villeId) { return s.rivaux ? s.rivaux.soldes.filter(function (x) { return x.villeId === villeId && x.fin >= s.jour; }) : []; }
  // Concurrence d'une ville (0 à 0,9) : indépendants + magasins rivaux + soldes en cours
  function concurrenceVille(s, villeId) {
    var d = D(), c = d.config, v = villeParId(villeId), tv = d.typesVilles[v.type], C = CONC();
    var base = tv.concurrence * (C ? 1 - C.partRivaux : 1) + c.difficultes[s.difficulte].concurrence;
    rivauxVille(s, villeId).forEach(function (r) { base += chaine(r.chaine).impact * r.force / 50; });
    if (soldesVille(s, villeId).length) base += C.soldes.impact;
    return borne(base, 0, 0.9);
  }
  // Les clients d'une ville où un discounteur est installé comparent davantage les prix
  function pressionPrix(s, villeId) {
    return rivauxVille(s, villeId).reduce(function (a, r) { return a * (1 + (chaine(r.chaine).pressionPrix || 0) * r.force / 50); }, 1);
  }
  function magasinDansVille(s, villeId) {
    for (var i = 0; i < s.magasins.length; i++) if (magasin(s, i).villeId === villeId) return i;
    return -1;
  }
  function rivauxDuMois(s) {
    initRivaux(s);
    if (!s.rivaux) return;
    var C = CONC(), R = s.rivaux, diff = D().config.difficultes[s.difficulte];
    var grace = s.jour < (C.graceMois || 0) * D().config.temps.joursParMois;   // début de partie : on laisse le joueur s'installer
    // 1. Force : elle monte doucement, sauf là où ta réputation dépasse 50
    R.magasins.forEach(function (r) {
      var i = magasinDansVille(s, r.villeId), delta = C.croissance + entre(s, -C.hasard, C.hasard);
      if (i >= 0) delta -= (magasin(s, i).reputation - 50) * C.pressionReputation;
      r.force = borne(r.force + delta, 0, 100);
    });
    // 2. Fermetures
    R.magasins = R.magasins.filter(function (r) {
      if (r.force >= C.forceFermeture) return true;
      var v = villeParId(r.villeId), ch = chaine(r.chaine), chezToi = magasinDansVille(s, r.villeId) >= 0;
      noter(s, ch.nom + " ferme son magasin de " + v.nom + (chezToi ? " : ses clients viennent chez toi." : "."), chezToi ? "bon" : "info");
      if (chezToi) s.evenements.push({ type: "bon", texte: ch.nom + " ferme son magasin de " + v.nom + " : ses clients viennent chez toi !" });
      return false;
    });
    // 3. Ouvertures : de préférence dans les grandes villes et là où tu es installé
    C.chaines.forEach(function (ch) {
      if (rng(s) >= C.ouvertureParMois * (diff.rythme || 1)) return;
      var poids = {};
      D().villes.forEach(function (v) {
        var ici = rivauxVille(s, v.id);
        if (ici.length >= C.maxParVille || ici.some(function (r) { return r.chaine === ch.id; })) return;
        var chezToi = magasinDansVille(s, v.id) >= 0;
        if (grace && chezToi) return;
        poids[v.id] = (C.poidsVilles[v.type] || 1) * (ch.villes[v.type] || 0.1) * (chezToi ? C.attraitTesVilles : 1);
      });
      if (!Object.keys(poids).length) return;
      var vid = tirerPoids(s, poids), v = villeParId(vid), chezToi = magasinDansVille(s, vid) >= 0;
      installerRival(s, vid, ch.id);
      noter(s, ch.nom + " ouvre un magasin à " + v.nom + ".", chezToi ? "alerte" : "info");
      if (chezToi) s.evenements.push({ type: "alerte", texte: ch.nom + " ouvre un magasin à " + v.nom + " : la concurrence se renforce chez toi." });
    });
    // 4. Soldes d'un rival dans une de tes villes
    R.soldes = R.soldes.filter(function (x) { return x.fin >= s.jour; });
    if (!grace) s.magasins.forEach(function (x, i) {
      var vid = magasin(s, i).villeId, ici = rivauxVille(s, vid);
      if (!ici.length || soldesVille(s, vid).length || rng(s) >= C.soldes.chanceParVille) return;
      var r = ici[Math.floor(rng(s) * ici.length)], ch = chaine(r.chaine), v = villeParId(vid);
      R.soldes.push({ villeId: vid, chaine: r.chaine, debut: s.jour + 1, fin: s.jour + C.soldes.jours });
      noter(s, ch.nom + " lance des soldes à " + v.nom + " pendant " + C.soldes.jours + " jours : moins de clients chez toi. Une pub peut compenser.", "alerte");
      s.evenements.push({ type: "alerte", texte: ch.nom + " lance des soldes à " + v.nom + " pendant " + C.soldes.jours + " jours." });
    });
  }
  // Rachat d'un magasin rival : il ferme (ta réputation monte si tu es dans la ville), ou tu reprends son local
  function prixRachat(s, rivalId) {
    var r = s.rivaux && s.rivaux.magasins.filter(function (x) { return x.id === rivalId; })[0];
    if (!r) return null;
    var A = CONC().rachat;
    return Math.round((A.base + r.force * A.parForce + villeParId(r.villeId).loyer * A.moisLoyer) / 100) * 100;
  }
  function conditionsRachat(s, rivalId) {
    var r = s.rivaux && s.rivaux.magasins.filter(function (x) { return x.id === rivalId; })[0], A = CONC().rachat;
    if (!r) return { ok: false, raisons: ["Ce magasin n'existe plus."] };
    var res = { ok: true, raisons: [], rival: r, prix: prixRachat(s, rivalId), reprise: magasinDansVille(s, r.villeId) < 0 };
    if ((s.palier || 1) < A.palierMin) { res.ok = false; res.raisons.push("Rachat possible au palier " + A.palierMin + " (« " + D().config.paliers[A.palierMin].nom + " »)"); }
    if (res.reprise) {   // reprendre le local = ouvrir un magasin : mêmes conditions, sans aménagement ni frais d'ouverture
      var co = conditionsOuverture(s, r.villeId, { rachat: res.prix });
      res.cout = co.cout;
      co.raisons.forEach(function (x) { if (!/^Trésorerie/.test(x)) { res.ok = false; res.raisons.push(x); } });
      res.total = co.cout.total;
    } else res.total = res.prix;
    if (s.argent < res.total) { res.ok = false; res.raisons.push("Trésorerie : " + res.total + " € nécessaires"); }
    return res;
  }
  function racheterRival(s, rivalId) {
    var co = conditionsRachat(s, rivalId);
    if (!co.ok) return { ok: false, raison: "Pas encore possible : " + co.raisons.join(" ; ") + "." };
    var r = co.rival, ch = chaine(r.chaine), v = villeParId(r.villeId);
    s.rivaux.magasins.splice(s.rivaux.magasins.indexOf(r), 1);
    s.rivaux.soldes = s.rivaux.soldes.filter(function (x) { return !(x.villeId === r.villeId && x.chaine === r.chaine); });
    if (co.reprise) {
      var o = ouvrirMagasin(s, r.villeId, { rachat: co.prix, depuis: ch.nom });
      if (!o.ok) { s.rivaux.magasins.push(r); return o; }
      return { ok: true, index: o.index, reprise: true };
    }
    s.argent -= co.prix;
    var i = magasinDansVille(s, r.villeId), mg = magasin(s, i);
    mg.reputation = borne(mg.reputation + CONC().rachat.reputation, 0, 100);
    s.investiRachats = (s.investiRachats || 0) + co.prix;
    noter(s, "Tu rachètes le magasin " + ch.nom + " de " + v.nom + " pour " + co.prix + " € : il ferme, ses clients viennent chez toi.", "bon");
    return { ok: true, index: i, reprise: false };
  }
  // Nombre de magasins de chaque enseigne (pour la fiche de l'enseigne)
  function marche(s) {
    initRivaux(s);
    var mes = {}; s.magasins.forEach(function (x, i) { mes[magasin(s, i).villeId] = true; });
    return CONC().chaines.map(function (ch) {
      var l = s.rivaux.magasins.filter(function (r) { return r.chaine === ch.id; });
      return { chaine: ch, total: l.length, chezToi: l.filter(function (r) { return mes[r.villeId]; }).length };
    });
  }

  // ---------------------------------------------------------------- Logistique (palier 3)
  // Entrepôts régionaux (achat en gros) et flotte de véhicules pour livrer les magasins.
  // Tout cela appartient à l'enseigne : ces champs restent au premier niveau de l'état.
  function LOG() { return D().config.logistique; }
  function initLog(s) {
    s.entrepots = s.entrepots || {}; s.vehicules = s.vehicules || []; s.transferts = s.transferts || [];
    if (s.logistiqueMois == null) s.logistiqueMois = 0;
  }
  function regionDe(s, i) { return villeParId(magasin(s, i).villeId).region; }
  function caAnnuel(s) { return (s.bilansEnseigne || []).slice(-12).reduce(function (a, b) { return a + (b.ca || 0); }, 0); }
  function regionsAvecMagasin(s) {
    var r = {};
    s.magasins.forEach(function (m, i) { r[regionDe(s, i)] = true; });
    return Object.keys(r);
  }
  function verifierPalier3(s) {
    if ((s.palier || 1) !== 2) return;
    var p = D().config.paliers[3];
    if (regionsAvecMagasin(s).length < p.regions || caAnnuel(s) < p.caAnnuel) return;
    s.palier = 3;
    noter(s, "Palier 3 atteint : « " + p.nom + " ». Tu peux construire des entrepôts régionaux et acheter des véhicules.", "bon");
    s.evenements.push({ type: "palier", palier: 3 });
  }
  function reputationMoyenne(s) {
    var n = s.magasins.length, tot = 0;
    s.magasins.forEach(function (m, i) { tot += magasin(s, i).reputation; });
    return n ? tot / n : 0;
  }
  // Palier 4 : la victoire. La partie continue ensuite en mode libre.
  function verifierPalier4(s) {
    if ((s.palier || 1) !== 3) return;
    var p = D().config.paliers[4];
    if (regionsAvecMagasin(s).length < p.regions || reputationMoyenne(s) < p.reputationMoyenne || caAnnuel(s) < (p.caAnnuel || 0)) return;
    s.palier = 4;
    s.victoire = { jour: s.jour, magasins: s.magasins.length, regions: regionsAvecMagasin(s).length, ca: s.stats.ca, ventes: s.stats.ventes };
    noter(s, "Victoire : ton enseigne devient « " + p.nom + " » ! La partie continue en mode libre.", "bon");
    s.evenements.push({ type: "victoire" });
  }
  function unitesEntrepot(e) {
    var n = 0;
    Object.keys(e.stock).forEach(function (k) { n += Math.max(0, e.stock[k]); });
    e.commandes.forEach(function (c) { n += c.qte; });
    return n;
  }
  function coutEntrepot(e, pid) { var m = e.coutMoyen[pid]; return m != null ? m : produit(pid).cout; }
  function construireEntrepot(s, region, villeId) {
    initLog(s);
    var E = LOG().entrepot, nomReg = D().regions[region];
    if ((s.palier || 1) < 3) return { ok: false, raison: "Les entrepôts arrivent au palier 3 (réseau régional)." };
    if (!nomReg) return { ok: false, raison: "Région inconnue." };
    if (s.entrepots[region]) return { ok: false, raison: "Tu as déjà un entrepôt en " + nomReg + "." };
    var cout = E.amenagement + E.loyer + E.charges;
    if (cout > s.argent) return { ok: false, raison: "Trésorerie insuffisante : il faut " + cout + " €." };
    s.argent -= cout; s.logistiqueMois += E.loyer + E.charges;
    s.entrepots[region] = { region: region, villeId: villeId, stock: {}, coutMoyen: {}, commandes: [], ouvertLe: s.jour };
    noter(s, "Entrepôt construit en " + nomReg + " (" + villeParId(villeId).nom + ") : " + cout + " € avec le premier loyer.", "bon");
    return { ok: true };
  }
  function acheterVehicule(s, type) {
    initLog(s);
    var V = LOG().vehicules[type];
    if ((s.palier || 1) < 3) return { ok: false, raison: "La flotte arrive au palier 3 (réseau régional)." };
    if (!V) return { ok: false, raison: "Véhicule inconnu." };
    if (V.prix > s.argent) return { ok: false, raison: "Trésorerie insuffisante : il faut " + V.prix + " €." };
    s.argent -= V.prix;
    var n = s.vehicules.filter(function (v) { return v.type === type; }).length + 1;
    s.vehicules.push({ id: "v" + (s.prochainId++), type: type, nom: V.nom + " " + n, panneJusqu: null, chargeJour: -1, charge: 0 });
    noter(s, "Achat : " + V.nom.toLowerCase() + " (" + V.prix + " €). Entretien " + V.entretien + " € par mois.", "info");
    return { ok: true };
  }
  function vendreVehicule(s, id) {
    initLog(s);
    var k = s.vehicules.findIndex(function (v) { return v.id === id; });
    if (k < 0) return { ok: false, raison: "Véhicule introuvable." };
    var v = s.vehicules[k], V = LOG().vehicules[v.type], gain = Math.round(V.prix * LOG().revente);
    s.vehicules.splice(k, 1); s.argent += gain;
    noter(s, v.nom + " revendu " + gain + " €.", "info");
    return { ok: true, gain: gain };
  }
  function prixGros(s, p, qte) {
    var E = LOG().entrepot, u = coutAchat(s, p);
    return qte >= E.minGros ? Math.round(u * (1 - E.remiseGros)) : u;
  }
  function commanderEntrepot(s, region, prodId, qte) {
    initLog(s);
    var e = s.entrepots[region], p = produit(prodId), E = LOG().entrepot;
    qte = Math.floor(qte);
    if (!e) return { ok: false, raison: "Pas d'entrepôt dans cette région." };
    if (!p || !(qte > 0)) return { ok: false, raison: "Quantité invalide." };
    if (!disponible(s, p)) return { ok: false, raison: "Ce produit n'est pas encore débloqué." };
    if (unitesEntrepot(e) + qte > E.capacite) return { ok: false, raison: "Entrepôt plein : " + (E.capacite - unitesEntrepot(e)) + " places libres sur " + E.capacite + "." };
    var u = prixGros(s, p, qte), cout = u * qte, f = D().fournisseurs[0];
    if (cout > s.argent) return { ok: false, raison: "Trésorerie insuffisante (" + cout + " € nécessaires)." };
    s.argent -= cout;
    var arrivee = s.jour + f.delaiJours + (modifs(s).delai[p.typeId] || 0);
    e.commandes.push({ prodId: prodId, qte: qte, cout: cout, arrivee: arrivee, depart: s.jour });
    noter(s, "Achat en gros pour l'entrepôt " + D().regions[region] + " : " + qte + " × " + p.nom + " (" + cout + " €" + (qte >= E.minGros ? ", −" + Math.round(E.remiseGros * 100) + " %" : "") + "), livraison jour " + (arrivee + 1) + ".", "info");
    return { ok: true, cout: cout };
  }
  // Places libres aujourd'hui dans la flotte pour un trajet (dans la région ou ailleurs)
  function vehiculesDispo(s, memeRegion) {
    initLog(s);
    return s.vehicules.filter(function (v) {
      var V = LOG().vehicules[v.type];
      if (v.panneJusqu != null && v.panneJusqu >= s.jour) return false;
      return V.portee === "france" || memeRegion;
    }).map(function (v) {
      var V = LOG().vehicules[v.type];
      return { v: v, libre: V.capacite - (v.chargeJour === s.jour ? v.charge : 0) };
    });
  }
  function capaciteDispo(s, memeRegion) { return vehiculesDispo(s, memeRegion).reduce(function (a, x) { return a + Math.max(0, x.libre); }, 0); }
  function transferer(s, region, idx, prodId, qte) {
    initLog(s);
    var e = s.entrepots[region], L = LOG();
    qte = Math.floor(qte);
    if (!e) return { ok: false, raison: "Pas d'entrepôt dans cette région." };
    if (!s.magasins[idx]) return { ok: false, raison: "Magasin inconnu." };
    if (!(qte > 0)) return { ok: false, raison: "Quantité invalide." };
    if ((e.stock[prodId] || 0) < qte) return { ok: false, raison: "Pas assez de stock à l'entrepôt (" + (e.stock[prodId] || 0) + ")." };
    var meme = regionDe(s, idx) === region, dispo = vehiculesDispo(s, meme);
    var libre = dispo.reduce(function (a, x) { return a + Math.max(0, x.libre); }, 0);
    if (!dispo.length) return { ok: false, raison: meme ? "Aucun véhicule disponible : achète une camionnette ou un camion." : "Hors de la région, il faut un camion disponible." };
    if (libre < qte) return { ok: false, raison: "La flotte n'a plus que " + libre + " places aujourd'hui." };
    var reste = qte;
    dispo.sort(function (a, b) { return a.libre - b.libre; }).forEach(function (x) {
      if (!reste || x.libre <= 0) return;
      var pris = Math.min(reste, x.libre);
      if (x.v.chargeJour !== s.jour) { x.v.chargeJour = s.jour; x.v.charge = 0; }
      x.v.charge += pris; reste -= pris;
    });
    e.stock[prodId] -= qte;
    var arrivee = s.jour + (meme ? L.delaiRegion : L.delaiFrance), vers = villeParId(magasin(s, idx).villeId).nom;
    s.transferts.push({ id: "x" + (s.prochainId++), region: region, vers: idx, prodId: prodId, qte: qte, coutUnit: coutEntrepot(e, prodId), arrivee: arrivee, depart: s.jour });
    noter(s, "Transfert : " + qte + " × " + produit(prodId).nom + " de l'entrepôt " + D().regions[region] + " vers " + vers + ", arrivée jour " + (arrivee + 1) + ".", "info");
    return { ok: true, arrivee: arrivee };
  }
  // Chaque matin : livraisons des entrepôts et des magasins, pannes, et en début de mois loyers et entretien
  function logistiqueDuJour(s) {
    initLog(s);
    var L = LOG(), c = D().config.temps;
    Object.keys(s.entrepots).forEach(function (reg) {
      var e = s.entrepots[reg];
      e.commandes = e.commandes.filter(function (cmd) {
        if (cmd.arrivee > s.jour) return true;
        var avant = Math.max(0, e.stock[cmd.prodId] || 0);
        e.coutMoyen[cmd.prodId] = Math.round((avant * coutEntrepot(e, cmd.prodId) + cmd.cout) / (avant + cmd.qte));
        e.stock[cmd.prodId] = avant + cmd.qte;
        noter(s, "Entrepôt " + D().regions[reg] + " : livraison de " + cmd.qte + " × " + produit(cmd.prodId).nom + ".", "bon");
        return false;
      });
    });
    s.transferts = s.transferts.filter(function (x) {
      if (x.arrivee > s.jour) return true;
      var m = magasin(s, x.vers);
      if (!m) return false;
      var avant = Math.max(0, m.stock[x.prodId] || 0);
      if (!m.coutMoyen) m.coutMoyen = {};
      var moyen = m.coutMoyen[x.prodId] != null ? m.coutMoyen[x.prodId] : produit(x.prodId).cout;
      m.coutMoyen[x.prodId] = Math.round((avant * moyen + x.qte * x.coutUnit) / (avant + x.qte));
      m.stock[x.prodId] = avant + x.qte;
      noter(s, villeParId(m.villeId).nom + " · livraison de l'entrepôt : " + x.qte + " × " + produit(x.prodId).nom + ".", "bon");
      return false;
    });
    s.vehicules.forEach(function (v) {
      if (v.panneJusqu != null && v.panneJusqu < s.jour) { v.panneJusqu = null; noter(s, v.nom + " est réparé(e) et reprend la route.", "info"); }
      if (v.panneJusqu == null && rng(s) < L.vehicules[v.type].panne) {
        v.panneJusqu = s.jour + Math.floor(entre(s, L.dureePanne[0], L.dureePanne[1] + 1)) - 1;
        noter(s, "Panne : " + v.nom + " immobilisé(e) jusqu'au jour " + (v.panneJusqu + 1) + ".", "alerte");
      }
    });
    if (s.jour % c.joursParMois === 0 && s.jour > 0) {
      var E = L.entrepot, nE = Object.keys(s.entrepots).length;
      var entretien = s.vehicules.reduce(function (a, v) { return a + L.vehicules[v.type].entretien; }, 0);
      var total = nE * (E.loyer + E.charges) + entretien;
      s.logistiqueMois = total;
      if (total) { s.argent -= total; noter(s, "Logistique du mois : " + total + " € (" + nE + " entrepôt" + (nE > 1 ? "s" : "") + ", entretien de " + s.vehicules.length + " véhicule" + (s.vehicules.length > 1 ? "s" : "") + ").", "info"); }
    }
  }

  // ---------------------------------------------------------------- Responsable de magasin (pilotage automatique)
  function aUnResponsable(s) { return s.employes.some(function (e) { return e.poste === "responsable"; }); }
  function reglagesPilotage(s) {
    if (!s.pilotage) s.pilotage = { reassort: true, embauches: true, atelier: true, cible: D().config.pilotage.stockCible };
    return s.pilotage;
  }
  // Configuration proposée pour un PC sur mesure : la pièce juste suffisante, en stock si possible
  function compoAuto(s, dem) {
    var choix = {}, go = gammesOuvertes(s);
    M().composants.forEach(function (comp) {
      var mg = minGamme(s, dem, comp) || 0, trouve = null;
      for (var g = mg; g < go && !trouve; g++) if ((s.stock[comp + "_" + g] || 0) > 0) trouve = comp + "_" + g;
      choix[comp] = trouve || comp + "_" + mg;
    });
    return choix;
  }
  function enRoute(s, pid) {
    var n = s.commandes.reduce(function (a, c) { return a + (c.prodId === pid && !c.pourJob ? c.qte : 0); }, 0);
    (s.transferts || []).forEach(function (x) { if (x.vers === s.courant && x.prodId === pid) n += x.qte; });
    return n;
  }
  function pilotageAuto(s) {
    if (!aUnResponsable(s) || ferme(s)) return;
    var P = reglagesPilotage(s), cfg = D().config.pilotage, bilan = { commandes: 0, cout: 0, transferts: 0, embauches: [], propositions: 0, refus: 0, rayons: 0 };
    silencieux = true;
    try {
      if (P.embauches) ["vendeur", "caissier"].forEach(function (poste) {
        if (s.employes.some(function (e) { return e.poste === poste; })) return;
        var c = s.candidats.filter(function (x) { return x.poste === poste; }).sort(function (a, b) { return b.niveau - a.niveau || a.salaire - b.salaire; })[0];
        if (c && embaucher(s, c.id).ok) bilan.embauches.push(c.nom + " (" + D().config.postes[poste].nom.toLowerCase() + ")");
      });
      if (P.reassort) {
        // rayons vides : les produits que la clientèle de la ville demande le plus
        var envies = D().profilsClients[ville(s).profil].envies, g = Math.min(cfg.assortiment, gammesOuvertes(s) - 1);
        var types = D().typesProduits.slice().sort(function (a, b) { return (envies[b.id] || 0.5) - (envies[a.id] || 0.5); });
        s.rayons.forEach(function (pid, i) {
          if (pid) return;
          var t0 = types.filter(function (t) { return s.rayons.indexOf(t.id + "_" + g) < 0; })[0];
          if (t0) { s.rayons[i] = t0.id + "_" + g; bilan.rayons++; }
        });
        // réassort : l'entrepôt de la région d'abord, sinon le fournisseur
        var reg = s.magasins ? regionDe(s, s.courant) : null, ent = reg && s.entrepots && s.entrepots[reg];
        s.rayons.forEach(function (pid) {
          if (!pid || !disponible(s, pid)) return;
          var manque = P.cible - Math.max(0, s.stock[pid] || 0) - enRoute(s, pid);
          if (manque <= 0) return;
          if (ent && (ent.stock[pid] || 0) > 0) {
            var q = Math.min(manque, ent.stock[pid]);
            if (transferer(s, reg, s.courant, pid, q).ok) { manque -= q; bilan.transferts += q; }
          }
          if (manque > 0 && s.argent - coutAchat(s, pid) * manque >= cfg.reserve) {
            if (commander(s, pid, manque).ok) { bilan.commandes++; bilan.cout += coutAchat(s, pid) * manque; }
          }
        });
      }
      if (P.atelier) s.atelier.demandes.slice().forEach(function (dem) {
        if (dem.essais) return;
        if (!aUnTechnicien(s)) { refuserDemande(s, dem.id); bilan.refus++; return; }
        var choix = compoAuto(s, dem), ev = evaluerMontage(s, dem, choix, null);
        if (!ev.complet || ev.coutCommande > s.argent - cfg.reserve) { refuserDemande(s, dem.id); bilan.refus++; return; }
        proposerMontage(s, dem.id, choix, Math.min(ev.suggere, dem.budget)); bilan.propositions++;
      });
    } finally { silencieux = false; }
    var parts = [];
    if (bilan.embauches.length) parts.push("embauche " + bilan.embauches.join(", "));
    if (bilan.rayons) parts.push(bilan.rayons + " rayon" + (bilan.rayons > 1 ? "s" : "") + " rempli" + (bilan.rayons > 1 ? "s" : ""));
    if (bilan.commandes) parts.push(bilan.commandes + " commande" + (bilan.commandes > 1 ? "s" : "") + " (" + Math.round(bilan.cout) + " €)");
    if (bilan.transferts) parts.push(bilan.transferts + " unités demandées à l'entrepôt");
    if (bilan.propositions) parts.push(bilan.propositions + " offre" + (bilan.propositions > 1 ? "s" : "") + " de PC sur mesure");
    if (bilan.refus) parts.push(bilan.refus + " demande" + (bilan.refus > 1 ? "s" : "") + " d'atelier déclinée" + (bilan.refus > 1 ? "s" : ""));
    if (parts.length) { var j = infosDate(s); s.journal.unshift({ jour: s.jour, quand: "J" + (s.jour + 1) + " " + pad(j.heure) + "h" + pad(j.minute), texte: prefixe + "Ton responsable : " + parts.join(" · ") + ".", type: "info" }); }
  }
  function reglerPilotage(s, cle, valeur) {
    var P = reglagesPilotage(s);
    if (cle === "cible") P.cible = Math.max(1, Math.min(40, Math.round(+valeur) || D().config.pilotage.stockCible));
    else if (cle in P) P[cle] = !!valeur;
  }

  // ---------------------------------------------------------------- Actions du joueur
  function commander(s, prodId, qte, pourJob) {
    var p = produit(prodId); qte = Math.floor(qte);
    if (!p || qte <= 0) return { ok: false, raison: "Quantité invalide." };
    if (!disponible(s, p)) return { ok: false, raison: "Ce produit n'est pas encore débloqué : " + conditionGamme(p.gamme) + "." };
    var f = D().fournisseurs[0], cout = coutAchat(s, p) * qte, retardEvt = modifs(s).delai[p.typeId] || 0;
    if (cout > s.argent) return { ok: false, raison: "Trésorerie insuffisante (" + cout + " € nécessaires)." };
    s.argent -= cout; s.mois.achats += cout;
    var retard = rng(s) > f.fiabilite ? 1 : 0;
    var cmd = { id: "c" + (s.prochainId++), prodId: prodId, qte: qte, cout: cout, arrivee: s.jour + f.delaiJours + retardEvt + retard, depart: s.jour };
    if (pourJob) {   // pièce réservée à un PC sur mesure : elle va directement à l'atelier
      cmd.pourJob = pourJob; cmd.retard = retard;
      s.commandes.push(cmd);
      return { ok: true, cmd: cmd };
    }
    s.commandes.push(cmd);
    if (s.rayons.indexOf(prodId) < 0) {
      var libre = s.rayons.indexOf(null);
      if (libre >= 0) s.rayons[libre] = prodId;
    }
    noter(s, "Commande : " + qte + " × " + p.nom + " (" + cout + " €), livraison prévue jour " + (s.jour + f.delaiJours + retardEvt + 1) + ".", "info");
    return { ok: true };
  }
  // Agrandissement : on déménage vers la taille suivante. L'ancien dépôt de garantie est rendu,
  // on verse le nouveau et l'aménagement. Stock, équipe et rayons suivent ; la boutique ferme quelques jours.
  function localSuivant(s) {
    var o = D().config.ordreLocaux, i = o.indexOf(s.local);
    return i >= 0 && i < o.length - 1 ? o[i + 1] : null;
  }
  function coutDemenagement(s, taille) {
    var loc = D().config.locaux[taille], depot = loyerLocal(s, taille) * loc.depotMoisLoyer;
    var rendu = s.depot != null ? s.depot : ville(s).loyer * local(s).depotMoisLoyer;
    return { depot: depot, rendu: rendu, amenagement: loc.amenagement, total: depot - rendu + loc.amenagement };
  }
  function demenager(s, taille) {
    var c = D().config;
    if (taille !== localSuivant(s)) return { ok: false, raison: "Ce local n'est pas disponible." };
    if (ferme(s)) return { ok: false, raison: "Un déménagement est déjà en cours." };
    var cout = coutDemenagement(s, taille);
    if (cout.total > s.argent) return { ok: false, raison: "Trésorerie insuffisante : il faut " + cout.total + " €." };
    s.argent -= cout.total;
    s.mois.installation = (s.mois.installation || 0) + cout.total;
    s.depot = cout.depot;
    s.local = taille;
    var loc = local(s);
    while (s.rayons.length < loc.emplacements) s.rayons.push(null);
    if (D().deco) recaserDeco(s);
    // Les clients présents repartent sans rancune ; la boutique ferme le temps du déménagement
    s.clients.forEach(function (cl) { s.employes.forEach(function (e) { if (e.tache && e.tache.clientId === cl.id) libererTache(s, e); }); });
    s.clients = []; s.file = [];
    s.fermeJusqu = s.jour + (c.joursDemenagement || 2) - 1;
    if (s.minuteJour >= c.temps.fermeture - 1) s.fermeJusqu++;   // déménagement lancé le soir : il commence demain
    noter(s, "Déménagement vers un " + loc.nom.toLowerCase() + " (" + cout.total + " €) : la boutique rouvre le jour " + (s.fermeJusqu + 2) + ". Loyer à venir : " + loyerLocal(s) + " € par mois.", "info");
    return { ok: true, cout: cout };
  }
  function placerRayon(s, emplacement, prodId) {
    if (emplacement < 0 || emplacement >= s.rayons.length) return { ok: false };
    if (prodId && !disponible(s, produit(prodId)) && !(s.stock[prodId] > 0)) return { ok: false };
    if (prodId) {
      var ancien = s.rayons.indexOf(prodId);
      if (ancien >= 0) s.rayons[ancien] = null;
    }
    s.rayons[emplacement] = prodId || null;
    return { ok: true };
  }
  function fixerMarge(s, categorie, marge) {
    var c = D().config;
    s.marges[categorie] = borne(marge, c.margeMin, c.margeMax);
  }
  function fixerPrix(s, prodId, prix) {
    if (prix == null || prix === "" || isNaN(prix)) delete s.prixFixes[prodId];
    else s.prixFixes[prodId] = Math.max(1, Math.round(prix));
  }
  function embaucher(s, candId) {
    var i = s.candidats.findIndex(function (c) { return c.id === candId; });
    if (i < 0) return { ok: false };
    var e = s.candidats.splice(i, 1)[0];
    s.employes.push(e);
    noter(s, e.nom + " rejoint l'équipe comme " + D().config.postes[e.poste].nom.toLowerCase() + " (" + e.salaire + " €/mois).", "bon");
    return { ok: true };
  }
  function licencier(s, empId) {
    var i = s.employes.findIndex(function (e) { return e.id === empId; });
    if (i < 0) return { ok: false };
    var e = s.employes[i];
    libererTache(s, e);
    s.employes.splice(i, 1);
    noter(s, e.nom + " a été licencié(e).", "alerte");
    return { ok: true };
  }
  function libererTache(s, e) {
    if (!e.tache) return;
    if (e.tache.type === "montage") {
      var job = trouverTravail(s, e.tache.jobId);
      if (job) job.tech = null;
      e.tache = null;
      return;
    }
    var cl = trouverClient(s, e.tache.clientId);
    if (cl) {
      if (e.tache.type === "conseil") { cl.etat = "attend_conseil"; cl.depuis = maintenant(s); }
      else { cl.etat = "file"; s.file.unshift(cl.id); }
    }
    e.tache = null;
  }

  // ---------------------------------------------------------------- Clients
  function trouverClient(s, id) {
    for (var i = 0; i < s.clients.length; i++) if (s.clients[i].id === id) return s.clients[i];
    return null;
  }
  function tirerProfil(s) {
    var d = D(), dom = ville(s).profil, poids = {}, autres = Object.keys(d.profilsClients).length - 1, amb = ambiance(s);
    Object.keys(d.profilsClients).forEach(function (k) {
      poids[k] = (k === dom ? d.partProfilDominant : (1 - d.partProfilDominant) / autres) * (modifs(s).profils[k] || 1);
      if (amb.parTheme[k]) poids[k] *= 1 + d.deco.effets.themeProfil * amb.parTheme[k];
    });
    return tirerPoids(s, poids);
  }
  function nouveauClient(s) {
    var d = D(), c = d.config, profilId = tirerProfil(s), campagne = null;
    var E = effetPub(s);
    if (E > 0 && rng(s) < E / (1 + E)) {
      var poidsC = {};
      s.pubs.forEach(function (x) { var e = effetCampagne(s, x); if (e > 0) poidsC[x.id] = e; });
      campagne = trouverPub(s, tirerPoids(s, poidsC));
      if (campagne) {
        campagne.clients++; s.mois.clientsPub++;
        if (campagne.cible !== "tous" && rng(s) < PUB().cibleSurProfil) profilId = campagne.cible;
      }
    }
    var pr = d.profilsClients[profilId];
    var envies = {}, me = modifs(s).envies;
    Object.keys(pr.envies).forEach(function (k) { envies[k] = pr.envies[k] * (me[k] || 1); });
    var typeId = tirerPoids(s, envies);
    // les clients ne demandent que les gammes que le marché connaît déjà chez toi
    var poidsGammes = {};
    for (var gi = 0; gi < gammesOuvertes(s); gi++) poidsGammes[gi] = pr.gammes[gi];
    var g = +tirerPoids(s, poidsGammes);
    var type = d.typesProduits.filter(function (t) { return t.id === typeId; })[0];
    var cl = {
      id: "k" + (s.prochainId++), profil: profilId, typeVoulu: typeId, gamme: g,
      budget: Math.round(type.prix[g] * entre(s, 0.95, 1.3)),
      etat: "parcourt", depuis: maintenant(s),
      finParcours: maintenant(s) + Math.round(entre(s, c.durees.parcourirMin, c.durees.parcourirMax)),
      patience: Math.round(pr.patience * entre(s, 0.8, 1.2) * (1 + ambiance(s).patience)),
      prodId: null, prix: 0, conseille: false, rayon: Math.floor(rng(s) * s.rayons.length),
      pub: campagne ? campagne.id : null
    };
    // Le client se dirige vers le rayon qui présente ce qu'il cherche, s'il existe.
    for (var i = 0; i < s.rayons.length; i++) {
      var pid = s.rayons[i];
      if (pid && produit(pid).typeId === typeId) { cl.rayon = i; if (produit(pid).gamme === g) break; }
    }
    return cl;
  }
  // ---------------------------------------------------------------- Déblocage des gammes
  function gammesOuvertes(s) { return s.gammes == null ? 3 : s.gammes; }
  function disponible(s, p) { if (typeof p === "string") p = produit(p); return p.gamme < gammesOuvertes(s); }
  function conditionGamme(g) {
    var d = D().config.deblocages.filter(function (x) { return x.gamme === g; })[0];
    return d ? "se débloque avec " + d.texte : "";
  }
  function verifierDeblocages(s) {
    D().config.deblocages.forEach(function (d) {
      if (gammesOuvertes(s) !== d.gamme) return;           // une gamme à la fois, dans l'ordre
      var c = d.conditions;
      var ok = (c.moisPositifs != null && s.stats.moisPositifs >= c.moisPositifs) ||
               (c.reputation != null && reputationMax(s) >= c.reputation);
      if (!ok) return;
      s.gammes = d.gamme + 1;
      var f = D().fournisseurs[0];
      noter(s, "Ton fournisseur t'a trouvé de nouveaux produits : " + f.nom + " te propose sa " + d.nom + ".", "info");
      s.evenements.push({ type: "deblocage", gamme: d.gamme, nom: d.nom });
    });
  }

  function besoinConseil(cl) {
    var t = D().typesProduits.filter(function (x) { return x.id === cl.typeVoulu; })[0];
    return D().categories[t.categorie].conseil;
  }
  // Cherche en rayon le produit qui convient (gamme voulue, sinon voisine).
  function choisirProduit(s, cl, avecConseil) {
    var options = [];
    s.rayons.forEach(function (pid) {
      if (!pid || !(s.stock[pid] > 0)) return;
      var p = produit(pid);
      if (p.typeId !== cl.typeVoulu) return;
      options.push(p);
    });
    if (!options.length) return null;
    options.sort(function (a, b) { return Math.abs(a.gamme - cl.gamme) - Math.abs(b.gamme - cl.gamme); });
    var p = options[0];
    if (p.gamme === cl.gamme) return p;
    var accepte = avecConseil ? 0.8 : 0.45;
    if (p.gamme > cl.gamme && prixVente(s, p) > cl.budget * 1.25) accepte *= 0.3;
    return rng(s) < accepte ? p : null;
  }
  function decider(s, cl, vendeur) {
    var d = D(), c = d.config, pr = d.profilsClients[cl.profil];
    var p = choisirProduit(s, cl, !!vendeur);
    if (!p) {
      s.mois.introuvables++;
      changerReputation(s, c.reputation.introuvable);
      return partir(s, cl, "introuvable");
    }
    var prix = prixVente(s, p), ratio = prix / prixMarche(s, p);
    var facteurPrix = ratio > 1 ? Math.exp(-pr.sensibilitePrix * modifs(s).sensibilite * pressionPrix(s, s.villeId) * (ratio - 1)) : Math.min(1.25, 1 + (1 - ratio) * 1.5);
    var chance = pr.conversion * facteurPrix;
    if (vendeur) chance *= 1.15 + 0.05 * vendeur.niveau;
    var amb = ambiance(s);
    if (D().deco) chance *= (1 + amb.conversion) * (1 + (amb.parTheme[cl.profil] || 0) * D().deco.effets.themeConversion);
    if (prix > cl.budget * 1.2) chance *= 0.25;
    chance = borne(chance, 0, 0.97);
    if (rng(s) < chance) {
      s.stock[p.id]--;
      cl.prodId = p.id; cl.prix = prix; cl.conseille = !!vendeur;
      cl.etat = "file"; cl.depuis = maintenant(s);
      s.file.push(cl.id);
    } else {
      s.mois.refus++;
      if (facteurPrix < 0.6) changerReputation(s, c.reputation.tropCher);
      partir(s, cl, "refus");
    }
  }
  function partir(s, cl, raison) {
    var i = s.clients.indexOf(cl);
    if (i >= 0) s.clients.splice(i, 1);
    var j = s.file.indexOf(cl.id);
    if (j >= 0) s.file.splice(j, 1);
    if (cl.prodId && raison !== "achat") { s.stock[cl.prodId] = (s.stock[cl.prodId] || 0) + 1; }
    s.sorties.push({ id: cl.id, profil: cl.profil, raison: raison });
  }
  function changerReputation(s, delta) {
    if (delta > 0 && D().deco) delta *= 1 + ambiance(s).reputation;
    s.reputation = borne(s.reputation + delta, 0, 100);
  }

  function encaisser(s, cl) {
    var p = produit(cl.prodId), r = D().config.reputation;
    s.argent += cl.prix;
    s.mois.ca += cl.prix; s.mois.cogs += coutStock(s, p.id); s.mois.ventes++;
    var cp = cl.pub && trouverPub(s, cl.pub);
    if (cp) { cp.ventes++; cp.ca += cl.prix; }
    s.stats.ventes++; s.stats.ca += cl.prix;
    changerReputation(s, r.venteReussie + (cl.conseille ? r.bonusConseil : 0));
    var g = D().reparations.garantie;
    if ((g.categories.indexOf(p.categorie) >= 0 || g.types.indexOf(p.typeId) >= 0) && rng(s) < g.chance)
      s.atelier.garanties.push({ prodId: p.id, jour: s.jour + g.jours[0] + Math.floor(rng(s) * (g.jours[1] - g.jours[0] + 1)) });
    partir(s, cl, "achat");
  }

  // ---------------------------------------------------------------- Atelier : PC sur mesure
  function M() { return D().montage; }
  function trouverTravail(s, id) {
    var t = s.atelier.travaux;
    for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i];
    return null;
  }
  function aUnTechnicien(s) { return s.employes.some(function (e) { return e.poste === "technicien"; }); }
  function tauxDemandes(s) {
    var d = D(), c = d.config, v = ville(s), tv = d.typesVilles[v.type];
    var concurrence = concurrenceVille(s, s.villeId);
    var rep = 0.4 + 1.2 * s.reputation / 100;
    return tv.clientsParJour * (1 - concurrence) * rep * M().attraitProfil[v.profil] * M().demandesParClient *
      c.temps.affluenceJour[s.jour % 7] * (1 + effetPubAtelier(s)) / (c.temps.fermeture - c.temps.ouverture);
  }
  // Gamme minimum attendue pour un composant (null = le client n'a pas d'exigence)
  function minGamme(s, dem, comp) {
    var ex = M().usages[dem.usage].exigences[comp];
    if (ex == null) return null;
    return borne(dem.gamme + ex, 0, gammesOuvertes(s) - 1);
  }
  function nouvelleDemande(s) {
    var d = D(), m = M(), profil = tirerProfil(s), pr = d.profilsClients[profil];
    var usage = tirerPoids(s, m.usagesParProfil[profil]);
    var poidsGammes = {};
    for (var gi = 0; gi < gammesOuvertes(s); gi++) poidsGammes[gi] = pr.gammes[gi];
    var g = +tirerPoids(s, poidsGammes);
    var dem = { id: "d" + (s.prochainId++), profil: profil, usage: usage, gamme: g, essais: 0, expire: s.jour + m.dureeDemandeJours };
    // Budget : la configuration idéale au prix du marché, avec une marge de manœuvre variable
    var total = 0, gCpu = 0;
    m.composants.forEach(function (comp) {
      var mg = minGamme(s, dem, comp), gc = mg == null ? 0 : mg;
      if (comp === "processeur") gCpu = gc;
      total += prixMarche(s, comp + "_" + gc);
    });
    total += m.forfait[gCpu];
    dem.budget = Math.round(total * entre(s, 0.95, 1.25) / 10) * 10;
    var i = infosDate(s);
    dem.quand = "J" + (s.jour + 1) + " " + pad(i.heure) + "h" + pad(i.minute);
    s.atelier.demandes.push(dem);
    noter(s, "Demande de PC sur mesure : " + d.profilsClients[profil].nom.toLowerCase() + ", usage " + m.usages[usage].nom.toLowerCase() + ", budget " + dem.budget + " €.", "info");
    s.evenements.push({ type: "demande", texte: "Nouvelle demande de PC sur mesure (budget " + dem.budget + " €)." });
    return dem;
  }
  // Évalue une proposition sans tirer au sort (sert aussi à l'aperçu affiché au joueur).
  function evaluerMontage(s, demOuId, choix, prix) {
    var m = M(), dem = typeof demOuId === "string" ? s.atelier.demandes.filter(function (x) { return x.id === demOuId; })[0] : demOuId;
    var r = { complet: true, manques: [], cout: 0, suggere: 0, gCpu: 0, chance: 0, verdict: "incomplet", aCommander: [], coutCommande: 0 };
    if (!dem) { r.complet = false; return r; }
    choix = choix || {};
    m.composants.forEach(function (comp) {
      var p = choix[comp] && produit(choix[comp]);
      if (!p || p.typeId !== comp || !disponible(s, p)) { r.complet = false; return; }
      var enStock = s.stock[p.id] > 0, cp = enStock ? coutStock(s, p.id) : coutAchat(s, p);
      if (!enStock) { r.aCommander.push(p.id); r.coutCommande += cp; }
      var mg = minGamme(s, dem, comp);
      if (mg != null && p.gamme < mg) r.manques.push({ comp: comp, min: mg, gamme: p.gamme });
      if (comp === "processeur") r.gCpu = p.gamme;
      r.cout += cp; r.suggere += prixVente(s, p);
    });
    r.cout += m.coutInclus[r.gCpu]; r.suggere += m.forfait[r.gCpu];
    r.suggere = Math.round(r.suggere / 10) * 10;
    if (!r.complet) return r;
    var retardEvt = r.aCommander.reduce(function (a, pid) { return Math.max(a, modifs(s).delai[produit(pid).typeId] || 0); }, 0);
    r.delai = m.delaiJours + (r.aCommander.length ? D().fournisseurs[0].delaiJours + retardEvt : 0);
    prix = prix || r.suggere;
    r.prix = prix; r.marge = prix - r.cout; r.ratio = prix / dem.budget;
    if (r.manques.length) { r.verdict = "insuffisant"; r.chance = 0; return r; }
    var base = r.ratio <= 1 ? 1 : Math.exp(-m.usages[dem.usage].sensibilite * (r.ratio - 1));
    r.chance = borne(base * (0.9 + 0.2 * s.reputation / 100), 0, 0.98);
    r.verdict = r.ratio <= 1 ? "probable" : r.chance >= 0.45 ? "hesite" : "trop_cher";
    return r;
  }
  function proposerMontage(s, demId, choix, prix) {
    var m = M(), d = D(), k = s.atelier.demandes.findIndex(function (x) { return x.id === demId; });
    if (k < 0) return { ok: false, raison: "Ce client est parti." };
    var dem = s.atelier.demandes[k];
    if (!aUnTechnicien(s)) return { ok: false, raison: "Embauche d'abord un technicien : personne ne pourrait monter ce PC." };
    prix = Math.round(+prix);
    if (!(prix > 0)) return { ok: false, raison: "Indique un prix." };
    var ev = evaluerMontage(s, dem, choix, prix);
    if (!ev.complet) return { ok: false, raison: "Choisis les quatre composants." };
    if (ev.coutCommande > s.argent) return { ok: false, raison: "Trésorerie insuffisante pour commander les pièces manquantes (" + ev.coutCommande + " €)." };
    dem.essais++;
    var dernier = dem.essais >= m.essais, raison;
    if (ev.manques.length) {
      changerReputation(s, m.reputation.insuffisant);
      var mq = ev.manques[0], nomType = d.typesProduits.filter(function (t) { return t.id === mq.comp; })[0].nom.toLowerCase();
      raison = "Pas assez puissant pour " + m.usages[dem.usage].nom.toLowerCase() + " : " + produit(choix[mq.comp]).nom + " ne lui suffit pas, il voulait au moins " + produit(mq.comp + "_" + mq.min).nom + ".";
    } else if (rng(s) < ev.chance) {
      var job = {
        id: "t" + (s.prochainId++), type: "montage", profil: dem.profil, usage: dem.usage,
        choix: Object.assign({}, choix), prix: prix, cout: ev.cout,
        restant: m.dureeMontage, total: m.dureeMontage, echeance: s.jour + ev.delai, tech: null, attente: []
      };
      // Pièces en stock : prises tout de suite ; pièces manquantes : commandées pour ce PC
      m.composants.forEach(function (comp) {
        var pid = choix[comp];
        if (s.stock[pid] > 0) s.stock[pid]--;
        else if (commander(s, pid, 1, job.id).ok) job.attente.push(pid);
      });
      if (job.attente.length) noter(s, "Pièces commandées pour ce PC : " + job.attente.map(function (pid) { return produit(pid).nom; }).join(", ") + " (" + ev.coutCommande + " €).", "info");
      s.atelier.travaux.push(job);
      s.atelier.demandes.splice(k, 1);
      noter(s, "PC sur mesure accepté à " + prix + " € (" + m.usages[dem.usage].nom.toLowerCase() + ") : à livrer au plus tard le jour " + (job.echeance + 1) + ".", "bon");
      return { ok: true, accepte: true, job: job };
    } else {
      raison = ev.ratio > 1 ? "Trop cher pour son budget de " + dem.budget + " €." : "Le client hésite et préfère réfléchir.";
    }
    if (dernier) {
      s.atelier.demandes.splice(k, 1);
      noter(s, "Le client renonce à son PC sur mesure. " + raison, "alerte");
      return { ok: true, accepte: false, parti: true, raison: raison };
    }
    return { ok: true, accepte: false, parti: false, raison: raison };
  }
  function refuserDemande(s, demId) {
    var k = s.atelier.demandes.findIndex(function (x) { return x.id === demId; });
    if (k >= 0) s.atelier.demandes.splice(k, 1);
    return { ok: k >= 0 };
  }
  // Un technicien a fini son travail
  function terminerTravail(s, job, e) {
    var m = M(), d = D(), ta = s.atelier.travaux;
    ta.splice(ta.indexOf(job), 1);
    var retard = s.jour > job.echeance;
    if (job.type === "sav") {
      changerReputation(s, retard ? m.reputation.retard : job.origine === "garantie" ? 0.2 : m.reputation.savTermine);
      noter(s, "SAV terminé : le PC du client est réparé" + (retard ? ", mais en retard." : "."), retard ? "alerte" : "bon");
      return;
    }
    if (job.type === "reparation") {
      var rr = R(), t = rr.types[job.rep], px = retard ? Math.round(job.prix * (1 - rr.remiseRetard)) : job.prix;
      s.argent += px;
      s.mois.ca += px; s.mois.cogs += job.cout; s.mois.caReparations += px; s.mois.reparations++;
      s.stats.reparations++; s.stats.ca += px;
      changerReputation(s, retard ? rr.reputation.retard : rr.reputation.aLHeure);
      if (retard) noter(s, "Réparation (" + t.nom.toLowerCase() + ") rendue en retard : remise de " + Math.round(rr.remiseRetard * 100) + " %.", "alerte");
      if (rng(s) < m.erreurParNiveau[e.niveau - 1] * rr.erreurFacteur * (e.moral < 40 ? 1.3 : 1)) {
        var a = m.retourSavJours;
        s.atelier.retours.push({ id: job.id, rep: job.rep, piece: job.piece, quoi: "une réparation (" + t.nom.toLowerCase() + ")",
          jour: s.jour + a[0] + Math.floor(rng(s) * (a[1] - a[0] + 1)), technicien: e.nom });
      }
      return;
    }
    var prix = retard ? Math.round(job.prix * (1 - m.remiseRetard)) : job.prix;
    s.argent += prix;
    s.mois.ca += prix; s.mois.cogs += job.cout; s.mois.caMontage += prix; s.mois.montages++;
    s.stats.montages++; s.stats.ca += prix;
    changerReputation(s, retard ? m.reputation.retard : m.reputation.livraison);
    noter(s, "PC sur mesure livré par " + e.nom + " : +" + prix + " €" + (retard ? " (remise de " + Math.round(m.remiseRetard * 100) + " % pour le retard)." : "."), retard ? "alerte" : "bon");
    var risque = m.erreurParNiveau[e.niveau - 1] * (e.moral < 40 ? 1.3 : 1);
    if (rng(s) < risque) {
      var a = m.retourSavJours;
      s.atelier.retours.push({ id: job.id, choix: job.choix, usage: job.usage, profil: job.profil, quoi: "un PC monté",
        jour: s.jour + a[0] + Math.floor(rng(s) * (a[1] - a[0] + 1)), technicien: e.nom });
    }
  }
  function retoursEnSav(s) {
    var m = M(), d = D();
    s.atelier.retours = s.atelier.retours.filter(function (r) {
      if (r.jour > s.jour) return true;
      s.stats.retoursSav++;
      changerReputation(s, r.rep ? R().reputation.retourSav : m.reputation.retourSav);
      var listePannes = r.rep ? R().pannes : m.pannes;
      var panne = listePannes[Math.floor(rng(s) * listePannes.length)], piece = "";
      var pidPiece = r.choix ? r.choix[m.composants[Math.floor(rng(s) * m.composants.length)]] : r.piece;
      if (pidPiece && rng(s) < m.chancePiece) {
        var p = produit(pidPiece);
        s.argent -= p.cout; s.mois.sav += p.cout;
        piece = " Pièce à remplacer : " + p.nom + " (" + p.cout + " €).";
      }
      s.atelier.travaux.push({ id: "t" + (s.prochainId++), type: "sav", origine: r.rep ? "reparation" : "montage", rep: r.rep, profil: r.profil, usage: r.usage, choix: r.choix, panne: panne,
        prix: 0, cout: 0, restant: m.dureeSav, total: m.dureeSav, echeance: s.jour + 1, tech: null });
      noter(s, "Retour en SAV : " + (r.quoi || "un PC monté") + " par " + r.technicien + " " + panne + "." + piece, "alerte");
      return false;
    });
  }

  // ---------------------------------------------------------------- Publicité
  function PUB() { return D().publicite; }
  function effetBrut(s, type, budgetJour) {
    var t = PUB().types[type], f = PUB().facteurVille[ville(s).type] || 1;
    return t.effetMax * (1 - Math.exp(-budgetJour / (t.echelle * f)));
  }
  // Effet d'une campagne aujourd'hui (montée en charge, puis traîne après la fin)
  function effetCampagne(s, c) {
    var P = PUB(), age = s.jour - c.debut, f;
    if (age < 0) return 0;
    if (s.jour <= c.fin) f = Math.min(1, (age + 1) / P.montee);
    else f = Math.max(0, 1 - (s.jour - c.fin) / (P.traine + 1));
    return c.effet * f;
  }
  function effetPub(s) { return (s.pubs || []).reduce(function (a, c) { return a + effetCampagne(s, c); }, 0); }
  function effetPubAtelier(s) {
    return (s.pubs || []).reduce(function (a, c) { return a + effetCampagne(s, c) * PUB().types[c.type].atelier; }, 0);
  }
  // Clients de plus par jour qu'apporterait une campagne (estimation affichée au joueur)
  function estimationPub(s, type, budget, jours) {
    var d = D(), c = d.config, v = ville(s), tv = d.typesVilles[v.type];
    var concurrence = concurrenceVille(s, s.villeId);
    var base = tv.clientsParJour * (1 - concurrence) * (0.4 + 1.2 * s.reputation / 100);
    var e = effetBrut(s, type, budget / jours);
    return { effet: e, clientsJour: base * e, baseJour: base, budgetJour: budget / jours };
  }
  function lancerPub(s, type, cible, budget, jours) {
    var P = PUB(), t = P.types[type];
    if (!t) return { ok: false, raison: "Type de campagne inconnu." };
    budget = Math.round(+budget); jours = Math.round(+jours);
    if (P.durees.indexOf(jours) < 0) return { ok: false, raison: "Durée invalide." };
    if (!(budget >= t.budgetMin && budget <= t.budgetMax)) return { ok: false, raison: "Budget entre " + t.budgetMin + " et " + t.budgetMax + " €." };
    if (cible !== "tous" && !D().profilsClients[cible]) return { ok: false, raison: "Cible inconnue." };
    if (s.pubs.some(function (c) { return c.type === type && s.jour <= c.fin; })) return { ok: false, raison: "Une campagne de ce type est déjà en cours." };
    if (budget > s.argent) return { ok: false, raison: "Trésorerie insuffisante (" + budget + " € nécessaires)." };
    s.argent -= budget; s.mois.pub += budget;
    var c = { id: "p" + (s.prochainId++), type: type, cible: cible, budget: budget, jours: jours,
      debut: s.jour, fin: s.jour + jours - 1, effet: effetBrut(s, type, budget / jours), clients: 0, ventes: 0, ca: 0 };
    s.pubs.push(c);
    var nomCible = cible === "tous" ? "tous les publics" : D().profilsClients[cible].nom.toLowerCase();
    noter(s, "Campagne lancée : " + t.nom.toLowerCase() + " pour " + nomCible + ", " + jours + " jours, " + budget + " €.", "info");
    return { ok: true, campagne: c };
  }
  function trouverPub(s, id) {
    var l = (s.pubs || []).concat(s.pubsFinies || []);
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  // Fin de journée : on archive les campagnes dont l'effet est épuisé
  function archiverPubs(s) {
    s.pubs = s.pubs.filter(function (c) {
      if (s.jour + 1 <= c.fin + PUB().traine) return true;
      s.pubsFinies.unshift(c);
      if (s.pubsFinies.length > 8) s.pubsFinies.length = 8;
      noter(s, "Fin de la campagne " + PUB().types[c.type].nom.toLowerCase() + " : " + c.clients + " clients attirés, " + c.ventes + " ventes, " + Math.round(c.ca) + " € de chiffre d'affaires pour " + c.budget + " €.", c.ca * 0.15 > c.budget ? "bon" : "info");
      return false;
    });
  }

  // ---------------------------------------------------------------- Atelier : réparations
  function R() { return D().reparations; }
  function meilleurNiveauTech(s) {
    return s.employes.reduce(function (n, e) { return e.poste === "technicien" ? Math.max(n, e.niveau) : n; }, 0);
  }
  function fileAtelier(s) { return s.atelier.travaux.length; }
  function attraitTarif(ratio) { return ratio < 1 ? Math.min(1.3, 1 + (1 - ratio) * R().bonusPetitPrix) : 1; }
  function acceptationTarif(ratio) { return ratio <= 1 ? 1 : Math.exp(-R().sensibilitePrix * (ratio - 1)); }
  function tauxReparations(s) {
    var d = D(), c = d.config, v = ville(s), tv = d.typesVilles[v.type];
    var concurrence = concurrenceVille(s, s.villeId);
    var rep = 0.4 + 1.2 * s.reputation / 100;
    return tv.clientsParJour * (1 - concurrence) * rep * R().demandesParClient * c.temps.affluenceJour[s.jour % 7] * (1 + effetPubAtelier(s)) / (c.temps.fermeture - c.temps.ouverture);
  }
  // Un client entre avec un appareil à réparer
  function nouvelleReparation(s) {
    var r = R(), poids = {}, a = s.atelier;
    Object.keys(r.types).forEach(function (k) { poids[k] = r.types[k].part * attraitTarif(a.tarifs[k] / r.types[k].prixRef); });
    var type = tirerPoids(s, poids), t = r.types[type];
    if (!a.ouvert[type] || meilleurNiveauTech(s) < t.niveauMin) { s.mois.repRefusees++; return null; }
    if (fileAtelier(s) >= a.limiteFile) { s.mois.repRefusees++; changerReputation(s, r.reputation.refusPlein); return null; }
    var piece = null, prix = a.tarifs[type], cout = t.cout;
    if (type === "piece") {
      var g = rng(s) < 0.7 ? 0 : Math.min(1, gammesOuvertes(s) - 1);
      piece = tirerPoids(s, r.piecesRemplacees) + "_" + g;
      prix += prixVente(s, piece); cout += coutStock(s, piece);
    }
    if (rng(s) > acceptationTarif(a.tarifs[type] / t.prixRef)) { s.mois.repTropCher++; return null; }
    var job = { id: "t" + (s.prochainId++), type: "reparation", rep: type, piece: piece, pieceOk: !piece,
      prix: prix, cout: cout, restant: t.duree, total: t.duree, echeance: s.jour + t.delai, tech: null, depot: s.jour };
    a.travaux.push(job);
    return job;
  }
  // Le technicien peut-il prendre ce travail maintenant ?
  function travailPossible(s, job, e) {
    if (job.tech) return false;
    if (job.attente && job.attente.length) return false;   // PC sur mesure : pièces pas encore livrées
    if (job.type === "reparation") {
      if (e.niveau < R().types[job.rep].niveauMin) return false;
      if (job.piece && !job.pieceOk && !(s.stock[job.piece] > 0)) return false;
    }
    return true;
  }
  function garantiesDuJour(s) {
    var r = R(), g = r.garantie;
    s.atelier.garanties = s.atelier.garanties.filter(function (x) {
      if (x.jour > s.jour) return true;
      var p = produit(x.prodId);
      if (!aUnTechnicien(s)) { noter(s, "Un " + p.nom + " vendu revient sous garantie : sans technicien, il part chez le fabricant.", "info"); return false; }
      s.mois.garanties++;
      var panne = r.pannes[Math.floor(rng(s) * r.pannes.length)], txt = "";
      if (rng(s) < g.chancePiece) {
        var pc = produit(tirerPoids(s, r.piecesRemplacees) + "_" + Math.min(p.gamme, 1));
        s.argent -= pc.cout; s.mois.sav += pc.cout;
        txt = " Pièce à remplacer : " + pc.nom + " (" + pc.cout + " €).";
      }
      s.atelier.travaux.push({ id: "t" + (s.prochainId++), type: "sav", origine: "garantie", prodId: p.id, panne: panne,
        prix: 0, cout: 0, restant: M().dureeSav, total: M().dureeSav, echeance: s.jour + 2, tech: null });
      noter(s, "Garantie : un " + p.nom + " vendu chez toi " + panne + "." + txt, "alerte");
      return false;
    });
  }
  function fixerTarif(s, type, prix) {
    if (!R().types[type]) return;
    s.atelier.tarifs[type] = Math.max(1, Math.round(+prix || R().types[type].prixRef));
  }
  function ouvrirReparation(s, type, ouvert) { if (R().types[type]) s.atelier.ouvert[type] = !!ouvert; }
  function fixerLimiteFile(s, n) { s.atelier.limiteFile = Math.max(1, Math.round(+n) || R().limiteFileDefaut); }

  // ---------------------------------------------------------------- Événements (saisons et imprévus)
  function EV() { return D().evenements || { saisons: [], aleatoires: [], annonceJours: 7, chanceParMois: 0 }; }
  function moisCalendrier(jour) {
    var c = D().config.temps;
    return ((Math.floor(jour / c.joursParMois) + (c.moisDepart || 1) - 1) % 12) + 1;
  }
  function saisonsDuJour(jour) {
    if (jour < 0) return [];
    var jm = jour % D().config.temps.joursParMois + 1, mc = moisCalendrier(jour);
    return EV().saisons.filter(function (e) { return e.mois === mc && jm >= e.jours[0] && jm <= e.jours[1]; });
  }
  function commenceLe(e, jour) { return saisonsDuJour(jour).indexOf(e) >= 0 && saisonsDuJour(jour - 1).indexOf(e) < 0; }
  function finSaison(e, jour) { var j = jour; while (saisonsDuJour(j + 1).indexOf(e) >= 0) j++; return j; }
  function defAleatoire(x) {
    var def = EV().aleatoires.filter(function (e) { return e.id === x.id; })[0] || {};
    return Object.assign({}, def, x.extra || {}, { nom: x.nom || def.nom });
  }
  // Événements en cours : [{ def, debut, fin, saison }]
  function evenementsActifs(s, jour) {
    jour = jour == null ? s.jour : jour;
    var liste = saisonsDuJour(jour).map(function (e) { return { def: e, fin: finSaison(e, jour), saison: true }; });
    (s.evts || []).forEach(function (x) { if (x.debut <= jour && jour <= x.fin) liste.push({ def: defAleatoire(x), debut: x.debut, fin: x.fin }); });
    return liste;
  }
  // Événements à venir : saisons dans le mois qui vient, imprévus déjà annoncés
  function evenementsAVenir(s) {
    var r = [], vus = {};
    for (var j = s.jour + 1; j <= s.jour + D().config.temps.joursParMois; j++) {
      saisonsDuJour(j).forEach(function (e) { if (!vus[e.id] && commenceLe(e, j)) { vus[e.id] = true; r.push({ def: e, debut: j, fin: finSaison(e, j), saison: true }); } });
    }
    (s.evts || []).forEach(function (x) { if (x.debut > s.jour) r.push({ def: defAleatoire(x), debut: x.debut, fin: x.fin }); });
    return r.sort(function (a, b) { return a.debut - b.debut; });
  }
  var cacheModifs = { s: null, cle: "", m: null };
  // Effets cumulés des événements du jour
  function modifs(s) {
    var cle = s.jour + "|" + (s.evts || []).map(function (x) { return x.id + x.debut; }).join();
    if (cacheModifs.s === s && cacheModifs.cle === cle) return cacheModifs.m;
    var m = { affluence: 1, sensibilite: 1, profils: {}, envies: {}, prix: {}, remise: {}, delai: {} };
    var mult = function (cible, src) { Object.keys(src || {}).forEach(function (k) { cible[k] = (cible[k] || 1) * src[k]; }); };
    evenementsActifs(s).forEach(function (a) {
      var e = a.def;
      m.affluence *= e.affluence || 1; m.sensibilite *= e.sensibilite || 1;
      mult(m.profils, e.profils); mult(m.envies, e.envies); mult(m.prix, e.prix); mult(m.remise, e.remises);
      Object.keys(e.delai || {}).forEach(function (k) { m.delai[k] = Math.max(m.delai[k] || 0, e.delai[k]); });
    });
    cacheModifs = { s: s, cle: cle, m: m };
    return m;
  }
  function dateTexte(jour) {
    var c = D().config.temps;
    return (jour % c.joursParMois + 1) + " " + ((c.nomsMois || [])[moisCalendrier(jour) - 1] || "");
  }
  function creerImprevu(s) {
    var E = EV(), poids = {};
    E.aleatoires.forEach(function (e) { if (!e.reputationMin || reputationMax(s) >= e.reputationMin) poids[e.id] = e.poids; });
    if (!Object.keys(poids).length) return;
    var id = tirerPoids(s, poids), def = E.aleatoires.filter(function (e) { return e.id === id; })[0];
    var duree = Math.floor(entre(s, def.duree[0], def.duree[1] + 1));
    var x = { id: def.id, debut: s.jour + (def.annonce || 0), fin: 0, nom: def.nom, extra: {} };
    x.fin = x.debut + duree - 1;
    if (def.categorieAuHasard) {   // promo : une catégorie tirée au sort
      var cats = Object.keys(D().categories), cat = cats[Math.floor(rng(s) * cats.length)];
      x.extra.remises = {};
      D().typesProduits.forEach(function (t) { if (t.categorie === cat) x.extra.remises[t.id] = def.remise; });
      x.nom = def.nom + " : −" + Math.round((1 - def.remise) * 100) + " % sur les " + D().categories[cat].nom.toLowerCase();
    }
    s.evts.push(x);
    if (x.debut > s.jour) {
      noter(s, (def.annonceTexte || x.nom) + " (début le " + dateTexte(x.debut) + ")", "alerte");
      s.evenements.push({ type: "alerte", texte: "À venir le " + dateTexte(x.debut) + " : " + x.nom + "." });
    } else annoncerDebut(s, defAleatoire(x), x.fin);
  }
  function annoncerDebut(s, def, fin) {
    noter(s, def.nom + " jusqu'au " + dateTexte(fin) + " : " + def.texte, "info");
    s.evenements.push({ type: "evenement", nom: def.nom, texte: def.texte, fin: fin, def: def });
    if (def.reputation) changerReputation(s, def.reputation);
  }
  function evenementsDuJour(s) {
    var E = EV(), c = D().config.temps;
    s.evts = s.evts || [];
    E.saisons.forEach(function (e) {
      if (commenceLe(e, s.jour + E.annonceJours)) noter(s, "Dans une semaine (" + dateTexte(s.jour + E.annonceJours) + ") : " + e.nom + ". " + e.texte, "info");
      if (commenceLe(e, s.jour)) annoncerDebut(s, e, finSaison(e, s.jour));
      if (saisonsDuJour(s.jour - 1).indexOf(e) >= 0 && saisonsDuJour(s.jour).indexOf(e) < 0) noter(s, "Fin de l'événement : " + e.nom + ".", "info");
    });
    s.evts = s.evts.filter(function (x) {
      if (x.fin < s.jour) { noter(s, "Fin de l'événement : " + x.nom + ".", "info"); return false; }
      return true;
    });
    s.evts.forEach(function (x) { if (x.debut === s.jour) annoncerDebut(s, defAleatoire(x), x.fin); });
    if (!s.evts.length && s.jour >= c.joursParMois && rng(s) < E.chanceParMois / c.joursParMois) creerImprevu(s);
  }

  // ---------------------------------------------------------------- Une minute de jeu
  function tauxArrivee(s) {
    var d = D(), c = d.config, v = ville(s), tv = d.typesVilles[v.type];
    var concurrence = concurrenceVille(s, s.villeId);
    var rep = 0.4 + 1.2 * s.reputation / 100;
    var minutesOuvertes = c.temps.fermeture - c.temps.ouverture;
    // pointe en milieu de journée et en fin d'après-midi
    var h = s.minuteJour / 60, pointe = 0.75 + 0.35 * Math.exp(-Math.pow(h - 12.5, 2) / 2) + 0.45 * Math.exp(-Math.pow(h - 17.5, 2) / 2);
    // s.affluenceDemo : seulement pour la boutique de démonstration de l'accueil (accueil-vivant.js)
    return tv.clientsParJour * (local(s).affluence || 1) * modifs(s).affluence * (1 - concurrence) * rep * c.temps.affluenceJour[s.jour % 7] * pointe * (1 + effetPub(s)) * (1 + ambiance(s).affluence) * (s.affluenceDemo || 1) / minutesOuvertes;
  }

  function minute(s) {
    var c = D().config, t = maintenant(s);

    // 1. Arrivées (aucune pendant un déménagement)
    if (!ferme(s) && rng(s) < tauxArrivee(s)) {
      if (s.clients.length >= local(s).capaciteClients) s.mois.horsCapacite++;
      else { s.clients.push(nouveauClient(s)); s.mois.clients++; s.stats.clients++; }
    }
    if (!ferme(s) && s.atelier.demandes.length < M().maxDemandes && rng(s) < tauxDemandes(s)) nouvelleDemande(s);
    if (!ferme(s) && aUnTechnicien(s) && rng(s) < tauxReparations(s)) nouvelleReparation(s);

    // 2. Tâches terminées
    s.employes.forEach(function (e) {
      if (e.tache) e.occupe++;
      if (e.tache && e.tache.type === "montage") {
        var job = trouverTravail(s, e.tache.jobId);
        if (!job) { e.tache = null; return; }
        job.restant -= vitesse(e);
        if (job.restant <= 0) { e.tache = null; job.tech = null; gagnerXp(s, e, Math.max(1, Math.round(job.total / 75))); terminerTravail(s, job, e); }
        return;
      }
      if (!e.tache || e.tache.fin > t) return;
      var cl = trouverClient(s, e.tache.clientId), type = e.tache.type;
      e.tache = null;
      gagnerXp(s, e);
      if (!cl) return;
      if (type === "conseil") decider(s, cl, e);
      else if (type === "caisse") encaisser(s, cl);
    });

    // 3. Clients
    s.clients.slice().forEach(function (cl) {
      if (cl.etat === "parcourt" && t >= cl.finParcours) {
        if (besoinConseil(cl)) { cl.etat = "attend_conseil"; cl.depuis = t; }
        else decider(s, cl, null);
      } else if ((cl.etat === "attend_conseil" || cl.etat === "file") && t - cl.depuis > cl.patience) {
        s.mois.perdusAttente++;
        changerReputation(s, c.reputation.departAttente);
        partir(s, cl, "attente");
      }
    });

    // 4. Affectation du personnel (une tâche à la fois)
    var libres = s.employes.filter(function (e) { return !e.tache; });
    function lancer(e, cl, type) {
      var duree = type === "conseil" ? c.durees.conseil : c.durees.caisse;
      e.tache = { type: type, clientId: cl.id, debut: t, fin: t + Math.max(1, Math.round(duree / vitesse(e))) };
      cl.etat = type; cl.employe = e.id;
      if (type === "caisse") s.file.splice(s.file.indexOf(cl.id), 1);
      libres.splice(libres.indexOf(e), 1);
    }
    // caissiers -> file
    libres.filter(function (e) { return e.poste === "caissier"; }).forEach(function (e) {
      if (s.file.length) lancer(e, trouverClient(s, s.file[0]), "caisse");
    });
    // vendeurs -> conseil, sinon caisse s'il n'y a aucun caissier libre
    var enAttente = s.clients.filter(function (cl) { return cl.etat === "attend_conseil"; })
      .sort(function (a, b) { return a.depuis - b.depuis; });
    libres.filter(function (e) { return e.poste === "vendeur"; }).forEach(function (e) {
      var fileLongue = s.file.length >= 3;
      if (enAttente.length && !fileLongue) lancer(e, enAttente.shift(), "conseil");
      else if (s.file.length) lancer(e, trouverClient(s, s.file[0]), "caisse");
      else if (enAttente.length) lancer(e, enAttente.shift(), "conseil");
    });
    // techniciens -> SAV d'abord, puis montages par échéance
    libres.filter(function (e) { return e.poste === "technicien"; }).forEach(function (e) {
      var job = s.atelier.travaux.filter(function (j) { return travailPossible(s, j, e); }).sort(function (a, b) {
        return (a.type === "sav" ? 0 : 1) - (b.type === "sav" ? 0 : 1) || a.echeance - b.echeance;
      })[0];
      if (!job) return;
      if (job.piece && !job.pieceOk) { s.stock[job.piece]--; job.pieceOk = true; }
      job.tech = e.id;
      e.tache = { type: "montage", jobId: job.id, debut: t };
    });
  }

  // ---------------------------------------------------------------- Journée, semaine, mois
  function finJourneeMagasin(s) {
    var c = D().config;
    // Les clients encore présents à la fermeture repartent sans pénalité.
    s.clients.slice().forEach(function (cl) { partir(s, cl, "fermeture"); });
    s.file = [];
    s.employes.forEach(function (e) {
      libererTache(s, e);
      var charge = e.occupe / (c.temps.fermeture - c.temps.ouverture);
      var cible = 70 + (e.salaire / salaireAttendu(e.poste, e.niveau) - 1) * 150 - Math.max(0, charge - 0.7) * 120;
      e.moral = borne(e.moral + (borne(cible, 0, 100) - e.moral) * 0.15, 0, 100);
      e.charge = charge; e.occupe = 0;
      s.salairesDus += e.salaire / c.temps.joursParMois;
    });
    archiverPubs(s);
    if ((s.jour + 1) % c.temps.joursParMois === 0) finMoisMagasin(s);
  }
  function finJourneeEnseigne(s) {
    verifierObjectifs(s);
    verifierPalier(s);
    // en fin de mois, le bilan passe avant l'annonce d'une nouvelle gamme
    if ((s.jour + 1) % D().config.temps.joursParMois === 0) finMoisEnseigne(s);
    else { verifierDeblocages(s); alerteSalaires(s); }
  }
  // Prévient (une fois par mois) quand la trésorerie ne couvre plus les salaires prélevés en fin de mois
  function alerteSalaires(s) {
    var jPM = D().config.temps.joursParMois, num = numeroMois(s);
    if (s.alerteSalaires === num) return;
    var restants = jPM - 1 - (s.jour % jPM), aVenir = 0;
    s.magasins.forEach(function (x, i) {
      var mg = magasin(s, i);
      aVenir += mg.salairesDus;
      mg.employes.forEach(function (e) { aVenir += e.salaire * restants / jPM; });
    });
    aVenir = Math.round(aVenir);
    if (s.argent >= aVenir) return;
    s.alerteSalaires = num;
    var risque = D().config.difficultes[s.difficulte].faillite === "pret" ? "la banque devra te prêter" : "c'est la faillite";
    noter(s, "Attention : " + aVenir + " € de salaires seront prélevés en fin de mois, ta trésorerie (" + Math.round(s.argent) + " €) ne suffit pas. Sous zéro en fin de mois, " + risque + " : ralentis les commandes.", "alerte");
  }

  function debutJourneeEnseigne(s) {
    evenementsDuJour(s);
    logistiqueDuJour(s);
    if (s.jour % D().config.temps.joursParMois === 0 && s.jour > 0) {
      rembourserPret(s);
      var X = D().config.expansion, extra = (s.magasins ? s.magasins.length : 1) - 1;
      var fs = Math.round(extra * ((X.fraisSiege || 0) + (X.fraisSiegeHausse || 0) * Math.max(0, extra - 1)) * (D().config.difficultes[s.difficulte].siege || 1));
      s.siegeMois = fs;
      if (fs) { s.argent -= fs; noter(s, "Frais de siège du mois (" + (extra + 1) + " magasins) : " + fs + " €.", "info"); }
    }
  }
  function debutJourneeMagasin(s) {
    var c = D().config;
    // Livraisons
    s.commandes = s.commandes.filter(function (cmd) {
      if (cmd.arrivee > s.jour) return true;
      var job = cmd.pourJob && trouverTravail(s, cmd.pourJob);
      if (job && job.attente) {
        var ia = job.attente.indexOf(cmd.prodId);
        if (ia >= 0) job.attente.splice(ia, 1);
        if (cmd.retard) { job.echeance += cmd.retard; noter(s, "Le fournisseur a livré avec un jour de retard : le client du PC sur mesure est prévenu, livraison repoussée au jour " + (job.echeance + 1) + ".", "info"); }
        noter(s, "Pièce reçue pour un PC sur mesure : " + produit(cmd.prodId).nom + (job.attente.length ? "." : " · toutes les pièces sont là, le montage peut commencer."), "bon");
        return false;
      }
      var avant = Math.max(0, s.stock[cmd.prodId] || 0);
      s.coutMoyen = s.coutMoyen || {};
      s.coutMoyen[cmd.prodId] = Math.round((avant * coutStock(s, cmd.prodId) + cmd.cout) / (avant + cmd.qte));
      s.stock[cmd.prodId] = avant + cmd.qte;
      noter(s, "Livraison reçue : " + cmd.qte + " × " + produit(cmd.prodId).nom + ".", "bon");
      return false;
    });
    // Atelier : demandes sans réponse, retours en SAV
    s.atelier.demandes = s.atelier.demandes.filter(function (dm) {
      if (dm.expire >= s.jour) return true;
      changerReputation(s, M().reputation.sansReponse);
      noter(s, "Sans réponse, un client est allé faire monter son PC ailleurs (budget " + dm.budget + " €).", "alerte");
      return false;
    });
    retoursEnSav(s);
    garantiesDuJour(s);
    var attentePiece = {};
    s.atelier.travaux.forEach(function (j) { if (j.piece && !j.pieceOk && !(s.stock[j.piece] > 0)) attentePiece[j.piece] = (attentePiece[j.piece] || 0) + 1; });
    Object.keys(attentePiece).forEach(function (pid) {
      if (!s.commandes.some(function (c) { return c.prodId === pid; })) noter(s, "Réparation bloquée : il manque " + produit(pid).nom + " en stock.", "alerte");
    });
    var enRetard = s.atelier.travaux.filter(function (j) { return j.echeance < s.jour; }).length;
    if (enRetard) noter(s, enRetard + (enRetard > 1 ? " travaux d'atelier sont" : " travail d'atelier est") + " en retard.", "alerte");
    // Ruptures en rayon
    var vides = s.rayons.filter(function (pid) { return pid && !(s.stock[pid] > 0) && !s.commandes.some(function (c) { return c.prodId === pid && !c.pourJob; }); });
    if (vides.length) noter(s, "Rayon vide : " + vides.map(function (p) { return produit(p).nom; }).join(", ") + ".", "alerte");
    // Chaque lundi : candidats et départs éventuels
    if (s.jour % 7 === 0 && s.jour > 0) {
      renouvelerCandidats(s);
      noter(s, "Nouveaux candidats disponibles au bureau.", "info");
      s.employes.slice().forEach(function (e) {
        var p = e.moral < 35 ? (35 - e.moral) / 50 : 0;
        if (e.salaire < salaireAttendu(e.poste, e.niveau) * 0.9) p += 0.1;
        if (p > 0 && rng(s) < p) {
          s.employes.splice(s.employes.indexOf(e), 1);
          noter(s, e.nom + " a démissionné (moral " + Math.round(e.moral) + ").", "alerte");
        }
      });
    }
    // Réouverture après un déménagement
    if (s.fermeJusqu != null && s.jour === s.fermeJusqu + 1) {
      s.fermeJusqu = null;
      noter(s, "Déménagement terminé : ton " + local(s).nom.toLowerCase() + " ouvre ses portes !", "bon");
      s.evenements.push({ type: "bon", texte: "Ton " + local(s).nom.toLowerCase() + " ouvre ses portes !" });
    }
    // Début de mois : loyer et charges (hausse annuelle tous les 12 mois)
    if (s.jour % c.temps.joursParMois === 0 && s.jour > 0) {
      if (s.jour % (c.temps.joursParMois * 12) === 0) {
        var avant = loyerLocal(s);
        s.indexLoyer = (s.indexLoyer || 1) * (1 + (c.hausseLoyerAnnuelle || 0));
        noter(s, "Révision annuelle du bail : le loyer passe de " + avant + " € à " + loyerLocal(s) + " € par mois.", "alerte");
        s.evenements.push({ type: "alerte", texte: "Le loyer augmente : " + loyerLocal(s) + " € par mois." });
      }
      s.mois = nouveauMois();
      payerLoyerEtCharges(s);
      noter(s, "Loyer et charges du mois payés : " + (s.mois.loyer + s.mois.charges) + " €.", "info");
    }
    pilotageAuto(s);
  }

  function numeroMois(s) { return Math.floor(s.jour / D().config.temps.joursParMois) + 1; }
  // Fin de mois d'un magasin : salaires et bilan du magasin
  function finMoisMagasin(s) {
    var salaires = Math.round(s.salairesDus);
    s.argent -= salaires; s.mois.salaires += salaires; s.salairesDus = 0;
    var m = s.mois;
    m.resultat = resultatMois(m);
    m.reputation = Math.round(s.reputation);
    m.numero = numeroMois(s);
    m.villeId = s.villeId;
    s.bilans.push(m);
  }
  // Fin de mois de l'enseigne : bilan d'ensemble, mois positifs, prêt ou faillite
  function finMoisEnseigne(s) {
    var c = D().config, diff = c.difficultes[s.difficulte], num = numeroMois(s), details = [];
    s.magasins.forEach(function (x, i) {
      var mg = magasin(s, i), b = mg.bilans[mg.bilans.length - 1];
      if (b && b.numero === num) { b.tresorerie = Math.round(s.argent); details.push({ villeId: mg.villeId, nom: villeParId(mg.villeId).nom, bilan: b }); }
    });
    var total = { numero: num, ca: 0, cogs: 0, salaires: 0, loyer: 0, charges: 0, sav: 0, pub: 0, resultat: 0, ventes: 0, clients: 0, perdusAttente: 0 };
    details.forEach(function (d) { Object.keys(total).forEach(function (k) { if (k !== "numero") total[k] += d.bilan[k] || 0; }); });
    total.logistique = s.logistiqueMois || 0;
    total.siege = s.siegeMois || 0;
    total.resultat -= total.logistique + total.siege;
    total.tresorerie = Math.round(s.argent);
    total.reputation = Math.round(reputationMax(s));
    s.bilansEnseigne = s.bilansEnseigne || [];
    s.bilansEnseigne.push(total);
    if (total.resultat >= 0) { s.objectifsFaits.moisPositif = true; s.stats.moisPositifs = (s.stats.moisPositifs || 0) + 1; }
    noter(s, "Bilan du mois " + num + (details.length > 1 ? " (enseigne, " + details.length + " magasins)" : "") + " : résultat " + (total.resultat >= 0 ? "+" : "") + Math.round(total.resultat) + " €.", total.resultat >= 0 ? "bon" : "alerte");
    s.evenements.push({ type: "bilan", bilan: details.length === 1 && !total.logistique && !total.siege ? details[0].bilan : total, details: details, total: total });
    verifierPalier3(s);
    verifierDeblocages(s);
    rivauxDuMois(s);

    if (s.argent < 0) {
      if (diff.faillite === "pret" && (s.dette || 0) < (c.pret.detteMax || Infinity)) {
        var montant = Math.max(c.pret.montant, Math.ceil(-s.argent / 1000) * 1000 + 2000);
        s.argent += montant; s.dette += montant;
        noter(s, "Trésorerie négative : la banque t'accorde un prêt de " + montant + " €, remboursé " + c.pret.mensualite + " € par mois.", "alerte");
        s.evenements.push({ type: "pret", montant: montant });
      } else {
        s.fin = { raison: "faillite", jour: s.jour, mois: num };
        noter(s, "Faillite : la trésorerie est passée sous zéro à la fin du mois " + num + ".", "alerte");
        s.evenements.push({ type: "faillite" });
      }
    }
  }

  function verifierObjectifs(s) {
    var o = s.objectifsFaits;
    if (s.rayons.some(Boolean)) o.rayon = true;
    if (s.commandes.length || Object.keys(s.stock).length) o.commande = true;
    if (s.employes.some(function (e) { return e.poste === "vendeur"; })) o.vendeur = true;
    if (s.employes.some(function (e) { return e.poste === "caissier"; })) o.caissier = true;
    if (aUnTechnicien(s)) o.technicien = true;
    if (s.stats.montages >= 1) o.montage1 = true;
    if ((s.stats.reparations || 0) >= 10) o.reparation10 = true;
    if ((s.pubs && s.pubs.length) || (s.pubsFinies && s.pubsFinies.length)) o.pub1 = true;
    if (s.stats.ventes >= 10) o.ventes10 = true;
    if (s.stats.ventes >= 100) o.ventes100 = true;
    if (s.reputation >= 60) o.rep60 = true;
    if (s.argent >= 50000) o.tresor50k = true;
    if (s.magasins && s.magasins.length >= 2) o.magasin2 = true;
    if ((s.palier || 1) >= 2) o.palier2 = true;
    if ((s.palier || 1) >= 3) o.palier3 = true;
    if ((s.palier || 1) >= 4) o.palier4 = true;
    if (s.entrepots && Object.keys(s.entrepots).length) o.entrepot1 = true;
    if (gammesOuvertes(s) >= 2) o.milieu = true;
    if (gammesOuvertes(s) >= 3) o.haut = true;
  }
  function objectifsActifs(s, n) {
    verifierObjectifs(s);
    return D().config.objectifs.filter(function (x) { return !s.objectifsFaits[x.id]; }).slice(0, n || 3);
  }

  // Avance la partie de n minutes de jeu (les nuits passent d'un coup).
  function avancer(s, n) {
    var c = D().config.temps;
    s.sorties = s.sorties || [];
    migrer(s);
    for (var i = 0; i < n && !s.fin; i++) {
      if (s.minuteJour >= c.fermeture) {
        pourChaque(s, finJourneeMagasin);
        finJourneeEnseigne(s);
        if (s.fin) break;
        s.jour++; s.minuteJour = c.ouverture;
        debutJourneeEnseigne(s);
        pourChaque(s, debutJourneeMagasin);
      } else { pourChaque(s, minute); s.minuteJour++; }
    }
  }
  // Avance jusqu'à la fin de la journée en cours (utile pour les tests).
  function avancerJours(s, jours) {
    var c = D().config.temps, cible = s.jour + jours;
    while (s.jour < cible && !s.fin) avancer(s, (c.fermeture - s.minuteJour) + 1);
  }

  function valeurStock(s) {
    var v = 0;
    for (var id in s.stock) v += Math.max(0, s.stock[id] || 0) * coutStock(s, id);
    return v;
  }
  function vider(s) { var e = s.evenements; s.evenements = []; var so = s.sorties || []; s.sorties = []; return { evenements: e, sorties: so }; }

  TMI.Sim = {
    nouvellePartie: nouvellePartie, avancer: avancer, avancerJours: avancerJours,
    commander: commander, placerRayon: placerRayon, fixerMarge: fixerMarge, fixerPrix: fixerPrix,
    embaucher: embaucher, licencier: licencier,
    plan: plan, deco: deco, ambiance: ambiance, placeDeco: placeDeco, empriseDeco: empriseDeco, acheterDeco: acheterDeco,
    deplacerDeco: deplacerDeco, vendreDeco: vendreDeco, choisirRevetement: choisirRevetement,
    catalogue: catalogue, produit: produit, prixVente: prixVente, ville: ville, local: local,
    loyerLocal: loyerLocal, ferme: ferme, coutAchat: coutAchat, coutMarche: coutMarche, prixMarche: prixMarche, coutStock: coutStock,
    evenementsActifs: evenementsActifs, evenementsAVenir: evenementsAVenir, modifs: modifs, dateTexte: dateTexte, localSuivant: localSuivant, coutDemenagement: coutDemenagement, demenager: demenager,
    infosDate: infosDate, salaireAttendu: salaireAttendu, vitesse: vitesse,
    objectifsActifs: objectifsActifs, resultatMois: resultatMois, migrer: migrer,
    evaluerMontage: evaluerMontage, proposerMontage: proposerMontage, refuserDemande: refuserDemande, minGamme: minGamme,
    aUnTechnicien: aUnTechnicien, trouverTravail: trouverTravail, tauxDemandes: tauxDemandes,
    fixerTarif: fixerTarif, ouvrirReparation: ouvrirReparation, fixerLimiteFile: fixerLimiteFile, meilleurNiveauTech: meilleurNiveauTech,
    acceptationTarif: acceptationTarif, tauxReparations: tauxReparations,
    lancerPub: lancerPub, estimationPub: estimationPub, effetPub: effetPub, effetCampagne: effetCampagne,
    aUnResponsable: aUnResponsable, reglagesPilotage: reglagesPilotage, reglerPilotage: reglerPilotage, compoAuto: compoAuto,
    magasin: magasin, vueMagasin: vueMagasin, changerMagasin: changerMagasin, conditionsOuverture: conditionsOuverture, ouvrirMagasin: ouvrirMagasin,
    magasinsParRegion: magasinsParRegion, caAnnuel: caAnnuel, reputationMoyenne: reputationMoyenne, regionsAvecMagasin: regionsAvecMagasin, regionDe: regionDe,
    construireEntrepot: construireEntrepot, acheterVehicule: acheterVehicule, vendreVehicule: vendreVehicule,
    commanderEntrepot: commanderEntrepot, transferer: transferer, prixGros: prixGros, capaciteDispo: capaciteDispo,
    unitesEntrepot: unitesEntrepot, coutEntrepot: coutEntrepot, initLog: initLog, reputationMax: reputationMax, villeParId: villeParId,
    synchroniser: function (s) { migrer(s); ranger(s); },
    rivauxVille: rivauxVille, soldesVille: soldesVille, concurrenceVille: concurrenceVille, chaine: chaine, marche: marche,
    prixRachat: prixRachat, conditionsRachat: conditionsRachat, racheterRival: racheterRival, initRivaux: initRivaux,
    gammesOuvertes: gammesOuvertes, disponible: disponible, conditionGamme: conditionGamme, valeurStock: valeurStock, vider: vider, tauxArrivee: tauxArrivee
  };
})(typeof window !== "undefined" ? window : globalThis);
