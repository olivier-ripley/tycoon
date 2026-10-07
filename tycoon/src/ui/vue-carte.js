// Carte de France : les villes jouables et le logo de ta boutique.
(function (root) {
  "use strict";
  var TMI = root.TMI = root.TMI || {};
  var NS = "http://www.w3.org/2000/svg";

  // Côté de l'étiquette quand la ville par défaut (à droite) chevaucherait une voisine.
  var COTE = { paris: "dessous", cergy: "gauche", versailles: "gauche", angers: "dessus", toulouse: "gauche", nantes: "dessous", vannes: "gauche", laval: "dessus", rennes: "gauche", chambery: "dessous", clermont: "dessous", ajaccio: "gauche", albi: "droite", limoges: "gauche", tours: "dessous", lyon: "gauche", brest: "dessous" };
  var RAYON = { paris: 9, grande: 7, moyenne: 5.5, petite: 4.5 };

  function el(nom, attrs, parent) {
    var e = document.createElementNS(NS, nom);
    for (var k in attrs) {
      if (typeof attrs[k] === "string" && attrs[k].indexOf("var(") === 0) e.style.setProperty(k, attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function projeter(v) {
    var p = root.TMI_DATA.carte.projection;
    return { x: (v.lon - p.lon0) * p.k * p.echelle, y: (p.lat0 - v.lat) * p.echelle };
  }

  function VueCarte(svg, options) {
    this.svg = svg; this.options = options || {};
    this.villes = {}; this.villeBoutique = null; this.selection = null;
    this.zoom = 1; this.centre = null; this.echelles = [];
    this.brancherZoom();
  }

  // ------------------------------------------------------------ Zoom et déplacement (les logos gardent presque leur taille à l'écran)
  var ZMIN = 1, ZMAX = 5;
  function borne(v, a, b) { return Math.max(a, Math.min(b, v)); }
  VueCarte.prototype.base = function () { var b = root.TMI_DATA.carte.viewBox.split(" ").map(Number); return { x: b[0], y: b[1], w: b[2], h: b[3] }; };
  VueCarte.prototype.echelle = function (g, x, y, s) { this.echelles.push({ g: g, x: x, y: y, s: s || 1 }); };
  VueCarte.prototype.appliquer = function () {
    var b = this.base(), z = this.zoom;
    if (!this.centre) this.centre = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var w = b.w / z, h = b.h / z;
    this.centre.x = borne(this.centre.x, b.x + w / 2, b.x + b.w - w / 2);
    this.centre.y = borne(this.centre.y, b.y + h / 2, b.y + b.h - h / 2);
    this.svg.setAttribute("viewBox", (this.centre.x - w / 2).toFixed(1) + " " + (this.centre.y - h / 2).toFixed(1) + " " + w.toFixed(1) + " " + h.toFixed(1));
    var f = 1 / Math.pow(z, 0.85);
    this.facteurEchelle = f;
    this.echelles.forEach(function (e) { e.g.setAttribute("transform", "translate(" + e.x.toFixed(1) + "," + e.y.toFixed(1) + ") scale(" + (e.s * f).toFixed(3) + ")"); });
    this.lisibilite();
  };
  // Lisibilité selon le zoom : on masque les noms de villes cachés par un logo, et l'étiquette d'un logo trop proche d'un autre
  // Noms des régions : seulement s'ils ne gênent aucun nom de ville ni logo (et pas sur petit écran sans zoom)
  VueCarte.prototype.placerNomsRegions = function () {
    var G = this.nomsRegions; if (!G) return;
    this.largeurNoms = this.svg.clientWidth;
    var petit = this.svg.clientWidth < 520, z = this.zoom;
    G.style.display = (z > 2.6 || (petit && z < 1.6)) ? "none" : "";
    if (G.style.display) return;
    var obstacles = [];
    var self = this;
    Object.keys(this.villes).forEach(function (id) { var v = self.villes[id]; if (v.texte.style.display !== "none") obstacles.push(v.texte.getBoundingClientRect(), v.point.getBoundingClientRect()); });
    (this.marqueurs || []).forEach(function (m) { obstacles.push(m.g.getBoundingClientRect()); });
    Array.prototype.forEach.call(G.children, function (t) {
      t.style.display = "";
      var r = t.getBoundingClientRect();
      var gene = obstacles.some(function (o) { return r.left < o.right && o.left < r.right && r.top < o.bottom && o.top < r.bottom; });
      if (gene) t.style.display = "none";
    });
  };
  VueCarte.prototype.lisibilite = function () {
    var self = this, z = this.zoom, posM = this.posM || [], k = Math.pow(z, 0.85);   // écart à l'écran ≈ écart sur la carte × k
    Object.keys(this.villes).forEach(function (id) {
      if (self.magasinsParVille && self.magasinsParVille[id] != null) return;
      var p = self.villes[id].pos;
      var cache = posM.some(function (q) { return Math.abs(q.x - p.x) * k < 34 && (q.y - p.y) * k > -14 && (q.y - p.y) * k < 60; });
      self.villes[id].texte.style.display = cache ? "none" : "";
    });
    (this.marqueurs || []).forEach(function (mq, i) {
      if (mq.actif) return;
      var p = posM[i];
      var gene = posM.some(function (q, j) { return j !== i && (j === self.actifIdx || j < i) && Math.abs(q.x - p.x) * k < 60 && Math.abs(q.y - p.y) * k < 34; });
      mq.etiquetteG.style.display = gene ? "none" : "";
    });
    this.placerNomsRegions();
  };
  VueCarte.prototype.zoomer = function (facteur, px, py) {
    if (!this.centre) this.appliquer();
    var nz = borne(this.zoom * facteur, ZMIN, ZMAX);
    if (px == null) { px = this.centre.x; py = this.centre.y; }
    this.centre.x = px + (this.centre.x - px) * this.zoom / nz;
    this.centre.y = py + (this.centre.y - py) * this.zoom / nz;
    this.zoom = nz;
    this.appliquer();
  };
  VueCarte.prototype.recentrer = function () { this.zoom = 1; this.centre = null; this.appliquer(); };
  VueCarte.prototype.brancherZoom = function () {
    var self = this, svg = this.svg, pts = {}, dep = null, bouge = false;
    svg.style.touchAction = "none";
    function point(cx, cy) {
      var m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
      var p = svg.createSVGPoint(); p.x = cx; p.y = cy; p = p.matrixTransform(m.inverse()); return { x: p.x, y: p.y };
    }
    function geste() {
      var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]];
      return ids.length >= 2 ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), n: 2 } : { x: a.x, y: a.y, d: 0, n: 1 };
    }
    function depart() { dep = geste(); dep.zoom = self.zoom; if (!self.centre) self.appliquer(); dep.centre = { x: self.centre.x, y: self.centre.y }; }
    svg.addEventListener("wheel", function (ev) { ev.preventDefault(); var p = point(ev.clientX, ev.clientY); self.zoomer(Math.exp(-ev.deltaY * 0.0015), p.x, p.y); }, { passive: false });
    svg.addEventListener("pointerdown", function (ev) { pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY }; depart(); if (dep.n === 1) bouge = false; });
    svg.addEventListener("pointermove", function (ev) {
      if (!pts[ev.pointerId]) return;
      pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var g = geste();
      if (g.n !== dep.n) { depart(); return; }
      if (!bouge && g.n === 1 && Math.hypot(g.x - dep.x, g.y - dep.y) < 6) return;
      if (!bouge) { bouge = true; try { svg.setPointerCapture(ev.pointerId); } catch (e) {} }
      if (g.n >= 2 && dep.d > 0) self.zoom = borne(dep.zoom * g.d / dep.d, ZMIN, ZMAX);
      var b = self.base(), r = svg.getBoundingClientRect();
      var echelle = Math.max((b.w / self.zoom) / r.width, (b.h / self.zoom) / r.height);   // unités de carte par pixel
      self.centre.x = dep.centre.x - (g.x - dep.x) * echelle;
      self.centre.y = dep.centre.y - (g.y - dep.y) * echelle;
      self.appliquer();
    });
    function fin(ev) { delete pts[ev.pointerId]; if (Object.keys(pts).length) depart(); }
    svg.addEventListener("pointerup", fin);
    svg.addEventListener("pointercancel", fin);
    svg.addEventListener("click", function (ev) { if (bouge) { ev.stopPropagation(); ev.preventDefault(); bouge = false; } }, true);
  };


  // ------------------------------------------------------------ Décor de la carte illustrée
  var COULEURS_REGIONS = { bretagne: "#f3d2c4", normandie: "#d8eac4", hdf: "#f4e3ac", idf: "#f8cfa6", grandest: "#d9e4f2", pdl: "#cfe6d3",
    cvl: "#f6e6bd", bfc: "#f1d2d8", naq: "#e2ecc6", occitanie: "#f7d7b6", ara: "#e4d8f0", paca: "#f4e6a6", corse: "#d4e9c9" };
  var MONTAGNES = [
    { pts: [[46.25, 6.65], [45.95, 6.95], [45.55, 6.85], [45.15, 6.55], [44.75, 6.75], [44.35, 6.9], [44.1, 7.25]], t: 15, neige: true },
    { pts: [[45.75, 6.35], [45.3, 6.15], [44.9, 6.2]], t: 11, neige: true },
    { pts: [[43.05, -1.15], [42.88, -0.5], [42.78, 0.25], [42.72, 0.95], [42.58, 1.7], [42.48, 2.35]], t: 13, neige: true },
    { pts: [[45.55, 2.75], [45.15, 2.75], [44.85, 3.2], [45.4, 3.55], [44.5, 3.6]], t: 9, rond: true },
    { pts: [[46.6, 6.1], [46.95, 6.45], [47.25, 6.85]], t: 8, rond: true },
    { pts: [[48.45, 7.1], [48.05, 7.0], [47.8, 6.9]], t: 8, rond: true },
    { pts: [[42.35, 9.0], [42.05, 9.1]], t: 9, neige: true }
  ];
  var FORETS = [[44.35, -0.95, 9], [44.0, -1.05, 7], [44.65, -0.75, 6], [47.55, 2.0, 6], [47.15, 4.05, 5], [49.85, 4.7, 6], [48.2, 6.65, 5], [48.0, -2.2, 5], [43.9, 3.1, 4], [48.95, 3.35, 4]];
  var ROUTES = [["paris", "lille"], ["paris", "rouen"], ["rouen", "caen"], ["caen", "cherbourg"], ["paris", "lemans"], ["lemans", "rennes"], ["rennes", "brest"], ["lemans", "angers"], ["angers", "nantes"],
    ["paris", "orleans"], ["orleans", "tours"], ["tours", "poitiers"], ["poitiers", "bordeaux"], ["bordeaux", "toulouse"], ["toulouse", "montpellier"], ["montpellier", "perpignan"],
    ["paris", "reims"], ["reims", "metz"], ["metz", "strasbourg"], ["paris", "auxerre"], ["auxerre", "dijon"], ["dijon", "lyon"], ["lyon", "avignon"], ["avignon", "marseille"], ["marseille", "nice"],
    ["avignon", "montpellier"], ["orleans", "bourges"], ["bourges", "clermont"], ["clermont", "lyon"], ["lyon", "chambery"], ["lille", "arras"], ["arras", "amiens"], ["amiens", "rouen"], ["dijon", "besancon"], ["nantes", "vannes"], ["vannes", "rennes"]];
  var ETIQUETTES_MER = [["Manche", 50.12, -2.3], ["Océan Atlantique", 46.2, -3.9], ["Mer Méditerranée", 42.35, 5.3]];
  var PAYS = [["Royaume-Uni", 51.05, -1.4], ["Belgique", 50.85, 4.95], ["Allemagne", 49.4, 8.7], ["Suisse", 46.85, 7.8], ["Italie", 44.9, 8.6], ["Espagne", 42.1, -1.6]];
  function pt(lat, lon) { return projeter({ lat: lat, lon: lon }); }
  function hasard(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  VueCarte.prototype.fondIllustre = function (svg, vb, d) {
    var defs = el("defs", {}, svg), D = d.carteDeco || {};
    var gm = el("linearGradient", { id: "c-mer", x1: 0, y1: 0, x2: 0.3, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": "#b4def3" }, gm); el("stop", { offset: 1, "stop-color": "#86c3e6" }, gm);
    var pv = el("pattern", { id: "c-vagues", width: 46, height: 26, patternUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M3 9 q4 -4 8 0 t8 0 M26 21 q4 -4 8 0 t8 0", fill: "none", stroke: "#ffffff", "stroke-width": 1.3, "stroke-linecap": "round", opacity: 0.45 }, pv);
    var ombre = el("filter", { id: "c-ombre", x: "-10%", y: "-10%", width: "120%", height: "125%" }, defs);
    el("feDropShadow", { dx: 0, dy: 5, stdDeviation: 5, "flood-color": "#2a4a66", "flood-opacity": 0.28 }, ombre);
    var cp = el("clipPath", { id: "c-france" }, defs);
    el("path", { d: d.carte.france }, cp);
    var colline = el("radialGradient", { id: "c-colline" }, defs);
    el("stop", { offset: 0, "stop-color": "#8a7a55", "stop-opacity": 0.13 }, colline); el("stop", { offset: 1, "stop-color": "#8a7a55", "stop-opacity": 0 }, colline);

    // mer, vagues, voisins
    el("rect", { x: vb[0], y: vb[1], width: vb[2], height: vb[3], fill: "url(#c-mer)" }, svg);
    el("rect", { x: vb[0], y: vb[1], width: vb[2], height: vb[3], fill: "url(#c-vagues)" }, svg);
    el("path", { d: d.carte.voisins, fill: "#eee8d7", stroke: "#d2c7ab", "stroke-width": 1, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, svg);
    PAYS.forEach(function (q) { var p = pt(q[1], q[2]); var t = el("text", { x: p.x, y: p.y, "text-anchor": "middle", class: "c-pays" }, svg); t.textContent = q[0]; });
    ETIQUETTES_MER.forEach(function (q) { var p = pt(q[1], q[2]); var t = el("text", { x: p.x, y: p.y, "text-anchor": "middle", class: "c-mer" }, svg); t.textContent = q[0]; });
    // hauts-fonds le long des côtes
    el("path", { d: d.carte.france, fill: "none", stroke: "#cfeefc", "stroke-width": 16, "stroke-linejoin": "round", opacity: 0.8 }, svg);
    el("path", { d: d.carte.france, fill: "none", stroke: "#e6f7ff", "stroke-width": 7, "stroke-linejoin": "round" }, svg);
    // terre : régions en couleurs douces, avec une ombre portée
    var terre = el("g", { filter: "url(#c-ombre)" }, svg);
    el("path", { d: d.carte.france, fill: "#f2ecd9" }, terre);
    var regions = el("g", { "clip-path": "url(#c-france)" }, svg);
    this.regionsSvg = {};
    var self = this;
    Object.keys(D.regions || {}).forEach(function (id) {
      self.regionsSvg[id] = el("path", { d: D.regions[id], fill: COULEURS_REGIONS[id] || "#eee", stroke: "#ffffff", "stroke-width": 1.6, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke", class: "c-region" }, regions);
    });
    // collines (ombrage doux) sous les reliefs
    MONTAGNES.forEach(function (m) { m.pts.forEach(function (q) { var p = pt(q[0], q[1]); el("ellipse", { cx: p.x, cy: p.y + 4, rx: m.t * 2.2, ry: m.t * 1.4, fill: "url(#c-colline)" }, regions); }); });
    // fleuves
    var fl = el("g", { "clip-path": "url(#c-france)", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    (D.fleuves || []).forEach(function (f) { el("path", { d: f.d, stroke: "#7cc0e6", "stroke-width": f.w, "vector-effect": "non-scaling-stroke" }, fl); });
    el("path", { d: d.carte.france, fill: "none", stroke: "#9c8f70", "stroke-width": 1.4, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke", opacity: 0.7 }, svg);
    // noms des régions
    this.nomsRegions = el("g", { class: "c-noms-regions" }, svg);
    Object.keys(this.regionsSvg).forEach(function (id) {
      var b = self.regionsSvg[id].getBBox(); if (!b.width) return;
      var cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      var decal = { naq: [10, 30], occitanie: [-20, 10], ara: [10, 18], paca: [10, 0], grandest: [10, 10], hdf: [0, 6], bretagne: [12, 4], pdl: [6, 14], idf: [0, 22], cvl: [0, -10] }[id] || [0, 0];
      var t = el("text", { x: cx + decal[0], y: cy + decal[1], "text-anchor": "middle", class: "c-region-nom" }, self.nomsRegions);
      t.textContent = id === "corse" ? "" : d.regions[id].toUpperCase();
    });
    // forêts
    var arbres = el("g", { class: "c-arbres" }, svg);
    FORETS.forEach(function (f, i) {
      var c = pt(f[0], f[1]);
      for (var k = 0; k < f[2]; k++) {
        var a = hasard(i * 31 + k) * Math.PI * 2, r = 4 + hasard(i * 17 + k * 3) * 12;
        var x = c.x + Math.cos(a) * r * 1.3, y = c.y + Math.sin(a) * r * 0.8, h = 0.85 + hasard(k + i) * 0.4;
        var g = el("g", { transform: "translate(" + x.toFixed(1) + "," + y.toFixed(1) + ") scale(" + h.toFixed(2) + ")" }, arbres);
        el("rect", { x: -0.8, y: -1, width: 1.6, height: 3.4, fill: "#7a5a3a" }, g);
        el("path", { d: "M0 -11 L5 -1.5 L-5 -1.5 Z", fill: k % 2 ? "#4f9a5b" : "#3f8a4e" }, g);
        el("path", { d: "M0 -11 L5 -1.5 L0 -1.5 Z", fill: "#2f7440", opacity: 0.35 }, g);
      }
    });
    // montagnes
    var mont = el("g", { class: "c-montagnes" }, svg);
    MONTAGNES.forEach(function (m, mi) {
      m.pts.forEach(function (q, k) {
        var p = pt(q[0], q[1]), t = m.t * (0.85 + hasard(mi * 7 + k) * 0.3), g = el("g", { transform: "translate(" + p.x.toFixed(1) + "," + p.y.toFixed(1) + ")" }, mont);
        if (m.rond) {
          el("path", { d: "M" + (-t) + " 0 Q 0 " + (-t * 1.3) + " " + t + " 0 Z", fill: "#b8c48e" }, g);
          el("path", { d: "M0 " + (-t * 0.65) + " Q " + (t * 0.55) + " " + (-t * 0.5) + " " + t + " 0 L 0 0 Z", fill: "#98a873", opacity: 0.7 }, g);
        } else {
          el("path", { d: "M" + (-t) + " 0 L0 " + (-t * 1.25) + " L" + t + " 0 Z", fill: "#bba98a" }, g);
          el("path", { d: "M0 " + (-t * 1.25) + " L" + t + " 0 L" + (t * 0.15) + " 0 Z", fill: "#9b8869" }, g);
          if (m.neige) el("path", { d: "M0 " + (-t * 1.25) + " L" + (t * 0.36) + " " + (-t * 0.8) + " L" + (t * 0.1) + " " + (-t * 0.86) + " L" + (-t * 0.1) + " " + (-t * 0.74) + " L" + (-t * 0.38) + " " + (-t * 0.8) + " Z", fill: "#ffffff" }, g);
        }
      });
    });
    // grands axes routiers
    var villesParId = {}; d.villes.forEach(function (v) { villesParId[v.id] = v; });
    var routes = el("g", { class: "c-routes", fill: "none", "stroke-linecap": "round" }, svg);
    var traces = [];
    ROUTES.forEach(function (r) {
      var a = villesParId[r[0]], b = villesParId[r[1]]; if (!a || !b) return;
      traces.push(courbe(projeter(a), projeter(b)));
    });
    var dr = traces.join(" ");
    el("path", { d: dr, stroke: "#cdbf9f", "stroke-width": 3.4, "vector-effect": "non-scaling-stroke" }, routes);
    el("path", { d: dr, stroke: "#fffaf0", "stroke-width": 1.8, "vector-effect": "non-scaling-stroke" }, routes);
    // rose des vents
    var rp = pt(42.35, -4.3), rose = el("g", { transform: "translate(" + rp.x + "," + rp.y + ")", class: "c-rose" }, svg);
    el("circle", { r: 22, fill: "none", stroke: "#ffffff", "stroke-width": 1.5, opacity: 0.8 }, rose);
    el("path", { d: "M0 -30 L6 0 L0 30 L-6 0 Z", fill: "#ffffff", opacity: 0.9 }, rose);
    el("path", { d: "M-30 0 L0 -6 L30 0 L0 6 Z", fill: "#ffffff", opacity: 0.6 }, rose);
    el("path", { d: "M0 -30 L6 0 L-6 0 Z", fill: "#d6334a" }, rose);
    var tn = el("text", { y: -34, "text-anchor": "middle", class: "c-rose-n" }, rose); tn.textContent = "N";
  };
  // Petite courbe entre deux points (les routes et les trajets des camions ne sont pas des traits droits)
  function courbe(a, b, sens) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, k = 0.12 * (sens || 1);
    return "M" + a.x.toFixed(1) + " " + a.y.toFixed(1) + " Q" + (mx - dy * k).toFixed(1) + " " + (my + dx * k).toFixed(1) + " " + b.x.toFixed(1) + " " + b.y.toFixed(1);
  }
  function pointCourbe(a, b, t, sens) {
    var k = 0.12 * (sens || 1), cx = (a.x + b.x) / 2 - (b.y - a.y) * k, cy = (a.y + b.y) / 2 + (b.x - a.x) * k, u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
             dx: 2 * u * (cx - a.x) + 2 * t * (b.x - cx), dy: 2 * u * (cy - a.y) + 2 * t * (b.y - cy) };
  }

  // Icônes de villes : maison, petit quartier, tours, et la tour Eiffel pour Paris
  function iconeVille(g, type) {
    var i = el("g", { class: "c-ville-ico" }, g);
    el("ellipse", { cx: 0, cy: 1, rx: type === "petite" ? 7 : 10, ry: 3, class: "socle" }, i);
    if (type === "paris") {
      el("path", { d: "M-7 0 L-2.2 -12 L-1.4 -22 L0 -30 L1.4 -22 L2.2 -12 L7 0 L4 0 L1.6 -6 L-1.6 -6 L-4 0 Z", fill: "#5b4a3a" }, i);
      el("path", { d: "M-3.6 -11.5 H3.6 M-2.2 -21.5 H2.2", stroke: "#5b4a3a", "stroke-width": 1.6 }, i);
      el("rect", { x: 6, y: -9, width: 6, height: 9, rx: 0.8, fill: "#e8edf5", stroke: "#8f9bb0", "stroke-width": 0.8 }, i);
      el("rect", { x: -13, y: -7, width: 6, height: 7, rx: 0.8, fill: "#f4e7d2", stroke: "#b49b7a", "stroke-width": 0.8 }, i);
      return i;
    }
    var blocs = type === "grande" ? [[-8, 7, 13, "#dfe6f1"], [-1.5, 6, 20, "#c9d6ea"], [5, 6, 10, "#eef2f8"]]
      : type === "moyenne" ? [[-7, 7, 10, "#f2e6d4"], [0, 7, 14, "#e3e9f2"]] : null;
    if (blocs) {
      blocs.forEach(function (b) {
        el("rect", { x: b[0], y: -b[2], width: b[1], height: b[2], rx: 0.8, fill: b[3], stroke: "#7d8799", "stroke-width": 0.9 }, i);
        for (var y = -b[2] + 2.5; y < -2; y += 3.5) el("rect", { x: b[0] + 1.6, y: y, width: b[1] - 3.2, height: 1.3, fill: "#9fc3e8" }, i);
      });
    } else {
      el("rect", { x: -5, y: -7, width: 10, height: 7, fill: "#fbf3e4", stroke: "#a98c66", "stroke-width": 0.9 }, i);
      el("path", { d: "M-6.5 -6.5 L0 -12 L6.5 -6.5 Z", fill: "#d9724b", stroke: "#a9543a", "stroke-width": 0.8, "stroke-linejoin": "round" }, i);
      el("rect", { x: -1.4, y: -4, width: 2.8, height: 4, fill: "#a9543a" }, i);
    }
    return i;
  }

  // ------------------------------------------------------------ Camions de livraison
  VueCarte.prototype.camions = function (s) {
    var d = root.TMI_DATA, self = this, villes = {}, G = this.calqueCamions;
    if (!G) return;
    d.villes.forEach(function (v) { villes[v.id] = v; });
    var maintenant = s.jour + s.minuteJour / 1440, trajets = [];
    var GROSSISTE = { lat: 47.95, lon: 1.75 };
    function ajoute(cle, de, vers, depart, arrivee, propre, qte) {
      var t0 = depart != null ? depart + 0.35 : arrivee - 1.6, t1 = arrivee + 0.35;   // départ le matin, livraison au petit matin
      var t = (maintenant - t0) / Math.max(0.2, t1 - t0);
      if (t <= 0 || t >= 1) return;
      trajets.push({ cle: cle, a: projeter(de), b: projeter(vers), t: t, propre: propre, qte: qte });
    }
    // commandes chez le fournisseur → magasins (une tournée par jour de livraison) et → entrepôts
    s.magasins.forEach(function (x, i) {
      var mg = TMI.Sim.magasin(s, i), parJour = {};
      (mg.commandes || []).forEach(function (c) { var k = c.arrivee; parJour[k] = parJour[k] || { depart: c.depart, qte: 0 }; parJour[k].qte += c.qte; if (c.depart != null) parJour[k].depart = Math.min(parJour[k].depart == null ? c.depart : parJour[k].depart, c.depart); });
      Object.keys(parJour).forEach(function (k) { ajoute("f" + i + ":" + k, GROSSISTE, villes[mg.villeId], parJour[k].depart, +k, false, parJour[k].qte); });
    });
    Object.keys(s.entrepots || {}).forEach(function (reg) {
      var e = s.entrepots[reg], parJour = {};
      (e.commandes || []).forEach(function (c) { var k = c.arrivee; parJour[k] = parJour[k] || { depart: c.depart, qte: 0 }; parJour[k].qte += c.qte; });
      Object.keys(parJour).forEach(function (k) { ajoute("e" + reg + ":" + k, GROSSISTE, villes[e.villeId], parJour[k].depart, +k, false, parJour[k].qte); });
    });
    // tes camions : entrepôt → magasin
    var parVers = {};
    (s.transferts || []).forEach(function (x) {
      var k = x.region + ">" + x.vers + ":" + x.arrivee; parVers[k] = parVers[k] || { x: x, qte: 0 }; parVers[k].qte += x.qte;
    });
    Object.keys(parVers).forEach(function (k) {
      var x = parVers[k].x, e = s.entrepots && s.entrepots[x.region], mg = TMI.Sim.magasin(s, x.vers);
      if (e && mg) ajoute("t" + k, villes[e.villeId], villes[mg.villeId], x.depart, x.arrivee, true, parVers[k].qte);
    });
    var vus = {};
    this.camionsSvg = this.camionsSvg || {};
    trajets.forEach(function (tr) {
      vus[tr.cle] = true;
      var c = self.camionsSvg[tr.cle];
      if (!c) {
        c = self.camionsSvg[tr.cle] = { route: el("path", { d: courbe(tr.a, tr.b), class: "c-trajet" + (tr.propre ? " propre" : ""), fill: "none", "vector-effect": "non-scaling-stroke" }, self.calqueTrajets), g: el("g", { class: "c-camion" }, G) };
        var corps = c.corps = el("g", {}, c.g);
        el("ellipse", { cx: 0, cy: 6.5, rx: 11, ry: 2.5, fill: "rgba(0,0,0,.18)" }, corps);
        el("rect", { x: -10, y: -6, width: 13, height: 11, rx: 1.6, fill: tr.propre ? "#2457ff" : "#ffffff", stroke: tr.propre ? "#1a3fc4" : "#8f9bb0", "stroke-width": 1 }, corps);
        if (tr.propre) { el("rect", { x: -7.5, y: -3, width: 8, height: 5, rx: 1, fill: "#ffffff" }, corps); el("rect", { x: -5.5, y: -2, width: 4, height: 3, fill: "#2457ff" }, corps); }
        else el("rect", { x: -10, y: -6, width: 13, height: 3, rx: 1, fill: "#ff7a1a" }, corps);
        el("path", { d: "M3 -3 H7.5 L10 0.5 V5 H3 Z", fill: tr.propre ? "#1a3fc4" : "#3a4150" }, corps);
        el("rect", { x: 5, y: -1.8, width: 2.6, height: 2.2, fill: "#bfe3ff" }, corps);
        el("circle", { cx: -6, cy: 5.3, r: 2, fill: "#1f2328" }, corps); el("circle", { cx: 6, cy: 5.3, r: 2, fill: "#1f2328" }, corps);
        el("title", {}, c.g).textContent = (tr.propre ? "Ton camion : transfert de " : "Livraison du grossiste : ") + tr.qte + " article" + (tr.qte > 1 ? "s" : "");
      }
      var p = pointCourbe(tr.a, tr.b, tr.t), f = self.facteurEchelle || 1;
      c.g.setAttribute("transform", "translate(" + p.x.toFixed(1) + "," + p.y.toFixed(1) + ") scale(" + (f * (p.dx < 0 ? -1 : 1)).toFixed(3) + "," + f.toFixed(3) + ")");
      c.corps.setAttribute("transform", "translate(0," + (Math.sin(Date.now() / 90) * 0.4).toFixed(2) + ")");
    });
    Object.keys(this.camionsSvg).forEach(function (k) {
      if (vus[k]) return;
      var c = self.camionsSvg[k]; c.g.remove(); c.route.remove(); delete self.camionsSvg[k];
    });
  };

  VueCarte.prototype.construire = function (s) {
    var svg = this.svg, d = root.TMI_DATA, self = this;
    svg.innerHTML = "";
    this.echelles = [];
    var vb = d.carte.viewBox.split(" ").map(Number);
    this.fondIllustre(svg, vb, d);
    this.calqueTrajets = el("g", { class: "c-trajets" }, svg);
    this.camionsSvg = {};

    var calqueVilles = el("g", {}, svg);
    d.villes.forEach(function (v) {
      var p = projeter(v), r = RAYON[v.type === "paris" ? "paris" : v.type];
      var g = el("g", { class: "ville-carte", transform: "translate(" + p.x.toFixed(1) + "," + p.y.toFixed(1) + ")", tabindex: 0, role: "button", "aria-label": v.nom }, calqueVilles);
      el("circle", { r: 16, cy: -4, fill: "transparent" }, g); // zone de toucher
      var point = iconeVille(g, v.type);
      var lv = v.type === "paris" ? 14 : v.type === "grande" ? 12 : v.type === "moyenne" ? 9.5 : 7.5;
      var cote = COTE[v.id] || "droite", tx = lv + 3, ty = 0, anchor = "start";
      if (cote === "gauche") { tx = -lv - 3; anchor = "end"; }
      if (cote === "dessous") { tx = 0; ty = 15; anchor = "middle"; }
      if (cote === "dessus") { tx = 0; ty = v.type === "paris" ? -33 : -18; anchor = "middle"; }
      var t = el("text", { x: tx, y: ty, "text-anchor": anchor, class: "nom-ville", "font-size": v.type === "paris" || v.type === "grande" ? 14 : 12.5, "font-weight": v.type === "paris" || v.type === "grande" ? 700 : 500 }, g);
      t.textContent = v.nom;
      g.addEventListener("click", function () { self.choisir(v.id); });
      g.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); self.choisir(v.id); } });
      self.villes[v.id] = { g: g, point: point, texte: t, pos: p };
      self.echelle(g, p.x, p.y, 1);
    });

    this.calqueCamions = el("g", { class: "c-camions" }, svg);
    // Logos des magasins (le magasin affiché est mis en avant)
    this.cle = cleMagasins(s);
    this.marqueurs = [];
    this.magasinsParVille = {};
    s.magasins.forEach(function (x, i) {
      var mg = TMI.Sim.magasin(s, i), v0 = self.villes[mg.villeId], actif = i === s.actif;
      self.magasinsParVille[mg.villeId] = i;
      v0.texte.style.display = "none"; v0.point.style.display = "none";
      var nomV = d.villes.filter(function (v) { return v.id === mg.villeId; })[0].nom;
      var m = el("g", { class: "marqueur-boutique" + (actif ? " actif" : ""), transform: "translate(" + v0.pos.x.toFixed(1) + "," + v0.pos.y.toFixed(1) + ") scale(" + (actif ? 1.3 : 1.05) + ")", tabindex: 0, role: "button", "aria-label": "Ton magasin à " + nomV + " : ouvrir la gestion" }, svg);
      self.echelle(m, v0.pos.x, v0.pos.y, actif ? 1.3 : 1.05);
      var couleur = actif ? "var(--accent)" : "var(--orange)";
      if (actif) el("circle", { class: "onde", r: 14, fill: "none", stroke: couleur, "stroke-width": 3 }, m);
      el("ellipse", { cx: 0, cy: 0, rx: 9, ry: 3.5, fill: "rgba(0,0,0,.25)" }, m);
      var pin = el("g", { transform: "translate(0,-6)" }, m);
      el("path", { d: "M0 0 L-9 -14 A17 17 0 1 1 9 -14 Z", fill: couleur, stroke: "#fff", "stroke-width": 2.5, "stroke-linejoin": "round" }, pin);
      // vitrine : auvent rayé + porte
      var icone = el("g", { transform: "translate(0,-28)" }, pin);
      el("rect", { x: -10, y: -2, width: 20, height: 13, rx: 1.5, fill: "#fff" }, icone);
      el("path", { d: "M-12 -2 L-10 -9 L10 -9 L12 -2 Z", fill: "#fff" }, icone);
      [-8, -2, 4].forEach(function (x) { el("rect", { x: x, y: -8.5, width: 3, height: 6, fill: couleur, opacity: 0.55 }, icone); });
      el("rect", { x: -3, y: 3, width: 6, height: 8, fill: couleur }, icone);
      el("rect", { x: -8, y: 2, width: 4, height: 4, fill: couleur, opacity: 0.45 }, icone);
      el("rect", { x: 4, y: 2, width: 4, height: 4, fill: couleur, opacity: 0.45 }, icone);
      var alerte = el("g", { transform: "translate(13,-48)" }, pin);
      el("circle", { r: 8, fill: "var(--danger)", stroke: "#fff", "stroke-width": 2 }, alerte);
      var ta = el("text", { "text-anchor": "middle", y: 4, "font-size": 11, "font-weight": 800, fill: "#fff" }, alerte); ta.textContent = "!";
      var etiquette = el("g", { transform: "translate(0,22)" }, m);
      var fond = el("rect", { x: -60, y: -12, width: 120, height: 22, rx: 11, fill: "var(--surface)", stroke: couleur, "stroke-width": 1.5 }, etiquette);
      var texte = el("text", { "text-anchor": "middle", y: 4, class: "etiquette-boutique", "font-size": 12.5, "font-weight": 700 }, etiquette);
      var go = function () { if (self.options.surBoutique) self.options.surBoutique(i); };
      m.addEventListener("click", go);
      m.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } });
      self.marqueurs.push({ g: m, alerte: alerte, fond: fond, texte: texte, nom: nomV, actif: actif, etiquetteG: etiquette });
    });
    // Entrepôts régionaux
    Object.keys(s.entrepots || {}).forEach(function (reg) {
      var e = s.entrepots[reg], v0 = self.villes[e.villeId];
      var g = el("g", { class: "marqueur-entrepot", transform: "translate(" + (v0.pos.x - 16).toFixed(1) + "," + (v0.pos.y + 14).toFixed(1) + ")", tabindex: 0, role: "button", "aria-label": "Entrepôt " + d.regions[reg] + " : ouvrir la logistique" }, svg);
      self.echelle(g, v0.pos.x - 16, v0.pos.y + 14, 1);
      el("rect", { x: -11, y: -9, width: 22, height: 18, rx: 4, fill: "var(--enseigne)", stroke: "#fff", "stroke-width": 2 }, g);
      el("path", { d: "M-6 4 V-2 L0 -6 L6 -2 V4 Z", fill: "#f2c230" }, g);
      el("rect", { x: -2, y: 0, width: 4, height: 4, fill: "var(--enseigne)" }, g);
      var go = function () { if (self.options.surEntrepot) self.options.surEntrepot(reg); };
      g.addEventListener("click", go);
      g.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } });
    });
    this.posM = s.magasins.map(function (x, i) { return self.villes[TMI.Sim.magasin(s, i).villeId].pos; });
    this.actifIdx = s.actif;
    this.marqueur = this.marqueurs[s.actif].g;
    this.appliquer();
    this.choisir(null);
  };
  function cleMagasins(s) { return s.actif + ":" + s.magasins.map(function (x, i) { return TMI.Sim.magasin(s, i).villeId; }).join(",") + "|" + Object.keys(s.entrepots || {}).join(","); }

  VueCarte.prototype.choisir = function (villeId) {
    var prec = this.selection && this.villes[this.selection];
    if (prec) prec.g.classList.remove("choisie");
    this.selection = villeId;
    if (villeId) this.villes[villeId].g.classList.add("choisie");
    if (this.options.surVille) this.options.surVille(villeId);
  };

  VueCarte.prototype.maj = function (s) {
    if (this.cle !== cleMagasins(s)) this.construire(s);
    var self = this;
    this.marqueurs.forEach(function (mq, i) {
      var mg = TMI.Sim.magasin(s, i);
      var alerte = !mg.employes.length || !mg.rayons.some(Boolean) || mg.rayons.some(function (pid) { return pid && !(mg.stock[pid] > 0); });
      mq.alerte.style.display = alerte ? "" : "none";
      // le magasin affiché porte la trésorerie de l'enseigne, les autres leur nom
      var texte = mq.actif ? TMI.Panneaux.euros(s.argent) : mq.nom;
      if (mq.texte.textContent !== texte) {
        mq.texte.textContent = texte;
        var l = Math.max(70, texte.length * 8 + 22);
        mq.fond.setAttribute("x", -l / 2); mq.fond.setAttribute("width", l);
      }
    });
    this.camions(s);
    if (this.svg.clientWidth && this.largeurNoms !== this.svg.clientWidth) this.placerNomsRegions();
    void self;
  };

  TMI.VueCarte = VueCarte;
})(window);
