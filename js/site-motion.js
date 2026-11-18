// Three small page effects, all on GSAP (the page's one animation engine) and its free SplitText and ScrambleText plugins.
// Their ideas come from React Bits (SplitText) and Motion Primitives (text scramble, border trail), rebuilt here
// without React:
//   1. The hero title: the PEERS letters rise in gold and settle to white; the subtitle un-blurs word by word. Once, on load.
//   2. The small section labels ("01 · About" ...) decode once, terminal-style, the first time each scrolls into view.
//   3. A thin gold light runs around the conveyor-belt panel's border while the walkthrough plays.
// Visitors who ask for reduced motion see everything still; without JavaScript the page is unchanged.
(function () {
  'use strict';

  var root = document.documentElement;
  var gsap = window.gsap;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ready() { root.classList.add('title-ready'); }
  if (!gsap || reduce) { ready(); return; }
  if (window.SplitText) gsap.registerPlugin(window.SplitText);
  if (window.ScrambleTextPlugin) gsap.registerPlugin(window.ScrambleTextPlugin);

  // 1. Hero title (SplitText). The title is hidden by CSS until this runs (with a 2-second safety in the head),
  //    so it never flashes in plain before animating.
  var h1 = document.getElementById('hero-title');
  var sub = document.querySelector('.hero-sub');
  if (window.SplitText && h1) {
    var letters = window.SplitText.create(h1, { type: 'chars', aria: 'auto' });
    var words = sub ? window.SplitText.create(sub, { type: 'words', aria: 'auto' }) : null;
    var tl = gsap.timeline({ delay: 0.15 });
    tl.from(letters.chars, { yPercent: 55, opacity: 0, color: '#fdbb30', duration: 0.9, ease: 'power3.out', stagger: 0.08 }, 0);
    tl.to(letters.chars, { color: '#f2f5f9', duration: 0.7, ease: 'power1.inOut', stagger: 0.08, clearProps: 'color' }, 0.45);
    if (words) tl.from(words.words, { opacity: 0, y: 6, filter: 'blur(8px)', duration: 0.8, ease: 'power2.out', stagger: 0.12, clearProps: 'filter' }, 0.35);
  }
  ready();

  // 2. Section labels (text scramble), once each.
  var kickers = Array.prototype.slice.call(document.querySelectorAll('.kicker'));
  if (window.ScrambleTextPlugin && kickers.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var text = e.target.textContent;
        gsap.to(e.target, { duration: 0.9, ease: 'none', scrambleText: { text: text, chars: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', speed: 0.6, revealDelay: 0.2 } });
      });
    }, { threshold: 1 });
    kickers.forEach(function (k) { io.observe(k); });
  }

  // 3. Border trail on the conveyor-belt panel while the walkthrough plays.
  var panel = document.querySelector('.belt-panel');
  var scene = document.querySelector('.belt-scene');
  if (panel && scene) {
    var NS = 'http://www.w3.org/2000/svg';
    var trail = document.createElementNS(NS, 'svg');
    trail.setAttribute('class', 'belt-trail'); trail.setAttribute('aria-hidden', 'true'); trail.setAttribute('focusable', 'false');
    var rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', '0.75'); rect.setAttribute('y', '0.75');
    rect.setAttribute('pathLength', '100');
    trail.appendChild(rect);
    panel.appendChild(trail);
    function fit() {   // the rectangle follows the panel's size and corner radius
      var w = panel.clientWidth, h = panel.clientHeight, r = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 0;
      rect.setAttribute('width', Math.max(0, w - 1.5)); rect.setAttribute('height', Math.max(0, h - 1.5));
      rect.setAttribute('rx', Math.max(0, r - 1)); rect.setAttribute('ry', Math.max(0, r - 1));
    }
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(panel); else window.addEventListener('resize', fit);
    var run = gsap.to(rect, { strokeDashoffset: -100, duration: 5, ease: 'none', repeat: -1, paused: true });
    var onScreen = true;
    function sync() {
      var playing = scene.classList.contains('is-playing');
      gsap.to(trail, { opacity: playing ? 1 : 0, duration: 0.3, overwrite: true });
      if (playing && onScreen && !document.hidden) run.play(); else run.pause();
    }
    new MutationObserver(sync).observe(scene, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; sync(); }).observe(panel);
  }
})();
