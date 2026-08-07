/* ---------------------------------------------------------------------------
   motion.js — скролл-слой: Lenis + GSAP ScrollTrigger + SplitText.

   Подключается в <head> обычным (не defer) тегом, потому что первая фаза
   должна отработать до первой отрисовки: она вешает на <html> класс motion-on
   и вставляет <style> с начальными состояниями. Вторая фаза — уже после
   загрузки библиотек — заводит инерцию, раскрытие строк и скраб героя.

   Ничего не ломается, если JS выключен или библиотеки не приехали: начальные
   состояния снимаются страховочным таймером, разметка остаётся как была.

   Настройка на страницу — window.MOTION до подключения этого файла:
     window.MOTION = { split: '...', reveal: '...', hero: '...' }
   Либо по атрибутам прямо в разметке: data-m-split, data-m-reveal.
   --------------------------------------------------------------------------- */
(function () {
  'use strict';

  var DEFAULTS = {
    /* заголовки, которые вскрываются построчно */
    split: 'h1, .flagships-head h2, .rail h2, [data-m-split]',
    /* блоки, которые всплывают при входе в кадр */
    reveal: '.offer, .case, .plate-head, .plate .screen, .terms > div, [data-m-reveal]',
    /* герой, который уезжает под скраб */
    hero: '.masthead',
    /* инерция: меньше — тяжелее */
    lerp: 0.085,
    /* до какого расстояния от кадра держать видео выгруженным */
    videoMargin: '500px 0px'
  };

  var CFG = {};
  var user = window.MOTION || {};
  for (var k in DEFAULTS) { CFG[k] = (k in user) ? user[k] : DEFAULTS[k]; }

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* база для vendor-файлов считается от собственного src, чтобы слой одинаково
     подключался и с корня, и из /cases/xxx/ */
  var here = (document.currentScript && document.currentScript.src) || '';
  var base = here.replace(/[^/]*$/, '');

  /* ---------- фаза 1: до первой отрисовки ---------- */

  var guard = null;

  function disarm() {
    root.classList.remove('motion-on');
    var s = document.getElementById('m-init');
    if (s) { s.parentNode.removeChild(s); }
  }

  if (!reduced) {
    root.classList.add('motion-on');

    var css = document.createElement('style');
    css.id = 'm-init';
    css.textContent =
      CFG.split + '{visibility:hidden}' +
      CFG.reveal + '{opacity:0;transform:translate3d(0,26px,0)}';
    (document.head || root).appendChild(css);

    /* если библиотеки не доехали за 3 с — показать всё как есть */
    guard = setTimeout(disarm, 3000);
  }

  /* ---------- ленивые видео: работает независимо от GSAP ---------- */

  function play(v) {
    var p = v.play();
    if (p && p.catch) { p.catch(function () {}); }
  }

  /* Ролики размечены как preload="none" data-autoplay и без autoplay: браузер
     держит только постер, файл уезжает в сеть, когда кадр подходит к экрану. */
  function lazyVideo() {
    var vids = [].slice.call(document.querySelectorAll('video[data-autoplay]'));
    if (!vids.length) { return; }

    /* сокращённое движение: ничего не качаем и не играем, у роликов есть controls */
    if (reduced) { return; }

    if (!('IntersectionObserver' in window)) {
      vids.forEach(function (v) { v.preload = 'auto'; v.load(); play(v); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (!e.isIntersecting) { v.pause(); return; }
        if (!v.dataset.lit) {
          v.dataset.lit = '1';
          v.preload = 'auto';
          v.load();
        }
        play(v);
      });
    }, { rootMargin: CFG.videoMargin });

    vids.forEach(function (v) { io.observe(v); });
  }

  /* ---------- фаза 2: библиотеки ---------- */

  function load(list, done) {
    var left = list.length;
    if (!left) { return done(); }
    list.forEach(function (file) {
      var s = document.createElement('script');
      s.src = base + 'vendor/' + file;
      s.async = false;              /* сохранить порядок: gsap → плагины */
      s.onload = function () { if (!--left) { done(); } };
      s.onerror = function () { left = -1; disarm(); };
      document.head.appendChild(s);
    });
  }

  function ready(fn) {
    if (document.readyState !== 'loading') { fn(); }
    else { document.addEventListener('DOMContentLoaded', fn); }
  }

  ready(function () {
    lazyVideo();
    if (reduced) { return; }
    load(['lenis.min.js', 'gsap.min.js', 'ScrollTrigger.min.js', 'SplitText.min.js'], init);
  });

  /* ---------- сборка ---------- */

  function init() {
    if (!window.gsap || !window.ScrollTrigger || !window.Lenis) { return disarm(); }

    clearTimeout(guard);
    gsap.registerPlugin(ScrollTrigger, SplitText);

    /* --- инерция --- */

    var lenis = new Lenis({
      autoRaf: false,
      lerp: CFG.lerp,
      wheelMultiplier: 1,
      smoothWheel: true,
      syncTouch: false           /* на тач-экранах родная прокрутка честнее */
    });
    window.__lenis = lenis;

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);

    /* якоря ведём через Lenis, иначе прыжок мимо инерции */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) { return; }
      var id = a.getAttribute('href');
      if (id.length < 2) { return; }
      var target = document.querySelector(id);
      if (!target) { return; }
      e.preventDefault();
      lenis.scrollTo(target, { offset: -24 });
    });

    /* --- заголовки: строки из-под маски --- */

    document.fonts && document.fonts.ready.then(function () { ScrollTrigger.refresh(); });

    [].slice.call(document.querySelectorAll(CFG.split)).forEach(function (el) {
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'm-line',
        autoSplit: true,           /* пересобрать после подгрузки шрифта */
        onSplit: function (self) {
          gsap.set(el, { visibility: 'visible' });
          return gsap.from(self.lines, {
            yPercent: 108,
            opacity: 0,
            duration: 0.9,
            stagger: 0.08,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'clamp(top 88%)', once: true }
          });
        }
      });
    });

    /* --- блоки: всплытие пачками --- */

    var rev = [].slice.call(document.querySelectorAll(CFG.reveal));
    rev.forEach(function (el) { el.classList.add('m-armed'); });

    ScrollTrigger.batch(rev, {
      start: 'top 90%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 0.75,
          stagger: 0.07,
          ease: 'power2.out',
          overwrite: true,
          onComplete: function () {
            this.targets().forEach(function (el) {
              el.classList.remove('m-armed');
              el.style.willChange = '';
            });
          }
        });
      }
    });

    /* --- герой под скраб --- */

    var hero = CFG.hero && document.querySelector(CFG.hero);
    if (hero) {
      gsap.to(hero, {
        yPercent: -9,
        opacity: 0.25,
        ease: 'none',
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6,
          invalidateOnRefresh: true
        }
      });
    }

    /* --- лёгкий параллакс на кадрах кейсов --- */

    [].slice.call(document.querySelectorAll('[data-m-parallax]')).forEach(function (el) {
      var d = parseFloat(el.getAttribute('data-m-parallax')) || 8;
      gsap.fromTo(el, { yPercent: d }, {
        yPercent: -d,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    ScrollTrigger.refresh();
  }
})();
