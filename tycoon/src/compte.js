// Comptes joueurs et sauvegarde en ligne (Supabase).
// Sans compte, le jeu marche comme avant (sauvegardes dans le navigateur).
// Avec un compte, chaque emplacement est aussi envoyé dans la table « sauvegardes » (une ligne par joueur et par emplacement),
// au plus toutes les 30 secondes pendant la partie, et tout de suite quand on quitte.
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};
  var C = function () { return (root.TMI_DATA && root.TMI_DATA.config && root.TMI_DATA.config.enLigne) || {}; };
  var client = null, utilisateur = null, ecouteurs = [];
  var attente = {}, minuteurs = {}, dernierEnvoi = {}, etatSync = { derniere: null, enCours: 0, erreur: null };
  var DELAI = 30000;

  function dispo() { return !root.TMI_SANS_EXPORT && !!(root.supabase && root.supabase.createClient && C().url && C().cle); }   // pas de compte dans l'aperçu claude.ai

  // Messages d'erreur en français
  function traduire(err) {
    var m = String((err && (err.message || err.error_description || err.msg)) || err || "");
    if (/invalid login credentials/i.test(m)) return "Email ou mot de passe incorrect.";
    if (/already registered|already exists/i.test(m)) return "Un compte existe déjà avec cet email : connecte-toi.";
    if (/email not confirmed/i.test(m)) return "Confirme d'abord ton email : clique sur le lien reçu (pense à regarder dans les spams).";
    if (/password should be at least|weak password|password is too short/i.test(m)) return "Le mot de passe doit faire au moins 6 caractères.";
    if (/unable to validate email|invalid email|email address .* is invalid/i.test(m)) return "Cette adresse email n'est pas valide.";
    if (/rate limit|too many/i.test(m)) return "Trop d'essais d'affilée : réessaie dans quelques minutes.";
    if (/failed to fetch|network|load failed|fetch/i.test(m)) return "Impossible de joindre le serveur. Vérifie ta connexion internet.";
    if (/relation .* does not exist|could not find the table/i.test(m)) return "La table « " + (C().table || "sauvegardes") + " » n'existe pas encore sur le serveur.";
    if (/row-level security|permission denied/i.test(m)) return "Le serveur refuse l'accès à cette sauvegarde (règles de sécurité).";
    return m || "Erreur inconnue.";
  }

  function init(rappel) {
    if (rappel) ecouteurs.push(rappel);
    if (client || !dispo()) return Promise.resolve(utilisateur);
    try {
      client = root.supabase.createClient(C().url, C().cle, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "tmi_compte" }
      });
    } catch (e) { client = null; return Promise.resolve(null); }
    client.auth.onAuthStateChange(function (evt, session) {
      utilisateur = session ? session.user : null;
      ecouteurs.forEach(function (f) { try { f(evt, utilisateur); } catch (e) {} });
    });
    return client.auth.getSession().then(function (r) {
      utilisateur = r.data && r.data.session ? r.data.session.user : null;
      return utilisateur;
    }, function () { return null; });
  }

  function reponse(r) { return r.error ? { ok: false, raison: traduire(r.error) } : { ok: true, data: r.data }; }
  function attraper(e) { return { ok: false, raison: traduire(e) }; }
  function redirection() { return root.location.origin + root.location.pathname; }

  function inscrire(email, mdp) {
    return client.auth.signUp({ email: email, password: mdp, options: { emailRedirectTo: redirection() } }).then(function (r) {
      var x = reponse(r);
      if (x.ok) x.confirmer = !(r.data && r.data.session);     // confirmation par email demandée
      return x;
    }, attraper);
  }
  function connecter(email, mdp) { return client.auth.signInWithPassword({ email: email, password: mdp }).then(reponse, attraper); }
  function deconnecter() {
    return vider().then(function () { return client.auth.signOut(); }).then(function () { utilisateur = null; return { ok: true }; }, attraper);
  }
  function oublie(email) { return client.auth.resetPasswordForEmail(email, { redirectTo: redirection() }).then(reponse, attraper); }
  function nouveauMdp(mdp) { return client.auth.updateUser({ password: mdp }).then(reponse, attraper); }

  function table() { return client.from(C().table || "sauvegardes"); }
  // Liste des emplacements en ligne (sans le contenu complet)
  function liste() {
    if (!utilisateur) return Promise.resolve({ ok: true, data: [] });
    return table().select("emplacement, resume, maj").eq("user_id", utilisateur.id).order("emplacement").then(reponse, attraper);
  }
  function charger(n) {
    return table().select("donnees, maj").eq("user_id", utilisateur.id).eq("emplacement", n).maybeSingle().then(reponse, attraper);
  }
  function ecrireMaintenant(n) {
    var a = attente[n]; if (!a || !utilisateur) return Promise.resolve({ ok: true });
    delete attente[n];
    clearTimeout(minuteurs[n]); delete minuteurs[n];
    dernierEnvoi[n] = Date.now();
    etatSync.enCours++;
    return table().upsert({ user_id: utilisateur.id, emplacement: n, donnees: a.donnees, resume: a.resume, maj: new Date(a.date).toISOString() }, { onConflict: "user_id,emplacement" })
      .then(reponse, attraper).then(function (r) {
        etatSync.enCours--;
        if (r.ok) { etatSync.derniere = Date.now(); etatSync.erreur = null; }
        else { etatSync.erreur = r.raison; if (!attente[n]) attente[n] = a; }   // on retentera au prochain envoi
        return r;
      });
  }
  // Envoi groupé : au plus une écriture toutes les 30 s par emplacement (sauf « tout de suite »)
  function envoyer(n, donnees, resume, toutDeSuite) {
    if (!client || !utilisateur) return Promise.resolve({ ok: false, raison: "Pas connecté." });
    attente[n] = { donnees: donnees, resume: resume, date: Date.now() };
    var reste = DELAI - (Date.now() - (dernierEnvoi[n] || 0));
    if (toutDeSuite || reste <= 0) return ecrireMaintenant(n);
    if (!minuteurs[n]) minuteurs[n] = setTimeout(function () { delete minuteurs[n]; ecrireMaintenant(n); }, reste);
    return Promise.resolve({ ok: true, differe: true });
  }
  function vider() { return Promise.all(Object.keys(attente).map(function (n) { return ecrireMaintenant(+n); })); }
  function supprimer(n) {
    delete attente[n];
    return table().delete().eq("user_id", utilisateur.id).eq("emplacement", n).then(reponse, attraper);
  }
  // Suppression du compte : fonction « supprimer_mon_compte » côté serveur (voir LISEZMOI)
  function supprimerCompte() {
    return client.rpc("supprimer_mon_compte").then(reponse, attraper).then(function (r) {
      if (r.ok) { try { client.auth.signOut(); } catch (e) {} utilisateur = null; }
      return r;
    });
  }

  // En quittant la page : on envoie ce qui attend encore
  root.addEventListener("pagehide", function () { vider(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") vider(); });

  TMI.Compte = {
    dispo: dispo, init: init, utilisateur: function () { return utilisateur; },
    inscrire: inscrire, connecter: connecter, deconnecter: deconnecter, oublie: oublie, nouveauMdp: nouveauMdp,
    liste: liste, charger: charger, envoyer: envoyer, vider: vider, supprimer: supprimer, supprimerCompte: supprimerCompte,
    sync: function () { return etatSync; }, enAttente: function () { return Object.keys(attente).length; }
  };
})(window);
