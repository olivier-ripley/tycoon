// Point d'entrée : écrans, boucle de temps, actions du joueur.
(function (root) {
  "use strict";
  var TMI = root.TMI, Sim = TMI.Sim, P = TMI.Panneaux, Save = TMI.Sauvegarde;
  var DATA = root.TMI_DATA, CFG = DATA.config, Compte = TMI.Compte || { dispo: function () { return false; }, utilisateur: function () { return null; } };
  var $ = function (sel) { return document.querySelector(sel); };

  var dernierTuto = 0, tuto = null;
  var etat = null, emplacement = 1, vitesse = 0, vitessePrecedente = 1;
  var modeVue = "carte", carte = null, villeVue = null, derniereFiche = 0, ficheIdx = null, ficheMode = null;
  var onglet = "rayons", vue = null, reste = 0, dernier = 0, derniereVue = 0, dernierPanneau = 0;
  var ui = nouvelleUi();
  var np = { ville: null, difficulte: "normal" };

  // Les trois pièces et leurs écrans de gestion
  var PIECES = {
    magasin: { nom: "Magasin", onglets: ["rayons", "prix", "atelier", "deco"] },
    reserve: { nom: "Réserve", onglets: ["stock", "commandes"] },
    bureau: { nom: "Bureau", onglets: ["bilan", "personnel", "pub", "local", "journal"] }
  };
  function nouvelleUi() {
    return { rayonChoisi: null, filtreStock: "tout", quantites: {}, produitVise: null, categorieVisee: null, piece: "magasin", ongletPiece: {} };
  }

  // ------------------------------------------------------------ Écrans
  function montrer(id) {
    ["ecran-accueil", "ecran-nouvelle", "ecran-jeu", "ecran-compte"].forEach(function (e) { document.getElementById(e).hidden = e !== id; });
  }

  // Résumé d'une partie (accueil et sauvegarde en ligne)
  function resumePartie(s) {
    var v = Sim.ville(s), d = Sim.infosDate(s);
    return (v ? v.nom : "?") + " · " + (s.fin ? "partie terminée (faillite) · " : "") + (s.victoire ? "Leader national · " : "") + "Mois " + d.mois + ", jour " + d.jourDuMois +
      (s.magasins && s.magasins.length > 1 ? " · " + s.magasins.length + " magasins" : "") + " · " + P.euros(s.argent) + " · " + CFG.difficultes[s.difficulte].nom;
  }
  function dateCourte(t) { return new Date(t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }); }

  // ------------------------------------------------------------ Accueil : sauvegardes locales ou du compte
  var nuage = null, nuageErreur = null;      // emplacements en ligne { n: { resume, maj } }
  function accueil() {
    fileModales.length = 0;
    etat = null; vitesse = 0;
    montrer("ecran-accueil");
    nuage = null; nuageErreur = null;
    afficherAccueil();
    if (Compte.utilisateur()) {
      Compte.liste().then(function (r) {
        if (!$("#ecran-jeu").hidden || !Compte.utilisateur()) return;
        if (!r.ok) { nuageErreur = r.raison; nuage = {}; }
        else { nuage = {}; r.data.forEach(function (x) { nuage[x.emplacement] = { resume: x.resume, maj: Date.parse(x.maj) }; }); }
        afficherAccueil();
      });
    }
  }
  function blocCompte() {
    if (!Compte.dispo()) return "";
    var u = Compte.utilisateur();
    if (!u) {
      return '<div class="compte invite"><div><b>Tu joues en invité</b><span>Tes parties restent sur cet appareil.</span></div>' +
        '<div class="boutons"><button class="bouton" data-compte="connexion">Se connecter</button><button class="bouton" data-compte="inscription">Créer un compte</button></div></div>';
    }
    var h = '<div class="compte connecte"><div><b>Connecté · ' + P.esc(u.email || "") + "</b><span>" +
      (nuageErreur ? '<span class="negatif">Sauvegarde en ligne indisponible : ' + P.esc(nuageErreur) + "</span>" : nuage ? "Tes parties sont sauvegardées en ligne." : "Chargement de tes parties en ligne…") +
      '</span></div><div class="boutons"><button class="bouton" data-compte="deconnexion">Se déconnecter</button><button class="lien" data-compte="supprimer-compte">Supprimer mon compte</button></div></div>';
    var invites = Save.liste("invite").filter(function (e) { return e.contenu; });
    if (invites.length && nuage) {
      h += '<div class="compte transfert"><div><b>' + invites.length + " partie" + (invites.length > 1 ? "s jouées" : " jouée") + " en invité sur cet appareil</b><span>Ajoute-" + (invites.length > 1 ? "les" : "la") + " à ton compte pour " + (invites.length > 1 ? "les" : "la") + " retrouver partout.</span></div>" +
        '<div class="boutons"><button class="bouton principal" data-compte="transferer">Ajouter à mon compte</button></div></div>';
    }
    return h;
  }
  // Contenu d'un emplacement : la plus récente entre la copie locale et la sauvegarde en ligne
  function contenuEmplacement(e) {
    var c = e.contenu, n = nuage && nuage[e.emplacement];
    if (n && (!c || n.maj > c.date + 1000)) return { resume: n.resume, date: n.maj, enLigne: true };
    if (c) return { resume: resumePartie(c.etat), date: c.date, fin: c.etat.fin, local: true };
    return null;
  }
  function afficherAccueil() {
    $("#bloc-compte").innerHTML = blocCompte();
    var h = "", connecte = !!Compte.utilisateur();
    Save.liste().forEach(function (e) {
      var c = contenuEmplacement(e);
      if (!c && connecte && !nuage) {
        h += '<div class="emplacement"><div class="infos"><b>Emplacement ' + e.emplacement + '</b><span class="discret">Chargement…</span></div></div>';
        return;
      }
      if (!c) {
        h += '<button class="emplacement vide" data-nouvelle="' + e.emplacement + '"><span class="plus" aria-hidden="true">+</span>' +
          '<span class="infos"><b>Ouvrir une nouvelle boutique</b><span>Emplacement ' + e.emplacement + " libre</span></span></button>";
        return;
      }
      // Le résumé « Ville · … · 27 650 € · Facile » est découpé : la ville en titre, l'argent à part
      var fin = c.fin || /partie terminée/.test(c.resume || "");
      var parts = (c.resume || "").split(" · "), ville = parts[0] || "Partie", argent = parts.filter(function (p) { return /€/.test(p); })[0] || "";
      var details = parts.slice(1).filter(function (p) { return p !== argent; }).join(" · ");
      var teinteVille = ville.split("").reduce(function (a, ch) { return (a * 31 + ch.charCodeAt(0)) % 360; }, 7);
      h += '<div class="emplacement plein' + (fin ? " finie" : "") + '"><span class="vignette" style="--teinte:' + teinteVille + '" aria-hidden="true">' + P.esc(ville.charAt(0)) + "</span>" +
        '<div class="infos"><b>' + P.esc(ville) + "</b><span>" + P.esc(details) + "</span>" +
        '<span class="date">' + (connecte ? '<span class="pastille-nuage" title="Sauvegardée en ligne">☁</span> ' : "") + "Sauvegardé le " + dateCourte(c.date) + "</span></div>" +
        (argent ? '<span class="argent">' + P.esc(argent) + "</span>" : "") +
        '<div class="boutons">' + (fin ? "" : '<button class="bouton principal" data-continuer="' + e.emplacement + '">▶ Continuer</button>') +
        '<button class="bouton-icone" data-supprimer="' + e.emplacement + '" title="Supprimer cette partie" aria-label="Supprimer la partie de l\'emplacement ' + e.emplacement + '">' +
        '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>';
    });
    $("#liste-sauvegardes").innerHTML = h;
  }
  function continuer(n) {
    var e = { emplacement: n, contenu: Save.lire(n) }, c = contenuEmplacement(e);
    if (!c) return;
    if (!c.enLigne) return lancerPartie(e.contenu.etat, n);
    toast("Chargement de ta partie…", "bon");
    Compte.charger(n).then(function (r) {
      if (!r.ok || !r.data) return toast(r.raison || "Sauvegarde introuvable.", "alerte");
      Save.ecrire(n, r.data.donnees, Date.parse(r.data.maj));
      lancerPartie(r.data.donnees, n);
    });
  }
  // Parties jouées en invité → emplacements libres du compte
  function transfererInvite() {
    var invites = Save.liste("invite").filter(function (e) { return e.contenu; });
    var libres = Save.liste().filter(function (e) { return !contenuEmplacement(e); }).map(function (e) { return e.emplacement; });
    if (!libres.length) return toast("Ton compte a déjà 3 parties : supprimes-en une pour faire de la place.", "alerte");
    var faits = 0, travaux = invites.slice(0, libres.length).map(function (e, i) {
      var n = libres[i], st = e.contenu.etat;
      Save.ecrire(n, st, e.contenu.date);
      return Compte.envoyer(n, Save.copie(st), resumePartie(st), true).then(function (r) {
        if (r.ok) { faits++; Save.supprimer(e.emplacement, "invite"); }
        return r;
      });
    });
    Promise.all(travaux).then(function (rs) {
      var err = rs.filter(function (r) { return !r.ok; })[0];
      if (err) toast(err.raison, "alerte");
      if (faits) toast(faits + " partie" + (faits > 1 ? "s ajoutées" : " ajoutée") + " à ton compte.", "bon");
      if (invites.length > libres.length) toast("Il ne restait que " + libres.length + " emplacement" + (libres.length > 1 ? "s" : "") + " libre" + (libres.length > 1 ? "s" : "") + " dans ton compte.", "alerte");
      accueil();
    });
  }

  // ------------------------------------------------------------ Écran de compte
  var modeCompte = "connexion";
  function ecranCompte(mode) {
    modeCompte = mode;
    montrer("ecran-compte");
    var t = {
      connexion: ["Connecte-toi pour retrouver tes parties sur tous tes appareils.", "Se connecter"],
      inscription: ["Crée ton compte : tes parties seront sauvegardées en ligne, sur PC comme sur téléphone.", "Créer mon compte"],
      oublie: ["Indique ton email : tu recevras un lien pour choisir un nouveau mot de passe.", "Envoyer le lien"],
      nouveau: ["Choisis ton nouveau mot de passe.", "Enregistrer"]
    }[mode];
    $("#compte-intro").textContent = t[0];
    $("#compte-valider").textContent = t[1];
    $("#champ-email").hidden = mode === "nouveau";
    $("#champ-mdp").hidden = mode === "oublie";
    $("#champ-mdp2").hidden = mode !== "inscription" && mode !== "nouveau";
    $("#compte-mdp").autocomplete = mode === "connexion" ? "current-password" : "new-password";
    $("#lien-oublie").hidden = mode !== "connexion";
    $("#compte-message").textContent = ""; $("#compte-message").className = "message-compte";
    document.querySelectorAll(".onglets-compte button").forEach(function (b) { b.classList.toggle("actif", b.dataset.mode === mode); });
    $(".onglets-compte").hidden = mode === "nouveau" || mode === "oublie";
    setTimeout(function () { var f = mode === "nouveau" ? $("#compte-mdp") : $("#compte-email"); if (f && window.innerWidth >= 900) f.focus(); }, 50);
  }
  function messageCompte(t, bon) { var m = $("#compte-message"); m.textContent = t; m.className = "message-compte " + (bon ? "bon" : "erreur"); }
  function validerCompte(ev) {
    ev.preventDefault();
    var email = $("#compte-email").value.trim(), mdp = $("#compte-mdp").value, mdp2 = $("#compte-mdp2").value, bouton = $("#compte-valider");
    if (modeCompte !== "nouveau" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return messageCompte("Entre une adresse email valide.");
    if (modeCompte !== "oublie" && mdp.length < 6) return messageCompte("Le mot de passe doit faire au moins 6 caractères.");
    if ((modeCompte === "inscription" || modeCompte === "nouveau") && mdp !== mdp2) return messageCompte("Les deux mots de passe ne sont pas identiques.");
    bouton.disabled = true; messageCompte("Un instant…", true);
    var fin = function () { bouton.disabled = false; };
    var p = modeCompte === "connexion" ? Compte.connecter(email, mdp)
      : modeCompte === "inscription" ? Compte.inscrire(email, mdp)
      : modeCompte === "oublie" ? Compte.oublie(email) : Compte.nouveauMdp(mdp);
    p.then(function (r) {
      fin();
      if (!r.ok) {
        messageCompte(r.raison);
        if (/Confirme d'abord ton email/.test(r.raison)) {
          var m = $("#compte-message"), bt = document.createElement("button");
          bt.type = "button"; bt.className = "lien"; bt.textContent = "Renvoyer l'email de confirmation";
          bt.addEventListener("click", function () { Compte.renvoyer(email).then(function (x) { messageCompte(x.ok ? "Nouvel email envoyé à " + email + "." : x.raison, x.ok); }); });
          m.appendChild(document.createElement("br")); m.appendChild(bt);
        }
        return;
      }
      $("#compte-mdp").value = ""; $("#compte-mdp2").value = "";
      if (modeCompte === "inscription" && r.confirmer) return messageCompte("Compte créé ! Clique sur le lien envoyé à " + email + " pour le confirmer (regarde aussi dans les spams), puis connecte-toi.", true);
      if (modeCompte === "oublie") return messageCompte("Si un compte existe avec cet email, un lien vient d'y être envoyé.", true);
      toast(modeCompte === "nouveau" ? "Mot de passe modifié." : "Bienvenue !", "bon");
      accueil();
    }, function (e) { fin(); messageCompte(String(e)); });
  }
  function brancherCompte() {
    $("#bloc-compte").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-compte]"); if (!b) return;
      var a = b.dataset.compte;
      if (a === "connexion" || a === "inscription") ecranCompte(a);
      if (a === "deconnexion") Compte.deconnecter().then(function () { toast("Tu es déconnecté. Tes parties restent dans ton compte.", "bon"); accueil(); });
      if (a === "transferer") transfererInvite();
      if (a === "supprimer-compte") confirmer("Supprimer ton compte ?", "Ton compte et toutes tes sauvegardes en ligne seront effacés définitivement.", "Supprimer mon compte", function () {
        Compte.supprimerCompte().then(function (r) {
          if (!r.ok) return toast(r.raison, "alerte");
          toast("Ton compte a été supprimé.", "bon"); accueil();
        });
      });
    });
    $("#ecran-compte").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      if (b.dataset.mode) ecranCompte(b.dataset.mode);
      if (b.dataset.compte === "retour") { if (modeCompte === "oublie") ecranCompte("connexion"); else accueil(); }
      if (b.dataset.compte === "oublie") ecranCompte("oublie");
    });
    $("#form-compte").addEventListener("submit", validerCompte);
    Compte.init(function (evt) {
      if (evt === "PASSWORD_RECOVERY") { if (!etat) ecranCompte("nouveau"); return; }
      if ((evt === "SIGNED_IN" || evt === "SIGNED_OUT") && !etat && !$("#ecran-accueil").hidden) accueil();
    }).then(function (u) {
      var l = Compte.lien();
      if (l && l.erreur) {
        ouvrirModal("<h2>Le lien n'a pas fonctionné</h2><p>" + P.esc(l.erreur) + "</p>", [
          { texte: "Fermer" }, { texte: "Me connecter", style: "principal", action: function () { ecranCompte("connexion"); } }]);
      } else if (l && u && l.type !== "recovery") {
        toast(l.type === "signup" ? "Email confirmé : bienvenue, ton compte est prêt !" : "Tu es connecté.", "bon");
      }
      if (!etat && !$("#ecran-accueil").hidden) accueil();
    });
  }

  function ecranNouvelle(n) {
    emplacement = n; np.ville = null;
    montrer("ecran-nouvelle");
    $("#np-emplacement").textContent = "· emplacement " + n;
    var h = "", ordre = ["paris", "grande", "moyenne", "petite"];
    ordre.forEach(function (type) {
      var tv = DATA.typesVilles[type];
      h += '<div class="groupe-villes">' + P.esc(tv.nom) + " · environ " + tv.clientsParJour + " clients/jour · concurrence " + Math.round(tv.concurrence * 100) + " %</div>";
      DATA.villes.filter(function (v) { return v.type === type; }).forEach(function (v) {
        h += '<button class="ville" data-ville="' + v.id + '"><strong>' + P.esc(v.nom) + "</strong><span>" + P.esc(DATA.regions[v.region] || "") + "</span><span>Loyer " + P.euros(v.loyer) + " / mois</span><span>Clientèle : " + P.esc(DATA.profilsClients[v.profil].nom.toLowerCase()) + "</span></button>";
      });
    });
    $("#np-villes").innerHTML = h;
    h = "";
    Object.keys(CFG.difficultes).forEach(function (k) {
      var d = CFG.difficultes[k];
      h += '<button class="diff' + (np.difficulte === k ? " choisie" : "") + '" data-diff="' + k + '"><strong>' + d.nom + "</strong><span>Budget " + P.euros(d.budget) + "</span><span>" +
        (d.faillite === "pret" ? "Prêt bancaire en cas de faillite" : "Faillite = fin de partie") + (d.concurrence > 0 ? " · concurrence plus forte" : d.concurrence < 0 ? " · concurrence plus faible" : "") + "</span></button>";
    });
    $("#np-difficultes").innerHTML = h;
    majResumeNouvelle();
  }
  function majResumeNouvelle() {
    document.querySelectorAll(".ville").forEach(function (b) { b.classList.toggle("choisie", b.dataset.ville === np.ville); });
    document.querySelectorAll(".diff").forEach(function (b) { b.classList.toggle("choisie", b.dataset.diff === np.difficulte); });
    var bouton = $("#np-lancer");
    bouton.disabled = !np.ville;
    if (!np.ville) { $("#np-resume").textContent = "Choisis une ville."; return; }
    var v = DATA.villes.filter(function (x) { return x.id === np.ville; })[0], loc = CFG.locaux.petit;
    var depart = CFG.difficultes[np.difficulte].budget - v.loyer * loc.depotMoisLoyer - loc.amenagement - v.loyer - loc.charges;
    if (depart < (CFG.departMinimum || 3000)) {
      bouton.disabled = true;
      $("#np-resume").textContent = v.nom + " · budget trop juste en " + CFG.difficultes[np.difficulte].nom.toLowerCase() + " : il resterait " + P.euros(depart) + " après dépôt, aménagement et premier loyer, alors qu’il faut environ " + P.euros(CFG.departMinimum || 3000) + " pour le premier stock. Choisis une autre ville ou une difficulté plus basse.";
      return;
    }
    $("#np-resume").textContent = v.nom + " · après dépôt, aménagement et premier loyer, il te restera " + P.euros(depart) + ".";
  }

  function lancerPartie(s, n) {
    s.evenements = s.evenements || [];
    var migre = !s.atelier, migreRep = s.atelier && !s.atelier.tarifs, migrePub = !s.pubs;
    Sim.migrer(s);
    etat = s; emplacement = n; vitesse = 0; reste = 0;
    ui = nouvelleUi();
    montrer("ecran-jeu");
    if (!vue) vue = creerVue({
      surRayon: function (i) {
        ui.rayonChoisi = i; allerPiece("magasin", "rayons");
        setTimeout(function () { var c = document.getElementById("case-rayon-" + i); if (c) c.scrollIntoView({ block: "nearest" }); }, 0);
      },
      surDeco: function (id) {
        if (ui.pose) return;
        ui.decoChoisi = id; if (vue.choisirDeco) vue.choisirDeco(id);
        allerPiece("magasin", "deco");
      },
      surPose: majBarreDeco,
      surPoser: function () { validerPose(); },
      surCible: function (c) {
        ui.categorieVisee = c.cat || null;
        allerPiece(c.piece, c.onglet);
        if (c.cat) setTimeout(function () { var t = document.getElementById("inv-" + c.cat); if (t) t.scrollIntoView({ block: "start" }); }, 0);
      }
    });
    else vue.vider();
    Sim.vider(etat);
    // Nouvelle boutique : on commence au bureau pour embaucher
    if (etat.stats.ventes === 0 && !etat.employes.length) allerPiece("bureau", "personnel");
    else allerPiece("magasin", "rayons");
    if (!carte) carte = new TMI.VueCarte($("#carte"), {
      surBoutique: function (i) { changerMagasin(i); montrerVue("magasin"); },
      surVille: function (id) { villeVue = id; ficheIdx = null; if (id) ficheMode = null; majFiche(true); },
      surEntrepot: function () { villeVue = null; ficheMode = "logistique"; carte.choisir(null); }
    });
    carte.construire(etat);
    majVitesse(0);
    montrerVue("carte");
    majBarre();
    sauver();
    if (migre) modalAtelier();
    else if (migreRep) modalReparations();
    if (migrePub) setTimeout(function () { toast("Nouveau : l'onglet Pub du bureau permet de lancer des campagnes de publicité.", "bon"); }, 400);
  }

  // Carte de France <-> gestion du magasin
  function montrerVue(mode) {
    if (mode !== "magasin") annulerPose();
    modeVue = mode;
    $("#vue-carte").hidden = mode !== "carte";
    $("#vue-magasin").hidden = mode !== "magasin";
    $("#b-vue").hidden = mode !== "magasin";
    if (mode === "carte") { carte.maj(etat); carte.choisir(null); }
    else { vue.maj(etat); rafraichirPanneau(true); }
  }
  function majFiche(force) {
    if (!etat) return;
    var f = $("#fiche"), actif = document.activeElement;
    if (!force && actif && f.contains(actif) && /INPUT|SELECT/.test(actif.tagName)) return;   // ne pas effacer une saisie en cours
    var haut = f.scrollTop;
    f.innerHTML = villeVue ? P.ficheVille(etat, villeVue) : ficheMode === "logistique" ? P.logistique(etat) : P.ficheBoutique(etat, ficheIdx == null ? etat.actif : ficheIdx);
    f.scrollTop = haut;
  }
  // Passer d'un magasin à l'autre
  function changerMagasin(i, piece, ongletPiece) {
    if (i == null || i === etat.actif) { if (piece) allerPiece(piece, ongletPiece); return; }
    annulerPose();
    Sim.changerMagasin(etat, i);
    ui = nouvelleUi();
    vue.vider();
    allerPiece(piece || "magasin", ongletPiece || null);
    carte.maj(etat);
    majBarre();
  }

  // ------------------------------------------------------------ Boucle de temps
  function boucle(ts) {
    var dt = dernier ? Math.min(0.25, (ts - dernier) / 1000) : 0;
    dernier = ts;
    if (etat && !etat.fin && vitesse > 0 && $("#modal").hidden) {
      reste += dt * vitesse * CFG.temps.minutesParSecondeX1;
      var n = Math.floor(reste);
      if (n > 0) {
        reste -= n;
        var jourAvant = etat.jour;
        Sim.avancer(etat, n);
        traiterEvenements();
        if (etat && etat.jour !== jourAvant) sauver();
      }
    }
    if (etat && etat.evenements.length && $("#modal").hidden) traiterEvenements();
    if (etat) {
      if (ts - derniereVue > 90) { if (modeVue === "carte") carte.maj(etat); else vue.maj(etat); majBarre(); derniereVue = ts; }
      if (modeVue === "magasin" && ts - dernierPanneau > 800) { rafraichirPanneau(false); dernierPanneau = ts; }
      if (modeVue === "carte" && ts - derniereFiche > 800) { majFiche(); derniereFiche = ts; }
      if (ts - dernierTuto > 150) { tuto.maj(); dernierTuto = ts; }
    } else if (tuto) tuto.cacher();
    requestAnimationFrame(boucle);
  }

  function traiterEvenements() {
    var r = Sim.vider(etat);
    r.evenements.forEach(function (e) {
      if (e.type === "bilan") return modalBilan(e.bilan, e.details);
      if (e.type === "palier") return modalPalier(e);
      if (e.type === "victoire") return modalVictoire();
      if (e.type === "faillite") return modalFaillite();
      if (e.type === "pret") return;
      if (e.type === "deblocage") return modalDeblocage(e);
      if (e.type === "evenement") return modalEvenement(e);
      if (e.type === "atelier") return modalAtelier();
      if (e.type === "reparations") return modalReparations();
      if (e.type === "demande") { if (e.magasin && e.magasin !== etat.villeId) return; if (!(modeVue === "magasin" && onglet === "atelier")) toast(e.texte, ""); return; }
      if (e.magasin && e.magasin !== etat.villeId) return;   // les autres magasins : seulement dans le journal
      if (e.type === "alerte" || e.type === "bon") toast(e.texte, e.type);
    });
  }

  function majVitesse(v) {
    if (v > 0) vitessePrecedente = v;
    vitesse = v;
    document.querySelectorAll(".vitesses button").forEach(function (b) { b.classList.toggle("actif", +b.dataset.vitesse === v); });
    $("#pause-badge").hidden = v !== 0;
    if (v === 0 && etat) sauver();
  }

  function majBarre() {
    var d = Sim.infosDate(etat);
    var court = root.innerWidth < 600, MC = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    $("#b-jour").textContent = court ? d.nomJour.slice(0, 3) + ". " + d.jourDuMois + " " + MC[d.moisCal - 1] + " an " + d.annee
                                     : d.nomJour + " " + d.jourDuMois + " " + d.nomMois + " · an " + d.annee;
    $("#b-heure").textContent = (d.heure < 10 ? "0" : "") + d.heure + "h" + (d.minute < 10 ? "0" : "") + d.minute;
    var bm = $("#b-magasin"), nomM = Sim.ville(etat).nom + (etat.magasins.length > 1 ? " ▾" : "");
    if (bm.textContent !== nomM) bm.textContent = nomM;
    bm.disabled = etat.magasins.length < 2;
    // compteur « À faire » (points urgents et importants)
    var cleAl = etat.jour * 1440 + etat.minuteJour + ":" + etat.actif + ":" + etat.magasins.length, now = Date.now();
    if (majBarre.cle !== cleAl || !majBarre.al || now - (majBarre.quand || 0) > 700) { majBarre.al = P.alertesEnseigne(etat); majBarre.cle = cleAl; majBarre.quand = now; }
    var al = majBarre.al, n = al.filter(function (a) { return a.niveau !== "info"; }).length, cpt = $("#b-afaire-n");
    cpt.hidden = !n; cpt.textContent = n; cpt.classList.toggle("danger", al.some(function (a) { return a.niveau === "danger"; }));
    var a = $("#b-argent"); a.textContent = P.euros(etat.argent); a.classList.toggle("negatif", etat.argent < 0);
    $("#b-rep").textContent = Math.round(etat.reputation);
    $("#b-rep-barre").style.width = etat.reputation + "%";
    // Objectifs à l'écran
    var obj = Sim.objectifsActifs(etat, 3);
    var html = Sim.evenementsActifs(etat).map(function (a) {
      return '<span class="objectif evenement" title="' + P.esc(a.def.texte) + '">' + P.esc(a.def.nom) + " · jusqu'au " + P.esc(Sim.dateTexte(a.fin)) + "</span>";
    }).join("") + obj.map(function (o) { return '<span class="objectif">' + P.esc(o.texte) + "</span>"; }).join("");
    var cont = $("#objectifs");
    if (cont._html !== html) { cont.innerHTML = html; cont._html = html; }
    // Pastilles d'alerte sur les onglets
    var rupture = etat.rayons.some(function (pid) { return pid && !(etat.stock[pid] > 0); }) || !etat.rayons.some(Boolean);
    var atelierAlerte = etat.atelier.demandes.length > 0 || etat.atelier.travaux.some(function (j) { return j.echeance < etat.jour; });
    pastille('[data-onglet="rayons"]', rupture);
    pastille('[data-onglet="atelier"]', atelierAlerte);
    pastille('[data-piece="magasin"]', rupture || atelierAlerte);
    pastille('[data-onglet="personnel"]', !etat.employes.length);
    pastille('[data-piece="bureau"]', !etat.employes.length);
    pastille('[data-piece="reserve"]', !Object.keys(etat.stock).some(function (k) { return etat.stock[k] > 0; }) && !etat.commandes.length);
  }
  function pastille(sel, on) {
    var b = document.querySelector(sel), p = b.querySelector(".pastille");
    if (on && !p) { p = document.createElement("span"); p.className = "pastille"; b.appendChild(p); }
    if (!on && p) p.remove();
  }

  // ------------------------------------------------------------ Pièces et panneau
  function allerPiece(p, o) {
    var def = PIECES[p];
    if (!def) return;
    if (p !== "magasin") annulerPose();
    ui.piece = p;
    if (vue) vue.changerPiece(p);
    document.querySelectorAll("#pieces button").forEach(function (b) {
      var actif = b.dataset.piece === p;
      b.classList.toggle("actif", actif); b.setAttribute("aria-pressed", actif);
    });
    document.querySelectorAll("#onglets button").forEach(function (b) { b.hidden = def.onglets.indexOf(b.dataset.onglet) < 0; });
    if (!o || def.onglets.indexOf(o) < 0) o = ui.ongletPiece[p] || def.onglets[0];
    changerOnglet(o);
  }
  function changerOnglet(o) {
    onglet = o;
    ui.ongletPiece[ui.piece] = o;
    document.querySelectorAll("#onglets button").forEach(function (b) { b.classList.toggle("actif", b.dataset.onglet === o); });
    rafraichirPanneau(true);
    $("#contenu-panneau").scrollTop = 0;
  }
  function rafraichirPanneau(force) {
    var c = $("#contenu-panneau");
    if (!force) {
      var actif = document.activeElement;
      if (actif && c.contains(actif) && /INPUT|SELECT/.test(actif.tagName)) return;
      if (onglet === "journal" && c.scrollTop > 40) return;
    }
    if (ui.compo && !etat.atelier.demandes.some(function (x) { return x.id === ui.compo.demId; })) ui.compo = null;
    var html = P[onglet](etat, ui);
    if (!force && html === c.dernierHtml) return;      // rien n'a changé : on ne recrée pas les boutons (clics plus fiables)
    var haut = c.scrollTop;
    c.innerHTML = html; c.dernierHtml = html;
    c.scrollTop = haut;
  }
  function action(fn) { fn(); rafraichirPanneau(true); vue.maj(etat); majBarre(); traiterEvenements(); }

  function brancherPanneau() {
    var c = $("#contenu-panneau");
    c.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-act]");
      if (!b || b.tagName === "SELECT" || b.tagName === "INPUT") return;
      var id = b.dataset.id;
      switch (b.dataset.act) {
        case "faire-venir":
          var rf = Sim.transferer(etat, Sim.regionDe(etat, etat.actif), etat.actif, id, ui.quantites[id] || 5);
          if (!rf.ok) toast(rf.raison, "alerte"); else toast("Livraison depuis l'entrepôt demain matin.", "bon");
          action(function () {});
          break;
        case "commander":
          var r = Sim.commander(etat, id, ui.quantites[id] || 5);
          if (!r.ok) toast(r.raison, "alerte"); else toast("Commande passée.", "bon");
          action(function () {});
          break;
        case "filtre": ui.filtreStock = b.dataset.f; ui.produitVise = null; rafraichirPanneau(true); break;
        case "aller-stock":
          var p = Sim.produit(id); ui.filtreStock = p.categorie; ui.produitVise = id; allerPiece("reserve", "commandes");
          setTimeout(function () { var l = document.getElementById("ligne-" + id); if (l) l.scrollIntoView({ block: "center" }); }, 0);
          break;
        case "demenager":
          var taille = b.dataset.taille, loc = CFG.locaux[taille], cd = Sim.coutDemenagement(etat, taille);
          confirmer("Déménager vers un " + loc.nom.toLowerCase() + " ?", "Tu paies " + P.euros(cd.total) + " maintenant (dépôt et aménagement, ancien dépôt rendu). La boutique ferme " + CFG.joursDemenagement + " jours, puis le loyer passe à " + P.euros(Sim.loyerLocal(etat, taille)) + " par mois.", "Déménager", function () {
            var r = Sim.demenager(etat, taille);
            if (!r.ok) toast(r.raison, "alerte"); else toast("C'est parti : les cartons sont faits !", "bon");
            action(function () {});
          });
          break;
        case "embaucher": action(function () { Sim.embaucher(etat, id); }); break;
        case "licencier":
          var e = etat.employes.filter(function (x) { return x.id === id; })[0];
          confirmer("Licencier " + e.nom + " ?", "Son salaire du mois reste dû jusqu'à aujourd'hui. Tu pourras embaucher parmi les candidats de la semaine.", "Licencier", function () { action(function () { Sim.licencier(etat, id); }); });
          break;
        case "marge-defaut": action(function () { Sim.fixerMarge(etat, b.dataset.cat, CFG.margesParDefaut[b.dataset.cat]); }); break;
        case "aller-personnel": allerPiece("bureau", "personnel"); break;
        case "pub-duree": ui.pub[b.dataset.type].jours = +b.dataset.j; rafraichirPanneau(true); break;
        case "pub-lancer":
          var fp = ui.pub[b.dataset.type], rp = Sim.lancerPub(etat, b.dataset.type, fp.cible, fp.budget, fp.jours);
          if (!rp.ok) toast(rp.raison, "alerte"); else toast("Campagne lancée : " + P.euros(fp.budget) + " payés.", "bon");
          action(function () {});
          break;
        case "compo-ouvrir":
          var dem = etat.atelier.demandes.filter(function (x) { return x.id === id; })[0];
          if (dem) ui.compo = { demId: id, choix: P.compoInitiale(etat, dem), prix: null };
          rafraichirPanneau(true);
          break;
        case "compo-annuler": ui.compo = null; rafraichirPanneau(true); break;
        case "deco-placer":
          if (DATA.deco.objets[id].prix > etat.argent) { toast("Trésorerie insuffisante : il faut " + P.euros(DATA.deco.objets[id].prix) + ".", "alerte"); break; }
          commencerPose({ type: id, rot: 0 });
          break;
        case "deco-sol": case "deco-murs":
          var genre = b.dataset.act === "deco-sol" ? "sol" : "murs", rv = DATA.deco[genre === "sol" ? "sols" : "murs"][id];
          var faire = function () { var rr = Sim.choisirRevetement(etat, genre, id); if (!rr.ok) toast(rr.raison, "alerte"); else toast(rv.nom + " : c'est fait !", "bon"); action(function () {}); sauver(); };
          if (rv.prix) confirmer((genre === "sol" ? "Nouveau sol : " : "Nouveaux murs : ") + rv.nom + " ?", "Travaux : " + P.euros(rv.prix) + ". L'ancien revêtement n'est pas remboursé.", "Faire les travaux", faire);
          else faire();
          break;
        case "deco-deplacer":
          var od = Sim.deco(etat).objets.filter(function (x) { return x.id === id; })[0];
          if (od) commencerPose({ type: od.type, id: od.id, x: od.x, y: od.y, rot: od.rot, mur: od.mur });
          break;
        case "deco-tourner":
          var ot = Sim.deco(etat).objets.filter(function (x) { return x.id === id; })[0];
          if (ot) { var rt = Sim.deplacerDeco(etat, id, ot.x, ot.y, (ot.rot + 1) % 4); if (!rt.ok) toast("Pas la place de le tourner ici : déplace-le.", "alerte"); action(function () {}); }
          break;
        case "deco-vendre":
          var ov = Sim.deco(etat).objets.filter(function (x) { return x.id === id; })[0], dv = ov && DATA.deco.objets[ov.type];
          if (ov) confirmer("Revendre " + dv.nom.toLowerCase() + " ?", "Tu récupères " + P.euros(dv.prix * DATA.deco.revente) + ".", "Revendre", function () {
            var rv2 = Sim.vendreDeco(etat, id); ui.decoChoisi = null; if (vue.choisirDeco) vue.choisirDeco(null);
            if (rv2.ok) toast("Revendu " + P.euros(rv2.gain) + ".", "bon"); action(function () {}); sauver();
          });
          break;
        case "deco-fermer": ui.decoChoisi = null; if (vue.choisirDeco) vue.choisirDeco(null); rafraichirPanneau(true); break;
        case "compo-prix-auto": ui.compo.prix = null; rafraichirPanneau(true); break;
        case "decliner": ui.compo = null; action(function () { Sim.refuserDemande(etat, id); }); break;
        case "compo-proposer":
          var cp = ui.compo; if (!cp) break;
          var ev = Sim.evaluerMontage(etat, cp.demId, cp.choix, cp.prix);
          var res = Sim.proposerMontage(etat, cp.demId, cp.choix, cp.prix != null ? cp.prix : ev.suggere);
          if (!res.ok) toast(res.raison, "alerte");
          else if (res.accepte) {
            ui.compo = null;
            toast("Le client accepte ! " + (res.job.attente.length ? res.job.attente.length + " pièce" + (res.job.attente.length > 1 ? "s commandées" : " commandée") + " pour ce PC, le montage commencera à la livraison." : "Le technicien peut commencer le montage."), "bon");
          }
          else { toast(res.raison + (res.parti ? " Le client s'en va." : " Il attend une autre proposition."), "alerte"); if (res.parti) ui.compo = null; }
          action(function () {});
          break;
      }
    });
    c.addEventListener("change", function (ev) {
      var t = ev.target;
      switch (t.dataset.act) {
        case "placer": action(function () { Sim.placerRayon(etat, +t.dataset.i, t.value || null); ui.rayonChoisi = +t.dataset.i; }); t.blur(); break;
        case "prix": action(function () { Sim.fixerPrix(etat, t.dataset.id, t.value === "" ? null : +t.value); }); break;
        case "marge": t.blur(); action(function () {}); break;
        case "pilote": action(function () { Sim.reglerPilotage(etat, t.dataset.cle, t.checked); }); break;
        case "pilote-cible": action(function () { Sim.reglerPilotage(etat, "cible", t.value); }); break;
        case "pub-cible": ui.pub[t.dataset.type].cible = t.value; t.blur(); rafraichirPanneau(true); break;
        case "rep-ouvert": action(function () { Sim.ouvrirReparation(etat, t.dataset.type, t.checked); }); break;
        case "rep-limite": action(function () { Sim.fixerLimiteFile(etat, +t.value); }); t.blur(); break;
        case "compo-piece": if (ui.compo) { ui.compo.choix[t.dataset.comp] = t.value || undefined; } t.blur(); rafraichirPanneau(true); break;
      }
    });
    c.addEventListener("input", function (ev) {
      var t = ev.target;
      if (t.dataset.act === "qte") {
        var q = Math.max(1, Math.min(99, Math.floor(+t.value || 1)));
        ui.quantites[t.dataset.id] = q;
        var bouton = t.parentNode.querySelector('[data-act="commander"]'), p = Sim.produit(t.dataset.id);
        var ca = Sim.coutAchat(etat, p);
        bouton.textContent = P.euros(ca * q); bouton.disabled = ca * q > etat.argent;
      } else if (t.dataset.act === "pub-budget") {
        if (t.value !== "") { ui.pub[t.dataset.type].budget = Math.max(1, Math.round(+t.value)); var ep = document.getElementById("pub-est-" + t.dataset.type); if (ep) ep.innerHTML = P.estimationTexte(etat, t.dataset.type, ui.pub[t.dataset.type]); }
      } else if (t.dataset.act === "rep-tarif") {
        if (t.value !== "") Sim.fixerTarif(etat, t.dataset.type, t.value);
      } else if (t.dataset.act === "compo-prix") {
        if (ui.compo) { ui.compo.prix = t.value === "" ? null : Math.max(1, Math.round(+t.value)); var rz = document.getElementById("compo-resume"); if (rz) rz.innerHTML = P.resumeCompo(etat, ui); }
      } else if (t.dataset.act === "marge") {
        Sim.fixerMarge(etat, t.dataset.cat, +t.value / 100);
        t.parentNode.querySelector(".entete .num").textContent = t.value + " %";
      }
    });
  }

  // ------------------------------------------------------------ Déco : pose des objets dans la salle (vue 3D)
  function commencerPose(pose) {
    annulerPose();
    if (!vue.placer) { toast("La décoration se pose dans la vue 3D.", "alerte"); return; }
    ui.pose = pose; ui.decoChoisi = null;
    if (!vue.placer(etat, pose)) { ui.pose = null; toast("Ton appareil n'affiche pas la 3D : impossible de poser la déco.", "alerte"); return; }
    $("#barre-deco").hidden = false;
    majBarreDeco(pose);
    if (window.innerWidth < 900) window.scrollTo({ top: 0, behavior: "smooth" });
    rafraichirPanneau(true);
  }
  function majBarreDeco(pose) {
    var b = $("#barre-deco"); if (!pose || b.hidden) return;
    var def = DATA.deco.objets[pose.type], ok = pose.valide && pose.valide.ok;
    b.querySelector(".nom").textContent = def.nom + (pose.id ? "" : " · " + P.euros(def.prix));
    b.querySelector(".etat").textContent = ok ? (window.innerWidth < 900 ? (def.mur ? "Touche un mur pour le déplacer" : "Touche le sol pour le déplacer") : "Clique pour poser") : (pose.valide ? pose.valide.raison : "");
    b.querySelector(".etat").classList.toggle("alerte", !ok);
    b.querySelector('[data-deco="valider"]').disabled = !ok;
    b.querySelector('[data-deco="valider"]').textContent = pose.id ? "Placer ici" : "Acheter et poser";
    b.querySelector('[data-deco="tourner"]').textContent = def.mur ? "Autre mur" : "Tourner";
  }
  function validerPose() {
    var p = ui.pose; if (!p) return;
    var r = p.id ? Sim.deplacerDeco(etat, p.id, p.x, p.y, p.rot, p.mur) : Sim.acheterDeco(etat, p.type, p.x, p.y, p.rot, p.mur);
    if (!r.ok) { toast(r.raison, "alerte"); return; }
    toast(p.id ? "Objet déplacé." : DATA.deco.objets[p.type].nom + " posé (" + P.euros(DATA.deco.objets[p.type].prix) + ").", "bon");
    annulerPose();
    action(function () {}); sauver();
  }
  function annulerPose() {
    if (!ui || !ui.pose) return;
    ui.pose = null;
    if (vue && vue.finPose) vue.finPose();
    $("#barre-deco").hidden = true;
    if (onglet === "deco") rafraichirPanneau(true);
  }
  function brancherDeco() {
    $("#barre-deco").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-deco]"); if (!b) return;
      if (b.dataset.deco === "tourner") vue.tournerPose();
      if (b.dataset.deco === "valider") validerPose();
      if (b.dataset.deco === "annuler") annulerPose();
    });
  }
  function creerVue(o) { return TMI.VueHybride ? new TMI.VueHybride($("#magasin"), $("#magasin3d"), o) : new TMI.VueMagasin($("#magasin"), o); }
  function camera(action) {
    if (action === "plus") vue.zoomer(1.25);
    if (action === "moins") vue.zoomer(0.8);
    if (action === "gauche") vue.tourner(-1);
    if (action === "droite") vue.tourner(1);
    if (action === "centre") vue.recentrer();
    if (action === "3d" && vue.basculer) { vue.basculer(!vue.mode3d); toast(vue.mode3d ? "Vue 3D activée (glisser : déplacer · clic droit ou 2 doigts : pivoter)" : "Vue 2D activée", "bon"); }
  }

  // ------------------------------------------------------------ Sauvegarde
  function sauver(toutDeSuite) {
    if (!etat) return;
    Sim.synchroniser(etat);
    Save.ecrire(emplacement, etat);
    if (Compte.utilisateur()) Compte.envoyer(emplacement, Save.copie(etat), resumePartie(etat), toutDeSuite).then(function (r) {
      if (!r.ok && !avertiNuage) { avertiNuage = true; toast("Sauvegarde en ligne impossible pour l'instant : la partie reste enregistrée sur cet appareil.", "alerte"); }
      if (r.ok && !r.differe) avertiNuage = false;
    });
  }
  var avertiNuage = false;

  // ------------------------------------------------------------ Modales et notifications
  var fileModales = [];   // une fenêtre à la fois : les suivantes attendent leur tour
  function ouvrirModal(html, boutons, auFermer) {
    var m = $("#modal"), boite = $("#modal-boite");
    if (!m.hidden) { fileModales.push([html, boutons, auFermer]); return; }
    boite.innerHTML = html + '<div class="boutons">' + boutons.map(function (b, i) {
      return '<button class="bouton ' + (b.style || "") + '" data-i="' + i + '">' + b.texte + "</button>";
    }).join("") + "</div>";
    m.hidden = false;
    boite.querySelectorAll(".boutons button").forEach(function (el) {
      el.addEventListener("click", function () {
        m.hidden = true;
        var b = boutons[+el.dataset.i];
        if (b.action) b.action();
        if (auFermer) auFermer();
        if (fileModales.length && m.hidden) ouvrirModal.apply(null, fileModales.shift());
      });
    });
    var principal = boite.querySelector(".boutons .principal") || boite.querySelector(".boutons button");
    if (principal) principal.focus();
  }
  function confirmer(titre, texte, ok, fn) {
    ouvrirModal("<h2>" + P.esc(titre) + "</h2><p>" + P.esc(texte) + "</p>", [{ texte: "Annuler" }, { texte: ok, style: "principal danger", action: fn }]);
  }
  function toast(texte, type) {
    var deja = Array.prototype.some.call($("#toasts").children, function (x) { return x.textContent === texte; });
    if (deja) return;
    var t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = texte;
    $("#toasts").appendChild(t);
    while ($("#toasts").children.length > (root.innerWidth < 900 ? 2 : 4)) $("#toasts").firstChild.remove();
    setTimeout(function () { t.remove(); }, 4200);
  }

  // Nouvelle partie : accueil court et choix du tuto
  function modalDepart() {
    var v = Sim.ville(etat);
    ouvrirModal(
      "<h2>Bienvenue à " + P.esc(v.nom) + "</h2>" +
      "<p>Ta petite boutique est prête, avec " + P.euros(etat.argent) + " en caisse. Le temps est en pause : prends le temps de t'installer.</p>" +
      (v.type === "paris" || v.type === "grande" ? '<p class="aide"><b>' + (v.type === "paris" ? "Très grande ville" : "Grande ville") + "</b> : beaucoup de passage. Prévois " + (v.type === "paris" ? "3 vendeurs et 2 caissiers" : "2 vendeurs") + " dès le départ, sinon les clients attendent, repartent, et ta réputation chute.</p>" : "") +
      "<p>Première partie ? Le <b>tuto</b> te guide pas à pas : embaucher, commander, ouvrir les portes. Il dure deux minutes et tu peux le passer à tout moment.</p>",
      [{ texte: "Jouer sans tuto", action: function () { etat.tuto = { etape: 0, fini: true, vues: {} }; } },
       { texte: "Suivre le tuto", style: "principal", action: function () { tuto.demarrer(etat); } }]);
  }
  function modalBienvenue() {
    var v = Sim.ville(etat), loc = Sim.local(etat);
    ouvrirModal(
      "<h2>Bienvenue à " + P.esc(v.nom) + "</h2>" +
      "<p>Ta petite boutique est prête. Le temps est en pause : prends le temps de t'installer.</p>" +
      (v.type === "paris" || v.type === "grande" ? '<p class="aide"><b>' + (v.type === "paris" ? "Très grande ville" : "Grande ville") + "</b> : beaucoup de passage. Prévois " + (v.type === "paris" ? "3 vendeurs et 2 caissiers" : "2 vendeurs") + " dès le départ, sinon les clients attendent, repartent, et ta réputation chute.</p>" : "") +
      "<p>Ta boutique a trois pièces. Passe de l'une à l'autre avec les boutons en haut à gauche de la vue, ou touche les portes et les meubles.</p>" +
      "<ol><li><b>Carte</b> : ta boutique est le logo sur la carte de France. Touche-le pour entrer ; le bouton Carte t'y ramène.</li>" +
      "<li><b>Bureau</b> : au tableau de l'équipe, embauche un vendeur et un caissier.</li>" +
      "<li><b>Réserve</b> : au poste de commande, commande quelques produits ; ils arrivent en " + DATA.fournisseurs[0].delaiJours + " jours sur les étagères.</li>" +
      "<li><b>Magasin</b> : choisis ce que montrent tes " + loc.emplacements + " rayons et règle tes prix.</li>" +
      "<li><b>Atelier</b> (la salle vitrée du magasin) : avec un technicien, compose des PC sur mesure et prends des réparations.</li>" +
      "<li><b>Pub</b> (au bureau) : quand l'équipe et les rayons sont prêts, lance une campagne pour attirer plus de clients.</li>" +
      "<li>Lance le temps (×1, ×2, ×3) et suis le bilan sur l'ordinateur du bureau : le loyer de " + P.euros(v.loyer) + " tombe chaque début de mois, les salaires en fin de mois.</li></ol>" +
      '<p class="aide">Conseil de répartition pour 30 000 € : local 8 000 €, stock 10 000 €, salaires 4 500 €, publicité 1 500 €, réserve 6 000 €.</p>' +
      '<p class="aide">Raccourcis : espace = pause, 1 / 2 / 3 = vitesse.</p>',
      [{ texte: "C'est parti", style: "principal" }]);
  }
  function modalDeblocage(e) {
    majVitesse(0);
    var nouveaux = Sim.catalogue().liste.filter(function (p) { return p.gamme === e.gamme; });
    ouvrirModal("<h2 class=\"annonce\">Ton fournisseur t'a trouvé de nouveaux produits&nbsp;!</h2><p>" + P.esc(DATA.fournisseurs[0].nom) + " te propose maintenant sa <b>" + P.esc(e.nom) + "</b>. Tes clients vont aussi commencer à la demander.</p>" +
      '<ul class="nouveautes">' + nouveaux.map(function (p) { return "<li>" + P.esc(p.nom) + " · <b>" + P.euros(p.prixRef) + "</b></li>"; }).join("") + "</ul>",
      [{ texte: "Plus tard" }, { texte: "Voir les produits", style: "principal", action: function () { if (modeVue !== "magasin") montrerVue("magasin"); ui.filtreStock = "tout"; allerPiece("reserve", "commandes"); } }]);
  }
  function modalAtelier() {
    majVitesse(0);
    ouvrirModal("<h2 class=\"annonce\">Nouveau : ton atelier ouvre&nbsp;!</h2>" +
      "<p>Des clients vont te demander des <b>PC sur mesure</b> : ils donnent un usage (jeu, bureautique, études) et un budget.</p>" +
      "<ol><li>Embauche un <b>technicien</b> (au bureau, onglet Personnel).</li>" +
      "<li>Garde en stock des processeurs, cartes graphiques, mémoires et SSD.</li>" +
      "<li>Dans l'onglet <b>Atelier</b>, compose le PC et fixe le prix. Le client paie à la remise.</li>" +
      "<li>Le technicien prend aussi les <b>réparations</b> déposées au comptoir : règle tes tarifs dans le même onglet.</li></ol>" +
      '<p class="aide">Attention aux délais : un PC livré en retard coûte de la réputation, et un technicien débutant fait plus d\'erreurs qui reviennent en SAV.</p>',
      [{ texte: "Plus tard" }, { texte: "Voir l'atelier", style: "principal", action: function () { if (modeVue !== "magasin") montrerVue("magasin"); allerPiece("magasin", "atelier"); } }]);
  }
  function modalReparations() {
    majVitesse(0);
    ouvrirModal("<h2 class=\"annonce\">L'atelier prend les réparations&nbsp;!</h2>" +
      "<p>Ton technicien peut maintenant réparer les appareils que les clients déposent au comptoir :</p>" +
      "<ol><li><b>Logiciel</b> et <b>nettoyage</b> : rapides, sans pièce.</li>" +
      "<li><b>Remplacement de pièce</b> : utilise un SSD, une mémoire ou une carte graphique de ton stock.</li>" +
      "<li><b>Récupération de données</b> : longue et très bien payée, réservée à un technicien niveau 3.</li></ol>" +
      '<p class="aide">Règle tes tarifs dans l\'onglet Atelier du magasin. Les ordinateurs vendus sont garantis : certains reviendront en SAV.</p>',
      [{ texte: "Plus tard" }, { texte: "Voir l'atelier", style: "principal", action: function () { if (modeVue !== "magasin") montrerVue("magasin"); allerPiece("magasin", "atelier"); } }]);
  }
  function modalEvenement(e) {
    var effets = P.effetsEvenement(e.def), marche = e.def.prix || e.def.remises;
    ouvrirModal('<p class="sur-titre">Événement · jusqu\'au ' + P.esc(Sim.dateTexte(e.fin)) + '</p><h2 class="annonce">' + P.esc(e.nom) + "</h2><p>" + P.esc(e.texte) + "</p>" +
      (effets.length ? '<ul class="effets">' + effets.map(function (x) { return "<li>" + P.esc(x) + "</li>"; }).join("") + "</ul>" : ""),
      marche ? [{ texte: "Compris" }, { texte: "Voir les commandes", style: "principal", action: function () { if (modeVue !== "magasin") montrerVue("magasin"); ui.filtreStock = "tout"; allerPiece("reserve", "commandes"); } }]
             : [{ texte: "Compris", style: "principal" }]);
  }
  function nomMoisBilan(n) { var t = CFG.temps; return (t.nomsMois || [])[((n - 1 + (t.moisDepart || 1) - 1) % 12)] || ""; }
  function modalVictoire() {
    majVitesse(0); sauver();
    var v = etat.victoire || {}, d = Sim.infosDate(etat);
    var annees = Math.floor(v.jour / (CFG.temps.joursParMois * 12)), mois = Math.floor(v.jour / CFG.temps.joursParMois) % 12;
    var chiffre = function (lib, val) { return '<div class="chiffre"><span>' + lib + "</span><b>" + val + "</b></div>"; };
    ouvrirModal('<div class="victoire"><p class="sur-titre">Palier 4 · victoire</p><h2>Leader national !</h2>' +
      "<p>Partie de ta première boutique à " + P.esc(Sim.villeParId(etat.magasins.length ? Sim.magasin(etat, 0).villeId : etat.villeId).nom) + ", ton enseigne est maintenant présente dans toute la France.</p>" +
      '<div class="chiffres">' +
      chiffre("Temps de jeu", (annees ? annees + " an" + (annees > 1 ? "s" : "") + " et " : "") + mois + " mois") +
      chiffre("Magasins", v.magasins) + chiffre("Régions", v.regions + " / 13") +
      chiffre("Ventes", (v.ventes || 0).toLocaleString("fr-FR")) + chiffre("Chiffre d'affaires total", P.euros(v.ca || 0)) +
      chiffre("Trésorerie", P.euros(etat.argent)) + "</div>" +
      '<p class="aide">Tu peux continuer en mode libre : la partie reste ouverte, sans objectif imposé. Difficulté : ' + P.esc(CFG.difficultes[etat.difficulte].nom.toLowerCase()) + ".</p></div>",
      [{ texte: "Retour à l'accueil", action: function () { sauver(true); accueil(); } }, { texte: "Continuer en mode libre", style: "principal" }]);
    void d;
  }
  // Liste de ce qui demande l'attention, avec un bouton pour y aller directement
  function modalAFaire() {
    var al = P.alertesEnseigne(etat), plusieurs = etat.magasins.length > 1;
    var h = "<h2>À faire</h2>";
    if (!al.length) h += "<p>Rien d'urgent : tout tourne. Profites-en pour regarder le bilan ou préparer la suite.</p>";
    else h += '<ul class="afaire">' + al.map(function (a, k) {
      return '<li class="' + a.niveau + '"><span>' + (plusieurs && a.ville ? "<b>" + P.esc(a.ville) + "</b> · " : "") + P.esc(a.texte) + '</span><button class="bouton petit" data-aller="' + k + '">Y aller</button></li>';
    }).join("") + "</ul>";
    ouvrirModal(h, [{ texte: "Fermer", style: "principal" }]);
    $("#modal-boite").querySelectorAll("[data-aller]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = al[+b.dataset.aller];
        $("#modal").hidden = true;
        changerMagasin(a.i, a.piece, a.onglet);
        if (modeVue !== "magasin") montrerVue("magasin");
        if (fileModales.length) ouvrirModal.apply(null, fileModales.shift());
      });
    });
  }
  // Choisir le magasin affiché sans passer par la carte
  function modalMagasins() {
    var h = '<h2>Tes magasins</h2><div class="liste">' + etat.magasins.map(function (x, i) {
      var m = Sim.vueMagasin(etat, i), r = Sim.resultatMois(m.mois, Math.round(m.salairesDus)), v = Sim.ville(m);
      var nb = P.alertesEnseigne(etat).filter(function (a) { return a.i === i && !a.enseigne && a.niveau !== "info"; }).length;
      return '<button class="ligne ligne-bouton' + (i === etat.actif ? " surbrillance" : "") + '" data-mag="' + i + '"><div><div class="titre">' + P.esc(v.nom) +
        (nb ? ' <span class="etat alerte">' + nb + " à faire</span>" : "") + (Sim.aUnResponsable(m) ? ' <span class="etat">piloté</span>' : "") + '</div><div class="detail">' +
        P.esc(DATA.regions[v.region]) + " · " + P.esc(Sim.local(m).nom.toLowerCase()) + " · réputation " + Math.round(m.reputation) + '</div></div><div class="droite"><b class="num ' + (r >= 0 ? "positif" : "negatif") + '">' + P.signe(r) + "</b></div></button>";
    }).join("") + "</div>";
    ouvrirModal(h, [{ texte: "Fermer" }]);
    $("#modal-boite").querySelectorAll("[data-mag]").forEach(function (b) {
      b.addEventListener("click", function () {
        $("#modal").hidden = true;
        changerMagasin(+b.dataset.mag);
        if (modeVue !== "magasin") montrerVue("magasin");
        if (fileModales.length) ouvrirModal.apply(null, fileModales.shift());
      });
    });
  }
  function modalPalier(e) {
    majVitesse(0);
    if (e.palier === 3) {
      ouvrirModal('<p class="sur-titre">Palier 3 atteint</p><h2>' + P.esc(CFG.paliers[3].nom) + "</h2>" +
        "<p>Ton enseigne s'étend sur plusieurs régions. Tu peux maintenant construire des <b>entrepôts régionaux</b> (achat en gros moins cher) et acheter une <b>flotte</b> de camionnettes et de camions pour livrer tes magasins.</p>" +
        '<p class="aide">Sur la carte, touche une ville pour construire l\'entrepôt de sa région, puis ouvre « Logistique » dans la fiche de ton enseigne.</p>',
        [{ texte: "C'est parti", style: "principal" }]);
      return;
    }
    ouvrirModal('<p class="sur-titre">Palier ' + e.palier + " atteint</p><h2>" + P.esc(CFG.paliers[e.palier].nom) + "</h2>" +
      "<p>Trois magasins en " + P.esc(e.region) + " : ton enseigne compte maintenant dans la région. Les clients reconnaissent ton nom d'une ville à l'autre.</p>" +
      '<p class="aide">Prochaine étape : le palier 3 (réseau régional), avec des entrepôts et une flotte de transport. Il arrivera dans une prochaine version.</p>',
      [{ texte: "Bravo !", style: "principal" }]);
  }
  function modalBilan(b, details) {
    majVitesse(0);
    var parMagasin = details && details.length > 1
      ? '<table class="bilan"><thead><tr><th>Magasin</th><th>CA</th><th>Résultat</th></tr></thead><tbody>' +
        details.map(function (d) { return "<tr><td>" + P.esc(d.nom) + "</td><td>" + P.euros(d.bilan.ca) + '</td><td class="' + (d.bilan.resultat >= 0 ? "positif" : "negatif") + '">' + P.signe(d.bilan.resultat) + "</td></tr>"; }).join("") +
        "</tbody></table>" : "";
    ouvrirModal(
      "<h2>Bilan de " + nomMoisBilan(b.numero) + ' <span class="discret">(mois ' + b.numero + (parMagasin ? ", " + details.length + " magasins" : "") + ")</span></h2>" + parMagasin +
      '<table class="bilan"><tbody>' +
      "<tr><td>Chiffre d'affaires</td><td>" + P.euros(b.ca) + "</td></tr>" +
      "<tr><td>Coût des produits vendus</td><td>− " + P.euros(b.cogs) + "</td></tr>" +
      "<tr><td>Salaires</td><td>− " + P.euros(b.salaires) + "</td></tr>" +
      "<tr><td>Loyer et charges</td><td>− " + P.euros(b.loyer + b.charges) + "</td></tr>" +
      (b.sav ? "<tr><td>Pièces de SAV</td><td>− " + P.euros(b.sav) + "</td></tr>" : "") +
      (b.pub ? "<tr><td>Publicité</td><td>− " + P.euros(b.pub) + "</td></tr>" : "") +
      (b.logistique ? "<tr><td>Logistique (entrepôts, flotte)</td><td>− " + P.euros(b.logistique) + "</td></tr>" : "") +
      (b.siege ? "<tr><td>Frais de siège</td><td>− " + P.euros(b.siege) + "</td></tr>" : "") +
      '<tr class="total"><td>Résultat</td><td class="' + (b.resultat >= 0 ? "positif" : "negatif") + '">' + P.signe(b.resultat) + "</td></tr>" +
      "<tr><td>Trésorerie</td><td>" + P.euros(b.tresorerie) + "</td></tr></tbody></table>" +
      "<p>" + b.ventes + " ventes pour " + b.clients + " clients" + (b.montages ? " · " + b.montages + " PC sur mesure (" + P.euros(b.caMontage) + ")" : "") + (b.reparations ? " · " + b.reparations + " réparations (" + P.euros(b.caReparations) + ")" : "") + " · " + b.perdusAttente + " partis après une longue attente · réputation " + b.reputation + ".</p>" +
      (etat.fin ? "" : '<p class="aide">Le loyer du mois suivant sera prélevé demain matin.</p>'),
      etat.fin ? [{ texte: "Voir la suite", style: "principal" }] : [{ texte: "Continuer", style: "principal" }]);
  }
  function modalFaillite() {
    majVitesse(0); sauver();
    var montrerFin = function () {
      ouvrirModal("<h2>Faillite</h2><p>La trésorerie est passée sous zéro en fin de mois. " + (etat.magasins && etat.magasins.length > 1 ? "Ton enseigne ferme ses " + etat.magasins.length + " magasins" : "Ta boutique ferme ses portes") + " après " + (etat.fin ? etat.fin.mois : etat.bilans.length) + " mois.</p>" +
        "<p>Ventes totales : " + etat.stats.ventes + " · chiffre d'affaires total : " + P.euros(etat.stats.ca) + ".</p>",
        [{ texte: "Retour à l'accueil", style: "principal", action: accueil }]);
    };
    montrerFin();   // s'affiche après le bilan s'il est ouvert
  }
  function modalMenu() {
    var avant = vitesse; majVitesse(0);
    var sy = Compte.utilisateur() ? Compte.sync() : null;
    var ligneNuage = !sy ? (Compte.dispo() ? " Tu joues en invité : la partie reste sur cet appareil." : "")
      : sy.erreur ? " <span class=\"negatif\">Sauvegarde en ligne en échec : " + P.esc(sy.erreur) + "</span>"
      : " Sauvegarde en ligne (compte " + P.esc(Compte.utilisateur().email || "") + ")" + (sy.derniere ? " : dernier envoi à " + new Date(sy.derniere).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + "." : ".");
    ouvrirModal("<h2>Menu</h2><p class=\"aide\">La partie est enregistrée automatiquement chaque jour dans l'emplacement " + emplacement + "." + ligneNuage + "</p>", [
      { texte: "Aide", action: modalBienvenue },
      { texte: "Revoir le tuto", action: function () { tuto.demarrer(etat); majVitesse(0); if (modeVue !== "carte") montrerVue("carte"); } }
    ].concat(root.TMI_SANS_EXPORT ? [] : [
      { texte: "Exporter la sauvegarde", action: function () { Save.exporter(etat, "tycoon-" + etat.villeId + "-jour" + (etat.jour + 1) + ".json"); } }
    ]).concat([
      { texte: Compte.utilisateur() ? "Sauvegarder en ligne maintenant" : null, action: function () { sauver(true); toast("Envoi de la sauvegarde…", "bon"); majVitesse(avant); } },
      { texte: "Quitter vers l'accueil", action: function () { sauver(true); accueil(); } },
      { texte: "Reprendre", style: "principal", action: function () { majVitesse(avant); } }
    ]).filter(function (b) { return b.texte; }));
  }

  // ------------------------------------------------------------ Branchements
  function brancher() {
    $("#liste-sauvegardes").addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.nouvelle) ecranNouvelle(+b.dataset.nouvelle);
      if (b.dataset.continuer) continuer(+b.dataset.continuer);
      if (b.dataset.supprimer) {
        var n = +b.dataset.supprimer;
        confirmer("Supprimer la sauvegarde " + n + " ?", "Cette partie sera perdue définitivement" + (Compte.utilisateur() ? ", sur tous tes appareils." : "."), "Supprimer", function () {
          Save.supprimer(n);
          if (Compte.utilisateur()) Compte.supprimer(n).then(function (r) { if (!r.ok) toast(r.raison, "alerte"); accueil(); });
          else accueil();
        });
      }
    });
    $("#importer").addEventListener("change", function (ev) {
      var f = ev.target.files[0]; ev.target.value = "";
      if (!f) return;
      Save.importer(f, function (err, s) {
        if (err) return toast(err, "alerte");
        var libre = Save.liste().filter(function (e) { return !contenuEmplacement(e); })[0];
        var n = libre ? libre.emplacement : 1;
        var go = function () { Save.ecrire(n, s); lancerPartie(s, n); sauver(true); };
        if (libre) go(); else confirmer("Remplacer l'emplacement 1 ?", "Les trois emplacements sont occupés.", "Remplacer", go);
      });
    });
    $("#ecran-nouvelle").addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.action === "accueil") return accueil();
      if (b.dataset.ville) { np.ville = b.dataset.ville; majResumeNouvelle(); }
      if (b.dataset.diff) { np.difficulte = b.dataset.diff; majResumeNouvelle(); }
    });
    $("#np-lancer").addEventListener("click", function () {
      if (!np.ville) return;
      var s = Sim.nouvellePartie({ villeId: np.ville, difficulte: np.difficulte });
      lancerPartie(s, emplacement);
      modalDepart();
    });
    document.querySelectorAll(".vitesses button").forEach(function (b) {
      b.addEventListener("click", function () { majVitesse(+b.dataset.vitesse); });
    });
    $("#b-menu").addEventListener("click", modalMenu);
    $("#b-afaire").addEventListener("click", modalAFaire);
    document.querySelector(".camera-carte").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-zoom]"); if (!b || !carte) return;
      if (b.dataset.zoom === "plus") carte.zoomer(1.4); else if (b.dataset.zoom === "moins") carte.zoomer(1 / 1.4); else carte.recentrer();
    });
    $("#b-magasin").addEventListener("click", function () { if (etat && etat.magasins.length > 1) modalMagasins(); });
    $("#b-vue").addEventListener("click", function () { montrerVue("carte"); });
    document.querySelector("#vue-magasin .camera").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-cam]"); if (!b || !vue) return;
      camera(b.dataset.cam);
    });
    $("#fiche").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-fiche]");
      if (!b) return;
      if (b.dataset.fiche === "gerer") { changerMagasin(+b.dataset.i); montrerVue("magasin"); }
      if (b.dataset.fiche === "retour") { ficheIdx = null; ficheMode = null; carte.choisir(null); }
      var apres = function (r, bon) { if (!r.ok) toast(r.raison, "alerte"); else if (bon) toast(bon, "bon"); traiterEvenements(); carte.maj(etat); majBarre(); majFiche(true); sauver(); };
      if (b.dataset.fiche === "logistique") { villeVue = null; ficheMode = "logistique"; carte.choisir(null); }
      if (b.dataset.fiche === "entrepot") {
        var reg = b.dataset.region, vi = b.dataset.ville, E = CFG.logistique.entrepot;
        confirmer("Construire l'entrepôt " + DATA.regions[reg] + " ?", "Aménagement " + P.euros(E.amenagement) + " et premier loyer " + P.euros(E.loyer + E.charges) + ". Ensuite " + P.euros(E.loyer + E.charges) + " chaque mois. Pense à acheter au moins une camionnette pour livrer tes magasins.", "Construire", function () {
          var r = Sim.construireEntrepot(etat, reg, vi);
          if (r.ok) { villeVue = null; ficheMode = "logistique"; carte.construire(etat); carte.choisir(null); }
          apres(r, "Entrepôt construit !");
        });
      }
      if (b.dataset.fiche === "vehicule") {
        var V = CFG.logistique.vehicules[b.dataset.type];
        confirmer("Acheter : " + V.nom.toLowerCase() + " ?", V.texte + " Prix " + P.euros(V.prix) + ", entretien " + P.euros(V.entretien) + " par mois.", "Acheter", function () { apres(Sim.acheterVehicule(etat, b.dataset.type), V.nom + " achetée !"); });
      }
      if (b.dataset.fiche === "vendre") {
        confirmer("Revendre ce véhicule ?", "Il rapporte la moitié de son prix d'achat.", "Revendre", function () { apres(Sim.vendreVehicule(etat, b.dataset.id)); });
      }
      if (b.dataset.fiche === "gros") {
        var bloc = b.closest(".gros"), pid = bloc.querySelector('[data-role="prod"]').value, q = +bloc.querySelector('[data-role="qte"]').value;
        apres(Sim.commanderEntrepot(etat, b.dataset.region, pid, q), "Commande en gros passée.");
      }
      if (b.dataset.fiche === "envoyer") {
        var lg = b.closest(".envoi"), q2 = +lg.querySelector('[data-role="qte"]').value, dest = +lg.querySelector('[data-role="dest"]').value;
        apres(Sim.transferer(etat, b.dataset.region, dest, b.dataset.prod, q2), "Transfert parti.");
      }
      if (b.dataset.fiche === "racheter") {
        var cr = Sim.conditionsRachat(etat, b.dataset.id), ch = Sim.chaine(cr.rival.chaine), vr = Sim.villeParId(cr.rival.villeId);
        var texteR = cr.reprise
          ? "Tu paies " + P.euros(cr.total) + " (rachat " + P.euros(cr.prix) + ", dépôt de garantie et premier loyer). Le magasin " + ch.nom + " ferme et son local devient le tien : pas d'aménagement à payer. Il faudra ensuite embaucher une équipe et commander du stock."
          : "Tu paies " + P.euros(cr.prix) + ". Le magasin " + ch.nom + " de " + vr.nom + " ferme, ses clients viennent chez toi et ta réputation y gagne " + DATA.concurrents.rachat.reputation + " points.";
        confirmer("Racheter " + ch.nom + " à " + vr.nom + " ?", texteR, "Racheter", function () {
          var r = Sim.racheterRival(etat, b.dataset.id);
          if (!r.ok) return toast(r.raison, "alerte");
          traiterEvenements();
          carte.construire(etat);
          if (r.reprise) {
            villeVue = null; ficheIdx = null;
            ouvrirModal("<h2>" + P.esc(vr.nom) + " est à toi</h2><p>Tu as repris le local de " + P.esc(ch.nom) + ". Le magasin est prêt, mais vide : commence par le bureau pour embaucher, puis la réserve pour commander.</p>",
              [{ texte: "Plus tard" }, { texte: "Gérer ce magasin", style: "principal", action: function () { changerMagasin(r.index, "bureau", "personnel"); montrerVue("magasin"); } }]);
          }
          majBarre(); majFiche(true); sauver();
        });
      }
      if (b.dataset.fiche === "voir") { ficheIdx = +b.dataset.i; majFiche(); }
      if (b.dataset.fiche === "ouvrir") {
        var v = Sim.villeParId(b.dataset.ville), co = Sim.conditionsOuverture(etat, v.id);
        confirmer("Ouvrir un magasin à " + v.nom + " ?", "Tu paies " + P.euros(co.cout.total) + " maintenant (dépôt, aménagement, premier loyer). Il faudra ensuite embaucher une équipe et commander du stock pour ce magasin.", "Ouvrir", function () {
          var r = Sim.ouvrirMagasin(etat, v.id);
          if (!r.ok) return toast(r.raison, "alerte");
          traiterEvenements();
          villeVue = null; ficheIdx = null;
          carte.construire(etat);
          ouvrirModal("<h2>Bienvenue à " + P.esc(v.nom) + "</h2><p>Ton nouveau magasin est prêt, mais vide : commence par le bureau pour embaucher, puis la réserve pour commander.</p>",
            [{ texte: "Plus tard" }, { texte: "Gérer ce magasin", style: "principal", action: function () { changerMagasin(r.index, "bureau", "personnel"); montrerVue("magasin"); } }]);
          sauver();
        });
      }
    });
    $("#pieces").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (b) allerPiece(b.dataset.piece);
    });
    $("#onglets").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (b) { ui.categorieVisee = null; changerOnglet(b.dataset.onglet); }
    });
    document.addEventListener("keydown", function (ev) {
      if (!etat || !$("#modal").hidden) return;
      if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (ev.code === "Space") { ev.preventDefault(); majVitesse(vitesse ? 0 : vitessePrecedente); }
      if (ev.key === "1" || ev.key === "2" || ev.key === "3") majVitesse(+ev.key);
      if (ev.key === "Escape" && ui && ui.pose) { annulerPose(); return; }
      if (ui && ui.pose && (ev.key === "r" || ev.key === "R")) { vue.tournerPose(); return; }
      if (ui && ui.pose && ev.key === "Enter") { validerPose(); return; }
      if (ev.key === "Escape" && modeVue === "magasin") montrerVue("carte");
      if (ev.key === "a" || ev.key === "A") modalAFaire();
      if (modeVue === "magasin") {
        var touches = { "+": "plus", "=": "plus", "-": "moins", "q": "gauche", "Q": "gauche", "e": "droite", "E": "droite", "r": "centre", "R": "centre", "v": "3d", "V": "3d" };
        if (touches[ev.key]) camera(touches[ev.key]);
      }
    });
    document.addEventListener("visibilitychange", function () { if (document.hidden) sauver(true); });
    brancherPanneau();
    brancherDeco();
  }

  tuto = new TMI.Tuto(function () { return etat ? { etat: etat, ui: ui, modeVue: modeVue, onglet: onglet, vitesse: vitesse } : null; });
  brancher();
  brancherCompte();
  accueil();
  requestAnimationFrame(boucle);
  TMI.debug = { etat: function () { return etat; }, vue: function () { return vue; }, vitesse: majVitesse };
})(window);
