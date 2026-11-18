// "Our project" as a CI test run. The page already shows the finished run (every goal PASS, every out-of-scope item
// SKIP), so it reads the same without JavaScript or with reduced motion. With motion, the first time the console
// scrolls into view the run plays once on GSAP: each goal shows RUNS and then turns PASS, the skipped items follow,
// and the progress bar fills. "Re-run" plays it again.
(function () {
  'use strict';

  var runner = document.querySelector('.runner');
  var gsap = window.gsap;
  if (!runner || !gsap) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var passes = Array.prototype.slice.call(runner.querySelectorAll('.run-pass'));
  var skips = Array.prototype.slice.call(runner.querySelectorAll('.run-skip'));
  var bar = runner.querySelector('.run-progress i');
  var summary = runner.querySelector('.run-summary');
  var rerun = runner.querySelector('.runner-rerun');
  var summaryDone = summary.innerHTML;

  function setBadge(b, state) {
    b.classList.remove('is-pending', 'is-queued');
    if (state === 'pending') { b.classList.add('is-pending'); b.textContent = 'RUNS'; }
    else if (state === 'queued') { b.classList.add('is-queued'); b.textContent = b.classList.contains('run-skip') ? 'SKIP' : 'PASS'; }
    else { b.textContent = b.classList.contains('run-skip') ? 'SKIP' : 'PASS'; }
  }

  var STEP = 0.32;
  var tl = gsap.timeline({ paused: true });
  tl.call(function () {
    passes.forEach(function (b) { setBadge(b, 'queued'); });
    skips.forEach(function (b) { setBadge(b, 'queued'); });
    summary.textContent = 'Running…';
  }, null, 0);
  tl.fromTo(bar, { width: '0%' }, { width: '100%', duration: passes.length * STEP + skips.length * 0.12 + 0.2, ease: 'none' }, 0);
  passes.forEach(function (b, i) {
    tl.call(function () { setBadge(b, 'pending'); }, null, 0.1 + i * STEP);
    tl.call(function () { setBadge(b, 'done'); }, null, 0.1 + i * STEP + STEP * 0.8);
  });
  var t0 = 0.1 + passes.length * STEP + 0.1;
  skips.forEach(function (b, j) { tl.call(function () { setBadge(b, 'done'); }, null, t0 + j * 0.12); });
  tl.call(function () { summary.innerHTML = summaryDone; }, null, t0 + skips.length * 0.12 + 0.15);

  if (rerun) {
    rerun.hidden = false;
    rerun.addEventListener('click', function () { tl.restart(); });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      tl.play(0);
    }, { threshold: 0.35 });
    io.observe(runner);
  }
})();
