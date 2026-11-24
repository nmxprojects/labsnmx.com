/* NMX Labs Play: the Daily five (same five questions for everyone each day, India time), topic quizzes and four
   quick mind games. Scores and streaks stay in the reader's browser. Plays are counted in your visitor statistics
   (events quiz_complete and game_end). Needs /assets/school.js (quiz widget) and /assets/quiz-bank.js. */
(function () {
  'use strict';
  var doc = document;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ev(type, detail) { try { if (window.nmxEvent) window.nmxEvent(type, detail); } catch (e) {} }
  function track(name, p) { try { if (window.nmxTrack) window.nmxTrack(name, p || {}); } catch (e) {} }
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BANK = window.NMX_QUIZ_BANK || { youtube: [], branding: [], metaads: [] };
  var Q = window.NMXQuiz;
  function istDay(offset) { return new Date(Date.now() + 19800000 + (offset || 0) * 864e5).toISOString().slice(0, 10); }
  function seeded(seed) { var s = 0; for (var i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function pick(arr, n, rnd) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor((rnd || Math.random)() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); }
  function best(id, v, lowerIsBetter) {
    var b = readJSON('nmx-play-best', {});
    if (v != null && (b[id] == null || (lowerIsBetter ? v < b[id] : v > b[id]))) { b[id] = v; writeJSON('nmx-play-best', b); return true; }
    return false;
  }
  function bestOf(id) { return readJSON('nmx-play-best', {})[id]; }

  /* ---------------- icons (simple line drawings) ---------------- */
  var G = {
    camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    tripod: '<rect x="8" y="3" width="8" height="5" rx="1.2"/><path d="M12 8v4M12 12l-6 9M12 12l6 9M12 12v9"/>',
    clap: '<path d="M4 9h16v11H4z"/><path d="M4 9l2.5-5L20 4.5 19 9M8.5 4.3 7 9M13 4.4 11.5 9M17.5 4.5 16 9"/>',
    phones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    frame: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-4 4 3 3-2 6 4"/><circle cx="15.5" cy="9.5" r="1.5"/>',
    brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>',
    pads: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
    letters: '<path d="M3 18l4-12 4 12M4.5 14h5M14 6h4a3 3 0 0 1 0 6h-4zM14 12h4.5a3 3 0 0 1 0 6H14z"/>',
    odd: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><rect x="14" y="14" width="6" height="6" rx="1"/>'
  };
  function icon(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + G[k] + '</svg>'; }

  /* ---------------- the stage (full-screen game area) ---------------- */
  var stage = $('#stage'), stageTitle = $('#stageTitle'), hud = $('#stageHud'), body = $('#stageBody'), current = null;
  function open(id, title) {
    if (current && current.stop) current.stop();
    stage.hidden = false; doc.body.classList.add('stage-open'); doc.body.setAttribute('data-game-active', '');
    stageTitle.textContent = title; hud.innerHTML = ''; body.innerHTML = ''; stage.scrollTop = 0;
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    $('#stageClose').focus({ preventScroll: true });
  }
  function close() {
    if (current && current.stop) current.stop(); current = null;
    stage.hidden = true; doc.body.classList.remove('stage-open'); doc.body.removeAttribute('data-game-active');
    history.replaceState(null, '', location.pathname); paintCards();
  }
  $('#stageClose').addEventListener('click', close);
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !stage.hidden) close(); });
  function afterGame(html, again, id) {
    var others = GAMES.filter(function (g) { return g.id !== id && g.id !== 'daily'; });
    var nxt = others[Math.floor(Math.random() * others.length)];
    var pushOn = window.NMX_ENGAGE && window.NMX_ENGAGE.pushOn && !window.NMX_ENGAGE.pushState();
    doc.body.removeAttribute('data-game-active');
    body.innerHTML = '<div class="over">' + html + '<div class="qz-acts"><button type="button" class="btn btn--ghost" data-again>Play again</button><button type="button" class="btn" data-next>Next: ' + esc(nxt.title) + '</button></div>' +
      (pushOn ? '<p style="margin-top:22px;font-size:14px">New lessons most weeks. <button type="button" class="nx-link" data-follow="play" style="font:inherit;font-weight:600;background:none;border:0;text-decoration:underline;cursor:pointer;color:inherit">Get them as notifications</button></p>' : '') + '</div>';
    $('[data-again]', body).addEventListener('click', again);
    $('[data-next]', body).addEventListener('click', function () { start(nxt.id); });
    var f = $('[data-follow]', body); if (f) f.addEventListener('click', function () { if (window.nmxFollow) window.nmxFollow('play'); });
  }

  /* ---------------- quizzes ---------------- */
  var dailyQs = function () { var all = [].concat(BANK.youtube, BANK.branding, BANK.metaads); return pick(all, 5, seeded('nmx' + istDay())); };
  function daily() {
    var st = readJSON('nmx-daily', { days: {}, streak: 0, last: '' }), today = istDay();
    open('daily', 'Daily five');
    if (st.days[today] != null) {
      body.innerHTML = '<div class="over"><div class="qz-score num">' + st.days[today] + '<span>/5</span></div><p>You’ve played today’s five. A new set unlocks at midnight, India time. Your streak: <strong>' + st.streak + (st.streak === 1 ? ' day' : ' days') + '</strong>.</p>' +
        '<div class="qz-acts"><button type="button" class="btn" data-practice>Practise with a topic quiz</button></div></div>';
      $('[data-practice]', body).addEventListener('click', function () { start('quiz-youtube'); });
      return;
    }
    body.innerHTML = '<p class="lead">Five questions from our lessons and posts. Everyone gets the same five today.</p><div class="lesson-check" style="margin:0"><div data-q></div></div>';
    Q.mount($('[data-q]', body), { id: 'daily', questions: dailyQs(), next: null, noRetry: true, onDone: function (score) {
      var s = readJSON('nmx-daily', { days: {}, streak: 0, last: '' });
      s.streak = s.last === istDay(-1) ? s.streak + 1 : s.last === today ? s.streak : 1; s.last = today; s.days[today] = score; writeJSON('nmx-daily', s);
      var line = doc.createElement('p'); line.style.cssText = 'text-align:center;font-weight:600;margin-top:4px';
      line.textContent = 'Streak: ' + s.streak + (s.streak === 1 ? ' day' : ' days') + '. Come back tomorrow for a new five.';
      setTimeout(function () { var d = $('.qz-done', body); if (d) d.appendChild(line); }, 0);
      paintDaily();
    } });
  }
  function topicQuiz(key, title, n) {
    return function () {
      open('quiz-' + key, title);
      body.innerHTML = '<p class="lead">' + n + ' random questions. Every answer comes with a short explanation.</p><div class="lesson-check" style="margin:0"><div data-q></div></div>';
      Q.mount($('[data-q]', body), { id: key, questions: pick(BANK[key], n), next: { href: key === 'youtube' ? '/learn/' : '/blog/', label: key === 'youtube' ? 'Read the lessons' : 'Read the blog' } });
    };
  }

  /* ---------------- memory match ---------------- */
  function memory() {
    open('memory', 'Memory match');
    var keys = ['camera', 'mic', 'bulb', 'tripod', 'clap', 'phones', 'phone', 'frame'], cards = pick(keys.concat(keys), 16), openIdx = [], got = 0, moves = 0, t0 = 0, timer, lock = false;
    hud.innerHTML = '<span>Moves <b data-moves>0</b></span><span>Time <b data-time>0s</b></span>';
    body.innerHTML = '<p class="lead">Find the eight pairs of creator kit. Fewer moves is better.</p><div class="mem">' + cards.map(function (k, i) { return '<button type="button" aria-label="Card ' + (i + 1) + '" data-i="' + i + '"><span class="f"></span><span class="b">' + icon(k) + '</span></button>'; }).join('') + '</div>';
    var grid = $('.mem', body);
    current = { stop: function () { clearInterval(timer); } };
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || lock || b.classList.contains('open') || b.classList.contains('got')) return;
      if (!t0) { t0 = Date.now(); timer = setInterval(function () { $('[data-time]', hud).textContent = Math.round((Date.now() - t0) / 1000) + 's'; }, 500); }
      b.classList.add('open'); b.setAttribute('aria-label', cards[b.getAttribute('data-i')]); openIdx.push(b);
      if (openIdx.length < 2) return;
      moves++; $('[data-moves]', hud).textContent = moves;
      var a = openIdx[0], c = openIdx[1]; openIdx = [];
      if (cards[a.getAttribute('data-i')] === cards[c.getAttribute('data-i')]) {
        a.classList.add('got'); c.classList.add('got'); got++;
        if (got === 8) {
          clearInterval(timer); var secs = Math.round((Date.now() - t0) / 1000), rec = best('memory', moves, true);
          ev('game_end', 'memory|' + moves); track('GameEnd', { game: 'memory', score: moves });
          setTimeout(function () { afterGame('<div class="qz-score num">' + moves + '</div><p>moves in ' + secs + ' seconds. ' + (rec ? 'A new best.' : 'Your best is ' + bestOf('memory') + ' moves.') + ' A perfect game is 8.</p>', memory, 'memory'); }, 700);
        }
      } else {
        lock = true;
        setTimeout(function () { a.classList.add('shake'); c.classList.add('shake'); }, 450);
        setTimeout(function () { a.classList.remove('open', 'shake'); c.classList.remove('open', 'shake'); lock = false; }, REDUCED ? 700 : 950);
      }
    });
  }

  /* ---------------- pattern recall ---------------- */
  var actx = null;
  function tone(i) {
    if (readJSON('nmx-play-mute', false)) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = [330, 392, 494, 587][i]; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, actx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.3);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.32);
    } catch (e) {}
  }
  function pattern() {
    open('pattern', 'Pattern recall');
    var seq = [], pos = 0, busy = true, alive = true;
    hud.innerHTML = '<span>Length <b data-len>0</b></span><button type="button" class="stage-x" data-mute style="padding:6px 10px">' + (readJSON('nmx-play-mute', false) ? 'Muted' : 'Sound') + '</button>';
    body.innerHTML = '<p class="lead">Watch the pads light up, then repeat the pattern. It grows by one each round.</p><div class="pat-msg" aria-live="polite">Get ready…</div><div class="pads">' +
      [0, 1, 2, 3].map(function (i) { return '<button type="button" class="p' + i + '" data-p="' + i + '" aria-label="Pad ' + (i + 1) + '" disabled></button>'; }).join('') + '</div>';
    var pads = $$('.pads button', body), msg = $('.pat-msg', body);
    $('[data-mute]', hud).addEventListener('click', function () { var m = !readJSON('nmx-play-mute', false); writeJSON('nmx-play-mute', m); this.textContent = m ? 'Muted' : 'Sound'; });
    current = { stop: function () { alive = false; } };
    function flash(i, ms) { pads[i].classList.add('lit'); tone(i); setTimeout(function () { pads[i].classList.remove('lit'); }, ms); }
    function play() {
      busy = true; pads.forEach(function (p) { p.disabled = true; }); msg.textContent = 'Watch…';
      seq.push(Math.floor(Math.random() * 4)); $('[data-len]', hud).textContent = seq.length;
      var gap = Math.max(260, 620 - seq.length * 25);
      seq.forEach(function (s, k) { setTimeout(function () { if (alive) flash(s, gap * 0.7); }, 600 + k * gap); });
      setTimeout(function () { if (!alive) return; busy = false; pos = 0; pads.forEach(function (p) { p.disabled = false; }); msg.textContent = 'Your turn'; }, 600 + seq.length * gap);
    }
    body.addEventListener('click', function (e) {
      var b = e.target.closest('.pads button'); if (!b || busy) return;
      var i = Number(b.getAttribute('data-p')); flash(i, 180);
      if (i !== seq[pos]) {
        busy = true; pads.forEach(function (p) { p.disabled = true; });
        var score = seq.length - 1, rec = best('pattern', score);
        ev('game_end', 'pattern|' + score); track('GameEnd', { game: 'pattern', score: score });
        msg.textContent = 'Not that one.';
        setTimeout(function () { if (alive) afterGame('<div class="qz-score num">' + score + '</div><p>' + (score === 1 ? 'step' : 'steps') + ' remembered. ' + (rec && score ? 'A new best.' : 'Your best is ' + (bestOf('pattern') || 0) + '.') + ' Most people land between 6 and 10.</p>', pattern, 'pattern'); }, 700);
        return;
      }
      pos++;
      if (pos === seq.length) { busy = true; msg.textContent = 'Nice.'; setTimeout(function () { if (alive) play(); }, 700); }
    });
    setTimeout(function () { if (alive) play(); }, 500);
  }

  /* ---------------- word scramble ---------------- */
  var WORDS = [['THUMBNAIL', 'The small picture people click on'], ['RETENTION', 'How long viewers keep watching'], ['CAPTION', 'Text of what is being said'], ['TRIPOD', 'A three-legged stand'],
    ['STORYBOARD', 'Sketches of every shot, in order'], ['HOOK', 'What the first seconds must do'], ['SHORTS', 'YouTube’s vertical videos'], ['CHAPTERS', 'Timestamps that split a video into parts'],
    ['CUTAWAY', 'A quick shot of something else mid-scene'], ['LIGHTING', 'What a window does for free'], ['MICROPHONE', 'Buy this before a new camera'], ['PLAYLIST', 'A set of videos in order'],
    ['SUBSCRIBE', 'Don’t ask for this in the first seconds'], ['ALGORITHM', 'What decides what people are shown'], ['KEYWORD', 'A word people search for'], ['ANALYTICS', 'Where your numbers live'],
    ['SCRIPT', 'The words you plan to say'], ['TIMELINE', 'Where clips are arranged in an editor'], ['EXPORT', 'Turning your edit into a file'], ['BRANDING', 'How a business looks and sounds'],
    ['PALETTE', 'A brand’s set of colours'], ['TYPEFACE', 'A family of letter designs'], ['SPONSOR', 'A brand that pays for a mention'], ['AUDIENCE', 'The people you make videos for'],
    ['VERTICAL', 'The shape of a Short'], ['LANDSCAPE', 'The shape of a long YouTube video'], ['FOCUS', 'Tap and hold to lock it'], ['EXPOSURE', 'How bright the picture is'], ['CREATOR', 'You, after your first upload'], ['REELS', 'Instagram’s short videos']];
  function jumble(w) { var s = w; for (var k = 0; k < 8 && s === w; k++) s = pick(w.split(''), w.length).join(''); return s; }
  function scramble() {
    open('scramble', 'Word scramble');
    var list = pick(WORDS, WORDS.length), idx = 0, solved = 0, left = 60, timer, alive = true;
    hud.innerHTML = '<span>Solved <b data-sol>0</b></span><span>Time <b data-t>60s</b></span>';
    body.innerHTML = '<p class="lead">Unscramble as many creator words as you can in 60 seconds. Skip costs nothing.</p><div class="timer"><i></i></div><div class="scr-word" aria-live="polite"></div><p class="scr-hint"></p>' +
      '<form class="scr-form" autocomplete="off"><input aria-label="Your answer" autocapitalize="characters" spellcheck="false"><button class="btn" type="submit">Check</button><button class="btn btn--ghost" type="button" data-skip>Skip</button></form>';
    var input = $('input', body), bar = $('.timer i', body);
    function show() { var w = list[idx % list.length]; $('.scr-word', body).innerHTML = jumble(w[0]).split('').map(function (c) { return '<span>' + c + '</span>'; }).join(''); $('.scr-hint', body).textContent = w[1] + ' · ' + w[0].length + ' letters'; input.value = ''; input.focus({ preventScroll: true }); }
    function end() {
      if (!alive) return; alive = false; clearInterval(timer);
      var rec = best('scramble', solved);
      ev('game_end', 'scramble|' + solved); track('GameEnd', { game: 'scramble', score: solved });
      afterGame('<div class="qz-score num">' + solved + '</div><p>' + (solved === 1 ? 'word' : 'words') + ' in 60 seconds. ' + (rec && solved ? 'A new best.' : 'Your best is ' + (bestOf('scramble') || 0) + '.') + '</p>', scramble, 'scramble');
    }
    current = { stop: function () { alive = false; clearInterval(timer); } };
    $('form', body).addEventListener('submit', function (e) {
      e.preventDefault(); if (!alive) return;
      if (input.value.trim().toUpperCase().replace(/[^A-Z]/g, '') === list[idx % list.length][0]) { solved++; $('[data-sol]', hud).textContent = solved; idx++; show(); }
      else { input.classList.remove('bad'); void input.offsetWidth; input.classList.add('bad'); }
    });
    $('[data-skip]', body).addEventListener('click', function () { idx++; show(); });
    show();
    var t0 = Date.now();
    timer = setInterval(function () {
      left = Math.max(0, 60 - (Date.now() - t0) / 1000); $('[data-t]', hud).textContent = Math.ceil(left) + 's'; bar.style.width = (left / 60 * 100) + '%';
      if (left <= 0) end();
    }, 200);
  }

  /* ---------------- odd one out ---------------- */
  var ODD = [
    [['Key light', 'Fill light', 'Back light', 'Jump cut'], 3, 'A jump cut is an editing cut. The other three are positions of a light in a classic three-point setup.'],
    [['16:9', '9:16', '4:5', '1280 × 720'], 3, '1280 × 720 is a size in pixels. The others are aspect ratios.'],
    [['VN', 'DaVinci Resolve', 'Clipchamp', 'Audacity'], 3, 'Audacity edits audio only. The other three are video editors.'],
    [['Hook', 'Promise', 'Payoff', 'Bitrate'], 3, 'Bitrate is an export setting. The other three are the parts of a good script.'],
    [['Click-through rate', 'Average view duration', 'Returning viewers', 'Shutter speed'], 3, 'Shutter speed is a camera setting. The others are YouTube Analytics numbers.'],
    [['HEX', 'RGB', 'CMYK', 'MP4'], 3, 'MP4 is a video file format. The other three are ways of describing colour.'],
    [['Lavalier', 'Shotgun', 'Condenser', 'Softbox'], 3, 'A softbox softens a light. The other three are kinds of microphone.'],
    [['Super Thanks', 'Channel memberships', 'Super Chat', 'Content ID'], 3, 'Content ID matches copyrighted material. The other three are ways fans pay creators.'],
    [['Serif', 'Sans serif', 'Monospace', 'Vignette'], 3, 'A vignette darkens the edges of an image. The others are kinds of typeface.'],
    [['Feed', 'Stories', 'Reels', 'Ads Manager'], 3, 'Ads Manager is the tool you build ads in. Feed, Stories and Reels are places ads appear.'],
    [['Logo', 'Colour palette', 'Typography', 'Bounce rate'], 3, 'Bounce rate is a website metric. The others are parts of a brand identity.'],
    [['A-roll', 'B-roll', 'Cutaway', 'Watermark'], 3, 'A watermark is a mark laid over a video. The others are kinds of footage.'],
    [['SVG', 'AI', 'EPS', 'JPG'], 3, 'JPG is a pixel image. SVG, AI and EPS can hold vector artwork that scales to any size.'],
    [['Instagram', 'YouTube', 'LinkedIn', 'Canva'], 3, 'Canva is a design tool. The other three are platforms you publish on.']
  ];
  function odd() {
    open('odd', 'Odd one out');
    var rounds = pick(ODD, 10), r = 0, score = 0;
    hud.innerHTML = '<span>Round <b data-r>1</b>/10</span><span>Score <b data-s>0</b></span>';
    function draw() {
      var x = rounds[r], order = pick([0, 1, 2, 3], 4);
      $('[data-r]', hud).textContent = r + 1;
      body.innerHTML = '<p class="lead">Three of these belong together. Which one doesn’t?</p><div class="qz"><div class="qz-opts">' +
        order.map(function (k) { return '<button type="button" class="qz-opt" data-k="' + k + '"><span>' + esc(x[0][k]) + '</span></button>'; }).join('') + '</div><div class="qz-after"></div></div>';
      $('.qz-opts', body).addEventListener('click', function (e) {
        var b = e.target.closest('.qz-opt'); if (!b || b.disabled) return;
        var k = Number(b.getAttribute('data-k')), right = k === x[1]; if (right) score++;
        $('[data-s]', hud).textContent = score;
        $$('.qz-opt', body).forEach(function (o) { var kk = Number(o.getAttribute('data-k')); o.disabled = true; o.classList.add(kk === x[1] ? 'ok' : kk === k ? 'no' : 'dim'); });
        $('.qz-after', body).innerHTML = '<div class="qz-why"><strong>' + (right ? 'Yes.' : 'Not that one.') + '</strong>' + esc(x[2]) + '</div><div class="qz-acts"><button type="button" class="btn" data-n>' + (r < 9 ? 'Next' : 'See my score') + '</button></div>';
        $('[data-n]', body).addEventListener('click', function () {
          r++; if (r < 10) { draw(); return; }
          var rec = best('odd', score); ev('game_end', 'odd|' + score); track('GameEnd', { game: 'odd', score: score });
          afterGame('<div class="qz-score num">' + score + '<span>/10</span></div><p>' + (rec && score ? 'A new best.' : 'Your best is ' + (bestOf('odd') || 0) + '/10.') + '</p>', odd, 'odd');
        });
      });
    }
    draw();
  }

  /* ---------------- hub ---------------- */
  var GAMES = [
    { id: 'daily', title: 'Daily five', run: daily },
    { id: 'quiz-youtube', title: 'YouTube basics quiz', run: topicQuiz('youtube', 'YouTube basics quiz', 8), best: 'youtube', bestOf: 8, quiz: true },
    { id: 'quiz-branding', title: 'Branding quiz', run: topicQuiz('branding', 'Branding quiz', 8), best: 'branding', bestOf: 8, quiz: true },
    { id: 'quiz-metaads', title: 'Meta ads quiz', run: topicQuiz('metaads', 'Meta ads quiz', 8), best: 'metaads', bestOf: 8, quiz: true },
    { id: 'memory', title: 'Memory match', run: memory, best: 'memory', unit: ' moves' },
    { id: 'pattern', title: 'Pattern recall', run: pattern, best: 'pattern', unit: ' steps' },
    { id: 'scramble', title: 'Word scramble', run: scramble, best: 'scramble', unit: ' words' },
    { id: 'odd', title: 'Odd one out', run: odd, best: 'odd', unit: '/10' }
  ];
  function start(id) { var g = GAMES.filter(function (x) { return x.id === id; })[0]; if (g) { if (current && current.stop) current.stop(); current = null; g.run(); } }
  function paintDaily() {
    var st = readJSON('nmx-daily', { days: {}, streak: 0, last: '' }), today = istDay(), card = $('.daily');
    if (!card) return;
    var played = st.days[today] != null, alive = st.last === today || st.last === istDay(-1);
    $('[data-daily-status]', card).textContent = played ? 'Done for today: ' + st.days[today] + '/5. New set at midnight.' : 'Five questions, about two minutes. Same five for everyone today.';
    $('[data-daily-go]', card).textContent = played ? 'See today’s score' : 'Play today’s five';
    var dots = ''; for (var k = 6; k >= 0; k--) dots += '<i class="' + (st.days[istDay(-k)] != null ? 'on' : '') + '" title="' + istDay(-k) + '"></i>';
    $('.streak', card).innerHTML = dots + '<span>' + (alive && st.streak ? st.streak + '-day streak' : 'Start a streak') + '</span>';
  }
  function paintCards() {
    var qb = readJSON('nmx-quiz-best', {});
    $$('.game-card[data-game]').forEach(function (c) {
      var g = GAMES.filter(function (x) { return x.id === c.getAttribute('data-game'); })[0], el = $('.best', c); if (!g || !el) return;
      var v = g.quiz ? qb[g.best] : bestOf(g.best);
      el.textContent = v == null ? 'Not played yet' : 'Your best: ' + v + (g.quiz ? '/' + g.bestOf : g.unit);
    });
    paintDaily();
  }
  var dayNum = $('.daily .cal b'); if (dayNum) dayNum.textContent = String(Number(istDay().slice(8, 10)));
  var monthEl = $('.daily .cal small'); if (monthEl) monthEl.textContent = new Date(istDay() + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' });
  doc.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-game]'); if (b) { e.preventDefault(); start(b.getAttribute('data-game')); } });
  $$('.game-card .gi[data-icon]').forEach(function (g) { g.innerHTML = icon(g.getAttribute('data-icon')); });
  paintCards();
  var h = location.hash.slice(1); if (h) setTimeout(function () { start(h); }, 50);
  addEventListener('hashchange', function () { var x = location.hash.slice(1); if (x && (!current || stage.hidden)) start(x); });
})();
