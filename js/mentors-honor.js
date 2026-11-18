/* Mentors: a quiet tribute when the section comes into view.
   - A gold laurel wreath grows leaf by leaf around each monogram, its stems drawing up from the bottom.
   - The monogram settles in, then its ring keeps a slow, soft glow (CSS, .is-honored).
   - A band of light sweeps across each card now and then.
   - The two quotes appear word by word, and each name below them opens out into place.
   GSAP + ScrollTrigger + SplitText (already on the page). Decorative only: the wreath and shine are
   aria-hidden, and with reduced motion the wreath is simply shown in full. */
(function () {
  'use strict';
  var section = document.querySelector('.section-mentors');
  if (!section) return;
  var marks = Array.prototype.slice.call(section.querySelectorAll('.mentor-mark'));
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function node(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function pt(r, deg) { var a = deg * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; }

  // Builds a laurel wreath: two branches rising from the bottom to near the top, leaves alternating out and in.
  function wreath(mark) {
    var svg = node('svg', { class: 'laurel', viewBox: '-64 -64 128 128', 'aria-hidden': 'true', focusable: 'false' });
    var R = 56;
    var branches = [
      { from: 118, to: 236, dir: 1 },    // left side, bottom to top
      { from: 62, to: -56, dir: -1 }     // right side, bottom to top
    ];
    var stems = [], leaves = [];
    branches.forEach(function (b) {
      var p0 = pt(R, b.from), p1 = pt(R, b.to);
      stems.push(node('path', {
        class: 'laurel-stem',
        d: 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 0 ' + (b.dir > 0 ? 1 : 0) + ' ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2)
      }, svg));
      var n = 11;
      for (var i = 0; i < n; i++) {
        var a = b.from + (b.to - b.from) * (i + 0.5) / n;
        var side = i % 2 ? 1 : -1;                       // alternate outside and inside the stem
        var p = pt(R + side * 1.2, a);
        var travel = a + b.dir * 90;                     // the stem's direction of growth here
        var size = 1 - i / (n * 2.2);                    // leaves get a little smaller toward the top
        var g = node('g', { transform: 'translate(' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + ') rotate(' + (travel + side * 38 * b.dir).toFixed(1) + ') scale(' + size.toFixed(2) + ')' }, svg);
        leaves.push({ el: node('path', { class: 'laurel-leaf', d: 'M0 0 Q6 -4.4 13 0 Q6 4.4 0 0Z' }, g), side: b.dir, i: i });
      }
    });
    var tip = pt(R, 90);
    node('circle', { class: 'laurel-knot', cx: tip[0].toFixed(2), cy: tip[1].toFixed(2), r: 2.6 }, svg);
    mark.appendChild(svg);
    return { stems: stems, leaves: leaves };
  }

  var built = marks.map(wreath);
  var cards = Array.prototype.slice.call(section.querySelectorAll('.mentor'));
  cards.forEach(function (c) {
    var s = document.createElement('span'); s.className = 'mentor-shine'; s.setAttribute('aria-hidden', 'true'); c.appendChild(s);
  });

  if (reduce || !window.gsap || !window.ScrollTrigger) {
    cards.forEach(function (c) { c.classList.add('is-honored'); });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // Hidden until the section arrives.
  built.forEach(function (w) {
    w.stems.forEach(function (s) { var len = s.getTotalLength(); gsap.set(s, { strokeDasharray: len, strokeDashoffset: len }); });
    gsap.set(w.leaves.map(function (l) { return l.el; }), { scale: 0, transformOrigin: '0px 0px', opacity: 0 });
  });
  // Wrap the monogram's letters ("GV", "YX") so they can settle in on their own.
  marks.forEach(function (m) {
    var t = document.createElement('span'); t.className = 'mentor-initials';
    t.textContent = m.firstChild.nodeValue.trim(); m.replaceChild(t, m.firstChild);
  });
  var initials = section.querySelectorAll('.mentor-initials');
  gsap.set(initials, { scale: 0.6, opacity: 0 });

  var quote = section.querySelector('.mentors-quote');
  var words = [], names = [];
  if (quote && window.SplitText) {
    Array.prototype.forEach.call(quote.querySelectorAll('blockquote p'), function (p) {
      words.push(new SplitText(p, { type: 'words', aria: 'auto' }).words);
    });
    names = Array.prototype.slice.call(quote.querySelectorAll('figcaption'));
    words.forEach(function (w) { gsap.set(w, { opacity: 0, y: 8 }); });
    gsap.set(names, { opacity: 0, letterSpacing: '.45em' });
  }

  var tl = gsap.timeline({ paused: true });
  built.forEach(function (w, k) {
    var at = k * 0.25;
    tl.to(initials[k], { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2)' }, at);
    tl.to(w.stems, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut' }, at + 0.15);
    // leaves on both sides open together, from the bottom up, following the stems
    for (var i = 0; i < 11; i++) {
      var pair = w.leaves.filter(function (l) { return l.i === i; }).map(function (l) { return l.el; });
      tl.to(pair, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.4)' }, at + 0.3 + i * 0.11);
    }
  });
  tl.add(function () { cards.forEach(function (c) { c.classList.add('is-honored'); }); }, 1.6);
  tl.fromTo(section.querySelectorAll('.mentor-shine'), { xPercent: -120 }, { xPercent: 260, duration: 1.4, ease: 'power2.inOut', stagger: 0.2 }, 1.7);

  ScrollTrigger.create({ trigger: section.querySelector('.mentors'), start: 'top 75%', once: true, onEnter: function () { tl.play(); } });

  // The quotes, word by word, when they arrive.
  if (words.length) {
    var qt = gsap.timeline({ paused: true });
    words.forEach(function (w, k) {
      qt.to(w, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.045 }, k * 1.1);
      qt.to(names[k], { opacity: 1, letterSpacing: '.14em', duration: 0.9, ease: 'power3.out' }, k * 1.1 + 0.6);
    });
    ScrollTrigger.create({ trigger: quote, start: 'top 82%', once: true, onEnter: function () { qt.play(); } });
  }

  // A light sweep across the cards every so often while the section is on screen.
  var sweep = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 6, delay: 6 });
  sweep.fromTo(section.querySelectorAll('.mentor-shine'), { xPercent: -120 }, { xPercent: 260, duration: 1.6, ease: 'power2.inOut', stagger: 0.25 });
  ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'bottom top',
    onToggle: function (self) { if (self.isActive && tl.progress() === 1) sweep.play(); else sweep.pause(); }
  });
  tl.eventCallback('onComplete', function () { sweep.play(); });
})();
