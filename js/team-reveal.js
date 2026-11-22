/* Team and mentor cards: select a name to reveal that person's details.
   The mentor cards' detail condenses out of drifting gold "cosmic dust": particles gather on each word,
   then the word sharpens into view. The student cards keep the stars and the gold burst but reveal their
   bullets line by line (lines: true), so even a long card is readable in under a second.
   The other cards in the same group dim while one is open.
   Only one card per group is open at a time; select it again, press Escape or click outside to close it.
   Without JS the detail is always shown; with reduced motion it simply appears. */
(function () {
  'use strict';
  // list: the group; card: one card; mark: where the dust bursts from; hintAfter: a card with data-hint gets a pill after this;
  // invite: the cards invite a click with motion (a "+", a hover spotlight, a wave) instead of a label;
  // float: on wide screens the open card floats over the row below instead of pushing it down;
  // lines: reveal the detail bullet by bullet (fast) instead of word by word with gathering dust.
  var GROUPS = [
    { list: '.cards-team', card: '.person', mark: '.avatar', invite: true, float: true, lines: true },
    { list: '.mentors', card: '.mentor', mark: '.mentor-mark', hintAfter: '.mentor-org', float: false, equal: true }
  ];
  GROUPS.forEach(setup);
  function setup(cfg) {
  var list = document.querySelector(cfg.list);
  if (!list) return;
  var cards = Array.prototype.slice.call(list.querySelectorAll(cfg.card));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var open = null;
  var run = null;   // the running dust animation { card, stop }

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* Wrap each word of the detail text (its paragraphs or list items) in a span once, so words can be revealed one by one. */
  function words(card) {
    var blocks = card.querySelectorAll('.person-detail p, .person-detail li');
    Array.prototype.forEach.call(blocks, function (p) {
      if (p.dataset.split) return;
      p.innerHTML = p.textContent.trim().split(/\s+/).map(function (w) {
        return '<span class="dust-word">' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
      }).join(' ');
      p.dataset.split = '1';
    });
    return Array.prototype.slice.call(card.querySelectorAll('.person-detail .dust-word'));
  }

  /* Student cards: each bullet slides up a little and sharpens, 0.08 s after the one before; as it lands its gold dot
     pops and a thin line of gold light runs along under it (css .line-in). All of them are in within about 0.8 s. */
  function revealLines(card) {
    var items = Array.prototype.slice.call(card.querySelectorAll('.person-detail li, .person-detail p'));
    function reset() { items.forEach(function (li) { li.classList.remove('line-in'); }); }
    reset();
    if (!hasGsap) return { stop: reset, finish: function () {} };
    gsap.killTweensOf(items);
    items.forEach(function (li, i) {
      gsap.fromTo(li, { opacity: 0, y: 8, filter: 'blur(4px)' }, {
        opacity: 1, y: 0, filter: 'blur(0px)', duration: .4, ease: 'power2.out', delay: .1 + i * .08,
        onStart: function () { li.classList.add('line-in'); },
        onComplete: function () { gsap.set(li, { clearProps: 'opacity,transform,filter' }); }
      });
    });
    return {
      stop: function () { gsap.killTweensOf(items); gsap.set(items, { clearProps: 'opacity,transform,filter' }); reset(); },
      finish: function () { gsap.set(items, { clearProps: 'opacity,transform,filter' }); }
    };
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
    var av = card.querySelector(cfg.mark).getBoundingClientRect();
    var ox = av.left + av.width / 2 - box.left, oy = av.top + av.height / 2 - box.top;
    var parts = [];
    var stars = [];
    var ws = cfg.lines ? [] : words(card);
    var lineTweens = cfg.lines ? revealLines(card) : null;

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
        if (lineTweens) lineTweens.stop();
        canvas.remove();
      },
      // Make sure every word shows even if frames were skipped (a hidden tab).
      finish: function () {
        targets.forEach(function (tg) { tg.el.style.opacity = '1'; tg.el.style.filter = ''; tg.el.style.transform = ''; });
        if (lineTweens) lineTweens.finish();
      }
    };
  }

  // On wide screens the open card floats over the (dimmed) row below it: a negative bottom
  // margin equal to its growth keeps its place in the layout, so nothing else moves.
  var wide = window.matchMedia('(min-width: 761px)');
  var sideBySide = window.matchMedia('(min-width: 901px)');   // the mentor cards sit in two columns from here
  function grow(card, closedH) {
    var d = card.querySelector('.person-detail');
    var extra = card.offsetHeight - closedH;
    var mb = cfg.float && wide.matches ? -extra : 0;
    if (reduce || !hasGsap) { card.style.marginBottom = mb + 'px'; return; }
    gsap.fromTo(d, { height: 0 }, { height: 'auto', duration: .45, ease: 'power2.out', clearProps: 'height' });
    gsap.fromTo(card, { marginBottom: 0 }, { marginBottom: mb, duration: .45, ease: 'power2.out' });
  }

  function close() {
    if (!open) return;
    if (run) { run.stop(); run = null; }
    if (hasGsap) gsap.killTweensOf([open, open.querySelector('.person-detail')]);
    open.style.marginBottom = '';
    open.style.height = '';
    open.querySelector('.person-detail').style.height = '';
    open.classList.remove('is-open');
    open.querySelector('.person-toggle').setAttribute('aria-expanded', 'false');
    list.classList.remove('has-open');
    open = null;
  }

  // Opening a card scrolls the page, alongside the growth, so the whole open card can be read.
  // Stacked cards (one column, i.e. phones): the card is centred in the space below the sticky header, so what is
  // left shows the card above and the card below. Side by side: it only scrolls as far as needed for the card to fit.
  // Either way its top never goes under the header, and a card taller than the screen is shown from its top.
  var header = document.querySelector('.site-header');
  function inView(card, finalH) {
    var gap = 16;
    var headerH = header ? header.offsetHeight : 0;
    var room = window.innerHeight - headerH;
    var top = card.getBoundingClientRect().top;
    var stacked = cfg.equal ? !sideBySide.matches : !wide.matches;
    var fits = finalH + 2 * gap <= room;
    var dy;
    if (!fits) dy = top - (headerH + gap);
    else if (stacked) dy = top - (headerH + (room - finalH) / 2);
    else if (top < headerH + gap) dy = top - (headerH + gap);
    else dy = Math.max(0, top + finalH - (window.innerHeight - gap));
    if (Math.abs(dy) > 4) window.scrollBy({ top: dy, behavior: reduce ? 'auto' : 'smooth' });
  }

  function show(card) {
    if (open === card) { close(); return; }
    close();
    open = card;
    var closedH = card.offsetHeight;
    // equal: when the cards sit side by side, every card opens to the height of the tallest open card,
    // so the two mentor cards always match in size.
    var target = 0;
    if (cfg.equal && sideBySide.matches) {
      cards.forEach(function (c) { c.classList.add('is-open'); target = Math.max(target, c.offsetHeight); c.classList.remove('is-open'); });
    }
    card.classList.add('is-open');
    card.querySelector('.person-toggle').setAttribute('aria-expanded', 'true');
    list.classList.add('has-open');
    inView(card, target || card.offsetHeight);   // measured before the growth tween shrinks it back to 0
    if (target) {
      if (reduce || !hasGsap) card.style.height = target + 'px';
      else gsap.fromTo(card, { height: closedH }, { height: target, duration: .45, ease: 'power2.out' });
    } else {
      grow(card, closedH);
    }
    if (!reduce) {
      run = dust(card);
      var me = run;
      setTimeout(function () { if (run === me) me.finish(); }, 4000);
    }
  }

  // The mentor cards carry a small pill (data-hint, e.g. "Meet our sponsor"), hidden while the card is open.
  cards.forEach(function (card) {
    if (!cfg.hintAfter || !card.dataset.hint) return;
    var hint = document.createElement('span');
    hint.className = 'person-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<span class="person-hint-dot"></span>' + card.dataset.hint;
    card.querySelector(cfg.hintAfter).insertAdjacentElement('afterend', hint);
  });

  // The team cards have no label telling the reader to click. They invite it instead (css .js .person::before / .mentor::after):
  // a gold "+" in the corner, a spotlight that follows the pointer, and, until the reader first touches
  // a card, a soft wave that lifts the cards one after another every few seconds (.is-beckon).
  var beckoning = !reduce && !!cfg.invite;
  var seen = false;       // the group is on screen
  var timer = null;
  function beckon() {
    clearTimeout(timer);
    if (!beckoning || !seen) { timer = null; return; }
    if (open || document.hidden) { timer = setTimeout(beckon, 2000); return; }
    cards.forEach(function (card, i) {
      setTimeout(function () {
        card.classList.remove('is-beckon');
        void card.offsetWidth;
        card.classList.add('is-beckon');
      }, i * 170);
    });
    timer = setTimeout(beckon, 7000);
  }
  function learned() {
    if (!beckoning) return;
    beckoning = false;
    clearTimeout(timer);
    cards.forEach(function (c) { c.classList.remove('is-beckon'); });
  }
  if (cfg.invite) cards.forEach(function (card) {
    card.addEventListener('animationend', function (e) { if (e.animationName === 'beckon') card.classList.remove('is-beckon'); });
    card.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') learned(); });
    card.addEventListener('focusin', learned);
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });
  if (cfg.invite && 'IntersectionObserver' in window && !reduce) {
    new IntersectionObserver(function (entries) {
      seen = entries[entries.length - 1].isIntersecting;
      clearTimeout(timer);
      if (seen && beckoning) timer = setTimeout(beckon, 900);
    }, { threshold: 0.25 }).observe(list);
  }

  cards.forEach(function (card) {
    card.querySelector('.person-toggle').addEventListener('click', function (e) {
      e.stopPropagation();
      learned();
      show(card);
    });
  });
  document.addEventListener('click', function (e) {
    if (open && !open.contains(e.target)) close();
  });
  // Scrolled away: once the open card is wholly off screen it closes, so the cards are back in their
  // original state when the reader returns.
  if ('IntersectionObserver' in window) {
    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.target === open && !en.isIntersecting) close(); });
    });
    cards.forEach(function (c) { watch.observe(c); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) {
      var btn = open.querySelector('.person-toggle');
      close();
      btn.focus();
    }
  });
  }
})();
