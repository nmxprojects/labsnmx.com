/* NMX Labs v6 homepage: arrows for "The wire" carousel. Everything else on the new sections is plain HTML and CSS. */
(function () {
  'use strict';
  var t = document.getElementById('hnTrack'); if (!t) return;
  var btns = document.querySelectorAll('[data-hn]');
  function upd() { var m = t.scrollWidth - t.clientWidth - 4; btns.forEach(function (b) { b.disabled = b.getAttribute('data-hn') === '-1' ? t.scrollLeft <= 4 : t.scrollLeft >= m; }); }
  btns.forEach(function (b) { b.addEventListener('click', function () { t.scrollBy({ left: Number(b.getAttribute('data-hn')) * Math.max(280, t.clientWidth * 0.8), behavior: 'smooth' }); }); });
  t.addEventListener('scroll', function () { clearTimeout(upd.k); upd.k = setTimeout(upd, 80); }, { passive: true });
  t.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); t.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * 300, behavior: 'smooth' }); } });
  addEventListener('resize', upd); upd();
})();
