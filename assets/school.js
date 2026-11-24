/* NMX Labs: Learn (Creator school) and the shared quiz widget used by lessons and /play/.
   Progress and best scores stay in the reader's browser (localStorage). Finished lessons and quizzes are counted
   in your visitor statistics (events lesson_done and quiz_complete) through window.nmxEvent from engage.js. */
(function () {
  'use strict';
  var doc = document, path = location.pathname;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ev(type, detail) { try { if (window.nmxEvent) window.nmxEvent(type, detail); } catch (e) {} }
  function track(name, p) { try { if (window.nmxTrack) window.nmxTrack(name, p || {}); } catch (e) {} }
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* ---------------- quiz widget ---------------- */
  // NMXQuiz.mount(el, { id, questions: [{q, o:[...], a: index, why}], next: {href, label} | null, onDone(score,total) })
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function mount(el, opt) {
    var qs = opt.questions.map(function (x) {                       // shuffle answers, keep track of the right one
      var order = shuffle(x.o.map(function (_, i) { return i; }));
      return { q: x.q, o: order.map(function (i) { return x.o[i]; }), a: order.indexOf(x.a), why: x.why };
    });
    var i = 0, score = 0, marks = [];
    function dots() { return '<span class="qz-dots" aria-hidden="true">' + qs.map(function (_, k) { return '<i class="' + (marks[k] === 1 ? 'ok' : marks[k] === 0 ? 'no' : k === i ? 'cur' : '') + '"></i>'; }).join('') + '</span>'; }
    function draw() {
      var x = qs[i];
      el.innerHTML = '<div class="qz" aria-live="polite"><div class="qz-top"><span>Question ' + (i + 1) + ' of ' + qs.length + '</span>' + dots() + '</div>' +
        '<p class="qz-q">' + esc(x.q) + '</p><div class="qz-opts">' +
        x.o.map(function (o, k) { return '<button type="button" class="qz-opt" data-k="' + k + '"><b>' + 'ABCD'[k] + '</b><span>' + esc(o) + '</span></button>'; }).join('') + '</div><div class="qz-after"></div></div>';
    }
    function done() {
      marks.length = qs.length;
      var best = readJSON('nmx-quiz-best', {}), prev = best[opt.id] || 0;
      if (score > prev) { best[opt.id] = score; writeJSON('nmx-quiz-best', best); }
      ev('quiz_complete', opt.id + '|' + score + '/' + qs.length); track('QuizComplete', { quiz: opt.id, score: score, total: qs.length });
      var all = score === qs.length, msg = all ? 'Full marks. You clearly read it properly.' : score >= qs.length / 2 ? 'Nearly there. The explanations above cover the ones you missed.' : 'Worth a second read: the answers are all in the lesson.';
      el.innerHTML = '<div class="qz qz-done"><div class="qz-score num">' + score + '<span>/' + qs.length + '</span></div><p>' + msg + (prev && score <= prev ? ' Your best is ' + prev + '.' : '') + '</p>' +
        '<div class="qz-acts">' + (opt.noRetry ? '' : '<button type="button" class="btn btn--ghost" data-again>Try again</button>') + (opt.next ? '<a class="btn" href="' + esc(opt.next.href) + '">' + esc(opt.next.label) + '</a>' : '') + '</div></div>';
      var ag = $('[data-again]', el); if (ag) ag.addEventListener('click', function () { i = 0; score = 0; marks = []; qs = shuffle(qs); draw(); });
      if (opt.onDone) opt.onDone(score, qs.length);
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.qz-opt'); if (!b || b.disabled) return;
      var k = Number(b.getAttribute('data-k')), x = qs[i], right = k === x.a;
      if (right) score++; marks[i] = right ? 1 : 0;
      $$('.qz-opt', el).forEach(function (o, n) { o.disabled = true; o.classList.add(n === x.a ? 'ok' : n === k ? 'no' : 'dim'); });
      $('.qz-dots', el).outerHTML = dots();
      $('.qz-after', el).innerHTML = '<div class="qz-why"><strong>' + (right ? 'That’s right.' : 'Not quite.') + '</strong>' + esc(x.why) + '</div>' +
        '<div class="qz-acts"><button type="button" class="btn" data-next>' + (i + 1 < qs.length ? 'Next question' : 'See my score') + '</button></div>';
      var n = $('[data-next]', el); n.focus({ preventScroll: true });
      n.addEventListener('click', function () { i++; if (i < qs.length) draw(); else done(); });
    });
    draw();
  }
  window.NMXQuiz = { mount: mount, shuffle: shuffle };

  /* ---------------- lesson pages ---------------- */
  var lessonEl = $('[data-lesson]');
  if (lessonEl) {
    var slug = lessonEl.getAttribute('data-lesson');
    var markDone = function (how) {
      var done = readJSON('nmx-learn-done', {});
      if (done[slug]) return;
      done[slug] = new Date().toISOString().slice(0, 10); writeJSON('nmx-learn-done', done);
      ev('lesson_done', slug); track('LessonComplete', { lesson: slug, how: how });
    };
    var check = $('.lesson-check');
    if (check && 'IntersectionObserver' in window) new IntersectionObserver(function (en, ob) { if (en[0].isIntersecting) { ob.disconnect(); markDone('reached_quiz'); } }, { threshold: 0.3 }).observe(check);
    var box = $('[data-quiz]');
    if (box) {
      try {
        var data = JSON.parse($('#lessonQuiz').textContent);
        var nextA = $('.lesson-nav .next');
        mount(box, { id: slug, questions: data, next: nextA ? { href: nextA.getAttribute('href'), label: 'Next lesson' } : { href: '/play/', label: 'Play the games' }, onDone: function () { markDone('quiz'); } });
      } catch (e) { box.hidden = true; }
    }
    // reading progress in the "Lesson 3 of 10" bar
    var bar = $('.lesson-step .bar i'), prose = $('#article .prose');
    if (bar && prose) {
      var upd = function () { var r = prose.getBoundingClientRect(), k = Math.min(1, Math.max(0, (innerHeight * 0.5 - r.top) / r.height)); bar.style.width = (k * 100).toFixed(1) + '%'; };
      addEventListener('scroll', upd, { passive: true }); upd();
    }
  }

  /* ---------------- Learn hub ---------------- */
  var list = $('.lesson-list');
  if (list) {
    var done = readJSON('nmx-learn-done', {}), items = $$('li[data-slug]', list), n = 0, next = null;
    items.forEach(function (li) {
      var s = li.getAttribute('data-slug');
      if (done[s]) { li.classList.add('done'); n++; } else if (!next) next = li;
      var t = $('.tick', li); if (t) t.innerHTML = CHECK;
    });
    var card = $('.progress-card');
    if (card) {
      $('.big', card).innerHTML = '<span class="num">' + n + '</span><span> of ' + items.length + ' lessons done</span>';
      var go = $('.btn', card), meta = $('.meta', card);
      if (next) { go.href = $('a', next).getAttribute('href'); go.textContent = n ? 'Continue: lesson ' + next.getAttribute('data-n') : 'Start with lesson 1'; meta.textContent = $('h3', next).textContent; }
      else { go.href = '/play/#quiz-youtube'; go.textContent = 'Test yourself'; meta.textContent = 'You’ve finished every lesson. New ones arrive most weeks.'; }
      setTimeout(function () { $('.bar i', card).style.width = (items.length ? n / items.length * 100 : 0) + '%'; }, 120);
    }
  }
  $$('[data-follow]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (window.nmxFollow) window.nmxFollow(b.getAttribute('data-follow') || 'learn_hub');
      else if (window.NMX_ENGAGE && window.NMX_ENGAGE.open) window.NMX_ENGAGE.open('alerts');
    });
  });
})();
