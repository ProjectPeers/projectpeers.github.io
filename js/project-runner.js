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

  runner.classList.add('is-done');   // the finished look, until the run starts
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var RING = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#2d4461" stroke-width="2" stroke-dasharray="2.5 3"/></svg>';
  var SPIN = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#2d4461" stroke-width="2.4"/><path d="M10 2.5 A7.5 7.5 0 0 1 17.5 10" fill="none" stroke="#fdbb30" stroke-width="2.4" stroke-linecap="round"/></svg>';
  var CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="9" fill="#3ddc84"/><path d="M5.8 10.4 L8.7 13.2 L14.4 7.2" fill="none" stroke="#08121f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var SUMMARY_DONE = '<b>All goals passed</b> &middot; out of scope skipped';

  function icon(b, html) { b.classList.add('is-icon'); b.innerHTML = html; return b.querySelector('svg'); }
  function passBadge(b) { b.classList.remove('is-icon'); b.textContent = 'PASS'; }
  var shown = { v: 100 };
  function showPct() { pct.textContent = Math.round(shown.v) + '%'; }

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
      gsap.to([stripes, head], { opacity: 1, duration: 0.3 });
    }, null, 0);
    passes.slice().reverse().forEach(function (b, k) {
      tl.call(function () { var s = icon(b, RING); gsap.from(s, { opacity: 0, scale: 0.6, duration: 0.25, transformOrigin: '50% 50%' }); }, null, 0.05 + k * 0.06);
    });
    tl.to(fill, { width: '0%', duration: 0.9, ease: 'power2.inOut' }, 0.05);
    tl.to(head, { left: '0%', duration: 0.9, ease: 'power2.inOut' }, 0.05);
    tl.to(shown, { v: 0, duration: 0.9, ease: 'power2.inOut', onUpdate: showPct }, 0.05);
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
      tl.to(fill, { width: marks[i].toFixed(2) + '%', duration: span, ease: ease }, start);
      tl.to(head, { left: marks[i].toFixed(2) + '%', duration: span, ease: ease }, start);
      tl.to(shown, { v: marks[i], duration: span, ease: ease, onUpdate: showPct }, start);
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
      shown.v = 100; showPct();
      gsap.to([stripes, head], { opacity: 0, duration: 0.3 });
      runner.classList.add('is-done');
      gsap.fromTo(fill, { boxShadow: '0 0 0px rgba(61,220,132,0)' }, { boxShadow: '0 0 22px rgba(61,220,132,.9)', duration: 0.3, yoyo: true, repeat: 1, clearProps: 'boxShadow' });
      if (summary) summary.innerHTML = SUMMARY_DONE;
    }, null, at);
    return at;
  }

  var HOLD = 3.5;
  function cycle(first) {
    var tl = gsap.timeline({ onComplete: function () { addNow(gsap.delayedCall(HOLD, function () { cycle(false); })); } });
    // the page starts on the finished result, so even the first run begins by winding it back smoothly
    gsap.set(head, { left: '100%' });
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
