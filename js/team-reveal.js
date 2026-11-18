/* Team cards: select a name to reveal that person's work.
   The detail condenses out of drifting gold "cosmic dust": particles gather on each word,
   then the word sharpens into view. The other cards dim while one is open. Only one card
   is open at a time; select it again, press Escape or click outside to close it.
   Without JS the detail is always shown; with reduced motion it simply appears. */
(function () {
  'use strict';
  var list = document.querySelector('.cards-team');
  if (!list) return;
  var cards = Array.prototype.slice.call(list.querySelectorAll('.person'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var open = null;
  var run = null;   // the running dust animation { card, stop }

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* Wrap each word of the detail paragraph in a span once, so words can be revealed one by one. */
  function words(card) {
    var p = card.querySelector('.person-detail p');
    if (!p.dataset.split) {
      p.innerHTML = p.textContent.trim().split(/\s+/).map(function (w) {
        return '<span class="dust-word">' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
      }).join(' ');
      p.dataset.split = '1';
    }
    return Array.prototype.slice.call(p.querySelectorAll('.dust-word'));
  }

  function dust(card) {
    var canvas = document.createElement('canvas');
    canvas.className = 'person-dust';
    canvas.setAttribute('aria-hidden', 'true');
    card.insertBefore(canvas, card.firstChild);
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    function size() {
      W = card.clientWidth; H = card.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();

    var box = card.getBoundingClientRect();
    var av = card.querySelector('.avatar').getBoundingClientRect();
    var ox = av.left + av.width / 2 - box.left, oy = av.top + av.height / 2 - box.top;
    var parts = [];
    var stars = [];
    var ws = words(card);

    // Ambient star field that twinkles while the card is open.
    for (var s = 0; s < 46; s++) {
      stars.push({ x: rand(0, W), y: rand(0, H), r: rand(.4, 1.3), ph: rand(0, 6.28), sp: rand(.6, 1.8), vy: rand(-6, -2) });
    }

    // A burst out of the avatar, then dust that gathers on each word.
    for (var b = 0; b < 70; b++) {
      var ang = rand(0, Math.PI * 2), v = rand(40, 190);
      parts.push({ x: ox, y: oy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0, max: rand(.8, 1.6),
        r: rand(.6, 2), hue: Math.random() < .7 ? 'g' : 'w', burst: true });
    }

    var t0 = performance.now();
    ws.forEach(function (w, i) {
      w.style.opacity = '0';
      w.style.filter = 'blur(6px)';
      w.style.display = 'inline-block';
      w.style.transform = 'translateY(4px)';
    });

    // Word targets are measured once the detail is laid out.
    var targets = ws.map(function (w, i) {
      var r = w.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, w: r.width, at: .25 + i * .045, done: false, el: w };
    });
    targets.forEach(function (tg) {
      var n = Math.max(5, Math.round(tg.w / 6));
      for (var k = 0; k < n; k++) {
        var sx = Math.random() < .5 ? rand(-20, W + 20) : ox + rand(-30, 30);
        var sy = Math.random() < .5 ? rand(-20, H + 20) : oy + rand(-30, 30);
        parts.push({ sx: sx, sy: sy, tx: tg.x + rand(-tg.w / 2, tg.w / 2), ty: tg.y + rand(-6, 6),
          start: tg.at - rand(.35, .6), dur: rand(.45, .7), r: rand(.6, 1.7), hue: Math.random() < .75 ? 'g' : 'w', gather: true, tg: tg });
      }
    });

    var raf = 0, last = t0, alive = true;
    function frame(now) {
      if (!alive) return;
      var t = (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000);
      last = now;
      if (card.clientHeight !== H || card.clientWidth !== W) size();
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        st.y += st.vy * dt;
        if (st.y < -2) { st.y = H + 2; st.x = rand(0, W); }
        var a = Math.min(1, t * 1.5) * (.25 + .35 * (1 + Math.sin(t * st.sp * 2 + st.ph)) / 2);
        ctx.fillStyle = 'rgba(220,230,255,' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.283); ctx.fill();
      }

      for (var j = parts.length - 1; j >= 0; j--) {
        var p = parts[j], x, y, alpha;
        if (p.burst) {
          p.life += dt;
          if (p.life > p.max) { parts.splice(j, 1); continue; }
          p.vx *= .965; p.vy *= .965; p.vy += 8 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          x = p.x; y = p.y; alpha = 1 - p.life / p.max;
        } else {
          var k2 = (t - p.start) / p.dur;
          if (k2 < 0) continue;
          if (k2 > 1.6) { parts.splice(j, 1); continue; }
          var e = Math.min(1, k2); e = 1 - Math.pow(1 - e, 3);
          // A slight swirl on the way in.
          var sw = Math.sin(e * Math.PI) * 18;
          x = p.sx + (p.tx - p.sx) * e + sw * .6;
          y = p.sy + (p.ty - p.sy) * e - sw * .4;
          alpha = k2 < 1 ? Math.min(1, k2 * 2) : 1 - (k2 - 1) / .6;
        }
        var g = p.hue === 'g';
        ctx.fillStyle = (g ? 'rgba(253,187,48,' : 'rgba(255,255,255,') + Math.max(0, alpha).toFixed(3) + ')';
        ctx.shadowColor = g ? 'rgba(253,187,48,.9)' : 'rgba(255,255,255,.8)';
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (var q = 0; q < targets.length; q++) {
        var tg = targets[q];
        if (!tg.done && t >= tg.at + .3) {
          tg.done = true;
          if (hasGsap) {
            gsap.to(tg.el, { opacity: 1, filter: 'blur(0px)', y: 0, duration: .5, ease: 'power2.out',
              onComplete: function () { this.targets()[0].style.filter = ''; } });
          } else {
            tg.el.style.opacity = '1'; tg.el.style.filter = ''; tg.el.style.transform = '';
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return {
      card: card,
      stop: function () {
        alive = false;
        cancelAnimationFrame(raf);
        if (hasGsap) gsap.killTweensOf(ws);
        ws.forEach(function (w) { w.style.cssText = ''; });
        canvas.remove();
      },
      // Make sure every word shows even if frames were skipped (a hidden tab).
      finish: function () { targets.forEach(function (tg) { tg.el.style.opacity = '1'; tg.el.style.filter = ''; tg.el.style.transform = ''; }); }
    };
  }

  // On wide screens the open card floats over the (dimmed) row below it: a negative bottom
  // margin equal to its growth keeps its place in the layout, so nothing else moves.
  var wide = window.matchMedia('(min-width: 761px)');
  function grow(card, closedH) {
    var d = card.querySelector('.person-detail');
    var extra = card.offsetHeight - closedH;
    var mb = wide.matches ? -extra : 0;
    if (reduce || !hasGsap) { card.style.marginBottom = mb + 'px'; return; }
    gsap.fromTo(d, { height: 0 }, { height: 'auto', duration: .45, ease: 'power2.out', clearProps: 'height' });
    gsap.fromTo(card, { marginBottom: 0 }, { marginBottom: mb, duration: .45, ease: 'power2.out' });
  }

  function close() {
    if (!open) return;
    if (run) { run.stop(); run = null; }
    if (hasGsap) gsap.killTweensOf([open, open.querySelector('.person-detail')]);
    open.style.marginBottom = '';
    open.querySelector('.person-detail').style.height = '';
    open.classList.remove('is-open');
    open.querySelector('.person-toggle').setAttribute('aria-expanded', 'false');
    list.classList.remove('has-open');
    open = null;
  }

  function show(card) {
    if (open === card) { close(); return; }
    close();
    open = card;
    var closedH = card.offsetHeight;
    card.classList.add('is-open');
    card.querySelector('.person-toggle').setAttribute('aria-expanded', 'true');
    list.classList.add('has-open');
    grow(card, closedH);
    if (!reduce) {
      run = dust(card);
      var me = run;
      setTimeout(function () { if (run === me) me.finish(); }, 4000);
    }
  }

  // A small hint under each role; "Tap" on touch screens. Hidden while the card is open.
  var touch = window.matchMedia('(hover: none)').matches;
  cards.forEach(function (card) {
    var hint = document.createElement('span');
    hint.className = 'person-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<span class="person-hint-dot"></span>' + (touch ? 'Tap' : 'Click') + ' to explore';
    card.querySelector('.role').insertAdjacentElement('afterend', hint);
  });

  cards.forEach(function (card) {
    card.querySelector('.person-toggle').addEventListener('click', function (e) {
      e.stopPropagation();
      show(card);
    });
  });
  document.addEventListener('click', function (e) {
    if (open && !open.contains(e.target)) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) {
      var btn = open.querySelector('.person-toggle');
      close();
      btn.focus();
    }
  });
})();
