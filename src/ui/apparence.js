// Apparence des personnages, commune à la vue 2D (vue-magasin.js) et à la vue 3D (vue-3d.js) :
// silhouette, peau, coiffure, tenue et accessoires tirés au hasard à partir de l'identifiant,
// donc toujours les mêmes pour une même personne, quelle que soit la vue.
// Les profils de clients se reconnaissent à leurs accessoires : étudiants = sac à dos, joueurs = casque audio
// ou sweat à capuche, pros = veste et mallette, familles = sac de courses (et parfois un enfant).
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};

  var PEAUX = ["#f7dcc6", "#f0c8a4", "#e2aa84", "#d39a6e", "#c48461", "#a86d4a", "#8f5b3c", "#6e4430", "#5a3624"];
  var CHEVEUX = ["#1b1b1b", "#2a2a2a", "#4a2e1d", "#5b3824", "#7a4a26", "#a8743f", "#d8b26a", "#e6cf9a", "#7a2f1d", "#b5b5b5", "#e8e8e8"];
  var GRIS = ["#b5b5b5", "#e8e8e8", "#8d8d8d"];
  var HAUTS = ["#e8504a", "#f08a24", "#f2c230", "#3fae6a", "#2bb3b1", "#3b82f6", "#6c5ce7", "#d6458f", "#ffffff", "#2c2f36", "#8a6a4a", "#9aa4b1", "#f4a6b8", "#a6d36b"];
  var BAS = ["#34405a", "#2c3e66", "#3d3d3d", "#5a6b8a", "#6b4f3a", "#c9b38a", "#1f2328", "#7a3b3b"];
  var CHAUSSURES = ["#1f2328", "#ffffff", "#6b4f3a", "#d6334a", "#2457ff"];
  var SACS = ["#ffffff", "#f2c230", "#2457ff"];
  var UNIFORMES = { vendeur: "#2457ff", caissier: "#12a150", technicien: "#ff7a1a", responsable: "#3b2a6b", magasinier: "#5b6578", gerant: "#1f2a44" };
  var COIFFURES = ["court", "court", "long", "queue", "chignon", "boucles", "rase", "casquette", "bonnet", "afro"];
  var COIFFURES_ENFANT = ["court", "queue", "boucles", "court"];

  function hache(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h); }
  function tireur(id) {   // tirage pseudo-aléatoire stable (mulberry32) à partir de l'identifiant
    var a = (hache(String(id)) * 2654435761) >>> 0;
    return function (n) {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      var u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return n == null ? u : Math.floor(u * n);
    };
  }
  function choix(r, liste) { return liste[r(liste.length)]; }

  // desc = { id, profil } pour un client, { id, poste } pour un employé, { id, poste: "magasinier" | "gerant" } pour le décor,
  // { id, enfant: true } pour l'enfant d'une famille
  TMI.apparence = function (desc) {
    var r = tireur(desc.id), poste = desc.poste, profil = desc.profil, enfant = !!desc.enfant;
    var a = { poste: poste, profil: profil, enfant: enfant };
    a.peau = choix(r, PEAUX); a.cheveux = choix(r, CHEVEUX);
    if (!enfant && r(10) < 2) a.cheveux = choix(r, GRIS);          // quelques têtes grises
    a.haut = poste ? UNIFORMES[poste] : choix(r, HAUTS);
    a.bas = poste ? (poste === "gerant" || poste === "responsable" ? "#2a2f3a" : "#2a3142") : choix(r, BAS);
    a.jupe = !poste && !enfant && r(5) === 0 ? (r(8) === 0 ? "#c9b38a" : choix(r, HAUTS)) : null;
    a.taille = enfant ? 0.62 : 0.92 + r() * 0.16;
    a.carrure = 0.9 + r() * 0.22;
    a.chaussures = choix(r, CHAUSSURES);
    a.capuche = !poste && (profil === "joueurs" ? r(2) === 0 : r(7) === 0);
    a.veste = poste === "responsable" || poste === "gerant" || (!poste && profil === "professionnels" && r(3) > 0);
    a.cravate = !a.veste ? null : poste ? "#d6334a" : r(2) === 0 ? choix(r, HAUTS) : null;
    a.badge = !!poste && poste !== "gerant" && poste !== "responsable";   // badge et logo de l'enseigne
    a.manchesLongues = !!(poste || a.veste || a.capuche || r(2) === 0);
    var style = choix(r, enfant ? COIFFURES_ENFANT : COIFFURES);
    if (poste && (style === "casquette" || style === "bonnet")) style = "court";
    if (poste === "magasinier") style = "casquette";
    a.coiffure = style;
    a.couvreChef = style === "casquette" || style === "bonnet" ? (poste === "magasinier" ? "#ff9f1a" : choix(r, HAUTS)) : null;
    a.barbe = !enfant && !poste && style !== "long" && r(6) === 0;
    a.lunettes = !enfant && r(4) === 0 ? (r(3) === 0 ? "#1f2328" : "#7a5a3a") : null;
    a.sacADos = profil === "etudiants" ? choix(r, HAUTS) : null;
    a.casque = profil === "joueurs" && (!a.capuche || r(2) === 0);
    a.mallette = profil === "professionnels" && r(2) === 0;
    a.sacCourses = profil === "familles" ? choix(r, SACS) : null;
    a.avecEnfant = profil === "familles" && !enfant && r(2) === 0;
    return a;
  };
})(window);
