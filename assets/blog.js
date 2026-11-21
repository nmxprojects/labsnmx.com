/* NMX Labs blog: Listen (browser text-to-speech), Quick summary toggle, "Keep reading" rail arrows. */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Quick summary ---------- */
  var sBtn = document.getElementById('summaryBtn');
  var sBox = document.getElementById('quickSummary');
  if (sBtn && sBox) {
    sBtn.addEventListener('click', function () {
      var open = sBox.hidden;
      sBox.hidden = !open;
      sBtn.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- Keep reading rail ---------- */
  document.querySelectorAll('.rail').forEach(function (rail) {
    var track = rail.querySelector('.rail-track');
    var btns = rail.querySelectorAll('.rail-btn');
    if (!track || btns.length < 2) return;
    function update() {
      var max = track.scrollWidth - track.clientWidth - 2;
      btns[0].disabled = track.scrollLeft <= 2;
      btns[1].disabled = track.scrollLeft >= max;
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        track.scrollBy({ left: track.clientWidth * 0.8 * Number(b.dataset.dir), behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---------- Listen ---------- */
  var synth = window.speechSynthesis;
  var lBtn = document.getElementById('listenBtn');
  var player = document.getElementById('player');
  var article = document.getElementById('article');
  if (!synth || !window.SpeechSynthesisUtterance || !lBtn || !player || !article) return;
  lBtn.hidden = false;
  synth.cancel(); // clear any queue left over from a previous page

  var toggle = document.getElementById('playerToggle');
  var stopBtn = document.getElementById('playerStop');
  var speedBtn = document.getElementById('playerSpeed');
  var bar = document.getElementById('playerProgress');
  var title = player.querySelector('.player-title');

  var speeds = [1, 1.25, 1.5, 0.85];
  var speedIdx = 0;
  var blocks = [];   // [{el, parts:[text]}]
  var idx = 0, part = 0, playing = false, token = 0, voice = null;

  function pickVoice() {
    var vs = synth.getVoices();
    if (!vs.length) return;
    var prefs = ['en-IN', 'en-GB', 'en-US', 'en'];
    for (var i = 0; i < prefs.length; i++) {
      for (var j = 0; j < vs.length; j++) {
        if (vs[j].lang && vs[j].lang.replace('_', '-').indexOf(prefs[i]) === 0) { voice = vs[j]; return; }
      }
    }
  }
  pickVoice();
  if ('onvoiceschanged' in synth) synth.addEventListener('voiceschanged', pickVoice);

  // Split long paragraphs into sentence groups: some browsers stop long utterances early.
  function split(text) {
    var sentences = text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) || [text];
    var out = [], cur = '';
    sentences.forEach(function (s) {
      if ((cur + s).length > 220 && cur) { out.push(cur.trim()); cur = ''; }
      cur += s;
    });
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function collect() {
    blocks = [];
    var head = article.querySelector('.article-head');
    [head.querySelector('h1'), head.querySelector('.dek')].forEach(function (el) {
      if (el) blocks.push({ el: el, parts: split(el.textContent.trim()) });
    });
    article.querySelectorAll('.prose > h2, .prose > h3, .prose > p, .prose > ul > li, .prose > ol > li, .prose > blockquote').forEach(function (el) {
      var t = el.textContent.replace(/\s+/g, ' ').trim();
      if (t) blocks.push({ el: el, parts: split(t) });
    });
  }

  function mark() {
    article.querySelectorAll('.is-reading').forEach(function (e) { e.classList.remove('is-reading'); });
    var b = blocks[idx];
    if (!b) return;
    if (b.el.closest('.prose')) b.el.classList.add('is-reading');
    var r = b.el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 110) {
      b.el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    bar.style.width = Math.round((idx / blocks.length) * 100) + '%';
    title.textContent = 'Listening · ' + (idx + 1) + ' of ' + blocks.length;
  }

  function speak() {
    if (idx >= blocks.length) { finish(); return; }
    var my = ++token;
    if (part === 0) mark();
    var u = new SpeechSynthesisUtterance(blocks[idx].parts[part]);
    u.rate = speeds[speedIdx];
    if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-IN'; }
    u.onend = function () {
      if (my !== token || !playing) return;
      part++;
      if (part >= blocks[idx].parts.length) { part = 0; idx++; }
      speak();
    };
    u.onerror = function (e) {
      if (my !== token) return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      part = 0; idx++; if (playing) speak();
    };
    synth.speak(u);
  }

  function setState(p) {
    playing = p;
    player.classList.toggle('paused', !p);
    toggle.setAttribute('aria-label', p ? 'Pause' : 'Resume');
    lBtn.setAttribute('aria-pressed', 'true');
    lBtn.querySelector('span').textContent = p ? 'Listening…' : 'Paused';
  }

  function start() {
    if (!blocks.length) collect();
    player.hidden = false;
    setState(true);
    synth.cancel();
    speak();
  }

  // Pause = cancel and remember the position; resume restarts the current sentence group.
  // (speechSynthesis.pause() is unreliable on Android Chrome.)
  function pause() { token++; synth.cancel(); setState(false); }

  function finish() {
    token++; synth.cancel(); playing = false; idx = 0; part = 0;
    player.hidden = true; player.classList.remove('paused');
    article.querySelectorAll('.is-reading').forEach(function (e) { e.classList.remove('is-reading'); });
    lBtn.setAttribute('aria-pressed', 'false');
    lBtn.querySelector('span').textContent = 'Listen';
    bar.style.width = '0';
  }

  lBtn.addEventListener('click', function () {
    if (player.hidden) start(); else if (playing) pause(); else { setState(true); speak(); }
  });
  toggle.addEventListener('click', function () { if (playing) pause(); else { setState(true); speak(); } });
  stopBtn.addEventListener('click', function () { finish(); lBtn.focus(); });
  speedBtn.addEventListener('click', function () {
    speedIdx = (speedIdx + 1) % speeds.length;
    speedBtn.textContent = speeds[speedIdx] + '×';
    if (playing) { token++; synth.cancel(); speak(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !player.hidden) finish(); });
  window.addEventListener('pagehide', function () { synth.cancel(); });

  // Links from the AMP version land on #listen: point the reader at the button (browsers need a tap to start audio).
  if (location.hash === '#listen') {
    lBtn.scrollIntoView({ block: 'center' });
    lBtn.focus({ preventScroll: true });
  }
})();
