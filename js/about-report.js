// About section mock-up: highlights one student's row at a time and shows that student's written comment.
// All comments are stacked in the same spot (only the current one is visible), so the box is always as tall as the
// longest comment and nothing on the page moves when the comment changes.
// Holds on the first row for visitors who ask for reduced motion, and pauses off screen or in a hidden tab.
(function () {
  'use strict';

  var mock = document.querySelector('.mock');
  if (!mock) return;
  var rows = Array.prototype.slice.call(mock.querySelectorAll('.mock-rows li'));
  var box = mock.querySelector('.mock-comment');
  if (rows.length < 2 || !box) return;

  // Rebuild the comment box as a stack of every row's comment.
  box.textContent = '';
  box.classList.add('is-stacked');
  var slides = rows.map(function (row, i) {
    var s = document.createElement('div');
    s.className = 'mock-c' + (i === 0 ? ' is-on' : '');
    var q = document.createElement('p'); q.className = 'mock-quote'; q.textContent = row.getAttribute('data-comment');
    var f = document.createElement('p'); f.className = 'mock-from'; f.textContent = row.getAttribute('data-from');
    s.appendChild(q); s.appendChild(f); box.appendChild(s);
    return s;
  });

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var STEP = 3200, active = 0, timer = 0, visible = true;

  function show(i) {
    rows[active].classList.remove('is-active');
    slides[active].classList.remove('is-on');
    active = i;
    rows[active].classList.add('is-active');
    slides[active].classList.add('is-on');
  }
  function tick() { show((active + 1) % rows.length); }
  function run() {
    var want = visible && !document.hidden;
    if (want && !timer) timer = setInterval(tick, STEP);
    if (!want && timer) { clearInterval(timer); timer = 0; }
  }
  document.addEventListener('visibilitychange', run);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; run(); }).observe(mock);
  }
  run();
})();
