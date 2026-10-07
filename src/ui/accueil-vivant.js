// Scène vivante de l'écran d'accueil : une boutique de démonstration qui tourne toute seule
// (vraie simulation, vraie vue 2D) à côté de la liste des sauvegardes. Elle ne touche à aucune partie du joueur.
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};

  var VILLE = "lyon", GRAINE = 2026, VITESSE = 1.4, AFFLUENCE = 7;   // beaucoup plus de passage que dans une vraie partie
  var RAYONS = ["portable_bureau_1", "pc_fixe_1", "portable_gaming_1", "carte_graphique_1", "ssd_0", "ecran_1", "clavier_souris_1", "casque_1"];

  function partieDemo() {
    var Sim = TMI.Sim, s = Sim.nouvellePartie({ villeId: VILLE, difficulte: "facile", graine: GRAINE });
    s.gammes = 3; s.reputation = 80; s.affluenceDemo = AFFLUENCE;
    var parId = Sim.catalogue().parId;
    RAYONS.filter(function (id) { return parId[id]; }).slice(0, s.rayons.length).forEach(function (id, i) { Sim.placerRayon(s, i, id); });
    recruter(s); entretenir(s);
    Sim.avancer(s, 90);   // la boutique est déjà ouverte depuis un moment : il y a du monde
    Sim.vider(s);
    return s;
  }
  // Toujours trois vendeurs, deux caissiers et un technicien quand il y a des candidats
  function recruter(s) {
    var voulu = { vendeur: 3, caissier: 2, technicien: 1 };
    Object.keys(voulu).forEach(function (poste) {
      while (s.employes.filter(function (e) { return e.poste === poste; }).length < voulu[poste]) {
        var c = s.candidats.filter(function (c) { return c.poste === poste; })[0];
        if (c) { TMI.Sim.embaucher(s, c.id); continue; }
        // plus de candidat pour ce poste : on copie un collègue (ou n'importe quel employé) sous un autre identifiant
        var modele = s.employes.filter(function (e) { return e.poste === poste; })[0] || s.employes[0];
        if (!modele) return;
        s.employes.push(Object.assign(JSON.parse(JSON.stringify(modele)), { id: "demo" + (s.prochainId++), poste: poste, tache: null }));
      }
    });
  }
  // Rayons toujours pleins, trésorerie sans fond, pas de fenêtres d'événements
  function entretenir(s) {
    s.rayons.forEach(function (id) { if (id && (s.stock[id] || 0) < 12) s.stock[id] = 40; });
    s.argent = 1e7; s.dette = 0;
    s.journal.length = 0;
  }

  function SceneAccueil(conteneur) {
    var ns = "http://www.w3.org/2000/svg";
    this.ecran = conteneur.closest(".ecran") || conteneur;
    this.svg = document.createElementNS(ns, "svg");
    this.svg.setAttribute("class", "scene-accueil-svg");
    this.svg.setAttribute("aria-hidden", "true");
    conteneur.appendChild(this.svg);
    this.vue = new TMI.VueMagasin(this.svg, {});
    this.s = partieDemo();
    this.reste = 0; this.dernier = 0; this.derniereVue = 0;
    this.vue.maj(this.s);
    var self = this;
    requestAnimationFrame(function boucle(ts) { self.tick(ts); requestAnimationFrame(boucle); });
  }
  SceneAccueil.prototype.tick = function (ts) {
    var dt = this.dernier ? Math.min(0.25, (ts - this.dernier) / 1000) : 0;
    this.dernier = ts;
    if (this.ecran.hidden || document.hidden) return;   // en jeu ou onglet caché : la démo attend
    var s = this.s;
    this.reste += dt * VITESSE * root.TMI_DATA.config.temps.minutesParSecondeX1;
    var n = Math.floor(this.reste);
    if (n > 0) {
      this.reste -= n;
      TMI.Sim.avancer(s, n);
      TMI.Sim.vider(s);
      recruter(s); entretenir(s);
      if (s.fin) { this.s = partieDemo(); this.vue.vider(); }
    }
    if (ts - this.derniereVue > 90) { this.vue.maj(this.s); this.derniereVue = ts; }
  };

  TMI.SceneAccueil = SceneAccueil;
  var reduit = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function demarrer() {
    var c = document.getElementById("scene-accueil");
    if (!c || reduit || !TMI.Sim || !TMI.VueMagasin) return;
    try { TMI.sceneAccueil = new SceneAccueil(c); } catch (e) { c.hidden = true; if (root.console) console.warn("Scène d'accueil indisponible :", e); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer); else demarrer();
})(window);
