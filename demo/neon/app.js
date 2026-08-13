/* app.js — the shop floor. Type a word, watch it get bent out of one piece of glass,
   watch the invoice fill in while it is being bent. */
(function () {
  'use strict';

  var T = window.THREE, B = window.NeonBend, S = window.NeonStrokes;
  var RATES = B.RATES;

  var COLORS = [
    { id: 'ruby',   name: 'Ruby red',    hex: '#ff2d4d', gas: 'Neon, clear glass' },
    { id: 'sunset', name: 'Sunset',      hex: '#ff7a1a', gas: 'Neon, gold coating' },
    { id: 'lemon',  name: 'Lemon',       hex: '#ffd21e', gas: 'Argon, yellow phosphor' },
    { id: 'mint',   name: 'Mint',        hex: '#33ffa8', gas: 'Argon, green phosphor' },
    { id: 'ice',    name: 'Ice blue',    hex: '#3ad6ff', gas: 'Argon/mercury, clear' },
    { id: 'violet', name: 'Violet',      hex: '#a45bff', gas: 'Argon, purple coating' },
    { id: 'warm',   name: 'Warm white',  hex: '#ffd9b0', gas: 'Argon, 3000 K phosphor' }
  ];

  var cfg = {
    text: 'open\nlate',
    style: 'script',
    color: 'ruby',
    tube: 10,
    backing: 'clear',
    mount: 'studs',
    letterCm: 26
  };

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  var money = function (v) { return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  /* ------------------------------------------------------------------ state in URL */
  function readURL() {
    try {
      var p = new URLSearchParams(location.search);
      if (p.get('t')) cfg.text = decodeURIComponent(p.get('t')).slice(0, 40);
      if (S.STYLES[p.get('f')]) cfg.style = p.get('f');
      if (COLORS.some(function (c) { return c.id === p.get('c'); })) cfg.color = p.get('c');
      if (RATES.tube[+p.get('d')]) cfg.tube = +p.get('d');
      if (RATES.backing[p.get('b')]) cfg.backing = p.get('b');
      if (RATES.mount[p.get('m')]) cfg.mount = p.get('m');
      if (+p.get('h') >= 12 && +p.get('h') <= 60) cfg.letterCm = +p.get('h');
    } catch (e) {}
  }
  function writeURL() {
    try {
      var q = '?t=' + encodeURIComponent(cfg.text) + '&f=' + cfg.style + '&c=' + cfg.color +
              '&d=' + cfg.tube + '&b=' + cfg.backing + '&m=' + cfg.mount + '&h=' + cfg.letterCm;
      history.replaceState(null, '', q);
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ scene */
  var renderer, scene, camera, composer, bloom, gradePass, clock;
  var signGroup, tubeGroup, mirrorGroup, backingMesh, hazeMesh, cableMesh;
  var glowLights = [], tipLight, floorY = -0.62, wallZ = -0.42;
  var runs = [], geo = null, quoteNow = null;
  var uOn = { value: 0 }, uTime = { value: 0 };
  var colorNow = new T.Color(COLORS[0].hex), colorPrev = new T.Color(COLORS[0].hex);
  var wave = { v: 1 }, bend = { v: 1, from: 0 }, flick = { until: 0, seq: [] };
  var pointer = { x: 0, y: 0, tx: 0, ty: 0, drag: false, lx: 0 }, orbit = { a: 0, ta: 0 };
  var noWebGL = false;

  function noiseCanvas(size, oct, contrast) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
    var grid = [];
    for (var o = 0; o < oct; o++) {
      var n = 4 << o, g = new Float32Array(n * n);
      for (var i = 0; i < g.length; i++) g[i] = Math.random();
      grid.push({ n: n, g: g });
    }
    for (var y = 0; y < size; y++) for (var xx = 0; xx < size; xx++) {
      var v = 0, amp = 1, sum = 0;
      for (var k = 0; k < grid.length; k++) {
        var gr = grid[k], fx = xx / size * gr.n, fy = y / size * gr.n;
        var x0 = Math.floor(fx) % gr.n, y0 = Math.floor(fy) % gr.n;
        var x1 = (x0 + 1) % gr.n, y1 = (y0 + 1) % gr.n, tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        var a = gr.g[y0 * gr.n + x0], b = gr.g[y0 * gr.n + x1], cc = gr.g[y1 * gr.n + x0], dd = gr.g[y1 * gr.n + x1];
        v += amp * ((a + (b - a) * tx) + ((cc + (dd - cc) * tx) - (a + (b - a) * tx)) * ty);
        sum += amp; amp *= 0.55;
      }
      v = v / sum; v = 0.5 + (v - 0.5) * contrast;
      var p = (y * size + xx) * 4, val = Math.max(0, Math.min(255, v * 255)) | 0;
      d[p] = d[p + 1] = d[p + 2] = val; d[p + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  function environment() {
    var c = document.createElement('canvas'); c.width = 256; c.height = 128;
    var g = c.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, '#20242b'); grd.addColorStop(0.48, '#0c0e12');
    grd.addColorStop(0.52, '#07080b'); grd.addColorStop(1, '#020304');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
    var warm = g.createRadialGradient(60, 40, 2, 60, 40, 70);
    warm.addColorStop(0, 'rgba(255,190,120,0.55)'); warm.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = warm; g.fillRect(0, 0, 256, 128);
    var tex = new T.CanvasTexture(c);
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.colorSpace = T.SRGBColorSpace;
    var pmrem = new T.PMREMGenerator(renderer);
    var rt = pmrem.fromEquirectangular(tex);
    pmrem.dispose(); tex.dispose();
    return rt.texture;
  }

  var TUBE_VERT = [
    'varying vec2 vUvT; varying vec3 vNrm; varying vec3 vViewDir; varying vec3 vWorld;',
    'void main(){',
    '  vUvT = uv;',
    '  vec4 wp = modelMatrix * vec4(position,1.0);',
    '  vWorld = wp.xyz;',
    '  vNrm = normalize(mat3(modelMatrix) * normal);',
    '  vViewDir = normalize(cameraPosition - wp.xyz);',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var TUBE_FRAG = [
    'uniform vec3 uColor; uniform vec3 uPrev; uniform float uWave; uniform float uOn;',
    'uniform float uProgress; uniform float uTime; uniform float uDim; uniform float uMirror;',
    'uniform float uFloorY;',
    'varying vec2 vUvT; varying vec3 vNrm; varying vec3 vViewDir; varying vec3 vWorld;',
    'void main(){',
    '  float facing = abs(dot(normalize(vNrm), normalize(vViewDir)));',
    '  float core = pow(clamp(facing,0.0,1.0), 2.6);',
    // the tube is one long piece: uWave rolls the new colour along it instead of swapping
    '  float w = smoothstep(uWave-0.10, uWave+0.01, 1.0 - vUvT.x);',
    '  vec3 tint = mix(uColor, uPrev, w);',
    '  float front = smoothstep(0.055, 0.0, abs((1.0-vUvT.x) - uWave)) * step(uWave, 0.999) * step(0.001, uWave);',
    // glass under the torch runs orange before it cools into light
    '  float hot = smoothstep(0.16, 0.0, uProgress - (1.0-vUvT.x)) * step(uProgress, 0.999);',
    '  float breath = 0.95 + 0.05*sin(uTime*2.1 + vUvT.x*7.0);',
    '  vec3 lit = tint * (0.30 + 1.35*core) * breath;',
    '  lit += mix(tint, vec3(1.0,0.93,0.88), 0.72) * pow(core, 12.0) * 0.85;',
    '  lit = mix(lit, vec3(1.0,0.45,0.06) * (1.2 + 3.0*core), hot);',
    '  lit += vec3(1.0,0.72,0.35) * front * 2.2;',
    '  vec3 off = vec3(0.62,0.65,0.70) * (0.05 + 0.16*core);',
    '  vec3 col = mix(off, lit, clamp(uOn + hot, 0.0, 1.0));',
    '  float fade = 1.0;',
    '  if (uMirror > 0.5) fade = 0.17 * (0.72 + 0.28 * smoothstep(uFloorY - 0.9, uFloorY + 0.9, vWorld.y));',
    '  gl_FragColor = vec4(col * uDim * fade, 1.0);',
    '}'
  ].join('\n');

  var GRADE = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmt: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmt; varying vec2 vUv;',
      'void main(){',
      '  vec2 d = vUv - 0.5;',
      '  float r2 = dot(d,d);',
      '  vec2 off = d * r2 * 0.010 * uAmt;',
      '  vec3 c;',
      '  c.r = texture2D(tDiffuse, vUv - off).r;',
      '  c.g = texture2D(tDiffuse, vUv).g;',
      '  c.b = texture2D(tDiffuse, vUv + off).b;',
      '  float vig = smoothstep(0.95, 0.18, r2*1.9);',
      '  c *= mix(1.0, vig, 0.85);',
      '  float g = fract(sin(dot(vUv*vec2(1.0,1.3) + uTime*0.09, vec2(12.9898,78.233))) * 43758.5453);',
      '  c += (g - 0.5) * 0.014;',
      '  c = max(vec3(0.0), c - 0.004);',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n')
  };

  function initScene() {
    var canvas = $('#stage');
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance' });
    } catch (e) { noWebGL = true; }
    if (!renderer || !renderer.getContext()) { noWebGL = true; }
    if (noWebGL) { document.body.classList.add('nogl'); return false; }

    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;

    scene = new T.Scene();
    scene.background = new T.Color('#040507');
    scene.fog = new T.FogExp2('#040507', 0.075);
    scene.environment = environment();
    scene.environmentIntensity = 0.55;

    camera = new T.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, -0.46, 3.2);

    var bump = new T.CanvasTexture(noiseCanvas(256, 5, 1.4));
    bump.wrapS = bump.wrapT = T.RepeatWrapping; bump.repeat.set(2, 1.3);

    var wall = new T.Mesh(
      new T.PlaneGeometry(16, 9),
      new T.MeshStandardMaterial({ color: '#12151a', roughness: 0.95, metalness: 0.0, bumpMap: bump, bumpScale: 0.35 })
    );
    wall.position.set(0, 1.2, wallZ);
    scene.add(wall);

    // the bar top: near plane, and the surface the sign is reflected in
    var counter = new T.Mesh(
      new T.PlaneGeometry(9, 1.5),
      new T.MeshStandardMaterial({ color: '#080a0e', roughness: 0.14, metalness: 0.55, bumpMap: bump, bumpScale: 0.06 })
    );
    counter.rotation.x = -Math.PI / 2;
    counter.position.set(0, floorY, wallZ + 0.75);
    scene.add(counter);

    var floor = new T.Mesh(
      new T.PlaneGeometry(16, 6),
      new T.MeshStandardMaterial({ color: '#06080b', roughness: 0.42, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -2.1, wallZ + 2.6);
    scene.add(floor);

    // a socket on the wall: the only object in frame at a size everyone knows
    var socket = new T.Group();
    var plate = new T.Mesh(new T.BoxGeometry(0.086, 0.086, 0.012),
      new T.MeshStandardMaterial({ color: '#1b1f25', roughness: 0.55, metalness: 0.1 }));
    socket.add(plate);
    for (var si = -1; si <= 1; si += 2) {
      var hole = new T.Mesh(new T.BoxGeometry(0.008, 0.017, 0.004),
        new T.MeshStandardMaterial({ color: '#05060a', roughness: 1 }));
      hole.position.set(si * 0.014, 0.004, 0.008); socket.add(hole);
    }
    socket.position.set(0.78, floorY + 0.20, wallZ + 0.012);
    scene.add(socket);

    signGroup = new T.Group(); scene.add(signGroup);
    tubeGroup = new T.Group(); signGroup.add(tubeGroup);
    // dark shop glass right behind the sign: the tube is doubled in it, the way it is
    // doubled in every photograph of a neon sign taken from the street
    var glassZ = -0.17;
    var pane = new T.Mesh(new T.PlaneGeometry(7, 4.4), new T.MeshPhysicalMaterial({
      color: '#070a0e', roughness: 0.05, metalness: 0.65, transparent: true, opacity: 0.72, depthWrite: false
    }));
    pane.position.set(0, 0.1, glassZ);
    scene.add(pane);

    mirrorGroup = new T.Group();
    mirrorGroup.scale.set(1, 1, -1);
    mirrorGroup.position.z = 2 * glassZ;
    scene.add(mirrorGroup);

    for (var i = 0; i < 8; i++) {
      var pl = new T.PointLight(0xffffff, 0, 2.8, 2);
      glowLights.push(pl); scene.add(pl);
    }
    tipLight = new T.PointLight(0xff7a12, 0, 1.1, 2); scene.add(tipLight);

    var fill = new T.DirectionalLight('#7d9dc4', 0.22);
    fill.position.set(-3, 2.4, 2.2); scene.add(fill);
    var back = new T.DirectionalLight('#ffb072', 0.12);
    back.position.set(2.6, -0.6, -1.4); scene.add(back);

    // soft light spilled on the wall, painted rather than ray-traced
    var hg = document.createElement('canvas'); hg.width = hg.height = 256;
    var hx = hg.getContext('2d');
    var rg = hx.createRadialGradient(128, 128, 4, 128, 128, 126);
    rg.addColorStop(0, 'rgba(255,255,255,0.85)'); rg.addColorStop(0.35, 'rgba(255,255,255,0.22)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    hx.fillStyle = rg; hx.fillRect(0, 0, 256, 256);
    hazeMesh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({
      map: new T.CanvasTexture(hg), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.5
    }));
    hazeMesh.position.z = wallZ + 0.02;
    scene.add(hazeMesh);

    composer = new T.EffectComposer(renderer);
    composer.addPass(new T.RenderPass(scene, camera));
    bloom = new T.UnrealBloomPass(new T.Vector2(1, 1), 0.52, 0.58, 0.80);
    composer.addPass(bloom);
    gradePass = new T.ShaderPass(GRADE);
    composer.addPass(gradePass);
    try { composer.addPass(new T.SMAAPass()); } catch (e) {}
    composer.addPass(new T.OutputPass());

    clock = new T.Clock();
    resize();
    addEventListener('resize', resize);
    var stageWrap = $('.stage-wrap');
    stageWrap.addEventListener('pointermove', function (e) {
      var r = stageWrap.getBoundingClientRect();
      pointer.tx = (e.clientX - r.left) / r.width * 2 - 1;
      pointer.ty = (e.clientY - r.top) / r.height * 2 - 1;
      if (pointer.drag) { orbit.ta += (e.clientX - pointer.lx) * 0.0022; pointer.lx = e.clientX; }
    });
    stageWrap.addEventListener('pointerdown', function (e) { pointer.drag = true; pointer.lx = e.clientX; stageWrap.classList.add('grabbing'); });
    addEventListener('pointerup', function () { pointer.drag = false; stageWrap.classList.remove('grabbing'); });
    return true;
  }

  function resize() {
    var wrap = $('.stage-wrap');
    var w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    frameCamera(true);
  }

  /* ------------------------------------------------------------------ build the sign */
  var curves = [];

  function disposeGroup(g) {
    for (var i = g.children.length - 1; i >= 0; i--) {
      var c = g.children[i];
      if (c.geometry) c.geometry.dispose();
      g.remove(c);
    }
  }

  function buildSign(mode) {
    geo = B.layout(cfg.text, cfg.style, cfg.tube, cfg.letterCm * 10);
    var m = cfg.letterCm / 100;                       // metres per em
    var radius = cfg.tube / 2 / 1000;
    var prevRunCount = runs.length;

    disposeGroup(tubeGroup); disposeGroup(mirrorGroup);
    runs = []; curves = [];

    var cx = (geo.bbox.minX + geo.bbox.maxX) / 2, cy = (geo.bbox.minY + geo.bbox.maxY) / 2;

    geo.runs.forEach(function (r, idx) {
      var pts = [];
      for (var i = 0; i < r.pts.length; i++) {
        if (i && Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]) < 1e-5) continue;
        pts.push(new T.Vector3((r.pts[i][0] - cx) * m, (r.pts[i][1] - cy) * m, Math.sin(i * 0.7) * 0.0006));
      }
      if (pts.length < 2) return;
      var curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.02);
      var segs = Math.max(24, Math.min(1400, Math.round(curve.getLength() / (radius * 0.75))));
      var tg = new T.TubeGeometry(curve, segs, radius, 10, false);
      curves.push(curve);

      var uni = {
        uColor: { value: colorNow.clone() }, uPrev: { value: colorPrev.clone() },
        uWave: { value: 1 }, uOn: uOn, uProgress: { value: 1 }, uTime: uTime,
        uDim: { value: 1 }, uMirror: { value: 0 }, uFloorY: { value: floorY }
      };
      var mat = new T.ShaderMaterial({ uniforms: uni, vertexShader: TUBE_VERT, fragmentShader: TUBE_FRAG });
      var mesh = new T.Mesh(tg, mat);
      tubeGroup.add(mesh);

      var muni = {
        uColor: uni.uColor, uPrev: uni.uPrev, uWave: uni.uWave, uOn: uOn,
        uProgress: uni.uProgress, uTime: uTime, uDim: { value: 1 }, uMirror: { value: 1 }, uFloorY: { value: floorY }
      };
      var mmat = new T.ShaderMaterial({
        uniforms: muni, vertexShader: TUBE_VERT, fragmentShader: TUBE_FRAG,
        transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false
      });
      var mmesh = new T.Mesh(tg, mmat);
      mmesh.renderOrder = 3;
      mirrorGroup.add(mmesh);
      runs.push({ mesh: mesh, mirror: mmesh, uni: uni, muni: muni, segs: segs, curve: curve, settled: true });
    });

    // acrylic backing, cut to the sign with a fixed margin — same rectangle the quote bills
    if (backingMesh) { signGroup.remove(backingMesh); backingMesh.geometry.dispose(); backingMesh = null; }
    if (cfg.backing !== 'none' && runs.length) {
      var bw = (geo.bbox.w + RATES.backingMargin * 2) * m, bh = (geo.bbox.h + RATES.backingMargin * 2) * m;
      var clear = cfg.backing === 'clear';
      backingMesh = new T.Mesh(new T.BoxGeometry(bw, bh, 0.005), new T.MeshPhysicalMaterial({
        color: clear ? '#dfe9f2' : '#0b0d11',
        roughness: clear ? 0.03 : 0.22,
        metalness: 0,
        transmission: clear ? 0.94 : 0,
        thickness: clear ? 0.02 : 0,
        ior: 1.49,
        transparent: clear,
        opacity: clear ? 1 : 1,
        clearcoat: clear ? 0 : 0.6,
        clearcoatRoughness: 0.25
      }));
      backingMesh.position.z = -0.026;
      signGroup.add(backingMesh);
    }

    // mains cable down to the socket: the sign is plugged into something
    if (cableMesh) { scene.remove(cableMesh); cableMesh.geometry.dispose(); cableMesh = null; }
    if (runs.length) {
      var startX = (geo.bbox.maxX - cx) * m, startY = (geo.bbox.minY - cy) * m;
      var a = new T.Vector3(startX, startY, -0.02);
      var bpt = new T.Vector3(0.78, floorY + 0.26, wallZ + 0.02);
      var cpts = [];
      for (var t2 = 0; t2 <= 1.0001; t2 += 0.05) {
        cpts.push(new T.Vector3(
          a.x + (bpt.x - a.x) * t2 + Math.sin(t2 * Math.PI) * 0.05,
          a.y + (bpt.y - a.y) * t2 - Math.sin(t2 * Math.PI) * 0.10,
          a.z + (bpt.z - a.z) * t2
        ));
      }
      cableMesh = new T.Mesh(
        new T.TubeGeometry(new T.CatmullRomCurve3(cpts), 40, 0.0035, 6, false),
        new T.MeshStandardMaterial({ color: '#0e1014', roughness: 0.7, metalness: 0.05 })
      );
      scene.add(cableMesh);
    }

    // glow lights follow the tube so the wall is lit by the sign, not by a lamp
    var samples = [];
    curves.forEach(function (c) { for (var i = 0; i <= 6; i++) samples.push(c.getPointAt(i / 6)); });
    for (var gi = 0; gi < glowLights.length; gi++) {
      var L = glowLights[gi];
      if (samples.length) {
        var p = samples[Math.floor(gi / glowLights.length * samples.length)];
        L.position.set(p.x, p.y, p.z + 0.16);
        L.visible = true;
      } else L.visible = false;
    }

    if (hazeMesh) {
      hazeMesh.scale.set(Math.max(0.9, geo.bbox.w * m * 2.3), Math.max(0.7, geo.bbox.h * m * 3.0), 1);
      hazeMesh.visible = runs.length > 0;
    }

    if (mode === 'bend' && !reduced && runs.length) {
      bend.v = 0; bend.from = 0;
      runs.forEach(function (r) { r.settled = false; r.uni.uProgress.value = 0; });
      startFlicker(0.45);
    } else if (mode === 'grow' && !reduced && runs.length > prevRunCount) {
      bend.v = 0; bend.from = prevRunCount / runs.length;
      runs.forEach(function (r, i) { r.settled = i < prevRunCount; r.uni.uProgress.value = r.settled ? 1 : 0; });
    } else {
      bend.v = 1;
      runs.forEach(function (r) { r.settled = true; r.uni.uProgress.value = 1; });
    }
    setColorUniforms(1);
    frameCamera(false);
  }

  function setColorUniforms(w) {
    runs.forEach(function (r) {
      r.uni.uColor.value.copy(colorNow);
      r.uni.uPrev.value.copy(colorPrev);
      r.uni.uWave.value = w;
    });
  }

  function frameCamera(instant) {
    if (!geo) return;
    var m = cfg.letterCm / 100;
    var w = Math.max(0.25, geo.bbox.w * m), h = Math.max(0.2, geo.bbox.h * m);
    var vf = T.MathUtils.degToRad(camera.fov);
    var dH = (h * 0.62) / Math.tan(vf / 2) / 0.68;
    var dW = (w * 0.5) / Math.tan(Math.atan(Math.tan(vf / 2) * camera.aspect)) / 0.70;
    var fit = Math.max(dH, dW, 1.1);
    // only follow the fit half way: a 60 cm sign has to LOOK bigger than a 15 cm one
    camTarget = 2.05 + (fit - 2.05) * 0.62;
    if (instant) camZ = camTarget;
  }
  var camTarget = 3.2, camZ = 3.2;

  /* ------------------------------------------------------------------ startup flicker */
  function startFlicker(delay) {
    var t = (clock ? clock.getElapsedTime() : 0) + (delay || 0);
    flick.seq = [];
    var n = 4 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var on = 0.03 + Math.random() * 0.07, off = 0.05 + Math.random() * 0.11;
      flick.seq.push([t, t + on]); t += on + off;
    }
    flick.seq.push([t, t + 0.09]); t += 0.09 + 0.05;
    flick.until = t;
    flick.steady = t;
  }

  function onValue(now) {
    if (reduced) return 1;
    if (now >= flick.steady) {
      var s = 0.985 + 0.015 * Math.sin(now * 31.0) + (Math.random() < 0.0012 ? -0.35 : 0);
      return Math.min(1, s);
    }
    for (var i = 0; i < flick.seq.length; i++) {
      if (now >= flick.seq[i][0] && now <= flick.seq[i][1]) return 0.75 + Math.random() * 0.25;
    }
    return 0.0;
  }

  /* ------------------------------------------------------------------ loop */
  function tick() {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, clock.getDelta()), now = clock.getElapsedTime();
    uTime.value = now;
    uOn.value = onValue(now);

    if (bend.v < 1) {
      var speed = 1 / Math.max(0.7, Math.min(2.4, geo.lengthEm * 0.20));
      bend.v = Math.min(1, bend.v + dt * speed);
      var span = 1 - bend.from;
      runs.forEach(function (r, i) {
        if (r.settled) { r.uni.uProgress.value = 1; return; }
        var idx = i / Math.max(1, runs.length), local = (bend.v - bend.from) / Math.max(0.0001, span);
        var lead = (idx - bend.from) / Math.max(0.0001, span);
        var p = T.MathUtils.clamp((local - lead * 0.72) / 0.42, 0, 1);
        r.uni.uProgress.value = p;
        var count = Math.max(1, Math.floor(p * r.segs)) * 10 * 6;
        r.mesh.geometry.setDrawRange(0, count);
        if (p > 0 && p < 1) {
          var pt = r.curve.getPointAt(T.MathUtils.clamp(p, 0, 1));
          tipLight.position.set(pt.x, pt.y, pt.z + 0.05);
          tipLight.intensity = 1.6;
        }
      });
      if (bend.v >= 1) {
        tipLight.intensity = 0;
        runs.forEach(function (r) { r.settled = true; r.mesh.geometry.setDrawRange(0, Infinity); });
      }
      paintQuote(bend.v);
    } else tipLight.intensity *= 0.9;

    if (wave.v < 1) {
      wave.v = Math.min(1, wave.v + dt * 1.55);
      setColorUniforms(1 - Math.pow(1 - wave.v, 2));
      if (wave.v >= 1) colorPrev.copy(colorNow);
    }

    var lit = uOn.value;
    for (var i = 0; i < glowLights.length; i++) {
      var L = glowLights[i];
      // a light only lifts once the glass under it has actually been bent
      var born = T.MathUtils.clamp((bend.v - i / glowLights.length) * 3.2, 0, 1);
      L.color.copy(colorNow);
      L.intensity = lit * born * 0.10 * (0.7 + 0.3 * Math.sin(now * 1.3 + i));
    }
    lit *= 0.25 + 0.75 * bend.v;
    if (hazeMesh) {
      hazeMesh.material.color.copy(colorNow);
      hazeMesh.material.opacity = 0.10 * lit;
    }

    pointer.x += (pointer.tx - pointer.x) * 0.055;
    pointer.y += (pointer.ty - pointer.y) * 0.055;
    orbit.a += (orbit.ta - orbit.a) * 0.07;
    camZ += (camTarget - camZ) * 0.06;
    var ang = orbit.a + pointer.x * 0.10;
    camera.position.x = Math.sin(ang) * camZ;
    camera.position.z = Math.cos(ang) * camZ;
    camera.position.y = -0.46 - pointer.y * 0.12;
    camera.lookAt(0, 0.10, 0);

    gradePass.uniforms.uTime.value = now;
    composer.render();
  }

  /* ------------------------------------------------------------------ UI */
  function radio(name, opts, current, cb) {
    var box = el('div', 'seg');
    opts.forEach(function (o) {
      var b = el('button', 'seg-b' + (o.id === current ? ' on' : ''), o.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', o.id === current ? 'true' : 'false');
      if (o.title) b.title = o.title;
      b.addEventListener('click', function () { cb(o.id); });
      box.appendChild(b);
    });
    return box;
  }

  function buildPanel() {
    var p = $('#controls');
    p.innerHTML = '';

    var f1 = el('div', 'field');
    var lab = el('label', 'lab', 'Your text');
    lab.setAttribute('for', 'txt');
    var hint = el('span', 'hint', 'Enter for a new line, up to 3');
    lab.appendChild(hint);
    var ta = el('textarea', 'txt');
    ta.id = 'txt'; ta.rows = 2; ta.value = cfg.text; ta.maxLength = 40; ta.spellcheck = false;
    ta.addEventListener('input', function () {
      var old = cfg.text;
      cfg.text = ta.value.slice(0, 40);
      buildSign(cfg.text.indexOf(old) === 0 && cfg.text.length > old.length ? 'grow' : 'set');
      paintQuote(1); writeURL(); drop();
    });
    f1.appendChild(lab); f1.appendChild(ta);
    var warn = el('p', 'drop'); warn.id = 'drop'; f1.appendChild(warn);
    p.appendChild(f1);

    var f2 = el('div', 'field');
    f2.appendChild(el('span', 'lab', 'Lettering'));
    var styles = Object.keys(S.STYLES).map(function (k) {
      return { id: k, label: S.STYLES[k].label, title: S.STYLES[k].note };
    });
    f2.appendChild(radio('style', styles, cfg.style, function (id) {
      cfg.style = id; buildSign('bend'); buildPanel(); paintQuote(0); writeURL();
    }));
    f2.appendChild(el('p', 'note', S.STYLES[cfg.style].note));
    p.appendChild(f2);

    var f3 = el('div', 'field');
    f3.appendChild(el('span', 'lab', 'Glow'));
    var sw = el('div', 'swatches');
    COLORS.forEach(function (c) {
      var b = el('button', 'sw' + (c.id === cfg.color ? ' on' : ''));
      b.type = 'button'; b.style.setProperty('--c', c.hex);
      b.title = c.name + ' — ' + c.gas;
      b.setAttribute('aria-label', c.name);
      b.addEventListener('click', function () {
        if (cfg.color === c.id) return;
        colorPrev.copy(colorNow); colorNow.set(c.hex);
        wave.v = reduced ? 1 : 0; if (reduced) colorPrev.copy(colorNow);
        cfg.color = c.id; setColorUniforms(wave.v); accent(c.hex); buildPanel(); writeURL();
      });
      sw.appendChild(b);
    });
    f3.appendChild(sw);
    var cc = COLORS.filter(function (c) { return c.id === cfg.color; })[0];
    f3.appendChild(el('p', 'note', cc.name + ' — ' + cc.gas));
    p.appendChild(f3);

    var f4 = el('div', 'field');
    f4.appendChild(el('span', 'lab', 'Tube bore'));
    f4.appendChild(radio('tube', [
      { id: 8, label: '8 mm', title: 'Thinnest, tightest bends, 17 mm minimum radius' },
      { id: 10, label: '10 mm', title: 'Shop standard, 22 mm minimum radius' },
      { id: 12, label: '12 mm', title: 'Brightest, corners visibly rounder, 27 mm minimum radius' }
    ], cfg.tube, function (id) { cfg.tube = +id; buildSign('set'); buildPanel(); paintQuote(1); writeURL(); }));
    f4.appendChild(el('p', 'note', 'Glass will not take a corner tighter than ' +
      RATES.tube[cfg.tube].minBendR + ' mm — thicker tube visibly rounds the letters.'));
    p.appendChild(f4);

    var f5 = el('div', 'field');
    var l5 = el('label', 'lab', 'Letter height');
    l5.setAttribute('for', 'size');
    l5.appendChild(el('span', 'hint', cfg.letterCm + ' cm'));
    var sl = el('input', 'range'); sl.id = 'size'; sl.type = 'range';
    sl.min = 12; sl.max = 60; sl.step = 1; sl.value = cfg.letterCm;
    sl.addEventListener('input', function () {
      cfg.letterCm = +sl.value;
      l5.querySelector('.hint').textContent = cfg.letterCm + ' cm';
      buildSign('set'); paintQuote(1); writeURL();
    });
    f5.appendChild(l5); f5.appendChild(sl);
    p.appendChild(f5);

    var f6 = el('div', 'field');
    f6.appendChild(el('span', 'lab', 'Backing'));
    f6.appendChild(radio('backing', [
      { id: 'clear', label: 'Clear acrylic' }, { id: 'black', label: 'Black acrylic' }, { id: 'none', label: 'Bare tube' }
    ], cfg.backing, function (id) { cfg.backing = id; buildSign('set'); buildPanel(); paintQuote(1); writeURL(); }));
    p.appendChild(f6);

    var f7 = el('div', 'field');
    f7.appendChild(el('span', 'lab', 'Mounting'));
    f7.appendChild(radio('mount', [
      { id: 'studs', label: 'Stand-offs' }, { id: 'chain', label: 'Chain' }, { id: 'stand', label: 'Base' }
    ], cfg.mount, function (id) { cfg.mount = id; buildPanel(); paintQuote(1); writeURL(); }));
    p.appendChild(f7);

    var again = el('button', 'again', 'Bend it again');
    again.type = 'button';
    again.addEventListener('click', function () { buildSign('bend'); paintQuote(0); });
    p.appendChild(again);
  }

  function drop() {
    var d = $('#drop');
    if (!d) return;
    d.textContent = geo && geo.dropped ? geo.dropped + ' character(s) skipped: not in this alphabet.' : '';
  }

  /* ------------------------------------------------------------------ the invoice */
  function paintQuote(progress) {
    if (!geo) return;
    quoteNow = B.quote(geo, cfg);
    var k = reduced ? 1 : Math.max(0, Math.min(1, progress));
    var body = $('#quote');
    body.innerHTML = '';
    quoteNow.lines.forEach(function (l) {
      var row = el('div', 'qrow');
      var left = el('div', 'qleft');
      left.appendChild(el('span', 'qlabel', l.label));
      left.appendChild(el('span', 'qform', l.formula));
      row.appendChild(left);
      row.appendChild(el('span', 'qamt', money(l.amount * k)));
      body.appendChild(row);
    });
    $('#total').textContent = money(quoteNow.total * k);
    $('#m-len').textContent = (quoteNow.metres * k).toFixed(2) + ' m';
    $('#m-bends').textContent = Math.round(geo.bends * k);
    $('#m-runs').textContent = geo.electrodePairs;
    $('#m-watts').textContent = (quoteNow.watts * k).toFixed(0) + ' W';
    $('#m-size').textContent = (quoteNow.widthM * 100).toFixed(0) + ' x ' + (quoteNow.heightM * 100).toFixed(0) + ' cm';
    drop();
  }

  function orderJSON() {
    var c = COLORS.filter(function (x) { return x.id === cfg.color; })[0];
    return {
      sku: 'NEON-CUSTOM',
      configured_at: new Date().toISOString(),
      preview_url: location.href,
      text: cfg.text.split('\n'),
      options: {
        lettering: S.STYLES[cfg.style].label,
        glow: { id: c.id, name: c.name, hex: c.hex, fill: c.gas },
        tube_bore_mm: cfg.tube,
        letter_height_cm: cfg.letterCm,
        backing: RATES.backing[cfg.backing].label,
        mounting: RATES.mount[cfg.mount].label
      },
      measured: {
        tube_length_m: +quoteNow.metres.toFixed(3),
        bends: geo.bends,
        tube_runs: geo.electrodePairs,
        overall_cm: [+(quoteNow.widthM * 100).toFixed(1), +(quoteNow.heightM * 100).toFixed(1)],
        load_w: +quoteNow.watts.toFixed(1),
        psu_w: quoteNow.psu.w
      },
      price: {
        currency: RATES.currency,
        lines: quoteNow.lines.map(function (l) { return { item: l.label, basis: l.formula, amount: +l.amount.toFixed(2) }; }),
        total: +quoteNow.total.toFixed(2)
      }
    };
  }

  function initCart() {
    $('#cart').addEventListener('click', function () {
      var out = $('#payload');
      out.textContent = JSON.stringify(orderJSON(), null, 2);
      $('#payload-wrap').classList.add('open');
      $('#payload-wrap').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    });
    $('#copy').addEventListener('click', function () {
      var txt = JSON.stringify(orderJSON(), null, 2);
      $('#payload').textContent = txt;
      $('#payload-wrap').classList.add('open');
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () {
        $('#copy').textContent = 'Copied';
        setTimeout(function () { $('#copy').textContent = 'Copy JSON'; }, 1600);
      });
    });
  }

  function rateTable() {
    var t = $('#rates');
    if (!t) return;
    var rows = [
      ['Tube, 8 mm bore', '$' + RATES.tube[8].rate + ' / m', '4.8 W/m, min bend radius 17 mm'],
      ['Tube, 10 mm bore', '$' + RATES.tube[10].rate + ' / m', '6.0 W/m, min bend radius 22 mm'],
      ['Tube, 12 mm bore', '$' + RATES.tube[12].rate + ' / m', '7.2 W/m, min bend radius 27 mm'],
      ['Bend', '$' + RATES.bend.toFixed(2) + ' each', 'one heat; booked every 60 deg of turn'],
      ['Electrode pair', '$' + RATES.electrodePair.toFixed(2), 'one pair per separate tube run'],
      ['Clear acrylic', '$' + RATES.backing.clear.rate + ' / m2', '+ $' + RATES.backingEdge.toFixed(2) + ' per m of polished edge'],
      ['Black acrylic', '$' + RATES.backing.black.rate + ' / m2', '+ $' + RATES.backingEdge.toFixed(2) + ' per m of polished edge'],
      ['Power supply', '$28 - $110', 'picked from the ladder at +25% headroom'],
      ['Bench assembly', '$' + RATES.bench.toFixed(2), '24 h burn-in and packing']
    ];
    rows.forEach(function (r) {
      var tr = el('tr');
      r.forEach(function (cell, i) { tr.appendChild(el(i ? 'td' : 'th', null, cell)); });
      t.appendChild(tr);
    });
  }

  /* ------------------------------------------------------------------ go */
  function accent(hex) { document.documentElement.style.setProperty('--glow', hex); }

  function start() {
    readURL();
    var c0 = COLORS.filter(function (c) { return c.id === cfg.color; })[0];
    colorNow.set(c0.hex);
    colorPrev.copy(colorNow);
    accent(c0.hex);
    buildPanel();
    rateTable();
    initCart();
    if (!initScene()) {
      geo = B.layout(cfg.text, cfg.style, cfg.tube, cfg.letterCm * 10);
      paintQuote(1);
      return;
    }
    buildSign(reduced ? 'set' : 'bend');
    paintQuote(reduced ? 1 : 0);
    if (!reduced) startFlicker(0.35);
    tick();
    document.body.classList.add('ready');

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold: 0.16 });
    document.querySelectorAll('[data-reveal]').forEach(function (n) { io.observe(n); });
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
