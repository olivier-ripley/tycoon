// Tutoriel : une bulle qui montre le bon bouton, étape par étape, puis des astuces ponctuelles.
// Chaque étape a une cible (sélecteur ou fonction qui renvoie un élément), un texte, et soit une condition
// à remplir pour passer à la suite, soit un bouton « Compris ». La progression est rangée dans la sauvegarde (etat.tuto).
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};

  function $(sel) { return document.querySelector(sel); }
  function visible(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  // Bouton « Embaucher » d'un candidat au poste demandé
  function boutonEmbauche(poste) {
    return function () {
      var cartes = document.querySelectorAll("#contenu-panneau .carte");
      for (var i = 0; i < cartes.length; i++) {
        var b = cartes[i].querySelector('[data-act="embaucher"]');
        if (b && cartes[i].textContent.indexOf(poste) >= 0) return b;
      }
      return null;
    };
  }
  function aPoste(c, poste) { return c.etat.employes.some(function (e) { return e.poste === poste; }); }

  // c = { etat, ui, modeVue, onglet, vitesse }
  var ETAPES = [
    { id: "carte", cible: ".marqueur-boutique.actif", texte: "Voici ta boutique sur la carte de France. <b>Touche-la</b> pour entrer.",
      fait: function (c) { return c.modeVue === "magasin"; } },
    { id: "bureau", cible: '#pieces [data-piece="bureau"]', texte: "Ta boutique a trois pièces. Commence par le <b>bureau</b> : c'est là qu'on embauche.",
      fait: function (c) { return c.ui.piece === "bureau"; } },
    { id: "personnel", cible: '#onglets [data-onglet="personnel"]', texte: "Ouvre l'onglet <b>Personnel</b> pour voir les candidats de la semaine.",
      fait: function (c) { return c.onglet === "personnel"; } },
    { id: "vendeur", cible: boutonEmbauche("Vendeur"), texte: "Embauche un <b>vendeur</b> : il conseille les clients qui cherchent un ordinateur ou un composant.",
      fait: function (c) { return aPoste(c, "vendeur"); } },
    { id: "caissier", cible: boutonEmbauche("Caissier"), texte: "Puis un <b>caissier</b> : tout le monde passe en caisse.",
      fait: function (c) { return aPoste(c, "caissier"); } },
    { id: "reserve", cible: '#pieces [data-piece="reserve"]', texte: "Direction la <b>réserve</b> pour commander du stock.",
      fait: function (c) { return c.ui.piece === "reserve"; } },
    { id: "commandes", cible: '#onglets [data-onglet="commandes"]', texte: "L'onglet <b>Commandes</b> liste ce que propose ton fournisseur.",
      fait: function (c) { return c.onglet === "commandes"; } },
    { id: "commander", cible: '#contenu-panneau [data-act="commander"]:not([disabled])',
      texte: "Commande <b>trois produits différents</b> (le bouton affiche le prix pour la quantité choisie). Ils arrivent dans 2 jours et prennent place en rayon tout seuls.",
      fait: function (c) { var ids = {}; c.etat.commandes.forEach(function (x) { ids[x.prodId] = 1; }); return Object.keys(ids).length >= 3 || Object.keys(c.etat.stock).length >= 3; },
      progres: function (c) { var ids = {}; c.etat.commandes.forEach(function (x) { ids[x.prodId] = 1; }); return Math.min(3, Object.keys(ids).length) + " / 3"; } },
    { id: "magasin", cible: '#pieces [data-piece="magasin"]', texte: "Va voir le <b>magasin</b> : tes produits y sont déjà placés.",
      fait: function (c) { return c.ui.piece === "magasin"; } },
    { id: "rayons", cible: "#magasin:not(.cache), #magasin3d:not(.cache)", texte: "Chaque meuble est un rayon. Touche un emplacement libre (le <b>+</b>) pour y mettre un autre produit, et règle tes prix dans l'onglet <b>Prix</b>.",
      bouton: "Compris" },
    { id: "temps", cible: '.vitesses [data-vitesse="1"]', texte: "Tout est prêt : <b>lance le temps</b>. Les clients vont arriver. Tu peux accélérer avec ×2 et ×3, ou mettre en pause avec la barre d'espace.",
      fait: function (c) { return c.vitesse > 0; } },
    { id: "afaire", cible: "#b-afaire", texte: "Le bouton <b>À faire</b> te dit ce qui demande ton attention : rayon vide, équipe incomplète, demande à l'atelier… « Y aller » t'y emmène.",
      bouton: "Compris" },
    { id: "bilan", cible: '#pieces [data-piece="bureau"]', texte: "Le loyer tombe au début du mois, les salaires à la fin. Suis ton résultat sur l'ordinateur du <b>bureau</b>. Bonne chance !",
      bouton: "Terminer le tuto" }
  ];

  // Astuces ponctuelles, une seule fois chacune, quand la situation se présente
  var ASTUCES = [
    { id: "demande", quand: function (c) { return c.etat.atelier.demandes.length > 0 && c.modeVue === "magasin"; },
      cible: '#pieces [data-piece="magasin"]', texte: "Un client demande un <b>PC sur mesure</b> ! Embauche un technicien au bureau, puis réponds dans l'onglet <b>Atelier</b> du magasin." },
    { id: "rupture", quand: function (c) { return c.modeVue === "magasin" && c.etat.rayons.some(function (p) { return p && !(c.etat.stock[p] > 0) && !c.etat.commandes.some(function (x) { return x.prodId === p; }); }); },
      cible: "#b-afaire", texte: "Un rayon est <b>vide</b> : les clients repartent sans acheter. Recommande depuis la réserve (le bouton À faire t'y emmène)." },
    { id: "expansion", quand: function (c) { return c.etat.magasins.length === 1 && (c.etat.stats.moisPositifs || 0) >= root.TMI_DATA.config.expansion.moisPositifs && TMI.Sim.reputationMax(c.etat) >= root.TMI_DATA.config.expansion.reputation; },
      cible: function () { return visible($("#b-vue")) ? $("#b-vue") : $(".marqueur-boutique.actif"); }, texte: "Ton enseigne peut ouvrir un <b>deuxième magasin</b> ! Sur la carte, touche une ville pour voir le coût d'ouverture." },
    { id: "local", quand: function (c) { return c.etat.mois.horsCapacite >= 10 && c.etat.local !== "grand"; },
      cible: '#pieces [data-piece="bureau"]', texte: "Des clients sont refoulés : ton local est <b>plein</b>. Au bureau, l'onglet <b>Local</b> permet de déménager dans plus grand." }
  ];

  function Tuto(contexte, options) {
    this.contexte = contexte; this.options = options || {};
    this.bulle = document.createElement("div");
    this.bulle.className = "tuto-bulle"; this.bulle.hidden = true;
    this.bulle.setAttribute("role", "dialog"); this.bulle.setAttribute("aria-live", "polite");
    document.body.appendChild(this.bulle);
    this.cible = null; this.cle = "";
    var self = this;
    this.bulle.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-tuto]"); if (!b) return;
      var c = self.contexte(); if (!c || !c.etat) return;
      var t = self.etat(c);
      if (b.dataset.tuto === "passer") { t.fini = true; self.cacher(); }
      if (b.dataset.tuto === "suivant") { if (t.astuce) { t.vues[t.astuce] = true; t.astuce = null; } else t.etape++; }
      if (b.dataset.tuto === "astuces-off") { t.sansAstuces = true; t.astuce = null; }
      self.cle = ""; self.maj();
    });
  }
  var T = Tuto.prototype;
  T.etat = function (c) {
    if (!c.etat.tuto) c.etat.tuto = { etape: 0, fini: true, vues: {} };   // anciennes parties : pas de tuto imposé
    if (!c.etat.tuto.vues) c.etat.tuto.vues = {};
    return c.etat.tuto;
  };
  T.demarrer = function (etat) { etat.tuto = { etape: 0, fini: false, vues: {} }; this.cle = ""; };
  T.cacher = function () {
    this.bulle.hidden = true;
    if (this.cible) { this.cible.classList.remove("tuto-cible"); this.cible = null; }
  };
  T.trouver = function (cible) { var el = typeof cible === "function" ? cible() : $(cible); return visible(el) ? el : null; };
  // Appelé régulièrement par la boucle du jeu
  T.maj = function () {
    var c = this.contexte();
    if (!c || !c.etat || !$("#modal").hidden || $("#ecran-jeu").hidden) { this.cacher(); return; }
    var t = this.etat(c), etape = null, astuce = null;
    if (!t.fini) {
      while (t.etape < ETAPES.length && ETAPES[t.etape].fait && ETAPES[t.etape].fait(c)) t.etape++;   // étapes déjà faites
      if (t.etape >= ETAPES.length) { t.fini = true; }
      else etape = ETAPES[t.etape];
    }
    if (!etape && !t.sansAstuces) {
      if (t.astuce) astuce = ASTUCES.filter(function (a) { return a.id === t.astuce; })[0];
      else ASTUCES.some(function (a) { if (!t.vues[a.id] && a.quand(c)) { astuce = a; t.astuce = a.id; return true; } return false; });
    }
    var item = etape || astuce;
    if (!item) { this.cacher(); return; }
    var el = this.trouver(item.cible);
    if (this.cible !== el) {
      if (this.cible) this.cible.classList.remove("tuto-cible");
      this.cible = el;
      if (el) el.classList.add("tuto-cible");
    }
    var cle = (etape ? "e" + t.etape : "a" + astuce.id) + (etape && etape.progres ? etape.progres(c) : "");
    // on fait défiler jusqu'à la cible une seule fois par étape (sinon la liste sauterait pendant qu'on clique)
    var cleEtape = etape ? "e" + t.etape : "a" + astuce.id;
    if (el && this.defile !== cleEtape) {
      this.defile = cleEtape;
      if (el.scrollIntoView && el.closest("#contenu-panneau, #fiche")) el.scrollIntoView({ block: "nearest" });
    }
    if (cle !== this.cle) {
      this.cle = cle;
      var h = '<div class="tuto-tete">' + (etape ? "Tuto · étape " + (t.etape + 1) + " / " + ETAPES.length : "Astuce") +
        (etape && etape.progres ? ' <span class="tuto-progres">' + etape.progres(c) + "</span>" : "") + "</div>";
      h += '<p>' + item.texte + "</p>";
      h += '<div class="tuto-boutons">' +
        (etape ? '<button class="lien" data-tuto="passer">Passer le tuto</button>' : '<button class="lien" data-tuto="astuces-off">Plus d\'astuces</button>') +
        (etape && etape.bouton ? '<button class="bouton petit principal" data-tuto="suivant">' + etape.bouton + "</button>" : "") +
        (astuce ? '<button class="bouton petit principal" data-tuto="suivant">OK</button>' : "") + "</div>";
      this.bulle.innerHTML = h;
    }
    this.bulle.hidden = false;
    this.placer(el);
  };
  // Place la bulle sous la cible (ou au-dessus s'il n'y a pas la place), sans sortir de l'écran
  T.placer = function (el) {
    var b = this.bulle, W = root.innerWidth, H = root.innerHeight, bw = Math.min(320, W - 24);
    b.style.width = bw + "px";
    var bh = b.offsetHeight || 120;
    if (!el) { b.style.left = (W - bw) / 2 + "px"; b.style.top = (H - bh - 24) + "px"; b.dataset.fleche = "aucune"; return; }
    var r = el.getBoundingClientRect(), x = r.left + r.width / 2 - bw / 2, y, fleche;
    var pan = el.closest(".contenu-panneau");
    if (pan) {
      // cible dans une liste : la bulle se met à côté du panneau (PC) ou au-dessus (téléphone), sans cacher la liste
      var rp = pan.getBoundingClientRect();
      if (W > 900) { x = rp.left - bw - 16; y = r.top + r.height / 2 - bh / 2; fleche = "droite"; }
      else { x = (W - bw) / 2; y = rp.top - bh - 10; fleche = "aucune"; }
      x = Math.max(12, Math.min(W - bw - 12, x)); y = Math.max(8, Math.min(H - bh - 8, y));
      b.style.left = x.toFixed(0) + "px"; b.style.top = y.toFixed(0) + "px"; b.dataset.fleche = fleche;
      b.style.setProperty("--fleche-y", Math.max(16, Math.min(bh - 16, r.top + r.height / 2 - y)).toFixed(0) + "px");
      return;
    }
    if (r.height > H * 0.5) { y = r.top + 16; fleche = "aucune"; }                       // grande cible (vue du magasin)
    else if (r.bottom + bh + 18 < H) { y = r.bottom + 12; fleche = "haut"; }
    else { y = r.top - bh - 12; fleche = "bas"; }
    x = Math.max(12, Math.min(W - bw - 12, x));
    y = Math.max(8, Math.min(H - bh - 8, y));
    b.style.left = x.toFixed(0) + "px"; b.style.top = y.toFixed(0) + "px";
    b.dataset.fleche = fleche;
    b.style.setProperty("--fleche-x", Math.max(16, Math.min(bw - 16, r.left + r.width / 2 - x)).toFixed(0) + "px");
  };

  TMI.Tuto = Tuto;
  TMI.Tuto.ETAPES = ETAPES;
})(window);
