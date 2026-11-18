// About section mock-up: highlights one student's row at a time and shows that student's written comment.
// Holds on the first row for visitors who ask for reduced motion, and pauses off screen or in a hidden tab.
(function () {
  'use strict';

  var mock = document.querySelector('.mock');
  if (!mock) return;
  var rows = Array.prototype.slice.call(mock.querySelectorAll('.mock-rows li'));
  var box = mock.querySelector('.mock-comment');
  var quote = mock.querySelector('.mock-quote');
  var from = mock.querySelector('.mock-from');
  if (rows.length < 2 || !box || !quote) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var STEP = 3200, active = 0, timer = 0, visible = true;

  function show(i) {
    rows[active].classList.remove('is-active');
    active = i;
    rows[active].classList.add('is-active');
    box.classList.add('is-changing');
    setTimeout(function () {
      quote.textContent = rows[active].getAttribute('data-comment');
      from.textContent = rows[active].getAttribute('data-from');
      box.classList.remove('is-changing');
    }, 300);
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
