/* NMX Labs 404 page: finds the closest real pages for a mistyped or old address, and opens a near-exact match by itself. */
(function () {
  'use strict';
  var list = document.querySelector('[data-nf-list]'), line = document.querySelector('[data-nf-line]');
  if (!list) return;
  var STOP = { the: 1, a: 1, an: 1, and: 1, or: 1, of: 1, to: 1, in: 1, on: 1, for: 1, vs: 1, is: 1, why: 1, how: 1, what: 1, blog: 1, amp: 1, index: 1, html: 1 };
  function words(s) { return String(s).toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w && !STOP[w]; }); }
  var want = words(decodeURIComponent(location.pathname));
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  fetch('/blog/posts.json').then(function (r) { return r.json(); }).then(function (d) {
    var scored = (d.posts || []).map(function (p) {
      var have = words(p.slug), hit = want.filter(function (w) { return have.indexOf(w) > -1; }).length;
      var union = want.length + have.length - hit;
      return { p: p, s: union ? hit / union : 0 };
    }).sort(function (a, b) { return b.s - a.s; });
    var best = scored[0];
    if (best && best.s >= 0.75 && /^\/blog\//.test(location.pathname)) {
      if (line) line.innerHTML = 'That post lives at a slightly different address. Taking you to <a href="/blog/' + esc(best.p.slug) + '/">' + esc(best.p.title) + '</a>…';
      setTimeout(function () { location.replace('/blog/' + best.p.slug + '/'); }, 1200);
    }
    var top = scored.filter(function (x) { return x.s > 0; }).slice(0, 6);
    if (top.length < 3) top = (d.posts || []).slice(0, 6).map(function (p) { return { p: p }; });
    list.innerHTML = top.map(function (x, i) {
      var p = x.p;
      return '<li class="bt bt--m" style="--tint:#efe7da"><a href="/blog/' + esc(p.slug) + '/"><span class="bt-img"><img src="' + esc(p.thumb_small || p.thumb) + '" alt="" width="640" height="360" loading="lazy"></span>' +
        '<span class="bt-body"><span class="bt-top"><span class="bt-cat">' + esc(p.category) + '</span></span><span class="bt-title">' + esc(p.title) + '</span>' +
        '<span class="bt-meta">' + esc(p.author) + ' · ' + p.read_min + ' min read</span></span></a></li>';
    }).join('');
  }).catch(function () {});
})();
