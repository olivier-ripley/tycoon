// Sons et musique, synthétisés dans le navigateur (Web Audio) : aucun fichier à charger, le jeu reste un simple dossier.
// TMI.Sons.jouer("caisse") pour un effet ; la musique d'ambiance tourne en boucle tant qu'elle est activée.
// Réglages (effets, musique) mémorisés sur l'appareil. Le navigateur n'autorise le son qu'après un premier clic.
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};

  var CLE = "tmi_sons";
  var reglages = { effets: true, musique: true };
  try { var lu = JSON.parse(root.localStorage.getItem(CLE) || "null"); if (lu) { reglages.effets = lu.effets !== false; reglages.musique = lu.musique !== false; } } catch (e) { /* stockage indisponible */ }
  function memoriser() { try { root.localStorage.setItem(CLE, JSON.stringify(reglages)); } catch (e) { /* tant pis */ } }

  var ctx = null, sortie = null, busEffets = null, busMusique = null, bruit = null;
  var reduit = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function contexte() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    sortie = ctx.createGain(); sortie.gain.value = 0.9;
    comp.connect(sortie); sortie.connect(ctx.destination);
    busEffets = ctx.createGain(); busEffets.gain.value = 0.8; busEffets.connect(comp);
    busMusique = ctx.createGain(); busMusique.gain.value = 0; busMusique.connect(comp);
    // une seconde de bruit blanc, réutilisée pour les clics, le tiroir-caisse et la batterie
    bruit = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = bruit.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function pret() { return ctx && ctx.state === "running"; }

  // ------------------------------------------------------------ Briques
  function freq(note) { return 440 * Math.pow(2, (note - 69) / 12); }   // note MIDI -> Hz
  // Note enveloppée : attaque courte, décroissance exponentielle
  function ton(bus, t, f, duree, o) {
    o = o || {};
    var osc = ctx.createOscillator(), g = ctx.createGain(), vol = o.vol == null ? 0.2 : o.vol;
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(f, t);
    if (o.glisse) osc.frequency.exponentialRampToValueAtTime(o.glisse, t + duree);
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attaque || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    var dernier = g;
    if (o.filtre) { var fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = o.filtre; g.connect(fl); dernier = fl; }
    osc.connect(g); dernier.connect(bus);
    osc.start(t); osc.stop(t + duree + 0.05);
  }
  function souffle(bus, t, duree, o) {
    o = o || {};
    var src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = bruit;
    fl.type = o.type || "bandpass"; fl.frequency.value = o.f || 3000; fl.Q.value = o.q || 1;
    g.gain.setValueAtTime(o.vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    src.connect(fl); fl.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + duree + 0.02);
  }

  // ------------------------------------------------------------ Effets
  var EFFETS = {
    // tiroir-caisse : déclic du tiroir puis « ding » à deux cloches
    caisse: function (t, b) {
      souffle(b, t, 0.05, { f: 2400, q: 2, vol: 0.18 });
      souffle(b, t + 0.05, 0.08, { f: 900, q: 1.5, vol: 0.12 });
      ton(b, t + 0.07, freq(91), 0.7, { type: "triangle", vol: 0.16 });
      ton(b, t + 0.13, freq(96), 0.9, { type: "triangle", vol: 0.14 });
      ton(b, t + 0.13, freq(108), 0.4, { type: "sine", vol: 0.04 });
    },
    // pièce : vente dans un autre magasin, plus discret
    piece: function (t, b) { ton(b, t, freq(88), 0.18, { type: "triangle", vol: 0.07 }); ton(b, t + 0.05, freq(93), 0.22, { type: "triangle", vol: 0.06 }); },
    clic: function (t, b) { souffle(b, t, 0.025, { f: 4200, q: 3, vol: 0.06 }); ton(b, t, freq(84), 0.05, { vol: 0.03 }); },
    bon: function (t, b) { ton(b, t, freq(76), 0.25, { type: "triangle", vol: 0.12 }); ton(b, t + 0.09, freq(83), 0.4, { type: "triangle", vol: 0.12 }); },
    alerte: function (t, b) { ton(b, t, freq(69), 0.16, { type: "square", vol: 0.05, filtre: 1800 }); ton(b, t + 0.14, freq(65), 0.26, { type: "square", vol: 0.05, filtre: 1600 }); },
    evenement: function (t, b) { [72, 76, 79].forEach(function (n, i) { ton(b, t + i * 0.08, freq(n), 0.6, { type: "triangle", vol: 0.09 }); }); },
    bilan: function (t, b) {
      souffle(b, t, 0.18, { type: "highpass", f: 2500, vol: 0.06 });   // page qu'on tourne
      ton(b, t + 0.12, freq(79), 0.5, { type: "sine", vol: 0.1 }); ton(b, t + 0.2, freq(84), 0.7, { type: "sine", vol: 0.09 });
    },
    palier: function (t, b) {
      [60, 64, 67, 72].forEach(function (n, i) { ton(b, t + i * 0.12, freq(n + 12), 0.35, { type: "triangle", vol: 0.13 }); });
      [72, 76, 79, 84].forEach(function (n) { ton(b, t + 0.5, freq(n), 1.6, { type: "triangle", vol: 0.07, attaque: 0.03 }); });
      [96, 100, 103].forEach(function (n, i) { ton(b, t + 0.55 + i * 0.07, freq(n), 0.3, { vol: 0.03 }); });
    },
    victoire: function (t, b) {
      var m = [[67, 0], [72, 0.15], [76, 0.3], [79, 0.45], [76, 0.62], [79, 0.75], [84, 0.95]];
      m.forEach(function (x) { ton(b, t + x[1], freq(x[0] + 12), 0.4, { type: "triangle", vol: 0.13 }); });
      [72, 76, 79, 84, 88].forEach(function (n) { ton(b, t + 1.1, freq(n), 2.4, { type: "triangle", vol: 0.06, attaque: 0.04 }); });
    },
    faillite: function (t, b) { [67, 63, 60, 55].forEach(function (n, i) { ton(b, t + i * 0.28, freq(n), 0.55, { type: "sawtooth", vol: 0.05, filtre: 1200 }); }); }
  };
  var derniers = {};
  function jouer(nom) {
    if (!reglages.effets || !EFFETS[nom] || !pret()) return;
    var maintenant = ctx.currentTime, ecart = { caisse: 0.35, piece: 0.25, clic: 0.06 }[nom] || 0.15;
    if (derniers[nom] && maintenant - derniers[nom] < ecart) return;   // pas de rafale
    derniers[nom] = maintenant;
    EFFETS[nom](maintenant + 0.01, busEffets);
  }

  // ------------------------------------------------------------ Musique d'ambiance
  // Lo-fi tranquille à 82 bpm : nappes, basse ronde, charleston feutré et quelques notes de mélodie au hasard.
  var TEMPO = 82, NOIRE = 60 / TEMPO;
  var GRILLE = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];   // Fa7M, Mim7, Rém7, Do7M (2 mesures chacun)
  var GAMME = [72, 74, 76, 79, 81, 84];
  var temps = 0, pas = 0, minuterie = null;
  function planifier() {
    if (!pret()) return;
    while (temps < ctx.currentTime + 0.4) {
      var b = busMusique, mesure = Math.floor(pas / 8), accord = GRILLE[Math.floor(mesure / 2) % GRILLE.length], croche = pas % 8;
      if (croche === 0 && mesure % 2 === 0) accord.forEach(function (n, i) { ton(b, temps, freq(n), NOIRE * 8.2, { type: "triangle", vol: 0.035, attaque: 0.5, filtre: 900, detune: i % 2 ? 6 : -6 }); });
      if (croche === 0 || croche === 4) ton(b, temps, freq(accord[0] - 12), NOIRE * 1.6, { type: "sine", vol: 0.11, attaque: 0.02, filtre: 400 });
      if (croche % 2 === 1) souffle(b, temps, 0.04, { type: "highpass", f: 7000, vol: 0.025 });
      if (croche === 4) souffle(b, temps, 0.09, { f: 1800, q: 0.7, vol: 0.03 });
      if (croche % 2 === 0 && Math.random() < 0.22) ton(b, temps, freq(GAMME[Math.floor(Math.random() * GAMME.length)]), NOIRE * 1.5, { type: "sine", vol: 0.04, attaque: 0.03 });
      temps += NOIRE / 2; pas++;
    }
  }
  function majMusique() {
    if (!ctx) return;
    var actif = reglages.musique && !reduit && !document.hidden;
    busMusique.gain.cancelScheduledValues(ctx.currentTime);
    busMusique.gain.setTargetAtTime(actif ? 0.55 : 0, ctx.currentTime, 0.6);
    if (actif && !minuterie) { temps = Math.max(temps, ctx.currentTime + 0.1); minuterie = setInterval(planifier, 120); }
    if (!actif && minuterie) setTimeout(function () { if (!(reglages.musique && !document.hidden)) { clearInterval(minuterie); minuterie = null; } }, 2500);
  }

  // Le navigateur n'autorise le son qu'après un geste de l'utilisateur
  function debloquer() {
    if (!contexte()) return;
    if (ctx.state === "suspended") ctx.resume().then(majMusique); else majMusique();
  }
  ["pointerdown", "keydown"].forEach(function (ev) { document.addEventListener(ev, debloquer, { capture: true }); });
  document.addEventListener("visibilitychange", majMusique);

  TMI.Sons = {
    jouer: jouer,
    reglages: function () { return { effets: reglages.effets, musique: reglages.musique }; },
    regler: function (cle, valeur) { reglages[cle] = !!valeur; memoriser(); majMusique(); majBoutons(); },
    // couper / remettre tout le son d'un coup (bouton haut-parleur)
    basculer: function () { var on = !(reglages.effets || reglages.musique); reglages.effets = on; reglages.musique = on; memoriser(); majMusique(); majBoutons(); return on; }
  };
  function majBoutons() {
    var on = reglages.effets || reglages.musique;
    document.querySelectorAll("[data-son]").forEach(function (b) {
      b.classList.toggle("coupe", !on);
      b.setAttribute("aria-pressed", on ? "false" : "true");
      b.title = on ? "Couper le son" : "Remettre le son";
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", majBoutons); else majBoutons();
  // Boutons haut-parleur (barre du jeu, accueil), cases du menu, petit clic sur les boutons principaux
  document.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-son]")) { TMI.Sons.basculer(); return; }
    if (ev.target.closest(".bouton.principal")) jouer("clic");
  });
  document.addEventListener("change", function (ev) {
    var c = ev.target.closest("[data-reglage-son]");
    if (c) TMI.Sons.regler(c.dataset.reglageSon, c.checked);
  });
})(window);
