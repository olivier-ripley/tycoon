// Vue 3D de la salle de vente (three.js) : même plan et mêmes règles que la vue 2D (vue-magasin.js),
// mais en volumes low-poly, avec lumière, ombres, caméra libre et personnages animés.
// Tout est construit par le code (aucun fichier de modèle) : le jeu reste un simple dossier à ouvrir.
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};
  var T = root.THREE;
  if (!T) return;

  var HMUR = 3.0, EP = 0.14, ELEV = 0.62;           // hauteur des murs, épaisseur, inclinaison de la caméra (rad)
  var ZMIN = 0.7, ZMAX = 3.6;
  var COULEUR_CAT = { ordinateurs: "#2457ff", composants: "#12a150", peripheriques: "#f08a24" };
  var PEAUX = ["#f2c9a6", "#e2aa84", "#c48461", "#8f5b3c", "#f6d6bd", "#6e4430"];
  var CHEVEUX = ["#2a2a2a", "#5b3824", "#a8743f", "#d8b26a", "#1b1b1b", "#7a2f1d"];
  var PANTALONS = ["#34405a", "#3d3d3d", "#5a6b8a", "#6b4f3a"];

  function hache(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h); }
  var cacheMat = {};
  function mat(c, o) {
    o = o || {};
    var k = c + JSON.stringify(o);
    if (!cacheMat[k]) cacheMat[k] = new T.MeshStandardMaterial(Object.assign({ color: new T.Color(c), roughness: 0.75, metalness: 0.05 }, o));
    return cacheMat[k];
  }
  var cacheGeo = {};
  function boite(w, h, d) { var k = "b" + w + "," + h + "," + d; return cacheGeo[k] || (cacheGeo[k] = new T.BoxGeometry(w, h, d)); }
  function cube(parent, w, h, d, c, x, y, z, o) {
    var m = new T.Mesh(boite(w, h, d), typeof c === "string" ? mat(c, o) : c);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  // Texture de texte (enseignes, étiquettes, pastilles)
  function texteTexture(lignes, o) {
    o = o || {};
    var w = o.w || 512, h = o.h || 128, cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var ctx = cv.getContext("2d");
    if (o.fond) { ctx.fillStyle = o.fond; if (o.rond) { arrondi(ctx, 0, 0, w, h, o.rond); ctx.fill(); } else ctx.fillRect(0, 0, w, h); }
    var police = getComputedStyle(document.body).fontFamily || "sans-serif";
    lignes.forEach(function (l, i) {
      ctx.fillStyle = l.c || o.couleur || "#fff";
      ctx.font = (l.g || 800) + " " + (l.t || 48) + "px " + police;
      ctx.textAlign = o.align || "center"; ctx.textBaseline = "middle";
      ctx.fillText(l.s, o.align === "left" ? (o.marge || 24) : w / 2, l.y != null ? l.y : h / 2);
    });
    var tx = new T.CanvasTexture(cv);
    tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
    return tx;
  }
  function arrondi(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function panneau(parent, tx, w, h, x, y, z, ry) {
    var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: tx, transparent: true, roughness: 0.6 }));
    m.position.set(x, y, z); m.rotation.y = ry || 0;
    parent.add(m); return m;
  }
  function pastille(texte, fond, taille) {
    var tx = texteTexture([{ s: texte, t: 78 }], { w: 128, h: 128, fond: fond, rond: 64 });
    var sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false, transparent: true }));
    sp.scale.set(taille || 0.42, taille || 0.42, 1); sp.renderOrder = 10;
    return sp;
  }

  function cleSalle(s, piece) {
    if (piece && piece !== "magasin") return piece;
    var dc = TMI.Sim.deco(s); return [s.local, s.rayons.length, TMI.Sim.ville(s).nom, dc.sol, dc.murs].join(":");
  }
  function teinte(hex, f) {
    var c = new T.Color(hex);
    if (f < 0) c.multiplyScalar(1 + f); else c.lerp(new T.Color("#ffffff"), f);
    return "#" + c.getHexString();
  }
  function toile(n) { var cv = document.createElement("canvas"); cv.width = cv.height = n; return cv; }
  function finirTexture(cv) { var tx = new T.CanvasTexture(cv); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 8; return tx; }
  var cacheTex = {};
  function textureSol(def) {
    var k = "sol" + def.nom; if (cacheTex[k]) return cacheTex[k].clone();
    var cv = toile(128), cx = cv.getContext("2d");
    cx.fillStyle = def.c1; cx.fillRect(0, 0, 128, 128);
    if (def.motif === "lames") {
      for (var i = 0; i < 8; i++) {
        cx.fillStyle = i % 2 ? def.c2 : def.c1; cx.fillRect(0, i * 16, 128, 16);
        cx.fillStyle = "rgba(60,35,15,.25)"; cx.fillRect(0, i * 16 + 15, 128, 1); cx.fillRect(((i * 37) % 128), i * 16, 1, 16); cx.fillRect(((i * 37 + 64) % 128), i * 16, 1, 16);
      }
    } else if (def.motif === "uni") {
      for (var n = 0; n < 500; n++) { cx.fillStyle = "rgba(" + (n % 2 ? "255,255,255" : "80,85,95") + ",.06)"; cx.fillRect((n * 53) % 128, (n * 97) % 128, 3, 3); }
    } else if (def.motif === "led") {
      cx.fillStyle = def.c2; cx.fillRect(0, 0, 64, 64); cx.fillRect(64, 64, 64, 64);
      cx.strokeStyle = "#ff3d7f"; cx.lineWidth = 2; cx.strokeRect(1, 1, 126, 126);
      cx.strokeStyle = "#3dd6ff"; cx.beginPath(); cx.moveTo(0, 64); cx.lineTo(128, 64); cx.moveTo(64, 0); cx.lineTo(64, 128); cx.stroke();
    } else {
      cx.fillStyle = def.c2; cx.fillRect(0, 0, 64, 64); cx.fillRect(64, 64, 64, 64);
      cx.strokeStyle = "rgba(120,135,160,.25)"; cx.lineWidth = 2; cx.strokeRect(0, 0, 64, 64); cx.strokeRect(64, 64, 64, 64); cx.strokeRect(64, 0, 64, 64); cx.strokeRect(0, 64, 64, 64);
    }
    cacheTex[k] = finirTexture(cv);
    return cacheTex[k].clone();
  }
  function textureMur(def, f) {
    var k = "mur" + def.nom + f; if (cacheTex[k]) return cacheTex[k];
    var cv = toile(128), cx = cv.getContext("2d");
    cx.fillStyle = "#d8cfc4"; cx.fillRect(0, 0, 128, 128);
    for (var r = 0; r < 8; r++) for (var c = -1; c < 4; c++) {
      cx.fillStyle = teinte(def.c, f + ((r * 7 + c * 3) % 5 - 2) * 0.03);
      cx.fillRect(c * 40 + (r % 2) * 20 + 2, r * 16 + 2, 36, 12);
    }
    var tx = finirTexture(cv); tx.repeat.set(4, 1.5);
    return (cacheTex[k] = tx);
  }

  function Vue3D(conteneur, options) {
    this.conteneur = conteneur; this.options = options || {};
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    var mobile = root.innerWidth < 900;
    this.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    conteneur.appendChild(this.renderer.domElement);
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    this.az = Math.PI / 4; this.azCible = this.az; this.zoom = 1; this.cible = null;
    this.persos = {}; this.rayons = []; this.murs = []; this.pickables = []; this.piece = "magasin";
    this.horloge = new T.Clock();
    this.lumieres(mobile);
    this.brancher();
    var self = this;
    if (root.ResizeObserver) new ResizeObserver(function () { self.redim(); }).observe(conteneur);
    this.visible = false;
    var pas = mobile ? 1000 / 32 : 0, dernier = 0;   // ~30 images/s sur mobile pour ménager la batterie
    this.boucle = function (ts) {
      if (!self.visible) { self.raf = null; return; }
      self.raf = requestAnimationFrame(self.boucle);
      if (pas && ts - dernier < pas) return;
      dernier = ts; self.animer();
    };
  }
  var V = Vue3D.prototype;

  V.lumieres = function (mobile) {
    this.scene.add(new T.HemisphereLight(0xffffff, 0xbfc8d6, 1.15));
    var sol = new T.DirectionalLight(0xfff1dc, 2.2);
    sol.castShadow = true;
    sol.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.02; sol.shadow.radius = 3;
    this.soleil = sol;
    this.scene.add(sol); this.scene.add(sol.target);
  };

  // ------------------------------------------------------------ Affichage, taille, caméra
  V.afficher = function (oui) {
    this.visible = oui;
    this.conteneur.hidden = !oui;
    if (oui) { this.redim(); if (!this.raf) this.raf = requestAnimationFrame(this.boucle); }
  };
  V.redim = function () {
    var r = this.conteneur.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.aspect = r.width / r.height;
    this.cadrer();
  };
  V.cadrer = function () {
    if (!this.plan) return;
    var X = this.plan.dim.x, Y = this.plan.dim.y, taille = Math.max(X, Y) * 0.78 + 2.5;
    var a = this.aspect || 1.5, c = this.camera;
    var h = a >= 1.25 ? taille * 0.62 : taille / a * 0.62;
    c.left = -h * a; c.right = h * a; c.top = h; c.bottom = -h;
    c.zoom = this.zoom;
    if (!this.cible) this.cible = new T.Vector3(X / 2, 0.6, Y / 2);
    var d = 60;
    c.position.set(this.cible.x + Math.sin(this.az) * Math.cos(ELEV) * d, this.cible.y + Math.sin(ELEV) * d, this.cible.z + Math.cos(this.az) * Math.cos(ELEV) * d);
    c.lookAt(this.cible);
    c.updateProjectionMatrix();
    // soleil : toujours du même côté de la caméra pour garder de belles ombres
    var s = this.soleil, m = Math.max(X, Y);
    s.position.set(X / 2 + Math.sin(this.az - 0.9) * 14, 18, Y / 2 + Math.cos(this.az - 0.9) * 14);
    s.target.position.set(X / 2, 0, Y / 2);
    s.shadow.camera.left = -m; s.shadow.camera.right = m; s.shadow.camera.top = m; s.shadow.camera.bottom = -m;
    s.shadow.camera.near = 1; s.shadow.camera.far = 60;
    s.shadow.camera.updateProjectionMatrix();
    // murs : on masque ceux qui sont entre la caméra et la boutique
    var hx = Math.sin(this.az), hz = Math.cos(this.az);
    this.murs.forEach(function (w) { w.g.visible = w.nx * hx + w.nz * hz < 0.2; });
  };
  V.zoomer = function (f) { this.zoom = Math.max(ZMIN, Math.min(ZMAX, this.zoom * f)); this.cadrer(); };
  V.recentrer = function () { this.zoom = 1; this.cible = null; this.cadrer(); };
  V.tourner = function (sens) { this.azCible += (sens > 0 ? 1 : -1) * Math.PI / 2; };

  V.brancher = function () {
    var self = this, el = this.renderer.domElement, pts = {}, dep = null, bouge = false, tournePar = false;
    el.style.touchAction = "none";
    el.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
    el.addEventListener("wheel", function (ev) { ev.preventDefault(); self.zoomer(Math.exp(-ev.deltaY * 0.0015)); }, { passive: false });
    function geste() {
      var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]];
      return ids.length >= 2 ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), n: 2 } : { x: a.x, y: a.y, d: 0, n: 1 };
    }
    function depart() { dep = geste(); dep.zoom = self.zoom; dep.az = self.azCible; dep.cible = self.cible ? self.cible.clone() : null; }
    el.addEventListener("pointerdown", function (ev) {
      pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      tournePar = ev.button === 2 || ev.shiftKey;
      depart(); if (dep.n === 1) bouge = false;
    });
    el.addEventListener("pointermove", function (ev) {
      if (!pts[ev.pointerId]) { if (self.pose && ev.pointerType === "mouse") self.suivrePointeur(ev); return; }
      pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var g = geste();
      if (g.n !== dep.n) { depart(); return; }
      if (!bouge && Math.hypot(g.x - dep.x, g.y - dep.y) < 6 && g.n === 1) return;
      if (!bouge) { bouge = true; try { el.setPointerCapture(ev.pointerId); } catch (e) {} }
      if (g.n >= 2) {   // deux doigts : pincer pour zoomer, tourner pour pivoter
        if (dep.d > 0) self.zoom = Math.max(ZMIN, Math.min(ZMAX, dep.zoom * g.d / dep.d));
        self.az = self.azCible = dep.az - (g.ang - dep.ang);
        self.cadrer(); return;
      }
      if (tournePar) { self.az = self.azCible = dep.az - (g.x - dep.x) * 0.008; self.cadrer(); return; }
      // glisser : déplacer la caméra sur le sol
      var c = self.camera, r = el.getBoundingClientRect();
      var parPx = (c.top - c.bottom) / c.zoom / r.height;
      var dx = (g.x - dep.x) * parPx, dy = (g.y - dep.y) * parPx / Math.sin(ELEV);
      var cx = Math.cos(self.az), cz = -Math.sin(self.az);           // droite de l'écran sur le sol
      var fx = -Math.sin(self.az), fz = -Math.cos(self.az);          // vers le fond de l'écran
      self.cible.x = dep.cible.x - dx * cx + dy * fx;
      self.cible.z = dep.cible.z - dx * cz + dy * fz;
      var X = self.plan.dim.x, Y = self.plan.dim.y;
      self.cible.x = Math.max(-2, Math.min(X + 2, self.cible.x)); self.cible.z = Math.max(-2, Math.min(Y + 2, self.cible.z));
      self.cadrer();
    });
    function fin(ev) {
      var clic = !bouge && Object.keys(pts).length === 1;
      delete pts[ev.pointerId];
      if (Object.keys(pts).length) depart();
      if (clic && ev.type === "pointerup" && ev.button !== 2) {
        if (self.pose) {
          self.suivrePointeur(ev);
          if (ev.pointerType === "mouse" && self.pose.valide && self.pose.valide.ok && self.options.surPoser) self.options.surPoser(self.pose);
        } else self.choisir(ev);
      }
    }
    el.addEventListener("pointerup", fin);
    el.addEventListener("pointercancel", fin);
  };
  // Clic : rayon, porte ou meuble
  V.choisir = function (ev) {
    var r = this.renderer.domElement.getBoundingClientRect();
    var p = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    var ray = new T.Raycaster(); ray.setFromCamera(p, this.camera);
    var hits = ray.intersectObjects(this.pickables, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      while (o && !o.userData.action) o = o.parent;
      if (!o || (o.parent && !visibleDansScene(o))) continue;
      var a = o.userData.action;
      if (a.deco && this.options.surDeco) this.options.surDeco(a.deco);
      else if (a.rayon != null && this.options.surRayon) this.options.surRayon(a.rayon);
      else if (a.cible && this.options.surCible) this.options.surCible(a.cible);
      return;
    }
  };
  function visibleDansScene(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }

  // ------------------------------------------------------------ Construction de la salle
  V.construire = function (s) {
    if (this.piece && this.piece !== "magasin") return this.construirePiece(s);
    if (this.racine) this.scene.remove(this.racine);
    var R = this.racine = new T.Group();
    this.scene.add(R);
    var P = this.plan = TMI.PlanMagasin(s.local, s.rayons.length), X = P.dim.x, Y = P.dim.y, self = this;
    this.murs = []; this.pickables = []; this.rayons = []; this.persos = {};
    var DC = TMI.Sim.deco(s), DD = root.TMI_DATA.deco;
    var defSol = DD.sols[DC.sol] || DD.sols.carrelage;
    this.defMur = DD.murs[DC.murs] || DD.murs.blanc;
    var tx = textureSol(defSol); tx.repeat.set(X / 2, Y / 2);
    var sol = new T.Mesh(new T.BoxGeometry(X, 0.25, Y), [mat("#9ea9ba"), mat("#9ea9ba"), new T.MeshStandardMaterial({ map: tx, roughness: defSol.motif === "uni" ? 0.35 : 0.55, emissive: defSol.motif === "led" ? new T.Color("#ffffff") : new T.Color(0), emissiveMap: defSol.motif === "led" ? tx : null, emissiveIntensity: defSol.motif === "led" ? 0.35 : 0 }), mat("#9ea9ba"), mat("#b6c0ce"), mat("#b6c0ce")]);
    sol.position.set(X / 2, -0.125, Y / 2); sol.receiveShadow = true; R.add(sol);
    // allées éclairées et zone atelier
    var A = P.atelier;
    var zoneA = new T.Mesh(new T.PlaneGeometry(X - A.x, A.d), mat("#d8e4f0", { roughness: 0.4 }));
    zoneA.rotation.x = -Math.PI / 2; zoneA.position.set(A.x + (X - A.x) / 2, 0.006, A.d / 2); zoneA.receiveShadow = true; R.add(zoneA);
    var tapis = new T.Mesh(new T.PlaneGeometry(P.porte.l - 0.2, 1.0), mat("#3a4150"));
    tapis.rotation.x = -Math.PI / 2; tapis.position.set(P.porte.x + P.porte.l / 2, 0.008, Y - 0.55); tapis.receiveShadow = true; R.add(tapis);
    // murs
    this.mur(R, "N", 0, 0, X, 0, 0, 0, -1, s);
    this.mur(R, "O", 0, 0, 0, Y, -1, 0, 0, s);
    this.mur(R, "S", 0, Y, X, Y, 0, 0, 1, s);
    this.mur(R, "E", X, 0, X, Y, 1, 0, 0, s);
    // rayons
    P.rayons.forEach(function (r, i) {
      var g = new T.Group(); g.position.set(r.x, 0, r.y); g.userData.action = { rayon: i };
      R.add(g); self.pickables.push(g);
      self.rayons.push({ g: g, r: r, cle: null });
    });
    this.caisse(R, P); this.table(R, P); this.atelier(R, P, X);
    this.decoGroupe = new T.Group(); R.add(this.decoGroupe); this.decoSig = null; this.decoMeshes = {};
    this.nomVille = TMI.Sim.ville(s).nom;
    this.cle = cleSalle(s, "magasin");
    this.cible = null;
    this.cadrer();
  };

  V.mur = function (R, cote, x1, z1, x2, z2, nx, ny, nz, s) {
    var g = new T.Group(), P = this.plan, X = P.dim.x, Y = P.dim.y, long = Math.hypot(x2 - x1, z2 - z1);
    var horiz = z1 === z2, dm = this.defMur, coul = teinte(dm.c, horiz ? 0 : -0.08);
    if (dm.motif) { var tm = textureMur(dm, horiz ? 0 : -0.08).clone(); tm.repeat.set(long / 2.2, HMUR / 1.4); tm.needsUpdate = true; coul = new T.MeshStandardMaterial({ map: tm, roughness: 0.85 }); }
    var cxm = (x1 + x2) / 2 + nx * EP / 2, czm = (z1 + z2) / 2 + nz * EP / 2;
    var w = horiz ? long + EP * 2 : EP, d = horiz ? EP : long + EP * 2;
    var self = this, ry = horiz ? (nz < 0 ? 0 : Math.PI) : (nx < 0 ? Math.PI / 2 : -Math.PI / 2);   // orientation des décors (face intérieure)
    var dans = function (u, h) { return horiz ? [u, h, z1 - nz * 0.02] : [x1 - nx * 0.02, h, u]; };    // point sur la face intérieure
    if (cote === "S") {
      // devanture vitrée et porte d'entrée
      cube(g, w, 0.35, d, "#c3ccd9", cxm, 0.175, czm);
      cube(g, w, 0.5, d, "#1b2440", cxm, HMUR - 0.25, czm);
      var verre = new T.MeshPhysicalMaterial({ color: 0xcde4f4, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, transmission: 0 });
      var pg = new T.Mesh(new T.BoxGeometry(P.porte.x, HMUR - 0.85, 0.04), verre); pg.position.set(P.porte.x / 2, 0.35 + (HMUR - 0.85) / 2, Y); g.add(pg);
      var lg = X - P.porte.x - P.porte.l;
      var pd = new T.Mesh(new T.BoxGeometry(lg, HMUR - 0.85, 0.04), verre); pd.position.set(P.porte.x + P.porte.l + lg / 2, 0.35 + (HMUR - 0.85) / 2, Y); g.add(pd);
      for (var px = 0; px <= X; px += 3) cube(g, 0.08, HMUR - 0.85, 0.1, "#8f9bb0", Math.min(px, X - 0.04), 0.35 + (HMUR - 0.85) / 2, Y);
      cube(g, 0.1, HMUR - 0.5, 0.12, "#8f9bb0", P.porte.x, (HMUR - 0.5) / 2, Y);
      cube(g, 0.1, HMUR - 0.5, 0.12, "#8f9bb0", P.porte.x + P.porte.l, (HMUR - 0.5) / 2, Y);
    } else {
      var m = cube(g, w, HMUR, d, coul, cxm, HMUR / 2, czm);
      m.castShadow = false;
      cube(g, horiz ? long : EP + 0.02, 0.16, horiz ? EP + 0.02 : long, "#c3ccd9", cxm - nx * 0.01, 0.08, czm - nz * 0.01);
    }
    cube(g, w + 0.02, 0.08, d + 0.02, "#8f9bb0", cxm, HMUR + 0.04, czm);
    var p;
    if (cote === "N") {
      var nom = "INFORMATIQUE · " + TMI.Sim.ville(s).nom.toUpperCase();
      var tx = texteTexture([{ s: "INFO SERVICE", t: 70, y: 52 }, { s: nom, t: 30, g: 600, c: "#9fb3ff", y: 104 }], { w: 768, h: 140, fond: "#1b2440", rond: 18 });
      p = dans(5.2, 2.35); panneau(g, tx, 4.2, 0.77, p[0], p[1], p[2], ry);
      var logo = texteTexture([{ s: "▣", t: 80 }], { w: 128, h: 128, fond: "#ff7a1a", rond: 26 });
      p = dans(2.75, 2.35); panneau(g, logo, 0.55, 0.55, p[0], p[1], p[2] + 0.005, ry);
    }
    if (cote === "O") {
      [[0.42, 1.52, "RÉSERVE", "reserve"], [2.25, 3.35, "BUREAU", "bureau"]].forEach(function (pt) {
        var mid = (pt[0] + pt[1]) / 2, porte = new T.Group();
        var q = dans(mid, 1.05);
        var battant = cube(porte, 0.06, 2.1, pt[1] - pt[0], "#c7ced9", q[0] + 0.03, 1.05, q[2]);
        battant.castShadow = false;
        cube(porte, 0.08, 0.5, (pt[1] - pt[0]) * 0.55, "#cde4f4", q[0] + 0.07, 1.6, q[2], { roughness: 0.1 });
        cube(porte, 0.1, 0.06, 0.06, "#5b6578", q[0] + 0.09, 1.0, q[2] + (pt[1] - pt[0]) * 0.33);
        var lab = texteTexture([{ s: pt[2], t: 44 }], { w: 256, h: 72, fond: "#1b2440", rond: 14 });
        q = dans(mid, 2.4); panneau(porte, lab, 1.0, 0.28, q[0] + 0.02, q[1], q[2], ry);
        porte.userData.action = { cible: { piece: pt[3] } };
        self.pickables.push(porte);
        g.add(porte);
      });
      // fenêtre
      var f = dans(7.25, 1.6); cube(g, 0.04, 1.6, 2.9, "#cde4f4", f[0] + 0.02, f[1], f[2], { roughness: 0.05, metalness: 0.1 });
      cube(g, 0.06, 1.7, 0.08, "#8f9bb0", f[0] + 0.03, f[1], f[2]);
      // horloge
      this.cadran = texteTexture([{ s: "", t: 10 }], { w: 128, h: 128 });
      var hp = dans(Math.min(9.4, Y - 0.6), 2.35); this.panHorloge = panneau(g, this.cadran, 0.6, 0.6, hp[0], hp[1], hp[2], ry);
    }
    this.racine.add(g);
    this.murs.push({ g: g, nx: nx, nz: nz, cote: cote });
  };

  V.caisse = function (R, P) {
    var C = P.caisse, g = new T.Group();
    g.position.set(C.x, 0, C.y);
    cube(g, C.w, 0.95, C.d, "#c8a77f", C.w / 2, 0.475, C.d / 2);
    cube(g, C.w + 0.1, 0.06, C.d + 0.1, "#e8d9c3", C.w / 2, 0.98, C.d / 2);
    cube(g, C.w, 0.18, 0.02, "#3a4150", C.w / 2, 0.75, C.d + 0.005);
    cube(g, 0.12, 0.2, 0.1, "#2c2f36", 1.65, 1.1, 0.4);
    var ecran = cube(g, 0.5, 0.36, 0.04, "#1b2233", 1.65, 1.35, 0.4); ecran.rotation.x = -0.15;
    cube(g, 0.42, 0.28, 0.01, "#5ad1ff", 1.65, 1.35, 0.425, { emissive: new T.Color("#2a7fb0"), emissiveIntensity: 0.6 }).rotation.x = -0.15;
    cube(g, 0.35, 0.12, 0.3, "#9aa4b1", 0.55, 1.07, 0.4);
    var lab = texteTexture([{ s: "CAISSE", t: 48 }], { w: 256, h: 64 });
    panneau(g, lab, 1.1, 0.27, C.w / 2, 0.75, C.d + 0.02, 0);
    R.add(g);
  };
  V.table = function (R, P) {
    var Tb = P.table, g = new T.Group(), self = this;
    g.position.set(Tb.x, 0, Tb.y);
    [[0.25, 0.1], [Tb.w - 0.25, 0.1], [0.25, Tb.d - 0.1], [Tb.w - 0.25, Tb.d - 0.1]].forEach(function (q) { cube(g, 0.07, 0.75, 0.07, "#8f9bb0", q[0], 0.375, q[1]); });
    cube(g, Tb.w, 0.06, Tb.d, "#ffffff", Tb.w / 2, 0.78, Tb.d / 2);
    [[0.55, "#9aa4b1"], [1.45, "#2c2f36"], [2.35, "#9aa4b1"]].forEach(function (q) { self.portable(g, q[1], q[0], 0.81, Tb.d / 2, q[1] === "#2c2f36"); });
    var lab = texteTexture([{ s: "ESSAIE-MOI", t: 40, c: "#5b6578" }], { w: 256, h: 64 });
    panneau(g, lab, 1.2, 0.3, Tb.w / 2, 0.6, Tb.d + 0.04, 0);
    R.add(g);
  };
  V.atelier = function (R, P, X) {
    var A = P.atelier, g = new T.Group(), dx = P.DX, H = 2.3;
    var verre = new T.MeshPhysicalMaterial({ color: 0xa9d2f0, transparent: true, opacity: 0.22, roughness: 0.05 });
    var v1 = new T.Mesh(new T.BoxGeometry(0.04, H, A.d), verre); v1.position.set(A.x, H / 2, A.d / 2); g.add(v1);
    var v2 = new T.Mesh(new T.BoxGeometry(X - A.x, H, 0.04), verre); v2.position.set(A.x + (X - A.x) / 2, H / 2, A.d); g.add(v2);
    cube(g, 0.06, H, 0.06, "#93c1e4", A.x, H / 2, A.d); cube(g, X - A.x, 0.06, 0.06, "#93c1e4", A.x + (X - A.x) / 2, H, A.d); cube(g, 0.06, 0.06, A.d, "#93c1e4", A.x, H, A.d / 2);
    // établi, armoire, PC en montage
    var et = new T.Group(); et.position.set(11.4 + dx, 0, 0.4);
    cube(et, 2.2, 0.9, 0.9, "#8a6a4a", 1.1, 0.45, 0.45);
    cube(et, 2.3, 0.06, 1.0, "#b08a62", 1.1, 0.93, 0.45);
    cube(et, 0.6, 0.35, 0.5, "#3a4150", 0.5, 1.13, 0.45);
    cube(et, 0.3, 0.5, 0.5, "#2c2f36", 1.15, 1.2, 0.45);
    cube(et, 0.02, 0.3, 0.3, "#ff3d7f", 1.15, 1.2, 0.71, { emissive: new T.Color("#ff3d7f"), emissiveIntensity: 0.5 });
    cube(et, 0.5, 0.45, 0.4, "#d4d9e1", 1.75, 1.18, 0.45);
    g.add(et);
    cube(g, 0.7, 1.7, 1.5, "#c9ced8", 13.45 + dx, 0.85, 2.95);
    var lab = texteTexture([{ s: "ATELIER", t: 52, y: 44 }, { s: "montage · réparation", t: 26, g: 500, c: "#c9d3ff", y: 92 }], { w: 320, h: 120, fond: "#1b2440", rond: 14 });
    panneau(g, lab, 1.5, 0.56, A.x + (X - A.x) / 2, H + 0.4, A.d + 0.03, 0);
    g.userData.action = { cible: { piece: "magasin", onglet: "atelier" } };
    this.pickables.push(g);
    R.add(g);
  };
  V.plante = function (R, x, z) {
    var g = new T.Group(); g.position.set(x, 0, z);
    var pot = new T.Mesh(new T.CylinderGeometry(0.24, 0.19, 0.42, 10), mat("#b5643c")); pot.position.y = 0.21; pot.castShadow = true; g.add(pot);
    var geo = new T.IcosahedronGeometry(0.34, 0);
    [[0, 0.75, 0, 1], [0.16, 0.95, 0.08, 0.75], [-0.14, 1.05, -0.06, 0.7]].forEach(function (q) {
      var f = new T.Mesh(geo, mat(q[3] > 0.8 ? "#2f7d48" : "#3f9b5a", { flatShading: true })); f.position.set(q[0], q[1], q[2]); f.scale.setScalar(q[3]); f.castShadow = true; g.add(f);
    });
    R.add(g);
  };

  // ------------------------------------------------------------ Produits
  V.portable = function (g, c, x, y, z, gaming) {
    var b = cube(g, 0.36, 0.025, 0.25, c, x, y + 0.0125, z);
    var e = cube(g, 0.36, 0.24, 0.02, c, x, y + 0.13, z - 0.12); e.rotation.x = -0.25;
    var s = cube(g, 0.32, 0.2, 0.005, gaming ? "#3b1a3a" : "#6fb7ff", x, y + 0.13, z - 0.108, { emissive: new T.Color(gaming ? "#ff3d7f" : "#3d8fe0"), emissiveIntensity: 0.35 });
    s.rotation.x = -0.25;
    return b;
  };
  V.produit = function (g, p, x, y, z) {
    var f = TMI.FormesProduits[p.typeId] || { type: "boite", c: "#999" };
    if (f.type === "portable") return this.portable(g, f.c, x, y, z, !!f.led);
    if (f.type === "tour") { cube(g, 0.16, 0.36, 0.3, f.c, x, y + 0.18, z); cube(g, 0.005, 0.25, 0.02, "#5ad1ff", x + 0.081, y + 0.2, z + 0.1, { emissive: new T.Color("#5ad1ff"), emissiveIntensity: 0.5 }); return; }
    if (f.type === "ecran") {
      cube(g, 0.08, 0.12, 0.06, "#555b66", x, y + 0.06, z);
      cube(g, 0.4, 0.26, 0.025, f.c, x, y + 0.24, z + 0.02);
      cube(g, 0.36, 0.22, 0.005, "#4aa3ff", x, y + 0.24, z + 0.034, { emissive: new T.Color("#2a6fc0"), emissiveIntensity: 0.4 });
      return;
    }
    var h = (f.hh || 6) / 40;
    cube(g, 0.28, h + 0.05, 0.2, f.c, x, y + (h + 0.05) / 2, z);
    cube(g, 0.282, 0.04, 0.202, "#ffffff", x, y + (h + 0.05) * 0.7, z, { roughness: 0.4 });
  };
  V.majRayon = function (s, i) {
    var R = this.rayons[i], r = R.r, pid = s.rayons[i], Sim = TMI.Sim;
    var n = pid ? Math.max(0, s.stock[pid] || 0) : 0, prix = pid ? Sim.prixVente(s, pid) : 0;
    var cle = (pid || "-") + ":" + Math.min(n, 8) + ":" + n + ":" + prix;
    if (R.cle === cle) return;
    R.cle = cle;
    var g = R.g;
    while (g.children.length) g.remove(g.children[0]);
    var w = r.w, d = r.d;
    if (!pid) {
      cube(g, w, 0.2, d, "#e3e8ef", w / 2, 0.1, d / 2);
      var plus = pastille("+", "#2457ff", 0.45); plus.position.set(w / 2, 0.6, d / 2); g.add(plus);
      return;
    }
    var p = Sim.produit(pid), cat = COULEUR_CAT[p.categorie];
    // gondole : socle, dos, étagères, bandeau de catégorie
    cube(g, w, 0.16, d, "#c9d1dc", w / 2, 0.08, d / 2);
    cube(g, w, 1.45, 0.06, "#f4f6f9", w / 2, 0.72, d / 2);
    [0.55, 1.0].forEach(function (y) { cube(g, w, 0.035, d, "#ffffff", w / 2, y, d / 2); });
    cube(g, w, 0.16, 0.08, cat, w / 2, 1.52, d / 2);
    // étiquette côté allée
    var et = texteTexture([{ s: (TMI.Libelles.court[p.typeId] || p.typeNom).toUpperCase(), t: 40, c: n ? "#151b2b" : "#d6334a", y: 30 }, { s: TMI.Libelles.gamme[p.gamme] + " · " + prix + " €", t: 32, g: 600, c: "#5b6578", y: 74 }],
      { w: 384, h: 100, fond: n ? "#ffffff" : "#fdecef", rond: 10 });
    panneau(g, et, Math.min(w * 0.9, 1.8), 0.47, w / 2, 0.29, d + 0.005, 0);
    // produits : une unité par place, jusqu'à 8, sur les deux étagères côté allée
    var nb = Math.min(n, 8);
    for (var k = 0; k < nb; k++) {
      var niv = k < 4 ? 0 : 1, place = k % 4;
      this.produit(g, p, 0.3 + place * (w - 0.6) / 3, niv ? 1.02 : 0.57, d * 0.7);
    }
    if (n === 0) { var ex = pastille("!", "#d6334a", 0.42); ex.position.set(w / 2, 1.95, d / 2); g.add(ex); }
    var badge = pastille(n > 99 ? "99+" : String(n), n === 0 ? "#d6334a" : n <= 2 ? "#d29922" : "#1f2a44", 0.34);
    badge.position.set(w - 0.05, 1.75, d); g.add(badge);
  };


  // ------------------------------------------------------------ Déco : modèles
  // Chaque modèle est construit centré sur l'origine, dans son emprise d'origine (taille[0] × taille[1]).
  var MODELES = {
    plante: function (g) { plante(g, 0, 0, 1); },
    grande_plante: function (g) {
      var pot = new T.Mesh(new T.CylinderGeometry(0.3, 0.24, 0.5, 12), mat("#e7e2da")); pot.position.y = 0.25; pot.castShadow = true; g.add(pot);
      cube(g, 0.06, 0.9, 0.06, "#6b4a2f", 0, 0.9, 0);
      var geo = new T.IcosahedronGeometry(0.42, 0);
      [[0, 1.5, 0, 1], [0.2, 1.75, 0.1, 0.8], [-0.18, 1.85, -0.1, 0.75], [0.05, 2.05, 0, 0.6]].forEach(function (q) {
        var f = new T.Mesh(geo, mat(q[3] > 0.85 ? "#2f7d48" : "#3f9b5a", { flatShading: true })); f.position.set(q[0], q[1], q[2]); f.scale.setScalar(q[3]); f.castShadow = true; g.add(f);
      });
    },
    banc: function (g) {
      [-0.75, 0.75].forEach(function (x) { cube(g, 0.08, 0.42, 0.36, "#3a4150", x, 0.21, 0); });
      for (var i = 0; i < 4; i++) cube(g, 1.8, 0.05, 0.08, "#b08a62", 0, 0.45, -0.15 + i * 0.1);
    },
    canape: function (g) {
      cube(g, 1.8, 0.3, 0.75, "#2f8f8a", 0, 0.25, 0.02);
      cube(g, 1.8, 0.55, 0.18, "#287a76", 0, 0.62, -0.3);
      [-0.85, 0.85].forEach(function (x) { cube(g, 0.16, 0.5, 0.75, "#287a76", x, 0.35, 0.02); });
      [-0.42, 0.42].forEach(function (x) { cube(g, 0.8, 0.12, 0.6, "#3aa7a1", x, 0.46, 0.06); });
      [-0.8, 0.8].forEach(function (x) { cube(g, 0.06, 0.1, 0.06, "#2c2f36", x, 0.05, 0.3); cube(g, 0.06, 0.1, 0.06, "#2c2f36", x, 0.05, -0.3); });
    },
    cafe: function (g) {
      cube(g, 0.7, 0.9, 0.5, "#e9ecf1", 0, 0.45, 0);
      cube(g, 0.55, 0.6, 0.42, "#2c2f36", 0, 1.2, -0.02);
      cube(g, 0.3, 0.14, 0.01, "#ffcf6e", 0, 1.35, 0.2, { emissive: new T.Color("#ffb020"), emissiveIntensity: 0.6 });
      [-0.15, 0.05].forEach(function (x) { var t = new T.Mesh(new T.CylinderGeometry(0.05, 0.04, 0.1, 10), mat("#ffffff")); t.position.set(x, 0.95, 0.12); g.add(t); });
    },
    aquarium: function (g) {
      cube(g, 0.85, 0.7, 0.55, "#1b2440", 0, 0.35, 0);
      var eau = cube(g, 0.8, 0.6, 0.5, "#3aa0e0", 0, 1.0, 0, { transparent: true, opacity: 0.55, roughness: 0.05, emissive: new T.Color("#1a5f9a"), emissiveIntensity: 0.4 });
      eau.castShadow = false;
      [[-0.2, 1.0, 0.05, "#ff7a1a"], [0.15, 1.12, -0.08, "#ffd23d"], [0.05, 0.86, 0.1, "#ff3d7f"]].forEach(function (q) { cube(g, 0.1, 0.05, 0.03, q[3], q[0], q[1], q[2]); });
      cube(g, 0.84, 0.04, 0.54, "#1b2440", 0, 1.32, 0);
    },
    lampadaire: function (g) {
      cube(g, 0.32, 0.04, 0.32, "#2c2f36", 0, 0.02, 0);
      cube(g, 0.04, 1.75, 0.04, "#2c2f36", 0, 0.9, 0);
      var abat = new T.Mesh(new T.CylinderGeometry(0.16, 0.26, 0.3, 14, 1, true), mat("#fff3d6", { emissive: new T.Color("#ffd27a"), emissiveIntensity: 0.9, side: T.DoubleSide }));
      abat.position.y = 1.85; g.add(abat);
    },
    neon: function (g) {
      cube(g, 0.5, 0.06, 0.3, "#2c2f36", 0, 0.03, 0);
      cube(g, 0.05, 1.1, 0.05, "#2c2f36", 0, 0.6, 0);
      var tx = texteTexture([{ s: "OPEN", t: 92, c: "#ff4fa0" }], { w: 256, h: 128, fond: "rgba(20,10,30,.92)", rond: 30 });
      var p = new T.Mesh(new T.PlaneGeometry(0.9, 0.45), new T.MeshBasicMaterial({ map: tx, transparent: true, side: T.DoubleSide }));
      p.position.set(0, 1.45, 0); g.add(p);
    },
    chevalet: function (g) {
      var a = cube(g, 0.05, 1.2, 0.05, "#8a6a4a", 0, 0.58, 0.2); a.rotation.x = -0.25;
      var b = cube(g, 0.05, 1.2, 0.05, "#8a6a4a", 0, 0.58, -0.2); b.rotation.x = 0.25;
      var tx = texteTexture([{ s: "PROMO", t: 54, c: "#ffffff", y: 50 }, { s: "−20 %", t: 66, c: "#ffe14d", y: 120 }, { s: "cette semaine", t: 26, g: 600, c: "#ffd7d7", y: 178 }], { w: 200, h: 220, fond: "#d6334a" });
      var p = new T.Mesh(new T.PlaneGeometry(0.62, 0.7), new T.MeshStandardMaterial({ map: tx, side: T.DoubleSide, roughness: 0.6 }));
      p.position.set(0, 0.85, 0.16); p.rotation.x = -0.25; p.castShadow = true; g.add(p);
    },
    ecran_pub: function (g) {
      cube(g, 0.5, 0.06, 0.4, "#2c2f36", 0, 0.03, 0);
      cube(g, 0.1, 1.1, 0.1, "#3a4150", 0, 0.6, 0);
      cube(g, 0.95, 1.4, 0.08, "#1b2233", 0, 1.75, 0);
      var tx = texteTexture([{ s: "NOUVEAUTÉS", t: 40, c: "#ffffff", y: 50 }, { s: "PC GAMING", t: 56, c: "#5ad1ff", y: 150 }, { s: "en rayon", t: 32, g: 600, c: "#c9d3ff", y: 220 }], { w: 256, h: 300, fond: "#20307a" });
      var p = new T.Mesh(new T.PlaneGeometry(0.85, 1.3), new T.MeshBasicMaterial({ map: tx }));
      p.position.set(0, 1.75, 0.045); g.add(p);
    },
    borne_jeu: function (g) {
      cube(g, 0.7, 1.0, 0.65, "#4b2a8a", 0, 0.5, 0);
      cube(g, 0.7, 0.75, 0.4, "#4b2a8a", 0, 1.38, -0.12);
      var e = cube(g, 0.56, 0.42, 0.02, "#111", 0, 1.38, 0.09, { emissive: new T.Color("#3dd6ff"), emissiveIntensity: 0.8 }); e.rotation.x = -0.2;
      var pan = cube(g, 0.7, 0.05, 0.3, "#2c2f36", 0, 1.02, 0.2); pan.rotation.x = 0.25;
      [["#ff3d7f", -0.15], ["#ffe14d", 0.0], ["#3dd6ff", 0.12]].forEach(function (q) { cube(g, 0.06, 0.04, 0.06, q[0], q[1], 1.07, 0.22); });
      cube(g, 0.7, 0.14, 0.02, "#ff3d7f", 0, 1.83, 0.09, { emissive: new T.Color("#ff3d7f"), emissiveIntensity: 0.7 });
    },
    coin_gaming: function (g) {
      cube(g, 1.9, 0.02, 1.9, "#1b1d2b", 0, 0.01, 0).castShadow = false;
      cube(g, 1.9, 0.021, 0.04, "#ff3d7f", 0, 0.012, -0.93, { emissive: new T.Color("#ff3d7f"), emissiveIntensity: 0.8 });
      cube(g, 1.4, 0.05, 0.65, "#2c2f36", 0, 0.75, -0.55);
      [-0.6, 0.6].forEach(function (x) { cube(g, 0.05, 0.75, 0.6, "#2c2f36", x, 0.375, -0.55); });
      cube(g, 0.75, 0.42, 0.04, "#111", 0, 1.08, -0.75, { emissive: new T.Color("#7a3dff"), emissiveIntensity: 0.6 });
      cube(g, 0.22, 0.48, 0.45, "#111", 0.55, 1.02, -0.6);
      cube(g, 0.005, 0.38, 0.35, "#3dd6ff", 0.441, 1.02, -0.6, { emissive: new T.Color("#3dd6ff"), emissiveIntensity: 0.9 });
      cube(g, 0.5, 0.08, 0.5, "#c8102e", 0, 0.48, 0.25);
      cube(g, 0.5, 0.7, 0.1, "#c8102e", 0, 0.85, 0.48);
      cube(g, 0.08, 0.44, 0.08, "#2c2f36", 0, 0.22, 0.25);
    },
    coin_pro: function (g) {
      cube(g, 1.9, 0.02, 1.9, "#8b95a7", 0, 0.01, 0).castShadow = false;
      cube(g, 1.5, 0.05, 0.7, "#e9e3d8", 0, 0.75, -0.5);
      [-0.68, 0.68].forEach(function (x) { cube(g, 0.06, 0.75, 0.6, "#5b6578", x, 0.375, -0.5); });
      [-0.33, 0.33].forEach(function (x) { cube(g, 0.08, 0.2, 0.06, "#555b66", x, 0.88, -0.7); cube(g, 0.6, 0.36, 0.03, "#23262d", x, 1.13, -0.7); cube(g, 0.55, 0.31, 0.005, "#4aa3ff", x, 1.13, -0.684, { emissive: new T.Color("#2a6fc0"), emissiveIntensity: 0.4 }); });
      cube(g, 0.5, 0.08, 0.5, "#2c2f36", 0, 0.48, 0.3); cube(g, 0.5, 0.6, 0.08, "#2c2f36", 0, 0.82, 0.52);
      cube(g, 0.06, 0.44, 0.06, "#9aa4b1", 0, 0.22, 0.3);
    },
    coin_etudiant: function (g) {
      cube(g, 1.9, 0.02, 1.9, "#f2e6c9", 0, 0.01, 0).castShadow = false;
      var pied = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1.0, 8), mat("#3a4150")); pied.position.set(0, 0.5, -0.1); pied.castShadow = true; g.add(pied);
      var plateau = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 0.05, 20), mat("#ffffff")); plateau.position.set(0, 1.02, -0.1); plateau.castShadow = true; g.add(plateau);
      V.portable(g, "#9aa4b1", 0.1, 1.05, -0.05, false);
      [[-0.6, 0.45, "#ff7a1a"], [0.6, 0.45, "#2457ff"], [0, 0.7, "#12a150"], [-0.55, -0.6, "#7b4fd6"]].forEach(function (q) {
        var p = new T.Mesh(new T.CylinderGeometry(0.22, 0.25, 0.38, 14), mat(q[2])); p.position.set(q[0], 0.19, q[1]); p.castShadow = true; g.add(p);
      });
    },
    coin_famille: function (g) {
      [["#ffcf3d", -0.47, -0.47], ["#3dd6a0", 0.47, -0.47], ["#ff7a9a", -0.47, 0.47], ["#5aa8ff", 0.47, 0.47]].forEach(function (q) { cube(g, 0.94, 0.04, 0.94, q[0], q[1], 0.02, q[2]).castShadow = false; });
      [[-0.4, 0.2, "#ff3d3d"], [-0.15, 0.25, "#2457ff"], [-0.3, 0.45, "#12a150"]].forEach(function (q, i) { cube(g, 0.24, 0.24, 0.24, q[2], q[0], 0.16 + (i === 2 ? 0.24 : 0), i === 2 ? 0.22 : q[1]); });
      cube(g, 0.7, 0.04, 0.5, "#ffffff", 0.35, 0.42, -0.4);
      [[0.05, -0.6], [0.65, -0.6], [0.05, -0.2], [0.65, -0.2]].forEach(function (q) { cube(g, 0.04, 0.4, 0.04, "#ffb020", q[0], 0.2, q[1]); });
      cube(g, 0.25, 0.25, 0.25, "#ffb020", 0.6, 0.15, 0.4);
    }
  };
  function plante(g, x, z, k) {
    var pot = new T.Mesh(new T.CylinderGeometry(0.24 * k, 0.19 * k, 0.42 * k, 10), mat("#b5643c")); pot.position.set(x, 0.21 * k, z); pot.castShadow = true; g.add(pot);
    var geo = new T.IcosahedronGeometry(0.34 * k, 0);
    [[0, 0.75, 0, 1], [0.16, 0.95, 0.08, 0.75], [-0.14, 1.05, -0.06, 0.7]].forEach(function (q) {
      var f = new T.Mesh(geo, mat(q[3] > 0.8 ? "#2f7d48" : "#3f9b5a", { flatShading: true })); f.position.set(x + q[0] * k, q[1] * k, z + q[2] * k); f.scale.setScalar(q[3]); f.castShadow = true; g.add(f);
    });
  }
  // Un objet de déco posé dans la salle : groupe positionné au centre de son emprise
  V.modeleDeco = function (type, x, y, rot) {
    var def = root.TMI_DATA.deco.objets[type], e = TMI.Sim.empriseDeco(type, x, y, rot), g = new T.Group(), m = new T.Group();
    (MODELES[type] || MODELES.plante)(m);
    m.rotation.y = -(rot || 0) * Math.PI / 2;
    g.add(m);
    g.position.set(e.x + e.w / 2, 0, e.y + e.d / 2);
    g.userData.emprise = e;
    return g;
  };
  V.majDeco = function (s) {
    var dc = TMI.Sim.deco(s), self = this;
    var sig = dc.objets.map(function (o) { return o.id + o.type + o.x + "," + o.y + "," + o.rot + (o.mur || ""); }).join("|") + "|" + (this.pose ? this.pose.id : "") + "|" + this.decoChoisi;
    if (sig === this.decoSig) return;
    this.decoSig = sig;
    var G = this.decoGroupe, DDo = root.TMI_DATA.deco.objets;
    while (G.children.length) G.remove(G.children[0]);
    (this.decoMurs || []).forEach(function (m) { if (m.parent) m.parent.remove(m); });
    this.decoMurs = []; this.nbLumieres = 0;
    this.pickables = this.pickables.filter(function (p) { return !p.userData.action || !p.userData.action.deco; });
    dc.objets.forEach(function (o) {
      if (self.pose && self.pose.id === o.id) return;     // l'objet qu'on déplace est remplacé par son fantôme
      if (DDo[o.type].mur) {
        var gm = self.modeleMural(o.type, o.mur, o.x);
        gm.userData.action = { deco: o.id };
        if (self.decoChoisi === o.id) {
          var em = gm.userData.emprise, cm = new T.Mesh(new T.PlaneGeometry(em.w + 0.2, em.h + 0.2), new T.MeshBasicMaterial({ color: 0x2457ff, transparent: true, opacity: 0.3, depthWrite: false }));
          cm.position.z = 0.002; gm.add(cm);
        }
        self.groupeMur(o.mur).add(gm); self.decoMurs.push(gm); self.pickables.push(gm);
        return;
      }
      var g = self.modeleDeco(o.type, o.x, o.y, o.rot);
      g.userData.action = { deco: o.id };
      if (self.decoChoisi === o.id) {
        var e = g.userData.emprise, cadre = new T.Mesh(new T.PlaneGeometry(e.w + 0.1, e.d + 0.1), new T.MeshBasicMaterial({ color: 0x2457ff, transparent: true, opacity: 0.35, depthWrite: false }));
        cadre.rotation.x = -Math.PI / 2; cadre.position.y = 0.03; g.add(cadre);
      }
      G.add(g); self.pickables.push(g);
    });
  };


  // ------------------------------------------------------------ Déco murale
  // Modèles construits face à +z, centrés sur l'origine ; murPose() les accroche à l'intérieur d'un mur.
  var cacheHalo = {};
  function texHalo(c) {
    if (cacheHalo[c]) return cacheHalo[c];
    var cv = toile(128), cx = cv.getContext("2d"), gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64), col = new T.Color(c);
    var rgb = Math.round(col.r * 255) + "," + Math.round(col.g * 255) + "," + Math.round(col.b * 255);
    gr.addColorStop(0, "rgba(" + rgb + ",.85)"); gr.addColorStop(0.35, "rgba(" + rgb + ",.35)"); gr.addColorStop(1, "rgba(" + rgb + ",0)");
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    return (cacheHalo[c] = tx);
  }
  // Lueur d'un néon : halo additif sur le mur + petite lumière (limitée en nombre)
  function lueur(g, c, w, h, vue) {
    var m = new T.Mesh(new T.PlaneGeometry(w * 1.6 + 0.8, h * 1.6 + 0.8), new T.MeshBasicMaterial({ map: texHalo(c), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    m.position.z = 0.005; g.add(m);
    if (vue && vue.nbLumieres < 6) {
      vue.nbLumieres++;
      var l = new T.PointLight(new T.Color(c), 2.2, 3.2, 1.6); l.position.set(0, 0, 0.5); g.add(l);
    }
  }
  function tube(g, points, c, ep) {
    // tube néon : suite de segments lumineux
    var matN = new T.MeshBasicMaterial({ color: new T.Color(c).lerp(new T.Color("#ffffff"), 0.45) });
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i], b = points[i + 1];
      if (!a || !b) continue;
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      var m = new T.Mesh(new T.CylinderGeometry(ep || 0.025, ep || 0.025, L, 6), matN);
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.05); m.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      g.add(m);
    }
  }
  function neonTexte(g, texte, c, w, h, police) {
    var cv = toile(512); cv.height = Math.round(512 * h / w);
    var cx = cv.getContext("2d");
    cx.font = "800 " + Math.round(cv.height * 0.62) + "px " + (police || getComputedStyle(document.body).fontFamily || "sans-serif");
    cx.textAlign = "center"; cx.textBaseline = "middle";
    cx.shadowColor = c; cx.shadowBlur = 24; cx.lineWidth = 10; cx.strokeStyle = c; cx.strokeText(texte, 256, cv.height / 2);
    cx.shadowBlur = 8; cx.lineWidth = 4; cx.strokeStyle = "#ffffff"; cx.strokeText(texte, 256, cv.height / 2);
    var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
    m.position.z = 0.04; g.add(m);
  }
  function affiche(g, w, h, lignes, fond) {
    cube(g, w + 0.06, h + 0.06, 0.03, "#2c2f36", 0, 0, 0.015);
    var tx = texteTexture(lignes, { w: 256, h: Math.round(256 * h / w), fond: fond });
    var p = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: tx, roughness: 0.5 }));
    p.position.z = 0.032; g.add(p);
  }
  var MURAUX = {
    affiche_jeu: function (g, d) {
      var h = 256 * d.taille[1] / d.taille[0];
      affiche(g, d.taille[0], d.taille[1], [{ s: "PIXEL", t: 54, c: "#ffe14d", y: h * 0.18 }, { s: "QUEST", t: 54, c: "#ffffff", y: h * 0.33 }, { s: "▲ ◆ ●", t: 60, c: "#ff3d9a", y: h * 0.6 }, { s: "DISPONIBLE", t: 24, c: "#9fb3ff", y: h * 0.88 }], "#1d1450");
    },
    affiche_promo: function (g, d) {
      var h = 256 * d.taille[1] / d.taille[0];
      affiche(g, d.taille[0], d.taille[1], [{ s: "PROMO", t: 56, c: "#ffffff", y: h * 0.2 }, { s: "−20 %", t: 76, c: "#ffe14d", y: h * 0.45 }, { s: "sur les", t: 26, g: 600, c: "#ffd7d7", y: h * 0.66 }, { s: "portables", t: 34, c: "#ffffff", y: h * 0.8 }], "#d6334a");
    },
    cadre_employe: function (g, d) {
      var h = 256 * d.taille[1] / d.taille[0];
      affiche(g, d.taille[0], d.taille[1], [{ s: "EMPLOYÉ", t: 30, c: "#5b4a1f", y: h * 0.12 }, { s: "DU MOIS", t: 30, c: "#5b4a1f", y: h * 0.24 }, { s: "☺", t: 120, c: "#2457ff", y: h * 0.58 }, { s: "★ ★ ★", t: 34, c: "#c99a2e", y: h * 0.88 }], "#f6ecd0");
      cube(g, d.taille[0] + 0.12, d.taille[1] + 0.12, 0.025, "#c99a2e", 0, 0, 0.005);
    },
    tableau: function (g, d) {
      cube(g, d.taille[0] + 0.1, d.taille[1] + 0.1, 0.04, "#ffffff", 0, 0, 0.02);
      var cv = toile(256); cv.height = 170; var cx = cv.getContext("2d");
      cx.fillStyle = "#f4efe6"; cx.fillRect(0, 0, 256, 170);
      [["#2457ff", 40, 50, 60], ["#ff7a1a", 150, 90, 48], ["#12a150", 200, 40, 30], ["#ffd23d", 90, 120, 36], ["#d6334a", 120, 40, 22]].forEach(function (q) { cx.fillStyle = q[0]; cx.beginPath(); cx.arc(q[1], q[2], q[3], 0, 7); cx.fill(); });
      cx.strokeStyle = "#1f2328"; cx.lineWidth = 5; cx.beginPath(); cx.moveTo(10, 150); cx.bezierCurveTo(80, 60, 160, 160, 246, 70); cx.stroke();
      var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
      var p = new T.Mesh(new T.PlaneGeometry(d.taille[0] - 0.1, d.taille[1] - 0.1), new T.MeshStandardMaterial({ map: tx, roughness: 0.7 })); p.position.z = 0.045; g.add(p);
    },
    etagere_murale: function (g, d) {
      var w = d.taille[0];
      [-0.3, 0.25].forEach(function (y) { cube(g, w, 0.04, 0.3, "#b08a62", 0, y, 0.15); cube(g, 0.04, 0.12, 0.25, "#3a4150", -w / 2 + 0.2, y - 0.08, 0.13); cube(g, 0.04, 0.12, 0.25, "#3a4150", w / 2 - 0.2, y - 0.08, 0.13); });
      var sp = new T.Group(); sp.position.set(-w / 2 + 0.3, 0.27, 0.15); g.add(sp); plante(sp, 0, 0, 0.45);
      var pc = new T.Group(); pc.position.set(0.1, -0.28, 0.15); g.add(pc);
      cube(pc, 0.38, 0.3, 0.3, "#e3dcc8", 0, 0.15, 0); cube(pc, 0.28, 0.2, 0.01, "#3b6b4a", 0, 0.17, 0.155, { emissive: new T.Color("#2c5a3a"), emissiveIntensity: 0.4 });
      [["#ff3d3d", 0.55], ["#2457ff", 0.7], ["#ffd23d", -0.25]].forEach(function (q) { cube(g, 0.1, 0.18, 0.1, q[0], q[1], 0.36, 0.15); var t = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), mat(q[0])); t.position.set(q[1], 0.5, 0.15); g.add(t); });
      [0.45, 0.52, 0.59, 0.66].forEach(function (x, i) { cube(g, 0.05, 0.24, 0.18, ["#7b4fd6", "#12a150", "#f08a24", "#2457ff"][i], x - 0.9 + w / 2 - 0.2, -0.16, 0.15); });
    },
    ecran_mural: function (g, d, vue) {
      cube(g, d.taille[0], d.taille[1], 0.06, "#15181f", 0, 0, 0.03);
      var tx = texteTexture([{ s: "OFFRE DU MOMENT", t: 26, c: "#9fe3ff", y: 40 }, { s: "PC GAMER RTX", t: 44, c: "#ffffff", y: 100 }, { s: "à partir de 999 €", t: 30, g: 600, c: "#ffe14d", y: 150 }], { w: 384, h: 220, fond: "#123a7a" });
      var p = new T.Mesh(new T.PlaneGeometry(d.taille[0] - 0.08, d.taille[1] - 0.08), new T.MeshBasicMaterial({ map: tx })); p.position.z = 0.065; g.add(p);
      lueur(g, "#3d8fe0", d.taille[0] * 0.6, d.taille[1] * 0.6, null);
    },
    ruban_led: function (g, d, vue) {
      var m = new T.Mesh(new T.BoxGeometry(d.taille[0], 0.04, 0.04), new T.MeshBasicMaterial({ color: new T.Color(d.neon).lerp(new T.Color("#fff"), 0.4) }));
      m.position.z = 0.03; g.add(m);
      lueur(g, d.neon, d.taille[0], 0.2, vue);
    },
    neon_eclair: function (g, d, vue) {
      tube(g, [[0.12, 0.55], [-0.2, 0.0], [0.08, 0.0], [-0.14, -0.55]], d.neon, 0.035);
      lueur(g, d.neon, 0.6, 1.0, vue);
    },
    neon_gameon: function (g, d, vue) {
      cube(g, d.taille[0], d.taille[1], 0.02, "#141018", 0, 0, 0.01, { roughness: 0.3 }).castShadow = false;
      neonTexte(g, "GAME ON", d.neon, d.taille[0] - 0.1, d.taille[1] - 0.1);
      lueur(g, d.neon, d.taille[0], d.taille[1], vue);
    },
    neon_bienvenue: function (g, d, vue) {
      neonTexte(g, "Bienvenue", d.neon, d.taille[0], d.taille[1], "italic 800 1px Georgia, serif".replace("1px ", ""));
      lueur(g, d.neon, d.taille[0], d.taille[1], vue);
    },
    neon_coeur: function (g, d, vue) {
      var c = [[-0.1, 0.25], [-0.25, 0.25], [-0.35, 0.12], [-0.35, -0.02], [0, -0.35], [0.35, -0.02], [0.35, 0.12], [0.25, 0.25], [0.1, 0.25], [0, 0.12], [-0.1, 0.25]];
      tube(g, c, d.neon, 0.03);
      lueur(g, d.neon, 0.8, 0.7, vue);
    }
  };
  // Position sur la face intérieure d'un mur : u le long du mur, à la hauteur h
  V.murPose = function (g, mur, u, h) {
    var X = this.plan.dim.x;
    if (mur === "N") { g.position.set(u, h, 0.01); g.rotation.y = 0; }
    if (mur === "O") { g.position.set(0.01, h, u); g.rotation.y = Math.PI / 2; }
    if (mur === "E") { g.position.set(X - 0.01, h, u); g.rotation.y = -Math.PI / 2; }
    return g;
  };
  V.modeleMural = function (type, mur, u, fantome) {
    var d = root.TMI_DATA.deco.objets[type], g = new T.Group();
    (MURAUX[type] || MURAUX.affiche_promo)(g, d, fantome ? null : this);
    this.murPose(g, mur, u + d.taille[0] / 2, d.haut);
    g.userData.emprise = { mur: mur, u: u, w: d.taille[0], h: d.taille[1] };
    return g;
  };
  V.groupeMur = function (cote) { var m = this.murs.filter(function (w) { return w.cote === cote; })[0]; return m ? m.g : this.racine; };

  // ------------------------------------------------------------ Déco : pose et déplacement
  // pose = { type, id (si déplacement), x, y, rot } ; la grille montre les zones interdites en rouge.
  V.grilleDeco = function (s) {
    if (this.grille && this.grille.parent) this.grille.parent.remove(this.grille);
    if (this.pose && root.TMI_DATA.deco.objets[this.pose.type].mur) return this.grilleMurs(s);
    var P = this.plan, X = P.dim.x, Y = P.dim.y, g = this.grille = new T.Group();
    var cv = toile(64), cx = cv.getContext("2d");
    cx.strokeStyle = "rgba(255,255,255,.9)"; cx.lineWidth = 3; cx.strokeRect(0, 0, 64, 64); cx.strokeStyle = "rgba(36,87,255,.75)"; cx.lineWidth = 2; cx.strokeRect(0, 0, 64, 64);
    cx.strokeStyle = "rgba(36,87,255,.35)"; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(32, 0); cx.lineTo(32, 64); cx.moveTo(0, 32); cx.lineTo(64, 32); cx.stroke();
    var tx = finirTexture(cv); tx.repeat.set(X, Y);
    var plan = new T.Mesh(new T.PlaneGeometry(X, Y), new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
    plan.rotation.x = -Math.PI / 2; plan.position.set(X / 2, 0.015, Y / 2); g.add(plan);
    var rouge = new T.MeshBasicMaterial({ color: 0xd6334a, transparent: true, opacity: 0.3, depthWrite: false });
    P.bloques.forEach(function (b) {
      var x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(X, b.x + b.w), y1 = Math.min(Y, b.y + b.d);
      if (x1 <= x0 || y1 <= y0) return;
      var m = new T.Mesh(new T.PlaneGeometry(x1 - x0, y1 - y0), rouge);
      m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.02, (y0 + y1) / 2); g.add(m);
    });
    this.racine.add(g);
  };
  // Pour les objets muraux : bande bleue sur les murs libres, rouge sur ce qui est déjà accroché
  V.grilleMurs = function (s) {
    var self = this, g = this.grille = new T.Group(), P = this.plan;
    var bleu = new T.MeshBasicMaterial({ color: 0x2457ff, transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide });
    var rouge = new T.MeshBasicMaterial({ color: 0xd6334a, transparent: true, opacity: 0.28, depthWrite: false, side: T.DoubleSide });
    ["N", "O", "E"].forEach(function (m) {
      var M = P.murs[m], gw = new T.Group();
      var fond = new T.Mesh(new T.PlaneGeometry(M.long - 0.2, 2.3), bleu); fond.position.set(M.long / 2, 1.65, 0.004); gw.add(fond);
      M.bloques.forEach(function (b) {
        var a = Math.max(0.1, b[0]), z = Math.min(M.long - 0.1, b[1]); if (z <= a) return;
        var r = new T.Mesh(new T.PlaneGeometry(z - a, 2.3), rouge); r.position.set((a + z) / 2, 1.65, 0.006); gw.add(r);
      });
      if (m === "O") gw.scale.x = -1;      // sur le mur ouest, l'axe local x part vers le nord
      var hold = new T.Group(); hold.add(gw);
      self.murPose(hold, m, 0, 0);
      self.groupeMur(m).add(hold);
      g.userData.parts = (g.userData.parts || []).concat([hold]);
    });
    this.grille = { parent: null, parts: g.userData.parts };
    var parts = g.userData.parts;
    this.grille.parent = { remove: function () { parts.forEach(function (h) { if (h.parent) h.parent.remove(h); }); } };
  };
  V.placer = function (s, pose) {
    this.pose = pose; this.decoChoisi = null; this.dernierEtat = s;
    var mural = root.TMI_DATA.deco.objets[pose.type].mur;
    if (pose.x == null && mural) {
      var self0 = this, trouve = null;
      ["N", "O", "E"].forEach(function (m) {
        if (trouve || !self0.murVisible(m)) return;
        for (var u = 0.5; u < self0.plan.murs[m].long && !trouve; u += 0.5) if (TMI.Sim.placeDeco(s, pose.type, u, 0, 0, pose.id, m).ok) trouve = [m, u];
      });
      pose.mur = trouve ? trouve[0] : "N"; pose.x = trouve ? trouve[1] : 0.5; pose.y = 0; pose.rot = 0;
    }
    if (pose.x == null) {     // première position : au centre de la vue, ou sur la première place libre
      var P = this.plan, libre = null;
      for (var y = 0; y < P.dim.y && !libre; y += 0.5) for (var x = 0; x < P.dim.x && !libre; x += 0.5)
        if (TMI.Sim.placeDeco(s, pose.type, x, y, pose.rot, pose.id).ok) libre = [x, y];
      pose.x = libre ? libre[0] : 0; pose.y = libre ? libre[1] : 0;
    }
    this.grilleDeco(s);
    this.decoSig = null; this.majDeco(s);
    this.majFantome();
  };
  V.murVisible = function (m) { var w = this.murs.filter(function (x) { return x.cote === m; })[0]; return w && w.g.visible; };
  V.majFantome = function () {
    var p = this.pose, s = this.dernierEtat;
    if (this.fantome) { if (this.fantome.parent) this.fantome.parent.remove(this.fantome); this.fantome = null; }
    if (!p) return;
    if (root.TMI_DATA.deco.objets[p.type].mur) {
      p.valide = TMI.Sim.placeDeco(s, p.type, p.x, 0, 0, p.id, p.mur);
      var gm = this.fantome = this.modeleMural(p.type, p.mur, p.x, true), em = gm.userData.emprise;
      gm.traverse(function (o) { if (o.isMesh && !o.material.blending) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.8; } });
      var cm = new T.Mesh(new T.PlaneGeometry(em.w + 0.1, em.h + 0.1), new T.MeshBasicMaterial({ color: p.valide.ok ? 0x12a150 : 0xd6334a, transparent: true, opacity: 0.4, depthWrite: false }));
      cm.position.z = 0.003; gm.add(cm);
      this.groupeMur(p.mur).add(gm);
      if (this.options.surPose) this.options.surPose(p);
      return;
    }
    p.valide = TMI.Sim.placeDeco(s, p.type, p.x, p.y, p.rot, p.id);
    var g = this.fantome = this.modeleDeco(p.type, p.x, p.y, p.rot), e = g.userData.emprise;
    g.traverse(function (o) {
      if (!o.isMesh) return;
      o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.72; o.castShadow = false;
    });
    var cadre = new T.Mesh(new T.PlaneGeometry(e.w, e.d), new T.MeshBasicMaterial({ color: p.valide.ok ? 0x12a150 : 0xd6334a, transparent: true, opacity: 0.45, depthWrite: false }));
    cadre.rotation.x = -Math.PI / 2; cadre.position.y = 0.03; g.add(cadre);
    this.racine.add(g);
    if (this.options.surPose) this.options.surPose(p);
  };
  V.tournerPose = function () {
    if (!this.pose) return;
    if (root.TMI_DATA.deco.objets[this.pose.type].mur) {   // objet mural : « tourner » = passer au mur visible suivant
      var ordre = ["N", "O", "E"].filter(this.murVisible.bind(this)), i = ordre.indexOf(this.pose.mur);
      if (ordre.length) { this.pose.mur = ordre[(i + 1) % ordre.length]; this.pose.x = Math.min(this.pose.x, this.plan.murs[this.pose.mur].long - 1); this.majFantome(); }
      return;
    }
    this.pose.rot = (this.pose.rot + 1) % 4; this.majFantome(); };
  V.finPose = function () {
    this.pose = null;
    if (this.fantome) { if (this.fantome.parent) this.fantome.parent.remove(this.fantome); this.fantome = null; }
    if (this.grille) { if (this.grille.parent) this.grille.parent.remove(this.grille); this.grille = null; }
    this.decoSig = null;
    if (this.dernierEtat) this.majDeco(this.dernierEtat);
  };
  V.choisirDeco = function (id) { this.decoChoisi = id; if (this.dernierEtat) this.majDeco(this.dernierEtat); };
  // Point du sol sous le pointeur
  V.pointSol = function (ev) {
    var r = this.renderer.domElement.getBoundingClientRect();
    var p = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    var ray = new T.Raycaster(); ray.setFromCamera(p, this.camera);
    var hit = new T.Vector3();
    return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), hit) ? hit : null;
  };
  V.pointMur = function (ev) {
    var r = this.renderer.domElement.getBoundingClientRect(), self = this;
    var p = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    var ray = new T.Raycaster(); ray.setFromCamera(p, this.camera);
    var X = this.plan.dim.x, Y = this.plan.dim.y, best = null;
    [["N", new T.Plane(new T.Vector3(0, 0, 1), 0)], ["O", new T.Plane(new T.Vector3(1, 0, 0), 0)], ["E", new T.Plane(new T.Vector3(-1, 0, 0), X)]].forEach(function (q) {
      if (!self.murVisible(q[0])) return;
      var h = new T.Vector3();
      if (!ray.ray.intersectPlane(q[1], h)) return;
      if (h.y < 0 || h.y > HMUR) return;
      var u = q[0] === "N" ? h.x : h.z, L = q[0] === "N" ? X : Y;
      if (u < -0.3 || u > L + 0.3) return;
      var dist = ray.ray.origin.distanceTo(h);
      if (!best || dist < best.dist) best = { mur: q[0], u: u, dist: dist };
    });
    return best;
  };
  V.suivrePointeur = function (ev) {
    var p = this.pose;
    if (p && root.TMI_DATA.deco.objets[p.type].mur) {
      var m = this.pointMur(ev); if (!m) return false;
      var w = root.TMI_DATA.deco.objets[p.type].taille[0], L = this.plan.murs[m.mur].long;
      var u = Math.max(0, Math.min(L - w, Math.round((m.u - w / 2) * 2) / 2));
      if (u === p.x && m.mur === p.mur) return false;
      p.x = u; p.mur = m.mur; this.majFantome(); return true;
    }
    var h = this.pointSol(ev);
    if (!p || !h) return false;
    var e = TMI.Sim.empriseDeco(p.type, 0, 0, p.rot);
    var x = Math.round((h.x - e.w / 2) * 2) / 2, y = Math.round((h.z - e.d / 2) * 2) / 2;
    x = Math.max(0, Math.min(this.plan.dim.x - e.w, x)); y = Math.max(0, Math.min(this.plan.dim.y - e.d, y));
    if (x === p.x && y === p.y) return false;
    p.x = x; p.y = y; this.majFantome();
    return true;
  };

  // ------------------------------------------------------------ Personnages
  var geoJambe = null, geoCorps = null, geoTete = null, geoCheveux = null, geoAnneau = null;
  function perso(couleur, id, employe) {
    if (!geoJambe) {
      geoJambe = new T.CylinderGeometry(0.065, 0.06, 0.48, 8); geoJambe.translate(0, -0.24, 0);
      geoCorps = new T.CapsuleGeometry(0.19, 0.32, 4, 10);
      geoTete = new T.SphereGeometry(0.16, 14, 10);
      geoCheveux = new T.SphereGeometry(0.168, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      geoAnneau = new T.RingGeometry(0.28, 0.36, 24); geoAnneau.rotateX(-Math.PI / 2);
    }
    var h = hache(id), g = new T.Group(), corps = new T.Group();
    g.add(corps);
    var jambe = mat(employe ? "#2a3142" : PANTALONS[h % 4]);
    var jg = new T.Mesh(geoJambe, jambe); jg.position.set(-0.08, 0.5, 0); jg.castShadow = true; corps.add(jg);
    var jd = new T.Mesh(geoJambe, jambe); jd.position.set(0.08, 0.5, 0); jd.castShadow = true; corps.add(jd);
    var tronc = new T.Mesh(geoCorps, mat(couleur)); tronc.position.y = 0.8; tronc.scale.set(1, 1, 0.75); tronc.castShadow = true; corps.add(tronc);
    var tete = new T.Mesh(geoTete, mat(PEAUX[h % PEAUX.length])); tete.position.y = 1.24; tete.castShadow = true; corps.add(tete);
    var ch = new T.Mesh(geoCheveux, mat(CHEVEUX[(h >> 3) % CHEVEUX.length])); ch.position.y = 1.26; ch.rotation.x = -0.25; corps.add(ch);
    if (employe) cube(corps, 0.1, 0.12, 0.02, "#ffffff", 0.09, 0.9, 0.15);
    var anneau = new T.Mesh(geoAnneau, new T.MeshBasicMaterial({ color: 0xd6334a, transparent: true, opacity: 0 })); anneau.position.y = 0.02; g.add(anneau);
    return { g: g, corps: corps, jg: jg, jd: jd, anneau: anneau, bulle: null, texteBulle: "", phase: h % 100 };
  }
  V.bulle = function (p, txt, rouge) {
    var cle = txt + (rouge ? "!" : "");
    if (p.texteBulle === cle) return;
    p.texteBulle = cle;
    if (p.bulle) { p.g.remove(p.bulle); p.bulle = null; }
    if (!txt) return;
    p.bulle = pastille(txt, rouge ? "#d6334a" : "#ffffff", 0.36);
    if (!rouge) p.bulle.material.map = texteTexture([{ s: txt, t: 70, c: "#1f2328" }], { w: 128, h: 128, fond: "#ffffff", rond: 64 });
    p.bulle.position.set(0.2, 1.75, 0); p.g.add(p.bulle);
  };
  V.nouveau = function (couleur, id, employe, x, z) {
    var p = perso(couleur, id, employe);
    p.g.position.set(x, 0, z); p.cx = x; p.cz = z; p.g.scale.setScalar(1.18);
    this.racine.add(p.g);
    return p;
  };
  V.versCible = function (p, x, z) { p.cx = x; p.cz = z; };

  // ------------------------------------------------------------ Mise à jour depuis la simulation
  V.maj = function (s) {
    this.dernierEtat = s;
    if (cleSalle(s, this.piece) !== this.cle) { this.construire(s); if (this.pose) { this.grilleDeco(s); this.majFantome(); } }
    if (this.piece === "reserve") return this.majReserve(s);
    if (this.piece === "bureau") return this.majBureau(s);
    this.majDeco(s);
    var self = this, P = this.plan, data = root.TMI_DATA, t = s.jour * 1440 + s.minuteJour, vus = {};
    for (var i = 0; i < this.rayons.length; i++) this.majRayon(s, i);
    // horloge
    var hm = s.minuteJour;
    if (this.cadran && this.derniereMinute !== Math.floor(hm / 5)) {
      this.derniereMinute = Math.floor(hm / 5);
      var cv = this.cadran.image, c = cv.getContext("2d");
      c.clearRect(0, 0, 128, 128);
      c.fillStyle = "#fff"; c.strokeStyle = "#3a4150"; c.lineWidth = 8; c.beginPath(); c.arc(64, 64, 56, 0, Math.PI * 2); c.fill(); c.stroke();
      c.lineCap = "round"; c.strokeStyle = "#1f2328";
      var ah = ((hm / 60) % 12) / 12 * Math.PI * 2, am = (hm % 60) / 60 * Math.PI * 2;
      c.lineWidth = 8; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.sin(ah) * 28, 64 - Math.cos(ah) * 28); c.stroke();
      c.lineWidth = 5; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.sin(am) * 42, 64 - Math.cos(am) * 42); c.stroke();
      this.cadran.needsUpdate = true;
    }
    // clients
    var E = P.entree, C = P.caisse;
    s.clients.forEach(function (cl) {
      vus[cl.id] = true;
      var p = self.persos[cl.id];
      if (!p) p = self.persos[cl.id] = self.nouveau(data.profilsClients[cl.profil].couleur, cl.id, false, E.x, E.y);
      var rang = s.file.indexOf(cl.id), h = hache(cl.id), x, z;
      if (cl.etat === "file") { x = 11.3 + P.DXC - Math.max(0, rang) * 0.75; z = 8.55 + P.DYC + (Math.max(0, rang) % 2) * 0.12; }
      else if (cl.etat === "caisse") { x = 11.9 + P.DXC; z = 7.95 + P.DYC; }
      else { var r = P.rayons[cl.rayon] || P.rayons[0]; x = r.x + 0.3 + (h % 4) * 0.45; z = r.y + r.d + 0.55 + ((h >> 3) % 2) * 0.35; }
      self.versCible(p, x, z);
      var attente = (cl.etat === "attend_conseil" || cl.etat === "file") ? (t - cl.depuis) / cl.patience : 0;
      p.anneau.material.opacity = attente > 0.55 ? Math.min(1, (attente - 0.4) * 1.6) : 0;
      var b = cl.etat === "attend_conseil" ? "?" : cl.etat === "file" || cl.etat === "caisse" ? "€" : cl.etat === "conseil" ? "…" : "";
      self.bulle(p, b, attente > 0.7);
      p.client = true;
    });
    // employés
    var parPoste = {};
    s.employes.forEach(function (e) {
      vus[e.id] = true;
      parPoste[e.poste] = (parPoste[e.poste] || 0) + 1;
      var rp = parPoste[e.poste] - 1, p = self.persos[e.id], x, z;
      if (!p) p = self.persos[e.id] = self.nouveau({ caissier: "#12a150", technicien: "#ff7a1a", responsable: "#7b4fd6" }[e.poste] || "#2457ff", e.id, true, E.x, E.y);
      var b = "";
      if (e.poste === "technicien") {
        var trav = e.tache && e.tache.type === "montage";
        x = (trav ? [12.35, 11.55, 13.1][rp % 3] : 11.6 + (rp % 3) * 0.6) + P.DX; z = trav ? 1.75 : 3.3;
        if (trav) b = "PC";
      } else if (e.tache && e.tache.type === "conseil" && self.persos[e.tache.clientId]) {
        var cp = self.persos[e.tache.clientId]; x = cp.cx + 0.55; z = cp.cz - 0.1;
      } else if (e.tache && e.tache.type === "caisse") { x = (e.poste === "caissier" ? 11.9 : 12.9) + P.DXC; z = 6.15 + P.DYC; }
      else if (e.poste === "caissier") { x = 11.6 + P.DXC + rp * 0.8; z = 6.1 + P.DYC; }
      else { x = 3.4 + rp * 0.8; z = 7.7 + P.DYT; }
      self.versCible(p, x, z);
      self.bulle(p, b, false);
    });
    Object.keys(this.persos).forEach(function (id) {
      if (vus[id]) return;
      var p = self.persos[id];
      if (!p.sort) { p.sort = true; self.versCible(p, E.x, E.y + 1.2); self.bulle(p, "", false); p.anneau.material.opacity = 0; }
    });
  };

  // Animation : déplacements, marche, rotation de la caméra
  V.animer = function () {
    var dt = Math.min(0.05, this.horloge.getDelta()), self = this, tps = this.horloge.elapsedTime;
    if (Math.abs(this.azCible - this.az) > 0.001) { this.az += (this.azCible - this.az) * Math.min(1, dt * 8); this.cadrer(); }
    Object.keys(this.persos).forEach(function (id) {
      var p = self.persos[id], g = p.g, dx = p.cx - g.position.x, dz = p.cz - g.position.z, dist = Math.hypot(dx, dz);
      var marche = dist > 0.03;
      if (marche) {
        var v = Math.min(dist, 2.4 * dt);
        g.position.x += dx / dist * v; g.position.z += dz / dist * v;
        var ang = Math.atan2(dx, dz), da = ang - g.rotation.y;
        while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        g.rotation.y += da * Math.min(1, dt * 10);
      }
      var bal = marche ? Math.sin(tps * 11 + p.phase) * 0.5 : 0;
      p.jg.rotation.x = bal; p.jd.rotation.x = -bal;
      p.corps.position.y = marche ? Math.abs(Math.sin(tps * 11 + p.phase)) * 0.03 : Math.sin(tps * 2 + p.phase) * 0.008;
      if (p.sort && dist < 0.05) { self.racine.remove(g); delete self.persos[id]; }
    });
    this.renderer.render(this.scene, this.camera);
  };
  V.ecranSol = function (x, z) {
    var v = new T.Vector3(x, 0, z).project(this.camera), r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  };
  V.ecranRayon = function (i) {
    var R = this.rayons[i]; if (!R) return null;
    var v = new T.Vector3(R.r.x + R.r.w / 2, 0.8, R.r.y + R.r.d / 2).project(this.camera), r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  };
  V.vider = function () { this.cle = null; this.persos = {}; this.pose = null; this.fantome = null; this.grille = null; this.decoChoisi = null; if (this.racine) { this.scene.remove(this.racine); this.racine = null; } };


  // ------------------------------------------------------------ Réserve et bureau en 3D
  var PIECES3D = { reserve: { x: 8, y: 6, mur: "#cdd3dc" }, bureau: { x: 7, y: 5, mur: "#e6dccd" } };
  var CATS3D = [{ id: "ordinateurs", nom: "ORDINATEURS", c: "#2457ff" }, { id: "composants", nom: "COMPOSANTS", c: "#12a150" }, { id: "peripheriques", nom: "PÉRIPHÉRIQUES", c: "#f08a24" }];
  // Étiquette flottante (comme les bulles de la vue 2D), texte modifiable
  function etiquette(texte, fond) {
    var cv = toile(512); cv.height = 104;
    var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    var sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false, transparent: true }));
    sp.renderOrder = 9;
    sp.ecrire = function (t, f) {
      var c = cv.getContext("2d"), police = getComputedStyle(document.body).fontFamily || "sans-serif";
      c.clearRect(0, 0, 512, 104);
      c.font = "800 44px " + police;
      var w = Math.min(500, c.measureText(t).width + 56);
      c.fillStyle = f || "#1f2a44"; arrondi(c, (512 - w) / 2, 8, w, 84, 42); c.fill();
      c.fillStyle = "#ffffff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t, 256, 52);
      tx.needsUpdate = true;
    };
    sp.ecrire(texte, fond);
    sp.scale.set(1.9, 0.39, 1);
    return sp;
  }
  function toileTexture(w, h) { var cv = toile(w); cv.height = h; var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; return tx; }

  V.changerPiece = function (p) {
    if (p === this.piece) return;
    this.piece = p; this.cle = null; this.zoom = 1; this.cible = null;
  };
  V.surMur = function (g, cote, u, h) {
    var X = this.plan.dim.x, Y = this.plan.dim.y;
    if (cote === "S") { g.position.set(u, h, Y - 0.01); g.rotation.y = Math.PI; return g; }
    return this.murPose(g, cote, u, h);
  };
  V.murSimple = function (R, cote, coul) {
    var X = this.plan.dim.x, Y = this.plan.dim.y, g = new T.Group();
    var n = { N: [0, -1], S: [0, 1], O: [-1, 0], E: [1, 0] }[cote], horiz = cote === "N" || cote === "S";
    var long = horiz ? X : Y, w = horiz ? long + EP * 2 : EP, d = horiz ? EP : long + EP * 2;
    var cx = horiz ? X / 2 : (cote === "O" ? 0 : X) + n[0] * EP / 2, cz = horiz ? (cote === "N" ? 0 : Y) + n[1] * EP / 2 : Y / 2;
    var m = cube(g, w, HMUR, d, teinte(coul, horiz ? 0 : -0.08), cx, HMUR / 2, cz); m.castShadow = false;
    cube(g, horiz ? long : EP + 0.02, 0.16, horiz ? EP + 0.02 : long, "#b9c1cd", cx - n[0] * 0.01, 0.08, cz - n[1] * 0.01);
    cube(g, w + 0.02, 0.08, d + 0.02, "#8f9bb0", cx, HMUR + 0.04, cz);
    R.add(g);
    this.murs.push({ g: g, nx: n[0], nz: n[1], cote: cote });
    return g;
  };
  // Porte vers une autre pièce, sur la face intérieure d'un mur
  V.porteVers = function (gw, cote, u0, u1, texte, cible) {
    var p = new T.Group(), l = u1 - u0;
    this.surMur(p, cote, (u0 + u1) / 2, 0);
    var b = cube(p, l, 2.1, 0.06, "#c7ced9", 0, 1.05, 0.03); b.castShadow = false;
    cube(p, l * 0.55, 0.5, 0.02, "#cde4f4", 0, 1.6, 0.07, { roughness: 0.1 });
    cube(p, 0.06, 0.06, 0.1, "#5b6578", l * 0.33, 1.0, 0.09);
    cube(p, l + 0.14, 0.08, 0.08, "#8f9bb0", 0, 2.14, 0.04);
    var lab = texteTexture([{ s: texte, t: 44 }], { w: 256, h: 72, fond: "#1b2440", rond: 14 });
    panneau(p, lab, 1.0, 0.28, 0, 2.45, 0.02, 0);
    p.userData.action = { cible: cible };
    this.pickables.push(p);
    gw.add(p);
  };
  V.groupeMurP = function (cote) { return this.groupeMur(cote); };

  V.construirePiece = function (s) {
    if (this.racine) this.scene.remove(this.racine);
    var R = this.racine = new T.Group(), def = PIECES3D[this.piece], X = def.x, Y = def.y;
    this.scene.add(R);
    this.plan = { dim: { x: X, y: Y }, murs: {} };
    this.murs = []; this.pickables = []; this.rayons = []; this.persos = {}; this.decoGroupe = null; this.decoMurs = []; this.nbLumieres = 0;
    this.dyn = {};
    var self = this;
    ["N", "O", "S", "E"].forEach(function (c) { self.murSimple(R, c, def.mur); });
    if (this.piece === "reserve") this.salleReserve(R, s, X, Y); else this.salleBureau(R, s, X, Y);
    this.cle = cleSalle(s, this.piece);
    this.cible = null;
    this.cadrer();
  };
  function sol(R, X, Y, tx, coulBord) {
    var m = new T.Mesh(new T.BoxGeometry(X, 0.25, Y), [mat(coulBord), mat(coulBord), new T.MeshStandardMaterial({ map: tx, roughness: 0.6 }), mat(coulBord), mat(teinte(coulBord, 0.12)), mat(teinte(coulBord, 0.12))]);
    m.position.set(X / 2, -0.125, Y / 2); m.receiveShadow = true; R.add(m);
  }
  function plat(R, w, d, x, z, couleur, o) {
    var m = new T.Mesh(new T.PlaneGeometry(w, d), o && o.map ? new T.MeshStandardMaterial(Object.assign({ roughness: 0.8 }, o)) : mat(couleur, o));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); m.receiveShadow = true; R.add(m); return m;
  }
  function carton(g, w, h, d, x, y, z, bande) {
    var c = cube(g, w, h, d, ["#c99a5e", "#d2a86f"][Math.round(x * 10) % 2 ? 1 : 0], x, y + h / 2, z);
    cube(g, w * 0.16, h + 0.004, d + 0.004, "#e9d6b4", x, y + h / 2, z);
    if (bande) cube(g, w + 0.004, h * 0.18, d * 0.5, bande, x, y + h * 0.7, z + d * 0.25 + 0.002);
    return c;
  }

  // ---------- Réserve
  V.salleReserve = function (R, s, X, Y) {
    var self = this;
    var tx = textureSol({ nom: "reserve", c1: "#cfd4db", c2: "#c6ccd4", motif: "uni" }); tx.repeat.set(X / 2, Y / 2);
    sol(R, X, Y, tx, "#9ea9ba");
    plat(R, 7.6, 0.1, 4.0, 1.4, "#f2c230");
    // zone d'arrivage en pointillés
    for (var k = 0; k < 7; k++) { plat(R, 0.25, 0.08, 5.45 + k * 0.38, 1.9, "#f2c230"); plat(R, 0.25, 0.08, 5.45 + k * 0.38, 4.3, "#f2c230"); }
    for (var j = 0; j < 7; j++) { plat(R, 0.08, 0.25, 5.3, 2.05 + j * 0.34, "#f2c230"); plat(R, 0.08, 0.25, 7.85, 2.05 + j * 0.34, "#f2c230"); }
    // étagères
    this.dyn.etageres = CATS3D.map(function (cat, i) {
      var g = new T.Group(), x0 = 0.35 + i * 2.5; g.position.set(x0, 0, 0.2);
      var W = 2.1, D = 0.8, H = 2.25;
      [[0.03, 0.03], [W - 0.03, 0.03], [0.03, D - 0.03], [W - 0.03, D - 0.03]].forEach(function (q) { cube(g, 0.06, H, 0.06, "#2f5fd0", q[0], H / 2, q[1]); });
      [0.12, 0.85, 1.58].forEach(function (y) {
        cube(g, W, 0.03, D, "#d7dbe2", W / 2, y, D / 2);
        cube(g, W, 0.08, 0.05, "#f08a24", W / 2, y - 0.04, D);
        cube(g, W, 0.08, 0.05, "#f08a24", W / 2, y - 0.04, 0);
      });
      var cartons = new T.Group(); g.add(cartons);
      var tex = toileTexture(512, 120), pl = new T.Mesh(new T.PlaneGeometry(W - 0.1, 0.47), new T.MeshBasicMaterial({ map: tex }));
      pl.position.set(W / 2, H + 0.05, D / 2 + 0.03); g.add(pl);
      cube(g, W - 0.06, 0.5, 0.03, "#1b2440", W / 2, H + 0.05, D / 2);
      g.userData.action = { cible: { piece: "reserve", onglet: "stock", cat: cat.id } };
      self.pickables.push(g); R.add(g);
      return { g: g, cat: cat, cartons: cartons, tex: tex, cle: null };
    });
    // poste de commande
    var dg = new T.Group(); dg.position.set(0.25, 0, 3.3);
    [[0.08, 0.08], [0.82, 0.08], [0.08, 1.82], [0.82, 1.82]].forEach(function (q) { cube(dg, 0.07, 0.72, 0.07, "#5b6578", q[0], 0.36, q[1]); });
    cube(dg, 0.9, 0.05, 1.9, "#7a8496", 0.45, 0.745, 0.95);
    cube(dg, 0.12, 0.16, 0.2, "#2c2f36", 0.25, 0.85, 0.65);
    cube(dg, 0.04, 0.42, 0.68, "#1b2233", 0.25, 1.12, 0.65);
    cube(dg, 0.005, 0.36, 0.6, "#5ad1ff", 0.272, 1.12, 0.65, { emissive: new T.Color("#2a8fd0"), emissiveIntensity: 0.6 });
    cube(dg, 0.3, 0.02, 0.5, "#d9dfe7", 0.55, 0.78, 0.65);
    cube(dg, 0.3, 0.08, 0.35, "#d6334a", 0.55, 0.81, 1.4);
    cube(dg, 0.08, 0.06, 0.3, "#2c2f36", 0.55, 0.87, 1.4);
    cube(dg, 0.35, 0.01, 0.42, "#ffffff", 0.6, 0.775, 0.25);
    var et = etiquette("Commander", "#2457ff"); et.position.set(0.45, 1.75, 0.95); dg.add(et);
    var chaise = new T.Group(); chaise.position.set(1.25, 0, 0.75); dg.add(chaise);
    cube(chaise, 0.45, 0.07, 0.45, "#2c2f36", 0, 0.48, 0); cube(chaise, 0.07, 0.5, 0.45, "#2c2f36", 0.2, 0.75, 0); cube(chaise, 0.06, 0.45, 0.06, "#9aa4b1", 0, 0.22, 0);
    dg.userData.action = { cible: { piece: "reserve", onglet: "commandes" } };
    this.pickables.push(dg); R.add(dg);
    // palette d'arrivage
    var pg = new T.Group(); pg.position.set(5.6, 0, 2.3);
    cube(pg, 1.5, 0.05, 1.2, "#c49a63", 0.75, 0.14, 0.6);
    [0.1, 0.75, 1.4].forEach(function (x) { cube(pg, 0.18, 0.12, 1.2, "#a87f4c", x, 0.06, 0.6); });
    var colis = new T.Group(); pg.add(colis);
    var lab = etiquette("Aucune livraison", "#5b6578"); lab.position.set(0.75, 1.35, 0.6); pg.add(lab);
    pg.userData.action = { cible: { piece: "reserve", onglet: "commandes" } };
    this.pickables.push(pg); R.add(pg);
    this.dyn.palette = { colis: colis, label: lab, n: -1 };
    // transpalette et cartons en vrac
    var tp = new T.Group(); tp.position.set(4.7, 0, 4.0); tp.rotation.y = 0.4;
    cube(tp, 0.6, 0.08, 0.5, "#d6334a", 0, 0.08, 0); cube(tp, 0.08, 1.0, 0.08, "#3a4150", -0.3, 0.55, 0); cube(tp, 0.08, 0.06, 0.4, "#3a4150", -0.3, 1.05, 0);
    R.add(tp);
    carton(R, 0.5, 0.45, 0.6, 1.85, 0, 5.2); carton(R, 0.45, 0.38, 0.5, 2.35, 0, 5.25); carton(R, 0.4, 0.32, 0.45, 1.9, 0.45, 5.2);
    // lampes industrielles
    [1.4, 4.0, 6.6].forEach(function (x) {
      cube(R, 0.02, 0.5, 0.02, "#3a4150", x, 2.85, 2.6);
      var c = new T.Mesh(new T.CylinderGeometry(0.12, 0.38, 0.25, 16, 1, true), mat("#3a4150", { side: T.DoubleSide })); c.position.set(x, 2.5, 2.6); R.add(c);
      var l = new T.Mesh(new T.CircleGeometry(0.34, 16), new T.MeshBasicMaterial({ color: 0xfff1c8 })); l.rotation.x = Math.PI / 2; l.position.set(x, 2.39, 2.6); R.add(l);
    });
    // murs
    this.porteVers(this.groupeMur("O"), "O", 1.6, 2.8, "MAGASIN", { piece: "magasin" });
    var gE = this.groupeMur("E"), quai = new T.Group(); this.surMur(quai, "E", 2.9, 0); gE.add(quai);
    cube(quai, 2.4, 2.4, 0.05, "#aab3c0", 0, 1.2, 0.03);
    for (var z = 0.15; z < 2.4; z += 0.2) cube(quai, 2.4, 0.03, 0.02, "#8f99a8", 0, z, 0.06);
    cube(quai, 2.4, 0.12, 0.03, "#f2c230", 0, 0.06, 0.07);
    panneau(quai, texteTexture([{ s: "QUAI DE LIVRAISON", t: 40 }], { w: 512, h: 80, fond: "#1b2440", rond: 16 }), 2.0, 0.32, 0, 2.7, 0.02, 0);
    var gN = this.groupeMur("N"), en = new T.Group(); this.surMur(en, "N", X / 2, 2.6); gN.add(en);
    panneau(en, texteTexture([{ s: "RÉSERVE", t: 60, c: "#1f2328" }], { w: 400, h: 96, fond: "#f2c230", rond: 12 }), 1.7, 0.4, 0, 0, 0.02, 0);
    var gS = this.groupeMur("S"), ls = new T.Group(); this.surMur(ls, "S", X / 2, 2.6); gS.add(ls);
    cube(ls, 2.2, 0.12, 0.08, "#ffffff", 0, 0, 0.04, { emissive: new T.Color("#ffffff"), emissiveIntensity: 0.6 });
  };
  V.majReserve = function (s) {
    var Sim = TMI.Sim, u = { ordinateurs: 0, composants: 0, peripheriques: 0 };
    Object.keys(s.stock).forEach(function (pid) { var p = Sim.produit(pid); if (p && s.stock[pid] > 0) u[p.categorie] += s.stock[pid]; });
    this.dyn.etageres.forEach(function (E) {
      var n = u[E.cat.id], cle = n;
      if (E.cle === cle) return;
      E.cle = cle;
      var G = E.cartons; while (G.children.length) G.remove(G.children[0]);
      var nb = Math.min(12, Math.ceil(n / 2));
      for (var k = 0; k < nb; k++) {
        var niv = Math.floor(k / 4), pl = k % 4;
        carton(G, 0.44, 0.5 - (k % 3) * 0.06, 0.55, 0.3 + pl * 0.5, [0.135, 0.865, 1.595][niv], 0.42, E.cat.c);
      }
      var c = E.tex.image.getContext("2d"), police = getComputedStyle(document.body).fontFamily || "sans-serif";
      c.fillStyle = E.cat.c; c.fillRect(0, 0, 512, 120);
      c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = "800 44px " + police; c.fillText(E.cat.nom, 256, 40);
      c.font = "700 38px " + police; c.fillText(n ? n + " unité" + (n > 1 ? "s" : "") : "vide", 256, 92);
      E.tex.needsUpdate = true;
    });
    var P = this.dyn.palette, nbc = s.commandes.length;
    if (P.n !== nbc) {
      P.n = nbc;
      while (P.colis.children.length) P.colis.remove(P.colis.children[0]);
      for (var k = 0; k < Math.min(6, nbc); k++) carton(P.colis, 0.42, 0.45, 0.45, 0.28 + (k % 3) * 0.47, 0.165, 0.33 + Math.floor(k / 3) * 0.52);
      P.label.ecrire(nbc ? nbc + " livraison" + (nbc > 1 ? "s" : "") + " en route" : "Aucune livraison", nbc ? "#d29922" : "#5b6578");
    }
  };

  // ---------- Bureau
  V.salleBureau = function (R, s, X, Y) {
    var self = this, DD = root.TMI_DATA.deco;
    var tx = textureSol(DD ? DD.sols.parquet : { nom: "p", c1: "#c99a6b", c2: "#b88a5c", motif: "lames" }); tx.repeat.set(X / 2, Y / 2);
    sol(R, X, Y, tx, "#8a6a4a");
    // tapis
    var cv = toile(256), c = cv.getContext("2d");
    c.fillStyle = "#3b4a6b"; c.fillRect(0, 0, 256, 256); c.strokeStyle = "#c9a86a"; c.lineWidth = 6; c.strokeRect(12, 12, 232, 232); c.lineWidth = 2; c.strokeRect(24, 24, 208, 208);
    var ttx = new T.CanvasTexture(cv); ttx.colorSpace = T.SRGBColorSpace;
    plat(R, 4.0, 3.2, 3.4, 2.6, null, { map: ttx });
    // fauteuil du gérant
    var fa = new T.Group(); fa.position.set(3.3, 0, 1.1); R.add(fa);
    cube(fa, 0.08, 0.42, 0.08, "#3a4150", 0, 0.21, 0); cube(fa, 0.55, 0.06, 0.04, "#3a4150", 0, 0.04, 0); cube(fa, 0.04, 0.06, 0.55, "#3a4150", 0, 0.04, 0);
    cube(fa, 0.6, 0.12, 0.55, "#2c2f36", 0, 0.48, 0); cube(fa, 0.6, 0.75, 0.12, "#2c2f36", 0, 0.9, -0.25);
    // bureau du gérant (écran = résultat du mois)
    var B = new T.Group(); B.position.set(2.0, 0, 1.6); R.add(B);
    cube(B, 0.1, 0.74, 0.9, "#6b4a2e", 0.08, 0.37, 0.5); cube(B, 0.1, 0.74, 0.9, "#6b4a2e", 2.52, 0.37, 0.5);
    cube(B, 2.3, 0.5, 0.05, "#7d5836", 1.3, 0.45, 0.15);
    cube(B, 2.6, 0.06, 1.0, "#8a6240", 1.3, 0.77, 0.5);
    cube(B, 0.12, 0.16, 0.12, "#3a4150", 1.3, 0.88, 0.3); cube(B, 0.35, 0.02, 0.22, "#3a4150", 1.3, 0.81, 0.3);
    cube(B, 1.0, 0.6, 0.04, "#1b2233", 1.3, 1.25, 0.28);
    var ecran = toileTexture(512, 300), mEcran = new T.Mesh(new T.PlaneGeometry(0.94, 0.54), new T.MeshBasicMaterial({ map: ecran }));
    mEcran.position.set(1.3, 1.25, 0.305); B.add(mEcran);
    cube(B, 0.7, 0.02, 0.2, "#d9dfe7", 1.3, 0.81, 0.7);
    var tasse = new T.Mesh(new T.CylinderGeometry(0.05, 0.045, 0.11, 12), mat("#ffffff")); tasse.position.set(2.2, 0.855, 0.6); tasse.castShadow = true; B.add(tasse);
    cube(B, 0.42, 0.02, 0.32, "#f4f6f9", 0.45, 0.81, 0.6); cube(B, 0.42, 0.02, 0.32, "#ffffff", 0.48, 0.83, 0.62);
    var lab = etiquette("Bilan", "#12a150"); lab.position.set(1.3, 2.0, 0.5); B.add(lab);
    B.userData.action = { cible: { piece: "bureau", onglet: "bilan" } };
    this.pickables.push(B);
    // plan du local (rouleau bleu) → onglet Local
    var plan3 = new T.Group(); plan3.position.set(2.35, 0.83, 2.05); R.add(plan3);
    var rou = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.7, 12), mat("#3d6fd6")); rou.rotation.z = Math.PI / 2; rou.castShadow = true; plan3.add(rou);
    var feuille = new T.Mesh(new T.PlaneGeometry(0.5, 0.35), new T.MeshStandardMaterial({ map: texteTexture([{ s: "PLAN", t: 40, c: "#ffffff", y: 40 }, { s: "▭ ▭ ▭", t: 40, c: "#cfe0ff", y: 100 }], { w: 200, h: 140, fond: "#2a5bc4" }) }));
    feuille.rotation.x = -Math.PI / 2; feuille.position.set(-0.05, -0.035, -0.25); plan3.add(feuille);
    plan3.userData.action = { cible: { piece: "bureau", onglet: "local" } };
    this.pickables.push(plan3);
    // chaises visiteurs
    [2.67, 3.87].forEach(function (x) {
      var ch = new T.Group(); ch.position.set(x, 0, 3.35); R.add(ch);
      [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]].forEach(function (q) { cube(ch, 0.05, 0.45, 0.05, "#5b6578", q[0], 0.225, q[1]); });
      cube(ch, 0.5, 0.06, 0.48, "#2457ff", 0, 0.48, 0); cube(ch, 0.5, 0.5, 0.06, "#1a43d6", 0, 0.76, 0.22);
    });
    // classeur : journal
    var K = new T.Group(); K.position.set(6.45, 0, 3.0); R.add(K);
    cube(K, 0.7, 1.25, 0.8, "#9aa4b1", 0, 0.625, 0);
    [0.25, 0.65, 1.05].forEach(function (y) { cube(K, 0.02, 0.32, 0.66, "#b7c0cc", -0.355, y, 0); cube(K, 0.03, 0.04, 0.2, "#3a4150", -0.37, y + 0.06, 0); });
    var lk = etiquette("Journal", "#1f2a44"); lk.position.set(0, 1.75, 0); K.add(lk);
    K.userData.action = { cible: { piece: "bureau", onglet: "journal" } };
    this.pickables.push(K);
    // bibliothèque de classeurs contre le mur est
    var bib = new T.Group(); bib.position.set(6.65, 0, 1.2); R.add(bib);
    cube(bib, 0.06, 1.8, 1.8, "#7d5836", 0.27, 0.9, 0);
    [-0.88, 0.88].forEach(function (z) { cube(bib, 0.6, 1.8, 0.05, "#8a6240", 0, 0.9, z); });
    cube(bib, 0.6, 0.05, 1.8, "#8a6240", 0, 1.78, 0);
    var couleurs = ["#2457ff", "#d6334a", "#12a150", "#f08a24", "#7b4fd6"];
    [0.12, 0.72, 1.32].forEach(function (y, n) { cube(bib, 0.6, 0.04, 1.76, "#8a6240", 0, y, 0); for (var i = 0; i < 5; i++) cube(bib, 0.42, 0.42, 0.22, couleurs[(i + n) % 5], -0.12, y + 0.23, -0.64 + i * 0.32); });
    plante(R, 0.6, 0.6, 1); plante(R, 0.6, 4.4, 1);
    // murs : porte, calendrier, tableau de l'équipe, fenêtre, affiche pub, diplôme
    this.porteVers(this.groupeMur("O"), "O", 2.6, 3.8, "MAGASIN", { piece: "magasin" });
    var gO = this.groupeMur("O"), cal = new T.Group(); this.surMur(cal, "O", 1.3, 1.85); gO.add(cal);
    var tcal = toileTexture(200, 230); cube(cal, 0.55, 0.64, 0.02, "#ffffff", 0, 0, 0.01);
    var mcal = new T.Mesh(new T.PlaneGeometry(0.52, 0.6), new T.MeshBasicMaterial({ map: tcal })); mcal.position.z = 0.025; cal.add(mcal);
    var gN = this.groupeMur("N"), liege = new T.Group(); this.surMur(liege, "N", 2.0, 1.75); gN.add(liege);
    cube(liege, 2.5, 1.5, 0.06, "#8a6240", 0, 0, 0.03);
    var tl = toileTexture(512, 300), ml = new T.Mesh(new T.PlaneGeometry(2.36, 1.38), new T.MeshStandardMaterial({ map: tl, roughness: 0.9 })); ml.position.z = 0.065; liege.add(ml);
    var lp = etiquette("Personnel", "#1f2a44"); lp.position.set(0, 1.05, 0.2); liege.add(lp);
    liege.userData.action = { cible: { piece: "bureau", onglet: "personnel" } };
    this.pickables.push(liege);
    var fen = new T.Group(); this.surMur(fen, "N", 5.2, 1.65); gN.add(fen);
    cube(fen, 1.6, 1.6, 0.04, "#cde4f4", 0, 0, 0.02, { roughness: 0.05, metalness: 0.1 }); cube(fen, 0.06, 1.62, 0.06, "#8f9bb0", 0, 0, 0.04); cube(fen, 1.66, 0.06, 0.08, "#8f9bb0", 0, -0.83, 0.05);
    var gE = this.groupeMur("E"), pub = new T.Group(); this.surMur(pub, "E", 3.0, 2.05); gE.add(pub);
    var tp = toileTexture(256, 320); cube(pub, 0.8, 1.0, 0.03, "#2c2f36", 0, 0, 0.015);
    var mp = new T.Mesh(new T.PlaneGeometry(0.74, 0.94), new T.MeshBasicMaterial({ map: tp })); mp.position.z = 0.035; pub.add(mp);
    pub.userData.action = { cible: { piece: "bureau", onglet: "pub" } };
    this.pickables.push(pub);
    var dip = new T.Group(); this.surMur(dip, "E", 4.4, 1.8); gE.add(dip);
    cube(dip, 0.6, 0.45, 0.03, "#c9a86a", 0, 0, 0.015);
    panneau(dip, texteTexture([{ s: "INFO SERVICE", t: 34, c: "#5b6578", y: 50 }, { s: "Diplôme du commerce", t: 22, g: 600, c: "#9aa4b1", y: 100 }], { w: 300, h: 150, fond: "#ffffff" }), 0.52, 0.37, 0, 0, 0.035, 0);
    this.dyn.bureau = { ecran: ecran, lab: lab, tcal: tcal, tl: tl, lp: lp, tp: tp, cles: {} };
  };
  V.majBureau = function (s) {
    var D = this.dyn.bureau, Sim = TMI.Sim, police = getComputedStyle(document.body).fontFamily || "sans-serif", m = s.mois;
    var res = m.ca - m.cogs - Math.round(s.salairesDus) - m.loyer - m.charges, bon = res >= 0;
    var cleE = Math.round(res / 10);
    if (D.cles.e !== cleE) {
      D.cles.e = cleE;
      var c = D.ecran.image.getContext("2d");
      c.fillStyle = "#101826"; c.fillRect(0, 0, 512, 300);
      c.strokeStyle = "rgba(255,255,255,.08)"; c.lineWidth = 2; for (var gx = 0; gx < 512; gx += 64) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, 300); c.stroke(); }
      var h = bon ? [190, 170, 175, 140, 120, 90, 70] : [70, 100, 95, 140, 160, 190, 215];
      c.strokeStyle = bon ? "#3ddc84" : "#ff5c74"; c.lineWidth = 8; c.lineJoin = "round"; c.beginPath();
      h.forEach(function (y, i) { if (i) c.lineTo(40 + i * 72, y); else c.moveTo(40, y); }); c.stroke();
      c.fillStyle = "#ffffff"; c.font = "700 30px " + police; c.fillText("Résultat du mois", 24, 42);
      c.fillStyle = bon ? "#3ddc84" : "#ff5c74"; c.font = "800 52px " + police; c.textAlign = "right";
      c.fillText((bon ? "+" : "−") + Math.abs(Math.round(res)).toLocaleString("fr-FR") + " €", 490, 270); c.textAlign = "left";
      D.ecran.needsUpdate = true;
      D.lab.ecrire("Bilan " + (bon ? "+" : "−") + Math.abs(Math.round(res)).toLocaleString("fr-FR") + " €", bon ? "#12a150" : "#d6334a");
    }
    var di = Sim.infosDate(s), cleC = di.jourDuMois + di.nomMois;
    if (D.cles.c !== cleC) {
      D.cles.c = cleC;
      var k = D.tcal.image.getContext("2d");
      k.fillStyle = "#ffffff"; k.fillRect(0, 0, 200, 230); k.fillStyle = "#d6334a"; k.fillRect(0, 0, 200, 56);
      k.fillStyle = "#fff"; k.font = "800 30px " + police; k.textAlign = "center"; k.fillText(di.nomMois.toUpperCase(), 100, 40);
      k.fillStyle = "#1f2328"; k.font = "800 110px " + police; k.fillText(String(di.jourDuMois), 100, 180); k.textAlign = "left";
      D.tcal.needsUpdate = true;
    }
    var cleL = s.employes.length + ":" + s.candidats.length;
    if (D.cles.l !== cleL) {
      D.cles.l = cleL;
      var l = D.tl.image.getContext("2d");
      l.fillStyle = "#c99a5e"; l.fillRect(0, 0, 512, 300);
      for (var n = 0; n < 160; n++) { l.fillStyle = "rgba(90,61,34," + (0.05 + (n % 3) * 0.03) + ")"; l.fillRect((n * 71) % 512, (n * 43) % 300, 4, 4); }
      l.fillStyle = "#5a3d22"; l.font = "800 30px " + police; l.textAlign = "center"; l.fillText("ÉQUIPE", 256, 36);
      var eq = Math.min(6, s.employes.length), cand = Math.min(5, s.candidats.length);
      for (var i = 0; i < eq; i++) {
        var x = 256 - eq * 40 + i * 80 + 8;
        l.fillStyle = "#ffffff"; l.fillRect(x, 54, 64, 80); l.fillStyle = "#8f9bb0"; l.beginPath(); l.arc(x + 32, 82, 15, 0, 7); l.fill(); l.fillRect(x + 14, 102, 36, 18);
        l.fillStyle = "#d6334a"; l.beginPath(); l.arc(x + 32, 56, 5, 0, 7); l.fill();
      }
      for (var j = 0; j < cand; j++) {
        var cx = 256 - cand * 45 + j * 90 + 10;
        l.save(); l.translate(cx + 35, 220); l.rotate(j % 2 ? 0.06 : -0.05);
        l.fillStyle = "#fbfcfe"; l.fillRect(-35, -50, 70, 96); l.fillStyle = "#9aa4b1"; l.fillRect(-24, -30, 48, 6); l.fillRect(-24, -16, 40, 6); l.fillRect(-24, -2, 44, 6);
        l.fillStyle = "#2457ff"; l.beginPath(); l.arc(0, -50, 5, 0, 7); l.fill(); l.restore();
      }
      if (!eq && !cand) { l.fillStyle = "#5a3d22"; l.font = "600 28px " + police; l.fillText("personne pour l'instant", 256, 170); }
      l.textAlign = "left";
      D.tl.needsUpdate = true;
      D.lp.ecrire(s.candidats.length ? s.candidats.length + " candidat" + (s.candidats.length > 1 ? "s" : "") : "Personnel", s.employes.length ? "#1f2a44" : "#d29922");
    }
    var actives = (s.pubs || []).filter(function (c) { return s.jour <= c.fin; }).length;
    if (D.cles.p !== actives) {
      D.cles.p = actives;
      var p = D.tp.image.getContext("2d");
      p.fillStyle = actives ? "#ff7a1a" : "#2457ff"; p.fillRect(0, 0, 256, 320);
      p.fillStyle = "#fff"; p.textAlign = "center"; p.font = "800 64px " + police; p.fillText("PUB", 128, 90);
      p.beginPath(); p.moveTo(70, 160); p.lineTo(170, 115); p.lineTo(170, 235); p.lineTo(70, 190); p.closePath(); p.fill();
      p.fillRect(52, 158, 22, 34); p.fillRect(92, 192, 18, 40);
      p.strokeStyle = "#fff"; p.lineWidth = 6; [20, 38].forEach(function (r) { p.beginPath(); p.arc(176, 175, r, -0.7, 0.7); p.stroke(); });
      p.font = "700 28px " + police; p.fillText(actives ? actives + " campagne" + (actives > 1 ? "s" : "") : "aucune campagne", 128, 285);
      p.textAlign = "left";
      D.tp.needsUpdate = true;
    }
  };

  TMI.Vue3D = Vue3D;

  // Vue « hybride » : la salle de vente en 3D (si le joueur l'a choisie et si WebGL marche),
  // la réserve et le bureau restent dans la vue 2D. main.js ne voit qu'un seul objet.
  function VueHybride(svg, conteneur, options) {
    this.v2 = new TMI.VueMagasin(svg, options);
    this.svg = svg; this.conteneur = conteneur; this.options = options;
    this.piece = "magasin"; this.v3 = null;
    this.mode3d = VueHybride.prefere();
    this.basculer(this.mode3d, true);
  }
  VueHybride.prefere = function () {
    var v = null;
    try { v = localStorage.getItem("tmi_rendu"); } catch (e) {}
    return v ? v === "3d" : Vue3D.disponible();
  };
  var H = VueHybride.prototype;
  H.actif3d = function () { return this.mode3d; };
  H.basculer = function (oui, init) {
    if (oui && !Vue3D.disponible()) oui = false;
    this.mode3d = oui;
    if (!init) { try { localStorage.setItem("tmi_rendu", oui ? "3d" : "2d"); } catch (e) {} }
    this.appliquer();
  };
  H.appliquer = function () {
    var a = this.actif3d();
    if (a && !this.v3) { this.v3 = new Vue3D(this.conteneur, this.options); this.v3.changerPiece(this.piece); }
    this.svg.classList.toggle("cache", a);
    this.conteneur.classList.toggle("cache", !a);
    if (this.v3) this.v3.afficher(a);
    if (a && this.dernier) this.v3.maj(this.dernier);
    if (!a && this.dernier) this.v2.maj(this.dernier);
    var m = this.mode3d;
    document.querySelectorAll("[data-cam='3d']").forEach(function (b) { b.classList.toggle("actif", m); b.querySelector("b").textContent = m ? "2D" : "3D"; });
  };
  H.changerPiece = function (p) { this.piece = p; this.v2.changerPiece(p); if (this.v3) this.v3.changerPiece(p); this.appliquer(); };
  H.maj = function (s) { this.dernier = s; if (this.actif3d()) this.v3.maj(s); else this.v2.maj(s); };
  // Déco : la pose se fait toujours en 3D
  H.placer = function (s, pose) {
    if (!Vue3D.disponible()) return false;
    if (!this.mode3d) this.basculer(true);
    if (this.piece !== "magasin") this.changerPiece("magasin");
    this.v3.placer(s, pose); return true;
  };
  H.tournerPose = function () { if (this.v3) this.v3.tournerPose(); };
  H.finPose = function () { if (this.v3) this.v3.finPose(); };
  H.choisirDeco = function (id) { if (this.v3) this.v3.choisirDeco(id); if (this.v2.choisirDeco) this.v2.choisirDeco(id); };
  H.vider = function () { this.v2.vider(); if (this.v3) this.v3.vider(); };
  ["zoomer", "recentrer", "tourner"].forEach(function (f) {
    H[f] = function (a) { return this.actif3d() ? this.v3[f](a) : this.v2[f](a); };
  });
  TMI.VueHybride = VueHybride;
  TMI.Vue3D.disponible = function () {
    try { var c = document.createElement("canvas"); return !!(root.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; }
  };
})(window);
