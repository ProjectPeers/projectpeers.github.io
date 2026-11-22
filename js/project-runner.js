// "Our project" as a CI test run that loops. The page already shows the finished run (every goal PASS, the meter at
// 100%), so it reads the same without JavaScript or with reduced motion. With motion, the run starts the first time
// the console scrolls into view and then loops, all on GSAP:
//   run:    each goal shows a spinner (0.4 to 0.75 s, a little different every round, like a real CI run), then a green
//           checkmark, and the meter moves on by that goal's share (8, 19, 13, 17, 15, 11 and 17 per cent), counting up;
//   finish: every checkmark turns into a PASS badge in turn, the meter settles solid green at 100%;
//   hold:   the result stays for 3.5 s;
//   rewind: the PASS badges fade back to empty rings from the bottom up while the meter drains to 0%; then it runs again.
// Everything lives in one parent timeline, which pauses while the console is off screen or the tab is hidden and
// resumes from the same moment.
//
// On phones the meter is a vertical rail through the check column instead of the bar at the bottom (css: .run-rail).
// The rail runs from the top of the list to the last check, and at each goal's mark the fill reaches that goal's
// check, so it moves down the column with the run. While the run plays, the percentage rides beside the glowing
// dot at the end of the fill (.run-vlabel); at rest it sits in the panel header (.run-vpct), green at 100%.
// One value (shown.v, 0 to 100) drives both the bar and the rail.
(function () {
  'use strict';

  var runner = document.querySelector('.runner');
  var gsap = window.gsap;
  if (!runner || !gsap) return;

  var passes = Array.prototype.slice.call(runner.querySelectorAll('.run-pass'));
  var fill = runner.querySelector('.run-fill');
  var stripes = runner.querySelector('.run-stripes');
  var head = runner.querySelector('.run-head');
  var pct = runner.querySelector('.run-pct');
  var summary = runner.querySelector('.run-summary');
  if (!passes.length || !fill || !pct) return;

  // Each goal's share of the run; they add up to 100.
  var SHARES = [8, 19, 13, 17, 15, 11, 17].slice(0, passes.length);
  var sum = SHARES.reduce(function (a, b) { return a + b; }, 0);
  var marks = []; SHARES.reduce(function (acc, v) { acc += v * 100 / sum; marks.push(acc); return acc; }, 0);

  // The phone rail: added to the goals column, measured from layout (offsets, so reveal transforms don't skew it).
  var list = passes[0].closest('.run-list');
  var col = list.parentNode;
  col.classList.add('run-goals');
  var rail = document.createElement('span');
  rail.className = 'run-rail';
  rail.setAttribute('aria-hidden', 'true');
  rail.innerHTML = '<span class="run-vfill"></span><span class="run-vhead"></span><span class="run-vlabel"></span>';
  col.appendChild(rail);
  var vfill = rail.querySelector('.run-vfill'), vhead = rail.querySelector('.run-vhead'), vlabel = rail.querySelector('.run-vlabel');
  var vpct = document.createElement('span');
  vpct.className = 'run-vpct';
  vpct.setAttribute('aria-hidden', 'true');
  var title = col.querySelector('h3');
  if (title) title.appendChild(vpct);
  runner.classList.add('has-rail');

  var stops = null;   // rail lengths in px: [0, centre of check 1, ..., centre of the last check]
  function measure() {
    if (!rail.offsetParent) { stops = null; return; }   // the rail is hidden above phone width
    var top = list.offsetTop;
    stops = [0].concat(passes.map(function (b) { return b.offsetTop + b.offsetHeight / 2 - top; }));
    rail.style.top = top + 'px';
    rail.style.left = (passes[0].offsetLeft + passes[0].offsetWidth / 2) + 'px';
    rail.style.height = stops[stops.length - 1] + 'px';
  }
  function railAt(v) {
    if (!stops) return 0;
    var prev = 0;
    for (var i = 0; i < marks.length; i++) {
      if (v <= marks[i] + 1e-6) {
        var f = (v - prev) / ((marks[i] - prev) || 1);
        return stops[i] + Math.max(0, f) * (stops[i + 1] - stops[i]);
      }
      prev = marks[i];
    }
    return stops[stops.length - 1];
  }

  var shown = { v: 100 };
  function render() {
    var v = shown.v, label = Math.round(v) + '%', y = railAt(v);
    fill.style.width = v.toFixed(2) + '%';
    if (head) head.style.left = v.toFixed(2) + '%';
    pct.textContent = label;
    vpct.textContent = label;
    vfill.style.height = y.toFixed(1) + 'px';
    vhead.style.top = y.toFixed(1) + 'px';
    vlabel.style.top = y.toFixed(1) + 'px';
    vlabel.textContent = label;
  }
  var queued = false;
  function relayout() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; measure(); render(); });
  }
  measure(); render();
  window.addEventListener('resize', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

  runner.classList.add('is-done');   // the finished look, until the run starts
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var RING = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#2d4461" stroke-width="2" stroke-dasharray="2.5 3"/></svg>';
  var SPIN = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#2d4461" stroke-width="2.4"/><path d="M10 2.5 A7.5 7.5 0 0 1 17.5 10" fill="none" stroke="#fdbb30" stroke-width="2.4" stroke-linecap="round"/></svg>';
  var CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="9" fill="#3ddc84"/><path d="M5.8 10.4 L8.7 13.2 L14.4 7.2" fill="none" stroke="#08121f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var SUMMARY_DONE = '<b>All goals passed</b> &middot; out of scope skipped';

  function icon(b, html) { b.classList.add('is-icon'); b.innerHTML = html; return b.querySelector('svg'); }
  function passBadge(b) { b.classList.remove('is-icon'); b.textContent = 'PASS'; }
  var heads = [stripes, head, vhead, vlabel].filter(Boolean);   // shown while the run plays, faded once it is done

  // One parent timeline holds everything (runs, spinners, holds), so pausing it pauses the whole section.
  var root = gsap.timeline({ paused: true });
  function addNow(anim) { root.add(anim, root.time()); return anim; }
  addNow(gsap.to(stripes, { backgroundPosition: '-340px 0', duration: 10, ease: 'none', repeat: -1 }));   // stripes drift

  function spin(svg) { return addNow(gsap.to(svg, { rotation: 360, transformOrigin: '50% 50%', duration: 0.6, ease: 'none', repeat: -1 })); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // rewind: PASS badges back to rings from the bottom up, the meter drains to 0%
  function rewind(tl, label) {
    tl.call(function () {
      runner.classList.remove('is-done');
      if (summary) summary.textContent = label;
      gsap.to(heads, { opacity: 1, duration: 0.3 });
    }, null, 0);
    passes.slice().reverse().forEach(function (b, k) {
      tl.call(function () { var s = icon(b, RING); gsap.from(s, { opacity: 0, scale: 0.6, duration: 0.25, transformOrigin: '50% 50%' }); }, null, 0.05 + k * 0.06);
    });
    tl.to(shown, { v: 0, duration: 0.9, ease: 'power2.inOut', onUpdate: render }, 0.05);
    return 1.1;
  }
  // run: spinner, then checkmark, goal by goal. The meter creeps forward the whole time: while a goal's
  // spinner turns (and in the short pause after its check) it travels steadily to that goal's mark,
  // so it never jumps.
  function run(tl, at) {
    passes.forEach(function (b, i) {
      var spinFor = rand(0.4, 0.75), gap = rand(0.16, 0.3), spinner = null, start = at;
      tl.call(function () { spinner = spin(icon(b, SPIN)); }, null, at);
      at += spinFor;
      tl.call(function () {
        if (spinner) spinner.kill();
        gsap.from(icon(b, CHECK), { scale: 0.4, opacity: 0, duration: 0.25, ease: 'back.out(2.2)', transformOrigin: '50% 50%' });
      }, null, at);
      var span = spinFor + gap, last = i === passes.length - 1, ease = last ? 'power1.out' : 'none';
      tl.to(shown, { v: marks[i], duration: span, ease: ease, onUpdate: render }, start);
      at += gap;
    });
    return at;
  }
  // finish: every check becomes PASS in turn; the meter settles solid green at 100%
  function finish(tl, at) {
    at += 0.25;
    passes.forEach(function (b, i) {
      tl.call(function () { passBadge(b); gsap.from(b, { scale: 0.7, opacity: 0, duration: 0.22, ease: 'back.out(2)' }); }, null, at + i * 0.07);
    });
    at += passes.length * 0.07 + 0.1;
    tl.call(function () {
      shown.v = 100; render();
      gsap.to(heads, { opacity: 0, duration: 0.3 });
      runner.classList.add('is-done');
      gsap.fromTo([fill, vfill], { boxShadow: '0 0 0px rgba(61,220,132,0)' }, { boxShadow: '0 0 22px rgba(61,220,132,.9)', duration: 0.3, yoyo: true, repeat: 1, clearProps: 'boxShadow' });
      if (summary) summary.innerHTML = SUMMARY_DONE;
    }, null, at);
    return at;
  }

  var HOLD = 3.5;
  function cycle(first) {
    var tl = gsap.timeline({ onComplete: function () { addNow(gsap.delayedCall(HOLD, function () { cycle(false); })); } });
    // the page starts on the finished result, so even the first run begins by winding it back smoothly
    var at = rewind(tl, first ? 'Running checks…' : 'Re-running checks…');
    at = run(tl, at);
    finish(tl, at);
    addNow(tl);
  }

  // Plays while on screen and the tab is visible; the first time it comes into view, the first run starts.
  var started = false, onScreen = false;
  function sync() {
    var want = onScreen && !document.hidden;
    if (want && !started) { started = true; cycle(true); }
    if (want) root.play(); else root.pause();
  }
  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; sync(); }, { threshold: 0.35 }).observe(runner);
  }
})();
