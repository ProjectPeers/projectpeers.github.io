// Hero artwork animation: the five peers take turns sending a review to their four teammates,
// and the score in the middle rolls to a new value (85 to 100) when the reviews arrive.
// Plain SVG and JavaScript. It holds still for visitors who ask for reduced motion, and pauses off screen.
(function () {
  'use strict';

  var svg = document.querySelector('.hero-art');
  if (!svg || !document.createElementNS) return;
  var fx = svg.querySelector('.hero-fx');
  var score = svg.querySelector('.hero-score');
  var rings = Array.prototype.slice.call(svg.querySelectorAll('.hero-peer'));
  if (!fx || !score || rings.length < 2) return;

  var NS = 'http://www.w3.org/2000/svg';
  var GOLD = '#fdbb30', NAVY = '#0b1b2e';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function rnd() { return 85 + Math.floor(Math.random() * 16); } // 85 to 100

  if (reduceMotion) { score.textContent = rnd(); return; }

  var peers = rings.map(function (r) { return [Number(r.getAttribute('cx')), Number(r.getAttribute('cy'))]; });

  // One trail and one review card per possible recipient (four at a time), plus a pulse ring per peer.
  var sends = [];
  for (var k = 0; k < peers.length - 1; k++) {
    var trail = el('line', { stroke: GOLD, 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: 0 }, fx);
    var card = el('g', { opacity: 0 }, fx);
    el('circle', { r: 13, fill: GOLD, 'fill-opacity': 0.18 }, card);
    el('rect', { x: -8, y: -6, width: 16, height: 12, rx: 2, fill: GOLD, stroke: NAVY, 'stroke-width': 1.2 }, card);
    el('path', { d: 'M-4.5 -1.5h9M-4.5 2h6', stroke: NAVY, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, card);
    sends.push({ trail: trail, card: card });
  }
  var pulses = peers.map(function (p) {
    return el('circle', { cx: p[0], cy: p[1], r: 22, fill: 'none', stroke: GOLD, 'stroke-width': 2, opacity: 0 }, fx);
  });

  // Trend arrow inside the score circle, to the right of the number (which moves left to make room):
  // green and pointing up when the score rises, red and pointing down when it falls.
  var GREEN = '#3ddc84', RED = '#ff5c5c';
  var scoreRing = svg.querySelector('.hero-score-ring');
  var arrowHolder = el('g', { transform: 'translate(227 200)', opacity: 0 }, svg);
  var arrow = el('path', { d: 'M0 -9 L7 -1 H2.6 V8.5 H-2.6 V-1 H-7 Z', fill: GREEN, 'stroke-linejoin': 'round' }, arrowHolder);

  // Timing of one round (seconds).
  var ROUND = 2.8, SEND_A = 0.3, SEND_B = 1.35, ROLL_A = 1.4, ROLL_B = 2.05, FLICK = 0.035;
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(p) { p = clamp(p); return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function span(t, a, b) { return clamp((t - a) / (b - a)); }

  var current = Number(score.textContent) || 94, target = current, round = -1, lastFlick = 0;

  function render(time) {
    var n = Math.floor(time / ROUND), t = time - n * ROUND;
    var from = n % peers.length;
    if (n !== round) {
      round = n; current = target;
      do { target = rnd(); } while (target === current); // always a rise or a fall
    }

    // The sender's ring brightens while it sends.
    rings.forEach(function (r, i) {
      var on = i === from ? Math.min(span(t, 0, 0.25), 1 - span(t, SEND_B, SEND_B + 0.4)) : 0;
      r.setAttribute('stroke-width', (3 + 2.5 * on).toFixed(2));
    });

    // Reviews travel to the other four peers along the lines.
    var p = ease(span(t, SEND_A, SEND_B));
    var j = 0;
    for (var i = 0; i < peers.length; i++) {
      if (i === from) continue;
      var a = peers[from], b = peers[i], s = sends[j++];
      // Start and stop at the edge of the rings, not their centres.
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
      var sx = a[0] + ux * 24, sy = a[1] + uy * 24, ex = b[0] - ux * 24, ey = b[1] - uy * 24;
      var x = sx + (ex - sx) * p, y = sy + (ey - sy) * p;
      var vis = t >= SEND_A && t < SEND_B + 0.05 ? Math.min(1, span(t, SEND_A, SEND_A + 0.12)) : 0;
      s.card.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      s.card.setAttribute('opacity', vis.toFixed(2));
      s.trail.setAttribute('x1', sx.toFixed(1)); s.trail.setAttribute('y1', sy.toFixed(1));
      s.trail.setAttribute('x2', x.toFixed(1)); s.trail.setAttribute('y2', y.toFixed(1));
      s.trail.setAttribute('opacity', (0.55 * (t < SEND_B ? vis : 1 - span(t, SEND_B, SEND_B + 0.5))).toFixed(2));
      // A ring ripples out from each peer as its review lands.
      var q = span(t, SEND_B, SEND_B + 0.7);
      pulses[i].setAttribute('r', (22 + 16 * q).toFixed(1));
      pulses[i].setAttribute('opacity', (q > 0 && q < 1 ? 0.8 * (1 - q) : 0).toFixed(2));
    }
    pulses[from].setAttribute('opacity', 0);

    // The score spins through random values, then settles on the new one.
    if (t >= ROLL_A && t < ROLL_B) {
      if (time - lastFlick > FLICK) { score.textContent = rnd(); lastFlick = time; }
    } else {
      score.textContent = t >= ROLL_B ? target : current;
    }
    var pop = t >= ROLL_B ? 1 - span(t, ROLL_B, ROLL_B + 0.35) : 0;

    // Trend: shown from the moment the score settles until the next spin starts (the change it shows is target - current
    // of the round that settled; before the spin of the next round, that is current against the round before it).
    var dir = 0, show = 0, age = 0;
    if (t >= ROLL_B) { dir = target > current ? 1 : -1; show = span(t, ROLL_B, ROLL_B + 0.2); age = t - ROLL_B; }
    else if (t < ROLL_A && n > 0) { dir = trend; show = 1 - span(t, ROLL_A - 0.2, ROLL_A); age = t + ROUND - ROLL_B; }
    if (t >= ROLL_B) trend = dir;
    var col = dir > 0 ? GREEN : dir < 0 ? RED : GOLD;
    score.setAttribute('fill', show > 0.5 ? col : GOLD);
    scoreRing.setAttribute('stroke', show > 0.5 ? col : GOLD);
    arrowHolder.setAttribute('opacity', show.toFixed(2));
    // The number shifts left while the arrow shows, and pops a little when it settles.
    var shift = (String(score.textContent).length > 2 ? -12 : -9) * ease(show);
    score.setAttribute('transform', 'translate(' + (200 + shift).toFixed(2) + ' 200) scale(' + (1 + 0.12 * pop).toFixed(3) + ') translate(-200 -200)');
    if (dir) {
      arrow.setAttribute('fill', col);
      // Slides in along its direction, then keeps nudging that way.
      var slide = (1 - ease(span(age, 0, 0.3))) * 4, bob = Math.abs(Math.sin(age * 5)) * 2;
      var dy = dir > 0 ? slide - bob : -slide + bob;
      arrow.setAttribute('transform', 'translate(0 ' + dy.toFixed(2) + ')' + (dir < 0 ? ' rotate(180)' : ''));
    }
  }
  var trend = 0;

  // Clock: GSAP's ticker (the page's one animation engine), running only while the hero is on screen and the tab is visible.
  var gsap = window.gsap;
  if (!gsap) { render(1.2); return; } // GSAP failed to load: a still frame
  var visible = true, ticking = false, clock = 0;
  function tick(time, deltaTime) { clock += Math.min(0.1, deltaTime / 1000); render(clock); }
  function loop() {
    var want = visible && !document.hidden;
    if (want && !ticking) { gsap.ticker.add(tick); ticking = true; }
    if (!want && ticking) { gsap.ticker.remove(tick); ticking = false; }
  }
  document.addEventListener('visibilitychange', loop);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; loop(); }).observe(svg);
  }
  render(0);
  loop();
})();
