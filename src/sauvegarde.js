// Sauvegarde locale (navigateur) : 3 emplacements, export / import de fichier.
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};
  var INVITE = "tmi_sauvegarde_";
  var NB = 3;
  // Connecté : les emplacements du compte sont gardés à part (copie locale de la sauvegarde en ligne)
  function prefixe(espace) {
    if (espace === "invite") return INVITE;
    var u = TMI.Compte && TMI.Compte.utilisateur();
    return espace || (u ? "tmi_compte_" + u.id + "_" : INVITE);
  }

  function lire(n, espace) {
    try {
      var brut = root.localStorage.getItem(prefixe(espace) + n);
      return brut ? JSON.parse(brut) : null;
    } catch (e) { return null; }
  }
  function copie(etat) { return Object.assign({}, etat, { evenements: [], sorties: [] }); }
  function ecrire(n, etat, date, espace) {
    try {
      root.localStorage.setItem(prefixe(espace) + n, JSON.stringify({ date: date || Date.now(), etat: copie(etat) }));
      return true;
    } catch (e) { return false; }
  }
  function supprimer(n, espace) { try { root.localStorage.removeItem(prefixe(espace) + n); } catch (e) {} }
  function liste(espace) {
    var r = [];
    for (var i = 1; i <= NB; i++) r.push({ emplacement: i, contenu: lire(i, espace) });
    return r;
  }
  function exporter(etat, nomFichier) {
    var blob = new Blob([JSON.stringify({ format: "tycoon-magasin-informatique", version: 1, etat: etat }, null, 1)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nomFichier || "sauvegarde-tycoon.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function importer(fichier, rappel) {
    var lecteur = new FileReader();
    lecteur.onload = function () {
      try {
        var d = JSON.parse(lecteur.result);
        if (!d || !d.etat || d.format !== "tycoon-magasin-informatique") throw new Error("format");
        rappel(null, d.etat);
      } catch (e) { rappel("Ce fichier n'est pas une sauvegarde valide."); }
    };
    lecteur.readAsText(fichier);
  }

  TMI.Sauvegarde = { copie: copie, lire: lire, ecrire: ecrire, supprimer: supprimer, liste: liste, exporter: exporter, importer: importer, NB: NB };
})(window);
