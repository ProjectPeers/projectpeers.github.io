// Animated conveyor-belt pipeline for the Pipeline section.
// A recreation of the team's "Flash" video (Flash-1285-GC.mp4) in plain SVG and JavaScript:
// no libraries, nothing loaded from outside. The six step cards below stay as the text version.
//
// How it works
// - The scene is drawn once in an isometric projection: iso(x, y, z) turns a world point into screen units.
// - render(t) sets every moving part for walkthrough time t (0 to 30 s). It is a pure function of t, so
//   Play, Pause, Replay and the scrubber only change t.
// - A separate ambient clock keeps the belts, rollers and gears moving while the walkthrough is paused.
(function () {
  'use strict';

  var fig = document.querySelector('.belt-scene');
  if (!fig || !document.createElementNS) return;
  var svg = fig.querySelector('svg');
  var NS = 'http://www.w3.org/2000/svg';
  var DURATION = 30;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- palette (site gold and navy-black, with the video's white and grey stations) ----------
  var GOLD = '#fdbb30', GOLD_D = '#e3a312', GOLD_DD = '#c48a06';
  var INK = '#16181c', BLACK = '#25282d', BLACK_L = '#33373d', BLACK_D = '#1b1d21';
  var WHITE = '#fbfaf7', WHITE_S = '#ebe8e1', WHITE_D = '#dcd8cf';
  var GREY = '#c9c7c2', GREY_S = '#b5b3ad', GREY_D = '#a3a19b';
  var RED = '#d62f3a', GREEN = '#2fa25a', LED_OFF = '#cfd3d8';
  var BELT = '#3b3e44', BELT_S = '#2b2d31', BELT_D = '#222428', SLAT = '#4b4f56';

  // ---------- isometric projection ----------
  var U = 30, C = Math.cos(Math.PI / 6), S = 0.5;
  function iso(x, y, z) { return [(x - y) * C * U, (x + y) * S * U - (z || 0) * U]; }
  function pts(list) { return list.map(function (p) { var q = iso(p[0], p[1], p[2]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' '); }
  // Local frames for drawing flat things (text, dials, wheels) onto a plane of the world.
  function mTop(x, y, z) { var o = iso(x, y, z); return 'matrix(' + [C * U, S * U, -C * U, S * U, o[0], o[1]].map(f).join(' ') + ')'; }
  // Face that looks towards +y (front-left). Local x runs along +x, local y runs downwards.
  function mFaceY(x, y, z) { var o = iso(x, y, z); return 'matrix(' + [C * U, S * U, 0, U, o[0], o[1]].map(f).join(' ') + ')'; }
  // Face that looks towards +x (front-right). Local x runs along -y, local y runs downwards.
  function mFaceX(x, y, z) { var o = iso(x, y, z); return 'matrix(' + [C * U, -S * U, 0, U, o[0], o[1]].map(f).join(' ') + ')'; }
  function f(v) { return Number(v).toFixed(3); }

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, str, attrs) { var t = el('text', attrs, parent); t.textContent = str; return t; }

  // A box from (x, y, z) to (x + w, y + d, z + h): top, +y face and +x face.
  function box(g, x, y, z, w, d, h, col, lw) {
    var o = { stroke: INK, 'stroke-width': lw || 1.6, 'stroke-linejoin': 'round' };
    el('polygon', Object.assign({ points: pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]), fill: col[1] }, o), g);
    el('polygon', Object.assign({ points: pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]), fill: col[2] }, o), g);
    el('polygon', Object.assign({ points: pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), fill: col[0] }, o), g);
  }

  // ---------- layout (world units) ----------
  // The belt zigzags: +x (down-right on screen), then -y (up-right), and so on.
  var P = [[0, 0], [6, 0], [6, -6], [12, -6], [12, -12], [18, -12], [18, -18], [24, -18]];
  var BELT_Z = 0.32, HALF = 0.8;
  var segLen = [], total = 0;
  for (var i = 0; i < P.length - 1; i++) { var L = Math.abs(P[i + 1][0] - P[i][0]) + Math.abs(P[i + 1][1] - P[i][1]); segLen.push(L); total += L; }
  function along(s) {
    s = Math.max(0, Math.min(total, s));
    for (var i = 0; i < segLen.length; i++) {
      if (s <= segLen[i] || i === segLen.length - 1) {
        var p = Math.min(1, s / segLen[i]);
        return [P[i][0] + (P[i + 1][0] - P[i][0]) * p, P[i][1] + (P[i + 1][1] - P[i][1]) * p];
      }
      s -= segLen[i];
    }
  }

  // Station anchors (screen points used for the camera and the callouts).
  var ST = {
    desk: [-1.3, -2.6], pr: [3, -2.8], ci: [4.1, -7.9], gate: [9, -8.5], staging: [10.1, -13.9],
    smoke: [15, -14.5], prod: [16.1, -19.9], rocket: [26.45, -18]
  };

  // ---------- drawing ----------
  var defs = el('defs', null, svg);
  var grid = el('pattern', { id: 'bs-grid', width: 52, height: 30, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M0 15 L26 0 L52 15 L26 30 Z', fill: 'none', stroke: '#dedad2', 'stroke-width': 0.8 }, grid);
  var mk = el('marker', { id: 'bs-arrow', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0 L10 5 L0 10 z', fill: RED }, mk);
  var glow = el('radialGradient', { id: 'bs-glow' }, defs);
  el('stop', { offset: '0', 'stop-color': GOLD, 'stop-opacity': 0.75 }, glow);
  el('stop', { offset: '1', 'stop-color': GOLD, 'stop-opacity': 0 }, glow);

  el('rect', { x: -2000, y: -2000, width: 5000, height: 4000, fill: '#f1efeb' }, svg);
  el('rect', { x: -2000, y: -2000, width: 5000, height: 4000, fill: 'url(#bs-grid)' }, svg);

  var world = el('g', null, svg);
  var gStations = el('g', null, world);
  var gBelt = el('g', null, world);
  var gFront = el('g', null, world);
  var gOverlay = el('g', null, svg);

  // Phase labels under the belt (overview only).
  var phase = el('g', { 'font-family': 'var(--sans)' }, world);
  (function () {
    var y = 175;
    el('line', { x1: -20, y1: y, x2: 1160, y2: y, stroke: INK, 'stroke-width': 1.5 }, phase);
    el('line', { x1: -20, y1: y - 6, x2: -20, y2: y + 6, stroke: INK, 'stroke-width': 1.5 }, phase);
    el('line', { x1: 1160, y1: y - 6, x2: 1160, y2: y + 6, stroke: INK, 'stroke-width': 1.5 }, phase);
    text(phase, 'CONTINUOUS INTEGRATION', { x: 270, y: y + 30, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, fill: INK });
    text(phase, 'Runs on every pull request', { x: 270, y: y + 52, 'text-anchor': 'middle', 'font-size': 14, fill: '#4a5a6e' });
    text(phase, 'CONTINUOUS DELIVERY', { x: 880, y: y + 30, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, fill: INK });
    text(phase, 'Runs on every merge', { x: 880, y: y + 52, 'text-anchor': 'middle', 'font-size': 14, fill: '#4a5a6e' });
    el('rect', { x: 512, y: y - 16, width: 136, height: 32, rx: 8, fill: GOLD, stroke: INK, 'stroke-width': 2 }, phase);
    text(phase, 'CI/CD PIPELINE', { x: 580, y: y + 6, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, fill: INK });
  })();

  // Developer desk with a laptop.
  (function () {
    var g = el('g', null, gStations);
    box(g, -2.6, -3.9, 0, 2.6, 2.6, 0.75, [WHITE, WHITE_S, WHITE_D]);
    box(g, -2.1, -3.3, 0.75, 1.5, 1.2, 0.08, [BLACK_L, BLACK, BLACK_D]);
    // Screen: a plate standing on the back edge of the laptop, facing +y.
    el('polygon', { points: pts([[-2.1, -3.3, 0.83], [-0.6, -3.3, 0.83], [-0.6, -3.3, 2.0], [-2.1, -3.3, 2.0]]), fill: BLACK, stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
    var scr = el('g', { transform: mFaceY(-2.0, -3.3, 1.9) }, g);
    [0.95, 0.6, 1.1, 0.7, 0.85].forEach(function (w, k) { el('rect', { x: 0.08, y: 0.12 + k * 0.17, width: w * 1.1, height: 0.07, rx: 0.03, fill: k === 2 ? '#e8ecf1' : GOLD }, scr); });
    box(g, -0.45, -2.2, 0.75, 0.38, 0.38, 0.38, [WHITE, WHITE_S, WHITE_D], 1.2);
  })();

  // Pull request station: black box with a yellow button on top.
  var prButton;
  (function () {
    var g = el('g', null, gStations);
    box(g, 1.5, -4.3, 0, 3.0, 3.0, 2.9, [BLACK_L, BLACK, BLACK_D]);
    var fy = el('g', { transform: mFaceY(1.5, -1.3, 2.9) }, g);
    el('rect', { x: 0, y: 0.18, width: 3.0, height: 0.16, fill: GOLD }, fy);
    text(fy, 'PULL', { x: 1.5, y: 1.05, 'text-anchor': 'middle', 'font-size': 0.62, 'font-weight': 900, fill: GOLD, 'font-family': 'var(--sans)' });
    text(fy, 'REQUEST', { x: 1.5, y: 1.72, 'text-anchor': 'middle', 'font-size': 0.62, 'font-weight': 900, fill: GOLD, 'font-family': 'var(--sans)' });
    el('rect', { x: 1.0, y: 2.1, width: 1.0, height: 0.36, rx: 0.08, fill: GOLD }, fy);
    text(fy, '</>', { x: 1.5, y: 2.38, 'text-anchor': 'middle', 'font-size': 0.3, 'font-weight': 900, fill: INK, 'font-family': 'var(--sans)' });
    box(g, 2.6, -3.2, 2.9, 0.8, 0.8, 0.25, [GREY, GREY_S, GREY_D], 1.2);
    var top = iso(3.0, -2.8, 3.38);
    prButton = el('g', null, g);
    el('circle', { cx: top[0], cy: top[1] + 2, r: 26, fill: 'url(#bs-glow)', class: 'bs-halo' }, prButton);
    el('ellipse', { cx: top[0], cy: top[1], rx: 9, ry: 7, fill: GOLD, stroke: INK, 'stroke-width': 1.4 }, prButton);
  })();

  // CI station: yellow box, check list on the front, GitHub Actions monitor and Docker box on top, a gear on the side.
  var ciLeds = [], ciGear, ciScreen;
  (function () {
    var g = el('g', null, gStations);
    box(g, 2.6, -9.4, 0, 3.0, 3.0, 3.1, [GOLD, GOLD_D, GOLD_DD]);
    var fy = el('g', { transform: mFaceY(2.6, -6.4, 3.1) }, g);
    el('rect', { x: 0.2, y: 0.3, width: 2.6, height: 2.55, rx: 0.12, fill: BLACK, stroke: INK, 'stroke-width': 0.05 }, fy);
    ['BUILD', 'LINT', 'TESTS', 'CODEQL', 'OWASP'].forEach(function (name, k) {
      var y = 0.62 + k * 0.48;
      text(fy, name, { x: 0.42, y: y + 0.11, 'font-size': 0.3, 'font-weight': 800, fill: '#e8ecf1', 'font-family': 'var(--sans)' });
      el('rect', { x: 0.35, y: y + 0.2, width: 2.3, height: 0.03, fill: '#4a4f57' }, fy);
      ciLeds.push(el('circle', { cx: 2.42, cy: y, r: 0.13, fill: LED_OFF }, fy));
    });
    var fx = el('g', { transform: mFaceX(5.6, -6.4, 3.1) }, g);
    text(fx, 'CI', { x: 1.5, y: 1.25, 'text-anchor': 'middle', 'font-size': 1.05, 'font-weight': 900, fill: INK, 'font-family': 'var(--sans)' });
    text(fx, 'CHECKS', { x: 1.5, y: 1.85, 'text-anchor': 'middle', 'font-size': 0.48, 'font-weight': 900, fill: INK, 'font-family': 'var(--sans)' });
    // Gear on the +x face.
    var gearHolder = el('g', { transform: 'translate(2.45 2.5)' }, fx);
    ciGear = el('g', null, gearHolder);
    var teeth = 10, r1 = 0.36, r2 = 0.47, d = '';
    for (var k = 0; k < teeth * 2; k++) {
      var a = (k / (teeth * 2)) * Math.PI * 2, r = k % 2 ? r1 : r2, a2 = ((k + 1) / (teeth * 2)) * Math.PI * 2;
      d += (k ? 'L' : 'M') + f(Math.cos(a) * r) + ' ' + f(Math.sin(a) * r) + 'L' + f(Math.cos(a2) * r) + ' ' + f(Math.sin(a2) * r);
    }
    el('path', { d: d + 'Z', fill: INK }, ciGear);
    el('circle', { r: 0.2, fill: GOLD }, ciGear);
    el('circle', { r: 0.07, fill: INK }, ciGear);
    // Docker box and the GitHub Actions monitor on the top.
    box(g, 2.8, -9.2, 3.1, 1.2, 1.3, 0.75, [GREY, GREY_S, GREY_D], 1.2);
    var dk = el('g', { transform: mFaceY(2.8, -7.9, 3.85) }, g);
    text(dk, 'DOCKER', { x: 0.6, y: 0.45, 'text-anchor': 'middle', 'font-size': 0.24, 'font-weight': 900, fill: INK, 'font-family': 'var(--sans)' });
    el('polygon', { points: pts([[4.3, -8.4, 3.1], [5.4, -8.4, 3.1], [5.4, -8.4, 4.5], [4.3, -8.4, 4.5]]), fill: BLACK, stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
    ciScreen = el('g', { transform: mFaceY(4.3, -8.4, 4.5) }, g);
    text(ciScreen, 'GITHUB', { x: 0.55, y: 0.52, 'text-anchor': 'middle', 'font-size': 0.24, 'font-weight': 900, fill: GOLD, 'font-family': 'var(--sans)' });
    text(ciScreen, 'ACTIONS', { x: 0.55, y: 0.82, 'text-anchor': 'middle', 'font-size': 0.24, 'font-weight': 900, fill: GOLD, 'font-family': 'var(--sans)' });
  })();

  // Quality gate: white box, eight required checks on the front, a red valve wheel on the side, a barrier on the belt.
  var gateLeds = [], gateCount, gateWheel;
  var CHECKS = ['Frontend', 'Backend', 'E2E', 'Workflows', 'OWASP', 'CodeQL', 'Containers', 'Integration'];
  (function () {
    var g = el('g', null, gStations);
    box(g, 7.5, -10.0, 0, 3.0, 3.0, 3.0, [WHITE, WHITE_S, WHITE_D]);
    var fy = el('g', { transform: mFaceY(7.5, -7.0, 3.0) }, g);
    text(fy, 'QUALITY GATE', { x: 1.5, y: 0.5, 'text-anchor': 'middle', 'font-size': 0.36, 'font-weight': 900, fill: INK, 'font-family': 'var(--sans)' });
    el('rect', { x: 0.45, y: 0.62, width: 2.1, height: 0.07, fill: GOLD }, fy);
    CHECKS.forEach(function (name, k) {
      var col = k % 2, row = Math.floor(k / 2), cx = 0.32 + col * 1.4, cy = 1.0 + row * 0.42;
      gateLeds.push(el('circle', { cx: cx, cy: cy, r: 0.13, fill: LED_OFF, stroke: INK, 'stroke-width': 0.03 }, fy));
      text(fy, name, { x: cx + 0.19, y: cy + 0.07, 'font-size': 0.19, 'font-weight': 700, fill: INK, 'font-family': 'var(--sans)' });
    });
    gateCount = text(fy, '0/8', { x: 1.5, y: 2.85, 'text-anchor': 'middle', 'font-size': 0.32, 'font-weight': 900, fill: '#7a828c', 'font-family': 'var(--sans)' });
    var fx = el('g', { transform: mFaceX(10.5, -7.0, 3.0) }, g);
    gateWheel = wheel(fx, 1.5, 1.5, 0.82);
  })();

  function wheel(parent, cx, cy, r) {
    var holder = el('g', { transform: 'translate(' + cx + ' ' + cy + ')' }, parent);
    var w = el('g', null, holder);
    el('circle', { r: r, fill: 'none', stroke: RED, 'stroke-width': r * 0.16 }, w);
    for (var k = 0; k < 4; k++) {
      var a = k * Math.PI / 2;
      el('line', { x1: 0, y1: 0, x2: f(Math.cos(a) * r), y2: f(Math.sin(a) * r), stroke: RED, 'stroke-width': r * 0.11, 'stroke-linecap': 'round' }, w);
    }
    el('circle', { r: r * 0.17, fill: INK }, w);
    return w;
  }

  // Staging: black box with a Render screen.
  var stScreen, stTitle, stLine, stStatus, stIcon;
  (function () {
    var g = el('g', null, gStations);
    box(g, 8.6, -15.4, 0, 3.0, 3.0, 3.0, [BLACK_L, BLACK, BLACK_D]);
    var fy = el('g', { transform: mFaceY(8.6, -12.4, 3.0) }, g);
    stScreen = el('rect', { x: 0.25, y: 0.35, width: 2.5, height: 2.0, rx: 0.14, fill: '#111316', stroke: GOLD, 'stroke-width': 0.07 }, fy);
    stTitle = text(fy, 'STAGING', { x: 0.5, y: 0.85, 'font-size': 0.4, 'font-weight': 900, fill: GOLD, 'font-family': 'var(--sans)' });
    text(fy, 'Render', { x: 0.5, y: 1.3, 'font-size': 0.32, 'font-weight': 700, fill: '#e8ecf1', 'font-family': 'var(--sans)' });
    el('rect', { x: 0.5, y: 1.5, width: 2.0, height: 0.12, rx: 0.06, fill: '#3a3f47' }, fy);
    stLine = el('rect', { x: 0.5, y: 1.5, width: 0, height: 0.12, rx: 0.06, fill: GOLD }, fy);
    stStatus = text(fy, 'waiting', { x: 0.5, y: 2.05, 'font-size': 0.26, 'font-weight': 700, fill: '#9aa3ad', 'font-family': 'var(--sans)' });
    // Rollback arrows (shown while rolling back).
    stIcon = el('g', { transform: 'translate(2.25 1.95)', opacity: 0 }, fy);
    var spin = el('g', { class: 'bs-spin' }, stIcon);
    el('path', { d: 'M0.18 -0.05 A0.18 0.18 0 1 0 0.05 0.17', fill: 'none', stroke: RED, 'stroke-width': 0.06 }, spin);
    el('path', { d: 'M0.18 -0.05 l0.05 -0.14 l-0.15 0.04 z', fill: RED }, spin);
  })();

  // Smoke tests: grey box with a chimney.
  var smokeBars = [], smokeTick, puffs = [];
  (function () {
    var g = el('g', null, gStations);
    box(g, 13.5, -16.0, 0, 3.0, 3.0, 2.6, [GREY, GREY_S, GREY_D]);
    box(g, 14.6, -15.1, 2.6, 0.75, 0.75, 1.0, [BLACK_L, BLACK, BLACK_D], 1.4);
    var fy = el('g', { transform: mFaceY(13.5, -13.0, 2.6) }, g);
    text(fy, 'SMOKE', { x: 1.5, y: 0.75, 'text-anchor': 'middle', 'font-size': 0.48, 'font-weight': 900, fill: INK, 'font-family': 'var(--sans)' });
    text(fy, 'TESTS', { x: 1.5, y: 1.3, 'text-anchor': 'middle', 'font-size': 0.48, 'font-weight': 900, fill: INK, 'font-family': 'var(--sans)' });
    for (var k = 0; k < 3; k++) smokeBars.push(el('rect', { x: 0.55, y: 1.6 + k * 0.28, width: 1.9, height: 0.16, rx: 0.06, fill: '#9c9a94' }, fy));
    smokeTick = el('g', { opacity: 0 }, gFront);
    var c = iso(16.4, -13.0, 0.9);
    el('circle', { cx: c[0], cy: c[1], r: 13, fill: GREEN, stroke: '#fff', 'stroke-width': 2.5 }, smokeTick);
    el('path', { d: 'M' + (c[0] - 6) + ' ' + c[1] + ' l4.5 4.5 l8 -9', fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, smokeTick);
    var top = iso(14.97, -14.72, 3.7);
    for (var p = 0; p < 4; p++) puffs.push(el('circle', { cx: top[0], cy: top[1], r: 6, fill: '#fff', stroke: '#c8c5be', 'stroke-width': 1.2, opacity: 0 }, g));
  })();

  // Production: white box with a lock and a red valve wheel; an APPROVED stamp appears on approval.
  var prodLock, prodWheel, stamp;
  (function () {
    var g = el('g', null, gStations);
    box(g, 14.6, -21.4, 0, 3.0, 3.0, 3.0, [WHITE, WHITE_S, WHITE_D]);
    var fy = el('g', { transform: mFaceY(14.6, -18.4, 3.0) }, g);
    el('rect', { x: 0, y: 0.18, width: 3.0, height: 0.14, fill: GOLD }, fy);
    text(fy, 'PRODUCTION', { x: 1.5, y: 0.78, 'text-anchor': 'middle', 'font-size': 0.4, 'font-weight': 900, fill: INK, 'font-family': 'var(--sans)' });
    el('rect', { x: 1.15, y: 1.55, width: 0.7, height: 0.6, rx: 0.08, fill: INK }, fy);
    prodLock = el('path', { d: 'M1.28 1.55 V1.3 A0.22 0.22 0 0 1 1.72 1.3 V1.55', fill: 'none', stroke: INK, 'stroke-width': 0.1 }, fy);
    var fx = el('g', { transform: mFaceX(17.6, -18.4, 3.0) }, g);
    prodWheel = wheel(fx, 1.5, 1.5, 0.82);
    stamp = el('g', { opacity: 0 }, gFront);
    var s = iso(17.9, -20.4, 3.5);
    var sg = el('g', { transform: 'translate(' + s[0] + ' ' + s[1] + ') rotate(-14)' }, stamp);
    el('rect', { x: -58, y: -15, width: 116, height: 30, rx: 6, fill: '#eaf7ef', stroke: GREEN, 'stroke-width': 3 }, sg);
    text(sg, 'APPROVED', { x: 0, y: 7, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 900, fill: GREEN, 'font-family': 'var(--sans)', 'letter-spacing': 1.5 });
  })();

  // Belt: corner pads with rollers, straight segments, moving slats, gold edges.
  var rollers = [], slats = [];
  (function () {
    var parts = [];
    P.forEach(function (c, k) { parts.push({ kind: 'pad', c: c, k: k, depth: c[0] + c[1] }); });
    for (var k = 0; k < P.length - 1; k++) {
      var a = P[k], b = P[k + 1];
      parts.push({ kind: 'seg', a: a, b: b, k: k, depth: (a[0] + b[0] + a[1] + b[1]) / 2 });
    }
    parts.sort(function (p, q) { return p.depth - q.depth; });
    parts.forEach(function (p) {
      var g = el('g', null, gBelt);
      if (p.kind === 'pad') {
        box(g, p.c[0] - 0.95, p.c[1] - 0.95, 0, 1.9, 1.9, BELT_Z + 0.02, ['#2f3236', BELT_S, BELT_D], 1.4);
        var rg = el('g', { transform: mTop(p.c[0], p.c[1], BELT_Z + 0.02) }, g);
        el('circle', { r: 0.72, fill: '#45494f', stroke: INK, 'stroke-width': 0.05 }, rg);
        var spin = el('g', null, rg);
        for (var s = 0; s < 12; s++) {
          var a = s * Math.PI / 6;
          el('line', { x1: f(Math.cos(a) * 0.16), y1: f(Math.sin(a) * 0.16), x2: f(Math.cos(a) * 0.66), y2: f(Math.sin(a) * 0.66), stroke: '#2a2d31', 'stroke-width': 0.05 }, spin);
        }
        el('circle', { r: 0.16, fill: GOLD, stroke: INK, 'stroke-width': 0.04 }, rg);
        rollers.push(spin);
      } else {
        var horiz = p.b[1] === p.a[1];
        var x0, y0, w, d;
        if (horiz) { x0 = p.a[0] + 0.95; w = p.b[0] - p.a[0] - 1.9; y0 = p.a[1] - HALF; d = HALF * 2; }
        else { x0 = p.a[0] - HALF; w = HALF * 2; y0 = p.b[1] + 0.95; d = p.a[1] - p.b[1] - 1.9; }
        box(g, x0, y0, 0, w, d, BELT_Z, [BELT, BELT_S, BELT_D], 1.4);
        var sl = el('g', null, g);
        var list = [];
        for (var n = 0; n < 9; n++) list.push(el('polyline', { fill: 'none', stroke: SLAT, 'stroke-width': 1.2 }, sl));
        slats.push({ seg: p, horiz: horiz, x0: x0, y0: y0, w: w, d: d, lines: list });
        // Gold edges along both sides.
        if (horiz) {
          el('polyline', { points: pts([[x0, y0 + d, BELT_Z], [x0 + w, y0 + d, BELT_Z]]), stroke: GOLD, 'stroke-width': 2.2, fill: 'none' }, g);
          el('polyline', { points: pts([[x0, y0, BELT_Z], [x0 + w, y0, BELT_Z]]), stroke: GOLD, 'stroke-width': 1.6, fill: 'none' }, g);
        } else {
          el('polyline', { points: pts([[x0 + w, y0, BELT_Z], [x0 + w, y0 + d, BELT_Z]]), stroke: GOLD, 'stroke-width': 2.2, fill: 'none' }, g);
          el('polyline', { points: pts([[x0, y0, BELT_Z], [x0, y0 + d, BELT_Z]]), stroke: GOLD, 'stroke-width': 1.6, fill: 'none' }, g);
        }
      }
    });
  })();

  // Barrier at the quality gate (post in front of the belt, arm across it).
  var arm;
  (function () {
    var g = el('g', null, gFront);
    box(g, 10.85, -4.95, 0, 0.35, 0.35, 1.35, [BLACK_L, BLACK, BLACK_D], 1.3);
    arm = el('line', { stroke: GOLD, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
    arm.armDash = el('line', { stroke: INK, 'stroke-width': 6, 'stroke-dasharray': '7 7' }, g);
  })();

  // Rocket at the end of the belt: a Starship-style stack (Super Heavy booster plus the ship) standing on an
  // orbital launch mount, with the launch tower and its catch arms beside it. Drawn in units scaled 3x;
  // strokes keep the scene's line weight (non-scaling).
  var rocket, flame, rocketPuffs = [];
  (function () {
    var c = iso(ST.rocket[0], ST.rocket[1], 0);
    var MOUNT = 10;   // height of the launch mount's table, in rocket units
    var steel = el('linearGradient', { id: 'bs-steel', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    [[0, '#121418'], [0.3, '#3a3f47'], [0.55, '#23272d'], [1, '#0d0f12']].forEach(function (st) {
      el('stop', { offset: st[0], 'stop-color': st[1] }, steel);
    });
    // Carbon-fibre weave: small alternating tiles, laid over the dark body.
    var weave = el('pattern', { id: 'bs-carbon', width: 2, height: 2, patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { x: 0, y: 0, width: 1, height: 1, fill: '#ffffff', opacity: 0.07 }, weave);
    el('rect', { x: 1, y: 1, width: 1, height: 1, fill: '#ffffff', opacity: 0.07 }, weave);
    el('path', { d: 'M0 1 L1 0 M1 2 L2 1', stroke: '#ffffff', 'stroke-width': 0.15, opacity: 0.08 }, weave);
    // Brushed stainless steel for the booster.
    var silver = el('linearGradient', { id: 'bs-silver', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    [[0, '#8e97a2'], [0.32, '#eef1f4'], [0.6, '#c3c9d1'], [1, '#7f8893']].forEach(function (st) {
      el('stop', { offset: st[0], 'stop-color': st[1] }, silver);
    });
    var STEEL_F = 'url(#bs-steel)', SILVER_F = 'url(#bs-silver)', DARK = '#2a2e35', GRID = '#5b626c';
    var ln = { stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' };
    function P(parent, d, fill, extra) { return el('path', Object.assign({ d: d, fill: fill }, ln, extra || {}), parent); }

    // Ground pad, then the tower and the launch mount (they stay when the rocket lifts off).
    var pad = el('g', null, gFront);
    // (sized and placed so the pad clears the last belt pad: rocket at x 26.45, rx 50)
    el('ellipse', { cx: c[0], cy: c[1], rx: 50, ry: 26, fill: '#e3e0d9', stroke: INK, 'stroke-width': 1.6 }, pad);
    el('ellipse', { cx: c[0], cy: c[1] - 3, rx: 38, ry: 19, fill: 'none', stroke: GOLD, 'stroke-width': 1.6 }, pad);
    var art = el('g', { transform: 'translate(' + c[0] + ' ' + (c[1] - 6) + ') scale(3)' }, pad);
    // Launch tower: a steel lattice to the right, with a lightning rod on top.
    P(art, 'M15 0 L15 -128 L22 -128 L22 0 Z', GRID);
    var lat = '';
    for (var yy = 0; yy > -128; yy -= 8) lat += 'M15 ' + yy + ' L22 ' + (yy - 8) + ' M22 ' + yy + ' L15 ' + (yy - 8) + ' M15 ' + yy + ' L22 ' + yy + ' ';
    el('path', { d: lat, stroke: '#3a4049', 'stroke-width': 0.7, fill: 'none' }, art);
    el('path', { d: 'M18.5 -128 L18.5 -138', stroke: INK, 'stroke-width': 1.2 }, art);
    P(art, 'M13.5 0 L23.5 0 L23.5 2 L13.5 2 Z', DARK);
    // Catch arms ("chopsticks") on a carriage, reaching behind the booster, and the ship's quick-disconnect arm.
    P(art, 'M13.8 -74 L23.2 -74 L23.2 -66 L13.8 -66 Z', DARK);
    P(art, 'M-9 -73 L15 -73 L15 -70.5 L-9 -70.5 Z', '#3a4049');
    P(art, 'M-9 -69 L15 -69 L15 -66.8 L-9 -66.8 Z', '#3a4049');
    P(art, 'M7 -98 L15 -98 L15 -95.5 L7 -95.5 Z', '#3a4049');
    // Orbital launch mount: a steel table on legs, its ring holding the booster.
    P(art, 'M-9.5 0 L-9.5 -' + (MOUNT - 2) + ' L-7.5 -' + (MOUNT - 2) + ' L-7.5 0 Z', GRID);
    P(art, 'M7.5 0 L7.5 -' + (MOUNT - 2) + ' L9.5 -' + (MOUNT - 2) + ' L9.5 0 Z', GRID);
    P(art, 'M-4.5 0 L-4.5 -' + (MOUNT - 2) + ' L-2.5 -' + (MOUNT - 2) + ' L-2.5 0 Z', GRID);
    P(art, 'M2.5 0 L2.5 -' + (MOUNT - 2) + ' L4.5 -' + (MOUNT - 2) + ' L4.5 0 Z', GRID);
    P(art, 'M-10 -' + (MOUNT - 2) + ' L10 -' + (MOUNT - 2) + ' L10 -' + MOUNT + ' L-10 -' + MOUNT + ' Z', DARK);
    Array.prototype.forEach.call(art.querySelectorAll('path'), function (n) { n.setAttribute('vector-effect', 'non-scaling-stroke'); });
    for (var q = 0; q < 6; q++) rocketPuffs.push(el('circle', { cx: c[0], cy: c[1], r: 10, fill: '#fff', stroke: '#c8c5be', 'stroke-width': 1.2, opacity: 0 }, pad));

    // The rocket itself (this group lifts off). Its base sits on the mount's table.
    rocket = el('g', null, gFront);
    var r = el('g', { transform: 'translate(' + c[0] + ' ' + (c[1] - 6 - MOUNT * 3) + ') scale(3)' }, rocket);
    flame = el('path', { d: 'M-6.5 0 Q0 19 6.5 0 Z', fill: '#ff9b2f', stroke: RED, 'stroke-width': 1.5, opacity: 0 }, r);
    // Super Heavy booster: stainless-steel body with weld seams, darker engine skirt, four grid fins near the top,
    // then the vented hot-staging ring. (The ship above is black carbon.)
    P(r, 'M-7 0 L-7 -60 L7 -60 L7 0 Z', SILVER_F);
    el('path', { d: 'M-7 -12 L7 -12 M-7 -24 L7 -24 M-7 -36 L7 -36 M-7 -48 L7 -48', stroke: '#8a939e', 'stroke-width': 0.7 }, r);
    P(r, 'M-7 0 L-7 -4 L7 -4 L7 0 Z', '#4a5059');
    [-1, 1].forEach(function (sd) {
      P(r, 'M' + 7 * sd + ' -57 L' + 11 * sd + ' -57 L' + 11 * sd + ' -52.5 L' + 7 * sd + ' -52.5 Z', DARK);
      el('path', { d: 'M' + 8.3 * sd + ' -57 L' + 8.3 * sd + ' -52.5 M' + 9.7 * sd + ' -57 L' + 9.7 * sd + ' -52.5 M' + 7 * sd + ' -54.8 L' + 11 * sd + ' -54.8', stroke: '#7b8390', 'stroke-width': 0.6 }, r);
    });
    P(r, 'M-3 -57 L3 -57 L3 -53 L-3 -53 Z', DARK);
    el('path', { d: 'M-1 -57 L-1 -53 M1 -57 L1 -53 M-3 -55 L3 -55', stroke: '#7b8390', 'stroke-width': 0.6 }, r);
    P(r, 'M-7 -60 L-7 -64 L7 -64 L7 -60 Z', '#4a5059');
    el('path', { d: 'M-5 -60.6 L-5 -63.4 M-2.5 -60.6 L-2.5 -63.4 M0 -60.6 L0 -63.4 M2.5 -60.6 L2.5 -63.4 M5 -60.6 L5 -63.4', stroke: '#c3c9d1', 'stroke-width': 0.8 }, r);
    // Ship: aft flaps, steel body with the black heat-shield tiles on one side, nose with the forward flaps.
    [-1, 1].forEach(function (sd) {
      P(r, 'M' + 7 * sd + ' -64 L' + 11 * sd + ' -65.5 L' + 11 * sd + ' -74 L' + 7 * sd + ' -77 Z', DARK);
      P(r, 'M' + 6.4 * sd + ' -97 L' + 9.3 * sd + ' -98.5 L' + 9.3 * sd + ' -102.5 L' + 5.6 * sd + ' -104.5 Z', DARK);
    });
    P(r, 'M-7 -64 L-7 -96 Q-7 -108 0 -112 Q7 -108 7 -96 L7 -64 Z', STEEL_F);
    el('path', { d: 'M-7 -64 L-7 -96 Q-7 -108 0 -112 Q7 -108 7 -96 L7 -64 Z', fill: 'url(#bs-carbon)' }, r);
    el('path', { d: 'M-7 -76 L7 -76 M-7 -88 L7 -88 M3.5 -64 L3.5 -100', stroke: '#4a5059', 'stroke-width': 0.7 }, r);
    P(r, 'M-7 -64 L-7 -96 Q-7 -108 0 -112 L0 -64 Z', '#0b0c0f', { 'stroke-width': 0 });
    P(r, 'M-7 -64 L-7 -96 Q-7 -108 0 -112 Q7 -108 7 -96 L7 -64 Z', 'none');
    ['K', 'S', 'U'].forEach(function (ch, k) { text(r, ch, { x: 0, y: -38 + k * 11, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 900, fill: GOLD, stroke: INK, 'stroke-width': 0.6, 'font-family': 'var(--sans)' }); });
    Array.prototype.forEach.call(r.querySelectorAll('path, circle, text'), function (n) { n.setAttribute('vector-effect', 'non-scaling-stroke'); });
  })();

  // Code packages (the main one, and a "ghost" for the failure paths).
  function pkg(parent) {
    var g = el('g', null, parent);
    var halo = el('circle', { cx: 0, cy: -10, r: 34, fill: 'url(#bs-glow)' }, g);
    var body = el('g', null, g);
    box(body, -0.45, -0.45, 0, 0.9, 0.9, 0.9, [GOLD, GOLD_D, GOLD_DD], 1.4);
    var fy = el('g', { transform: mFaceY(-0.45, 0.45, 0.9) }, body);
    text(fy, '</>', { x: 0.45, y: 0.58, 'text-anchor': 'middle', 'font-size': 0.36, 'font-weight': 900, fill: INK, 'font-family': 'var(--sans)' });
    var tint = el('g', { opacity: 0 }, g);
    box(tint, -0.45, -0.45, 0, 0.9, 0.9, 0.9, ['#f2a3a8', '#e06a72', '#c94c55'], 1.4);
    return { g: g, halo: halo, tint: tint };
  }
  var mainPkg = pkg(gFront), ghost = pkg(gFront);

  // Tunnel hatch on the first belt pad: in the idle loop each change rises out of it from underground.
  // The package sits in a wrapper so it can be clipped to "above the hole" while it comes up.
  var HATCH_A = 0.58;
  var pkgWrap = el('g', null);
  gFront.insertBefore(pkgWrap, mainPkg.g);
  pkgWrap.appendChild(mainPkg.g);
  var hatch = el('g', { opacity: 0, transform: mTop(P[0][0], P[0][1], BELT_Z + 0.03) });
  gFront.insertBefore(hatch, pkgWrap);
  var hatchOpen = el('g', null, hatch);
  el('rect', { x: -HATCH_A, y: -HATCH_A, width: 2 * HATCH_A, height: 2 * HATCH_A, rx: 0.08, fill: '#06070a', stroke: GOLD, 'stroke-width': 0.07 }, hatchOpen);
  // The shaft's back walls catch a little light, so the hole reads as deep.
  el('path', { d: 'M' + (-HATCH_A + 0.06) + ' ' + (HATCH_A - 0.06) + ' V' + (-HATCH_A + 0.06) + ' H' + (HATCH_A - 0.06), fill: 'none', stroke: '#2b2f36', 'stroke-width': 0.16 }, hatchOpen);
  // Clip: everything above the hole's two front edges, so the part of the package still underground is hidden.
  (function () {
    var cp = el('clipPath', { id: 'bs-hatch-clip', clipPathUnits: 'userSpaceOnUse' }, defs);
    var L = iso(P[0][0] - HATCH_A, P[0][1] + HATCH_A, BELT_Z), F = iso(P[0][0] + HATCH_A, P[0][1] + HATCH_A, BELT_Z), R = iso(P[0][0] + HATCH_A, P[0][1] - HATCH_A, BELT_Z);
    el('polygon', { points: [L, F, R, [R[0], R[1] - 400], [L[0], L[1] - 400]].map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') }, cp);
  })();

  // ---------- the crew (idle loop only) ----------
  // Five small engineers (three men, two women) in hard hats and hi-vis vests, drawn in the scene's flat style, each
  // with a different tool. Each is built standing on its own feet at (0, 0) in screen units and placed with iso().
  // Poses: 'look' (inspects with a magnifying glass), 'tablet' (checks an iPad), 'walk' (walks with a wrench),
  // 'kneel' (fixes a cable with pliers), 'radio' (talks on a walkie-talkie).
  var VEST = '#ff7a1a', STRIPE = '#eef3f8', PANTS = '#2c3e57', SHIRT = '#3b4b63', BOOT = '#16181c', STEEL = '#8f98a3';
  var gCrew = el('g', { opacity: 0 }, gFront);   // added last in the front layer: every spot is in front of what is near it
  // The barrier operator's control pendant: a yellow box with a green (open) and a red (close) button.
  function pendantShape(parent) {
    var p = el('g', null, parent);
    el('rect', { x: -3.2, y: -5.5, width: 6.4, height: 10, rx: 1.4, fill: GOLD, stroke: INK, 'stroke-width': 0.9 }, p);
    p.green = el('circle', { cx: 0, cy: -2.3, r: 1.5, fill: '#1f5c38', stroke: INK, 'stroke-width': 0.5 }, p);
    p.red = el('circle', { cx: 0, cy: 1.8, r: 1.5, fill: '#6b2226', stroke: INK, 'stroke-width': 0.5 }, p);
    return p;
  }
  function magnifierShape(parent) {
    var m = el('g', null, parent);
    el('path', { d: 'M0 0 L7 0', stroke: '#5a3a22', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, m);
    el('circle', { cx: 12, cy: 0, r: 5, fill: 'rgba(170, 220, 255, .45)', stroke: INK, 'stroke-width': 1.6 }, m);
    el('path', { d: 'M9.6 -2.4 A3 3 0 0 1 12.6 -3.4', fill: 'none', stroke: '#fff', 'stroke-width': 1, 'stroke-linecap': 'round' }, m);
    return m;
  }
  function pliersShape(parent) {
    var p = el('g', null, parent);
    p.gripA = el('path', { d: 'M0 -1.6 L9 -0.6', stroke: RED, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, p);
    p.gripB = el('path', { d: 'M0 1.6 L9 0.6', stroke: RED, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, p);
    el('circle', { cx: 9.4, cy: 0, r: 1.3, fill: STEEL, stroke: INK, 'stroke-width': 0.6 }, p);
    el('path', { d: 'M9.4 0 L15 -1.2 L15 1.2 Z', fill: STEEL, stroke: INK, 'stroke-width': 0.6, 'stroke-linejoin': 'round' }, p);
    return p;
  }
  function radioShape(parent) {
    var r = el('g', null, parent);
    el('rect', { x: -2.6, y: -6, width: 5.2, height: 9, rx: 1.2, fill: '#1b1f26', stroke: INK, 'stroke-width': 0.8 }, r);
    el('path', { d: 'M1.4 -6 L1.4 -10.5', stroke: INK, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, r);
    el('circle', { cx: 0, cy: -3.6, r: 0.9, fill: '#3ddc84' }, r);
    return r;
  }
  function engineer(x, y, z, pose, opt) {
    var at = iso(x, y, z), scale = opt.scale || 0.95;
    var root = el('g', { transform: 'translate(' + at[0].toFixed(1) + ' ' + at[1].toFixed(1) + ')' }, gCrew);
    var body = el('g', { transform: 'scale(' + (opt.flip ? -scale : scale) + ' ' + scale + ')' }, root);
    var o = { root: root, body: body, pose: pose, x: x, y: y, scale: scale, flip: !!opt.flip };
    var skin = opt.skin, hat = opt.hat;
    var line = { stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' };
    el('ellipse', { cx: 0, cy: 0, rx: z > 0 ? 6 : 11, ry: z > 0 ? 2 : 3.6, fill: 'rgba(22,24,28,.18)' }, body);
    var up = el('g', null, body);   // everything above the hips (lowered when kneeling)
    o.up = up;
    if (pose === 'kneel') {
      // back leg: knee on the floor, shin lying behind; front leg: thigh forward, shin down
      el('path', Object.assign({ d: 'M-4 -12 L-8 -2 L-17 -2 L-17 1 L-6 1 L-1 -10 Z', fill: PANTS }, line), body);
      el('path', Object.assign({ d: 'M1 -12 L9 -9 L9 0 L13 0 L13 1 L5 1 L5 -6 L-1 -8 Z', fill: PANTS }, line), body);
      up.setAttribute('transform', 'translate(0 5)');
    } else {
      o.legB = el('g', null, body); o.legF = el('g', null, body);
      [o.legB, o.legF].forEach(function (lg, k) {
        var lx = k ? 0.6 : -5.2;
        el('rect', Object.assign({ x: lx, y: -17, width: 4.6, height: 16, rx: 1.6, fill: PANTS }, line), lg);
        el('rect', { x: lx - 0.8, y: -2.6, width: 6.2, height: 3.2, rx: 1, fill: BOOT }, lg);
      });
    }
    // back arm (behind the torso)
    o.armB = el('g', { transform: 'translate(-5 -30)' }, up);
    el('rect', Object.assign({ x: -2, y: 0, width: 4, height: 13, rx: 2, fill: SHIRT }, line), o.armB);
    el('circle', { cx: 0, cy: 13.5, r: 2.3, fill: skin, stroke: INK, 'stroke-width': 1 }, o.armB);
    // torso with the vest and its two reflective stripes
    el('path', Object.assign({ d: 'M-8 -15 L-8 -27 Q-8 -33 -2.5 -33 L2.5 -33 Q8 -33 8 -27 L8 -15 Z', fill: SHIRT }, line), up);
    // seen from the back (opt.back) the vest has no V-neck and the stripes cross in an X
    el('path', Object.assign({ d: opt.back ? 'M-8 -15 L-8 -27 Q-8 -33 -2.5 -33 L2.5 -33 Q8 -33 8 -27 L8 -15 Z'
      : 'M-8 -15 L-8 -27 Q-8 -33 -2.5 -33 L-1.2 -33 L0 -27 L1.2 -33 L2.5 -33 Q8 -33 8 -27 L8 -15 Z', fill: VEST }, line), up);
    el('rect', { x: -7.4, y: -23.5, width: 14.8, height: 2.2, fill: STRIPE }, up);
    el('rect', { x: -7.4, y: -19.5, width: 14.8, height: 2.2, fill: STRIPE }, up);
    if (opt.back) el('path', { d: 'M-6 -32 L6 -24 M6 -32 L-6 -24', stroke: STRIPE, 'stroke-width': 1.8 }, up);
    // head: a ponytail out from under the hard hat for the women, then the face (or the back of the head) and the hat
    o.head = el('g', null, up);
    if (opt.female) el('path', Object.assign({ d: 'M-3.5 -42 Q-12 -41 -11 -30 Q-8.5 -32.5 -5 -35.5 Z', fill: opt.hair || '#3a2416' }, line), o.head);
    el('circle', { cx: 0, cy: -38, r: 5.6, fill: opt.back ? (opt.hair || '#3a2416') : skin, stroke: INK, 'stroke-width': 1.2 }, o.head);
    if (opt.back) el('rect', { x: -2.4, y: -33.6, width: 4.8, height: 1.8, fill: skin }, o.head);   // the neck
    el('path', Object.assign({ d: 'M-6.6 -39.6 A6.6 6.6 0 0 1 6.6 -39.6 Z', fill: hat }, line), o.head);
    el('path', { d: 'M-8.6 -39.6 L9.2 -39.6', stroke: INK, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, o.head);
    el('path', { d: 'M-8.2 -39.6 L8.8 -39.6', stroke: hat, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, o.head);
    el('path', { d: 'M0 -46 L0 -41', stroke: INK, 'stroke-width': 0.9, opacity: 0.5 }, o.head);
    // front arm
    o.armF = el('g', { transform: 'translate(5 -30)' }, up);
    el('rect', Object.assign({ x: -2, y: 0, width: 4, height: 13, rx: 2, fill: SHIRT }, line), o.armF);
    el('circle', { cx: 0, cy: 13.5, r: 2.3, fill: skin, stroke: INK, 'stroke-width': 1 }, o.armF);
    // the tool for the pose
    if (pose === 'tablet') {
      o.armB.setAttribute('transform', 'translate(-5 -30) rotate(-70)');
      o.armF.setAttribute('transform', 'translate(5 -30) rotate(-55)');
      o.tablet = el('g', { transform: 'translate(10 -27) rotate(-14)' }, up);
      el('rect', { x: -1, y: -6, width: 14, height: 10, rx: 1.6, fill: '#1b1f26', stroke: INK, 'stroke-width': 1 }, o.tablet);
      el('rect', { x: 0.6, y: -4.6, width: 10.8, height: 7.2, rx: 0.8, fill: '#13324f' }, o.tablet);
      o.bars = [0, 1, 2, 3].map(function (k) { return el('rect', { x: 1.8 + k * 2.6, y: 1.6, width: 1.7, height: 1, fill: k === 3 ? GOLD : '#3ddc84' }, o.tablet); });
    } else if (pose === 'operate') {
      // holds the barrier's control pendant at chest height; its cable runs down to the barrier post
      o.armF.setAttribute('transform', 'translate(5 -30) rotate(-62)');
      if (opt.cableTo) el('path', { d: 'M11 -16 Q' + ((11 + opt.cableTo[0]) / 2).toFixed(1) + ' -4 ' + opt.cableTo[0].toFixed(1) + ' ' + opt.cableTo[1].toFixed(1), fill: 'none', stroke: '#16181c', 'stroke-width': 1.3 }, up);
      o.pendant = pendantShape(up); o.pendant.setAttribute('transform', 'translate(11 -21)');
    } else if (pose === 'kneel') {
      o.armB.setAttribute('transform', 'translate(-5 -30) rotate(-35)');
      o.armF.setAttribute('transform', 'translate(5 -30) rotate(-70)');
      o.pliers = pliersShape(up); o.pliers.setAttribute('transform', 'translate(15 -23) rotate(20)');
    } else if (pose === 'look') {
      // magnifying glass held up toward the laptop screen
      o.armF.setAttribute('transform', 'translate(5 -30) rotate(-138)');
      var m = magnifierShape(o.armF); m.setAttribute('transform', 'translate(0 14) rotate(80)');
    } else if (pose === 'radio') {
      // walkie-talkie up at the ear, with signal arcs
      o.armF.setAttribute('transform', 'translate(5 -30) rotate(-160)');
      var r = radioShape(o.armF); r.setAttribute('transform', 'translate(0 15) rotate(160)');
      o.signal = el('g', { transform: 'translate(9 -46)' }, up);
      [4, 7].forEach(function (rad) { el('path', { d: 'M0 ' + (-rad) + ' A' + rad + ' ' + rad + ' 0 0 1 ' + rad + ' 0', fill: 'none', stroke: '#3ddc84', 'stroke-width': 1.3, 'stroke-linecap': 'round' }, o.signal); });
    }
    return o;
  }
  // A junction box on the floor beside the belt, its cable running to the motor under the next corner pad.
  (function () {
    var jb = el('g', null, gCrew);
    el('path', { d: 'M' + pts([[16.95, -10.45, 0.02], [17.5, -10.65, 0.02], [17.7, -11.05, 0.02]]).replace(/ /g, ' L'), fill: 'none', stroke: '#16181c', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, jb);
    box(jb, 16.45, -10.75, 0, 0.5, 0.5, 0.4, [GREY, GREY_S, GREY_D], 1.1);
    var led = iso(16.7, -10.25, 0.27);
    el('circle', { cx: led[0], cy: led[1], r: 1.6, fill: '#3ddc84' }, jb);
  })();
  var crew = [
    // standing on the desk in front of the giant laptop, his back to us, reviewing the code on its screen with a magnifying glass
    engineer(-1.35, -1.65, 0.75, 'look', { skin: '#e0ac85', hat: '#fdbb30', hair: '#4a2e1a', back: true, scale: 0.95 }),
    // at the quality gate, checking the checks on an iPad
    engineer(8.4, -3.5, 0, 'tablet', { skin: '#f1c7a3', hat: '#ffffff', female: true, hair: '#6b3e1e' }),
    // walking along the first belt with a wrench
    // beside the quality-gate barrier, opening and closing it with a control pendant (cable to the post's base)
    // (on open floor in front of the gate, so nothing on the belt sits behind him on screen)
    engineer(10.6, -2.4, 0, 'operate', { skin: '#8d5a3b', hat: '#ffffff', cableTo: (function () {
      var post = iso(11.02, -4.8, 0.2), me = iso(10.6, -2.4, 0);
      return [(post[0] - me[0]) / 0.95, (post[1] - me[1]) / 0.95];   // in his own (scaled) units
    })() }),
    // kneeling at the junction box, fixing the motor's cable with pliers
    engineer(15.9, -9.9, 0, 'kneel', { skin: '#c68b59', hat: '#fdbb30', female: true, hair: '#1f140d' }),
    // by the rocket, on the walkie-talkie for the launch
    engineer(24.7, -14.7, 0, 'radio', { skin: '#5c3a24', hat: '#fdbb30' })
  ];
  // Moves the crew for ambient time a (seconds). Small, looping motions only.
  function animateCrew(a) {
    crew.forEach(function (c, k) {
      if (c.pose === 'tablet') {
        c.head.setAttribute('transform', 'rotate(' + (Math.sin(a * 1.3 + k) * 4).toFixed(2) + ' 0 -33)');
        c.armF.setAttribute('transform', 'translate(5 -30) rotate(' + (-55 + Math.max(0, Math.sin(a * 5 + k)) * 8).toFixed(1) + ')');   // tapping
        c.bars.forEach(function (b, j) {
          var hgt = 1.2 + 3.6 * (0.5 + 0.5 * Math.sin(a * 1.7 + j * 1.1 + k));
          b.setAttribute('y', (2.6 - hgt).toFixed(2)); b.setAttribute('height', hgt.toFixed(2));
        });
      } else if (c.pose === 'operate') {
        // presses green while the barrier opens and red while it closes; the lit button shows its state
        var moving = barrierOpen - (c.lastOpen === undefined ? barrierOpen : c.lastOpen);
        c.lastOpen = barrierOpen;
        var press = Math.abs(moving) > 0.0005 ? 1 : 0;
        c.armF.setAttribute('transform', 'translate(5 -30) rotate(' + (-62 + press * 5).toFixed(1) + ')');
        c.pendant.green.setAttribute('fill', barrierOpen > 0.5 ? '#3ddc84' : '#1f5c38');
        c.pendant.red.setAttribute('fill', barrierOpen > 0.5 ? '#6b2226' : '#ff5c5c');
        c.head.setAttribute('transform', 'rotate(' + (-4 - barrierOpen * 8).toFixed(2) + ' 0 -33)');   // looks up as the arm rises
      } else if (c.pose === 'kneel') {
        var squeeze = Math.max(0, Math.sin(a * 3.6));
        c.pliers.gripA.setAttribute('transform', 'rotate(' + (squeeze * 7).toFixed(1) + ' 9.4 0)');
        c.pliers.gripB.setAttribute('transform', 'rotate(' + (-squeeze * 7).toFixed(1) + ' 9.4 0)');
        c.armF.setAttribute('transform', 'translate(5 -30) rotate(' + (-70 + squeeze * 6).toFixed(1) + ')');
        c.head.setAttribute('transform', 'rotate(10 0 -33)');
      } else if (c.pose === 'look') {
        // waves the magnifying glass briskly back and forth across the screen
        var sweep = Math.sin(a * 3.2);
        c.armF.setAttribute('transform', 'translate(5 -30) rotate(' + (-138 + sweep * 16).toFixed(1) + ')');
        c.head.setAttribute('transform', 'rotate(' + (-6 + sweep * 5).toFixed(2) + ' 0 -33)');
      } else if (c.pose === 'radio') {
        // waves the walkie-talkie quickly while calling the launch
        c.signal.setAttribute('opacity', (0.5 + 0.5 * Math.sin(a * 8)).toFixed(2));
        c.armF.setAttribute('transform', 'translate(5 -30) rotate(' + (-160 + Math.sin(a * 5) * 14).toFixed(1) + ')');
        c.head.setAttribute('transform', 'rotate(' + (Math.sin(a * 3.4) * 4).toFixed(2) + ' 0 -33)');
      }
    });
  }

  // Red failure paths (screen-space arcs that draw themselves).
  function arc(from, to, lift) {
    var a = iso(from[0], from[1], from[2]), b = iso(to[0], to[1], to[2]);
    var mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - lift;
    var d = 'M' + a[0] + ' ' + a[1] + ' Q' + mx + ' ' + my + ' ' + b[0] + ' ' + b[1];
    var g = el('g', { opacity: 0 }, gOverlay);
    var base = el('path', { d: d, fill: 'none', stroke: RED, 'stroke-width': 7, 'stroke-linecap': 'round', 'marker-end': 'url(#bs-arrow)', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, g);
    var dash = el('path', { d: d, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '7 7' }, g);
    return { g: g, base: base, dash: dash, path: base };
  }
  var arcGate = arc([9, -7, 3.3], [3, -2.8, 3.4], 90);
  var arcSmoke = arc([15, -13, 2.9], [10.4, -12.4, 2.9], 70);

  // Callouts.
  function callout(anchor, z, title, sub, red, dy) {
    var c = iso(anchor[0], anchor[1], z);
    var g = el('g', { opacity: 0, transform: 'translate(' + c[0] + ' ' + (c[1] - (dy || 0)) + ')' }, gOverlay);
    var w = Math.max(title.length * 9.6, sub.length * 6.4) + 26;
    el('rect', { x: -w / 2, y: -46, width: w, height: 42, rx: 6, fill: '#fff', stroke: red ? RED : INK, 'stroke-width': 2 }, g);
    text(g, title, { x: 0, y: -27, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 900, fill: red ? RED : INK, 'font-family': 'var(--sans)', 'letter-spacing': .5 });
    if (!red) el('rect', { x: -w / 2 + 10, y: -22, width: w - 20, height: 2, fill: GOLD }, g);
    text(g, sub, { x: 0, y: -11, 'text-anchor': 'middle', 'font-size': 10.5, fill: '#4a5a6e', 'font-family': 'var(--sans)' });
    return g;
  }
  var CALL = {
    dev: callout(ST.desk, 2.3, 'DEVELOPER', 'Writes a change', false, 4),
    pr: callout(ST.pr, 3.6, 'PULL REQUEST', 'Every change via pull request', false, 4),
    ci: callout(ST.ci, 4.7, 'CI CHECKS', 'GitHub Actions builds, tests, and scans', false, 4),
    gate: callout(ST.gate, 3.3, 'QUALITY GATE', 'Eight required checks', false, 4),
    gateFail: callout([6.5, -6.5], 5.4, 'IF A CHECK FAILS', 'the change returns to the pull request', true, 0),
    staging: callout(ST.staging, 3.3, 'STAGING', 'Deployed to Render', false, 4),
    smoke: callout(ST.smoke, 3.9, 'SMOKE TESTS', 'Release candidate recorded', false, 4),
    smokeFail: callout([12.4, -13.4], 4.8, 'IF SMOKE TESTS FAIL', 'staging rolls back to the last good release', true, 0),
    prod: callout(ST.prod, 3.3, 'PRODUCTION', 'Manual approval required', false, 4)
  };

  // Title card.
  var title = el('g', { 'font-family': 'var(--sans)' }, gOverlay);
  (function () {
    el('rect', { x: 375, y: -392, width: 112, height: 44, rx: 8, fill: '#fff', stroke: INK, 'stroke-width': 3 }, title);
    text(title, '1285-GC', { x: 431, y: -362, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 900, fill: INK });
    text(title, 'PEERS', { x: 500, y: -350, 'font-size': 64, 'font-weight': 900, fill: GOLD, stroke: INK, 'stroke-width': 3, 'paint-order': 'stroke', 'letter-spacing': 1 });
    text(title, 'FROM CODE TO CONFIDENCE', { x: 580, y: -305, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 900, fill: INK, 'letter-spacing': 1 });
    el('path', { d: 'M440 -284 Q580 -290 720 -284', fill: 'none', stroke: GOLD, 'stroke-width': 5, 'stroke-linecap': 'round' }, title);
  })();

  // ---------- timeline ----------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(p) { p = clamp(p, 0, 1); return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function prog(t, a, b) { return ease((t - a) / (b - a)); }
  function lin(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function on(t, a, b, fade) { fade = fade || 0.3; return Math.min(prog(t, a, a + fade), 1 - prog(t, b - fade, b)); }
  function keyed(list, t) { // [[t, value...], ...] eased between keys
    if (t <= list[0][0]) return list[0].slice(1);
    for (var i = 0; i < list.length - 1; i++) {
      var a = list[i], b = list[i + 1];
      if (t <= b[0]) { var p = ease((t - a[0]) / (b[0] - a[0])); return a.slice(1).map(function (v, k) { return v + (b[k + 1] - v) * p; }); }
    }
    return list[list.length - 1].slice(1);
  }

  // Camera: [time, centre x, centre y, width]. Height follows the 16:9 frame.
  function at(name, dx, dy) { var p = iso(ST[name][0], ST[name][1], 1.6); return [p[0] + (dx || 0), p[1] + (dy || 0)]; }
  var OV = [585, -78, 1300];
  var cam = [
    [0].concat(OV), [3.0].concat(OV),
    [3.9, at('pr')[0] - 30, at('pr')[1] + 20, 560], [5.7, at('pr')[0] - 10, at('pr')[1] + 20, 560],
    [6.6, at('ci')[0] + 40, at('ci')[1] - 5, 600], [9.4, at('ci')[0] + 60, at('ci')[1] - 5, 600],
    [10.1, at('gate')[0] + 10, at('gate')[1] + 40, 600], [11.9, at('gate')[0] + 10, at('gate')[1] + 40, 600],
    [12.5, at('gate')[0] - 110, at('gate')[1] + 10, 820], [14.4, at('gate')[0] - 110, at('gate')[1] + 10, 820],
    [15.0, at('gate')[0] + 20, at('gate')[1] + 40, 600],
    [16.6, at('staging')[0] + 40, at('staging')[1] + 40, 640], [17.6, at('staging')[0] + 60, at('staging')[1] + 40, 640],
    [18.6, at('smoke')[0] - 50, at('smoke')[1] + 30, 700], [23.2, at('smoke')[0] - 60, at('smoke')[1] + 30, 700],
    [24.2, at('prod')[0] + 40, at('prod')[1] + 40, 640], [25.8, at('prod')[0] + 70, at('prod')[1] + 40, 640],
    [26.6, at('rocket')[0] - 110, at('rocket')[1] - 125, 900],   // tall enough for the rocket on its mount and the tower
    [27.6].concat(OV), [30].concat(OV)
  ];

  // Main package: distance along the belt. Stops: PR 3, CI corner 12, gate 15, staging corner 24, smoke 27, production corner 36, rocket 42.
  var pkgPath = [[3.2, 0], [4.6, 3], [5.9, 3], [6.9, 12], [9.5, 12], [10.2, 15], [15.0, 15], [16.6, 24], [17.6, 24], [18.3, 27], [24.0, 27], [24.9, 36], [25.8, 36], [26.5, 42.6]];

  var CAPTIONS = [
    [3.25, 6.0, 'Every change begins with a pull request.'],
    [6.0, 7.0, 'GitHub Actions'],
    [7.0, 9.45, 'builds, tests, and scans the code.'],
    [9.5, 12.0, 'Eight required checks guard every merge.'],
    [12.0, 13.2, 'If one fails,'],
    [13.2, 15.2, 'the merge is blocked until fixed.'],
    [15.25, 16.7, 'Once merged, the application'],
    [16.7, 18.7, 'deploys to Render staging for smoke'],
    [18.7, 19.2, 'testing.'],
    [19.25, 21.45, 'If testing fails, staging automatically'],
    [21.45, 23.7, 'rolls back to the last good release.'],
    [23.75, 25.45, 'Production still requires manual'],
    [25.45, 26.2, 'approval.'],
    [26.25, 27.2, 'PEERS.'],
    [27.2, 28.45, 'Built to Test.'],
    [28.45, 29.5, 'Ready to Deliver.']
  ];

  function setOpacity(n, v) { n.setAttribute('opacity', v.toFixed(3)); }
  function fill(n, c) { if (n.getAttribute('fill') !== c) n.setAttribute('fill', c); }

  var W = 1, H = 1;
  function render(t, amb) {
    // Camera.
    var c = keyed(cam, t), w = c[2], h = w * 9 / 16;
    svg.setAttribute('viewBox', (c[0] - w / 2).toFixed(1) + ' ' + (c[1] - h / 2).toFixed(1) + ' ' + w.toFixed(1) + ' ' + h.toFixed(1));

    setOpacity(title, Math.max(1 - prog(t, 3.0, 3.5), prog(t, 26.4, 27.2)));
    setOpacity(phase, 1 - prog(t, 3.0, 3.6));

    // Callouts.
    setOpacity(CALL.dev, on(t, 3.1, 4.3));
    setOpacity(CALL.pr, on(t, 4.0, 6.2));
    setOpacity(CALL.ci, on(t, 6.4, 9.5));
    setOpacity(CALL.gate, on(t, 9.8, 12.1) + on(t, 14.2, 15.3));
    setOpacity(CALL.gateFail, on(t, 12.2, 14.4));
    setOpacity(CALL.staging, on(t, 16.4, 19.6));
    setOpacity(CALL.smokeFail, on(t, 19.6, 22.2));
    setOpacity(CALL.smoke, on(t, 22.4, 23.9));
    setOpacity(CALL.prod, on(t, 23.9, 26.2));

    // Pull request button glows while the package is there.
    setOpacity(prButton.firstChild, 0.25 + 0.75 * on(t, 4.4, 6.0) * (0.75 + 0.25 * Math.sin(amb * 6)));

    // CI: GitHub Actions lights the checks one by one.
    ciLeds.forEach(function (n, k) { fill(n, t >= 7.1 + k * 0.45 && t < 26.6 ? GREEN : LED_OFF); });
    setOpacity(ciScreen, 0.55 + 0.45 * on(t, 6.3, 9.6));

    // Quality gate: eight checks light up; one fails, is fixed, and then the gate opens.
    var lit = 0;
    gateLeds.forEach(function (n, k) {
      var tOn = 10.2 + k * 0.22;
      var colour = LED_OFF;
      if (t >= tOn && t < 26.6) colour = GREEN;
      if (k === 2 && t >= 12.1 && t < 13.9) colour = RED;
      fill(n, colour);
      if (colour === GREEN) lit++;
    });
    gateCount.textContent = lit + '/8';
    fill(gateCount, lit === 8 ? GREEN : '#7a828c');
    gateWheel.setAttribute('transform', 'rotate(' + (prog(t, 14.3, 15.0) * 300 + prog(t, 26.6, 27.4) * -300).toFixed(1) + ')');
    setArm(prog(t, 14.6, 15.1) * (1 - prog(t, 16.2, 16.8)));

    // Failure path 1: back to the pull request.
    var fa = prog(t, 12.3, 13.0);
    setOpacity(arcGate.g, on(t, 12.3, 14.2, 0.2));
    arcGate.base.setAttribute('stroke-dashoffset', (1 - fa).toFixed(3));
    arcGate.dash.setAttribute('stroke-dashoffset', (-amb * 30).toFixed(1));

    // Staging: deploy, live, rollback, last good release.
    var deploy = prog(t, 16.7, 17.6);
    var status = 'waiting', col = '#9aa3ad', bar = deploy, screen = '#111316', rb = 0;
    if (t >= 16.7) { status = 'deploying'; col = GOLD; }
    if (t >= 17.6) { status = 'live'; col = GREEN; }
    if (t >= 20.5 && t < 21.9) { status = 'rolling back'; col = RED; screen = '#2a1114'; bar = 1 - prog(t, 20.5, 21.6); rb = 1; }
    if (t >= 21.9) { status = 'last good release'; col = GREEN; bar = 1; }
    if (t >= 26.6) { status = 'live'; col = GREEN; }
    setStaging(status, col, bar, screen, rb);
    stIcon.firstChild.setAttribute('transform', 'rotate(' + (-amb * 300 % 360).toFixed(1) + ')');

    // Smoke tests: chimney puffs while testing; fail, roll back, pass.
    setPuffs(on(t, 18.4, 19.6, 0.2) + on(t, 22.0, 22.9, 0.2), amb);
    smokeBars.forEach(function (n, k) {
      var colour = '#9c9a94';
      if (t >= 18.6 + k * 0.3) colour = GREEN;
      if (t >= 19.4 && t < 22.0) colour = k === 1 ? RED : '#9c9a94';
      if (t >= 22.1 + k * 0.25) colour = GREEN;
      if (t >= 26.6) colour = '#9c9a94';
      fill(n, colour);
    });
    setOpacity(smokeTick, on(t, 22.8, 26.4, 0.25));
    var fs = prog(t, 19.8, 20.5);
    setOpacity(arcSmoke.g, on(t, 19.8, 21.9, 0.2));
    arcSmoke.base.setAttribute('stroke-dashoffset', (1 - fs).toFixed(3));
    arcSmoke.dash.setAttribute('stroke-dashoffset', (-amb * 30).toFixed(1));

    // Production: approved stamp, the valve turns, the lock opens.
    setProd(prog(t, 24.9, 25.2), 1 - prog(t, 26.3, 26.7), prog(t, 25.1, 25.7) * 360, prog(t, 25.5, 25.8) * (1 - prog(t, 26.8, 27.2)));

    // Main package on the belt.
    var s = keyed(pkgPath, t)[0];
    var visible = t >= 3.2 && t < 26.5 && !(t >= 12.55 && t < 13.85) && !(t >= 19.9 && t < 21.95);
    var pop = prog(t, 3.2, 3.5);
    if (t >= 13.85 && t < 14.6) { s = 12 + 3 * prog(t, 13.85, 14.5); }
    if (t >= 21.95 && t < 22.6) { s = 24 + 3 * prog(t, 21.95, 22.55); }
    var p = along(s), q = iso(p[0], p[1], BELT_Z);
    orderBarrier(p);
    setOpacity(hatch, 0); pkgWrap.removeAttribute('clip-path');   // the hatch belongs to the idle loop
    mainPkg.g.setAttribute('transform', 'translate(' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ') scale(' + (t < 3.5 ? pop : 1).toFixed(3) + ')');
    setOpacity(mainPkg.g, visible ? 1 : 0);
    setOpacity(mainPkg.halo, 0.6 + 0.4 * Math.sin(amb * 4));
    setOpacity(mainPkg.tint, on(t, 12.0, 12.6, 0.2) + on(t, 19.4, 20.0, 0.2));

    // Ghost package: a failed change travels back along the red path.
    var g = 0, gp = null;
    if (t >= 12.55 && t < 13.85) { g = 1; gp = arcPoint(arcGate, prog(t, 12.55, 13.6)); }
    if (t >= 19.9 && t < 21.0) { g = 1 - prog(t, 20.6, 21.0); gp = arcPoint(arcSmoke, prog(t, 19.9, 20.7)); }
    setGhost(g, gp);

    // The crew works only in the idle loop.
    setOpacity(gCrew, 0);

    // Rocket launch at the end.
    setOpacity(rocket, 1);
    var lift = prog(t, 26.7, 28.9);
    var shake = t > 26.5 && t < 27.0 ? Math.sin(amb * 80) * 1.2 : 0;
    rocket.setAttribute('transform', 'translate(' + shake.toFixed(2) + ' ' + (-lift * 620).toFixed(1) + ')');
    setOpacity(flame, t > 26.55 && t < 29.6 ? 0.75 + 0.25 * Math.sin(amb * 40) : 0);
    flame.setAttribute('transform', 'scale(1 ' + (1 + 0.35 * Math.sin(amb * 31)).toFixed(3) + ')');
    rocketPuffs.forEach(function (n, k) {
      var base = n.base || (n.base = [Number(n.getAttribute('cx')), Number(n.getAttribute('cy'))]);
      var ph = clamp((t - 26.6 - k * 0.12) / 1.8, 0, 1);
      var dir = k % 2 ? 1 : -1;
      n.setAttribute('cx', (base[0] + dir * ph * (50 + k * 12)).toFixed(1));
      n.setAttribute('cy', (base[1] - ph * 26).toFixed(1));
      n.setAttribute('r', (12 + ph * 30).toFixed(1));
      setOpacity(n, ph > 0 && ph < 1 ? (1 - ph) * 0.95 : 0);
    });

    // Ambient motion: belt slats, rollers, CI gear (faster while CI runs).
    var speed = 1.1;
    slats.forEach(function (sg) {
      var len = sg.horiz ? sg.w : sg.d, gap = 0.6;
      sg.lines.forEach(function (ln, k) {
        var pos = ((k * gap + amb * speed) % (sg.lines.length * gap));
        if (pos > len - 0.05) { ln.setAttribute('points', ''); return; }
        var a, b;
        if (sg.horiz) { a = [sg.x0 + pos, sg.y0 + 0.08, BELT_Z]; b = [sg.x0 + pos, sg.y0 + sg.d - 0.08, BELT_Z]; }
        else { var y = sg.y0 + sg.d - pos; a = [sg.x0 + 0.08, y, BELT_Z]; b = [sg.x0 + sg.w - 0.08, y, BELT_Z]; }
        ln.setAttribute('points', pts([a, b]));
      });
    });
    rollers.forEach(function (r) { r.setAttribute('transform', 'rotate(' + (amb * 120 % 360).toFixed(1) + ')'); });
    ciGear.setAttribute('transform', 'rotate(' + ((amb * 40 + prog(t, 6.3, 9.6) * 540) % 360).toFixed(1) + ')');

    // Captions with the current word highlighted.
    caption(t);
    scrub.value = Math.round(t * 10);
    timeOut.textContent = fmt(t) + ' / ' + fmt(DURATION);

    // At rest (before Play, and after the walkthrough ends) the stations run the idle loop.
    var resting = !playing && (t <= 0.05 || t >= DURATION - 0.05);
    if (resting && !wasResting) idleStart = amb;
    wasResting = resting;
    if (resting) {
      var age = amb - idleStart;
      idle(age, amb, t >= DURATION - 0.05 && !reduceMotion ? clamp(age / 0.8, 0, 1) : 1);
    }
  }

  // Drawing order at the quality gate. The barrier's post stands on the near side of the belt, so it covers the
  // package until the package has passed it; after that the package is nearer the viewer and is drawn over it.
  // In this projection a larger x + y is nearer the viewer; the post stands at (11.02, -4.8).
  var BARRIER_DEPTH = 11.02 - 4.8 + 0.35, barrierOnTop = null;
  function orderBarrier(pos) {
    var onTop = pos[0] + pos[1] < BARRIER_DEPTH;
    if (onTop === barrierOnTop) return;
    barrierOnTop = onTop;
    var bg = arm.parentNode;
    // Just above or just below the package, so the ghost and the rocket keep their own places.
    if (onTop) gFront.insertBefore(bg, pkgWrap.nextSibling); else gFront.insertBefore(bg, pkgWrap);
  }

  function arcPoint(a, p) { var L = a.path.getTotalLength(); return a.path.getPointAtLength(L * clamp(p, 0, 1)); }

  // ---------- station setters shared by the walkthrough and the idle loop ----------
  var barrierOpen = 0;   // last drawn opening of the barrier (0 shut, 1 up), read by the barrier operator
  function setArm(open) {
    barrierOpen = clamp(open, 0, 1);
    var pivot = [11.02, -4.8], ang = clamp(open, 0, 1) * Math.PI / 2 * 0.95;
    var a0 = iso(pivot[0], pivot[1], 1.2), a1 = iso(pivot[0], pivot[1] - 2.5 * Math.cos(ang), 1.2 + 2.5 * Math.sin(ang));
    [arm, arm.armDash].forEach(function (l) { l.setAttribute('x1', a0[0]); l.setAttribute('y1', a0[1]); l.setAttribute('x2', a1[0].toFixed(1)); l.setAttribute('y2', a1[1].toFixed(1)); });
  }
  function setStaging(status, col, bar, screen, rb) {
    if (stStatus.textContent !== status) stStatus.textContent = status;
    fill(stStatus, col); fill(stLine, col === '#9aa3ad' ? GOLD : col); fill(stScreen, screen);
    stLine.setAttribute('width', (2.0 * clamp(bar, 0, 1)).toFixed(3));
    setOpacity(stIcon, rb);
  }
  function setPuffs(testing, amb) {
    puffs.forEach(function (n, k) {
      var ph = ((amb * 0.9 + k / puffs.length) % 1);
      var base = n.base || (n.base = [Number(n.getAttribute('cx')), Number(n.getAttribute('cy'))]);
      n.setAttribute('cx', (base[0] + ph * 14).toFixed(1));
      n.setAttribute('cy', (base[1] - ph * 46).toFixed(1));
      n.setAttribute('r', (4 + ph * 9).toFixed(1));
      setOpacity(n, clamp(testing, 0, 1) * (1 - ph) * 0.95);
    });
  }
  // approve: stamp grows in (0 to 1); keep: stamp stays (1 to 0); deg: valve turn; unlock: lock open (0 to 1).
  function setProd(approve, keep, deg, unlock) {
    setOpacity(stamp, approve * keep);
    stamp.firstChild.setAttribute('transform', stamp.firstChild.getAttribute('transform').replace(/ scale\([^)]*\)/, '') + ' scale(' + (1.6 - 0.6 * approve).toFixed(3) + ')');
    prodWheel.setAttribute('transform', 'rotate(' + deg.toFixed(1) + ')');
    prodLock.setAttribute('transform', 'translate(0 ' + (-0.25 * unlock).toFixed(3) + ')');
    fill(prodLock, 'none');
    prodLock.setAttribute('stroke', unlock > 0.5 ? GREEN : INK);
  }
  function setGhost(g, gp) {
    setOpacity(ghost.g, g);
    setOpacity(ghost.tint, 1);
    setOpacity(ghost.halo, 0);
    if (gp) ghost.g.setAttribute('transform', 'translate(' + gp.x.toFixed(1) + ' ' + (gp.y + 14).toFixed(1) + ') scale(0.8)');
  }

  // ---------- idle loop ----------
  // Three changes take turns on the belt, one at a time, then the loop repeats:
  //   1 'pass':  all checks green, the gate opens, staging goes live, smoke tests pass, production is approved.
  //   2 'gate':  CI runs, one of the eight required checks fails, the gate stays shut, the change returns to the pull request.
  //   3 'smoke': passes CI and the gate, deploys to staging, a smoke test fails, staging rolls back to the last good release.
  // Belt distances: pull request 3, CI corner 12, gate 15, staging 24, smoke tests 27, production 36, rocket pad 42.6.
  var ROUTE = [[1.0, 0], [2.3, 3], [3.0, 3], [5.5, 12], [7.6, 12], [8.4, 15]];
  var IDLE = [
    { kind: 'pass', len: 23, path: ROUTE.concat([[10.9, 15], [12.8, 24], [14.2, 24], [15.0, 27], [16.6, 27], [18.6, 36], [19.8, 36], [20.8, 42.6]]) },
    { kind: 'gate', len: 14, path: ROUTE },
    { kind: 'smoke', len: 21, path: ROUTE.concat([[10.9, 15], [12.8, 24], [14.2, 24], [15.0, 27]]) }
  ];
  var IDLE_CYCLE = IDLE.reduce(function (a, r) { return a + r.len; }, 0);
  var idleStart = 0, wasResting = false;

  function idle(age, amb, fadeIn) {
    var u = age % IDLE_CYCLE, run = IDLE[0];
    for (var i = 0; i < IDLE.length; i++) { run = IDLE[i]; if (u < run.len || i === IDLE.length - 1) break; u -= run.len; }
    var kind = run.kind, gf = kind === 'gate', sf = kind === 'smoke', ok = kind === 'pass';
    var through = !gf;              // gets past the quality gate
    var live = u < run.len - 1.0;   // the stations reset during the last second

    // Scene at rest: rocket on its pad (fades back in after a launch), phase labels shown.
    setOpacity(rocket, fadeIn);
    rocket.setAttribute('transform', 'translate(0 0)');
    setOpacity(flame, 0);
    setOpacity(phase, fadeIn);
    setOpacity(gCrew, fadeIn);
    animateCrew(amb);

    // Pull request: the button glows when a change arrives, and again when a failed one comes back.
    var glow = Math.max(on(u, 1.8, 3.2), gf ? on(u, 11.6, 13.0) : 0);
    setOpacity(prButton.firstChild, 0.25 + 0.75 * glow * (0.75 + 0.25 * Math.sin(amb * 6)));

    // CI: every change passes BUILD, LINT, TESTS, CODEQL and OWASP.
    ciLeds.forEach(function (n, k) { fill(n, live && u >= 5.6 + k * 0.35 ? GREEN : LED_OFF); });
    setOpacity(ciScreen, 0.55 + 0.45 * on(u, 3.0, 7.6));
    ciGear.setAttribute('transform', 'rotate(' + ((amb * 40 + prog(u, 3.0, 7.4) * 540) % 360).toFixed(1) + ')');

    // Quality gate: eight checks light up; for change 2 the E2E check fails and the gate stays shut.
    var lit = 0;
    gateLeds.forEach(function (n, k) {
      var c = LED_OFF;
      if (live && u >= 8.5 + k * 0.2) c = gf && k === 2 ? RED : GREEN;
      fill(n, c);
      if (c === GREEN) lit++;
    });
    gateCount.textContent = lit + '/8';
    fill(gateCount, lit === 8 ? GREEN : gf && live && u >= 8.9 ? RED : '#7a828c');
    gateWheel.setAttribute('transform', 'rotate(' + (through ? (prog(u, 10.1, 10.7) - prog(u, 12.2, 12.8)) * 300 : 0).toFixed(1) + ')');
    setArm(through ? prog(u, 10.5, 10.9) * (1 - prog(u, 12.2, 12.7)) : 0);
    setOpacity(arcGate.g, gf ? on(u, 10.3, 12.4, 0.2) : 0);
    arcGate.base.setAttribute('stroke-dashoffset', (1 - (gf ? prog(u, 10.3, 10.9) : 0)).toFixed(3));
    setOpacity(CALL.gateFail, gf ? on(u, 9.2, 12.6) : 0);

    // Staging: deploys and goes live; for change 3 it rolls back to the last good release.
    var status = 'waiting', col = '#9aa3ad', bar = 0, screen = '#111316', rb = 0;
    if (through && live && u >= 12.8) { status = 'deploying'; col = GOLD; bar = prog(u, 12.8, 14.0); }
    if (through && live && u >= 14.0) { status = 'live'; col = GREEN; bar = 1; }
    if (sf && u >= 16.9 && u < 18.3) { status = 'rolling back'; col = RED; screen = '#2a1114'; bar = 1 - prog(u, 16.9, 18.1); rb = 1; }
    if (sf && u >= 18.3 && live) { status = 'last good release'; col = GREEN; bar = 1; }
    setStaging(status, col, bar, screen, rb);

    // Smoke tests: pass for change 1; for change 3 the second check fails.
    setPuffs(ok ? on(u, 15.0, 16.4, 0.2) : sf ? on(u, 15.0, 16.0, 0.2) : 0, amb);
    smokeBars.forEach(function (n, k) {
      var c = '#9c9a94';
      if (ok && live && u >= 15.2 + k * 0.3) c = GREEN;
      if (sf && live && k === 0 && u >= 15.2) c = GREEN;
      if (sf && live && k === 1 && u >= 15.6) c = RED;
      fill(n, c);
    });
    setOpacity(smokeTick, ok ? on(u, 16.4, 19.6, 0.25) : 0);
    setOpacity(arcSmoke.g, sf ? on(u, 16.1, 18.4, 0.2) : 0);
    arcSmoke.base.setAttribute('stroke-dashoffset', (1 - (sf ? prog(u, 16.1, 16.8) : 0)).toFixed(3));
    setOpacity(CALL.smokeFail, sf ? on(u, 15.8, 19.2) : 0);

    // Production: only change 1 gets here; it is approved, the valve turns and the lock opens.
    setProd(ok ? prog(u, 18.8, 19.1) : 0, 1 - prog(u, 20.6, 21.0), ok ? prog(u, 19.0, 19.6) * 360 : 0, ok ? prog(u, 19.4, 19.7) * (1 - prog(u, 21.0, 21.4)) : 0);

    // The change on the belt.
    var s = keyed(run.path, u)[0];
    var hideAt = gf ? 10.6 : sf ? 16.3 : 99;
    var vis = u >= 0.4 && u < hideAt ? 1 : 0;
    if (ok) vis *= 1 - prog(u, 20.4, 20.9);
    // Out of the tunnel: the hatch opens, the change rises through it, the hatch closes behind it, then it rolls away.
    var hatchOpenBy = prog(u, 0.1, 0.4) * (1 - prog(u, 1.1, 1.4));
    setOpacity(hatch, hatchOpenBy > 0.01 ? 1 : 0);
    hatchOpen.setAttribute('transform', 'scale(' + Math.max(0.001, hatchOpenBy).toFixed(3) + ')');
    var rise = prog(u, 0.4, 1.0), zoff = -1.05 * (1 - rise);
    if (u < 1.0) pkgWrap.setAttribute('clip-path', 'url(#bs-hatch-clip)'); else pkgWrap.removeAttribute('clip-path');
    var w = along(s), q = iso(w[0], w[1], BELT_Z + zoff);
    orderBarrier(w);
    mainPkg.g.setAttribute('transform', 'translate(' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ')');
    setOpacity(mainPkg.g, vis);
    setOpacity(mainPkg.tint, gf ? on(u, 8.9, 10.8, 0.2) : sf ? on(u, 15.6, 16.5, 0.2) : 0);

    // A failed change travels back along its red path.
    var g = 0, gp = null;
    if (gf && u >= 10.6 && u < 12.1) { g = 1 - prog(u, 11.8, 12.1); gp = arcPoint(arcGate, prog(u, 10.6, 11.9)); }
    if (sf && u >= 16.3 && u < 17.5) { g = 1 - prog(u, 17.1, 17.5); gp = arcPoint(arcSmoke, prog(u, 16.3, 17.1)); }
    setGhost(g, gp);
  }

  // ---------- captions ----------
  var capBox = fig.querySelector('.belt-caption');
  var liveBox = fig.querySelector('.belt-live');
  var capIdx = -1, capWords = [];
  function caption(t) {
    var idx = -1;
    for (var i = 0; i < CAPTIONS.length; i++) if (t >= CAPTIONS[i][0] && t < CAPTIONS[i][1]) { idx = i; break; }
    if (idx !== capIdx) {
      capIdx = idx;
      capBox.textContent = '';
      capWords = [];
      if (idx >= 0) {
        CAPTIONS[idx][2].split(' ').forEach(function (w, k) {
          if (k) capBox.appendChild(document.createTextNode(' '));
          var s = document.createElement('span'); s.textContent = w; capBox.appendChild(s); capWords.push(s);
        });
        if (playing) liveBox.textContent = CAPTIONS[idx][2];
      }
      capBox.hidden = idx < 0;
    }
    if (idx >= 0) {
      var c = CAPTIONS[idx], k = Math.min(capWords.length - 1, Math.floor((t - c[0]) / (c[1] - c[0]) * capWords.length));
      capWords.forEach(function (s, j) { s.className = j === k ? 'on' : ''; });
    }
  }

  // ---------- controls and clock ----------
  var playBtn = fig.querySelector('[data-belt="play"]');
  var replayBtn = fig.querySelector('[data-belt="replay"]');
  var scrub = fig.querySelector('[data-belt="scrub"]');
  var timeOut = fig.querySelector('.belt-time');
  function fmt(t) { var s = Math.floor(t); return '0:' + (s < 10 ? '0' : '') + s; }

  var t = 0, amb = 0, playing = false, visible = false;

  // ---------- GSAP clock ----------
  // One 30-second GSAP timeline is the walkthrough clock: Play, Pause, Replay and the slider drive it, and
  // render(t) draws whatever time it is at. gsap.ticker drives the ambient motion (belts, rollers, gear, idle loop).
  // GSAP is the page's only animation engine (the hero network and the report mock run on the same ticker).
  var gsap = window.gsap;
  if (!gsap) { render(0, 0); fig.classList.add('is-ready'); fig.querySelector('.belt-controls').hidden = true; return; } // GSAP failed to load: show the still scene
  var clockProxy = { t: 0 };
  var master = gsap.timeline({ paused: true, onComplete: function () { t = DURATION; render(t, amb); setPlaying(false); } });
  master.to(clockProxy, { t: DURATION, duration: DURATION, ease: 'none', onUpdate: function () { t = clockProxy.t; } }, 0);

  // The six pipeline steps listed under the scene, and when the walkthrough reaches each one (seconds).
  var STEP_TIMES = [3.2, 6.0, 9.5, 15.25, 18.6, 23.75], STEP_END = 26.5;
  STEP_TIMES.forEach(function (s, i) { master.addLabel('step' + (i + 1), s); });
  var stepItems = Array.prototype.slice.call(document.querySelectorAll('.steps .step'));
  var currentStep = -1;
  function markStep() {
    var k = -1;
    if (t > 0 && t < STEP_END) for (var i = 0; i < STEP_TIMES.length; i++) if (t >= STEP_TIMES[i]) k = i;
    if (k === currentStep) return;
    currentStep = k;
    stepItems.forEach(function (li, i) { li.classList.toggle('is-current', i === k); });
  }
  // Each step gets a small "Watch" button that plays the walkthrough from that step.
  stepItems.forEach(function (li, i) {
    if (i >= STEP_TIMES.length) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'step-watch';
    b.setAttribute('aria-label', 'Watch step ' + (i + 1) + ' in the walkthrough');
    b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg><span>Watch</span>';
    b.addEventListener('click', function () {
      master.seek('step' + (i + 1)); t = clockProxy.t; capIdx = -1; seekAudio(t);
      setPlaying(true);
      fig.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });
    li.appendChild(b);
  });

  // ---------- sound ----------
  // The Flash video's own audio track (voice-over and music), timed 1:1 with the walkthrough.
  // It plays only while the walkthrough plays (never at rest). While it plays, the sound is the clock:
  // the animation speeds up or slows down slightly to follow it, and the audio is never seeked during
  // playback (seeking it every time the two drifted apart is what made it stutter). It is seeked only
  // when it starts, and on Replay or the slider.
  var soundBtn = fig.querySelector('[data-belt="sound"]');
  var audio = window.Audio ? new Audio() : null;
  var soundOn = true;
  if (audio) { audio.preload = 'none'; audio.src = 'audio/pipeline-walkthrough.m4a'; }
  function syncAudio() {
    if (!audio) return;
    var want = soundOn && playing && visible && !document.hidden;
    if (!want) { if (!audio.paused) audio.pause(); return; }
    if (audio.paused) {
      if (Math.abs(audio.currentTime - t) > 0.05) { try { audio.currentTime = t; } catch (e) { /* not loaded yet */ } }
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    }
  }
  // True while the sound is actually playing and can lead the animation.
  function audioLeads() { return audio && soundOn && !audio.paused && !audio.seeking && audio.readyState >= 3; }
  function seekAudio(to) { if (audio && Math.abs(audio.currentTime - to) > 0.05) { try { audio.currentTime = to; } catch (e) { /* not loaded yet */ } } }
  if (soundBtn) {
    if (!audio) soundBtn.hidden = true;
    soundBtn.addEventListener('click', function () {
      soundOn = !soundOn;
      soundBtn.setAttribute('aria-pressed', String(soundOn));
      soundBtn.querySelector('.belt-btn-label').textContent = soundOn ? 'Sound on' : 'Sound off';
      fig.classList.toggle('is-muted', !soundOn);
      syncAudio();
    });
  }

  function setPlaying(v) {
    playing = v;
    playBtn.setAttribute('aria-pressed', String(v));
    playBtn.querySelector('.belt-btn-label').textContent = v ? 'Pause' : (t >= DURATION ? 'Play again' : 'Play');
    fig.classList.toggle('is-playing', v);
    if (v) { capIdx = -1; } else { master.pause(); render(t, amb); } // on stop, draw the rest state now (reduced motion has no next tick)
    syncAudio();
    loop();
  }
  playBtn.addEventListener('click', function () {
    if (!playing && t >= DURATION) { master.time(0); t = 0; }
    setPlaying(!playing);
  });
  replayBtn.addEventListener('click', function () { master.time(0); t = 0; capIdx = -1; seekAudio(0); setPlaying(true); });
  scrub.addEventListener('input', function () { master.time(Number(scrub.value) / 10); t = clockProxy.t; render(t, amb); markStep(); seekAudio(t); });
  svg.addEventListener('click', function () { playBtn.click(); });

  function wanted() { return visible && !document.hidden && (playing || !reduceMotion); }
  function tick(time, deltaTime) {
    var dt = Math.min(0.1, deltaTime / 1000);
    if (!reduceMotion || playing) amb += dt;
    if (playing) {
      if (audioLeads()) {
        // Follow the sound smoothly: up to half again as fast or half as slow; jump only if far apart.
        var diff = audio.currentTime - master.time();
        if (Math.abs(diff) > 1) master.time(audio.currentTime);
        else master.timeScale(1 + clamp(diff * 2, -0.5, 0.5));
      } else {
        master.timeScale(1);
      }
    }
    render(t, amb);
    markStep();
  }
  // Runs the ticker only while there is something to show, and holds the timeline while the scene is off screen.
  var ticking = false;
  function loop() {
    var want = wanted();
    if (want && !ticking) { gsap.ticker.add(tick); ticking = true; }
    if (!want && ticking) { gsap.ticker.remove(tick); ticking = false; }
    if (playing) { if (visible && !document.hidden) master.play(); else master.pause(); }
  }
  // Scrolled away or tab hidden: the walkthrough holds still, so the sound pauses with it.
  document.addEventListener('visibilitychange', function () { syncAudio(); loop(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      // Fetch the sound (372 KB) once the scene is on screen, so Play starts without a wait.
      if (visible && audio && audio.preload === 'none') { audio.preload = 'auto'; audio.load(); }
      syncAudio();
      loop();
    }, { threshold: 0.15 }).observe(fig);
  } else { visible = true; }

  scrub.max = DURATION * 10;
  render(0, 0);
  fig.classList.add('is-ready');
  loop();
})();
