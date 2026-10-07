// Vue du magasin en 2D isométrique, dessinée par le code (pas encore d'images définitives).
// Repère « physique » du sol : x de 0 à 14, y de 0 à 10, une case = 1 unité.
// La caméra peut tourner par quarts de tour (rot 0 à 3) : chaque point physique passe par
// vue() puis par la projection isométrique. Les murs qui se retrouvent devant sont masqués.
// Zoom (molette, pincement, boutons) et déplacement (glisser) modifient la viewBox.
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};
  var NS = "http://www.w3.org/2000/svg";

  var COURT = { portable_bureau: "Portable", portable_gaming: "PC gaming", pc_fixe: "PC fixe", carte_graphique: "Graphique",
                processeur: "Processeur", ram: "Mémoire", ssd: "SSD", ecran: "Écran", clavier_souris: "Clavier", casque: "Casque" };
  var GAMME = ["entrée", "milieu", "haut"];

  // ------------------------------------------------------------ Plan du magasin (coordonnées physiques)
  var TW = 56, TH = 28, MURS = 118;
  // Les pièces : la salle de vente, la réserve et le bureau
  var PIECES = { magasin: { x: 14, y: 10 }, reserve: { x: 8, y: 6 }, bureau: { x: 7, y: 5 } };
  // Plan de la salle de vente selon la taille du local (petit, moyen, grand).
  // Le petit local garde exactement le plan d'origine ; les autres s'agrandissent vers l'est et le sud.
  var RAYONS, CAISSE, TABLE, ATELIER, PORTE, ENTREE, DX = 0, DXC = 0, DYC = 0, DYT = 0, RANGEES = [];
  // Le plan lui-même est calculé par la simulation (Sim.plan) : la vue 2D, la vue 3D et la déco partagent les mêmes cotes.
  function appliquerPlan(taille, emplacements) {
    var P = TMI.Sim.plan(taille, emplacements);
    ATELIER = P.atelier; CAISSE = P.caisse; TABLE = P.table; PORTE = P.porte; ENTREE = P.entree;
    DX = P.DX; DXC = P.DXC; DYC = P.DYC; DYT = P.DYT;
    RAYONS = P.rayons; RANGEES = P.rangees;
    PIECES.magasin = { x: P.dim.x, y: P.dim.y };
  }
  appliquerPlan("petit", 8);
  var ZOOM_MIN = 0.8, ZOOM_MAX = 3.5;

  var FORMES = {
    portable_bureau: { type: "portable", c: "#9aa4b1" }, portable_gaming: { type: "portable", c: "#2c2f36", led: "#ff3d7f" },
    pc_fixe: { type: "tour", c: "#e9ecf1" }, carte_graphique: { type: "boite", c: "#1f8a4c", hh: 9 },
    processeur: { type: "boite", c: "#2f6fe0", hh: 6 }, ram: { type: "boite", c: "#7b4fd6", hh: 5 },
    ssd: { type: "boite", c: "#0f9fb3", hh: 4 }, ecran: { type: "ecran", c: "#23262d" },
    clavier_souris: { type: "boite", c: "#f08a24", hh: 5 }, casque: { type: "boite", c: "#d63a3a", hh: 8 }
  };

  // ------------------------------------------------------------ Outils
  function isoV(x, y, z) { return [(x - y) * TW / 2, (x + y) * TH / 2 - (z || 0)]; }
  function pts(liste) { return liste.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }
  function el(nom, attrs, parent) {
    var e = document.createElementNS(NS, nom);
    for (var k in attrs) {
      if (typeof attrs[k] === "string" && attrs[k].indexOf("var(") === 0) e.style.setProperty(k, attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function hache(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h); }
  function teintes(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var m = function (v) { return Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))); };
    return "#" + ((1 << 24) + (m(r) << 16) + (m(g) << 8) + m(b)).toString(16).slice(1);
  }
  function c3(hex) { return { dessus: teintes(hex, 0.18), gauche: hex, droite: teintes(hex, -0.22) }; }
  function borne(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ------------------------------------------------------------ Vue
  function VueMagasin(svg, options) {
    this.svg = svg; this.options = options || {};
    this.rot = 0; this.zoom = 1; this.centre = null;
    this.piece = "magasin"; this.dim = PIECES.magasin;
    this.clients = {}; this.employes = {}; this.rayons = [];
    this.brancherCamera();
    this.construire();
  }
  var V = VueMagasin.prototype;

  // physique -> repère de la caméra
  V.vue = function (x, y) {
    var X = this.dim.x, Y = this.dim.y;
    switch (this.rot) {
      case 1: return [Y - y, x];
      case 2: return [X - x, Y - y];
      case 3: return [y, X - x];
      default: return [x, y];
    }
  };
  V.dimsVue = function () { var d = this.dim; return this.rot % 2 ? { x: d.y, y: d.x } : { x: d.x, y: d.y }; };
  V.P = function (x, y, z) { var v = this.vue(x, y); return isoV(v[0], v[1], z); };
  V.profondeur = function (x, y) { var v = this.vue(x, y); return v[0] + v[1]; };

  // Boîte posée au sol (coordonnées physiques), dessinée selon l'orientation de la caméra
  V.boite = function (parent, x, y, w, d, h, c, z0) {
    z0 = z0 || 0;
    var a = this.vue(x, y), b = this.vue(x + w, y + d);
    var vx = Math.min(a[0], b[0]), vy = Math.min(a[1], b[1]), vw = Math.abs(a[0] - b[0]), vd = Math.abs(a[1] - b[1]);
    var g = el("g", {}, parent);
    var A = isoV(vx, vy + vd, z0), B = isoV(vx + vw, vy + vd, z0), C = isoV(vx + vw, vy, z0);
    var At = isoV(vx, vy + vd, z0 + h), Bt = isoV(vx + vw, vy + vd, z0 + h), Ct = isoV(vx + vw, vy, z0 + h), Dt = isoV(vx, vy, z0 + h);
    el("polygon", { points: pts([A, B, Bt, At]), fill: c.gauche }, g);
    el("polygon", { points: pts([B, C, Ct, Bt]), fill: c.droite }, g);
    el("polygon", { points: pts([Dt, Ct, Bt, At]), fill: c.dessus }, g);
    if (c.trait) el("polyline", { points: pts([At, Bt, Ct]), fill: "none", stroke: c.trait, "stroke-width": 1 }, g);
    return g;
  };
  V.poly = function (parent, liste, attrs) {
    var self = this;
    attrs.points = pts(liste.map(function (p) { return self.P(p[0], p[1], p[2]); }));
    return el("polygon", attrs, parent);
  };
  // Repère 2D posé sur un plan vertical (mur, face de meuble) : le texte se lit toujours de gauche à droite.
  // a, b : deux points au sol qui donnent la direction du plan ; c : centre ; z : haut ; l : largeur en px.
  V.surPlan = function (parent, a, b, c, z, l) {
    var A = this.P(a[0], a[1], z), B = this.P(b[0], b[1], z);
    if (B[0] < A[0]) { var t = A; A = B; B = t; }
    var pente = (B[1] - A[1]) / (B[0] - A[0]);
    var C = this.P(c[0], c[1], z);
    var ox = C[0] - l / 2, oy = C[1] - pente * l / 2;
    return el("g", { transform: "matrix(1," + pente.toFixed(3) + ",0,1," + ox.toFixed(1) + "," + oy.toFixed(1) + ")" }, parent);
  };
  // Face d'un meuble visible par la caméra parmi ses deux grandes faces (côté y et côté y+d)
  V.faceVisible = function (o) {
    var avant = this.vue(o.x + o.w / 2, o.y + o.d + 1), centre = this.vue(o.x + o.w / 2, o.y + o.d / 2);
    var versCamera = (avant[0] - centre[0]) + (avant[1] - centre[1]) > 0;
    return versCamera ? o.y + o.d : o.y;
  };
  // Le côté physique est-il au fond (mur visible) ?
  V.coteAuFond = function (cote) {
    var X = this.dim.x, Y = this.dim.y;
    var s = { N: [[0, 0], [X, 0]], O: [[0, 0], [0, Y]], S: [[0, Y], [X, Y]], E: [[X, 0], [X, Y]] }[cote];
    var a = this.vue(s[0][0], s[0][1]), b = this.vue(s[1][0], s[1][1]);
    if (a[1] === 0 && b[1] === 0) return "d";
    if (a[0] === 0 && b[0] === 0) return "g";
    return null;
  };

  // ------------------------------------------------------------ Caméra : zoom, déplacement, rotation
  V.cadreBase = function () {
    var d = this.dimsVue();
    var coins = [isoV(0, 0, MURS + 30), isoV(d.x, 0, MURS + 10), isoV(0, d.y, MURS + 10), isoV(d.x, d.y, -14), isoV(d.x, d.y, 0)];
    var xs = coins.map(function (c) { return c[0]; }), ys = coins.map(function (c) { return c[1]; });
    var minX = Math.min.apply(null, xs) - 22, maxX = Math.max.apply(null, xs) + 22;
    var minY = Math.min.apply(null, ys) - 6, maxY = Math.max.apply(null, ys) + 26;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };
  V.appliquerCamera = function () {
    var b = this.cadreBase();
    if (!this.centre) this.centre = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var w = b.w / this.zoom, h = b.h / this.zoom;
    // on garde toujours une partie du magasin à l'écran
    this.centre.x = borne(this.centre.x, b.x + Math.min(w, b.w) / 2 - 40, b.x + b.w - Math.min(w, b.w) / 2 + 40);
    this.centre.y = borne(this.centre.y, b.y + Math.min(h, b.h) / 2 - 40, b.y + b.h - Math.min(h, b.h) / 2 + 40);
    this.svg.setAttribute("viewBox", (this.centre.x - w / 2).toFixed(1) + " " + (this.centre.y - h / 2).toFixed(1) + " " + w.toFixed(1) + " " + h.toFixed(1));
  };
  V.zoomer = function (facteur, px, py) {
    var nz = borne(this.zoom * facteur, ZOOM_MIN, ZOOM_MAX);
    if (px != null) {   // garde le point visé sous le doigt
      this.centre.x = px + (this.centre.x - px) * this.zoom / nz;
      this.centre.y = py + (this.centre.y - py) * this.zoom / nz;
    }
    this.zoom = nz;
    this.appliquerCamera();
  };
  V.recentrer = function () { this.zoom = 1; this.centre = null; this.appliquerCamera(); };
  V.pointSvg = function (cx, cy) {
    var m = this.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    var p = this.svg.createSVGPoint(); p.x = cx; p.y = cy;
    p = p.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  V.brancherCamera = function () {
    var self = this, svg = this.svg, pointeurs = {}, depart = null, aBouge = false;
    svg.style.touchAction = "none";
    svg.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      var p = self.pointSvg(ev.clientX, ev.clientY);
      self.zoomer(Math.exp(-ev.deltaY * 0.0015), p.x, p.y);
    }, { passive: false });
    function etatGeste() {
      var ids = Object.keys(pointeurs), a = pointeurs[ids[0]], b = pointeurs[ids[1]];
      if (ids.length >= 2) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
      return { x: a.x, y: a.y, dist: 0 };
    }
    svg.addEventListener("pointerdown", function (ev) {
      self.appuye = true;   // pas de redessin pendant un appui : le clic doit arriver à son objet
      pointeurs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      depart = etatGeste(); depart.zoom = self.zoom; depart.centre = { x: self.centre.x, y: self.centre.y };
      depart.n = Object.keys(pointeurs).length;
      if (depart.n === 1) aBouge = false;
    });
    svg.addEventListener("pointermove", function (ev) {
      if (!pointeurs[ev.pointerId]) return;
      pointeurs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var g = etatGeste(), n = Object.keys(pointeurs).length;
      if (n !== depart.n) { depart = g; depart.zoom = self.zoom; depart.centre = { x: self.centre.x, y: self.centre.y }; depart.n = n; return; }
      if (!aBouge && Math.hypot(g.x - depart.x, g.y - depart.y) < 6 && n === 1) return;
      if (!aBouge) { aBouge = true; try { svg.setPointerCapture(ev.pointerId); } catch (e) {} }
      var m = svg.getScreenCTM(); if (!m) return;
      var echelle = 1 / m.a;   // px écran -> unités svg
      if (n >= 2 && depart.dist > 0) {
        var nz = borne(depart.zoom * g.dist / depart.dist, ZOOM_MIN, ZOOM_MAX);
        self.zoom = nz;
      }
      echelle = 1 / (svg.getScreenCTM() ? svg.getScreenCTM().a : m.a);
      self.centre.x = depart.centre.x - (g.x - depart.x) * echelle;
      self.centre.y = depart.centre.y - (g.y - depart.y) * echelle;
      self.appliquerCamera();
    });
    function fin(ev) {
      delete pointeurs[ev.pointerId];
      if (!Object.keys(pointeurs).length) setTimeout(function () { self.appuye = false; }, 0);
      if (Object.keys(pointeurs).length) { depart = etatGeste(); depart.zoom = self.zoom; depart.centre = { x: self.centre.x, y: self.centre.y }; depart.n = Object.keys(pointeurs).length; }
    }
    svg.addEventListener("pointerup", fin);
    svg.addEventListener("pointercancel", fin);
    // un glisser ne doit pas ouvrir un rayon
    svg.addEventListener("click", function (ev) { if (aBouge) { ev.stopPropagation(); ev.preventDefault(); aBouge = false; } }, true);
  };

  // ------------------------------------------------------------ Décor commun à toutes les pièces
  var SOLS = {
    magasin: ["var(--carreau-a)", "var(--carreau-b)"],
    reserve: ["#d3d7de", "#c9ced6"],
    bureau: ["#d8ad7f", "#cfa070", "#c8996a"]
  };
  var MURS_PIECE = {
    magasin: ["var(--mur-g)", "var(--mur-d)"],
    reserve: ["#cdd3dc", "#e2e6ec"],
    bureau: ["#e6dccd", "#f3ece2"]
  };
  var CATS = [
    { id: "ordinateurs", nom: "ORDINATEURS", c: "#2457ff" },
    { id: "composants", nom: "COMPOSANTS", c: "#12a150" },
    { id: "peripheriques", nom: "PÉRIPHÉRIQUES", c: "#f08a24" }
  ];

  V.construire = function () {
    var svg = this.svg, self = this, X = this.dim.x, Y = this.dim.y, dv = this.dimsVue();
    svg.innerHTML = "";
    this.clients = {}; this.employes = {}; this.rayons = [];
    this.aiguilleH = this.aiguilleM = null;
    var defs = el("defs", {}, svg);
    var grad = el("linearGradient", { id: "lumiere", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0", "stop-color": "#ffffff", "stop-opacity": 0.55 }, grad);
    el("stop", { offset: "1", "stop-color": "#ffffff", "stop-opacity": 0 }, grad);

    var sol = el("g", {}, svg);
    el("polygon", { points: pts([isoV(0, dv.y), isoV(dv.x, dv.y), isoV(dv.x, dv.y, -10), isoV(0, dv.y, -10)]), fill: "var(--dalle-g)" }, sol);
    el("polygon", { points: pts([isoV(dv.x, dv.y), isoV(dv.x, 0), isoV(dv.x, 0, -10), isoV(dv.x, dv.y, -10)]), fill: "var(--dalle-d)" }, sol);
    var teintesSol = SOLS[this.piece];
    var decoS = this.piece === "magasin" && this.dernierEtat && root.TMI_DATA.deco ? TMI.Sim.deco(this.dernierEtat) : null;
    if (decoS && decoS.sol !== "carrelage") { var ds = root.TMI_DATA.deco.sols[decoS.sol]; teintesSol = [ds.c1, ds.c2]; }
    if (this.piece === "bureau") {
      // parquet : lames de 2 × 0,5 décalées
      for (var ly = 0; ly < Y * 2; ly++) for (var lx = -(ly % 2); lx < X; lx += 2) {
        var x0 = Math.max(0, lx), x1 = Math.min(X, lx + 2);
        this.poly(sol, [[x0, ly / 2, 0], [x1, ly / 2, 0], [x1, ly / 2 + 0.5, 0], [x0, ly / 2 + 0.5, 0]], { fill: teintesSol[(ly + lx + 3) % 3], stroke: "#b88a5c", "stroke-width": 0.5 });
      }
    } else {
      for (var tx = 0; tx < X; tx++) for (var ty = 0; ty < Y; ty++) {
        this.poly(sol, [[tx, ty, 0], [tx + 1, ty, 0], [tx + 1, ty + 1, 0], [tx, ty + 1, 0]], { fill: (tx + ty) % 2 ? teintesSol[0] : teintesSol[1] });
      }
    }

    if (this.piece === "bureau") this.prepBureau(this.dernierEtat);
    // Murs : seulement ceux qui sont au fond pour la caméra
    var murs = el("g", {}, svg);
    ["N", "O", "S", "E"].forEach(function (cote) {
      var teinte = self.coteAuFond(cote);
      if (teinte) self.mur(murs, cote, teinte);
    });

    // Calque des objets triés par profondeur
    this.calque = el("g", {}, svg);
    this.objets = [];
    if (this.piece === "reserve") this.decorReserve(sol, this.dernierEtat);
    else if (this.piece === "bureau") this.decorBureau(sol, this.dernierEtat);
    else this.decorMagasin(sol);
    this.appliquerCamera();
    if (this.piece !== "magasin") this.reordonner();
  };

  // Objet posé au sol, avec son emprise physique (x0, y0) -> (x1, y1) pour le tri d'affichage
  V.objet = function (x0, y0, x1, y1) { var g = el("g", {}, this.calque); g._emprise = [x0, y0, x1, y1]; this.objets.push(g); return g; };

  // Rend un groupe cliquable : il ouvre un écran de gestion (cible = { piece, onglet, ... })
  V.cliquable = function (g, titre, cible) {
    var self = this;
    g.setAttribute("class", ((g.getAttribute("class") || "") + " cible-svg").trim());
    g.setAttribute("role", "button"); g.setAttribute("tabindex", 0); g.setAttribute("aria-label", titre);
    el("title", {}, g).textContent = titre;
    var go = function () { if (self.options.surCible) self.options.surCible(cible); };
    g.addEventListener("click", go);
    g.addEventListener("keydown", function (ev) { if (ev.key === "Enter") go(); });
  };

  // Pastille de texte flottante au-dessus d'un objet cliquable
  V.etiquette = function (g, x, y, z, texte, couleur) {
    var p = this.P(x, y, z), l = texte.length * 6.1 + 18;
    var e = el("g", { class: "etiquette-objet", transform: "translate(" + p[0].toFixed(1) + "," + p[1].toFixed(1) + ")" }, g);
    el("path", { d: "M-4 0 l4 5 l4 -5 z", fill: couleur || "var(--enseigne)" }, e);
    el("rect", { x: -l / 2, y: -17, width: l, height: 17, rx: 8.5, fill: couleur || "var(--enseigne)" }, e);
    el("text", { x: 0, y: -5.2, "text-anchor": "middle", "font-size": 10, "font-weight": 800, fill: "#fff", class: "svg-texte" }, e).textContent = texte;
    return e;
  };

  // Porte dans un mur (u0 -> u1 le long du mur) ; cible = pièce où elle mène
  V.porte = function (g, cote, u0, u1, texte, cible) {
    var X = this.dim.x, Y = this.dim.y, self = this;
    var p = function (u) { return cote === "N" ? [u, 0] : cote === "S" ? [u, Y] : cote === "O" ? [0, u] : [X, u]; };
    var a = p(u0), b = p(u1), long = cote === "N" || cote === "S" ? X : Y;
    var gp = el("g", { class: "porte-svg" }, g);
    this.poly(gp, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], 78], [a[0], a[1], 78]], { fill: "#c7ced9", stroke: "var(--chaperon)", "stroke-width": 2.5 });
    this.poly(gp, [[a[0], a[1], 50], [b[0], b[1], 50], [b[0], b[1], 70], [a[0], a[1], 70]].map(function (q, i) {
      var f = i === 0 || i === 3 ? 0.18 : 0.82; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, q[2]];
    }), { fill: "var(--vitre)" });
    var m = this.P(a[0] + (b[0] - a[0]) * 0.82, a[1] + (b[1] - a[1]) * 0.82, 36);
    el("circle", { cx: m[0], cy: m[1], r: 2.4, fill: "#5b6578" }, gp);
    var lab = this.surPlan(gp, p(0), p(long), p((u0 + u1) / 2), 97, 52);
    el("rect", { x: 0, y: 0, width: 52, height: 15, rx: 4, fill: "var(--enseigne)" }, lab);
    el("text", { x: 26, y: 10.6, "text-anchor": "middle", "font-size": 7.8, "font-weight": 800, fill: "#fff", "letter-spacing": 0.6, class: "svg-texte" }, lab).textContent = texte;
    if (cible) {
      gp.setAttribute("role", "button"); gp.setAttribute("tabindex", 0); gp.setAttribute("aria-label", "Aller : " + texte.toLowerCase());
      el("title", {}, gp).textContent = "Aller : " + texte.toLowerCase();
      var go = function () { if (self.options.surCible) self.options.surCible({ piece: cible }); };
      gp.addEventListener("click", go);
      gp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") go(); });
    }
    return gp;
  };

  // Un mur du fond et sa décoration
  V.mur = function (parent, cote, teinte) {
    var X = this.dim.x, Y = this.dim.y, H = MURS;
    var seg = { N: [[0, 0], [X, 0]], O: [[0, 0], [0, Y]], S: [[0, Y], [X, Y]], E: [[X, 0], [X, Y]] }[cote];
    var a = seg[0], b = seg[1];
    var g = el("g", {}, parent);
    var couleurs = MURS_PIECE[this.piece], fond = teinte === "d" ? couleurs[1] : couleurs[0];
    var dm = this.piece === "magasin" && this.dernierEtat && root.TMI_DATA.deco ? TMI.Sim.deco(this.dernierEtat).murs : "blanc";
    if (dm !== "blanc") { var cm = root.TMI_DATA.deco.murs[dm].c; fond = teinte === "d" ? teintes(cm, 0.08) : teintes(cm, -0.1); }
    var face = [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], H], [a[0], a[1], H]];
    this.poly(g, face, { fill: fond });
    if (teinte === "d" && !(this.piece === "magasin" && cote === "S")) this.poly(g, face, { fill: "url(#lumiere)" });
    this.poly(g, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], 7], [a[0], a[1], 7]], { fill: "var(--plinthe)" });
    var A0 = this.P(a[0], a[1], H), B0 = this.P(b[0], b[1], H);
    el("line", { x1: A0[0], y1: A0[1], x2: B0[0], y2: B0[1], stroke: "var(--chaperon)", "stroke-width": 5, "stroke-linecap": "round" }, g);
    if (this.piece === "reserve") this.murReserve(g, cote, a, b);
    else if (this.piece === "bureau") this.murBureau(g, cote, a, b);
    else this.murMagasin(g, cote, a, b);
  };

  // ------------------------------------------------------------ Salle de vente
  V.decorMagasin = function (sol) {
    var self = this, X = this.dim.x;
    var finRayons = Math.max.apply(null, RAYONS.map(function (r) { return r.x + r.w; })) + 0.1, self2 = this;
    RANGEES.slice(0, -1).forEach(function (ry) { self2.poly(sol, [[0, ry + 1.7, 0], [finRayons, ry + 1.7, 0], [finRayons, ry + 2.7, 0], [0, ry + 2.7, 0]], { fill: "#ffffff", opacity: 0.35 }); });
    this.poly(sol, [[ATELIER.x, 0, 0], [X, 0, 0], [X, ATELIER.d, 0], [ATELIER.x, ATELIER.d, 0]], { fill: "var(--atelier-sol)" });
    // Tapis d'entrée + texte posé au sol
    var Ym = this.dim.y;
    this.poly(sol, [[PORTE.x + 0.1, Ym - 1.1, 0], [PORTE.x + PORTE.l - 0.1, Ym - 1.1, 0], [PORTE.x + PORTE.l - 0.1, Ym - 0.05, 0], [PORTE.x + 0.1, Ym - 0.05, 0]], { fill: "#3a4150" });
    var cT = this.P(PORTE.x + PORTE.l / 2, Ym - 0.55, 0), ux = this.P(1, 0, 0), u0 = this.P(0, 0, 0), uy = this.P(0, 1, 0);
    var vx = [ux[0] - u0[0], ux[1] - u0[1]], vy = [uy[0] - u0[0], uy[1] - u0[1]];
    var axe = Math.abs(vx[0]) > 0.1 ? vx : vy, autre = axe === vx ? vy : vx;
    if (axe[0] < 0) axe = [-axe[0], -axe[1]];
    if (autre[1] < 0) autre = [-autre[0], -autre[1]];
    var gt = el("g", { transform: "translate(" + cT[0].toFixed(1) + "," + cT[1].toFixed(1) + ") matrix(1," + (axe[1] / axe[0]).toFixed(3) + "," + (autre[0] / Math.abs(autre[0])).toFixed(3) + "," + (autre[1] / Math.abs(autre[0])).toFixed(3) + ",0,0)" }, sol);
    el("text", { x: 0, y: 3, "text-anchor": "middle", "font-size": 9, "font-weight": 800, fill: "#cfd5e0", "letter-spacing": 1, class: "svg-texte" }, gt).textContent = "BIENVENUE";

    this.rayons = RAYONS.map(function (r, i) {
      var g = self.objet(r.x, r.y, r.x + r.w, r.y + r.d);
      g.setAttribute("class", "rayon-svg"); g.setAttribute("role", "button"); g.setAttribute("tabindex", 0);
      g.setAttribute("aria-label", "Emplacement " + (i + 1));
      g.addEventListener("click", function () { if (self.options.surRayon) self.options.surRayon(i); });
      g.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && self.options.surRayon) self.options.surRayon(i); });
      return { g: g, r: r, cle: null };
    });

    // Caisse
    var C = CAISSE, cg = this.objet(C.x, C.y, C.x + C.w, C.y + C.d);
    this.boite(cg, C.x, C.y, C.w, C.d, C.h, { dessus: "#e8d9c3", gauche: "#c8a77f", droite: "#a88a65" });
    var fy = this.faceVisible(C), fy2 = fy === C.y ? C.y - 0.001 : fy + 0.001;
    this.poly(cg, [[C.x, fy2, C.h - 8], [C.x + C.w, fy2, C.h - 8], [C.x + C.w, fy2, C.h - 2], [C.x, fy2, C.h - 2]], { fill: "#3a4150" });
    this.boite(cg, C.x + 1.4, C.y + 0.15, 0.5, 0.4, 5, c3("#2c2f36"), C.h);
    this.poly(cg, [[C.x + 1.45, C.y + 0.25, C.h + 5], [C.x + 1.85, C.y + 0.25, C.h + 5], [C.x + 1.85, C.y + 0.25, C.h + 19], [C.x + 1.45, C.y + 0.25, C.h + 19]], { fill: "#1b2233", stroke: "#2c2f36", "stroke-width": 1.5 });
    this.poly(cg, [[C.x + 1.5, C.y + 0.25, C.h + 7], [C.x + 1.8, C.y + 0.25, C.h + 7], [C.x + 1.8, C.y + 0.25, C.h + 17], [C.x + 1.5, C.y + 0.25, C.h + 17]], { fill: "#5ad1ff", opacity: 0.8 });
    this.boite(cg, C.x + 0.4, C.y + 0.25, 0.3, 0.25, 4, c3("#9aa4b1"), C.h);
    var lc = this.surPlan(cg, [C.x, fy2], [C.x + C.w, fy2], [C.x + C.w / 2, fy2], C.h - 9, 60);
    el("text", { x: 30, y: 13, "text-anchor": "middle", "font-size": 9.5, "font-weight": 800, fill: "#ffffff", "letter-spacing": 1.5, class: "svg-texte" }, lc).textContent = "CAISSE";

    // Table de démonstration
    var T = TABLE, tg = this.objet(T.x, T.y, T.x + T.w, T.y + T.d);
    this.poly(tg, [[T.x + 0.1, T.y + T.d + 0.1, 0], [T.x + T.w + 0.05, T.y + T.d + 0.1, 0], [T.x + T.w + 0.05, T.y + 0.05, 0], [T.x + 0.1, T.y + 0.05, 0]], { fill: "rgba(20,30,50,.12)" });
    this.boite(tg, T.x + 0.2, T.y + 0.1, 0.12, 0.6, 22, c3("#8f9bb0"));
    this.boite(tg, T.x + 2.6, T.y + 0.1, 0.12, 0.6, 22, c3("#8f9bb0"));
    this.boite(tg, T.x, T.y, T.w, T.d, 4, { dessus: "#ffffff", gauche: "#d9dfe7", droite: "#bcc5d1" }, 22);
    [[T.x + 0.3, "#9aa4b1", null], [T.x + 1.2, "#2c2f36", "#ff3d7f"], [T.x + 2.1, "#9aa4b1", null]].forEach(function (d) {
      self.produitIso(tg, { type: "portable", c: d[1], led: d[2] }, d[0], T.y + 0.2, 26);
    });
    var tfy = this.faceVisible(T);
    var lt = this.surPlan(tg, [T.x, tfy], [T.x + T.w, tfy], [T.x + T.w / 2, tfy], 21, 70);
    el("text", { x: 35, y: 3, "text-anchor": "middle", "font-size": 7.5, "font-weight": 800, fill: "#5b6578", "letter-spacing": 1, class: "svg-texte" }, lt).textContent = "ESSAIE-MOI";

    if (this.dernierEtat && root.TMI_DATA.deco) this.decoIso(this.dernierEtat);

    // Atelier vitré (phase 2)
    var A = ATELIER;
    var etabli = this.objet(11.4 + DX, 0.4, 13.6 + DX, 1.3);
    this.boite(etabli, 11.4 + DX, 0.4, 2.2, 0.9, 26, c3("#8a6a4a"));
    this.boite(etabli, 11.6 + DX, 0.55, 0.6, 0.5, 10, c3("#3a4150"), 26);
    this.boite(etabli, 12.6 + DX, 0.6, 0.5, 0.4, 14, c3("#d4d9e1"), 26);
    // PC en cours de montage (visible quand l'atelier travaille)
    this.pcAtelier = el("g", {}, etabli);
    this.boite(this.pcAtelier, 12.2 + DX, 0.6, 0.3, 0.5, 22, c3("#2c2f36"), 26);
    this.poly(this.pcAtelier, [[12.22 + DX, 1.101, 34], [12.48 + DX, 1.101, 34], [12.48 + DX, 1.101, 44], [12.22 + DX, 1.101, 34 + 10]], { fill: "#ff3d7f", opacity: 0.85 });
    this.pcAtelier.style.display = "none";
    var armoire = this.objet(13.1 + DX, 2.2, 13.8 + DX, 3.7);
    this.boite(armoire, 13.1 + DX, 2.2, 0.7, 1.5, 34, c3("#c9ced8"));
    var vitre1 = this.objet(A.x, 0, A.x + 0.02, A.d);
    this.poly(vitre1, [[A.x, 0, 0], [A.x, A.d, 0], [A.x, A.d, A.h], [A.x, 0, A.h]], { fill: "var(--verre)", stroke: "var(--verre-bord)", "stroke-width": 1.5, "pointer-events": "none" });
    var vitre2 = this.objet(A.x, A.d, X, A.d + 0.02);
    this.poly(vitre2, [[A.x, A.d, 0], [X, A.d, 0], [X, A.d, A.h], [A.x, A.d, A.h]], { fill: "var(--verre)", stroke: "var(--verre-bord)", "stroke-width": 1.5, "pointer-events": "none" });
    var pan = this.surPlan(vitre1, [A.x, 0], [A.x, A.d], [A.x, A.d / 2], 96, 82);
    el("rect", { x: 0, y: 0, width: 82, height: 30, rx: 5, fill: "var(--enseigne)", opacity: 0.92 }, pan);
    el("text", { x: 41, y: 13, "text-anchor": "middle", "font-size": 10.5, "font-weight": 800, fill: "#fff", class: "svg-texte" }, pan).textContent = "ATELIER";
    this.texteAtelier = el("text", { x: 41, y: 24, "text-anchor": "middle", "font-size": 8.5, fill: "#c9d3ff", class: "svg-texte" }, pan);
    this.texteAtelier.textContent = "montage · réparation";
    // Tout l'atelier ouvre son écran de gestion
    var cibleAtelier = { piece: "magasin", onglet: "atelier" };
    this.cliquable(etabli, "Établi de l'atelier : montages et réparations", cibleAtelier);
    this.cliquable(armoire, "Armoire de l'atelier", cibleAtelier);
    this.cliquable(pan, "Atelier : montages et réparations", cibleAtelier);
  };

  // Déco en 2D : volumes simples (la pose se fait en 3D)
  var DECO_2D = { plante: null, grande_plante: null, banc: ["#b08a62", 12], canape: ["#2f8f8a", 18], cafe: ["#e9ecf1", 30], aquarium: ["#3aa0e0", 34],
                  lampadaire: ["#2c2f36", 50], neon: ["#ff4fa0", 40], chevalet: ["#d6334a", 28], ecran_pub: ["#20307a", 60], borne_jeu: ["#4b2a8a", 48],
                  coin_gaming: ["#c8102e", 22], coin_pro: ["#e9e3d8", 22], coin_etudiant: ["#ff7a1a", 26], coin_famille: ["#ffcf3d", 8] };
  V.decoIso = function (s) {
    var self = this;
    TMI.Sim.deco(s).objets.forEach(function (o) {
      var e = TMI.Sim.empriseDeco(o.type, o.x, o.y, o.rot), forme = DECO_2D[o.type], g;
      if (!forme) {
        var k = o.type === "grande_plante" ? 0.8 : 0.6;
        g = self.plante(e.x + (e.w - k) / 2, e.y + (e.d - k) / 2);
      } else {
        g = self.objet(e.x, e.y, e.x + e.w, e.y + e.d);
        var m = e.w > 1.5 && e.d > 1.5 ? 0.05 : 0.15;
        if (e.w > 1.5 && e.d > 1.5) self.poly(g, [[e.x, e.y, 0], [e.x + e.w, e.y, 0], [e.x + e.w, e.y + e.d, 0], [e.x, e.y + e.d, 0]], { fill: forme[0], opacity: 0.35 });
        self.boite(g, e.x + m + (e.w > 1.5 && e.d > 1.5 ? 0.4 : 0), e.y + m + (e.w > 1.5 && e.d > 1.5 ? 0.4 : 0), e.w - 2 * m - (e.w > 1.5 && e.d > 1.5 ? 0.8 : 0), e.d - 2 * m - (e.w > 1.5 && e.d > 1.5 ? 0.8 : 0), forme[1], c3(forme[0]));
      }
      if (g) {
        g.setAttribute("role", "button"); g.style.cursor = "pointer";
        g.addEventListener("click", function () { if (self.options.surDeco) self.options.surDeco(o.id); });
      }
    });
  };
  V.plante = function (x, y) {
    var pg = this.objet(x, y, x + 0.6, y + 0.6);
    this.boite(pg, x, y, 0.6, 0.6, 14, c3("#b5643c"));
    var pl = this.P(x + 0.3, y + 0.3, 14);
    [[-8, -14, 9], [6, -18, 10], [0, -26, 11], [-3, -8, 8], [9, -8, 7]].forEach(function (f) {
      el("ellipse", { cx: pl[0] + f[0], cy: pl[1] + f[1], rx: f[2], ry: f[2] * 0.7, fill: f[1] < -20 ? "#3f9b5a" : "#2f7d48" }, pg);
    });
    return pg;
  };

  V.murMagasin = function (g, cote, a, b) {
    var X = this.dim.x, Y = this.dim.y, H = MURS, self = this;
    if (cote === "S") {
      // Devanture vitrée avec la porte
      this.poly(g, [[0, Y, 10], [PORTE.x, Y, 10], [PORTE.x, Y, H - 16], [0, Y, H - 16]], { fill: "var(--vitre)" });
      this.poly(g, [[PORTE.x + PORTE.l, Y, 10], [X, Y, 10], [X, Y, H - 16], [PORTE.x + PORTE.l, Y, H - 16]], { fill: "var(--vitre)" });
      this.poly(g, [[PORTE.x, Y, 0], [PORTE.x + PORTE.l, Y, 0], [PORTE.x + PORTE.l, Y, 84], [PORTE.x, Y, 84]], { fill: "#f7f9fc", stroke: "var(--chaperon)", "stroke-width": 3 });
      var piliers = []; for (var px = 5; px < X - 1; px += 3) piliers.push(px);
      piliers.forEach(function (x) { self.poly(g, [[x, Y, 10], [x + 0.06, Y, 10], [x + 0.06, Y, H - 16], [x, Y, H - 16]], { fill: "var(--chaperon)" }); });
      var pe = this.surPlan(g, a, b, [PORTE.x + PORTE.l / 2, Y], 96, 60);
      el("text", { x: 30, y: 0, "text-anchor": "middle", "font-size": 10, "font-weight": 800, fill: "var(--texte-2)", "letter-spacing": 2, class: "svg-texte" }, pe).textContent = "ENTRÉE";
    }
    if (cote === "N") {
      var nom = this.nomVille || "";
      var l = Math.max(170, 52 + nom.length * 7.4);
      var e = this.surPlan(g, a, b, [5.2, 0], 100, l);
      this.fondEnseigne = el("rect", { x: 0, y: 0, width: l, height: 42, rx: 7, fill: "var(--enseigne)" }, e);
      el("rect", { x: 9, y: 9, width: 24, height: 24, rx: 6, fill: "var(--orange)" }, e);
      el("rect", { x: 14, y: 16, width: 14, height: 10, rx: 1.5, fill: "#fff" }, e);
      el("rect", { x: 19, y: 20, width: 4, height: 6, fill: "var(--orange)" }, e);
      el("text", { x: 42, y: 21, "font-size": 15, "font-weight": 800, fill: "#fff", "letter-spacing": 1.2, class: "svg-texte" }, e).textContent = "INFO SERVICE";
      this.texteEnseigne = el("text", { x: 42, y: 34, "font-size": 9.5, "font-weight": 600, fill: "#9fb3ff", "letter-spacing": 1.5, class: "svg-texte" }, e);
      this.texteEnseigne.textContent = nom;
    }
    if (cote === "O") {
      // Portes vers la réserve et le bureau, affiche, fenêtre et horloge
      this.porte(g, "O", 0.42, 1.52, "RÉSERVE", "reserve");
      this.porte(g, "O", 2.25, 3.35, "BUREAU", "bureau");
      this.poly(g, [[0, 5.8, 26], [0, 8.7, 26], [0, 8.7, 92], [0, 5.8, 92]], { fill: "var(--vitre)", stroke: "var(--chaperon)", "stroke-width": 3 });
      this.poly(g, [[0, 6.5, 40], [0, 7.1, 40], [0, 6.2, 86], [0, 6.0, 86]], { fill: "#ffffff", opacity: 0.45 });
      this.poly(g, [[0, 7.25, 26], [0, 7.3, 26], [0, 7.3, 92], [0, 7.25, 92]], { fill: "var(--chaperon)" });
      this.horloge(g, a, b, [0, Math.min(9.4, Y - 0.6)], 74);
    }
    if (this.dernierEtat && root.TMI_DATA.deco) this.decoMurale(g, cote, a, b);
  };
  // Objets muraux en 2D : panneaux plats (la 3D les montre en volume et allumés)
  var MUR_2D = {
    affiche_jeu: ["#1d1450", "#ffe14d", "PIXEL QUEST"], affiche_promo: ["#d6334a", "#ffe14d", "−20 %"], cadre_employe: ["#f6ecd0", "#5b4a1f", "★"],
    tableau: ["#f4efe6", "#2457ff", "●"], etagere_murale: ["#b08a62", "#ffffff", ""], ecran_mural: ["#123a7a", "#ffffff", "OFFRE"],
    ruban_led: [null, "#3dd6ff", ""], neon_eclair: [null, "#ffd23d", "ϟ"], neon_gameon: ["#141018", "#ff3d9a", "GAME ON"],
    neon_bienvenue: [null, "#7a5cff", "Bienvenue"], neon_coeur: [null, "#ff4d6d", "♥"]
  };
  V.decoMurale = function (g, cote, a, b) {
    var self = this, X = this.dim.x, DD = root.TMI_DATA.deco.objets, K = MURS / 3.0;
    TMI.Sim.deco(this.dernierEtat).objets.forEach(function (o) {
      var d = DD[o.type]; if (!d.mur || o.mur !== cote) return;
      var u = o.x + d.taille[0] / 2, c = cote === "N" ? [u, 0] : cote === "O" ? [0, u] : [X, u];
      var l = d.taille[0] * TW / 2, h = d.taille[1] * K, f = MUR_2D[o.type] || ["#fff", "#333", ""];
      var q = self.surPlan(g, a, b, c, (d.haut + d.taille[1] / 2) * K, l);
      if (d.neon) el("rect", { x: -8, y: -8, width: l + 16, height: h + 16, rx: 12, fill: d.neon, opacity: 0.22 }, q);
      if (f[0]) el("rect", { x: 0, y: 0, width: l, height: h, rx: 2, fill: f[0], stroke: d.neon || "#2c2f36", "stroke-width": d.neon ? 1.5 : 1 }, q);
      if (o.type === "ruban_led") el("rect", { x: 0, y: 0, width: l, height: 3, rx: 1.5, fill: f[1] }, q);
      else if (f[2]) el("text", { x: l / 2, y: h / 2 + 4, "text-anchor": "middle", "font-size": Math.min(14, h * 0.5, l / Math.max(2, f[2].length) * 1.6), "font-weight": 800, fill: f[1], class: "svg-texte" }, q).textContent = f[2];
      q.style.cursor = "pointer";
      q.addEventListener("click", function () { if (self.options.surDeco) self.options.surDeco(o.id); });
    });
  };

  V.horloge = function (g, a, b, c, z) {
    var hz = this.surPlan(g, a, b, c, z, 0);
    el("circle", { r: 15, fill: "#ffffff", stroke: "#3a4150", "stroke-width": 3 }, hz);
    for (var k = 0; k < 12; k++) {
      var an = k * Math.PI / 6;
      el("line", { x1: Math.sin(an) * 11, y1: -Math.cos(an) * 11, x2: Math.sin(an) * 13, y2: -Math.cos(an) * 13, stroke: "#3a4150", "stroke-width": k % 3 ? 1 : 2 }, hz);
    }
    this.aiguilleH = el("line", { x1: 0, y1: 0, x2: 0, y2: -7, stroke: "#1f2328", "stroke-width": 2.6, "stroke-linecap": "round" }, hz);
    this.aiguilleM = el("line", { x1: 0, y1: 0, x2: 0, y2: -11, stroke: "#1f2328", "stroke-width": 1.6, "stroke-linecap": "round" }, hz);
    el("circle", { r: 1.8, fill: "var(--orange)" }, hz);
  };

  // ------------------------------------------------------------ Réserve
  // Une étagère par catégorie : le nombre de cartons suit le stock réel.
  function infosReserve(s) {
    var Sim = TMI.Sim, r = { unites: {}, commandes: 0, prochaine: null };
    CATS.forEach(function (c) { r.unites[c.id] = 0; });
    if (!s) return r;
    Object.keys(s.stock).forEach(function (pid) {
      var p = Sim.produit(pid); if (p && s.stock[pid] > 0) r.unites[p.categorie] += s.stock[pid];
    });
    r.commandes = s.commandes.length;
    s.commandes.forEach(function (c) { if (r.prochaine == null || c.arrivee < r.prochaine) r.prochaine = c.arrivee; });
    return r;
  }

  V.decorReserve = function (sol, s) {
    var self = this, info = infosReserve(s);
    // Marquage au sol : allée et zone d'arrivage
    this.poly(sol, [[0.2, 1.35, 0], [7.8, 1.35, 0], [7.8, 1.45, 0], [0.2, 1.45, 0]], { fill: "#f2c230" });
    this.poly(sol, [[5.3, 1.9, 0], [7.85, 1.9, 0], [7.85, 4.3, 0], [5.3, 4.3, 0]], { fill: "none", stroke: "#f2c230", "stroke-width": 3, "stroke-dasharray": "8 5" });

    CATS.forEach(function (cat, i) {
      var R = { x: 0.35 + i * 2.5, y: 0.2, w: 2.1, d: 0.8, h: 82 };
      var g = self.objet(R.x, R.y, R.x + R.w, R.y + R.d);
      self.etagere(g, R, cat, info.unites[cat.id]);
      self.cliquable(g, "Étagère " + cat.nom.toLowerCase() + " : " + info.unites[cat.id] + " unités", { piece: "reserve", onglet: "stock", cat: cat.id });
    });

    // Poste de commande : bureau avec téléphone et écran, contre le mur ouest
    var D = { x: 0.25, y: 3.3, w: 0.9, d: 1.9 }, dg = this.objet(D.x, D.y, D.x + D.w, D.y + D.d);
    this.boite(dg, D.x + 0.05, D.y + 0.05, 0.1, 0.1, 24, c3("#5b6578"));
    this.boite(dg, D.x + 0.75, D.y + 0.05, 0.1, 0.1, 24, c3("#5b6578"));
    this.boite(dg, D.x + 0.05, D.y + 1.75, 0.1, 0.1, 24, c3("#5b6578"));
    this.boite(dg, D.x + 0.75, D.y + 1.75, 0.1, 0.1, 24, c3("#5b6578"));
    this.boite(dg, D.x, D.y, D.w, D.d, 4, c3("#7a8496"), 24);
    this.boite(dg, D.x + 0.15, D.y + 0.3, 0.12, 0.7, 2, c3("#2c2f36"), 28);
    this.poly(dg, [[D.x + 0.2, D.y + 0.3, 30], [D.x + 0.2, D.y + 1.0, 30], [D.x + 0.2, D.y + 1.0, 46], [D.x + 0.2, D.y + 0.3, 46]], { fill: "#1b2233" });
    this.poly(dg, [[D.x + 0.21, D.y + 0.36, 32], [D.x + 0.21, D.y + 0.94, 32], [D.x + 0.21, D.y + 0.94, 44], [D.x + 0.21, D.y + 0.36, 44]], { fill: "#5ad1ff", opacity: 0.85 });
    this.boite(dg, D.x + 0.4, D.y + 1.25, 0.35, 0.3, 4, c3("#d6334a"), 28);
    this.boite(dg, D.x + 0.45, D.y + 1.3, 0.25, 0.08, 3, c3("#2c2f36"), 32);
    this.boite(dg, D.x + 0.5, D.y + 0.25, 0.3, 0.4, 1, c3("#ffffff"), 28);
    this.etiquette(dg, D.x + D.w / 2, D.y + D.d / 2, 62, "Commander", "var(--accent)");
    this.cliquable(dg, "Poste de commande : passer une commande", { piece: "reserve", onglet: "commandes" });

    // Zone d'arrivage : palette et transpalette
    var pa = { x: 5.6, y: 2.3, w: 1.5, d: 1.2 }, pg = this.objet(pa.x, pa.y, pa.x + pa.w, pa.y + pa.d);
    this.boite(pg, pa.x, pa.y, pa.w, pa.d, 7, c3("#c49a63"));
    [0.1, 0.65, 1.2].forEach(function (dx) { self.boite(pg, pa.x + dx, pa.y, 0.2, pa.d, 7, c3("#a87f4c")); });
    var nb = Math.min(6, info.commandes);
    for (var k = 0; k < nb; k++) {
      var cx = pa.x + 0.1 + (k % 3) * 0.47, cy = pa.y + 0.15 + Math.floor(k / 3) * 0.5;
      this.boite(pg, cx, cy, 0.42, 0.45, 18, c3("#d2a86f"), 7);
      this.poly(pg, [[cx + 0.18, cy, 25], [cx + 0.24, cy, 25], [cx + 0.24, cy + 0.45, 25], [cx + 0.18, cy + 0.45, 25]], { fill: "#e9d6b4" });
    }
    var txt = !info.commandes ? "Aucune livraison" : info.commandes + " livraison" + (info.commandes > 1 ? "s" : "") + " en route";
    this.etiquette(pg, pa.x + pa.w / 2, pa.y + pa.d / 2, nb ? 52 : 30, txt, info.commandes ? "var(--alerte)" : "#5b6578");
    this.cliquable(pg, "Zone d'arrivage : " + txt.toLowerCase(), { piece: "reserve", onglet: "commandes" });
    var tp = this.objet(4.4, 3.8, 5.0, 4.2);
    this.boite(tp, 4.4, 3.85, 0.6, 0.3, 4, c3("#d6334a"));
    this.boite(tp, 4.4, 3.9, 0.08, 0.2, 30, c3("#3a4150"));

    // Cartons en vrac près de la porte
    var cv = this.objet(1.6, 4.9, 2.6, 5.6);
    this.boite(cv, 1.6, 4.9, 0.5, 0.6, 18, c3("#c99a5e"));
    this.boite(cv, 2.1, 5.0, 0.45, 0.5, 14, c3("#d2a86f"));
    this.boite(cv, 1.7, 5.0, 0.4, 0.45, 12, c3("#d2a86f"), 18);
  };

  // Étagère métallique à trois niveaux, remplie de cartons
  V.etagere = function (g, R, cat, unites) {
    var self = this, niveaux = [4, 32, 60];
    var fy = this.faceVisible(R), arriere = fy === R.y ? R.y + R.d - 0.08 : R.y;
    var montant = function (x, y) { self.boite(g, x, y, 0.08, 0.08, R.h, c3("#2f5fd0")); };
    var yAvant = fy === R.y ? R.y : R.y + R.d - 0.08;
    montant(R.x, arriere); montant(R.x + R.w - 0.08, arriere);
    var cartons = Math.min(12, Math.ceil(unites / 2)), place = 0;
    niveaux.forEach(function (z) {
      self.boite(g, R.x, R.y, R.w, R.d, 3, { dessus: "#d7dbe2", gauche: "#f08a24", droite: "#c86f18" }, z);
      for (var k = 0; k < 4 && place < cartons; k++, place++) {
        var cx = R.x + 0.1 + k * 0.49, cy = R.y + 0.14;
        self.boite(g, cx, cy, 0.44, 0.55, 20, c3(k % 2 ? "#d2a86f" : "#c99a5e"), z + 3);
        self.poly(g, [[cx + 0.18, cy, z + 23], [cx + 0.26, cy, z + 23], [cx + 0.26, cy + 0.55, z + 23], [cx + 0.18, cy + 0.55, z + 23]], { fill: cat.c, opacity: 0.85 });
      }
    });
    montant(R.x, yAvant); montant(R.x + R.w - 0.08, yAvant);
    var yf = fy === R.y ? R.y - 0.001 : R.y + R.d + 0.001;
    var lw = R.w * TW / 2 - 4;
    var pl = this.surPlan(g, [R.x, yf], [R.x + R.w, yf], [R.x + R.w / 2, yf], R.h + 2, lw);
    el("rect", { x: 0, y: 0, width: lw, height: 19, rx: 3, fill: cat.c }, pl);
    el("text", { x: lw / 2, y: 8.5, "text-anchor": "middle", "font-size": 6.6, "font-weight": 800, fill: "#fff", "letter-spacing": 0.4, class: "svg-texte" }, pl).textContent = cat.nom;
    el("text", { x: lw / 2, y: 16.5, "text-anchor": "middle", "font-size": 7.2, "font-weight": 600, fill: "#fff", class: "svg-texte num" }, pl).textContent = unites ? unites + " unité" + (unites > 1 ? "s" : "") : "vide";
  };

  V.murReserve = function (g, cote, a, b) {
    var X = this.dim.x, Y = this.dim.y;
    if (cote === "O") this.porte(g, "O", 1.6, 2.8, "MAGASIN", "magasin");
    if (cote === "E") {
      // Porte de quai à rideau métallique
      this.poly(g, [[X, 1.7, 0], [X, 4.1, 0], [X, 4.1, 92], [X, 1.7, 92]], { fill: "#aab3c0", stroke: "var(--chaperon)", "stroke-width": 3 });
      for (var z = 8; z < 92; z += 8) this.poly(g, [[X, 1.7, z], [X, 4.1, z], [X, 4.1, z + 1.2], [X, 1.7, z + 1.2]], { fill: "#8f99a8" });
      for (var k = 0; k < 6; k++) this.poly(g, [[X, 1.7 + k * 0.4, 0], [X, 1.9 + k * 0.4, 0], [X, 1.9 + k * 0.4, 6], [X, 1.7 + k * 0.4, 6]], { fill: "#1f2328" });
      this.poly(g, [[X, 1.7, 0], [X, 4.1, 0], [X, 4.1, 6], [X, 1.7, 6]], { fill: "#f2c230", opacity: 0.55 });
      var q = this.surPlan(g, a, b, [X, 2.9], 112, 96);
      el("rect", { x: 0, y: 0, width: 96, height: 17, rx: 5, fill: "var(--enseigne)" }, q);
      el("text", { x: 48, y: 12, "text-anchor": "middle", "font-size": 8.5, "font-weight": 800, fill: "#fff", "letter-spacing": 1, class: "svg-texte" }, q).textContent = "QUAI DE LIVRAISON";
    }
    if (cote === "N") {
      var af = this.surPlan(g, a, b, [X / 2, 0], 112, 90);
      el("rect", { x: 0, y: 0, width: 90, height: 22, rx: 4, fill: "#f2c230" }, af);
      el("text", { x: 45, y: 14.5, "text-anchor": "middle", "font-size": 9, "font-weight": 800, fill: "#1f2328", "letter-spacing": 1.5, class: "svg-texte" }, af).textContent = "RÉSERVE";
    }
    if (cote === "S") {
      var lum = this.surPlan(g, a, b, [X / 2, Y], 100, 0);
      el("rect", { x: -40, y: 0, width: 80, height: 6, rx: 3, fill: "#ffffff", stroke: "#c3ccd9" }, lum);
    }
  };

  // ------------------------------------------------------------ Bureau
  function resultatProvisoire(s) { var m = s.mois; return m.ca - m.cogs - Math.round(s.salairesDus) - m.loyer - m.charges; }
  // Données affichées sur les murs du bureau (dessinés avant les meubles)
  V.prepBureau = function (s) {
    var di = s ? TMI.Sim.infosDate(s) : null;
    this.moisCalendrier = di ? di.jourDuMois : 1;
    this.nomMoisCalendrier = di ? di.nomMois.toUpperCase() : "MARS";
    this.equipeTableau = { candidats: s ? s.candidats.length : 0, equipe: s ? s.employes.length : 0 };
  };

  V.decorBureau = function (sol, s) {
    var self = this;
    var resultat = s ? resultatProvisoire(s) : 0;
    // Tapis sous le bureau
    this.poly(sol, [[1.4, 1.0, 0], [5.4, 1.0, 0], [5.4, 4.2, 0], [1.4, 4.2, 0]], { fill: "#3b4a6b", opacity: 0.85 });
    this.poly(sol, [[1.55, 1.15, 0], [5.25, 1.15, 0], [5.25, 4.05, 0], [1.55, 4.05, 0]], { fill: "none", stroke: "#c9a86a", "stroke-width": 1.5 });

    // Fauteuil (derrière le bureau)
    var fa = this.objet(3.0, 0.9, 3.6, 1.45);
    this.boite(fa, 3.25, 1.1, 0.1, 0.1, 14, c3("#3a4150"));
    this.boite(fa, 3.0, 0.95, 0.6, 0.5, 5, c3("#2c2f36"), 14);
    this.boite(fa, 3.0, 0.9, 0.6, 0.12, 26, c3("#2c2f36"), 19);

    // Bureau du gérant : l'écran affiche le résultat du mois
    var B = { x: 2.0, y: 1.6, w: 2.6, d: 1.0 }, bg = this.objet(B.x, B.y, B.x + B.w, B.y + B.d);
    this.boite(bg, B.x + 0.05, B.y + 0.05, 0.12, B.d - 0.1, 26, c3("#6b4a2e"));
    this.boite(bg, B.x + B.w - 0.17, B.y + 0.05, 0.12, B.d - 0.1, 26, c3("#6b4a2e"));
    this.boite(bg, B.x + 0.2, B.y + 0.1, B.w - 0.4, 0.06, 18, c3("#7d5836"), 6);
    this.boite(bg, B.x, B.y, B.w, B.d, 4, c3("#8a6240"), 26);
    // écran
    this.boite(bg, B.x + 1.1, B.y + 0.2, 0.4, 0.2, 6, c3("#3a4150"), 30);
    var ez = 36, ex0 = B.x + 0.75, ex1 = B.x + 1.85, ey = B.y + 0.25;
    this.poly(bg, [[ex0, ey, ez], [ex1, ey, ez], [ex1, ey, ez + 26], [ex0, ey, ez + 26]], { fill: "#1b2233", stroke: "#2c2f36", "stroke-width": 1.5 });
    var bon = resultat >= 0, coul = bon ? "#3ddc84" : "#ff5c74";
    var haut = bon ? [6, 9, 8, 13, 15, 19] : [19, 15, 16, 11, 8, 5];
    var courbe = haut.map(function (h, i) { return self.P(ex0 + 0.1 + i * 0.18, ey, ez + 2 + h); });
    el("polyline", { points: pts(courbe), fill: "none", stroke: coul, "stroke-width": 2, "stroke-linejoin": "round" }, bg);
    this.boite(bg, B.x + 0.9, B.y + 0.6, 0.8, 0.2, 1.5, c3("#d9dfe7"), 30);
    this.boite(bg, B.x + 2.1, B.y + 0.55, 0.16, 0.16, 6, c3("#ffffff"), 30);
    this.boite(bg, B.x + 0.2, B.y + 0.5, 0.45, 0.35, 3, c3("#f4f6f9"), 30);
    this.etiquette(bg, B.x + B.w / 2, B.y + B.d / 2, 76, "Bilan " + (bon ? "+" : "−") + Math.abs(Math.round(resultat)).toLocaleString("fr-FR") + " €", bon ? "var(--bon)" : "var(--danger)");
    this.cliquable(bg, "Bureau du gérant : bilan du mois", { piece: "bureau", onglet: "bilan" });

    // Chaises visiteurs
    [2.4, 3.6].forEach(function (x) {
      var cg = self.objet(x, 3.1, x + 0.55, 3.6);
      self.boite(cg, x + 0.05, 3.15, 0.08, 0.08, 14, c3("#5b6578"));
      self.boite(cg, x + 0.42, 3.15, 0.08, 0.08, 14, c3("#5b6578"));
      self.boite(cg, x, 3.1, 0.55, 0.5, 4, c3("#2457ff"), 14);
      self.boite(cg, x, 3.5, 0.55, 0.1, 18, c3("#1a43d6"), 18);
    });

    // Classeur : le journal de la boutique
    var K = { x: 6.1, y: 2.6, w: 0.7, d: 0.8, h: 48 }, kg = this.objet(K.x, K.y, K.x + K.w, K.y + K.d);
    this.boite(kg, K.x, K.y, K.w, K.d, K.h, c3("#9aa4b1"));
    var vueX = this.vue(K.x - 1, K.y + K.d / 2), cX = this.vue(K.x + K.w / 2, K.y + K.d / 2);
    var faceOuest = (vueX[0] - cX[0]) + (vueX[1] - cX[1]) > 0;
    var fx = faceOuest ? K.x - 0.001 : K.x + K.w + 0.001;
    [6, 20, 34].forEach(function (z) {
      self.poly(kg, [[fx, K.y + 0.08, z], [fx, K.y + K.d - 0.08, z], [fx, K.y + K.d - 0.08, z + 12], [fx, K.y + 0.08, z + 12]], { fill: "#b7c0cc", stroke: "#7a8496", "stroke-width": 1 });
      self.poly(kg, [[fx, K.y + 0.3, z + 8], [fx, K.y + 0.5, z + 8], [fx, K.y + 0.5, z + 9.5], [fx, K.y + 0.3, z + 9.5]], { fill: "#3a4150" });
    });
    this.etiquette(kg, K.x + K.w / 2, K.y + K.d / 2, K.h + 10, "Journal");
    this.cliquable(kg, "Classeur : journal et objectifs", { piece: "bureau", onglet: "journal" });

    // Étagère de classeurs contre le mur est (décor)
    var eg = this.objet(6.35, 0.3, 6.95, 2.1);
    this.boite(eg, 6.35, 0.3, 0.6, 1.8, 70, c3("#8a6240"));
    var couleurs = ["#2457ff", "#d6334a", "#12a150", "#f08a24", "#7b4fd6"];
    [10, 34, 58].forEach(function (z, n) {
      for (var i = 0; i < 5; i++) self.boite(eg, 6.4, 0.4 + i * 0.32, 0.4, 0.22, 18, c3(couleurs[(i + n) % 5]), z + 2);
    });

    this.plante(0.3, 0.3);
    this.plante(0.3, 4.1);
  };

  V.murBureau = function (g, cote, a, b) {
    var X = this.dim.x;
    if (cote === "O") {
      this.porte(g, "O", 2.6, 3.8, "MAGASIN", "magasin");
      // Calendrier
      var cal = this.surPlan(g, a, b, [0, 1.3], 92, 40);
      el("rect", { x: 0, y: 0, width: 40, height: 46, rx: 3, fill: "#ffffff", stroke: "#d4dae3" }, cal);
      el("rect", { x: 0, y: 0, width: 40, height: 12, rx: 3, fill: "var(--danger)" }, cal);
      el("text", { x: 20, y: 9, "text-anchor": "middle", "font-size": this.nomMoisCalendrier && this.nomMoisCalendrier.length > 7 ? 5.4 : 6.5, "font-weight": 800, fill: "#fff", class: "svg-texte" }, cal).textContent = this.nomMoisCalendrier || "MARS";
      el("text", { x: 20, y: 36, "text-anchor": "middle", "font-size": 20, "font-weight": 800, fill: "#1f2328", class: "svg-texte num" }, cal).textContent = this.moisCalendrier || 1;
    }
    if (cote === "N") {
      // Tableau de liège : l'équipe et les CV des candidats
      var tb = el("g", {}, g);
      var t = this.surPlan(tb, a, b, [2.0, 0], 90, 100);
      el("rect", { x: 0, y: 0, width: 100, height: 64, rx: 4, fill: "#c99a5e", stroke: "#8a6240", "stroke-width": 3 }, t);
      el("text", { x: 50, y: 12, "text-anchor": "middle", "font-size": 7.5, "font-weight": 800, fill: "#5a3d22", "letter-spacing": 1.5, class: "svg-texte" }, t).textContent = "ÉQUIPE";
      var eq = this.equipeTableau || { candidats: 0, equipe: 0 };
      for (var i = 0; i < Math.min(5, eq.equipe); i++) {
        el("rect", { x: 7 + i * 17, y: 17, width: 14, height: 17, fill: "#ffffff" }, t);
        el("circle", { cx: 14 + i * 17, cy: 23, r: 3.5, fill: "#8f9bb0" }, t);
        el("rect", { x: 9 + i * 17, y: 27.5, width: 10, height: 4, rx: 2, fill: "#8f9bb0" }, t);
      }
      for (var j = 0; j < Math.min(4, eq.candidats); j++) {
        el("rect", { x: 8 + j * 22, y: 38, width: 17, height: 21, fill: "#fbfcfe", transform: "rotate(" + ((j % 2 ? 4 : -3)) + " " + (16 + j * 22) + " 48)" }, t);
        el("rect", { x: 11 + j * 22, y: 43, width: 11, height: 1.6, fill: "#9aa4b1" }, t);
        el("rect", { x: 11 + j * 22, y: 47, width: 9, height: 1.6, fill: "#9aa4b1" }, t);
        el("circle", { cx: 16.5 + j * 22, cy: 39, r: 1.8, fill: "var(--danger)" }, t);
      }
      if (!eq.equipe && !eq.candidats) el("text", { x: 50, y: 40, "text-anchor": "middle", "font-size": 7.5, fill: "#5a3d22", class: "svg-texte" }, t).textContent = "personne pour l'instant";
      var txt = eq.candidats ? eq.candidats + " candidat" + (eq.candidats > 1 ? "s" : "") : "Personnel";
      this.etiquette(tb, 2.0, 0, 104, txt, eq.equipe ? null : "var(--alerte)");
      this.cliquable(tb, "Tableau de l'équipe : personnel et candidats", { piece: "bureau", onglet: "personnel" });
      // Fenêtre
      this.poly(g, [[4.4, 0, 34], [6.0, 0, 34], [6.0, 0, 96], [4.4, 0, 96]], { fill: "var(--vitre)", stroke: "var(--chaperon)", "stroke-width": 3 });
      this.poly(g, [[5.2, 0, 34], [5.24, 0, 34], [5.24, 0, 96], [5.2, 0, 96]], { fill: "var(--chaperon)" });
    }
    if (cote === "E") {
      var diplome = this.surPlan(g, a, b, [X, 3.6], 92, 46);
      el("rect", { x: 0, y: 0, width: 46, height: 34, rx: 2, fill: "#ffffff", stroke: "#c9a86a", "stroke-width": 3 }, diplome);
      el("text", { x: 23, y: 15, "text-anchor": "middle", "font-size": 6.5, "font-weight": 800, fill: "#5b6578", class: "svg-texte" }, diplome).textContent = "INFO SERVICE";
      el("rect", { x: 10, y: 21, width: 26, height: 2, fill: "#c9a86a" }, diplome);
    }
  };

  // ------------------------------------------------------------ Rayons et produits
  V.dessinerRayon = function (s, i) {
    var Sim = TMI.Sim, R = this.rayons[i], r = R.r, pid = s.rayons[i];
    var n = pid ? (s.stock[pid] || 0) : 0, prix = pid ? Sim.prixVente(s, pid) : 0;
    var cle = (pid || "-") + ":" + Math.min(n, 8) + ":" + (n > 0) + ":" + prix + ":" + n;
    if (R.cle === cle) return;
    R.cle = cle;
    var g = R.g; g.innerHTML = "";
    this.poly(g, [[r.x + 0.1, r.y + r.d + 0.15, 0], [r.x + r.w + 0.2, r.y + r.d + 0.15, 0], [r.x + r.w + 0.2, r.y + 0.1, 0], [r.x + 0.1, r.y + 0.1, 0]], { fill: "rgba(20,30,50,.12)" });
    if (!pid) {
      this.boite(g, r.x, r.y, r.w, r.d, 10, { dessus: "#f6f8fb", gauche: "#dfe4eb", droite: "#cfd6df" });
      var c = this.P(r.x + r.w / 2, r.y + r.d / 2, 10);
      el("circle", { cx: c[0], cy: c[1], r: 11, fill: "var(--accent)", opacity: 0.9 }, g);
      el("path", { d: "M" + (c[0] - 5) + " " + c[1] + "h10M" + c[0] + " " + (c[1] - 5) + "v10", stroke: "#fff", "stroke-width": 2.5, "stroke-linecap": "round" }, g);
      el("title", {}, g).textContent = "Emplacement libre : touche pour choisir un produit";
      return;
    }
    var p = Sim.produit(pid), f = FORMES[p.typeId];
    var fy = this.faceVisible(r);                 // grande face tournée vers la caméra
    var dos = fy === r.y;                         // on voit le dos du meuble
    this.boite(g, r.x, r.y, r.w, 0.18, 50, { dessus: "#ffffff", gauche: "#e3e8ef", droite: "#c9d1dc" });
    this.boite(g, r.x, r.y, r.w, r.d, r.h, { dessus: "#f4f6f9", gauche: "#d9dfe7", droite: "#bcc5d1", trait: "#ffffff" });
    // Bandeau de catégorie + étiquette sur la face visible
    var bande = { ordinateurs: "#2457ff", composants: "#12a150", peripheriques: "#f08a24" }[p.categorie];
    var zf = dos ? 50 : r.h, yf = dos ? r.y - 0.001 : r.y + r.d + 0.001;
    this.poly(g, [[r.x, yf, zf - 6], [r.x + r.w, yf, zf - 6], [r.x + r.w, yf, zf - 1], [r.x, yf, zf - 1]], { fill: bande });
    var lw = r.w * TW / 2 - 6;
    var et = this.surPlan(g, [r.x, yf], [r.x + r.w, yf], [r.x + r.w / 2, yf], zf - 7, lw);
    el("rect", { x: 0, y: 1.5, width: lw, height: 18, rx: 2, fill: n > 0 ? "#ffffff" : "var(--rayon-vide)" }, et);
    el("text", { x: 3, y: 9.5, "font-size": 7.6, "font-weight": 800, fill: n > 0 ? "#151b2b" : "var(--danger)", class: "svg-texte" }, et).textContent = (p.court || COURT[p.typeId]).toUpperCase();
    el("text", { x: 3, y: 17.5, "font-size": 7.2, "font-weight": 600, fill: "#5b6578", class: "svg-texte num" }, et).textContent = COURT[p.typeId].toLowerCase() + " · " + prix + " €";
    // Produits posés (un par unité, jusqu'à 8)
    var nb = Math.min(n, 8);
    for (var k = 0; k < nb; k++) {
      var px = r.x + 0.12 + (k % 4) * (r.w - 0.24) / 4, py = r.y + 0.28 + Math.floor(k / 4) * 0.26;
      this.produitIso(g, f, px, py, r.h);
    }
    if (n === 0) {
      var cv = this.P(r.x + r.w / 2, r.y + r.d / 2, r.h + 26);
      el("circle", { cx: cv[0], cy: cv[1], r: 10, fill: "var(--danger)", stroke: "#fff", "stroke-width": 2 }, g);
      el("text", { x: cv[0], y: cv[1] + 4.5, "text-anchor": "middle", "font-size": 13, "font-weight": 800, fill: "#fff", class: "svg-texte" }, g).textContent = "!";
    }
    // Pastille de quantité (coin le plus proche de la caméra)
    var coins = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]], self = this;
    var proche = coins.sort(function (a, b) { return self.profondeur(b[0], b[1]) - self.profondeur(a[0], a[1]); })[0];
    var q = this.P(proche[0], proche[1], r.h + 4);
    el("circle", { cx: q[0], cy: q[1] - 6, r: 9, fill: n === 0 ? "var(--danger)" : n <= 2 ? "#d29922" : "#1f2a44", stroke: "#fff", "stroke-width": 1.5 }, g);
    el("text", { x: q[0], y: q[1] - 2.5, "text-anchor": "middle", "font-size": 9.5, "font-weight": 800, fill: "#fff", class: "svg-texte num" }, g).textContent = n > 99 ? "99+" : n;
  };

  V.produitIso = function (g, f, x, y, z) {
    if (f.type === "portable") {
      this.boite(g, x, y, 0.36, 0.22, 2, c3(f.c), z);
      this.poly(g, [[x, y, z + 2], [x + 0.36, y, z + 2], [x + 0.36, y, z + 15], [x, y, z + 15]], { fill: teintes(f.c, -0.3) });
      this.poly(g, [[x + 0.04, y, z + 4], [x + 0.32, y, z + 4], [x + 0.32, y, z + 13], [x + 0.04, y, z + 13]], { fill: f.led ? "#3b1a3a" : "#6fb7ff", opacity: 0.85 });
    } else if (f.type === "tour") {
      this.boite(g, x + 0.06, y, 0.2, 0.24, 20, c3(f.c), z);
    } else if (f.type === "ecran") {
      this.boite(g, x + 0.12, y + 0.08, 0.12, 0.1, 5, c3("#555b66"), z);
      this.poly(g, [[x, y + 0.14, z + 5], [x + 0.38, y + 0.14, z + 5], [x + 0.38, y + 0.14, z + 21], [x, y + 0.14, z + 21]], { fill: f.c });
      this.poly(g, [[x + 0.03, y + 0.14, z + 7], [x + 0.35, y + 0.14, z + 7], [x + 0.35, y + 0.14, z + 19], [x + 0.03, y + 0.14, z + 19]], { fill: "#4aa3ff", opacity: 0.8 });
    } else {
      this.boite(g, x, y, 0.3, 0.2, f.hh || 6, c3(f.c), z);
    }
  };

  // ------------------------------------------------------------ Personnages
  // Même apparence que dans la vue 3D (TMI.apparence, apparence.js), dessinée de face, pieds à l'origine.
  function silhouette(parent, A) {
    var f = el("g", { transform: "scale(" + (A.carrure * (A.enfant ? 0.82 : 1)).toFixed(3) + "," + A.taille.toFixed(3) + ")" }, parent);
    var cheveux = A.cheveux, style = A.coiffure;
    // derrière la tête et le dos : cheveux longs, afro, queue, chignon, sac à dos, capuche
    if (style === "long") el("path", { d: "M-7.4 -41 h14.8 v8 a2 2 0 0 1 -2 2 h-10.8 a2 2 0 0 1 -2 -2 z", fill: cheveux }, f);
    if (style === "afro") el("circle", { cx: 0, cy: -42, r: 9.3, fill: cheveux }, f);
    if (style === "queue") el("ellipse", { cx: 7.2, cy: -37.5, rx: 2.2, ry: 4.2, fill: cheveux }, f);
    if (style === "chignon") el("circle", { cx: 0, cy: -47.2, r: 3.2, fill: cheveux }, f);
    if (A.sacADos) el("rect", { x: -10.5, y: -33, width: 9, height: 14, rx: 3, fill: A.sacADos, stroke: "rgba(0,0,0,.18)", "stroke-width": 0.6 }, f);
    if (A.capuche) el("ellipse", { cx: 0, cy: -33.5, rx: 7.5, ry: 3.2, fill: teintes(A.haut, -0.2) }, f);
    // jambes, jupe, chaussures
    if (A.jupe) {
      [-4.5, 1.5].forEach(function (x) { el("rect", { x: x, y: -10, width: 3, height: 9.5, rx: 1.5, fill: A.peau }, f); });
      el("path", { d: "M-6.8 -17 h13.6 l2.4 9 h-18.4 z", fill: A.jupe }, f);
    } else [-5, 1].forEach(function (x) { el("rect", { x: x, y: -16, width: 4, height: 15.5, rx: 2, fill: A.bas }, f); });
    [-3.4, 3.4].forEach(function (x) { el("ellipse", { cx: x, cy: -0.9, rx: 2.9, ry: 1.6, fill: A.chaussures, stroke: "rgba(0,0,0,.25)", "stroke-width": 0.5 }, f); });
    // bras (manches courtes pour les t-shirts) et mains
    [-10, 6].forEach(function (x) {
      el("rect", { x: x, y: -31, width: 4, height: 14, rx: 2, fill: A.manchesLongues ? A.haut : A.peau }, f);
      if (!A.manchesLongues) el("rect", { x: x, y: -31, width: 4, height: 5.5, rx: 2, fill: A.haut }, f);
      el("circle", { cx: x + 2, cy: -16.6, r: 2.1, fill: A.peau }, f);
    });
    // buste
    el("rect", { x: -7.5, y: -33, width: 15, height: 19, rx: 6, fill: A.haut, stroke: A.haut === "#ffffff" ? "#d5dbe4" : "none", "stroke-width": 0.6 }, f);
    el("rect", { x: -7.5, y: -33, width: 4, height: 19, rx: 2, fill: "#ffffff", opacity: 0.18 }, f);
    el("rect", { x: 3.5, y: -33, width: 4, height: 19, rx: 2, fill: "#000000", opacity: 0.08 }, f);
    if (A.veste) {   // chemise claire et cravate sous la veste
      el("path", { d: "M-2.8 -33 h5.6 l-2.8 8.5 z", fill: "#f4f6f9" }, f);
      if (A.cravate) el("path", { d: "M-0.9 -31.8 h1.8 l0.5 7 l-1.4 1.6 l-1.4 -1.6 z", fill: A.cravate }, f);
    }
    if (A.poste === "technicien") el("rect", { x: -6, y: -24.5, width: 12, height: 11, rx: 2, fill: "#3a4150" }, f);
    if (A.poste === "magasinier") el("rect", { x: -7.5, y: -30, width: 15, height: 12, rx: 3, fill: "#ff9f1a", opacity: 0.9 }, f);
    if (A.badge) { el("rect", { x: 1.5, y: -29, width: 4, height: 5, rx: 1, fill: "#ffffff" }, f); el("rect", { x: 2.1, y: -28.2, width: 2.8, height: 1, fill: A.haut }, f); }
    // ce que la personne porte à la main
    if (A.mallette) { el("rect", { x: 6.5, y: -15.5, width: 8, height: 6, rx: 1, fill: "#4a3424" }, f); el("rect", { x: 9.3, y: -16.6, width: 2.4, height: 1.2, rx: 0.5, fill: "#2c2f36" }, f); }
    if (A.sacCourses) { el("rect", { x: 6.5, y: -16, width: 7, height: 8, rx: 1, fill: A.sacCourses, stroke: "#c3cad6", "stroke-width": 0.5 }, f); el("rect", { x: 6.5, y: -13.8, width: 7, height: 1.6, fill: "#d6334a" }, f); }
    // tête et visage
    el("rect", { x: -1.8, y: -35, width: 3.6, height: 3, fill: teintes(A.peau, -0.08) }, f);
    el("circle", { cx: 0, cy: -40, r: 6.5, fill: A.peau }, f);
    [-2.3, 2.3].forEach(function (x) { el("circle", { cx: x, cy: -40, r: 0.85, fill: "#1f2328" }, f); });
    el("path", { d: "M-1.3 -36.8 q1.3 0.9 2.6 0", fill: "none", stroke: "#a5524a", "stroke-width": 0.7, "stroke-linecap": "round" }, f);
    // coiffure
    var frange = "M-6.8 -40 a6.8 6.8 0 0 1 13.6 0 q-3 -3 -6.8 -2.5 q-4 0.5 -6.8 2.5 z";
    if (style === "court" || style === "long" || style === "queue" || style === "chignon") el("path", { d: frange, fill: cheveux }, f);
    if (style === "rase") el("path", { d: "M-6.6 -40.5 a6.6 6.6 0 0 1 13.2 0 q-6.6 -2.6 -13.2 0 z", fill: teintes(A.peau, -0.18) }, f);
    if (style === "boucles" || style === "afro") {
      var n = style === "afro" ? 9 : 7, rr = style === "afro" ? 7.2 : 6.3, rb = style === "afro" ? 2.8 : 2.2;
      el("path", { d: frange, fill: cheveux }, f);
      for (var k = 0; k < n; k++) { var a = Math.PI + k / (n - 1) * Math.PI; el("circle", { cx: (Math.cos(a) * rr).toFixed(2), cy: (-40 + Math.sin(a) * rr).toFixed(2), r: rb, fill: cheveux }, f); }
    }
    if (style === "casquette") {
      el("path", { d: "M-6.9 -40.3 a6.9 6.9 0 0 1 13.8 0 z", fill: A.couvreChef }, f);
      el("path", { d: "M-1 -41.6 h8.6 q1.6 0 1.1 1.3 h-9.7 z", fill: teintes(A.couvreChef, -0.2) }, f);
    }
    if (style === "bonnet") {
      el("path", { d: "M-6.9 -40.5 a6.9 8.5 0 0 1 13.8 0 z", fill: A.couvreChef }, f);
      el("rect", { x: -7.2, y: -42, width: 14.4, height: 2.6, rx: 1.3, fill: teintes(A.couvreChef, -0.15) }, f);
      el("circle", { cx: 0, cy: -49.4, r: 1.7, fill: teintes(A.couvreChef, 0.3) }, f);
    }
    if (A.barbe) el("path", { d: "M-6.2 -39.5 q0 7 6.2 7 q6.2 0 6.2 -7 q-1.5 2.4 -3 2.3 q-3.2 -1.3 -6.4 0 q-1.5 0.1 -3 -2.3 z", fill: cheveux }, f);
    if (A.lunettes) {
      [-2.3, 2.3].forEach(function (x) { el("circle", { cx: x, cy: -40, r: 1.9, fill: "none", stroke: A.lunettes, "stroke-width": 0.7 }, f); });
      el("path", { d: "M-0.4 -40.2 h0.8", stroke: A.lunettes, "stroke-width": 0.6 }, f);
    }
    if (A.casque) {
      el("path", { d: "M-7 -40 a7 7.6 0 0 1 14 0", fill: "none", stroke: "#1f2328", "stroke-width": 1.6 }, f);
      [-8.6, 6].forEach(function (x) {
        el("rect", { x: x, y: -42.4, width: 2.6, height: 4.8, rx: 1.2, fill: "#1f2328" }, f);
        el("rect", { x: x + (x < 0 ? 0 : 1.8), y: -41.4, width: 0.8, height: 2.8, rx: 0.4, fill: "#ff3d7f" }, f);
      });
    }
    return f;
  }
  // desc = { id, profil } pour un client, { id, poste } pour un employé
  function personnage(parent, desc) {
    var A = TMI.apparence(desc), employe = !!desc.poste;
    var g = el("g", { class: employe ? "employe" : "client" }, parent);
    var corps = el("g", { class: "corps" }, g);
    el("ellipse", { cx: 0, cy: 0, rx: 10, ry: 4.5, fill: "rgba(20,30,50,.22)" }, corps);
    corps._impatience = el("ellipse", { cx: 0, cy: 0, rx: 13, ry: 6, fill: "none", stroke: "var(--danger)", "stroke-width": 2.5, opacity: 0 }, corps);
    if (A.avecEnfant) {   // les familles viennent parfois avec un enfant, un peu en retrait
      var ge = el("g", { transform: "translate(-11,-2)" }, corps);
      el("ellipse", { cx: 0, cy: 0, rx: 6.5, ry: 3, fill: "rgba(20,30,50,.2)" }, ge);
      silhouette(ge, TMI.apparence({ id: desc.id + "-enfant", enfant: true }));
    }
    silhouette(corps, A);
    g._corps = corps;
    g._bulle = el("g", { transform: "translate(10," + (-46.5 * A.taille - 9).toFixed(1) + ")" }, g);
    el("path", { d: "M-10 -10 h20 a3 3 0 0 1 3 3 v10 a3 3 0 0 1 -3 3 h-12 l-4 4 v-4 h-4 a3 3 0 0 1 -3 -3 v-10 a3 3 0 0 1 3 -3 z", fill: "#ffffff", stroke: "#c3cad6" }, g._bulle);
    g._bulleTxt = el("text", { x: 0, y: 2, "text-anchor": "middle", "font-size": 11, "font-weight": 800, fill: "#1f2328", class: "svg-texte" }, g._bulle);
    g._bulle.style.display = "none";
    return g;
  }
  V.placer = function (g, x, y) {
    var p = this.P(x, y, 0);
    g.setAttribute("transform", "translate(" + p[0].toFixed(1) + "," + p[1].toFixed(1) + ")");
    g._emprise = [x - 0.12, y - 0.12, x + 0.12, y + 0.12];
    g._pos = { x: x, y: y };
  };
  V.nouveauPerso = function (desc, titre) {
    var g = personnage(this.calque, desc);
    el("title", {}, g).textContent = titre;
    if (!this.fraichementConstruit) {   // arrive par la porte
      this.placer(g, ENTREE.x, ENTREE.y);
      g.getBoundingClientRect();
    } else g.classList.add("sans-transition");
    this.objets.push(g);
    return g;
  };

  V.positionClient = function (cl, rangFile) {
    var h = hache(cl.id);
    if (cl.etat === "file") return { x: 11.3 + DXC - rangFile * 0.75, y: 8.55 + DYC + (rangFile % 2) * 0.12 };
    if (cl.etat === "caisse") return { x: 11.9 + DXC, y: 7.95 + DYC };
    var r = RAYONS[cl.rayon] || RAYONS[0];
    return { x: r.x + 0.3 + (h % 4) * 0.45, y: r.y + r.d + 0.55 + ((h >> 3) % 2) * 0.35 };
  };

  V.maj = function (s) {
    var self = this, data = root.TMI_DATA, vus = {}, t = s.jour * 1440 + s.minuteJour;
    this.dernierEtat = s;
    this.fraichementConstruit = !this.dejaMaj;
    this.dejaMaj = true;
    var nom = "INFORMATIQUE · " + TMI.Sim.ville(s).nom.toUpperCase();
    var cleDeco = "";
    if (root.TMI_DATA.deco) { var dcs = TMI.Sim.deco(s); cleDeco = dcs.sol + dcs.murs + dcs.objets.map(function (o) { return o.id + o.x + "," + o.y + o.rot + (o.mur || ""); }).join(); }
    var taille = s.local + ":" + s.rayons.length;
    if (this.taille !== taille) {   // déménagement : nouveau plan de la salle de vente
      this.taille = taille; appliquerPlan(s.local, s.rayons.length);
      if (this.piece === "magasin") { this.dim = PIECES.magasin; this.centre = null; this.zoom = 1; }
      this.nomVille = null;
    }
    if (this.nomVille !== nom || this.cleDeco !== cleDeco) { this.nomVille = nom; this.cleDeco = cleDeco; this.construire(); this.fraichementConstruit = true; this.sigPiece = null; }
    if (this.aiguilleH) {
      this.aiguilleH.setAttribute("transform", "rotate(" + (((s.minuteJour / 60) % 12) * 30) + ")");
      this.aiguilleM.setAttribute("transform", "rotate(" + ((s.minuteJour % 60) * 6) + ")");
    }
    if (this.piece !== "magasin") {
      // Réserve et bureau : on redessine la pièce seulement quand ce qu'elle montre change
      var sig = this.signature(s);
      if (sig !== this.sigPiece && !this.appuye) { this.sigPiece = sig; this.construire(); }
      return;
    }
    for (var i = 0; i < this.rayons.length; i++) this.dessinerRayon(s, i);
    if (this.texteAtelier && s.atelier) {
      var nbT = s.atelier.travaux.length, aTech = s.employes.some(function (e) { return e.poste === "technicien"; });
      var txt = !aTech ? "cherche technicien" : nbT ? nbT + " en file" : "montage · réparation";
      if (this.texteAtelier.textContent !== txt) this.texteAtelier.textContent = txt;
      var actif = s.employes.some(function (e) { return e.tache && e.tache.type === "montage"; });
      this.pcAtelier.style.display = actif ? "" : "none";
    }

    s.clients.forEach(function (cl) {
      vus[cl.id] = true;
      var g = self.clients[cl.id];
      if (!g) g = self.clients[cl.id] = self.nouveauPerso({ id: cl.id, profil: cl.profil }, data.profilsClients[cl.profil].nom);
      var rang = s.file.indexOf(cl.id);
      var pos = self.positionClient(cl, rang < 0 ? 0 : rang);
      self.placer(g, pos.x, pos.y);
      var attente = (cl.etat === "attend_conseil" || cl.etat === "file") ? (t - cl.depuis) / cl.patience : 0;
      g._corps._impatience.setAttribute("opacity", attente > 0.55 ? Math.min(1, (attente - 0.4) * 1.6) : 0);
      var bulle = cl.etat === "attend_conseil" ? "?" : cl.etat === "file" || cl.etat === "caisse" ? "€" : cl.etat === "conseil" ? "…" : "";
      g._bulle.style.display = bulle ? "" : "none";
      g._bulleTxt.textContent = bulle;
      g._bulleTxt.style.fill = attente > 0.7 ? "var(--danger)" : "#1f2328";
    });
    Object.keys(this.clients).forEach(function (id) {
      if (vus[id]) return;
      var g = self.clients[id];
      delete self.clients[id];
      self.placer(g, ENTREE.x, ENTREE.y + 0.6);
      g.classList.add("sort");
      g._bulle.style.display = "none";
      setTimeout(function () { g.remove(); var k = self.objets.indexOf(g); if (k >= 0) self.objets.splice(k, 1); }, 800);
    });

    var ve = {}, parPoste = {};
    s.employes.forEach(function (e) {
      ve[e.id] = true;
      parPoste[e.poste] = (parPoste[e.poste] || 0) + 1;
      var rangPoste = parPoste[e.poste] - 1;
      var g = self.employes[e.id];
      if (!g) g = self.employes[e.id] = self.nouveauPerso({ id: e.id, poste: e.poste }, e.nom + " — " + data.config.postes[e.poste].nom);
      var x, y;
      g._bulle.style.display = "none";
      if (e.poste === "technicien") {
        var travaille = e.tache && e.tache.type === "montage";
        x = (travaille ? [12.35, 11.55, 13.1][rangPoste % 3] : 11.6 + (rangPoste % 3) * 0.6) + DX; y = travaille ? 1.75 : 3.3;
        if (travaille) { g._bulle.style.display = ""; g._bulleTxt.textContent = "PC"; g._bulleTxt.style.fill = "#ff7a1a"; }
      } else if (e.tache && e.tache.type === "conseil" && self.clients[e.tache.clientId] && self.clients[e.tache.clientId]._pos) {
        var cp = self.clients[e.tache.clientId]._pos; x = cp.x + 0.55; y = cp.y - 0.1;
      } else if (e.tache && e.tache.type === "caisse") {
        x = (e.poste === "caissier" ? 11.9 : 12.9) + DXC; y = 6.15 + DYC;
      } else if (e.poste === "caissier") {
        x = 11.6 + DXC + rangPoste * 0.8; y = 6.1 + DYC;
      } else {
        x = 3.4 + rangPoste * 0.8; y = 7.7 + DYT;
      }
      self.placer(g, x, y);
    });
    Object.keys(this.employes).forEach(function (id) {
      if (ve[id]) return;
      var g = self.employes[id]; delete self.employes[id];
      self.placer(g, ENTREE.x, ENTREE.y + 0.6);
      g.classList.add("sort");
      setTimeout(function () { g.remove(); var k = self.objets.indexOf(g); if (k >= 0) self.objets.splice(k, 1); }, 800);
    });

    if (this.fraichementConstruit) {
      // après une rotation : on réactive les déplacements animés au rendu suivant
      setTimeout(function () { self.calque.querySelectorAll(".sans-transition").forEach(function (n) { n.classList.remove("sans-transition"); }); }, 50);
    }
    this.reordonner();
  };
  V.reordonner = function () {
    var self = this, ordre = this.ordonner();
    var enfants = this.calque.childNodes, change = false;
    for (var j = 0; j < ordre.length; j++) if (enfants[j] !== ordre[j]) { change = true; break; }
    if (change) ordre.forEach(function (n) { self.calque.appendChild(n); });
  };
  V.signature = function (s) {
    if (this.piece === "reserve") {
      var r = [];
      Object.keys(s.stock).forEach(function (pid) { if (s.stock[pid] > 0) r.push(pid + s.stock[pid]); });
      return r.join() + "|" + s.commandes.length + "|" + this.rot;
    }
    var res = resultatProvisoire(s);
    return [Math.round(res / 10), s.candidats.length, s.employes.length, s.jour, this.rot].join("|");
  };
  V.changerPiece = function (nom) {
    if (!PIECES[nom] || nom === this.piece) return;
    this.piece = nom; this.dim = PIECES[nom];
    this.zoom = 1; this.centre = null; this.sigPiece = null;
    this.construireEtMaj();
  };

  // Tri d'affichage : un objet est dessiné avant ceux qui sont devant lui (emprises au sol, repère caméra)
  V.ordonner = function () {
    var self = this, n = this.objets.length, info = this.objets.map(function (g) {
      var e = g._emprise, a = self.vue(e[0], e[1]), b = self.vue(e[2], e[3]);
      var r = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) };
      r.c = (r.x0 + r.x1 + r.y0 + r.y1) / 2;
      return r;
    });
    function derriere(A, B) {
      if (A.x1 <= B.x0 + 1e-6) return true;
      if (B.x1 <= A.x0 + 1e-6) return false;
      if (A.y1 <= B.y0 + 1e-6) return true;
      if (B.y1 <= A.y0 + 1e-6) return false;
      return A.c < B.c;
    }
    var avant = [], degre = [];
    for (var i = 0; i < n; i++) { avant.push([]); degre.push(0); }
    for (i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
      if (derriere(info[i], info[j])) { avant[i].push(j); degre[j]++; } else { avant[j].push(i); degre[i]++; }
    }
    var prets = [], ordre = [];
    for (i = 0; i < n; i++) if (!degre[i]) prets.push(i);
    while (ordre.length < n) {
      if (!prets.length) {   // cycle improbable : on prend le plus au fond
        var reste = []; for (i = 0; i < n; i++) if (degre[i] >= 0 && ordre.indexOf(this.objets[i]) < 0) reste.push(i);
        reste.sort(function (a, b) { return info[a].c - info[b].c; });
        prets.push(reste[0]); degre[reste[0]] = 0;
      }
      prets.sort(function (a, b) { return info[a].c - info[b].c; });
      var k = prets.shift();
      if (degre[k] < 0) continue;
      degre[k] = -1;
      ordre.push(this.objets[k]);
      avant[k].forEach(function (m) { if (degre[m] > 0 && --degre[m] === 0) prets.push(m); });
    }
    return ordre;
  };

  V.construireEtMaj = function () { this.sigPiece = null; this.construire(); this.dejaMaj = false; if (this.dernierEtat) this.maj(this.dernierEtat); };
  V.tourner = function (sens) {
    this.rot = (this.rot + (sens > 0 ? 1 : 3)) % 4;
    this.centre = null;
    this.construireEtMaj();
  };
  V.vider = function () { this.dernierEtat = null; this.nomVille = null; this.taille = null; this.dejaMaj = false; this.construire(); };

  TMI.VueMagasin = VueMagasin;
  TMI.Libelles = { court: COURT, gamme: GAMME };
  // Plan de la salle de vente, partagé avec la vue 3D (src/ui/vue-3d.js)
  TMI.PlanMagasin = function (taille, emplacements) { return TMI.Sim.plan(taille, emplacements); };
  TMI.FormesProduits = FORMES;
})(window);
