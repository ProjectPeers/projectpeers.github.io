/* Scroll storytelling with GSAP ScrollTrigger (the same GSAP 3.15.1 as the rest of the site):
   1. the pipeline track fills as the reader scrolls, and each station lights once reached;
   2. section headings, intros and cards rise in once as they come into view;
   3. the belt panel eases up and zooms in gently as it scrolls into view.
   Reveals use CSS variables on the individual "translate" and "scale" properties (see .reveal-ready),
   so they never fight a card's own transform transition. Without JS, or with reduced motion,
   everything is simply shown. */
(function () {
  'use strict';
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  // 1. Pipeline track.
  var steps = document.querySelector('.steps');
  var stations = steps ? all('.steps .step') : [];
  if (steps && reduce) {
    stations.forEach(function (s) { s.classList.add('is-reached'); });
  } else if (steps) {
    steps.style.setProperty('--fill', 0);
    gsap.to(steps, {
      '--fill': 1, ease: 'none',
      scrollTrigger: { trigger: steps, start: 'top 70%', end: 'bottom 60%', scrub: 0.5 }
    });
    stations.forEach(function (s) {
      ScrollTrigger.create({
        trigger: s, start: 'top 68%',
        onEnter: function () { s.classList.add('is-reached'); },
        onLeaveBack: function () { s.classList.remove('is-reached'); }
      });
    });
  }
  if (reduce) return;

  // 3. Belt panel: eases up and zooms in as it arrives.
  var panel = document.querySelector('.belt-panel');
  if (panel) {
    panel.classList.add('reveal-ready');
    gsap.fromTo(panel, { '--rs': 0.92, '--ry': '48px', opacity: 0.35 }, {
      '--rs': 1, '--ry': '0px', opacity: 1, ease: 'power2.out',
      scrollTrigger: { trigger: panel, start: 'top 98%', end: 'top 40%', scrub: 0.6 }
    });
  }

  // 2. Reveals. Anything already on screen (or above it, after a jump link) shows at once.
  var targets = all([
    '.section h2', '.section .lead', '.about-grid > *', '.runner', '.steps .step', '.cards-team',
    '.mentor', '.mentors-quote', '.doc-tiles .card', '.section .note', '.footer-credit'
  ].join(','));
  var line = window.innerHeight * 0.88;
  var pending = targets.filter(function (el) { return el.getBoundingClientRect().top > line; });
  pending.forEach(function (el) {
    el.classList.add('reveal-ready');
    gsap.set(el, { '--ry': '28px', opacity: 0 });
  });
  ScrollTrigger.batch(pending, {
    start: 'top 88%', once: true,
    onEnter: function (batch) {
      gsap.to(batch, { '--ry': '0px', opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08, clearProps: 'opacity' });
    }
  });

  // Layout can shift once web content settles (fonts, the belt's first draw): measure again.
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
