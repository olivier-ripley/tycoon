// Écrans de gestion (panneau latéral sur PC, bas d'écran sur mobile).
// Chaque fonction renvoie du HTML ; les clics sont gérés par délégation dans main.js (attributs data-act).
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};

  function euros(n) { return Math.round(n).toLocaleString("fr-FR") + " €"; }
  function signe(n) { return (n >= 0 ? "+" : "−") + Math.abs(Math.round(n)).toLocaleString("fr-FR") + " €"; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pct(x) { return Math.round(x * 100) + " %"; }
  function D() { return root.TMI_DATA; }
  function jauge(v, max) {
    var r = Math.max(0, Math.min(1, v / max));
    return '<span class="mini-jauge ' + (r < 0.35 ? "bas" : r < 0.6 ? "moyen" : "") + '"><span style="width:' + Math.round(r * 100) + '%"></span></span>';
  }

  // Petite icône par type de produit (portable, tour, carte graphique, écran…), teintée selon la catégorie
  var ICONES = {
    portable_bureau: '<rect x="4" y="5" width="16" height="10" rx="1.5"/><path d="M2 19h20"/>',
    portable_gaming: '<rect x="4" y="5" width="16" height="10" rx="1.5"/><path d="M2 19h20M12.8 7l-2.2 3.4h3l-2.2 3.4"/>',
    pc_fixe: '<rect x="7" y="2.5" width="10" height="19" rx="1.5"/><path d="M10 6.5h4M10 9.5h4"/><circle cx="12" cy="16.5" r="1.4"/>',
    carte_graphique: '<rect x="2" y="6" width="20" height="11" rx="1.5"/><circle cx="8" cy="11.5" r="2.8"/><circle cx="16" cy="11.5" r="2.8"/><path d="M5 17v3h6v-3"/>',
    processeur: '<rect x="7" y="7" width="10" height="10" rx="1"/><rect x="10" y="10" width="4" height="4"/><path d="M9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>',
    ram: '<rect x="2" y="7" width="20" height="9" rx="1"/><path d="M6 10v3M10 10v3M14 10v3M18 10v3M4 16v3M20 16v3M12 16v3"/>',
    ssd: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9.5h7M7 13h4"/><circle cx="16.5" cy="14.5" r="1.2"/>',
    ecran: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/>',
    clavier_souris: '<rect x="1.5" y="9" width="14" height="9" rx="1.5"/><path d="M4.5 12h1M7.5 12h1M10.5 12h1M5 15h6"/><rect x="17.5" y="8.5" width="5" height="8" rx="2.5"/><path d="M20 8.5v3"/>',
    casque: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5"/>'
  };
  var CAT_ICONE = { ordinateurs: "ico-ordi", composants: "ico-compo", peripheriques: "ico-peri" };
  function icone(p, typeId) {
    var t = typeId || (p && p.typeId), cat = p ? p.categorie : (D().typesProduits.filter(function (x) { return x.id === t; })[0] || {}).categorie;
    if (!ICONES[t]) return "";
    return '<span class="ico-produit ' + (CAT_ICONE[cat] || "") + '" title="' + esc(p ? p.typeNom : t) + '" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONES[t] + "</svg></span>";
  }
  function enCommande(s, pid) {
    return s.commandes.filter(function (c) { return c.prodId === pid && !c.pourJob; }).reduce(function (a, c) { return a + c.qte; }, 0);
  }
  function optionsProduits(s, choisi) {
    var Sim = TMI.Sim, html = '<option value="">— Emplacement libre —</option>';
    Object.keys(D().categories).forEach(function (cat) {
      html += '<optgroup label="' + esc(D().categories[cat].nom) + '">';
      Sim.catalogue().liste.filter(function (p) { return p.categorie === cat; }).forEach(function (p) {
        var place = s.rayons.indexOf(p.id) >= 0 && p.id !== choisi;
        var bloque = !Sim.disponible(s, p) && !(s.stock[p.id] > 0) && p.id !== choisi;
        if (bloque) return;   // les produits pas encore débloqués restent cachés
        html += '<option value="' + p.id + '"' + (p.id === choisi ? " selected" : "") + ">" +
          esc(p.nom + " · " + (s.stock[p.id] || 0) + " en stock" + (place ? " — déjà en rayon" : "")) + "</option>";
      });
      html += "</optgroup>";
    });
    return html;
  }

  // ------------------------------------------------------------ Rayons
  function rayons(s, ui) {
    var Sim = TMI.Sim, h = "";
    h += '<p class="aide">Ton ' + esc(Sim.local(s).nom.toLowerCase()) + ' a ' + s.rayons.length + ' emplacements. Seuls les produits en rayon peuvent être vendus. Les clients qui cherchent un ordinateur ou un composant attendent un vendeur ; les périphériques se vendent seuls. Le stock et les commandes se gèrent dans la réserve.</p>';
    h += '<div class="grille-rayons">';
    s.rayons.forEach(function (pid, i) {
      var p = pid && Sim.produit(pid), n = pid ? (s.stock[pid] || 0) : 0, att = pid ? enCommande(s, pid) : 0;
      var etat = !pid ? "" : n === 0 ? (att ? '<span class="etat alerte">Rupture · ' + att + ' en route</span>' : '<span class="etat danger">Rupture</span>')
        : n <= 2 ? '<span class="etat alerte">Stock bas</span>' : '<span class="etat bon">En rayon</span>';
      h += '<div class="case-rayon' + (ui.rayonChoisi === i ? " surbrillance" : "") + '" id="case-rayon-' + i + '">';
      h += '<span class="num-rayon">Emplacement ' + (i + 1) + "</span>";
      h += '<select data-act="placer" data-i="' + i + '" aria-label="Produit de l\'emplacement ' + (i + 1) + '">' + optionsProduits(s, pid) + "</select>";
      if (p) h += '<span class="detail">' + icone(p) + esc(p.nom) + " · " + euros(Sim.prixVente(s, p)) + " · " + n + " en stock</span>" + etat;
      if (p) h += '<button class="bouton petit" data-act="aller-stock" data-id="' + p.id + '">Commander</button>';
      h += "</div>";
    });
    return h + "</div>";
  }

  // ------------------------------------------------------------ Réserve : inventaire
  function stock(s, ui) {
    var Sim = TMI.Sim, h = "", total = 0;
    h += '<p class="aide">Ce qui attend dans la réserve. Valeur du stock : <b>' + euros(Sim.valeurStock(s)) + "</b>. Un produit ne se vend que s'il est aussi en rayon dans le magasin.</p>";
    Object.keys(D().categories).forEach(function (cat) {
      var produits = Sim.catalogue().liste.filter(function (p) {
        return p.categorie === cat && ((s.stock[p.id] || 0) > 0 || enCommande(s, p.id) > 0 || s.rayons.indexOf(p.id) >= 0);
      });
      var unites = produits.reduce(function (a, p) { return a + (s.stock[p.id] || 0); }, 0);
      total += unites;
      h += '<h3 id="inv-' + cat + '" class="' + (ui.categorieVisee === cat ? "surbrillance-titre" : "") + '">' + esc(D().categories[cat].nom) + ' <span class="discret">· ' + unites + " unité" + (unites > 1 ? "s" : "") + "</span></h3>";
      if (!produits.length) { h += '<p class="aide">Étagère vide.</p>'; return; }
      h += '<div class="liste">';
      produits.forEach(function (p) {
        var n = s.stock[p.id] || 0, att = enCommande(s, p.id), enRayon = s.rayons.indexOf(p.id) >= 0;
        var etat = enRayon ? (n === 0 ? '<span class="etat danger">rupture en rayon</span>' : '<span class="etat bon">en rayon</span>') : '<span class="etat alerte">pas en rayon</span>';
        h += '<div class="ligne"><div><div class="titre">' + icone(p) + esc(p.nom) + " " + etat + "</div>" +
          '<div class="detail">' + esc(p.typeNom) + " · " + TMI.Libelles.gamme[p.gamme] + " · " + euros(Sim.coutStock(s, p.id) * n) + " immobilisés</div>" +
          '<div class="detail">Stock <b>' + n + "</b>" + (att ? " · " + att + " en route" : "") + "</div></div>" +
          '<div class="droite">' + (Sim.disponible(s, p) ? '<button class="bouton petit" data-act="aller-stock" data-id="' + p.id + '">Commander</button>' : "") + "</div></div>";
      });
      h += "</div>";
    });
    if (!total && !s.commandes.length) h += '<p class="aide">La réserve est vide. Passe une première commande au poste de commande (onglet Commandes).</p>';
    return h;
  }

  // ------------------------------------------------------------ Réserve : commandes au fournisseur
  function commandes(s, ui) {
    var Sim = TMI.Sim, f = D().fournisseurs[0], h = "";
    h += '<p class="aide">Fournisseur : <b>' + esc(f.nom) + "</b> · livraison en " + f.delaiJours + " jours · paiement à la commande.</p>";
    if (s.commandes.length) {
      h += '<h3>Livraisons en route</h3><div class="liste">';
      s.commandes.forEach(function (c) {
        var p = Sim.produit(c.prodId);
        h += '<div class="ligne"><div><div class="titre">' + icone(p) + c.qte + " × " + esc(p.nom) + '</div><div class="detail">' + esc(p.typeNom) + " · " + euros(c.cout) + (c.pourJob ? " · pour un PC sur mesure" : "") + "</div></div>" +
          '<div class="droite"><span class="etat">' + (c.arrivee - s.jour <= 0 ? "demain matin" : "jour " + (c.arrivee + 1)) + "</span></div></div>";
      });
      h += "</div>";
    }
    h += '<div class="puces">';
    [["tout", "Tout"], ["ordinateurs", "Ordinateurs"], ["composants", "Composants"], ["peripheriques", "Périphériques"], ["rayon", "En rayon"]].forEach(function (c) {
      h += '<button class="puce' + (ui.filtreStock === c[0] ? " actif" : "") + '" data-act="filtre" data-f="' + c[0] + '">' + c[1] + "</button>";
    });
    h += '</div><div class="liste">';
    var filtres = Sim.catalogue().liste.filter(function (p) {
      if (ui.filtreStock === "tout") return true;
      if (ui.filtreStock === "rayon") return s.rayons.indexOf(p.id) >= 0;
      return p.categorie === ui.filtreStock;
    });
    var verrouilles = filtres.filter(function (p) { return !Sim.disponible(s, p) && !(s.stock[p.id] > 0); });
    filtres.filter(function (p) { return verrouilles.indexOf(p) < 0; }).forEach(function (p) {
      var n = s.stock[p.id] || 0, att = enCommande(s, p.id), enRayon = s.rayons.indexOf(p.id) >= 0;
      var qte = ui.quantites[p.id] || 5, ca = Sim.coutAchat(s, p), entrepotIci = s.entrepots && s.magasins ? s.entrepots[Sim.regionDe(s, s.actif)] : null, mo = Sim.modifs(s), ecart = ca / p.cout - 1, retard = mo.delai[p.typeId] || 0;
      var badgeMarche = Math.abs(ecart) < 0.01 ? "" : ecart > 0 ? ' <span class="etat danger">pénurie +' + Math.round(ecart * 100) + " %</span>" : ' <span class="etat bon">promo ' + Math.round(ecart * 100) + " %</span>";
      if (retard) badgeMarche += ' <span class="etat alerte">+' + retard + " j de livraison</span>";
      h += '<div class="ligne' + (ui.produitVise === p.id ? " surbrillance" : "") + '" id="ligne-' + p.id + '"><div>' +
        '<div class="titre">' + icone(p) + esc(p.nom) + (enRayon ? ' <span class="etat bon">en rayon</span>' : "") + badgeMarche + "</div>" +
        '<div class="detail">' + esc(p.typeNom) + " · " + TMI.Libelles.gamme[p.gamme] + " de gamme · achat " + euros(ca) + " · vente " + euros(Sim.prixVente(s, p)) + "</div>" +
        '<div class="detail">Stock <b>' + n + "</b>" + (att ? " · " + att + " en route" : "") + "</div></div>" +
        '<div class="droite"><input type="number" min="1" max="99" value="' + qte + '" data-act="qte" data-id="' + p.id + '" aria-label="Quantité">' +
        (entrepotIci && (entrepotIci.stock[p.id] || 0) > 0 ? '<button class="bouton petit" data-act="faire-venir" data-id="' + p.id + '" title="Depuis l\'entrepôt ' + esc(D().regions[entrepotIci.region]) + ' (' + entrepotIci.stock[p.id] + ' en stock, livré demain)">Entrepôt · ' + entrepotIci.stock[p.id] + "</button>" : "") +
        (Sim.disponible(s, p) ? '<button class="bouton petit principal" data-act="commander" data-id="' + p.id + '"' + (ca * qte > s.argent ? " disabled" : "") + ">" + euros(ca * qte) + "</button>" : '<span class="etat">plus commandable</span>') + "</div></div>";
    });
    h += "</div>";
    return h;
  }

  // ------------------------------------------------------------ Prix
  function prix(s, ui) {
    var Sim = TMI.Sim, c = D().config, h = "";
    h += '<p class="aide">Le prix de vente se calcule depuis le coût d\'achat : prix = coût ÷ (1 − marge). Plus la marge est haute, plus chaque vente rapporte, mais plus les clients sensibles au prix (étudiants, familles) renoncent.</p>';
    Object.keys(D().categories).forEach(function (cat) {
      var m = s.marges[cat], ref = c.margesParDefaut[cat];
      h += '<div class="marge"><div class="entete"><span>' + esc(D().categories[cat].nom) + '</span><span class="num">' + pct(m) + "</span></div>" +
        '<input type="range" min="' + Math.round(c.margeMin * 100) + '" max="' + Math.round(c.margeMax * 100) + '" value="' + Math.round(m * 100) + '" data-act="marge" data-cat="' + cat + '" aria-label="Marge ' + esc(D().categories[cat].nom) + '">' +
        '<span class="aide">Marge habituelle du secteur : ' + pct(ref) + (Math.abs(m - ref) > 0.005 ? ' · <button class="lien" data-act="marge-defaut" data-cat="' + cat + '">revenir à ' + pct(ref) + "</button>" : "") + "</span></div>";
    });
    h += '<h3>Prix produit par produit</h3><p class="aide">Laisse vide pour suivre la marge de la catégorie.</p><div class="liste">';
    Sim.catalogue().liste.filter(function (p) { return s.rayons.indexOf(p.id) >= 0 || s.prixFixes[p.id] != null; }).forEach(function (p) {
      var pv = Sim.prixVente(s, p), ecart = pv / Sim.prixMarche(s, p) - 1;
      var badge = Math.abs(ecart) < 0.03 ? '<span class="etat">prix du marché</span>' : ecart > 0 ? '<span class="etat alerte">+' + pct(ecart) + " vs marché</span>" : '<span class="etat bon">' + pct(ecart).replace("-", "−") + " vs marché</span>";
      h += '<div class="ligne"><div><div class="titre">' + icone(p) + esc(p.nom) + '</div><div class="detail">Coût ' + euros(Sim.coutMarche(s, p)) + " · marché " + euros(Sim.prixMarche(s, p)) + " · actuel <b>" + euros(pv) + "</b></div>" + badge + "</div>" +
        '<div class="droite"><input type="number" min="1" placeholder="auto" value="' + (s.prixFixes[p.id] != null ? s.prixFixes[p.id] : "") + '" data-act="prix" data-id="' + p.id + '" aria-label="Prix fixe"></div></div>';
    });
    h += "</div>";
    if (!s.rayons.some(Boolean)) h += '<p class="aide">Place des produits en rayon pour régler leur prix ici.</p>';
    return h;
  }

  // ------------------------------------------------------------ Personnel
  function personnel(s, ui) {
    var Sim = TMI.Sim, c = D().config, h = "";
    var masse = s.employes.reduce(function (a, e) { return a + e.salaire; }, 0);
    h += '<p class="aide">Un employé ne fait qu\'une tâche à la fois. Le vendeur conseille les clients ; s\'il n\'y a pas de caissier libre, il passe en caisse. Le technicien monte les PC sur mesure à l\'atelier. Salaires payés en fin de mois : <b>' + euros(masse) + "</b> par mois.</p>";
    if (Sim.aUnResponsable(s)) {
      var P = Sim.reglagesPilotage(s), resp = s.employes.filter(function (e) { return e.poste === "responsable"; })[0];
      var case_ = function (cle, txt, aide) { return '<label class="interrupteur"><input type="checkbox" data-act="pilote" data-cle="' + cle + '"' + (P[cle] ? " checked" : "") + "> <span><b>" + txt + '</b> <span class="aide">' + aide + "</span></span></label>"; };
      h += '<div class="carte pilotage"><div class="entete"><div><div class="titre"><b>Pilotage automatique</b></div><span class="aide">' + esc(resp.nom) + " gère ce magasin chaque matin. Ses actions sont résumées dans le journal.</span></div></div>" +
        case_("reassort", "Réassort", "remplit les rayons vides et recommande (l'entrepôt de la région d'abord)") +
        '<label class="interrupteur cible">Stock visé par produit <input type="number" min="1" max="40" value="' + P.cible + '" data-act="pilote-cible" aria-label="Stock visé"></label>' +
        case_("embauches", "Embauches", "remplace le vendeur ou le caissier qui manque") +
        case_("atelier", "Atelier", "répond aux demandes de PC sur mesure au prix conseillé (plafonné au budget)") +
        '<span class="aide">Il ne commande pas si la trésorerie de l\'enseigne passe sous ' + euros(c.pilotage.reserve) + ".</span></div>";
    } else if (s.magasins && s.magasins.length > 1) {
      h += '<p class="aide">Astuce : embauche un <b>responsable</b> pour que ce magasin tourne sans toi (réassort, embauches, atelier).</p>';
    }
    h += "<h3>Équipe</h3>";
    if (!s.employes.length) h += '<p class="aide">Personne pour l\'instant : sans vendeur ni caissier, aucun client ne peut payer.</p>';
    s.employes.forEach(function (e) {
      var attendu = Sim.salaireAttendu(e.poste, e.niveau), seuils = c.seuilsXp;
      var prochain = seuils[e.niveau] != null ? seuils[e.niveau] : null;
      var tache = e.poste === "responsable" ? "pilote le magasin" : e.tache ? ({ conseil: "conseille un client", caisse: "encaisse", montage: "à l'atelier" }[e.tache.type] || "occupé") : "disponible";
      h += '<div class="carte"><div class="entete"><div><div class="titre"><b>' + esc(e.nom) + '</b></div><span class="aide">' + c.postes[e.poste].nom + " · niveau " + e.niveau + "</span></div>" +
        '<span class="etat' + (e.tache ? " alerte" : " bon") + '">' + tache + "</span></div>" +
        '<div class="stats"><span>Salaire <b>' + euros(e.salaire) + "</b></span><span>Attendu " + euros(attendu) + "</span>" +
        "<span>Moral " + jauge(e.moral, 100) + " <b>" + Math.round(e.moral) + "</b></span>" +
        "<span>Charge hier <b>" + pct(e.charge || 0) + "</b></span>" +
        "<span>Expérience <b>" + e.xp + (prochain ? " / " + prochain : " (max)") + "</b></span>" +
        "<span>Vitesse <b>×" + Sim.vitesse(e).toFixed(2) + "</b></span></div>" +
        '<div><button class="bouton petit danger" data-act="licencier" data-id="' + e.id + '">Licencier</button></div></div>';
    });
    h += "<h3>Candidats de la semaine</h3><p class=\"aide\">De nouveaux profils arrivent chaque lundi.</p>";
    if (!s.candidats.length) h += '<p class="aide">Plus de candidat cette semaine.</p>';
    s.candidats.forEach(function (e) {
      h += '<div class="carte"><div class="entete"><div><b>' + esc(e.nom) + '</b><br><span class="aide">' + c.postes[e.poste].nom + " · niveau " + e.niveau + "</span></div>" +
        '<button class="bouton petit principal" data-act="embaucher" data-id="' + e.id + '">Embaucher</button></div>' +
        '<div class="stats"><span>Salaire demandé <b>' + euros(e.salaire) + "</b></span><span>Vitesse <b>×" + Sim.vitesse(e).toFixed(2) + "</b></span></div></div>";
    });
    return h;
  }

  // ------------------------------------------------------------ Atelier (PC sur mesure)
  function nomType(id) { return D().typesProduits.filter(function (t) { return t.id === id; })[0].nom; }
  var COMP_COURT = { processeur: "Processeur", carte_graphique: "Carte graphique", ram: "Mémoire vive", ssd: "SSD" };
  function exigencesTexte(s, dem) {
    var M = D().montage;
    return M.composants.map(function (comp) {
      var mg = TMI.Sim.minGamme(s, dem, comp);
      return "<span>" + COMP_COURT[comp] + " : <b>" + (mg == null ? "peu importe" : esc(TMI.Sim.produit(comp + "_" + mg).nom) + (mg < TMI.Sim.gammesOuvertes(s) - 1 ? " ou mieux" : "")) + "</b></span>";
    }).join("");
  }
  // Pré-remplit la composition : la pièce qui répond juste au besoin, prise en stock si possible
  // (une gamme au-dessus en stock convient aussi), sinon elle sera commandée à l'accord du client.
  function compoInitiale(s, dem) {
    var choix = {}, Sim = TMI.Sim, go = Sim.gammesOuvertes(s);
    D().montage.composants.forEach(function (comp) {
      var mg = Sim.minGamme(s, dem, comp) || 0, trouve = null;
      for (var g = mg; g < go && !trouve; g++) if ((s.stock[comp + "_" + g] || 0) > 0) trouve = comp + "_" + g;
      choix[comp] = trouve || comp + "_" + mg;
    });
    return choix;
  }
  function resumeCompo(s, ui) {
    var Sim = TMI.Sim, c = ui.compo, dem = c && s.atelier.demandes.filter(function (x) { return x.id === c.demId; })[0];
    if (!dem) return "";
    var ev = Sim.evaluerMontage(s, dem, c.choix, c.prix);
    if (!ev.complet) return '<p class="aide">Choisis les quatre composants.</p>';
    var verdicts = {
      probable: ["bon", "Dans son budget : il devrait accepter."],
      hesite: ["alerte", "Au-dessus de son budget de " + euros(dem.budget) + " : il peut refuser."],
      trop_cher: ["danger", "Bien au-dessus de son budget de " + euros(dem.budget) + " : il refusera sans doute."],
      insuffisant: ["danger", "Ne répond pas à son besoin : " + ev.manques.map(function (m) { return TMI.Sim.produit(m.comp + "_" + m.min).nom + " minimum"; }).join(", ") + "."]
    }[ev.verdict];
    return '<div class="stats"><span>Coût des pièces <b>' + euros(ev.cout) + '</b></span><span>Prix conseillé <b>' + euros(ev.suggere) + "</b></span>" +
      '<span>Marge <b class="' + (ev.marge >= 0 ? "positif" : "negatif") + '">' + signe(ev.marge) + "</b></span><span>Budget client <b>" + euros(dem.budget) + "</b></span></div>" +
      '<span class="etat ' + verdicts[0] + '">' + verdicts[1] + "</span>" +
      (ev.aCommander.length
        ? '<p class="aide">À commander automatiquement si le client accepte : <b>' + ev.aCommander.map(function (pid) { return esc(Sim.produit(pid).nom); }).join(", ") + "</b> (" + euros(ev.coutCommande) + "). Livraison au client sous " + ev.delai + " jours.</p>"
        : '<p class="aide">Toutes les pièces sont en stock : livraison au client sous ' + ev.delai + " jours.</p>");
  }
  function atelier(s, ui) {
    var Sim = TMI.Sim, d = D(), M = d.montage, h = "";
    var techs = s.employes.filter(function (e) { return e.poste === "technicien"; });
    h += '<p class="aide">Les clients décrivent leur usage et leur budget ; le jeu prépare une configuration qui répond au besoin, tu ajustes si tu veux et tu proposes un prix. Les pièces absentes du stock sont commandées automatiquement si le client accepte. Carte mère, boîtier et alimentation sont compris dans le forfait de montage. Le client paie à la remise du PC.</p>';
    if (!techs.length) h += '<div class="verrou"><div class="verrou-titre"><span class="cadenas"></span><b>Pas encore de technicien</b></div><p class="verrou-noms">Embauches-en un au bureau, onglet Personnel : lui seul monte les PC. Un technicien expérimenté travaille plus vite et fait moins d\'erreurs.</p><button class="bouton petit" data-act="aller-personnel">Voir les candidats</button></div>';

    // Travaux en cours
    var travaux = s.atelier.travaux.slice().sort(function (a, b) { return (a.type === "sav" ? 0 : 1) - (b.type === "sav" ? 0 : 1) || a.echeance - b.echeance; });
    h += "<h3>Travaux en cours" + (travaux.length ? ' <span class="discret">(' + travaux.length + ")</span>" : "") + "</h3>";
    if (!travaux.length) h += '<p class="aide">Aucun PC en montage.</p>';
    else {
      h += '<div class="liste">';
      travaux.forEach(function (j) {
        var tech = j.tech && s.employes.filter(function (e) { return e.id === j.tech; })[0];
        var fait = 1 - Math.max(0, j.restant) / j.total;
        var delai = j.echeance - s.jour;
        var badge = delai < 0 ? '<span class="etat danger">en retard</span>' : delai === 0 ? '<span class="etat alerte">à livrer ce soir</span>' : '<span class="etat">jour ' + (j.echeance + 1) + "</span>";
        var RT = d.reparations.types, titre, detail, statut;
        if (j.type === "reparation") {
          titre = "Réparation · " + esc(RT[j.rep].nom.toLowerCase());
          detail = j.piece ? "Pièce : " + esc(Sim.produit(j.piece).nom) : esc(RT[j.rep].detail);
        } else if (j.type === "sav") {
          titre = j.origine === "garantie" ? "Garantie · " + esc(Sim.produit(j.prodId).nom)
            : j.origine === "reparation" ? "SAV · réparation " + esc(RT[j.rep].nom.toLowerCase())
            : "SAV · PC " + esc(M.usages[j.usage].nom.toLowerCase());
          detail = "Panne : " + esc(j.panne);
        } else {
          titre = "PC " + esc(M.usages[j.usage].nom.toLowerCase()) + ' <span class="discret">· ' + esc(d.profilsClients[j.profil].nom.toLowerCase()) + "</span>";
          detail = M.composants.map(function (c) { return esc(Sim.produit(j.choix[c]).nom); }).join(" · ");
        }
        var bloquePiece = j.piece && !j.pieceOk && !(s.stock[j.piece] > 0);
        var niveauManque = j.type === "reparation" && Sim.meilleurNiveauTech(s) < RT[j.rep].niveauMin;
        var attente = j.attente && j.attente.length;
        statut = attente ? '<b class="negatif">attend ' + (attente > 1 ? attente + " pièces" : "une pièce") + " du fournisseur</b> (" + j.attente.map(function (pid) { return esc(Sim.produit(pid).nom); }).join(", ") + ")"
          : tech ? "en cours par " + esc(tech.nom)
          : bloquePiece ? '<b class="negatif">en attente de pièce</b> · <button class="lien" data-act="aller-stock" data-id="' + j.piece + '">commander</button>'
          : niveauManque ? '<b class="negatif">attend un technicien niveau ' + RT[j.rep].niveauMin + "</b>"
          : techs.length ? "en attente d'un technicien libre" : '<b class="negatif">aucun technicien</b>';
        h += '<div class="ligne"><div><div class="titre">' + titre + "</div>" +
          '<div class="detail">' + detail + "</div>" +
          '<div class="detail">' + '<span class="mini-jauge progres"><span style="width:' + Math.round(fait * 100) + '%"></span></span>' + " " + Math.round(fait * 100) + " % · " + statut + (j.prix ? " · " + euros(j.prix) : j.type === "sav" ? " · gratuit" : "") + "</div></div>" +
          '<div class="droite">' + badge + "</div></div>";
      });
      h += "</div>";
    }

    // Demandes
    var dems = s.atelier.demandes;
    h += "<h3>Demandes de PC sur mesure" + (dems.length ? ' <span class="discret">(' + dems.length + ")</span>" : "") + "</h3>";
    if (!dems.length) h += '<p class="aide">Pas de demande pour l\'instant. Elles arrivent plus souvent dans les villes de joueurs et quand la réputation monte.</p>';
    dems.forEach(function (dem) {
      var ouvert = ui.compo && ui.compo.demId === dem.id;
      var reste = dem.expire - s.jour;
      h += '<div class="carte' + (ouvert ? " compo-ouvert" : "") + '"><div class="entete"><div><b>' + esc(d.profilsClients[dem.profil].nom) + "</b> · usage " + esc(M.usages[dem.usage].nom.toLowerCase()) +
        '<br><span class="aide">' + (reste <= 0 ? "Attend ta réponse jusqu'à ce soir" : "Attend ta réponse jusqu'au jour " + (dem.expire + 1)) + (dem.essais ? " · encore " + (M.essais - dem.essais) + " proposition" : "") + "</span></div>" +
        '<span class="budget num">' + euros(dem.budget) + "</span></div>" +
        '<div class="exigences">' + exigencesTexte(s, dem) + "</div>";
      if (!ouvert) {
        h += '<div class="boutons-ligne"><button class="bouton petit principal" data-act="compo-ouvrir" data-id="' + dem.id + '">Composer un PC</button><button class="bouton petit" data-act="decliner" data-id="' + dem.id + '">Décliner</button></div>';
      } else {
        h += '<div class="compo">';
        M.composants.forEach(function (comp) {
          var mg = Sim.minGamme(s, dem, comp), choisi = ui.compo.choix[comp];
          var options = Sim.catalogue().liste.filter(function (p) { return p.typeId === comp && (Sim.disponible(s, p) || p.id === choisi); });
          h += '<label class="piece"><span>' + icone(null, comp) + COMP_COURT[comp] + "</span>";
          h += '<select data-act="compo-piece" data-comp="' + comp + '">' + (choisi ? "" : '<option value="">— choisir —</option>');
          options.forEach(function (p) {
            var faible = mg != null && p.gamme < mg;
            h += '<option value="' + p.id + '"' + (p.id === choisi ? " selected" : "") + ">" + esc(p.nom + " · " + ((s.stock[p.id] || 0) > 0 ? s.stock[p.id] + " en stock" : "à commander") + " · coût " + ((s.stock[p.id] || 0) > 0 ? Sim.coutStock(s, p.id) : Sim.coutAchat(s, p)) + " €" + (faible ? " · trop juste" : "")) + "</option>";
          });
          h += "</select></label>";
        });
        var ev = Sim.evaluerMontage(s, dem, ui.compo.choix, ui.compo.prix);
        var prixAff = ui.compo.prix != null ? ui.compo.prix : (ev.complet ? ev.suggere : "");
        h += '<label class="piece"><span>Prix proposé</span><span class="champ-prix"><input type="number" min="1" step="10" value="' + prixAff + '" data-act="compo-prix" aria-label="Prix proposé"> €' +
          (ev.complet ? ' <button class="lien" data-act="compo-prix-auto">prix conseillé : ' + euros(ev.suggere) + "</button>" : "") + "</span></label>";
        h += '<div id="compo-resume" class="compo-resume">' + resumeCompo(s, ui) + "</div>";
        h += '<div class="boutons-ligne"><button class="bouton petit principal" data-act="compo-proposer"' + (ev.complet && techs.length ? "" : " disabled") + ">Proposer au client</button><button class=\"bouton petit\" data-act=\"compo-annuler\">Fermer</button></div>";
        if (!techs.length) h += '<p class="aide">Il faut un technicien pour accepter un montage.</p>';
        h += "</div>";
      }
      h += "</div>";
    });

    // Réparations
    var R = d.reparations, a = s.atelier, mo = s.mois, niv = Sim.meilleurNiveauTech(s);
    h += "<h3>Réparations</h3>";
    h += '<p class="aide">Les clients déposent leur appareil au comptoir et paient en le récupérant. Au-dessus du tarif habituel, une partie renonce ; en dessous, tu en attires davantage. Les ordinateurs vendus et les réparations sont garantis : une panne revient en SAV gratuit.</p>';
    h += '<div class="liste">';
    Object.keys(R.types).forEach(function (k) {
      var t = R.types[k], tarif = a.tarifs[k], ratio = tarif / t.prixRef, acc = Sim.acceptationTarif(ratio);
      var bloque = niv < t.niveauMin;
      var avis = ratio < 0.97 ? '<span class="etat bon">attire plus de clients</span>' : acc > 0.9 ? '<span class="etat">prix du marché</span>' : acc > 0.5 ? '<span class="etat alerte">' + Math.round((1 - acc) * 100) + " % renoncent</span>" : '<span class="etat danger">' + Math.round((1 - acc) * 100) + " % renoncent</span>";
      h += '<div class="ligne rep-ligne' + (a.ouvert[k] ? "" : " ferme") + '"><div>' +
        '<label class="interrupteur"><input type="checkbox" data-act="rep-ouvert" data-type="' + k + '"' + (a.ouvert[k] ? " checked" : "") + '><span class="titre">' + esc(t.nom) + "</span></label>" +
        '<div class="detail">' + esc(t.detail) + "</div>" +
        '<div class="detail">≈ ' + dureeTexte(t.duree) + " de travail · rendu en " + t.delai + " jour" + (t.delai > 1 ? "s" : "") + " · marché " + euros(t.prixRef) + " · consommables " + euros(t.cout) + "</div>" +
        (bloque ? '<div class="detail negatif">Réservé à un technicien niveau ' + t.niveauMin + (techs.length ? " (le meilleur de ton équipe : niveau " + niv + ")" : "") + ".</div>" : "") +
        (a.ouvert[k] && !bloque ? avis : "") + "</div>" +
        '<div class="droite"><span class="champ-prix"><input type="number" min="1" step="5" value="' + tarif + '" data-act="rep-tarif" data-type="' + k + '" aria-label="Tarif ' + esc(t.nom) + '"> €</span></div></div>';
    });
    h += "</div>";
    h += '<label class="piece"><span>Atelier plein</span><select data-act="rep-limite">' + R.limitesFile.map(function (n) {
      return '<option value="' + n + '"' + (a.limiteFile === n ? " selected" : "") + ">" + (n >= 99 ? "Tout accepter, même débordé" : "Refuser au-delà de " + n + " travaux en file") + "</option>";
    }).join("") + "</select></label>";
    h += '<div class="liste">' +
      ligneSimple("Réparations rendues ce mois", (mo.reparations || 0) + " · " + euros(mo.caReparations || 0)) +
      ligneSimple("Refusées (atelier plein ou fermé)", mo.repRefusees || 0) +
      ligneSimple("Ont trouvé le tarif trop cher", mo.repTropCher || 0) +
      ligneSimple("Retours sous garantie", mo.garanties || 0) + "</div>";
    if (!techs.length) h += '<p class="aide">Sans technicien, le comptoir des réparations reste fermé.</p>';
    return h;
  }
  function dureeTexte(min) { return min < 60 ? min + " min" : (min % 60 ? Math.floor(min / 60) + " h " + (min % 60) : min / 60 + " h"); }

  // ------------------------------------------------------------ Publicité
  function nomCible(c) { return c === "tous" ? "Tous publics" : D().profilsClients[c].nom; }
  function estimationTexte(s, type, f) {
    var e = TMI.Sim.estimationPub(s, type, f.budget, f.jours), t = D().publicite.types[type];
    return "≈ <b>+" + Math.round(e.clientsJour) + " client" + (Math.round(e.clientsJour) > 1 ? "s" : "") + " par jour</b> en boutique (+" + Math.round(e.effet * 100) + " %)" +
      " · " + euros(e.budgetJour) + " par jour" + (t.atelier >= 0.5 ? " · l'atelier reçoit aussi plus de demandes" : "");
  }
  function pub(s, ui) {
    var Sim = TMI.Sim, d = D(), P = d.publicite, v = Sim.ville(s), h = "";
    ui.pub = ui.pub || {};
    Object.keys(P.types).forEach(function (k) { if (!ui.pub[k]) ui.pub[k] = { cible: v.profil, jours: P.dureeDefaut, budget: P.types[k].budgetDefaut }; });
    h += '<p class="aide">Une campagne attire plus de clients, surtout du profil visé. Elle se paie au lancement. Les premiers euros rapportent beaucoup, les suivants de moins en moins. Clientèle dominante à ' + esc(v.nom) + " : <b>" + esc(d.profilsClients[v.profil].nom.toLowerCase()) + "</b>.</p>";

    // Le magasin peut-il suivre ?
    var alertes = [], m = s.mois;
    var vendeurs = s.employes.filter(function (e) { return e.poste === "vendeur"; }).length, caissiers = s.employes.filter(function (e) { return e.poste === "caissier"; }).length;
    if (!vendeurs || !caissiers) alertes.push("Il te manque " + (!vendeurs ? "un vendeur" : "un caissier") + " : un afflux de clients ferait surtout des déçus.");
    var vides = s.rayons.filter(function (pid) { return pid && !(s.stock[pid] > 0); }).length;
    if (vides) alertes.push(vides + " rayon" + (vides > 1 ? "s vides" : " vide") + " : les nouveaux clients risquent de repartir les mains vides.");
    if (m.perdusAttente >= 5) alertes.push(m.perdusAttente + " clients sont déjà partis après une longue attente ce mois : renforce l'équipe avant d'en attirer d'autres.");
    if (m.horsCapacite) alertes.push(m.horsCapacite + " clients refoulés ce mois : ton local est plein (" + Sim.local(s).capaciteClients + " clients à la fois).");
    if (alertes.length) h += '<ul class="alertes">' + alertes.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>";

    // En cours
    if (s.pubs.length) {
      h += "<h3>Campagnes en cours</h3>";
      s.pubs.forEach(function (c) {
        var t = P.types[c.type], eff = Sim.effetCampagne(s, c), enCours = s.jour <= c.fin;
        var fait = Math.min(1, (s.jour - c.debut + 1) / c.jours);
        h += '<div class="carte"><div class="entete"><div><b>' + esc(t.nom) + '</b><br><span class="aide">' + esc(nomCible(c.cible)) + " · " + c.jours + " jours · " + euros(c.budget) + "</span></div>" +
          '<span class="etat ' + (enCours ? "bon" : "") + '">' + (enCours ? "+" + Math.round(eff * 100) + " % de clients" : "l'effet s'estompe") + "</span></div>" +
          '<div class="detail"><span class="mini-jauge progres"><span style="width:' + Math.round(fait * 100) + '%"></span></span> ' + (enCours ? "jour " + (s.jour - c.debut + 1) + " sur " + c.jours : "terminée le jour " + (c.fin + 1)) + "</div>" +
          '<div class="stats"><span>Clients attirés <b>' + c.clients + "</b></span><span>Ventes <b>" + c.ventes + "</b></span><span>Chiffre d'affaires <b>" + euros(c.ca) + "</b></span><span>Coût <b>" + euros(c.budget) + "</b></span></div></div>";
      });
    }

    // Lancer
    h += "<h3>Lancer une campagne</h3>";
    Object.keys(P.types).forEach(function (k) {
      var t = P.types[k], f = ui.pub[k];
      var active = s.pubs.filter(function (c) { return c.type === k && s.jour <= c.fin; })[0];
      h += '<div class="carte"><div class="entete"><div><b>' + esc(t.nom) + '</b><br><span class="aide">' + esc(t.detail) + "</span></div></div>";
      if (active) { h += '<p class="aide">Déjà en cours jusqu\'au jour ' + (active.fin + 1) + ". Une seule campagne de ce type à la fois.</p></div>"; return; }
      h += '<label class="piece"><span>Public visé</span><select data-act="pub-cible" data-type="' + k + '">' +
        ["tous"].concat(Object.keys(d.profilsClients)).map(function (c) {
          return '<option value="' + c + '"' + (f.cible === c ? " selected" : "") + ">" + esc(nomCible(c)) + (c === v.profil ? " (clientèle dominante)" : "") + "</option>";
        }).join("") + "</select></label>";
      h += '<div class="piece"><span>Durée</span><div class="puces">' + P.durees.map(function (j) {
        return '<button class="puce' + (f.jours === j ? " actif" : "") + '" data-act="pub-duree" data-type="' + k + '" data-j="' + j + '">' + j + " jours</button>";
      }).join("") + "</div></div>";
      h += '<label class="piece"><span>Budget total</span><span class="champ-prix"><input type="number" min="' + t.budgetMin + '" max="' + t.budgetMax + '" step="100" value="' + f.budget + '" data-act="pub-budget" data-type="' + k + '"> € <span class="aide">(' + euros(t.budgetMin) + " à " + euros(t.budgetMax) + ")</span></span></label>";
      h += '<p class="aide" id="pub-est-' + k + '">' + estimationTexte(s, k, f) + "</p>";
      h += '<div class="boutons-ligne"><button class="bouton petit principal" data-act="pub-lancer" data-type="' + k + '">Lancer la campagne</button></div></div>';
    });

    // Passées
    if (s.pubsFinies && s.pubsFinies.length) {
      h += '<h3>Campagnes passées</h3><div class="defile"><table class="bilan"><thead><tr><th>Campagne</th><th>Coût</th><th>Clients</th><th>Ventes</th><th>CA</th></tr></thead><tbody>';
      s.pubsFinies.forEach(function (c) {
        h += "<tr><td>" + esc(c.type === "radio" ? "Radio" : "Tracts") + " · " + esc(nomCible(c.cible).toLowerCase()) + "</td><td>" + euros(c.budget) + "</td><td>" + c.clients + "</td><td>" + c.ventes + "</td><td>" + euros(c.ca) + "</td></tr>";
      });
      h += "</tbody></table></div>";
    }
    return h;
  }


  // ------------------------------------------------------------ Déco
  var NOMS_PROFILS = { joueurs: "joueurs", professionnels: "professionnels", etudiants: "étudiants", familles: "familles" };
  function effetDeco(def) {
    var t = [];
    if (def.effet === "attente") t.push("patience");
    if (def.effet === "vitrine") t.push("attire les passants");
    if (def.theme) t.push("public : " + NOMS_PROFILS[def.theme]);
    if (def.entretien) t.push(euros(def.entretien) + "/mois");
    return t.join(" · ");
  }
  function deco(s, ui) {
    var Sim = TMI.Sim, C = D().deco, dc = Sim.deco(s), a = Sim.ambiance(s), h = "";
    var niv = Math.round(a.niveau * 100);
    h += '<div class="carte ambiance"><div class="entete"><div><b>Ambiance du magasin</b><br><span class="aide">' + a.pts + " points de déco · " + (a.objets || 0) + " objet" + ((a.objets || 0) > 1 ? "s" : "") + "</span></div>" +
      '<span class="etat ' + (niv >= 50 ? "bon" : "") + '">' + niv + " %</span></div>" +
      '<div class="detail"><span class="mini-jauge progres"><span style="width:' + niv + '%"></span></span></div>' +
      '<div class="stats"><span>Ventes <b>+' + Math.round(a.conversion * 100) + ' %</b></span><span>Patience <b>+' + Math.round(a.patience * 100) + ' %</b></span>' +
      '<span>Réputation <b>+' + Math.round(a.reputation * 100) + ' %</b></span><span>Passants <b>+' + Math.round(a.affluence * 100) + " %</b></span>" +
      (a.entretien ? "<span>Entretien <b>" + euros(a.entretien) + "/mois</b></span>" : "") + "</div>";
    var th = Object.keys(a.parTheme);
    if (th.length) h += '<p class="aide">Coins à thème : ' + th.map(function (k) { return NOMS_PROFILS[k] + " +" + Math.round(a.parTheme[k] * C.effets.themeProfil * 100) + " % de visites"; }).join(", ") + ".</p>";
    h += '<p class="aide">Les premiers objets comptent le plus. Un grand local demande plus de déco pour la même ambiance. Revente : ' + Math.round(C.revente * 100) + " % du prix.</p></div>";

    if (ui.decoChoisi) {
      var o = dc.objets.filter(function (x) { return x.id === ui.decoChoisi; })[0];
      if (o) {
        var dfo = C.objets[o.type];
        h += '<div class="carte choisi"><div class="entete"><div><b>' + esc(dfo.nom) + '</b><br><span class="aide">Objet sélectionné</span></div></div>' +
          '<div class="boutons-ligne"><button class="bouton petit" data-act="deco-deplacer" data-id="' + o.id + '">Déplacer</button>' +
          (dfo.mur ? "" : '<button class="bouton petit" data-act="deco-tourner" data-id="' + o.id + '">Tourner</button>') +
          '<button class="bouton petit danger" data-act="deco-vendre" data-id="' + o.id + '">Revendre ' + euros(dfo.prix * C.revente) + "</button>" +
          '<button class="bouton petit" data-act="deco-fermer">Fermer</button></div></div>';
      } else ui.decoChoisi = null;
    }

    function revetements(titre, genre, liste) {
      var r = "<h3>" + titre + '</h3><div class="deco-grille">';
      Object.keys(liste).forEach(function (k) {
        var def = liste[k], actuel = dc[genre] === k;
        var nuance = genre === "sol" ? "linear-gradient(135deg," + def.c1 + " 50%," + def.c2 + " 50%)" : def.c;
        r += '<button class="deco-carte' + (actuel ? " actif" : "") + '" data-act="deco-' + genre + '" data-id="' + k + '"' + (actuel ? " disabled" : "") + ">" +
          '<span class="deco-pastille" style="background:' + nuance + '"></span><b>' + esc(def.nom) + "</b>" +
          '<span class="aide">' + (actuel ? "En place" : def.prix ? euros(def.prix) : "Gratuit") + (def.pts ? " · " + def.pts + " pt" + (def.pts > 1 ? "s" : "") : "") + "</span></button>";
      });
      return r + "</div>";
    }
    h += revetements("Sol", "sol", C.sols);
    h += revetements("Murs", "murs", C.murs);

    Object.keys(C.familles).forEach(function (f) {
      h += "<h3>" + esc(C.familles[f]) + '</h3><div class="deco-grille">';
      Object.keys(C.objets).forEach(function (k) {
        var def = C.objets[k];
        if (def.famille !== f) return;
        var n = dc.objets.filter(function (x) { return x.type === k; }).length;
        h += '<button class="deco-carte" data-act="deco-placer" data-id="' + k + '"' + (def.prix > s.argent ? ' aria-disabled="true"' : "") + ">" +
          '<span class="deco-pastille deco-' + def.famille + '"></span><b>' + esc(def.nom) + (n ? ' <span class="deco-nb">×' + n + "</span>" : "") + "</b>" +
          '<span class="aide">' + euros(def.prix) + " · " + def.pts + " pt" + (def.pts > 1 ? "s" : "") + (def.mur ? " · mural" : " · " + def.taille[0] + "×" + def.taille[1]) + "</span>" +
          (effetDeco(def) ? '<span class="aide">' + esc(effetDeco(def)) + "</span>" : "") + "</button>";
      });
      h += "</div>";
    });
    h += '<p class="aide">Touche un objet pour le poser : une grille apparaît dans la salle (vert = libre). Les objets muraux se posent sur les murs nord, ouest et est (bouton « Autre mur » ou pivote la caméra). Touche un objet déjà posé pour le déplacer ou le revendre.</p>';
    return h;
  }

  // ------------------------------------------------------------ Bilan
  function bilan(s, ui) {
    var Sim = TMI.Sim, m = s.mois, d = Sim.infosDate(s), h = "";
    var salaires = Math.round(s.salairesDus);
    var resultat = Sim.resultatMois(m, salaires);
    h += '<div class="formule">Résultat = chiffre d\'affaires − coût des produits vendus − salaires − loyer − charges − pièces de SAV − publicité</div>';
    h += "<h3>Mois " + d.mois + " en cours <span class=\"discret\">(jour " + d.jourDuMois + " / " + D().config.temps.joursParMois + ")</span></h3>";
    h += '<table class="bilan"><tbody>' +
      "<tr><td>Chiffre d'affaires</td><td>" + euros(m.ca) + "</td></tr>" +
      (m.caMontage ? '<tr><td class="discret">dont PC sur mesure (' + m.montages + ")</td><td class=\"discret\">" + euros(m.caMontage) + "</td></tr>" : "") +
      (m.caReparations ? '<tr><td class="discret">dont réparations (' + m.reparations + ")</td><td class=\"discret\">" + euros(m.caReparations) + "</td></tr>" : "") +
      "<tr><td>Coût des produits vendus</td><td>− " + euros(m.cogs) + "</td></tr>" +
      "<tr><td>Marge brute</td><td>" + euros(m.ca - m.cogs) + (m.ca ? " (" + pct((m.ca - m.cogs) / m.ca) + ")" : "") + "</td></tr>" +
      "<tr><td>Salaires dus à ce jour</td><td>− " + euros(salaires) + "</td></tr>" +
      "<tr><td>Loyer</td><td>− " + euros(m.loyer) + "</td></tr>" +
      "<tr><td>Charges (énergie, assurance)</td><td>− " + euros(m.charges) + "</td></tr>" +
      (m.sav ? "<tr><td>Pièces de SAV</td><td>− " + euros(m.sav) + "</td></tr>" : "") +
      (m.pub ? "<tr><td>Publicité</td><td>− " + euros(m.pub) + "</td></tr>" : "") +
      '<tr class="total"><td>Résultat provisoire</td><td class="' + (resultat >= 0 ? "positif" : "negatif") + '">' + signe(resultat) + "</td></tr>" +
      "</tbody></table>";
    h += '<div class="liste">' +
      ligneSimple("Trésorerie", euros(s.argent)) +
      ligneSimple("Valeur du stock", euros(Sim.valeurStock(s))) +
      ligneSimple("Achats de stock ce mois", euros(m.achats)) +
      (s.dette > 0 ? ligneSimple("Prêt restant", euros(s.dette)) : "") +
      ligneSimple("Clients entrés / ventes", m.clients + " / " + m.ventes + (m.clients ? " (" + pct(m.ventes / m.clients) + ")" : "")) +
      ligneSimple("Partis après une longue attente", m.perdusAttente) +
      ligneSimple("N'ont pas trouvé leur produit", m.introuvables) +
      ligneSimple("Ont renoncé (prix, choix)", m.refus) +
      (m.horsCapacite ? ligneSimple("Refoulés (magasin plein)", m.horsCapacite) : "") +
      ligneSimple("PC sur mesure livrés ce mois", m.montages || 0) +
      ligneSimple("Réparations rendues ce mois", m.reparations || 0) +
      (m.clientsPub ? ligneSimple("Clients venus grâce à la publicité", m.clientsPub) : "") +
      "</div>";
    if (s.bilans.length) {
      h += '<h3>Mois précédents</h3><div class="defile"><table class="bilan"><thead><tr><th>Mois</th><th>CA</th><th>Marge</th><th>Salaires</th><th>Loyer+ch.</th><th>Résultat</th><th>Trésorerie</th></tr></thead><tbody>';
      s.bilans.slice().reverse().forEach(function (b) {
        h += "<tr><td>" + b.numero + "</td><td>" + euros(b.ca) + "</td><td>" + euros(b.ca - b.cogs) + "</td><td>" + euros(b.salaires) + "</td><td>" + euros(b.loyer + b.charges) +
          '</td><td class="' + (b.resultat >= 0 ? "positif" : "negatif") + '">' + signe(b.resultat) + "</td><td>" + euros(b.tresorerie) + "</td></tr>";
      });
      h += "</tbody></table></div>";
    }
    var v = Sim.ville(s);
    h += '<p class="aide">Loyer de ton ' + esc(Sim.local(s).nom.toLowerCase()) + " à " + esc(v.nom) + " : " + euros(Sim.loyerLocal(s)) + " par mois, payé le 1er jour du mois. Faillite si la trésorerie est négative en fin de mois" + (s.difficulte === "facile" ? " (en facile, la banque prête de quoi continuer)." : ".") + "</p>";
    return h;
  }
  function ligneSimple(a, b) { return '<div class="ligne"><span>' + a + '</span><b class="num">' + b + "</b></div>"; }

  // ------------------------------------------------------------ Local (bureau) : taille, loyer, agrandissement
  function ligneLocal(nom, avant, apres) {
    return "<tr><td>" + nom + "</td><td>" + avant + "</td><td><b>" + apres + "</b></td></tr>";
  }
  function local(s, ui) {
    var Sim = TMI.Sim, c = D().config, loc = Sim.local(s), m = s.mois, h = "";
    var joursAn = c.temps.joursParMois * 12, prochaineHausse = (Math.floor(s.jour / joursAn) + 1) * joursAn;
    if (Sim.ferme(s)) h += '<div class="carte alerte-carte"><b>Déménagement en cours</b><span class="aide">Aucun client pendant les travaux. La boutique rouvre le jour ' + (s.fermeJusqu + 2) + ".</span></div>";
    h += '<div class="carte"><div class="entete"><div><div class="titre"><b>' + esc(loc.nom) + '</b></div><span class="aide">Ton local actuel</span></div><span class="etat bon">loué</span></div>' +
      '<div class="stats"><span>Emplacements <b>' + loc.emplacements + "</b></span><span>Clients à la fois <b>" + loc.capaciteClients + "</b></span>" +
      "<span>Loyer <b>" + euros(Sim.loyerLocal(s)) + "</b> / mois</span><span>Charges <b>" + euros(loc.charges) + "</b> / mois</span>" +
      "<span>Dépôt versé <b>" + euros(s.depot != null ? s.depot : Sim.ville(s).loyer * loc.depotMoisLoyer) + "</b></span><span>Hausse du loyer <b>+" + Math.round(c.hausseLoyerAnnuelle * 100) + " %</b> le jour " + (prochaineHausse + 1) + "</span></div>";
    var signes = [];
    if (m.horsCapacite) signes.push(m.horsCapacite + " client" + (m.horsCapacite > 1 ? "s refoulés" : " refoulé") + " ce mois : le local était plein");
    var pleins = s.rayons.filter(Boolean).length;
    if (pleins === s.rayons.length) signes.push("tes " + s.rayons.length + " emplacements sont tous occupés");
    if (m.introuvables) signes.push(m.introuvables + " client" + (m.introuvables > 1 ? "s n'ont" : " n'a") + " pas trouvé leur produit ce mois");
    h += signes.length ? '<p class="aide">Signes qu\'il est temps de grandir : ' + esc(signes.join(" ; ")) + ".</p>" : "";
    h += "</div>";

    var suivant = Sim.localSuivant(s);
    if (!suivant) { h += '<p class="aide">Tu occupes déjà le plus grand local. La suite : ouvrir d\'autres magasins (palier 2).</p>'; return h; }
    var n = c.locaux[suivant], cout = Sim.coutDemenagement(s, suivant), loyerN = Sim.loyerLocal(s, suivant);
    var surcout = loyerN + n.charges - Sim.loyerLocal(s) - loc.charges;
    h += "<h3>Déménager vers un " + esc(n.nom.toLowerCase()) + "</h3>";
    h += '<div class="carte"><table class="bilan"><thead><tr><th></th><th>Aujourd\'hui</th><th>' + esc(n.nom) + "</th></tr></thead><tbody>" +
      ligneLocal("Emplacements en rayon", loc.emplacements, n.emplacements) +
      ligneLocal("Clients à la fois", loc.capaciteClients, n.capaciteClients) +
      ligneLocal("Passage (vitrine)", "×" + (loc.affluence || 1).toFixed(2).replace(".", ","), "×" + n.affluence.toFixed(2).replace(".", ",")) +
      ligneLocal("Loyer + charges / mois", euros(Sim.loyerLocal(s) + loc.charges), euros(loyerN + n.charges)) +
      "</tbody></table>" +
      '<table class="bilan"><tbody>' +
      "<tr><td>Nouveau dépôt de garantie (" + n.depotMoisLoyer + " mois)</td><td>" + euros(cout.depot) + "</td></tr>" +
      "<tr><td>Ancien dépôt rendu</td><td>− " + euros(cout.rendu) + "</td></tr>" +
      "<tr><td>Aménagement du nouveau local</td><td>" + euros(cout.amenagement) + "</td></tr>" +
      '<tr class="total"><td>À payer maintenant</td><td>' + euros(cout.total) + "</td></tr></tbody></table>" +
      '<p class="aide">Stock, équipe, prix et rayons te suivent ; les nouveaux emplacements arrivent vides. La boutique ferme ' + c.joursDemenagement + " jours le temps du déménagement. Ensuite, " + signe(surcout).replace("+", "+ ") + " de frais fixes chaque mois : il faudra vendre plus.</p>" +
      '<div><button class="bouton principal" data-act="demenager" data-taille="' + suivant + '"' + (cout.total > s.argent || Sim.ferme(s) ? " disabled" : "") + ">Déménager · " + euros(cout.total) + "</button></div>" +
      (cout.total > s.argent ? '<p class="aide negatif">Il manque ' + euros(cout.total - s.argent) + " de trésorerie.</p>" : "") +
      "</div>";
    var apres = Sim.localSuivant({ local: suivant });
    if (apres) h += '<p class="aide">Ensuite : le ' + esc(c.locaux[apres].nom.toLowerCase()) + " (" + c.locaux[apres].emplacements + " emplacements, " + c.locaux[apres].capaciteClients + " clients à la fois).</p>";
    return h;
  }

  // ------------------------------------------------------------ Journal
  // Effets d'un événement, en clair
  function nomsTypes(obj) { return Object.keys(obj || {}).map(function (k) { return nomType(k).toLowerCase(); }).join(", "); }
  function effetsEvenement(e) {
    var r = [], pc = function (x) { return (x > 1 ? "+" : "−") + Math.round(Math.abs(x - 1) * 100) + " %"; };
    if (e.affluence && e.affluence !== 1) r.push(pc(e.affluence) + " de clients en boutique");
    Object.keys(e.profils || {}).forEach(function (k) { r.push((e.profils[k] > 1 ? "Beaucoup plus de " : "Moins de ") + D().profilsClients[k].nom.toLowerCase()); });
    var hausse = Object.keys(e.envies || {}).filter(function (k) { return e.envies[k] > 1; });
    if (hausse.length) r.push("Demande en hausse : " + hausse.map(function (k) { return nomType(k).toLowerCase(); }).join(", "));
    Object.keys(e.prix || {}).forEach(function (k) { r.push(nomType(k) + " : prix du marché " + pc(e.prix[k])); });
    var rem = Object.keys(e.remises || {});
    if (rem.length) r.push("À l'achat : " + pc(e.remises[rem[0]]) + " sur " + nomsTypes(e.remises));
    var del = Object.keys(e.delai || {});
    if (del.length) r.push("Livraisons plus lentes : " + del.map(function (k) { return nomType(k).toLowerCase() + " +" + e.delai[k] + " j"; }).join(", "));
    if (e.sensibilite && e.sensibilite > 1) r.push("Les clients comparent davantage les prix");
    if (e.reputation) r.push("+" + e.reputation + " de réputation");
    return r;
  }
  function blocEvenements(s) {
    var Sim = TMI.Sim, act = Sim.evenementsActifs(s), av = Sim.evenementsAVenir(s), h = "<h3>Événements</h3>";
    if (!act.length && !av.length) return h + '<p class="aide">Rien de spécial pour l\'instant. Les saisons (soldes, rentrée, Black Friday, fêtes) et les imprévus (pénuries, promos) apparaissent ici.</p>';
    h += '<div class="liste">';
    act.forEach(function (a) {
      h += '<div class="ligne"><div><div class="titre">' + esc(a.def.nom) + ' <span class="etat bon">en cours</span></div><div class="detail">' + esc(effetsEvenement(a.def).join(" · ")) + "</div></div>" +
        '<div class="droite"><span class="etat">jusqu\'au ' + esc(Sim.dateTexte(a.fin)) + "</span></div></div>";
    });
    av.forEach(function (a) {
      h += '<div class="ligne"><div><div class="titre">' + esc(a.def.nom) + ' <span class="etat alerte">à venir</span></div><div class="detail">' + esc(effetsEvenement(a.def).join(" · ")) + "</div></div>" +
        '<div class="droite"><span class="etat">le ' + esc(Sim.dateTexte(a.debut)) + "</span></div></div>";
    });
    return h + "</div>";
  }
  function journal(s, ui) {
    var h = blocEvenements(s) + "<h3>Objectifs</h3><div class=\"liste\">";
    D().config.objectifs.forEach(function (o) {
      var fait = !!s.objectifsFaits[o.id];
      h += '<div class="ligne"><span>' + esc(o.texte) + '</span><span class="etat' + (fait ? " bon" : "") + '">' + (fait ? "fait" : "à faire") + "</span></div>";
    });
    h += "</div><h3>Journal</h3><ul class=\"journal\">";
    s.journal.slice(0, 80).forEach(function (j) {
      h += '<li class="' + j.type + '"><time>' + j.quand + "</time><span>" + esc(j.texte) + "</span></li>";
    });
    return h + "</ul>";
  }

  // ------------------------------------------------------------ Fiches de la carte
  function ficheBoutique(s0, idx) {
    var Sim = TMI.Sim, d = D();
    if (idx == null) idx = s0.actif || 0;
    var s = Sim.vueMagasin(s0, idx), v = Sim.ville(s), m = s.mois, plusieurs = s0.magasins.length > 1;
    var resultat = Sim.resultatMois(m, Math.round(s.salairesDus));
    var alertes = [];
    if (!s.employes.length) alertes.push("Personne dans l'équipe : embauche un vendeur et un caissier.");
    else {
      if (!s.employes.some(function (e) { return e.poste === "vendeur"; })) alertes.push("Pas de vendeur : les clients des ordinateurs et composants attendent.");
      if (!s.employes.some(function (e) { return e.poste === "caissier"; })) alertes.push("Pas de caissier : le vendeur doit aussi encaisser.");
    }
    if (!s.rayons.some(Boolean)) alertes.push("Aucun produit en rayon : commande du stock.");
    var dems = s.atelier ? s.atelier.demandes.length : 0, retards = s.atelier ? s.atelier.travaux.filter(function (j) { return j.echeance < s.jour; }).length : 0;
    if (dems) alertes.push(dems + " demande" + (dems > 1 ? "s" : "") + " de PC sur mesure attend" + (dems > 1 ? "ent" : "") + " ta réponse à l'atelier.");
    if (retards) alertes.push(retards + " travail" + (retards > 1 ? "x" : "") + " d'atelier en retard.");
    var pubActive = (s.pubs || []).filter(function (c) { return s.jour <= c.fin; });
    var vides = s.rayons.filter(function (pid) { return pid && !(s.stock[pid] > 0); });
    if (vides.length) alertes.push(vides.length + " rayon" + (vides.length > 1 ? "s vides" : " vide") + " : " + vides.map(function (p) { return Sim.produit(p).nom; }).join(", ") + ".");
    var h = "<div><h2>" + (plusieurs ? "Ton magasin" : "Ta boutique") + " à " + esc(v.nom) + '</h2><p class="sous">' + esc(d.regions[v.region] || "") + " · " + esc(d.typesVilles[v.type].nom) + " · " + esc(Sim.local(s).nom.toLowerCase()) + " · loyer " + euros(Sim.loyerLocal(s)) + " / mois</p></div>";
    if (Sim.ferme(s)) alertes.unshift("Déménagement en cours : la boutique rouvre le jour " + (s.fermeJusqu + 2) + ".");
    h += '<div class="chiffres">' +
      '<div class="chiffre"><span>Trésorerie' + (plusieurs ? " (enseigne)" : "") + '</span><b class="' + (s.argent < 0 ? "negatif" : "") + '">' + euros(s.argent) + "</b></div>" +
      '<div class="chiffre"><span>Réputation</span><b>' + Math.round(s.reputation) + " / 100</b></div>" +
      '<div class="chiffre"><span>Ventes ce mois</span><b>' + m.ventes + "</b></div>" +
      '<div class="chiffre"><span>Résultat provisoire</span><b class="' + (resultat >= 0 ? "positif" : "negatif") + '">' + signe(resultat) + "</b></div>" +
      "</div>";
    h += '<ul class="alertes">' + (alertes.length ? alertes.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") : '<li class="ok">Tout tourne : rayons remplis, équipe en place.</li>') + "</ul>";
    if (pubActive.length) h += '<p class="aide">Publicité en cours : ' + pubActive.map(function (c) { return esc(d.publicite.types[c.type].nom.toLowerCase()) + " (jusqu'au jour " + (c.fin + 1) + ")"; }).join(", ") + ".</p>";
    var go = Sim.gammesOuvertes(s);
    h += '<p class="aide">Catalogue : ' + ["entrée de gamme", "entrée et milieu de gamme", "toutes les gammes"][go - 1] + ".</p>";
    h += '<button class="bouton principal" data-fiche="gerer" data-i="' + idx + '">Gérer ' + (plusieurs ? "le magasin de " + esc(v.nom) : "le magasin") + "</button>";
    h += '<p class="aide">Équipe : ' + (s.employes.length ? s.employes.map(function (e) { return esc(e.nom) + " (" + d.config.postes[e.poste].nom.toLowerCase() + ")"; }).join(", ") : "personne") + ".</p>";
    return h + blocEnseigne(s0, idx);
  }
  // L'enseigne : palier, magasins, prochaine étape
  function blocEnseigne(s, idx) {
    var Sim = TMI.Sim, d = D(), c = d.config, pal = s.palier || 1, h = '<div class="enseigne">';
    h += "<h3>Ton enseigne <span class=\"discret\">· palier " + pal + " : " + esc(c.paliers[pal].nom) + "</span></h3>";
    if (s.magasins.length > 1) {
      h += '<div class="liste">';
      s.magasins.forEach(function (x, i) {
        var mg = Sim.vueMagasin(s, i), r = Sim.resultatMois(mg.mois, Math.round(mg.salairesDus)), vv = Sim.ville(mg);
        h += '<button class="ligne ligne-bouton' + (i === idx ? " surbrillance" : "") + '" data-fiche="voir" data-i="' + i + '"><div><div class="titre">' + esc(vv.nom) + (i === s.actif ? ' <span class="etat bon">affiché</span>' : "") + '</div><div class="detail">' +
          esc(d.regions[vv.region]) + " · " + esc(Sim.local(mg).nom.toLowerCase()) + " · réputation " + Math.round(mg.reputation) + " · " + mg.employes.length + " employé" + (mg.employes.length > 1 ? "s" : "") + '</div></div><div class="droite"><b class="num ' + (r >= 0 ? "positif" : "negatif") + '">' + signe(r) + "</b></div></button>";
      });
      h += "</div>";
    }
    if (pal < 2) {
      var parReg = Sim.magasinsParRegion(s), best = Object.keys(parReg).sort(function (a, b) { return parReg[b] - parReg[a]; })[0];
      h += '<p class="aide">Prochain palier : <b>' + esc(c.paliers[2].nom) + "</b>, avec " + c.paliers[2].magasinsRegion + " magasins dans une même région" +
        (best ? " (" + esc(d.regions[best]) + " : " + parReg[best] + " / " + c.paliers[2].magasinsRegion + ")" : "") + ".</p>";
    }
    if (pal === 2) {
      var p3 = c.paliers[3], nr = Sim.regionsAvecMagasin(s).length, ca = Sim.caAnnuel(s);
      h += '<p class="aide">Prochain palier : <b>' + esc(p3.nom) + "</b>, avec des magasins dans " + p3.regions + " régions (" + nr + " / " + p3.regions + ") et " +
        euros(p3.caAnnuel) + " de chiffre d'affaires sur les 12 derniers mois (" + euros(ca) + ").</p>";
    }
    if (pal === 3) {
      var p4 = c.paliers[4], nr4 = Sim.regionsAvecMagasin(s).length, rm = Sim.reputationMoyenne(s);
      h += '<p class="aide">Dernier palier : <b>' + esc(p4.nom) + "</b>, avec des magasins dans " + p4.regions + " régions sur 13 (" + nr4 + " / " + p4.regions + "), une réputation moyenne de " + p4.reputationMoyenne + " (" + Math.round(rm) + ")" +
        (p4.caAnnuel ? " et " + euros(p4.caAnnuel) + " de chiffre d'affaires sur 12 mois (" + euros(Sim.caAnnuel(s)) + ")" : "") + ".</p>";
    }
    if (pal >= 4) h += '<p class="aide"><b>Mode libre</b> : tu es leader national depuis le jour ' + ((s.victoire ? s.victoire.jour : s.jour) + 1) + ". Continue à faire grandir l'enseigne.</p>";
    if (pal >= 3) h += '<button class="bouton" data-fiche="logistique">Logistique : entrepôts et flotte</button>';
    var x = c.expansion;
    var pret = (s.stats.moisPositifs || 0) >= x.moisPositifs && Sim.reputationMax(s) >= x.reputation;
    h += '<p class="aide">' + (pret ? "Tu peux ouvrir un nouveau magasin : touche une ville sur la carte."
      : "Pour ouvrir un autre magasin : " + x.moisPositifs + " mois positifs (" + (s.stats.moisPositifs || 0) + " pour l'instant) et " + x.reputation + " de réputation dans un magasin (meilleure : " + Math.round(Sim.reputationMax(s)) + ").") + "</p>";
    return h + "</div>";
  }
  function ficheVille(s, villeId) {
    var d = D(), v = d.villes.filter(function (x) { return x.id === villeId; })[0], tv = d.typesVilles[v.type];
    var Sim = TMI.Sim, parReg = Sim.magasinsParRegion(s), nReg = parReg[v.region] || 0;
    var h = "<div><h2>" + esc(v.nom) + '</h2><p class="sous">' + esc(d.regions[v.region] || "") + " · " + esc(tv.nom) + "</p></div>";
    h += '<div class="chiffres">' +
      '<div class="chiffre"><span>Loyer petit local</span><b>' + euros(v.loyer) + "</b></div>" +
      '<div class="chiffre"><span>Clients par jour</span><b>≈ ' + tv.clientsParJour + "</b></div>" +
      '<div class="chiffre"><span>Concurrence</span><b>' + Math.round(tv.concurrence * 100) + " %</b></div>" +
      '<div class="chiffre"><span>Clientèle</span><b>' + esc(d.profilsClients[v.profil].nom) + "</b></div>" +
      "</div>";
    var co = Sim.conditionsOuverture(s, villeId);
    h += "<h3>Ouvrir un magasin ici</h3>";
    h += '<table class="bilan"><tbody>' +
      "<tr><td>Dépôt de garantie (" + d.config.locaux.petit.depotMoisLoyer + " mois)</td><td>" + euros(co.cout.depot) + "</td></tr>" +
      "<tr><td>Aménagement du petit local</td><td>" + euros(co.cout.amenagement) + "</td></tr>" +
      "<tr><td>Premier loyer et charges</td><td>" + euros(co.cout.premierLoyer) + "</td></tr>" +
      (co.cout.frais ? "<tr><td>Frais d'ouverture (recrutement, enseigne)</td><td>" + euros(co.cout.frais) + "</td></tr>" : "") +
      '<tr class="total"><td>À payer à l\'ouverture</td><td>' + euros(co.cout.total) + "</td></tr></tbody></table>";
    h += '<p class="aide">Prévois aussi environ ' + euros(co.stockConseille) + " de stock et les salaires d'une nouvelle équipe. La trésorerie est commune à tous tes magasins." +
      (nReg ? " Tu as déjà " + nReg + " magasin" + (nReg > 1 ? "s" : "") + " en " + esc(d.regions[v.region]) + " (palier 2 à " + d.config.paliers[2].magasinsRegion + ")." : "") + "</p>";
    if (co.ok) h += '<button class="bouton principal" data-fiche="ouvrir" data-ville="' + v.id + '">Ouvrir un magasin à ' + esc(v.nom) + " · " + euros(co.cout.total) + "</button>";
    else h += '<ul class="alertes">' + co.raisons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
    if ((s.palier || 1) >= 3) {
      Sim.initLog(s);
      var ent = s.entrepots[v.region], E = d.config.logistique.entrepot;
      h += "<h3>Entrepôt " + esc(d.regions[v.region]) + "</h3>";
      if (ent) h += '<p class="aide">Ton entrepôt de la région est à ' + esc(Sim.villeParId(ent.villeId).nom) + '. <button class="lien" data-fiche="logistique">Voir la logistique</button></p>';
      else h += '<p class="aide">Un entrepôt achète en gros (−' + Math.round(E.remiseGros * 100) + " % dès " + E.minGros + " unités), stocke jusqu'à " + E.capacite + " unités et livre tes magasins avec ta flotte. Loyer " + euros(E.loyer + E.charges) + " par mois.</p>" +
        '<button class="bouton principal" data-fiche="entrepot" data-region="' + v.region + '" data-ville="' + v.id + '">Construire l\'entrepôt ici · ' + euros(E.amenagement + E.loyer + E.charges) + "</button>";
    }
    h += '<button class="bouton" data-fiche="retour">Revenir à mes magasins</button>';
    return h;
  }

  // ------------------------------------------------------------ Logistique (fiche de la carte, palier 3)
  function logistique(s) {
    var Sim = TMI.Sim, d = D(), L = d.config.logistique, E = L.entrepot, h = "";
    Sim.initLog(s);
    h += '<div><h2>Logistique</h2><p class="sous">Entrepôts régionaux et flotte de l\'enseigne</p></div>';
    h += '<p class="aide">Achète en gros à l\'entrepôt (−' + Math.round(E.remiseGros * 100) + " % dès " + E.minGros + " unités), puis envoie le stock à tes magasins. Une camionnette livre dans la région de l'entrepôt le lendemain ; un camion va partout (2 jours hors de la région). Loyers et entretien sont prélevés chaque début de mois.</p>";
    // Flotte
    h += "<h3>Flotte</h3>";
    if (!s.vehicules.length) h += '<p class="aide">Aucun véhicule : sans flotte, l\'entrepôt ne peut rien livrer.</p>';
    else {
      h += '<div class="liste">';
      s.vehicules.forEach(function (v) {
        var V = L.vehicules[v.type], panne = v.panneJusqu != null && v.panneJusqu >= s.jour, charge = v.chargeJour === s.jour ? v.charge : 0;
        h += '<div class="ligne"><div><div class="titre">' + esc(v.nom) + (panne ? ' <span class="etat danger">en panne</span>' : ' <span class="etat bon">disponible</span>') + "</div>" +
          '<div class="detail">' + V.capacite + " unités par jour · chargé aujourd'hui " + charge + " / " + V.capacite + (panne ? " · réparé le jour " + (v.panneJusqu + 2) : "") + " · entretien " + euros(V.entretien) + "/mois</div></div>" +
          '<div class="droite"><button class="bouton petit" data-fiche="vendre" data-id="' + v.id + '">Revendre ' + euros(V.prix * L.revente) + "</button></div></div>";
      });
      h += "</div>";
    }
    h += '<div class="boutons-ligne">' + Object.keys(L.vehicules).map(function (k) {
      var V = L.vehicules[k];
      return '<button class="bouton petit" data-fiche="vehicule" data-type="' + k + '" title="' + esc(V.texte) + '"' + (V.prix > s.argent ? " disabled" : "") + ">+ " + esc(V.nom) + " · " + euros(V.prix) + "</button>";
    }).join("") + "</div>";
    // Entrepôts
    var regs = Object.keys(s.entrepots);
    h += "<h3>Entrepôts</h3>";
    if (!regs.length) h += '<p class="aide">Aucun entrepôt. Touche une ville sur la carte pour construire celui de sa région (' + euros(E.amenagement) + " d'aménagement).</p>";
    var options = Sim.catalogue().liste.filter(function (p) { return Sim.disponible(s, p); }).map(function (p) { return '<option value="' + p.id + '">' + esc(p.nom) + " · " + euros(Sim.prixGros(s, p, E.minGros)) + " en gros</option>"; }).join("");
    regs.forEach(function (reg) {
      var e = s.entrepots[reg], occ = Sim.unitesEntrepot(e);
      h += '<div class="carte entrepot"><div class="entete"><div><div class="titre"><b>' + esc(d.regions[reg]) + '</b></div><span class="aide">à ' + esc(Sim.villeParId(e.villeId).nom) + " · " + occ + " / " + E.capacite + " unités</span></div></div>";
      h += '<div class="gros"><select data-role="prod" aria-label="Produit">' + options + '</select><input type="number" min="1" max="999" value="' + E.minGros + '" data-role="qte" aria-label="Quantité"><button class="bouton petit principal" data-fiche="gros" data-region="' + reg + '">Acheter en gros</button></div>';
      if (e.commandes.length) h += '<p class="aide">En route vers l\'entrepôt : ' + e.commandes.map(function (c) { return c.qte + " × " + esc(Sim.produit(c.prodId).nom) + " (jour " + (c.arrivee + 1) + ")"; }).join(", ") + ".</p>";
      var ids = Object.keys(e.stock).filter(function (k) { return e.stock[k] > 0; });
      if (!ids.length) h += '<p class="aide">Stock vide.</p>';
      else {
        var dest = s.magasins.map(function (m, i) {
          var mg = Sim.magasin(s, i), memeR = Sim.regionDe(s, i) === reg;
          return '<option value="' + i + '"' + (i === s.actif ? " selected" : "") + ">" + esc(Sim.villeParId(mg.villeId).nom) + (memeR ? " · 1 j" : " · 2 j, camion") + "</option>";
        }).join("");
        h += '<div class="liste">';
        ids.forEach(function (pid) {
          h += '<div class="ligne"><div><div class="titre">' + icone(Sim.produit(pid)) + esc(Sim.produit(pid).nom) + '</div><div class="detail">Stock <b>' + e.stock[pid] + "</b> · coût moyen " + euros(Sim.coutEntrepot(e, pid)) + "</div></div>" +
            '<div class="droite envoi"><input type="number" min="1" max="' + e.stock[pid] + '" value="' + Math.min(10, e.stock[pid]) + '" data-role="qte" aria-label="Quantité"><select data-role="dest" aria-label="Magasin">' + dest + '</select><button class="bouton petit" data-fiche="envoyer" data-region="' + reg + '" data-prod="' + pid + '">Envoyer</button></div></div>';
        });
        h += "</div>";
      }
      h += "</div>";
    });
    if (s.transferts.length) {
      h += "<h3>Livraisons en route vers les magasins</h3><div class=\"liste\">";
      s.transferts.forEach(function (x) {
        h += '<div class="ligne"><span>' + icone(Sim.produit(x.prodId)) + x.qte + " × " + esc(Sim.produit(x.prodId).nom) + " → " + esc(Sim.villeParId(Sim.magasin(s, x.vers).villeId).nom) + '</span><span class="etat">jour ' + (x.arrivee + 1) + "</span></div>";
      });
      h += "</div>";
    }
    h += '<p class="aide">Places libres aujourd\'hui : ' + Sim.capaciteDispo(s, true) + " dans la région d'un entrepôt, " + Sim.capaciteDispo(s, false) + " hors région.</p>";
    h += '<button class="bouton" data-fiche="retour">Revenir à mes magasins</button>';
    return h;
  }

  // ------------------------------------------------------------ « À faire » : ce qui demande l'attention, dans tous les magasins
  // Chaque point : { i (magasin), niveau (danger | alerte | info), texte, piece, onglet }
  function alertesEnseigne(s) {
    var Sim = TMI.Sim, d = D(), r = [];
    if (s.argent < 5000) r.push({ i: s.actif, niveau: "danger", texte: "Trésorerie basse : " + euros(s.argent) + ". Surveille le bilan avant la fin du mois.", piece: "bureau", onglet: "bilan", enseigne: true });
    s.magasins.forEach(function (x, i) {
      var m = Sim.vueMagasin(s, i), P = Sim.aUnResponsable(m) ? Sim.reglagesPilotage(m) : null, nom = Sim.ville(m).nom;
      var add = function (niveau, texte, piece, onglet) { r.push({ i: i, ville: nom, niveau: niveau, texte: texte, piece: piece, onglet: onglet }); };
      if (Sim.ferme(m)) { add("info", "Déménagement en cours, réouverture le jour " + (m.fermeJusqu + 2) + ".", "bureau", "local"); return; }
      if (!(P && P.embauches)) {
        var vend = m.employes.some(function (e) { return e.poste === "vendeur"; }), caiss = m.employes.some(function (e) { return e.poste === "caissier"; });
        if (!vend || !caiss) add("danger", "Il manque " + (!vend && !caiss ? "un vendeur et un caissier" : !vend ? "un vendeur" : "un caissier") + ".", "bureau", "personnel");
      }
      if (!(P && P.reassort)) {
        var enRoute = function (pid) { return m.commandes.some(function (c) { return c.prodId === pid && !c.pourJob; }); };
        var vides = m.rayons.filter(function (pid) { return pid && !(m.stock[pid] > 0) && !enRoute(pid); });
        var libres = m.rayons.filter(function (pid) { return !pid; }).length;
        var bas = m.rayons.filter(function (pid) { return pid && m.stock[pid] > 0 && m.stock[pid] <= 2 && !enRoute(pid); });
        if (vides.length) add("danger", vides.length + " rayon" + (vides.length > 1 ? "s vides" : " vide") + " sans commande en route.", "reserve", "commandes");
        if (bas.length) add("alerte", bas.length + " produit" + (bas.length > 1 ? "s" : "") + " presque épuisé" + (bas.length > 1 ? "s" : "") + " en rayon.", "reserve", "commandes");
        if (libres) add("info", libres + " emplacement" + (libres > 1 ? "s libres" : " libre") + " dans le magasin.", "magasin", "rayons");
      }
      var dems = m.atelier.demandes.length;
      if (dems && !(P && P.atelier)) add("alerte", dems + " demande" + (dems > 1 ? "s" : "") + " de PC sur mesure attend" + (dems > 1 ? "ent" : "") + " ta réponse.", "magasin", "atelier");
      var retards = m.atelier.travaux.filter(function (j) { return j.echeance < s.jour; }).length;
      if (retards) add("alerte", retards + " travail" + (retards > 1 ? "x" : "") + " d'atelier en retard.", "magasin", "atelier");
      if (m.mois.horsCapacite >= 15) add("info", m.mois.horsCapacite + " clients refoulés ce mois : le local est plein.", "bureau", "local");
    });
    var ordre = { danger: 0, alerte: 1, info: 2 };
    return r.sort(function (a, b) { return ordre[a.niveau] - ordre[b.niveau]; });
  }

  TMI.Panneaux = { icone: icone, deco: deco, alertesEnseigne: alertesEnseigne, logistique: logistique, ficheBoutique: ficheBoutique, ficheVille: ficheVille, rayons: rayons, stock: stock, commandes: commandes, local: local, effetsEvenement: effetsEvenement, prix: prix, personnel: personnel, bilan: bilan, journal: journal,
    atelier: atelier, resumeCompo: resumeCompo, compoInitiale: compoInitiale, pub: pub, estimationTexte: estimationTexte, euros: euros, signe: signe, esc: esc };
})(window);
