/* ---------------------------------------------------------------------------
   motion.js — скролл-слой: Lenis + GSAP ScrollTrigger + SplitText.

   Главный принцип: анимация появления не имеет права оставить контент
   невидимым. Начальное состояние ставится только после того, как твин создан,
   и только инлайном; любая осечка — контент видим. Сломанная анимация
   деградирует в «просто текст», а не в пустую страницу.

   Отсюда три правила, на которых собран файл:
   1. Всё, что видно до первого движения мыши, раскрывается СРАЗУ по загрузке.
      ScrollTrigger отвечает только за то, что ниже первого экрана.
   2. Прячущий <style> живёт ровно до момента, когда начальные состояния
      перенесены в инлайн, и удаляется. visibility:hidden не может застрять.
   3. Сторож раз в 2 с проверяет, не остался ли в кадре невидимый элемент, за
      которым не стоит живой твин, и показывает его.

   Подключается в <head> обычным (не defer) тегом: первая фаза должна
   отработать до первой отрисовки, иначе контент моргнёт.

   Настройка на страницу — window.MOTION до подключения этого файла:
     window.MOTION = { split: '...', reveal: '...', hero: '...' }
   Либо по атрибутам в разметке: data-m-split, data-m-reveal, data-m-parallax.
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

  var guard = null;
  var splits = [];

  /* ---------- фаза 1: до первой отрисовки ---------- */

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

  /* Снять прячущий стиль и любое застрявшее начальное состояние. */
  function dropInitStyle() {
    var s = document.getElementById('m-init');
    if (s && s.parentNode) { s.parentNode.removeChild(s); }
  }

  function show(list) {
    [].forEach.call(list, function (el) {
      el.style.visibility = 'visible';
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  function disarm() {
    clearTimeout(guard);
    root.classList.remove('motion-on');
    dropInitStyle();
    show(document.querySelectorAll('.m-line, .m-armed'));
    try { show(document.querySelectorAll(CFG.split)); } catch (e) { /* чужой селектор */ }
    try { show(document.querySelectorAll(CFG.reveal)); } catch (e) { /* чужой селектор */ }
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

  /* Элемент считается «в первом экране», если он уже на виду или выше него:
     такое раскрывается сразу, без ScrollTrigger. */
  function onScreen(el) {
    return el.getBoundingClientRect().top < window.innerHeight;
  }

  function init() {
    if (!window.gsap || !window.ScrollTrigger || !window.SplitText || !window.Lenis) {
      return disarm();
    }
    clearTimeout(guard);

    try {
      gsap.registerPlugin(ScrollTrigger, SplitText);
      setupLenis();
      /* шрифты меняют метрики строк, поэтому разбиваем после них — но ждём
         не дольше 400 мс, иначе заголовок заметно висит пустым */
      race(fontsReady(), 400, build);
      watchdog();
    } catch (e) {
      disarm();
    }
  }

  function fontsReady() {
    return (document.fonts && document.fonts.ready) || Promise.resolve();
  }

  function race(promise, ms, fn) {
    var done = false;
    var go = function () { if (!done) { done = true; try { fn(); } catch (e) { disarm(); } } };
    promise.then(go, go);
    setTimeout(go, ms);
  }

  var lenis;

  function setupLenis() {
    lenis = new Lenis({
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

    /* пока открыт лайтбокс, фон под ним ехать не должен: showModal() сам
       прокрутку не блокирует, а с инерцией это особенно заметно */
    var dlg = document.querySelector('dialog.lb');
    if (dlg) {
      new MutationObserver(function () {
        if (dlg.open) { lenis.stop(); } else { lenis.start(); }
      }).observe(dlg, { attributes: true, attributeFilter: ['open'] });
    }
  }

  function build() {
    buildSplit();
    buildReveal();

    /* начальные состояния теперь стоят инлайном у конкретных элементов —
       прячущий стиль больше не нужен и не может ничего застрять */
    dropInitStyle();

    buildHero();
    buildParallax();

    ScrollTrigger.refresh();
    fontsReady().then(function () { ScrollTrigger.refresh(); });

    /* после ресайза разбиение строк устаревает: возвращаем текст как был,
       к этому моменту он давно раскрыт */
    var t = null;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        splits.forEach(function (s) { try { s.revert(); } catch (e) { /* уже снят */ } });
        splits = [];
        ScrollTrigger.refresh();
      }, 250);
    });
  }

  var LINE_TWEEN = { yPercent: 108, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' };

  function buildSplit() {
    [].slice.call(document.querySelectorAll(CFG.split)).forEach(function (el) {
      var split;
      try {
        split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'm-line' });
      } catch (e) {
        show([el]);
        return;
      }
      splits.push(split);

      /* заголовок показываем сразу: прячут теперь строки, а не он сам */
      gsap.set(el, { visibility: 'visible' });

      if (!split.lines.length) { return; }

      var vars = {
        yPercent: LINE_TWEEN.yPercent, opacity: LINE_TWEEN.opacity,
        duration: LINE_TWEEN.duration, stagger: LINE_TWEEN.stagger, ease: LINE_TWEEN.ease
      };

      /* первый экран не должен зависеть от ScrollTrigger — играем сразу */
      if (!onScreen(el)) {
        vars.scrollTrigger = { trigger: el, start: 'top 88%', once: true };
      }
      gsap.from(split.lines, vars);
    });
  }

  function buildReveal() {
    var all = [].slice.call(document.querySelectorAll(CFG.reveal));
    if (!all.length) { return; }

    var near = [];
    var far = [];
    all.forEach(function (el) {
      el.classList.add('m-armed');
      (onScreen(el) ? near : far).push(el);
    });

    var done = function () {
      this.targets().forEach(function (el) {
        el.classList.remove('m-armed');
        el.style.willChange = '';
      });
    };

    /* то, что уже в кадре, всплывает сразу одной волной */
    if (near.length) {
      gsap.set(near, { opacity: 0, y: 26 });
      gsap.to(near, {
        opacity: 1, y: 0, duration: 0.75, stagger: 0.07, ease: 'power2.out',
        overwrite: true, onComplete: done
      });
    }

    /* остальное ждёт своей очереди по скроллу */
    if (far.length) {
      gsap.set(far, { opacity: 0, y: 26 });
      ScrollTrigger.batch(far, {
        start: 'top 90%',
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, {
            opacity: 1, y: 0, duration: 0.75, stagger: 0.07, ease: 'power2.out',
            overwrite: true, onComplete: done
          });
        }
      });
    }
  }

  function buildHero() {
    var hero = CFG.hero && document.querySelector(CFG.hero);
    if (!hero) { return; }
    gsap.to(hero, {
      yPercent: -9,
      opacity: 0.25,
      ease: 'none',
      scrollTrigger: {
        trigger: hero, start: 'top top', end: 'bottom top',
        scrub: 0.6, invalidateOnRefresh: true
      }
    });
  }

  function buildParallax() {
    [].slice.call(document.querySelectorAll('[data-m-parallax]')).forEach(function (el) {
      var d = parseFloat(el.getAttribute('data-m-parallax')) || 8;
      gsap.fromTo(el, { yPercent: d }, {
        yPercent: -d,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  /* ---------- сторож ---------- */

  /* Если в кадре есть невидимый элемент, за которым не стоит живой твин —
     значит анимация не сыграла. Показываем принудительно. */
  function sweep() {
    var stuck = [].filter.call(document.querySelectorAll('.m-line, .m-armed'), function (el) {
      var cs = getComputedStyle(el);
      if (cs.visibility !== 'hidden' && parseFloat(cs.opacity) >= 0.05) { return false; }
      if (window.gsap && gsap.isTweening(el)) { return false; }
      var r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    });
    if (stuck.length) { show(stuck); }
  }

  /* Первые 10 с — по таймеру (первый экран), дальше — через полсекунды после
     каждой остановки скролла, чтобы прикрыть и раскрытия ниже по странице. */
  function watchdog() {
    var runs = 0;
    var tick = setInterval(function () {
      if (++runs > 5) { clearInterval(tick); }
      sweep();
    }, 2000);

    var t = null;
    window.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(sweep, 500);
    }, { passive: true });
  }
})();
