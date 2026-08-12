/* ═══ BLOCKSMITH · zhizn.js — симуляция мира ═══
   Сюжет фона: Стив расчищает холмы под огромную деревню → строит шесть
   домов, колодец, фермы, сторожевую башню, мельницу, загон → сгоняет
   стадо → обносит деревню крепостной стеной; в перерывах копает шахту.
   Жители множатся и разговаривают, коровы и овцы пасутся, кошка ходит
   за хозяином. Ночью мобы атакуют (бои, заражения, крипер рвёт стену),
   днём уцелевшие зомби раскладывают зонтики и загорают в очках,
   скелеты загорают без зонтиков — им солнце не страшно. */

export function sozdatZhizn(ctx){
  const { T, mir, KUB, U, mat, pixTex, zalivka, kub,
          iskryU, zvuk: zvukSyroj, vysotaKletki, kletkiIndeksy, pole,
          tekVysota, zemPoKletke, zemlyaIM, tex, derevya = [] } = ctx;

  /* ── партитура времени: мир — таймлапс, события — реальный темп ──
     решение владельца 12.08: «никто не будет так долго сидеть на странице»;
     рутина разгоняется до ×7, режиссёрский момент мгновенно роняет темп в ×1 */
  let tekTempo = 1, zamedlenie = 0, polozheno = 0, nochT = 0, nochNomer = 0, sepKadr = false;
  const TEMPO_MAX = 8;
  /* ?uskor=N — отладочный форсаж поверх партитуры: полный цикл города за минуты.
     В продакшн-просмотре параметра нет и множитель равен 1 */
  const USKOR = Math.max(1, parseFloat(new URLSearchParams(location.search).get('uskor') || '1'));
  /* при разгоне мировые звуки глушатся — иначе звуковой спам из мелькающих ночей */
  const zvuk = (f, dl, tip, gr) => zvukSyroj(f, dl, tip, (gr || 0) * (tekTempo > 2 ? 0.25 : 1));

  /* ── живая карта высот ── */
  const spryatanoZemli = new Map();
  const tekVys = (kx, kz) => {
    const v = tekVysota.get(`${kx},${kz}`);
    return v === undefined ? vysotaKletki(kx, kz) : v;
  };
  const mirovayaVysota = (x, z) => tekVys(Math.round(x / KUB), Math.round(z / KUB)) * KUB;
  /* ── МИР 2.0, этап 1: закон сетки ──
     y-центр объекта, стоящего НА верхней грани клетки (kx,kz), высотой vysotaObj;
     единственный канонический способ ставить что-либо на землю. */
  const naZemlyu = (kx, kz, vysotaObj) => tekVys(kx, kz) * KUB + vysotaObj / 2;
  function opustitKletku(kx, kz){
    const klyuch = `${kx},${kz}`;
    const h = tekVys(kx, kz);
    const h2 = h - 1;
    tekVysota.set(klyuch, h2);
    const m4 = new T.Matrix4();
    if (kletkiIndeksy.has(klyuch)){
      m4.setPosition(kx * KUB, h2 * KUB - KUB / 2, kz * KUB);
      pole.setMatrixAt(kletkiIndeksy.get(klyuch), m4);
      pole.instanceMatrix.needsUpdate = true;
    }
    /* деревья мира стоят на рельефе: клетка опустилась — дерево следует
       (владелец 12.08: «почему дерево летает») */
    for (const d of derevya){
      if (d.srubleno || d.srublena) continue;
      if (Math.abs(d.ix - kx) < 0.75 && Math.abs(d.iz - kz) < 0.75)
        d.g.position.y = h2 * KUB;
    }
    /* верхний куб земляного столба прячется */
    const stolb = zemPoKletke.get(klyuch) || [];
    const uzhe = spryatanoZemli.get(klyuch) || 0;
    if (uzhe < stolb.length && h2 >= 0){
      m4.makeScale(0.001, 0.001, 0.001);
      m4.setPosition(kx * KUB, -900, kz * KUB);
      zemlyaIM.setMatrixAt(stolb[uzhe], m4);
      zemlyaIM.instanceMatrix.needsUpdate = true;
      spryatanoZemli.set(klyuch, uzhe + 1);
    }
    iskryU(kx * KUB, Math.max(h2, 0) * KUB + KUB * 0.5, kz * KUB);
    zvuk(165, 0.06, 'square', 0.022);
  }

  /* ── текстуры существ ── */
  const zombiKozha = pixTex(8, 8, g => zalivka(g, 8, 8, '#4ba05a', '#3f8f4e', 0.3));
  const zombiLitso = pixTex(8, 8, g => {
    zalivka(g, 8, 8, '#4ba05a', '#3f8f4e', 0.3);
    g.fillStyle = '#123018'; g.fillRect(1, 4, 2, 1); g.fillRect(5, 4, 2, 1); g.fillRect(3, 6, 2, 1);
  });
  const zombiRuka = pixTex(4, 12, g => zalivka(g, 4, 12, '#4ba05a', '#3f8f4e', 0.3));
  const zhelezo = pixTex(8, 8, g => {
    zalivka(g, 8, 8, '#c8ccd2', '#b4b9c0', 0.25);
    g.fillStyle = '#9aa0a8'; g.fillRect(0, 0, 8, 1); g.fillRect(0, 7, 8, 1);
  });
  const ryasa = pixTex(8, 12, g => { zalivka(g, 8, 12, '#7a5d43', '#6d5339', 0.3); g.fillStyle = '#5d4630'; g.fillRect(3, 0, 2, 12); });
  const ryasaNoga = pixTex(4, 12, g => zalivka(g, 4, 12, '#7a5d43', '#6d5339', 0.3));
  const zhitelLitso = pixTex(8, 8, g => {
    zalivka(g, 8, 8, '#cfa07a', '#c2946e', 0.2);
    g.fillStyle = '#3d5a2e'; g.fillRect(1, 4, 2, 1); g.fillRect(5, 4, 2, 1);
    g.fillStyle = '#b5815d'; g.fillRect(3, 4, 2, 4);
  });
  const korovaShkura = pixTex(16, 12, g => {
    zalivka(g, 16, 12, '#f2efe8', '#e6e2d8', 0.2);
    g.fillStyle = '#3d3a35'; g.fillRect(1, 2, 5, 4); g.fillRect(9, 5, 5, 5); g.fillRect(6, 0, 3, 3);
  });
  const ovtsaSherst = pixTex(12, 12, g => {
    zalivka(g, 12, 12, '#f6f4ee', '#e9e6dd', 0.35);
    g.fillStyle = '#dedbd1'; g.fillRect(2, 2, 2, 2); g.fillRect(7, 6, 2, 2); g.fillRect(4, 9, 2, 2);
  });
  const pesok = pixTex(16, 16, g => {
    zalivka(g, 16, 16, '#e8d9a0', '#ddcd8f', 0.3);
    g.fillStyle = '#d1c184'; g.fillRect(3, 4, 2, 1); g.fillRect(10, 8, 2, 1); g.fillRect(6, 12, 2, 1);
  });
  const ovtsaMorda = pixTex(8, 8, g => {
    zalivka(g, 8, 8, '#3a3733', '#2f2c29', 0.25);
    g.fillStyle = '#f2f0ea'; g.fillRect(1, 2, 2, 1); g.fillRect(5, 2, 2, 1);
  });
  const koshkaMeh = pixTex(8, 8, g => { zalivka(g, 8, 8, '#d9903f', '#c98235', 0.3); g.fillStyle = '#f2efe8'; g.fillRect(0, 5, 8, 3); });
  const kost = pixTex(8, 8, g => zalivka(g, 8, 8, '#e8e6df', '#cdcabf', 0.3));
  const kostRuka = pixTex(4, 12, g => { zalivka(g, 4, 12, '#e8e6df', '#cdcabf', 0.3); g.fillStyle = '#b9b6ac'; g.fillRect(0, 5, 4, 1); });
  const cherep = pixTex(8, 8, g => {
    zalivka(g, 8, 8, '#e8e6df', '#d6d3c8', 0.2);
    g.fillStyle = '#2a2a28'; g.fillRect(1, 3, 2, 2); g.fillRect(5, 3, 2, 2); g.fillRect(3, 6, 2, 1);
  });
  const kriperKozha = pixTex(8, 8, g => zalivka(g, 8, 8, '#58c05a', '#47a849', 0.4));
  const kriperLitso = pixTex(8, 8, g => {
    zalivka(g, 8, 8, '#58c05a', '#47a849', 0.4);
    g.fillStyle = '#0d1f0d';
    g.fillRect(1, 2, 2, 2); g.fillRect(5, 2, 2, 2);
    g.fillRect(3, 4, 2, 3); g.fillRect(2, 5, 1, 2); g.fillRect(5, 5, 1, 2);
  });
  const rostokTex = pixTex(8, 8, g => { zalivka(g, 8, 8, '#7ec24a', '#6dae3d', 0.4); g.fillStyle = '#5b9631'; g.fillRect(3, 0, 2, 8); });

  const TEX_ZOMBI = { litso: zombiLitso, golBok: zombiKozha, golZad: zombiKozha, golVerh: zombiKozha, golNiz: zombiKozha,
    tors: tex.tors, ruka: zombiRuka, rukV: zombiKozha, rukN: zombiKozha, noga: tex.noga, nogV: tex.nogV, nogN: tex.nogN };
  const TEX_ZHITEL = { litso: zhitelLitso, golBok: tex.golNiz, golZad: tex.golNiz, golVerh: tex.golNiz, golNiz: tex.golNiz,
    tors: ryasa, ruka: ryasaNoga, rukV: ryasa, rukN: tex.golNiz, noga: ryasaNoga, nogV: ryasa, nogN: tex.nogN };
  const TEX_SKELET = { litso: cherep, golBok: kost, golZad: kost, golVerh: kost, golNiz: kost,
    tors: kost, ruka: kostRuka, rukV: kost, rukN: kost, noga: kostRuka, nogV: kost, nogN: kost };

  /* ── реестры ── */
  const sushchestva = [];
  const zhiteli = [];
  const moby = [];          /* зомби и скелеты */
  const skot = [];          /* коровы и овцы */
  const berezy = [];        /* C5: берёзы — рубятся в фазе 'raschistka', если попали в пятно */
  const kustyICvety = [];   /* C4: кусты/цветы — тоже участвуют в расчистке */
  let fonStiv = null, koshka = null, kriper = null;
  let solnVys = 1, den = 0;
  const zanyato = new Set();      /* клетки, занятые стенами построек */
  const kletka = v => Math.round(v / KUB);
  /* детерминированный псевдослучайный разброс без Math.random — для статичной геометрии (C4/C5) */
  const hesh = i => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };

  /* ── E1: лук скелета — дуга из 3 боксов, цепочкой как хвост кошки (B4) ── */
  const lukDerevo = pixTex(4, 4, g => zalivka(g, 4, 4, '#4a3524', '#3c2a1c', 0.25));
  function sdelatLuk(){
    const gr = new T.Group();
    const segH = KUB * 0.3;
    let roditel = gr;
    for (let i = 0; i < 3; i++){
      const seg = new T.Mesh(new T.BoxGeometry(KUB * 0.06, segH, KUB * 0.06), mat(lukDerevo));
      seg.geometry.translate(0, segH / 2, 0);
      seg.rotation.z = 0.55;
      roditel.add(seg);
      roditel = seg;
    }
    gr.rotation.z = -0.85;   /* центрируем дугу вокруг кисти */
    gr.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return gr;
  }

  /* ── фабрики ── */
  function chelovechek(tt){
    const gr = new T.Group();
    const t6 = (a, b, c, d) => [mat(a), mat(a), mat(b), mat(c), mat(d), mat(a)];
    const tor = kub(8, 12, 4, t6(tt.tors, tt.tors, tt.tors, tt.tors)); tor.position.y = 18 * U;
    const gol = kub(8, 8, 8, [mat(tt.golBok), mat(tt.golBok), mat(tt.golVerh), mat(tt.golNiz), mat(tt.litso), mat(tt.golZad)]);
    gol.position.y = 28 * U;
    const rL = kub(4, 12, 4, t6(tt.ruka, tt.rukV, tt.rukN, tt.ruka), -4.5); rL.position.set(-6 * U, 22.5 * U, 0);
    const rR = kub(4, 12, 4, t6(tt.ruka, tt.rukV, tt.rukN, tt.ruka), -4.5); rR.position.set(6 * U, 22.5 * U, 0);
    const nL = kub(4, 12, 4, t6(tt.noga, tt.nogV, tt.nogN, tt.noga), -6); nL.position.set(-2 * U, 12 * U, 0);
    const nR = kub(4, 12, 4, t6(tt.noga, tt.nogV, tt.nogN, tt.noga), -6); nR.position.set(2 * U, 12 * U, 0);
    gr.add(tor, gol, rL, rR, nL, nR);
    gr.traverse(o => { if (o.isMesh) o.castShadow = true; });
    mir.add(gr);
    return { g: gr, gol, tor, rL, rR, nL, nR };
  }
  function novyGumanoid(tip, x, z, rebyonok){
    const tt = tip === 'zombi' ? TEX_ZOMBI : (tip === 'skelet' ? TEX_SKELET : (tip === 'zhitel' ? TEX_ZHITEL : tex));
    const s = { tip, ...chelovechek(tt), x, z, rotY: 0, sost: 'idle', faza: Math.random() * 9,
      cel: null, t: 0, hp: 2, planT: 0, rebyonok: !!rebyonok };
    sushchestva.push(s);
    if (tip === 'zhitel'){
      zhiteli.push(s);
      /* D1: первый взрослый заселенец — фермер, второй — торговец у колодца */
      if (!s.rebyonok){
        const vzroslyh = zhiteli.filter(z => !z.rebyonok).length;
        if (vzroslyh === 1) naznachitFermera(s);
        else if (vzroslyh === 2) s.rol = 'torgovets';
      }
    }
    if (tip === 'zombi' || tip === 'skelet'){
      moby.push(s);
      if (tip === 'zombi'){
        const ochki = new T.Mesh(new T.BoxGeometry(7.4 * U, 1.7 * U, 0.7 * U),
          new T.MeshBasicNodeMaterial({ color: 0x15161a }));
        ochki.position.set(0, 0.6 * U, 4.2 * U);
        ochki.visible = false;
        s.gol.add(ochki);
        s.ochki = ochki;
      }
      if (tip === 'skelet'){
        /* E1: лук в левой руке — виден всегда, не переключается */
        const luk = sdelatLuk();
        luk.position.set(0, -8.5 * U, 1.4 * U);
        luk.rotation.x = 0.25;
        s.rL.add(luk);
        s.luk = luk;
      }
    }
    return s;
  }

  /* ── D1: фермер — соломенная шляпа, полив грядок, капли-частицы ── */
  const solomaTex = pixTex(8, 8, g => zalivka(g, 8, 8, '#e8c23a', '#d1ab2e', 0.25));
  function naznachitFermera(s){
    s.rol = 'fermer';
    const polya = new T.Mesh(new T.BoxGeometry(9 * U, 1.6 * U, 9 * U), mat(solomaTex));
    polya.position.set(0, 4.6 * U, 0);
    const tulya = new T.Mesh(new T.BoxGeometry(4 * U, 2.4 * U, 4 * U), mat(solomaTex));
    tulya.position.set(0, 6 * U, 0);
    s.gol.add(polya, tulya);
  }
  const KAPLI_MAX = 12;
  const kapliChastitsy = [];
  for (let i = 0; i < KAPLI_MAX; i++){
    const m = new T.Mesh(new T.BoxGeometry(U * 0.7, U * 0.7, U * 0.7),
      new T.MeshBasicNodeMaterial({ color: 0x4fa8e0, transparent: true, opacity: 0 }));
    m.visible = false;
    mir.add(m);
    kapliChastitsy.push({ m, akt: false, t: 0 });
  }
  function dobavitKapli(x, y, z){
    const n = 4 + Math.floor(Math.random() * 3);   /* 4..6 капель */
    let postavleno = 0;
    for (const c of kapliChastitsy){
      if (c.akt) continue;
      if (postavleno >= n) break;
      c.akt = true; c.t = 0;
      c.m.position.set(x + (Math.random() - 0.5) * KUB * 0.4, y, z + (Math.random() - 0.5) * KUB * 0.4);
      c.m.material.opacity = 0.85;
      c.m.visible = true;
      postavleno++;
    }
  }
  function obnovitKapli(dt){
    for (const c of kapliChastitsy){
      if (!c.akt) continue;
      c.t += dt;
      c.m.position.y -= dt * 46;
      c.m.material.opacity = Math.max(0, 0.85 - c.t * 1.7);
      if (c.t > 0.5){ c.akt = false; c.m.visible = false; }
    }
  }

  function novyZont(x, z){
    const gr = new T.Group();
    const palka = new T.Mesh(new T.BoxGeometry(1.2 * U, 26 * U, 1.2 * U), mat(tex.doski));
    palka.position.y = 13 * U;
    gr.add(palka);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++){
      const kupol = new T.Mesh(new T.BoxGeometry(KUB * 0.52, 2.2 * U, KUB * 0.52),
        new T.MeshBasicNodeMaterial({ color: (dx + dz + 2) % 2 ? 0xf2efe8 : 0xd94b3a }));
      kupol.position.set(dx * KUB * 0.48, 24 * U, dz * KUB * 0.48);
      gr.add(kupol);
    }
    gr.rotation.z = 0.15;
    gr.position.set(x + KUB * 0.6, naZemlyu(kletka(x), kletka(z), 0), z);
    gr.traverse(o => { if (o.isMesh) o.castShadow = true; });
    mir.add(gr);
    return gr;
  }
  function novoeZhivotnoe(vid, x, z){
    const shk = vid === 'korova' ? korovaShkura : ovtsaSherst;
    const gr = new T.Group();
    const pushnaya = vid === 'ovtsa';
    const telo = new T.Mesh(new T.BoxGeometry(pushnaya ? 12 * U : 10 * U, pushnaya ? 10 * U : 8 * U, pushnaya ? 17 * U : 16 * U), mat(shk));
    telo.position.y = 12 * U;
    if (pushnaya){
      /* клоки шерсти — овца пушистая */
      for (const [dx, dy, dz] of [[-5, 4, -4], [5, 4, 2], [0, 5.4, -7], [0, 5.4, 6], [-5, 3, 6], [5, 3, -6]]){
        const klok = new T.Mesh(new T.BoxGeometry(4.4 * U, 4 * U, 4.4 * U), mat(ovtsaSherst));
        klok.position.set(dx * U, (12 + dy) * U, dz * U);
        gr.add(klok);
      }
    }
    const gol = new T.Mesh(new T.BoxGeometry(pushnaya ? 4.6 * U : 6 * U, pushnaya ? 4.6 * U : 6 * U, 5 * U), mat(vid === 'ovtsa' ? ovtsaMorda : korovaShkura));
    gol.position.set(0, 15 * U, pushnaya ? 10.5 * U : 10 * U);
    /* B4: челюсть-бокс на голове — жуёт, когда pastis */
    const chelyust = new T.Mesh(new T.BoxGeometry((pushnaya ? 3.6 : 4.6) * U, 1.6 * U, 2 * U), mat(vid === 'ovtsa' ? ovtsaMorda : korovaShkura));
    chelyust.geometry.translate(0, -0.8 * U, 1 * U);   /* пивот у основания челюсти */
    chelyust.position.set(0, -1.8 * U, pushnaya ? 1.6 * U : 2 * U);
    gol.add(chelyust);
    const nogi = [];
    for (const [dx, dz] of [[-3, -5], [3, -5], [-3, 5], [3, 5]]){
      const n = new T.Mesh(new T.BoxGeometry(pushnaya ? 2.4 * U : 3 * U, 8 * U, pushnaya ? 2.4 * U : 3 * U), mat(vid === 'ovtsa' ? ovtsaMorda : korovaShkura));
      n.geometry.translate(0, -4 * U, 0);
      n.position.set(dx * U, 8 * U, dz * U);
      gr.add(n); nogi.push(n);
    }
    gr.add(telo, gol);
    gr.traverse(o => { if (o.isMesh) o.castShadow = true; });
    mir.add(gr);
    const s = { tip: vid, g: gr, gol, chelyust, nogi, x, z, rotY: 0, sost: 'brodit', faza: Math.random() * 9, cel: null, t: 0, vZagone: false };
    sushchestva.push(s); skot.push(s);
    return s;
  }
  function novayaKoshka(x, z){
    const gr = new T.Group();
    const telo = new T.Mesh(new T.BoxGeometry(3.4 * U, 3 * U, 9 * U), mat(koshkaMeh));
    telo.position.y = 3.4 * U;
    const gol = new T.Mesh(new T.BoxGeometry(3.6 * U, 3 * U, 3 * U), mat(koshkaMeh));
    gol.position.set(0, 4.6 * U, 5.4 * U);
    const uhoL = new T.Mesh(new T.BoxGeometry(U, U, U), mat(koshkaMeh)); uhoL.position.set(-1 * U, 6.4 * U, 5 * U);
    const uhoR = uhoL.clone(); uhoR.position.x = 1 * U;
    /* B4: хвост из 3 сегментов на шарнирах — волна идёт от основания к кончику */
    const hvostSegs = [];
    {
      const segDlin = 1.7 * U;
      let roditel = gr;
      for (let i = 0; i < 3; i++){
        const uzost = 1 - i * 0.15;
        const seg = new T.Mesh(new T.BoxGeometry(0.9 * U * uzost, 0.9 * U * uzost, segDlin), mat(koshkaMeh));
        seg.geometry.translate(0, 0, -segDlin / 2);
        seg.position.set(0, i === 0 ? 4.4 * U : 0, i === 0 ? -4.5 * U : -segDlin);
        roditel.add(seg);
        hvostSegs.push(seg);
        roditel = seg;
      }
    }
    gr.add(telo, gol, uhoL, uhoR);
    gr.traverse(o => { if (o.isMesh) o.castShadow = true; });
    mir.add(gr);
    const s = { tip: 'koshka', g: gr, gol, hvostSegs, x, z, rotY: 0, sost: 'idle', faza: Math.random() * 9, t: 0 };
    sushchestva.push(s);
    return s;
  }
  function novyKriper(x, z){
    const gr = new T.Group();
    const telo = kub(6, 14, 5, [mat(kriperKozha), mat(kriperKozha), mat(kriperKozha), mat(kriperKozha), mat(kriperKozha), mat(kriperKozha)]);
    telo.position.y = 11 * U;
    const gol = kub(8, 8, 8, [mat(kriperKozha), mat(kriperKozha), mat(kriperKozha), mat(kriperKozha), mat(kriperLitso), mat(kriperKozha)]);
    gol.position.y = 22 * U;
    for (const [dx, dz] of [[-2, -3], [2, -3], [-2, 3], [2, 3]]){
      const n = kub(4, 6, 4, [mat(kriperKozha), mat(kriperKozha), mat(kriperKozha), mat(kriperKozha), mat(kriperKozha), mat(kriperKozha)], -3);
      n.position.set(dx * U, 6 * U, dz * U);
      gr.add(n);
    }
    gr.add(telo, gol);
    gr.traverse(o => { if (o.isMesh) o.castShadow = true; });
    mir.add(gr);
    const s = { tip: 'kriper', g: gr, gol, x, z, rotY: 0, sost: 'walk', faza: 0, t: 0, mig: 0 };
    sushchestva.push(s);
    return s;
  }

  /* ── E2: дроп — гнилая плоть/кость на месте гибели моба от удара ── */
  const dropGnilTex = pixTex(4, 4, g => zalivka(g, 4, 4, '#2f4a1e', '#25391a', 0.3));
  const dropKostTex = pixTex(4, 4, g => zalivka(g, 4, 4, '#e8e6df', '#cdcabf', 0.3));
  const dropGnilGeo = new T.BoxGeometry(KUB * 0.22, KUB * 0.22, KUB * 0.22);
  const dropKostGeo = new T.BoxGeometry(KUB * 0.3, KUB * 0.1, KUB * 0.1);
  const matDropGnil = mat(dropGnilTex), matDropKost = mat(dropKostTex);
  const DROP_MAX = 8;
  const dropy = [];
  for (let i = 0; i < DROP_MAX; i++){
    const m = new T.Mesh(dropGnilGeo, matDropGnil);
    m.visible = false; m.castShadow = true;
    mir.add(m);
    dropy.push({ m, akt: false, t: 0, x: 0, y: 0, z: 0, letit: false, letT: 0 });
  }
  function sozdatDrop(tip, x, z){
    const svob = dropy.find(d => !d.akt);
    if (!svob) return;
    svob.akt = true; svob.t = 0; svob.letit = false; svob.letT = 0;
    svob.m.geometry = tip === 'kost' ? dropKostGeo : dropGnilGeo;
    svob.m.material = tip === 'kost' ? matDropKost : matDropGnil;
    const y0 = naZemlyu(kletka(x), kletka(z), tip === 'kost' ? KUB * 0.12 : KUB * 0.22);
    svob.x = x; svob.y = y0; svob.z = z;
    svob.m.position.set(x, y0, z);
    svob.m.rotation.set(0, Math.random() * Math.PI * 2, 0);
    svob.m.scale.setScalar(1);
    svob.m.visible = true;
  }
  function obnovitDropy(dt){
    for (const d of dropy){
      if (!d.akt) continue;
      if (d.letit){
        if (!fonStiv){ d.akt = false; d.m.visible = false; continue; }
        d.letT += dt;
        const k = Math.min(1, d.letT / 0.3);
        const ty = mirovayaVysota(fonStiv.x, fonStiv.z) + 20 * U;
        d.m.position.set(d.x + (fonStiv.x - d.x) * k, d.y + (ty - d.y) * k, d.z + (fonStiv.z - d.z) * k);
        d.m.scale.setScalar(1 - k);
        if (k >= 1){ d.akt = false; d.m.visible = false; d.m.scale.setScalar(1); }
        continue;
      }
      d.t += dt;
      d.m.rotation.y += dt;
      if (fonStiv && fonStiv.g.visible && Math.hypot(fonStiv.x - d.x, fonStiv.z - d.z) < KUB * 1.2){
        d.letit = true; d.letT = 0;
        zvuk(660, 0.08, 'sine', 0.03);
        continue;
      }
      if (d.t > 10){ d.akt = false; d.m.visible = false; }
    }
  }

  /* ── E1: стрелы скелета — пул 6 штук, летят по параболе, промах втыкается в землю ── */
  const strelaTex = pixTex(4, 4, g => zalivka(g, 4, 4, '#8a6a3a', '#6f5228', 0.3));
  const strelaGeo = new T.BoxGeometry(KUB * 0.5, KUB * 0.04, KUB * 0.04);
  const matStrela = mat(strelaTex);
  const STRELA_MAX = 6;
  const strely = [];
  for (let i = 0; i < STRELA_MAX; i++){
    const m = new T.Mesh(strelaGeo, matStrela);
    m.visible = false;
    mir.add(m);
    strely.push({ m, akt: false, t: 0, dur: 0.6, x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0,
      strelok: null, cel: null, vtyk: false, vtykT: 0 });
  }
  function vypustitStrelu(strelok, cel){
    const svob = strely.find(a => !a.akt);
    if (!svob) return;
    svob.akt = true; svob.t = 0; svob.vtyk = false; svob.vtykT = 0;
    svob.strelok = strelok; svob.cel = cel;
    svob.x0 = strelok.x; svob.y0 = mirovayaVysota(strelok.x, strelok.z) + 24 * U; svob.z0 = strelok.z;
    svob.x1 = cel.x; svob.y1 = mirovayaVysota(cel.x, cel.z) + 20 * U; svob.z1 = cel.z;
    svob.m.visible = true;
    zvuk(500, 0.05, 'square', 0.02);
  }
  function obnovitStrely(dt){
    for (const a of strely){
      if (!a.akt) continue;
      if (a.vtyk){
        a.vtykT += dt;
        if (a.vtykT > 8){ a.akt = false; a.m.visible = false; }
        continue;
      }
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      const cx = a.x0 + (a.x1 - a.x0) * k, cz = a.z0 + (a.z1 - a.z0) * k;
      const cy = a.y0 + (a.y1 - a.y0) * k + Math.sin(k * Math.PI) * KUB * 0.7;
      a.m.position.set(cx, cy, cz);
      a.m.rotation.y = Math.atan2(a.x1 - a.x0, a.z1 - a.z0);
      a.m.rotation.x = -Math.PI / 2 + k * Math.PI;   /* наклон по дуге: вверх → вниз */
      if (k >= 1){
        const cel = a.cel;
        const otsel = cel && !cel.mertv ? Math.hypot(cel.x - a.x1, cel.z - a.z1) : 999;
        if (cel && !cel.mertv && otsel < KUB * 1.2){
          vspyshkaUdara(cel);
          const ot = Math.hypot(cel.x - a.strelok.x, cel.z - a.strelok.z) || 1;
          cel.x += (cel.x - a.strelok.x) / ot * KUB * 0.8; cel.z += (cel.z - a.strelok.z) / ot * KUB * 0.8;
          zvuk(320, 0.08, 'square', 0.03);
          a.akt = false; a.m.visible = false;
        } else {
          a.vtyk = true; a.vtykT = 0;
          a.m.position.y = mirovayaVysota(a.x1, a.z1) + KUB * 0.15;
          a.m.rotation.x = -Math.PI / 2.4;
        }
      }
    }
  }

  /* ── броня: кожа после стада, железо только из шахты ── */
  const kozha = pixTex(8, 8, g => zalivka(g, 8, 8, '#8a5a30', '#7b4f29', 0.3));
  let bronUroven = 0;
  function nadetBronyu(uroven){
    const s = fonStiv;
    if (!s || uroven <= bronUroven) return;
    zamedlenie = Math.max(zamedlenie, 3);   /* смена брони — момент, темп ×1 */
    bronUroven = uroven;
    if (!s.bronya){
      const nagrK = new T.Mesh(new T.BoxGeometry(9 * U, 12.6 * U, 5 * U), mat(kozha));
      nagrK.position.copy(s.tor.position);
      const nagrZh = new T.Mesh(new T.BoxGeometry(9 * U, 12.6 * U, 5 * U), mat(zhelezo));
      nagrZh.position.copy(s.tor.position);
      /* каска: сидит на макушке, лицо открыто */
      const shlem = new T.Mesh(new T.BoxGeometry(8.8 * U, 4.4 * U, 8.8 * U), mat(zhelezo));
      shlem.position.copy(s.gol.position); shlem.position.y += 2.4 * U;
      const ponozhi = [], boty = [];
      for (const noga of [s.nL, s.nR]){
        const p = new T.Mesh(new T.BoxGeometry(4.7 * U, 6.6 * U, 4.7 * U), mat(zhelezo));
        p.position.set(0, -3.2 * U, 0);
        noga.add(p); ponozhi.push(p);
        const bt = new T.Mesh(new T.BoxGeometry(4.9 * U, 3 * U, 5.4 * U), mat(zhelezo));
        bt.position.set(0, -10.6 * U, 0.4 * U);
        noga.add(bt); boty.push(bt);
      }
      s.bronya = { nagrK, nagrZh, shlem, ponozhi, boty };
      for (const m of [nagrK, nagrZh, shlem, ...ponozhi, ...boty]) m.visible = false;
      s.g.add(nagrK, nagrZh, shlem);
    }
    const br = s.bronya;
    if (uroven === 1) br.nagrK.visible = true;                       /* кожаный нагрудник */
    if (uroven === 2){ br.nagrK.visible = false; br.nagrZh.visible = true; }
    if (uroven === 3) br.shlem.visible = true;
    if (uroven === 4) br.ponozhi.forEach(p => p.visible = true);
    if (uroven === 5) br.boty.forEach(p => p.visible = true);
    iskryU(s.x, KUB * 1.6, s.z);
    zvuk(820 + uroven * 60, 0.16, 'sine', 0.045);
  }

  /* ── ГОРОД: программа ── */
  const DOM_X = 2 * KUB, DOM_Z = 2 * KUB;
  const DOM_VHOD = [DOM_X, DOM_Z - 2.4 * KUB];
  /* ДОМ КАК В ДЕРЕВНЕ (референс владельца 12.08): каменный цоколь и углы,
     светлые дощатые стены, двускатная ступенчатая крыша с выносом, фронтоны,
     дверной проём 1×2 и четыре оконных проёма (стёкла ставит ukrasitDom) */
  function planDoma(cx, cz, r){
    const b = [];
    const Y = s => s * KUB + KUB / 2;
    for (let sloy = 0; sloy < 3; sloy++)
      for (let px = -r; px <= r; px++) for (let pz = -r; pz <= r; pz++){
        const kray = (Math.abs(px) === r || Math.abs(pz) === r);
        if (!kray) continue;
        const ugol = Math.abs(px) === r && Math.abs(pz) === r;
        if (pz === -r && px === 0 && sloy < 2) continue;              /* дверь 1×2 */
        if (sloy === 1 && pz === -r && Math.abs(px) === 1) continue;  /* окна фасада */
        if (sloy === 1 && Math.abs(px) === r && pz === 0) continue;   /* окна боков */
        b.push({ p: [cx + px * KUB, Y(sloy), cz + pz * KUB], vid: (sloy === 0 || ugol) ? 'k' : 'ds' });
      }
    /* двускатная крыша: конёк вдоль X, ступени по Z, вынос на блок с торцов */
    for (let px = -r - 1; px <= r + 1; px++){
      for (const pz of [-3, -2, 2, 3]) b.push({ p: [cx + px * KUB, Y(3), cz + pz * KUB], vid: 'kr' });
      for (const pz of [-1, 1])        b.push({ p: [cx + px * KUB, Y(4), cz + pz * KUB], vid: 'kr' });
      b.push({ p: [cx + px * KUB, Y(5), cz], vid: 'kr' });
    }
    /* фронтоны под скатами — светлые доски */
    for (const px of [-r, r]){
      for (const pz of [-1, 0, 1]) b.push({ p: [cx + px * KUB, Y(3), cz + pz * KUB], vid: 'ds' });
      b.push({ p: [cx + px * KUB, Y(4), cz], vid: 'ds' });
    }
    return b;
  }
  const programma = [];
  const nuzhnoRovnyat = new Set();   /* клетки под будущими постройками */
  const DOMA = [[2, 2], [-4, 1.5], [5.5, -1.5], [-1, 5.2], [5, 4.5], [-5.5, -3]];
  const FONARI_POZ = [[2, 5], [-2, 4], [4, 1], [-3, -1]];   /* C3: 4 фонаря по углам площади у колодца */
  const dobavitDom = i => {
    planDoma(DOMA[i][0] * KUB, DOMA[i][1] * KUB, 2).forEach(b =>
      programma.push({ vid: b.vid, p: b.p, sloy: b.p[1] < KUB ? 0 : 1 }));
    for (let px = -3; px <= 3; px++) for (let pz = -3; pz <= 3; pz++)
      nuzhnoRovnyat.add(`${Math.round(DOMA[i][0]) + px},${Math.round(DOMA[i][1]) + pz}`);
    programma.push({ vid: 'novosel', dom: i });   /* дом готов — в него въезжает житель */
  };
  const dobavitFermu = (cx, cz) => {
    for (let rx = 0; rx < 5; rx++) for (let rz = 0; rz < 3; rz++)
      programma.push({ vid: 'rostok', p: [(cx + rx) * KUB, 0, (cz + rz) * KUB], vysObj: KUB * 0.36 });
  };
  /* МИР 2.0, этап 2: расчистка-зрелище — первая фаза, до первого дома */
  programma.push({ vid: 'raschistka' });
  dobavitDom(0);
  programma.push({ vid: 'shahta', n: 4 });
  /* пляж с морем — Стив строит его для будущих «отдыхающих»; полный KUB³, верх в сетке */
  for (let px = 10; px <= 13; px++) for (let pz = 1; pz <= 3; pz++)
    programma.push({ vid: 'pesok', p: [px * KUB, 0, pz * KUB], vysObj: KUB });
  programma.push({ vid: 'more' });
  dobavitDom(1);
  /* загон и сгон стада — переставлено раньше: владелец должен увидеть смену брони
     в первые минуты, а не после мельницы */
  {
    const stolby = [];
    for (let i = 0; i <= 5; i++){ stolby.push([3 + i, 7]); stolby.push([3 + i, 10]); }
    for (let j = 8; j <= 9; j++){ stolby.push([3, j]); if (j !== 8) stolby.push([8, j]); }  /* проход у [8,8] */
    for (const [kx, kz] of stolby)
      programma.push({ vid: 'stolb', p: [kx * KUB, 0, kz * KUB], vysObj: KUB * 1.1 });
    /* перекладины — между соседними столбами (расстояние ровно 1 клетка по сетке);
       у ворот [8,8] соседей на расстоянии 1 нет — проём остаётся пустым сам собой */
    for (let i = 0; i < stolby.length; i++)
      for (let j = i + 1; j < stolby.length; j++){
        const [ax, az] = stolby[i], [bx, bz] = stolby[j];
        if (Math.abs(ax - bx) + Math.abs(az - bz) !== 1) continue;
        const mx = (ax + bx) / 2 * KUB, mz = (az + bz) / 2 * KUB;
        const rot = az === bz ? 0 : Math.PI / 2;   /* вдоль X без поворота, вдоль Z — на 90° */
        programma.push({ vid: 'perekladina', p: [mx, 0, mz], vysObj: 0, nadZemley: KUB * 0.45, rot });
        programma.push({ vid: 'perekladina', p: [mx, 0, mz], vysObj: 0, nadZemley: KUB * 0.85, rot });
      }
  }
  programma.push({ vid: 'sgon' });
  dobavitFermu(7.5, -3.5);
  dobavitDom(2);
  /* C3: после третьего дома Стив ставит уличные фонари */
  for (const [fx, fz] of FONARI_POZ) programma.push({ vid: 'fonar', p: [fx * KUB, 0, fz * KUB] });
  /* колодец */
  for (const [kx, kz] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]])
    programma.push({ vid: 'k', p: [(0 + kx) * KUB, KUB / 2, (7.6 + kz) * KUB] });
  /* D3: колокол тревоги встаёт рядом с колодцем */
  programma.push({ vid: 'kolokol', p: [1.5 * KUB, 0, 6.2 * KUB] });
  programma.push({ vid: 'shahta', n: 6 });
  dobavitDom(3);
  /* башня */
  for (let sloy = 0; sloy < 6; sloy++)
    for (const [bx, bz] of [[0, 0], [1, 0], [0, 1], [1, 1]])
      programma.push({ vid: 'k', p: [(-7 + bx) * KUB, sloy * KUB + KUB / 2, (-5 + bz) * KUB] });
  for (let bx = -1; bx <= 2; bx++) for (let bz = -1; bz <= 2; bz++)
    programma.push({ vid: 'd', p: [(-7 + bx) * KUB, 6 * KUB + KUB / 2, (-5 + bz) * KUB] });
  dobavitDom(4);
  /* мельница */
  for (let sloy = 0; sloy < 5; sloy++)
    programma.push({ vid: 'd', p: [8.6 * KUB, sloy * KUB + KUB / 2, -4.2 * KUB] });
  dobavitFermu(-9, 4);
  dobavitDom(5);
  /* крепостная стена R=10 с воротами */
  {
    const R = 10, kletki = [];
    for (let i = -R; i <= R; i++){
      kletki.push([i, -R], [i, R]);
      if (Math.abs(i) !== R) kletki.push([-R, i], [R, i]);
    }
    for (let sloy = 0; sloy < 2; sloy++)
      for (const [kx, kz] of kletki){
        if (kz === R && (kx === 0 || kx === -1)) continue;
        /* боковые проходы напротив точек спавна (±11,2) — иначе после достройки
           стены мобы, заспавненные с востока/запада, физически не войдут */
        if (Math.abs(kx) === R && (kz === 1 || kz === 2)) continue;
        programma.push({ vid: 'k', p: [kx * KUB, 0, kz * KUB], sloy, poRelefu: true });
      }
  }
  programma.push({ vid: 'shahta', n: 10 });

  /* ── C4: флора — цветы и кусты на поляне, расставлены детерминированно ── */
  {
    const OSOBYE_KLETKI = [[-2, -1], [0, -2]];   /* верстак/приземление — не занимать */
    const zanyatoDlyaFlory = (kx, kz) =>
      DOMA.some(([dx, dz]) => Math.hypot(kx - dx, kz - dz) < 1.2) ||
      OSOBYE_KLETKI.some(([dx, dz]) => Math.hypot(kx - dx, kz - dz) < 1);
    const stebelTex = pixTex(4, 4, g => zalivka(g, 4, 4, '#5f9c36', '#4f8a2c', 0.3));
    const butonKr = pixTex(4, 4, g => zalivka(g, 4, 4, '#d94b3a', '#c23f30', 0.25));
    const butonZh = pixTex(4, 4, g => zalivka(g, 4, 4, '#e8c23a', '#d1ab2e', 0.25));
    const kustTex = pixTex(8, 8, g => zalivka(g, 8, 8, '#427c27', '#386b21', 0.35));
    const zanyatyeKletki = [];
    let i = 0, postavleno = 0;
    while (postavleno < 14 && i < 300){
      const a = i * 2.4;                          /* золотой угол ≈ 137.5° в радианах */
      const r = 2.4 + (i % 9) * 0.85;
      const kx = Math.round(Math.cos(a) * r), kz = Math.round(Math.sin(a) * r);
      i++;
      if (Math.hypot(kx, kz) >= 10) continue;
      if (vysotaKletki(kx, kz) !== 0) continue;
      if (zanyatoDlyaFlory(kx, kz)) continue;
      if (zanyatyeKletki.some(([zx, zz]) => zx === kx && zz === kz)) continue;
      zanyatyeKletki.push([kx, kz]);
      const x0 = kx * KUB + (hesh(i) - 0.5) * KUB * 0.7;
      const z0 = kz * KUB + (hesh(i + 50) - 0.5) * KUB * 0.7;
      const y0 = naZemlyu(kx, kz, 0);
      const stebel = new T.Mesh(new T.BoxGeometry(KUB * 0.06, KUB * 0.5, KUB * 0.06), mat(stebelTex));
      stebel.position.set(x0, y0 + KUB * 0.25, z0);
      const buton = new T.Mesh(new T.BoxGeometry(KUB * 0.16, KUB * 0.16, KUB * 0.16), mat(i % 2 ? butonKr : butonZh));
      buton.position.set(x0, y0 + KUB * 0.56, z0);
      mir.add(stebel, buton);
      kustyICvety.push({ tip: 'tsvetok', kx, kz, meshi: [stebel, buton], zhiv: true });
      postavleno++;
    }
    postavleno = 0;
    while (postavleno < 6 && i < 700){
      const a = i * 2.4;
      const r = 2.9 + (i % 7) * 0.9;
      const kx = Math.round(Math.cos(a) * r), kz = Math.round(Math.sin(a) * r);
      i++;
      if (Math.hypot(kx, kz) >= 10) continue;
      if (vysotaKletki(kx, kz) !== 0) continue;
      if (zanyatoDlyaFlory(kx, kz)) continue;
      if (zanyatyeKletki.some(([zx, zz]) => zx === kx && zz === kz)) continue;
      zanyatyeKletki.push([kx, kz]);
      const x0 = kx * KUB, z0 = kz * KUB;
      const y0 = naZemlyu(kx, kz, 0);
      const kol = hesh(i * 7 + 3) > 0.4 ? 3 : 2;
      const ofs = [[0, 0, 0], [KUB * 0.32, KUB * 0.06, KUB * 0.1], [-KUB * 0.28, KUB * 0.1, -KUB * 0.22]];
      const kustMeshi = [];
      for (let k = 0; k < kol; k++){
        const [ox, oy, oz] = ofs[k];
        const list = new T.Mesh(new T.BoxGeometry(KUB * 0.42, KUB * 0.38, KUB * 0.42), mat(kustTex));
        list.position.set(x0 + ox, y0 + KUB * 0.22 + oy, z0 + oz);
        list.castShadow = true;
        mir.add(list);
        kustMeshi.push(list);
      }
      kustyICvety.push({ tip: 'kust', kx, kz, meshi: kustMeshi, zhiv: true });
      postavleno++;
    }
  }

  /* ── C5: берёзы — второй вид дерева, кора со штрихами, крона светлее ── */
  {
    const berezaKora = pixTex(16, 16, g => {
      zalivka(g, 16, 16, '#e8e4d8', '#dcd8ca', 0.15);
      g.fillStyle = '#2a2824';
      g.fillRect(2, 1, 3, 1); g.fillRect(8, 3, 2, 1); g.fillRect(4, 6, 3, 1); g.fillRect(11, 8, 2, 1);
      g.fillRect(1, 10, 3, 1); g.fillRect(9, 12, 3, 1); g.fillRect(5, 14, 2, 1);
    });
    const berezaListva = pixTex(16, 16, g => {
      zalivka(g, 16, 16, '#8fcf5a', '#7dbb4c', 0.35);
      g.fillStyle = '#6fae42';
      g.fillRect(2, 2, 2, 2); g.fillRect(9, 5, 2, 2); g.fillRect(13, 1, 2, 2); g.fillRect(5, 11, 2, 2); g.fillRect(11, 12, 2, 2);
    });
    const posaditBerezu = (ix, iz) => {
      const d = new T.Group();
      const vys = 4;
      for (let sl = 0; sl < vys; sl++){
        const s = new T.Mesh(new T.BoxGeometry(KUB, KUB, KUB), mat(berezaKora));
        s.position.y = KUB * (0.5 + sl); s.castShadow = true; d.add(s);
      }
      const lm = mat(berezaListva);
      for (let dy = 0; dy < 2; dy++)
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++){
          if (dy === 0 && dx === 0 && dz === 0) continue;
          const l = new T.Mesh(new T.BoxGeometry(KUB, KUB, KUB), lm);
          l.position.set(dx * KUB, KUB * (vys + 0.5 + dy), dz * KUB);
          l.castShadow = true; d.add(l);
        }
      const vr = new T.Mesh(new T.BoxGeometry(KUB, KUB, KUB), lm);
      vr.position.set(0, KUB * (vys + 2.5), 0); d.add(vr);
      d.position.set(ix * KUB, naZemlyu(ix, iz, 0), iz * KUB);
      mir.add(d);
      zanyato.add(`${ix},${iz}`);   /* ствол непроходим, как и обычные деревья */
      return { g: d, stvol: d.children.slice(0, vys), krona: d.children.slice(vys), ix, iz, vys, srublena: false };
    };
    berezy.push(...[[9, -6], [-9, -7], [7, 9], [-6, 10]].map(p => posaditBerezu(p[0], p[1])));
  }

  const схч = v => programma.filter(b => b.vid === v).length;
  /* дом-как-в-деревне: светлые дощатые стены и тёмная кровля — свои материалы */
  const svetDoski = pixTex(16, 16, g => {
    zalivka(g, 16, 16, '#c29a58', '#b28a4c', 0.22);
    g.fillStyle = '#a37f42'; for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  });
  const kryshaTex = pixTex(16, 16, g => {
    zalivka(g, 16, 16, '#7a5631', '#6b4a28', 0.25);
    g.fillStyle = '#5d3f20'; for (let x = 3; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
  });
  const blokiD = new T.InstancedMesh(new T.BoxGeometry(KUB, KUB, KUB), mat(tex.doski), схч('d'));
  const blokiK = new T.InstancedMesh(new T.BoxGeometry(KUB, KUB, KUB), mat(tex.kamen), схч('k'));
  const blokiDS = new T.InstancedMesh(new T.BoxGeometry(KUB, KUB, KUB), mat(svetDoski), схч('ds'));
  const blokiKR = new T.InstancedMesh(new T.BoxGeometry(KUB, KUB, KUB), mat(kryshaTex), схч('kr'));
  const rostki = new T.InstancedMesh(new T.BoxGeometry(KUB * 0.5, KUB * 0.36, KUB * 0.5), mat(rostokTex), схч('rostok'));
  /* МИР 2.0: столбы забора ровно 0.25 KUB в плане (было 0.24) */
  const stolby = new T.InstancedMesh(new T.BoxGeometry(KUB * 0.25, KUB * 1.1, KUB * 0.25), mat(tex.kora), схч('stolb'));
  /* МИР 2.0: перекладины забора — второй InstancedMesh, 1.0×0.12×0.12 KUB */
  const perekladiny = new T.InstancedMesh(new T.BoxGeometry(KUB, KUB * 0.12, KUB * 0.12), mat(tex.kora), схч('perekladina'));
  /* МИР 2.0: песок — полный KUB³ (был KUB*0.9 — закон канона «блок = KUB×KUB×KUB») */
  const peski = new T.InstancedMesh(new T.BoxGeometry(KUB, KUB, KUB), mat(pesok), схч('pesok'));
  for (const im of [blokiD, blokiK, blokiDS, blokiKR, rostki, stolby, perekladiny, peski]){
    im.count = 0; im.castShadow = im.receiveShadow = true; mir.add(im);
  }
  const imPo = { d: blokiD, k: blokiK, ds: blokiDS, kr: blokiKR, rostok: rostki, stolb: stolby, perekladina: perekladiny, pesok: peski };
  {
    const sch = { d: 0, k: 0, ds: 0, kr: 0, rostok: 0, stolb: 0, perekladina: 0, pesok: 0 };
    for (const b of programma){
      if (!imPo[b.vid]) continue;
      b.idx = sch[b.vid]++;
    }
  }
  /* море у пляжа: появится, когда Стив доложит песок */
  const more = new T.Mesh(new T.BoxGeometry(KUB * 5, KUB * 0.34, KUB * 3.6),
    new T.MeshBasicNodeMaterial({ color: 0x3f8fd9, transparent: true, opacity: 0.72 }));
  more.position.set(KUB * 16, KUB * 0.12, KUB * 2);
  more.visible = false;
  mir.add(more);
  let plyazhGotov = false;   /* C-доп: пляж существует только после первого блока песка */

  /* ── D4: праздник стены — салют + жители у колодца ── */
  let stenaOstalos = programma.filter(b => b.poRelefu).length;
  const SALYUT_MAX = 36, SALYUT_TSVETA = [0xd94b3a, 0xe8c23a, 0x3f8fd9, 0x6fe3e0, 0x8fcf5a];
  const salyutChastitsy = [];
  for (let i = 0; i < SALYUT_MAX; i++){
    const m = new T.Mesh(new T.BoxGeometry(KUB * 0.22, KUB * 0.22, KUB * 0.22),
      new T.MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    m.visible = false;
    mir.add(m);
    salyutChastitsy.push({ m, akt: false, t: 0, vx: 0, vy: 0, vz: 0 });
  }
  function zapustitZalp(){
    const cx = (Math.random() * 6 - 3) * KUB, cz = (Math.random() * 6 - 3) * KUB;
    const cy = (8 + Math.random() * 2) * KUB;
    const n = 10 + Math.floor(Math.random() * 3);
    let postavleno = 0;
    for (const c of salyutChastitsy){
      if (c.akt) continue;
      if (postavleno >= n) break;
      const a = Math.random() * Math.PI * 2, el = Math.random() * Math.PI - Math.PI / 2;
      const spd = 60 + Math.random() * 50;
      c.akt = true; c.t = 0;
      c.m.position.set(cx, cy, cz);
      c.m.material.color.setHex(SALYUT_TSVETA[postavleno % SALYUT_TSVETA.length]);
      c.m.material.opacity = 1;
      c.m.visible = true;
      c.vx = Math.cos(a) * Math.cos(el) * spd;
      c.vy = Math.sin(el) * spd;
      c.vz = Math.sin(a) * Math.cos(el) * spd;
      postavleno++;
    }
    zvuk(90, 0.3, 'sine', 0.08);
    zvuk(1400, 0.2, 'sine', 0.03);
  }
  function obnovitSalyut(dt){
    for (const c of salyutChastitsy){
      if (!c.akt) continue;
      c.t += dt;
      c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt - 40 * dt * c.t; c.m.position.z += c.vz * dt;
      c.m.material.opacity = Math.max(0, 1 - c.t / 1.4);
      if (c.t > 1.4){ c.akt = false; c.m.visible = false; }
    }
  }
  let prazdnikT = -1, prazdnikZalpov = 0;
  function zapustitPrazdnik(){
    prazdnikT = 0; prazdnikZalpov = 0;
    zamedlenie = Math.max(zamedlenie, 10);  /* праздник стены — длинный момент */
    for (const zh of zhiteli) zh.prazdnik = true;
  }

  /* МИР 2.0: единая точка расчёта y для всего, что стоит на сетке — вызывается
     в момент установки (после расчистки/копки), а не при планировании программы */
  function finalizirovatY(b){
    if (b.p[1] !== 0) return;
    const kx = kletka(b.p[0]), kz = kletka(b.p[2]);
    if (b.poRelefu){ b.p[1] = (tekVys(kx, kz) + b.sloy) * KUB + KUB / 2; return; }
    b.p[1] = naZemlyu(kx, kz, b.vysObj !== undefined ? b.vysObj : KUB) + (b.sloy || 0) * KUB + (b.nadZemley || 0);
  }
  function posaditBlok(b){
    finalizirovatY(b);
    const m4 = new T.Matrix4();
    if (b.rot) m4.makeRotationY(b.rot);
    m4.setPosition(b.p[0], b.p[1], b.p[2]);
    const im = imPo[b.vid];
    im.setMatrixAt(b.idx, m4);
    im.count = Math.max(im.count, b.idx + 1);
    im.instanceMatrix.needsUpdate = true;
    /* нижний ярус стен и домов непроходим для всех */
    if ((b.vid === 'd' || b.vid === 'k' || b.vid === 'ds') && (b.sloy === 0 || b.p[1] < KUB * 1.8)){
      zanyato.add(`${kletka(b.p[0])},${kletka(b.p[2])}`);
      /* кладка выгоняет существ из клетки — дом не строится сквозь корову
         (скрин владельца 12.08: корова в крыше) */
      for (const s of sushchestva){
        if (s.mertv) continue;
        if (Math.abs(s.x - b.p[0]) < KUB * 0.7 && Math.abs(s.z - b.p[2]) < KUB * 0.7){
          const ug = Math.atan2(s.x - b.p[0] || 0.1, s.z - b.p[2] || 0.1);
          s.x = b.p[0] + Math.sin(ug) * KUB * 1.4;
          s.z = b.p[2] + Math.cos(ug) * KUB * 1.4;
        }
      }
    }
    if (b.vid === 'pesok') plyazhGotov = true;
    if (b.poRelefu && stenaOstalos > 0){
      /* ремонт стены после крипера прогоняет те же блоки заново — без
         страховки счётчик уходил в минус (праздник задуман одноразовым) */
      stenaOstalos--;
      if (stenaOstalos === 0) zapustitPrazdnik();
    }
  }
  let shag = 0, shahtaOstalos = 0, zaseleno = 0, kopok = 0;

  /* ── МИР 2.0, этап 2: РАСЧИСТКА-ЗРЕЛИЩЕ — первая фаза программы города ──
     пятно деревни радиусом RASCH_R; деревья/флора/холмы внутри валятся по
     блокам (закон 2), вне пятна лес и рельеф не трогаем */
  const RASCH_R = 17;   /* владелец 12.08: площадь расчистки ×2 (R12·√2≈17) — большая ровная площадка, лес остаётся кромкой */
  /* подъём клетки: засыпка ям — расчистка выводит пятно В ПЛОСКОСТЬ (владелец) */
  function podnyatKletku(kx, kz){
    const klyuch = `${kx},${kz}`;
    const h = tekVys(kx, kz);
    const h2 = h + 1;
    tekVysota.set(klyuch, h2);
    if (kletkiIndeksy.has(klyuch)){
      const m4 = new T.Matrix4();
      m4.setPosition(kx * KUB, h2 * KUB - KUB / 2, kz * KUB);
      pole.setMatrixAt(kletkiIndeksy.get(klyuch), m4);
      pole.instanceMatrix.needsUpdate = true;
      iskryU(kx * KUB, h2 * KUB, kz * KUB);
      zvuk(140, 0.06, 'triangle', 0.02);
    }
  }
  const raschLog = new T.Mesh(new T.BoxGeometry(KUB * 0.4, KUB * 0.4, KUB * 0.4), mat(tex.kora));
  raschLog.visible = false; raschLog.castShadow = true; mir.add(raschLog);
  let raschLogT = -1, raschLogFrom = null;
  function letitBrevno(x, y, z){
    raschLog.position.set(x, y, z); raschLog.scale.setScalar(1);
    raschLog.visible = true;
    raschLogFrom = { x, y, z };
    raschLogT = 0;
  }
  function obnovitRaschLog(dt){
    if (raschLogT < 0) return;
    raschLogT += dt;
    const k = Math.min(1, raschLogT / 0.15);
    if (!fonStiv){ raschLog.visible = false; raschLogT = -1; return; }
    const ty = naZemlyu(kletka(fonStiv.x), kletka(fonStiv.z), 0) + 20 * U;
    raschLog.position.set(
      raschLogFrom.x + (fonStiv.x - raschLogFrom.x) * k,
      raschLogFrom.y + (ty - raschLogFrom.y) * k,
      raschLogFrom.z + (fonStiv.z - raschLogFrom.z) * k);
    raschLog.scale.setScalar(1 - k * 0.7);
    if (k >= 1){ raschLog.visible = false; raschLogT = -1; }
  }
  let raschCeli = null, raschIdx = 0, raschSost = 'idti', raschT = 0;
  function sobratCeliRaschistki(){
    const celi = [];
    /* деревья мира (index.html) в пятне — валятся так же, как берёзы:
       разбираем группу на ствол/крону один раз (стволы — кубы на оси, верхушка — в крону) */
    for (const d of derevya){
      if (d.srubleno || d.srublena || Math.hypot(d.ix, d.iz) >= RASCH_R) continue;
      if (!d.stvol){
        const osevye = d.g.children.filter(ch => ch.position.x === 0 && ch.position.z === 0)
          .sort((a, b) => a.position.y - b.position.y);
        d.stvol = osevye.slice(0, -1);
        d.krona = d.g.children.filter(ch => !d.stvol.includes(ch));
        d.srublena = false;
      }
      celi.push({ tip: 'bereza', ob: d });   /* та же ветка валки, форма совместима */
    }
    for (const b of berezy) if (!b.srublena && Math.hypot(b.ix, b.iz) < RASCH_R) celi.push({ tip: 'bereza', ob: b });
    for (const f of kustyICvety) if (f.zhiv && Math.hypot(f.kx, f.kz) < RASCH_R) celi.push({ tip: 'flora', ob: f });
    /* ВАЖНО: сетка мира (index.html) построена с шагом 1 от полуцелого центра
       (N=40, POLU=(N-1)/2=19.5) — реальные ключи tekVysota/kletkiIndeksy это
       …,-1.5,-0.5,0.5,1.5,… . Целые kx (как их даёт kletka() у построек) НЕ
       совпадают ни с одной настоящей клеткой: opustitKletku тогда двигает
       только невидимую карту высот, а видимая трава/земля остаётся на месте —
       отсюда «холм торчит сквозь плоскую площадку». Обходим клетки по
       реальной полуцелой сетке, чтобы копка была видимой. */
    for (let kx = -RASCH_R + 0.5; kx <= RASCH_R; kx++)
      for (let kz = -RASCH_R + 0.5; kz <= RASCH_R; kz++){
        if (Math.hypot(kx, kz) >= RASCH_R) continue;
        /* В ПЛОСКОСТЬ: холмы срываются, ямы засыпаются — вся площадка на нуле */
        if (tekVys(kx, kz) !== 0) celi.push({ tip: 'holm', kx, kz });
      }
    return celi;
  }
  function planRaschistki(s, dt){
    if (!raschCeli){ raschCeli = sobratCeliRaschistki(); raschIdx = 0; raschSost = 'idti'; raschT = 0; }
    if (raschIdx >= raschCeli.length){
      raschCeli = null;
      zamedlenie = Math.max(zamedlenie, 2);   /* пятно чистое — общий план перед первым домом */
      shag++;
      return;
    }
    const c = raschCeli[raschIdx];
    const cx = c.tip === 'holm' ? c.kx * KUB : (c.tip === 'bereza' ? c.ob.ix * KUB : c.ob.kx * KUB);
    const cz = c.tip === 'holm' ? c.kz * KUB : (c.tip === 'bereza' ? c.ob.iz * KUB : c.ob.kz * KUB);
    if (raschSost === 'idti'){
      const dist = Math.hypot(cx - s.x, cz - s.z);
      if (dist < KUB * 1.6 || zastryal(s, 'rasch' + raschIdx, dist, dt)){
        raschSost = c.tip === 'holm' ? 'kopat' : (c.tip === 'bereza' ? 'rubit' : 'volna');
        raschT = 0;
        return;
      }
      shagatK(s, cx, cz, 260, dt);
      return;
    }
    s.rotY = Math.atan2(cx - s.x, cz - s.z);
    if (raschSost === 'rubit'){
      s.sost = 'udar';
      const b = c.ob;
      /* крона уже осыпается — ждём, пока долетят все кубики */
      if (b.kronaPadaet){
        let vsePali = true;
        for (const l of b.krona){
          if (!l.visible) continue;
          vsePali = false;
          l.userData.vy = (l.userData.vy || 0) + dt * 480;
          l.position.y -= l.userData.vy * dt;
          if (l.position.y <= KUB / 2){
            l.position.y = KUB / 2;
            l.userData.taet = (l.userData.taet || 0) + dt;
            if (l.userData.taet > 1.2) l.visible = false;
          }
        }
        if (vsePali){
          b.srublena = true;
          mir.remove(b.g);
          zanyato.delete(`${b.ix},${b.iz}`);
          raschIdx++; raschSost = 'idti';
        }
        return;
      }
      raschT += dt;
      if (raschT < 0.18) return;
      raschT = 0;
      /* верхний оставшийся кубик ствола — рубим сверху вниз (закон 2) */
      let top = -1;
      for (let i = b.stvol.length - 1; i >= 0; i--) if (b.stvol[i].visible) { top = i; break; }
      if (top < 0){ b.kronaPadaet = true; return; }
      const kub0 = b.stvol[top];
      const wp = new T.Vector3(); kub0.getWorldPosition(wp);
      iskryU(wp.x, wp.y, wp.z);
      zvuk(180, 0.08, 'square', 0.03);
      kub0.visible = false;
      letitBrevno(wp.x, wp.y, wp.z);
      return;
    }
    if (raschSost === 'volna'){
      s.sost = 'udar';
      raschT += dt;
      if (raschT < 0.1) return;
      raschT = 0;
      let obrabotano = 0;
      while (raschIdx < raschCeli.length && obrabotano < 4){
        const nc = raschCeli[raschIdx];
        if (nc.tip !== 'flora') break;
        const ncx = nc.ob.kx * KUB, ncz = nc.ob.kz * KUB;
        if (Math.hypot(ncx - s.x, ncz - s.z) > KUB * 2.4) break;
        for (const m of nc.ob.meshi){ iskryU(m.position.x, m.position.y, m.position.z); mir.remove(m); }
        nc.ob.zhiv = false;
        raschIdx++; obrabotano++;
      }
      if (obrabotano) zvuk(520, 0.05, 'square', 0.02);
      else raschIdx++;   /* цель уже неживая (страховка) */
      raschSost = 'idti';
      return;
    }
    if (raschSost === 'kopat'){
      s.sost = 'kopat';
      raschT += dt;
      if (raschT < 0.12) return;
      raschT = 0;
      let ubrano = 0;
      /* пакет до 3 блоков ОДНОЙ клетки за удар — холм срывается, яма засыпается */
      while (ubrano < 3 && tekVys(c.kx, c.kz) > 0){ opustitKletku(c.kx, c.kz); ubrano++; }
      while (ubrano < 3 && tekVys(c.kx, c.kz) < 0){ podnyatKletku(c.kx, c.kz); ubrano++; }
      if (tekVys(c.kx, c.kz) === 0){ raschIdx++; raschSost = 'idti'; }
      return;
    }
  }

  /* ── C1: тропинки — протоптанные плиты от двери дома к колодцу ── */
  const tropinkaTex = pixTex(16, 16, g => zalivka(g, 16, 16, '#a9803f', '#9a7136', 0.28));
  const MAX_TROP = DOMA.length * 6;
  const tropinki = new T.InstancedMesh(new T.BoxGeometry(KUB, KUB * 0.12, KUB), mat(tropinkaTex), MAX_TROP);
  tropinki.count = 0; tropinki.receiveShadow = true; mir.add(tropinki);
  function dobavitTropinku(dx, dz){
    const kolX = 0 * KUB, kolZ = 7.6 * KUB;
    const startX = dx * KUB, startZ = (dz - 2.6) * KUB;
    const dirX = kolX - startX, dirZ = kolZ - startZ;
    const dist = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / dist, nz = dirZ / dist;
    const n = 4 + Math.round(Math.abs(dx * 7 + dz * 13)) % 3;   /* 4..6, детерминировано по дому */
    for (let i = 0; i < n && tropinki.count < MAX_TROP; i++){
      const px = startX + nx * KUB * (i + 0.6), pz = startZ + nz * KUB * (i + 0.6);
      const h = tekVys(kletka(px), kletka(pz));
      const m4 = new T.Matrix4();
      m4.setPosition(px, h * KUB + KUB * 0.06, pz);
      tropinki.setMatrixAt(tropinki.count, m4);
      tropinki.count++;
    }
    tropinki.instanceMatrix.needsUpdate = true;
  }

  /* ── C2: труба + дым — эмиссия только ночью, у заселённых домов ── */
  const trubyPoz = [];
  function dobavitTrubu(dx, dz){
    const cx = dx * KUB, cz = dz * KUB;
    const trubaX = cx + KUB * 1.3, trubaZ = cz + KUB * 1.3;
    const roofY = 4 * KUB;   /* верх кровли (3-й слой стен + блок крыши) */
    const truba = new T.Mesh(new T.BoxGeometry(KUB * 0.6, KUB * 0.8, KUB * 0.6), mat(tex.kamen));
    truba.position.set(trubaX, roofY + KUB * 0.4, trubaZ);
    truba.castShadow = true;
    mir.add(truba);
    trubyPoz.push({ x: trubaX, y: roofY + KUB * 0.85, z: trubaZ });
  }
  const DYM_MAX = 24;
  const dymChastitsy = [];
  for (let i = 0; i < DYM_MAX; i++){
    const m = new T.Mesh(new T.BoxGeometry(KUB * 0.3, KUB * 0.3, KUB * 0.3),
      new T.MeshBasicNodeMaterial({ color: 0x5a5f63, transparent: true, opacity: 0 }));
    m.visible = false;
    mir.add(m);
    dymChastitsy.push({ m, akt: false, t: 0, vx: 0, vz: 0 });
  }
  let dymEmisT = 0;
  function obnovitDym(dt){
    if (nochNa() && trubyPoz.length){
      dymEmisT += dt;
      if (dymEmisT > 0.9){
        dymEmisT = 0;
        for (const tp of trubyPoz){
          const svob = dymChastitsy.find(c => !c.akt);
          if (!svob) break;
          svob.akt = true; svob.t = 0;
          svob.m.position.set(tp.x, tp.y, tp.z);
          svob.m.scale.setScalar(1);
          svob.m.material.opacity = 0.5;
          svob.m.visible = true;
          svob.vx = (Math.random() - 0.5) * 6;
          svob.vz = (Math.random() - 0.5) * 6;
        }
      }
    }
    for (const c of dymChastitsy){
      if (!c.akt) continue;
      c.t += dt;
      c.m.position.y += dt * 20;
      c.m.position.x += c.vx * dt;
      c.m.position.z += c.vz * dt;
      const dolyaZhizni = Math.min(1, c.t / 2.8);
      c.m.scale.setScalar(1 + dolyaZhizni * 0.9);
      c.m.material.opacity = 0.5 * (1 - dolyaZhizni);
      if (dolyaZhizni >= 1){ c.akt = false; c.m.visible = false; }
    }
  }

  /* ── C3: фонари — столб + светящийся куб, ночью включают PointLight из пула ── */
  const fonarSveta = [];
  for (let i = 0; i < 4; i++){
    const svet = new T.PointLight(0xffb066, 0, KUB * 6);
    mir.add(svet);
    fonarSveta.push(svet);
  }
  const fonariPozicii = [];
  function postavitFonar(x, z){
    const y0 = naZemlyu(kletka(x), kletka(z), 0);
    const stolb = new T.Mesh(new T.BoxGeometry(KUB * 0.22, KUB * 1.4, KUB * 0.22), mat(tex.kora));
    stolb.position.set(x, y0 + KUB * 0.7, z);
    stolb.castShadow = true;
    mir.add(stolb);
    const lampa = new T.Mesh(new T.BoxGeometry(KUB * 0.34, KUB * 0.34, KUB * 0.34),
      new T.MeshBasicNodeMaterial({ color: 0xffcf8a }));
    lampa.position.set(x, y0 + KUB * 1.4 + KUB * 0.17, z);
    mir.add(lampa);
    fonariPozicii.push({ x, y: y0 + KUB * 1.5, z, lampa });
    iskryU(x, y0 + KUB, z);
    zvuk(700, 0.14, 'sine', 0.04);
  }

  /* ── D3: колокол тревоги у колодца ── */
  let kolokolMesh = null, kolokolPostavlen = false, kolokolKachka = 0;
  function postavitKolokol(x, z){
    const y0 = naZemlyu(kletka(x), kletka(z), 0);
    const stolb = new T.Mesh(new T.BoxGeometry(KUB * 0.26, KUB * 2.2, KUB * 0.26), mat(tex.kora));
    stolb.position.set(x, y0 + KUB * 1.1, z);
    stolb.castShadow = true;
    mir.add(stolb);
    const kolokol = new T.Mesh(new T.BoxGeometry(KUB * 0.4, KUB * 0.4, KUB * 0.4),
      new T.MeshBasicNodeMaterial({ color: 0xe8c34d }));
    kolokol.position.set(x, y0 + KUB * 2.35, z);
    kolokol.castShadow = true;
    mir.add(kolokol);
    kolokolMesh = kolokol;
    kolokolPostavlen = true;
    iskryU(x, y0 + KUB * 2, z);
    zvuk(700, 0.14, 'sine', 0.04);
  }

  /* мельница: крылья закрутятся, когда столб построен */
  const krylya = new T.Group();
  {
    const os = new T.Mesh(new T.BoxGeometry(KUB * 0.3, KUB * 0.3, KUB * 0.7), mat(tex.kora));
    krylya.add(os);
    for (let i = 0; i < 4; i++){
      const k = new T.Mesh(new T.BoxGeometry(KUB * 0.42, KUB * 2.6, KUB * 0.1), mat(tex.doski));
      k.geometry.translate(0, KUB * 1.3, 0);
      k.rotation.z = i * Math.PI / 2;
      krylya.add(k);
    }
    krylya.position.set(8.6 * KUB, 4.4 * KUB, -4.2 * KUB + KUB * 0.6);
    krylya.visible = false;
    krylya.traverse(o => { if (o.isMesh) o.castShadow = true; });
    mir.add(krylya);
  }

  /* летящие блоки */
  const letyashchie = [];
  function blokPrileta(b){
    const geo = b.vid === 'rostok' ? new T.BoxGeometry(KUB * 0.5, KUB * 0.36, KUB * 0.5)
      : (b.vid === 'stolb' ? new T.BoxGeometry(KUB * 0.25, KUB * 1.1, KUB * 0.25)
      : (b.vid === 'perekladina' ? new T.BoxGeometry(KUB, KUB * 0.12, KUB * 0.12) : new T.BoxGeometry(KUB, KUB, KUB)));
    const tx = b.vid === 'd' ? tex.doski : (b.vid === 'k' ? tex.kamen
      : (b.vid === 'ds' ? svetDoski : (b.vid === 'kr' ? kryshaTex
      : (b.vid === 'rostok' ? rostokTex : (b.vid === 'pesok' ? pesok : tex.kora)))));
    finalizirovatY(b);
    const m = new T.Mesh(geo, mat(tx));
    m.rotation.y = b.rot || 0;
    m.position.set(b.p[0], b.p[1] + 400, b.p[2]);
    m.castShadow = true; mir.add(m);
    polozheno++;
    letyashchie.push({ m, b, v: 0 });
  }
  function obnovitLetyashchie(dt){
    for (const l of [...letyashchie]){
      l.v += 2900 * dt;
      l.m.position.y -= l.v * dt;
      if (l.m.position.y <= l.b.p[1]){
        mir.remove(l.m);
        letyashchie.splice(letyashchie.indexOf(l), 1);
        posaditBlok(l.b);
        iskryU(l.b.p[0], l.b.p[1] + KUB * 0.6, l.b.p[2]);
        zvuk(210, 0.05, 'square', 0.018);
      }
    }
  }

  /* ── шахта и склад ── */
  const shahtaKletki = [[-2, 8], [-3, 8], [-2, 9], [-3, 9]];
  let kopIdx = 0;
  /* одна копка: общая для Стива и жителя-шахтёра — прогрессия брони/голема едина */
  function kopnutShahtu(){
    const kl = shahtaKletki[kopIdx % shahtaKletki.length];
    if (tekVys(kl[0], kl[1]) > -2) opustitKletku(kl[0], kl[1]); else kopIdx++;
    polozhitVSklad();
    if (shahtaOstalos > 0) shahtaOstalos--;
    kopok++;
    if (kopok === 6) nadetBronyu(2);
    else if (kopok === 11) nadetBronyu(3);
    else if (kopok === 16) nadetBronyu(4);
    else if (kopok === 21) nadetBronyu(5);
    else if (kopok === 27) sobratGolema();
  }
  const sklad = new T.InstancedMesh(new T.BoxGeometry(KUB * 0.5, KUB * 0.5, KUB * 0.5), mat(zhelezo), 80);
  sklad.count = 0; mir.add(sklad);
  function polozhitVSklad(){
    if (sklad.count >= 80) return;
    const m4 = new T.Matrix4(), i = sklad.count;
    m4.setPosition(-KUB * 1 + (i % 4) * KUB * 0.55, KUB * 0.25 + Math.floor(i / 16) * KUB * 0.5, KUB * 9.4 + Math.floor((i % 16) / 4) * KUB * 0.55);
    sklad.setMatrixAt(i, m4);
    sklad.count++;
    sklad.instanceMatrix.needsUpdate = true;
  }

  /* ── житель-шахтёр: копает параллельно со стройкой Стива (одновременность,
     владелец 12.08); ночью и при тревоге бежит домой, как все ── */
  function planShahtyora(s, dt){
    if (nochNa() || moby.some(m => !m.mertv && !m.lezhit)){ idtiDomoy(s, dt); return; }
    const kl = shahtaKletki[kopIdx % shahtaKletki.length];
    const cx = kl[0] * KUB + KUB * 0.8, cz = kl[1] * KUB + KUB * 0.8;
    if (shagatK(s, cx, cz, 150, dt) ||
        zastryal(s, 'zshx' + kopIdx, Math.hypot(cx - s.x, cz - s.z), dt, 3)){
      s.sost = 'kopat';
      s.planT = (s.planT || 0) + dt;
      /* заказ шахты — бодрый темп; между заказами роет фоном вдвое медленнее */
      if (s.planT > (shahtaOstalos > 0 ? 0.6 : 1.3)){ s.planT = 0; kopnutShahtu(); }
    }
  }

  /* ── разрушения крипера и ремонт ── */
  const remont = [];
  function vzryv(x, z){
    zvuk(60, 0.5, 'sine', 0.16); zvuk(48, 0.7, 'sine', 0.12);
    for (let i = 0; i < 3; i++) iskryU(x + (Math.random() - 0.5) * KUB, KUB, z + (Math.random() - 0.5) * KUB);
    ctx.kachnutKameru && ctx.kachnutKameru(0.5);
    let vybito = 0;
    for (const b of programma){
      if (vybito >= 4) break;
      if (!imPo[b.vid] || b.slomano || b.idx >= imPo[b.vid].count) continue;
      if (Math.hypot(b.p[0] - x, b.p[2] - z) < KUB * 1.8){
        b.slomano = true; vybito++;
        const m4 = new T.Matrix4();
        m4.makeScale(0.001, 0.001, 0.001); m4.setPosition(b.p[0], -900, b.p[2]);
        imPo[b.vid].setMatrixAt(b.idx, m4);
        imPo[b.vid].instanceMatrix.needsUpdate = true;
        zanyato.delete(`${kletka(b.p[0])},${kletka(b.p[2])}`);
        remont.push(b);
      }
    }
    /* E3: кратер — эпицентр проседает на 1, только если клетка свободна и не выбита в бездну;
       клетку кратера в zanyato не помечаем — жители обходят её сами по перепаду высоты */
    const ekx = kletka(x), ekz = kletka(z);
    if (!zanyato.has(`${ekx},${ekz}`) && tekVys(ekx, ekz) > -2) opustitKletku(ekx, ekz);
  }

  /* ── движение с обходом стен и круч: перепад выше 1 блока непроходим ──
     этап 1а п.2: подъём >1 запрещён и напрямую, и по диагонали — иначе шаг
     «срезает угол» между двумя высокими клетками через щель между ними */
  function prohodimo(s, x, z){
    const tkx = kletka(x), tkz = kletka(z);
    if (zanyato.has(`${tkx},${tkz}`)) return false;
    const skx = kletka(s.x), skz = kletka(s.z);
    const hTek = tekVys(skx, skz);
    /* спуск вниз разрешён на любую глубину, подъём — не больше чем на 1 блок */
    if (tekVys(tkx, tkz) - hTek > 1) return false;
    /* диагональный переход клетка-в-клетку (обе координаты сменились) —
       обе промежуточные клетки угла тоже должны быть проходимы по высоте,
       иначе фигура «срезает» через обрыв между двумя высокими клетками */
    if (tkx !== skx && tkz !== skz){
      if (tekVys(tkx, skz) - hTek > 1 || tekVys(skx, tkz) - hTek > 1) return false;
    }
    return true;
  }
  function shagatK(s, cx, cz, skorost, dt){
    /* субшаги: на таймлапсе ×7 dt мира достигает 0.35 с, и один шаг был бы
       крупнее клетки — prohodimo сравнивал бы высоты ЧЕРЕЗ клетку, дельта
       склона удваивалась и ходьба «упиралась» на любом подъёме */
    let ost = Math.min(Math.hypot(cx - s.x, cz - s.z), skorost * dt);
    const MAKS_SHAG = KUB / 3;
    while (true){
      const dx = cx - s.x, dz = cz - s.z, dist = Math.hypot(dx, dz);
      if (dist < 8){ s.sost = 'idle'; return true; }
      s.sost = 'walk';
      s.rotY = Math.atan2(dx, dz);
      if (ost <= 0) return false;
      const sk = Math.min(dist, ost, MAKS_SHAG);
      let nx = s.x + dx / dist * sk, nz = s.z + dz / dist * sk;
      if (!prohodimo(s, nx, nz)){
        if (prohodimo(s, nx, s.z)) nz = s.z;
        else if (prohodimo(s, s.x, nz)) nx = s.x;
        else return false;   /* упёрся — стоит */
      }
      s.x = nx; s.z = nz;
      ost -= sk;
    }
  }
  /* тщетность: жадная ходьба без обхода — к цели за холмом/деревом можно
     не пройти НИКОГДА, и весь план встаёт (замерено 12.08: шаг 73 «pesok»
     держал программу 10+ минут, ремонты копились до 8). Если дистанция до
     цели не сократилась хотя бы на 2 за limit секунд — считаем «дошёл»
     и исполняем дистанционно: блок всё равно прилетает сверху. */
  function zastryal(s, klyuch, dist, dt, limit = 4){
    if (s.zRezhim === klyuch) return true;   /* защёлка: дистанционный режим до смены цели */
    if (s.zKlyuch !== klyuch){ s.zKlyuch = klyuch; s.zDist = dist; s.zT = 0; return false; }
    /* сброс таймера — только при ЧЕСТНОЙ скорости сближения (≥60 ед/с):
       слайд вдоль препятствия и круги дают капельный прогресс и раньше
       сбрасывали счёт бесконечно — кладка вставала на минуты */
    const shagK = s.zDist - dist;
    s.zDist = dist;
    if (shagK >= dt * 60) s.zT = 0; else s.zT += dt;
    if (s.zT > limit){ s.zRezhim = klyuch; return true; }
    return false;
  }

  /* ── E5: вспышка при ударе — все меши жертвы мигают белым 80 мс ──
     все тела собраны через mat() → MeshStandardNodeMaterial, emissive есть всегда */
  function vspyshkaUdara(s){
    if (!s.g) return;
    if (!s._vspyshkaMeshi){
      s._vspyshkaMeshi = [];
      s.g.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const mm of ms) if (mm.emissive) s._vspyshkaMeshi.push(mm);
      });
    }
    s._vspyshkaT = 0.08;
    for (const mm of s._vspyshkaMeshi) mm.emissive.setHex(0xffffff);
  }
  function pozaSushch(s, dt, f){
    if (s._vspyshkaT > 0){
      s._vspyshkaT -= dt;
      if (s._vspyshkaT <= 0) for (const mm of s._vspyshkaMeshi) mm.emissive.setHex(0);
    }
    const l = 1 - Math.pow(0.0002, dt);
    let ruL = 0, ruR = 0, noL = 0, noR = 0, podskok = 0;
    const fz = f + s.faza;
    if (s.tip === 'korova' || s.tip === 'ovtsa'){
      if (s.sost === 'walk'){
        const sn = Math.sin(fz * 9);
        s.nogi[0].rotation.x = sn * 0.5; s.nogi[3].rotation.x = sn * 0.5;
        s.nogi[1].rotation.x = -sn * 0.5; s.nogi[2].rotation.x = -sn * 0.5;
      } else s.nogi.forEach(n => n.rotation.x *= 0.9);
      s.gol.rotation.x += ((s.sost === 'pastis' ? 0.9 : 0) - s.gol.rotation.x) * l;
      /* B4: жуют, когда пасутся — челюсть качается 2 Гц */
      if (s.chelyust) s.chelyust.rotation.x = s.sost === 'pastis' ? Math.max(0, Math.sin(f * Math.PI * 4)) * 0.35 : 0;
    } else if (s.tip === 'koshka'){
      /* B4: хвост бегущей волной — фазовый сдвиг между сегментами */
      s.hvostSegs.forEach((seg, i) => { seg.rotation.y = Math.sin(fz * 3.1 - i * 0.8) * (0.5 - i * 0.08); });
      if (s.sost === 'walk') podskok = Math.abs(Math.sin(fz * 14)) * 4;
    } else if (s.tip === 'kriper'){
      podskok = s.sost === 'walk' ? Math.abs(Math.sin(fz * 12)) * 3 : 0;
      const m = 1 + s.mig * 0.16;
      s.g.scale.set(m, 1 / (0.5 + m * 0.5), m);
    } else if (s.tip === 'golem'){
      /* тяжёлая поступь, длинные руки, сокрушительный замах */
      if (s.sost === 'walk'){
        const sn = Math.sin(fz * 6);
        s.rL.rotation.x = sn * 0.4; s.rR.rotation.x = -sn * 0.4;
        s.nL.rotation.x = -sn * 0.45; s.nR.rotation.x = sn * 0.45;
        podskok = Math.abs(Math.cos(fz * 6)) * 3;
      } else if (s.sost === 'udar'){
        s.rL.rotation.x += (-2.4 - s.rL.rotation.x) * l;
        s.rR.rotation.x += (-2.4 - s.rR.rotation.x) * l;
      } else {
        s.rL.rotation.x *= 0.95; s.rR.rotation.x *= 0.95;
        s.nL.rotation.x *= 0.9; s.nR.rotation.x *= 0.9;
      }
      s.gol.rotation.y = Math.sin(fz * 0.7) * 0.2;
    } else {
      if (s.lezhit){
        /* загорает на спине */
        s.g.rotation.x += (-Math.PI / 2 - s.g.rotation.x) * l;
        s.g.rotation.y += (s.rotY - s.g.rotation.y) * l;
        s.g.position.set(s.x, mirovayaVysota(s.x, s.z) + 4 * U, s.z);
        return;
      }
      s.g.rotation.x *= 0.9;
      if (s.sost === 'walk'){
        const snNoga = Math.sin(fz * 11);
        noL = -snNoga * 0.75; noR = snNoga * 0.75;
        podskok = Math.abs(Math.cos(fz * 11)) * 4;
        /* B1: у жителя и фонового Стива руки запаздывают за ногами на ~0.1 с */
        const otstavanie = (s.tip === 'zhitel' || s.tip === 'stiv2') ? 1.1 : 0;   /* 11 рад/с × 0.1 с */
        const snRuka = Math.sin(fz * 11 - otstavanie);
        ruL = snRuka * 0.85; ruR = -snRuka * 0.85;
      } else if (s.sost === 'udar'){ ruR = -1.3 + Math.sin(fz * 20) * 0.7; }
      else if (s.sost === 'kopat'){ ruR = -1.1 + Math.sin(fz * 17) * 0.6; ruL = -0.4; }
      else if (s.sost === 'poliv'){ ruR = -1.4 + Math.sin(fz * 6) * 0.15; }   /* D1: рука с лейкой опущена, чуть трясётся */
      else if (s.sost === 'prazdnik'){ podskok = Math.max(0, Math.sin(fz * 5)) * 10; ruL = -2.3; ruR = -2.3; }   /* D4: прыгают у колодца */
      if (s.tip === 'zombi' && !s.lezhit){ ruL = -1.5; ruR = -1.5; }
      if (s.tip === 'skelet' && !s.lezhit){ ruL = -0.9; ruR = -0.9; }
      if (s.shchit && s.shchit.visible) ruL = -1.2;   /* E4: поза обороны — левая рука со щитом перед грудью */
      const torNaklon = s.sost === 'poliv' ? 0.35 : ((s.sost === 'udar' || s.sost === 'kopat') ? 0.2 : 0);
      s.tor.rotation.x += (torNaklon - s.tor.rotation.x) * l;
      /* B4: зомби раскачивает корпус в такт шагам; B1: жители/фоновый Стив качаются в противофазе ногам */
      const kachTor = s.sost === 'walk'
        ? (s.tip === 'zombi' ? Math.sin(fz * 11) * 0.14
          : ((s.tip === 'zhitel' || s.tip === 'stiv2') ? -Math.sin(fz * 11) * 0.05 : 0))
        : 0;
      s.tor.rotation.z += (kachTor - s.tor.rotation.z) * l;
      if (s.sost === 'kivok') s.gol.rotation.x = Math.sin(fz * 5) * 0.22;
      else s.gol.rotation.x *= 0.92;
      s.rL.rotation.x += (ruL - s.rL.rotation.x) * l;
      s.rR.rotation.x += (ruR - s.rR.rotation.x) * l;
      s.nL.rotation.x += (noL - s.nL.rotation.x) * l;
      s.nR.rotation.x += (noR - s.nR.rotation.x) * l;
    }
    if (s.kirka) s.kirka.visible = (s.sost === 'kopat');
    s.g.rotation.y += (s.rotY - s.g.rotation.y) * l;
    /* детёныш растёт */
    if (s.rost !== undefined && s.rost < 1){
      s.rost = Math.min(1, s.rost + dt * 0.007);
      s.g.scale.setScalar(s.rost);
    }
    /* этап 1а п.1+3: земля твёрдая — Y считаем от рельефа КАЖДЫЙ кадр.
       Спуск (склон/яма стала ниже) — мгновенно, никто не «висит» над обрывом.
       Подъём — плавно за ≤0.15 с; если разрыв большой (существо оказалось
       ВНУТРИ рельефа — страховка после срыва холма под ним при расчистке),
       даём чуть больше — 0.2 с, но не более. */
    const pochva = (s.yOverride !== null && s.yOverride !== undefined) ? s.yOverride : mirovayaVysota(s.x, s.z);
    if (s.tekY === undefined) s.tekY = pochva;
    if (pochva <= s.tekY){
      s.tekY = pochva;
    } else {
      const razryv = pochva - s.tekY;
      const dlit = razryv > KUB * 1.2 ? 0.2 : 0.15;
      s.tekY += (pochva - s.tekY) * Math.min(1, dt / dlit);
    }
    s.g.position.set(s.x, s.tekY + podskok + (s.mertv ? -14 : 0), s.z);
    /* B4: скелет мелко дрожит — тремор 12 Гц малой амплитуды */
    if (s.tip === 'skelet' && !s.mertv && !s.lezhit) s.g.rotation.z = Math.sin(f * Math.PI * 24 + s.faza * 5) * 0.02;
    if (s.mertv) s.g.rotation.z += (Math.PI / 2 - s.g.rotation.z) * l;
  }

  /* ── планы ── */
  const ZAGON = { x0: 3.4 * KUB, x1: 7.6 * KUB, z0: 7.4 * KUB, z1: 9.6 * KUB };
  const nochNa = () => solnVys < -0.06;

  /* лестница к «экрану»: по ней Стив поднимается вставлять буквы на лист */
  const LEST = { x: KUB * 5.5, z: KUB * 11.5 };
  const lestBloki = new T.InstancedMesh(new T.BoxGeometry(KUB, KUB, KUB), mat(tex.doski), 4);
  lestBloki.count = 0; lestBloki.castShadow = true; mir.add(lestBloki);
  zanyato.add('6,12');   /* лестница непроходима */
  let uEkranaFlag = false, perehod = null;
  function shagPerehoda(s, dt){
    const p = perehod;
    if (p.faza === 0){                        /* бежит к подножию */
      if (shagatK(s, LEST.x, LEST.z - KUB, 320, dt)) p.faza = 1;
      return;
    }
    if (p.faza === 1){                        /* достраивает ступени */
      if (lestBloki.count >= 4){ p.faza = 2; p.t = 0; return; }
      s.sost = 'udar'; s.rotY = 0;
      p.t += dt;
      if (p.t > 0.28){
        p.t = 0;
        const i = lestBloki.count;
        const m4 = new T.Matrix4();
        m4.setPosition(LEST.x, i * KUB + KUB / 2, LEST.z + i * KUB * 0.55);
        lestBloki.setMatrixAt(i, m4);
        lestBloki.count++;
        lestBloki.instanceMatrix.needsUpdate = true;
        iskryU(LEST.x, i * KUB + KUB, LEST.z + i * KUB * 0.55);
        zvuk(210, 0.05, 'square', 0.03);
      }
      return;
    }
    /* взбирается по ступеням и прыгает «в экран» */
    p.t += dt;
    const st = p.t * 3.1;
    s.x = LEST.x;
    s.z = LEST.z + Math.min(st, 3) * KUB * 0.55 - KUB * 0.55;
    s.yOverride = Math.min(st, 3) * KUB + KUB + Math.max(0, st - 3) * KUB * 3;
    s.sost = 'walk'; s.rotY = 0;
    if (st >= 3.7){
      uEkranaFlag = true; perehod = null;
      s.g.visible = false; s.yOverride = null;
      zvuk(760, 0.1, 'sine', 0.03);
    }
  }

  function planStiva(s, dt, f){
    /* 0. шахтёрский режим: читатель доскроллил до шахты — Стив копает там */
    if (s.pod){
      s.x = s.pod.x; s.z = s.pod.z; s.yOverride = s.pod.y;
      s.sost = 'kopat';
      s.rotY = s.pod.rotY !== undefined ? s.pod.rotY : Math.PI;
      if (s.mech) s.mech.visible = false;
      return;
    }
    s.yOverride = null;
    /* E4: щит — включается при 3+ живых мобах в радиусе KUB*4 */
    if (s.shchit){
      const blizkihMobov = moby.filter(m => !m.mertv && !m.lezhit && Math.hypot(m.x - s.x, m.z - s.z) < KUB * 4).length;
      s.shchit.visible = blizkihMobov >= 3;
    }
    /* 0.5 переход к экрану по лестнице */
    if (perehod){ shagPerehoda(s, dt); return; }
    /* 1. ночной бой — только если враг РЯДОМ (со Стивом или с деревней):
       за дальними по карте не бегаем, стройка ночью не встаёт */
    const vrag = moby.find(m => !m.mertv && !m.lezhit &&
      (Math.hypot(m.x - s.x, m.z - s.z) < KUB * 8 || Math.hypot(m.x, m.z) < KUB * 10));
    if (nochNa() && vrag){
      let bl = null, bd = 1e9;
      for (const m of moby){ if (m.mertv || m.lezhit) continue; const d = Math.hypot(m.x - s.x, m.z - s.z); if (d < bd){ bd = d; bl = m; } }
      if (s.mech) s.mech.visible = true;
      if (bd > KUB * 1.2) shagatK(s, bl.x, bl.z, 230, dt);
      else {
        s.sost = 'udar'; s.rotY = Math.atan2(bl.x - s.x, bl.z - s.z);
        s.boyT = (s.boyT || 0) + dt;
        if (s.boyT > 0.3){
          s.boyT = 0;
          zvuk(150, 0.08, 'square', 0.035);
          bl.hp--;
          vspyshkaUdara(bl);
          const ot = Math.hypot(bl.x - s.x, bl.z - s.z) || 1;
          bl.x += (bl.x - s.x) / ot * KUB * 1.3; bl.z += (bl.z - s.z) / ot * KUB * 1.3;
          iskryU(bl.x, KUB, bl.z);
          if (bl.hp <= 0){ bl.mertv = true; bl.mertvT = 0; sozdatDrop(bl.tip === 'skelet' ? 'kost' : 'gnil', bl.x, bl.z); }
        }
      }
      return;
    }
    if (s.mech) s.mech.visible = false;
    /* 2. ремонт после взрывов */
    if (remont.length){
      const b = remont[0];
      if (shagatK(s, b.p[0] - KUB * 0.9, b.p[2] + KUB * 0.9, 210, dt) ||
          zastryal(s, 'rem' + kletka(b.p[0]) + ',' + kletka(b.p[2]), Math.hypot(b.p[0] - KUB * 0.9 - s.x, b.p[2] + KUB * 0.9 - s.z), dt)){
        s.sost = 'udar';
        s.planT += dt;
        if (s.planT > 0.5){ s.planT = 0; b.slomano = false; blokPrileta(b); remont.shift(); }
      }
      return;
    }
    /* 3. шахтный перерыв: добытое железо = броня, потом голем.
       ОДНОВРЕМЕННОСТЬ (владелец 12.08): если в деревне есть свободный житель —
       он становится ШАХТЁРОМ и копает сам, а Стив не отвлекается от стройки */
    if (shahtaOstalos > 0){
      const shahtyor = zhiteli.find(z => z.rol === 'shahtyor') ||
        zhiteli.find(z => !z.rol && !z.rebyonok && !z.mertv);
      if (shahtyor){
        if (shahtyor.rol !== 'shahtyor') shahtyor.rol = 'shahtyor';
        /* копает житель — Стив проваливается к программе города (ниже) */
      } else {
        const kl = shahtaKletki[kopIdx % shahtaKletki.length];
        /* шахтные клетки соседние — дистанционный режим наследуется между копками */
        if (s.zRezhim && s.zRezhim.startsWith('shx')) s.zRezhim = 'shx' + kopIdx;
        if (shagatK(s, kl[0] * KUB + KUB * 0.8, kl[1] * KUB + KUB * 0.8, 220, dt) ||
            zastryal(s, 'shx' + kopIdx, Math.hypot(kl[0] * KUB + KUB * 0.8 - s.x, kl[1] * KUB + KUB * 0.8 - s.z), dt, 2)){
          s.sost = 'kopat';
          s.planT += dt;
          if (s.planT > 0.45){ s.planT = 0; kopnutShahtu(); }
        }
        return;
      }
    }
    /* 4. программа города — в темпе таймлапса */
    if (shag < programma.length){
      const b = programma[shag];
      if (b.vid === 'raschistka'){ planRaschistki(s, dt); return; }
      if (b.vid === 'shahta'){ shahtaOstalos = b.n; shag++; return; }
      if (b.vid === 'novosel'){
        /* дом готов — житель заселяется */
        zaseleno++;
        const [dx, dz] = DOMA[b.dom];
        const zh = novyGumanoid('zhitel', dx * KUB, (dz - 2.6) * KUB);
        zh.dom = [dx * KUB, dz * KUB];
        iskryU(dx * KUB, KUB, (dz - 2.6) * KUB);
        zamedlenie = Math.max(zamedlenie, 3);   /* заселение — момент, темп ×1 */
        zvuk(620, 0.2, 'sine', 0.05);
        dobavitTropinku(dx, dz);   /* C1 */
        dobavitTrubu(dx, dz);      /* C2 */
        shag++;
        return;
      }
      if (b.vid === 'fonar'){
        if (shagatK(s, b.p[0] - KUB * 0.9, b.p[2] + KUB * 0.9, 300, dt) ||
            zastryal(s, 'pr' + shag, Math.hypot(b.p[0] - KUB * 0.9 - s.x, b.p[2] + KUB * 0.9 - s.z), dt)){
          s.sost = 'udar';
          s.rotY = Math.atan2(b.p[0] - s.x, b.p[2] - s.z);
          s.planT += dt;
          if (s.planT > 0.3){
            s.planT = 0;
            postavitFonar(b.p[0], b.p[2]);
            shag++;
          }
        }
        return;
      }
      if (b.vid === 'kolokol'){
        if (shagatK(s, b.p[0] - KUB * 0.9, b.p[2] + KUB * 0.9, 300, dt) ||
            zastryal(s, 'pr' + shag, Math.hypot(b.p[0] - KUB * 0.9 - s.x, b.p[2] + KUB * 0.9 - s.z), dt)){
          s.sost = 'udar';
          s.rotY = Math.atan2(b.p[0] - s.x, b.p[2] - s.z);
          s.planT += dt;
          if (s.planT > 0.3){
            s.planT = 0;
            postavitKolokol(b.p[0], b.p[2]);
            shag++;
          }
        }
        return;
      }
      if (b.vid === 'more'){
        more.visible = true;
        zvuk(300, 0.5, 'sine', 0.04);
        shag++;
        return;
      }
      if (b.vid === 'rovnyat'){
        if (tekVys(b.kx, b.kz) <= 0){ shag++; return; }
        if (shagatK(s, b.kx * KUB + KUB * 0.8, b.kz * KUB + KUB * 0.8, 300, dt) ||
            zastryal(s, 'pr' + shag, Math.hypot(b.kx * KUB + KUB * 0.8 - s.x, b.kz * KUB + KUB * 0.8 - s.z), dt)){
          s.sost = 'kopat';
          s.planT += dt;
          if (s.planT > 0.24){
            s.planT = 0;
            /* таймлапс: удар срывает клетку целиком и до трёх соседних шагов рядом */
            while (tekVys(b.kx, b.kz) > 0) opustitKletku(b.kx, b.kz);
            let dobito = 0;
            for (let j = shag + 1; j < programma.length && dobito < 3; j++){
              const sl = programma[j];
              if (sl.vid !== 'rovnyat') break;
              if (Math.hypot(sl.kx - b.kx, sl.kz - b.kz) < 2.6 && tekVys(sl.kx, sl.kz) > 0){
                while (tekVys(sl.kx, sl.kz) > 0) opustitKletku(sl.kx, sl.kz);
                dobito++;
              }
            }
            shag++;
          }
        }
        return;
      }
      if (b.vid === 'sgon'){
        const vne = skot.find(zh => !zh.vZagone);
        if (!vne){ nadetBronyu(1); shag++; return; }   /* стадо в загоне: кожа на нагрудник */
        /* сцена сгона идёт на темпе ×1 — дольше 15 с её не держим: гоним всё стадо разом */
        s.sgonT = (s.sgonT || 0) + dt;
        if (shagatK(s, vne.x - KUB * 0.6, vne.z - KUB * 0.6, 260, dt) ||
            zastryal(s, 'sgon', Math.hypot(vne.x - s.x, vne.z - s.z), dt, 8) ||
            s.sgonT > 15){
          for (const zh of skot) if (!zh.vZagone) zh.gonyat = true;
        }
        if (Math.hypot(vne.x - s.x, vne.z - s.z) < KUB * 1.4) vne.gonyat = true;
        return;
      }
      if (b.slomano){ shag++; return; }
      /* наследование дистанционного режима: предыдущий блок клался дистанционно
         и новый — его сосед по кластеру → не ждать тщетность заново */
      const pred = programma[shag - 1];
      if (s.zRezhim === 'pr' + (shag - 1) && pred && pred.p && b.p &&
          pred.vid === b.vid &&   /* только внутри кластера одного вида: пляж→дом не наследует */
          Math.hypot(b.p[0] - pred.p[0], b.p[2] - pred.p[2]) < KUB * 3)
        s.zRezhim = 'pr' + shag;
      /* пакетная кладка: подошёл к кластеру — молотит все блоки в радиусе руки */
      const ryadom = Math.hypot(b.p[0] - s.x, b.p[2] - s.z) < KUB * 3.4;
      if (ryadom || shagatK(s, b.p[0] - KUB * 0.9, b.p[2] + KUB * 0.9, 300, dt) ||
          zastryal(s, 'pr' + shag, Math.hypot(b.p[0] - KUB * 0.9 - s.x, b.p[2] + KUB * 0.9 - s.z), dt)){
        /* фундамент: холм под блоком срывается киркой прямо по месту */
        const bkx = kletka(b.p[0]), bkz = kletka(b.p[2]);
        if (!b.poRelefu && tekVys(bkx, bkz) > 0){
          s.sost = 'kopat';
          s.rotY = Math.atan2(b.p[0] - s.x, b.p[2] - s.z);
          s.planT += dt;
          if (s.planT > 0.2){
            s.planT = 0;
            while (tekVys(bkx, bkz) > 0) opustitKletku(bkx, bkz);
          }
          return;
        }
        s.sost = 'udar';
        s.rotY = Math.atan2(b.p[0] - s.x, b.p[2] - s.z);
        s.planT += dt;
        if (s.planT > 0.26){
          s.planT = 0;
          blokPrileta(b); shag++;
          const b2 = programma[shag];
          if (b2 && imPo[b2.vid] && !b2.slomano && !b2.poRelefu &&
              Math.hypot(b2.p[0] - s.x, b2.p[2] - s.z) < KUB * 3.4 &&
              tekVys(kletka(b2.p[0]), kletka(b2.p[2])) <= 0){
            blokPrileta(b2); shag++;
          }
          if (!krylya.visible && programma.slice(0, shag).some(q => q.p && q.p[0] === 8.6 * KUB && q.p[1] === 4 * KUB + KUB / 2))
            krylya.visible = true;
        }
      }
      return;
    }
    /* 5. всё построено — вечная шахта */
    shahtaOstalos = 5;
  }
  /* общий бег домой на ночь/тревогу — скорость растёт от trevoga и от множителя (дети шустрее) */
  function idtiDomoy(s, dt, mnozhitel = 1){
    const dom = s.dom || [DOM_X, DOM_Z];
    const uDveri = Math.hypot(s.x - dom[0], s.z - (dom[1] - 2.6 * KUB)) < KUB * 0.8;
    const vnutri = Math.hypot(s.x - dom[0], s.z - dom[1]) < KUB * 0.9;
    if (vnutri){ s.sost = 'idle'; return true; }
    if (uDveri) shagatK(s, dom[0], dom[1], (trevoga ? 220 : 150) * mnozhitel, dt);
    else shagatK(s, dom[0], dom[1] - 2.6 * KUB, (trevoga ? 220 : 165) * mnozhitel, dt);
    return false;
  }
  const FERMA_ZONA = { x0: 7.5 * KUB, x1: 12.5 * KUB, z0: -3.5 * KUB, z1: -1.5 * KUB };
  /* D1: фермер обходит грядки и поливает */
  function planFermera(s, dt){
    if (nochNa() || moby.some(m => !m.mertv && !m.lezhit)){ idtiDomoy(s, dt); return; }
    if (s.polivaet > 0){
      s.polivaet -= dt;
      s.sost = 'poliv';
      if (s.polivaet <= 0) s.sost = 'idle';
      return;
    }
    s.planT += dt;
    if (!s.cel || s.planT > 7){
      s.planT = 0;
      if (s.cel){
        /* дошли до грядки — поливаем: наклон, капли, тихий плеск */
        s.polivaet = 1.2;
        s.sost = 'poliv';
        dobavitKapli(s.x, mirovayaVysota(s.x, s.z) + 22 * U, s.z);
        zvuk(950, 0.06, 'sine', 0.02);
        zvuk(950, 0.06, 'sine', 0.02);
      }
      s.cel = [FERMA_ZONA.x0 + Math.random() * (FERMA_ZONA.x1 - FERMA_ZONA.x0),
               FERMA_ZONA.z0 + Math.random() * (FERMA_ZONA.z1 - FERMA_ZONA.z0)];
      return;
    }
    shagatK(s, s.cel[0], s.cel[1], 50, dt);
  }
  /* D1: торговец держится у колодца */
  function planTorgovtsa(s, dt){
    if (nochNa() || moby.some(m => !m.mertv && !m.lezhit)){ idtiDomoy(s, dt); return; }
    s.t += dt; s.planT += dt;
    if (!s.cel || s.planT > 6){
      s.planT = 0;
      const a = Math.random() * Math.PI * 2, r = Math.random() * 2;
      s.cel = [Math.cos(a) * r * KUB, (7.6 + Math.sin(a) * r) * KUB];
    }
    if (shagatK(s, s.cel[0], s.cel[1], 45, dt)) s.sost = 'idle';
  }
  /* D5: ребёнок — шустрее, бродит между домами */
  function planRebyonka(s, dt){
    if (nochNa() || moby.some(m => !m.mertv && !m.lezhit)){ idtiDomoy(s, dt, 1.6); return; }
    s.t += dt; s.planT += dt;
    if (!s.cel || s.planT > 4){
      s.planT = 0;
      const dm = DOMA[Math.floor(Math.random() * DOMA.length)];
      s.cel = [dm[0] * KUB, (dm[1] - Math.random() * 1.5) * KUB];
    }
    if (shagatK(s, s.cel[0], s.cel[1], 55 * 1.6, dt)) s.sost = 'idle';
  }
  function planZhitelya(s, dt, f){
    if (s.prazdnik){
      /* D4: праздник стены — все сбегаются к колодцу и прыгают */
      const d = Math.hypot(s.x, s.z - 7.6 * KUB);
      if (d > KUB * 1.8) shagatK(s, 0, 7.6 * KUB, s.rebyonok ? 200 : 130, dt);
      else s.sost = 'prazdnik';
      return;
    }
    if (s.torgovlya) return;   /* D2: обменом рулит obnovitTorgovlю в zhiznFona */
    if (s.rebyonok){ planRebyonka(s, dt); return; }
    if (s.rol === 'fermer'){ planFermera(s, dt); return; }
    if (s.rol === 'torgovets'){ planTorgovtsa(s, dt); return; }
    if (s.rol === 'shahtyor'){ planShahtyora(s, dt); return; }
    if (nochNa() || moby.some(m => !m.mertv && !m.lezhit)){
      idtiDomoy(s, dt);
      return;
    }
    const drugoy = zhiteli.find(d => d !== s && d.tip === 'zhitel' && Math.hypot(d.x - s.x, d.z - s.z) < KUB * 1.6);
    if (drugoy && (s.t % 9) < 4){
      s.sost = 'kivok';
      s.rotY = Math.atan2(drugoy.x - s.x, drugoy.z - s.z);
      s.t += dt;
      return;
    }
    s.t += dt;
    s.planT += dt;
    if (!s.cel || s.planT > 6){
      s.planT = 0;
      const tochki = [[2, 2.6], [-4, 2.2], [0, 7.6], [5.5, -0.8], [-1, 5.9], [-7, -4.6], [4, 6.5]];
      const p = tochki[Math.floor(Math.random() * tochki.length)];
      s.cel = [p[0] * KUB, p[1] * KUB];
    }
    if (shagatK(s, s.cel[0], s.cel[1], 55, dt)) s.sost = 'idle';
  }
  function planMoba(s, dt){
    if (s.mertv){
      s.mertvT += dt;
      if (s.mertvT > 0.8){
        iskryU(s.x, KUB * 0.6, s.z);
        mir.remove(s.g);
        for (const arr of [moby, sushchestva]){ const i = arr.indexOf(s); if (i >= 0) arr.splice(i, 1); }
        if (s.zont){ mir.remove(s.zont); }
      }
      return;
    }
    if (!nochNa()){
      if (!plyazhGotov){
        /* пляжа ещё нет — просто бродят у восточного края, без зонтов и очков */
        s.t += dt;
        if (!s.brodTochka || s.t > 6){
          s.t = 0;
          s.brodTochka = [(9 + Math.random() * 4) * KUB, (0 + Math.random() * 4) * KUB];
        }
        shagatK(s, s.brodTochka[0], s.brodTochka[1], 40, dt);
        return;
      }
      /* день: на пляж, который построил Стив! каждому — своё место у моря */
      if (!s.plyazhTochka){
        const slot = moby.indexOf(s);
        s.plyazhTochka = [(10.4 + (slot % 3) * 1.25) * KUB, (1.3 + Math.floor(slot / 3) % 3 * 1.05) * KUB];
      }
      if (!s.lezhit){
        if (shagatK(s, s.plyazhTochka[0], s.plyazhTochka[1], 70, dt)){
          s.lezhit = true;
          s.rotY = Math.PI * 0.5 + (moby.indexOf(s) % 3 - 1) * 0.2;   /* головой к морю */
          if (s.ochki) s.ochki.visible = true;
          if (s.tip === 'zombi' && !s.zont) s.zont = novyZont(s.x - KUB * 0.7, s.z);
        }
      }
      return;
    }
    /* ночь: подъём и атака */
    if (s.lezhit){
      s.lezhit = false;
      if (s.ochki) s.ochki.visible = false;
      if (s.zont){ mir.remove(s.zont); s.zont = null; }
    }
    let cel = fonStiv && fonStiv.g.visible ? fonStiv : null, cd = cel ? Math.hypot(cel.x - s.x, cel.z - s.z) : 1e9;
    for (const zh of zhiteli){
      if (zh.tip !== 'zhitel') continue;
      const d = Math.hypot(zh.x - s.x, zh.z - s.z);
      if (d < cd){ cd = d; cel = zh; }
    }
    if (!cel) return;
    /* E1: скелет в 6–9 клетках стреляет вместо сближения */
    if (s.tip === 'skelet' && cd >= KUB * 6 && cd <= KUB * 9){
      s.sost = 'idle';
      s.rotY = Math.atan2(cel.x - s.x, cel.z - s.z);
      s.strelT = (s.strelT || 0) + dt;
      if (s.strelT > 2.5){
        s.strelT = 0;
        vypustitStrelu(s, cel);
      }
      return;
    }
    shagatK(s, cel.x, cel.z, s.tip === 'skelet' ? 66 : 52, dt);
    if (s.tip === 'zombi' && cel.tip === 'zhitel' && cd < KUB * 0.9){
      cel.tip = 'zombi'; cel.hp = 2;
      moby.push(cel);
      const zi = zhiteli.indexOf(cel); if (zi >= 0) zhiteli.splice(zi, 1);
      posledneeSobytieDen = den;   /* D5: отсчёт затишья до следующего ребёнка начинается заново */
      cel.gol.material = [mat(zombiKozha), mat(zombiKozha), mat(zombiKozha), mat(zombiKozha), mat(zombiLitso), mat(zombiKozha)];
      iskryU(cel.x, KUB * 1.4, cel.z);
      zvuk(90, 0.4, 'sawtooth', 0.05);
    }
    /* E4: щит Стива — вплотную моб отскакивает сам, без контратаки */
    if (cel === fonStiv && fonStiv.shchit && fonStiv.shchit.visible && cd < KUB * 1.1){
      s.otbT = (s.otbT || 0) + dt;
      if (s.otbT > 0.5){
        s.otbT = 0;
        const wp = new T.Vector3();
        fonStiv.shchit.getWorldPosition(wp);
        iskryU(wp.x, wp.y, wp.z);
        zvuk(180, 0.06, 'square', 0.03);
        const ot = Math.hypot(s.x - fonStiv.x, s.z - fonStiv.z) || 1;
        s.x += (s.x - fonStiv.x) / ot * KUB * 0.9; s.z += (s.z - fonStiv.z) / ot * KUB * 0.9;
      }
    }
  }
  function planKoshki(s, dt){
    if (!fonStiv || !fonStiv.g.visible) return;
    const d = Math.hypot(fonStiv.x - s.x, fonStiv.z - s.z);
    if (d > KUB * 2.2) shagatK(s, fonStiv.x + KUB * 0.7, fonStiv.z + KUB * 0.7, 210, dt);
    else s.sost = 'idle';
  }
  function planSkota(s, dt){
    if (s.gonyat && !s.vZagone){
      /* бежит в загон; не добежало за 10 с (рельеф/дерево) — переносим с пыхом:
         сгон держал программу города сотни секунд (замерено 12.08) */
      s.gonT = (s.gonT || 0) + dt;
      const cx = (ZAGON.x0 + ZAGON.x1) / 2 + (Math.random() - 0.5) * KUB;
      const cz = (ZAGON.z0 + ZAGON.z1) / 2;
      if (shagatK(s, cx, cz, 130, dt) || s.gonT > 6){
        if (s.gonT > 6){ s.x = cx; s.z = cz; iskryU(s.x, KUB, s.z); }
        s.vZagone = true; s.gonyat = false; s.gonT = 0;
      }
      return;
    }
    s.t += dt;
    if (s.sost === 'pastis'){ if (s.t > 2.4){ s.t = 0; s.sost = 'brodit'; } return; }
    if (!s.cel || s.t > 7){
      s.t = 0;
      if (Math.random() < 0.45){ s.sost = 'pastis'; return; }
      s.cel = s.vZagone
        ? [ZAGON.x0 + Math.random() * (ZAGON.x1 - ZAGON.x0), ZAGON.z0 + Math.random() * (ZAGON.z1 - ZAGON.z0)]
        : [(Math.random() * 10 - 4) * KUB, (Math.random() * 9 - 3) * KUB];
    }
    if (shagatK(s, s.cel[0], s.cel[1], 42, dt)){ s.sost = 'pastis'; s.t = 0; }
  }
  function planKripera(s, dt){
    if (s.vzorvan) return;
    if (!s.celB){
      let bl = null, bd = 1e9;
      for (const b of programma){
        if (!imPo[b.vid] || b.slomano || b.idx >= imPo[b.vid].count) continue;
        if (b.vid === 'rostok' || b.vid === 'stolb' || b.vid === 'perekladina') continue;
        const d = Math.hypot(b.p[0] - s.x, b.p[2] - s.z);
        if (d < bd){ bd = d; bl = b; }
      }
      s.celB = bl;
      if (!bl){ s.vzorvan = true; mir.remove(s.g); return; }
    }
    const d = Math.hypot(s.celB.p[0] - s.x, s.celB.p[2] - s.z);
    if (d > KUB * 1.1){ shagatK(s, s.celB.p[0], s.celB.p[2], 70, dt); return; }
    s.sost = 'idle';
    s.t += dt;
    s.mig = Math.sin(s.t * 18) > 0 ? 1 : 0;
    if (s.t > 1.6){
      s.vzorvan = true;
      vzryv(s.x, s.z);
      mir.remove(s.g);
      const i = sushchestva.indexOf(s); if (i >= 0) sushchestva.splice(i, 1);
      if (kriper === s) kriper = null;
    }
  }

  /* ── железный голем: страж деревни, награда за добытое железо ── */
  let golem = null;
  function sobratGolema(){
    if (golem) return;
    zamedlenie = Math.max(zamedlenie, 4);   /* голем встаёт — момент, темп ×1 */
    const golemTex = pixTex(16, 16, g => {
      zalivka(g, 16, 16, '#dcd9d0', '#ccc9bf', 0.25);
      g.fillStyle = '#a8a59a'; g.fillRect(2, 6, 5, 1); g.fillRect(9, 10, 5, 1); g.fillRect(6, 2, 1, 4);
      g.fillStyle = '#6e8f5a'; g.fillRect(12, 3, 2, 2);
    });
    const golemLitso = pixTex(8, 8, g => {
      zalivka(g, 8, 8, '#dcd9d0', '#ccc9bf', 0.2);
      g.fillStyle = '#8f2f2f'; g.fillRect(1, 3, 2, 2); g.fillRect(5, 3, 2, 2);
      g.fillStyle = '#a8a59a'; g.fillRect(3, 5, 2, 3);
    });
    const gr = new T.Group();
    const tor = new T.Mesh(new T.BoxGeometry(13 * U, 15 * U, 7 * U), mat(golemTex));
    tor.position.y = 21 * U;
    const gol = new T.Mesh(new T.BoxGeometry(6.4 * U, 6.4 * U, 6.4 * U),
      [mat(golemTex), mat(golemTex), mat(golemTex), mat(golemTex), mat(golemLitso), mat(golemTex)]);
    gol.position.y = 32 * U;
    const rL = new T.Mesh(new T.BoxGeometry(3.6 * U, 19 * U, 3.6 * U), mat(golemTex));
    rL.geometry.translate(0, -8 * U, 0); rL.position.set(-8.5 * U, 28 * U, 0);
    const rR = rL.clone(); rR.position.x = 8.5 * U;
    const nL = new T.Mesh(new T.BoxGeometry(4.6 * U, 12 * U, 4.6 * U), mat(golemTex));
    nL.geometry.translate(0, -6 * U, 0); nL.position.set(-3.4 * U, 12 * U, 0);
    const nR = nL.clone(); nR.position.x = 3.4 * U;
    gr.add(tor, gol, rL, rR, nL, nR);
    gr.traverse(o => { if (o.isMesh) o.castShadow = true; });
    mir.add(gr);
    golem = { tip: 'golem', g: gr, gol, tor, rL, rR, nL, nR, x: 0, z: KUB * 6.6,
      rotY: 0, sost: 'idle', faza: 0, t: 0, planT: 0 };
    sushchestva.push(golem);
    for (let i = 0; i < 3; i++) iskryU(golem.x + (i - 1) * KUB * 0.5, KUB * (1 + i * 0.8), golem.z);
    zvuk(120, 0.7, 'sine', 0.1); zvuk(540, 0.3, 'sine', 0.05);
  }
  function planGolema(s, dt){
    let cel = null, cd = 1e9;
    for (const m of moby){
      if (m.mertv || m.lezhit) continue;
      const d = Math.hypot(m.x - s.x, m.z - s.z);
      if (d < cd){ cd = d; cel = m; }
    }
    if (cel && cd < KUB * 14){
      if (cd > KUB * 1.7) shagatK(s, cel.x, cel.z, 105, dt);
      else {
        s.sost = 'udar'; s.rotY = Math.atan2(cel.x - s.x, cel.z - s.z);
        s.planT += dt;
        if (s.planT > 0.8){
          s.planT = 0;
          zvuk(90, 0.2, 'square', 0.07);
          cel.hp -= 2;
          vspyshkaUdara(cel);
          const ot = Math.hypot(cel.x - s.x, cel.z - s.z) || 1;
          cel.x += (cel.x - s.x) / ot * KUB * 3; cel.z += (cel.z - s.z) / ot * KUB * 3;
          iskryU(cel.x, KUB * 1.2, cel.z);
          if (cel.hp <= 0){ cel.mertv = true; cel.mertvT = 0; sozdatDrop(cel.tip === 'skelet' ? 'kost' : 'gnil', cel.x, cel.z); }
        }
      }
      return;
    }
    /* патруль деревни */
    s.t += dt;
    if (!s.cel || s.t > 9){
      s.t = 0;
      const tochki = [[0, 6.6], [3, 0.5], [-4, 3], [5, 5], [-2, -3]];
      const p = tochki[Math.floor(Math.random() * tochki.length)];
      s.cel = [p[0] * KUB, p[1] * KUB];
    }
    if (shagatK(s, s.cel[0], s.cel[1], 46, dt)) s.sost = 'idle';
  }

  /* ── партитура ── */
  let tF = 0, nochByla = false, razvT = 0;
  /* камера-наезд на новый кластер стройки (дом/башня/мельница/колодец) */
  let tekKlaster = null, tKlastera = 999, klasterPoz = null;
  /* D3: тревога — ускоряет бег жителей домой на 10 с после удара в колокол */
  let trevoga = false, trevogaOstalos = 0;
  /* D5: день последнего заражения/появления ребёнка — от него отсчитываются 2 ночи затишья */
  let posledneeSobytieDen = 0;

  /* ── D2: торговля — торговец и фоновый Стив меняются рудой на изумруд ── */
  let torgT = 0, torgovets = null, torgFaza = 0, torgFazaT = 0;
  const torgRuda = new T.Mesh(new T.BoxGeometry(KUB * 0.25, KUB * 0.25, KUB * 0.25), mat(zhelezo));
  torgRuda.visible = false; mir.add(torgRuda);
  const torgIzumrud = new T.Mesh(new T.BoxGeometry(KUB * 0.2, KUB * 0.2, KUB * 0.2),
    new T.MeshBasicNodeMaterial({ color: 0x3fae5a }));
  torgIzumrud.visible = false; mir.add(torgIzumrud);
  function obnovitTorgovlю(dt){
    if (torgFaza >= 1 && (!torgovets || torgovets.mertv || zhiteli.indexOf(torgovets) < 0)){
      torgFaza = 0; torgT = 0; torgRuda.visible = false; torgIzumrud.visible = false;
      return;
    }
    if (torgFaza === 0){
      torgT += dt;
      if (torgT < 40) return;
      if (nochNa() || moby.some(m => !m.mertv && !m.lezhit)) return;
      if (!fonStiv || !fonStiv.g.visible || fonStiv.pod || perehod) return;
      torgovets = zhiteli.find(z => z.rol === 'torgovets');
      if (!torgovets) return;
      torgT = 0; torgFaza = 1;
      return;
    }
    if (torgFaza === 1){
      if (!fonStiv || !fonStiv.g.visible || fonStiv.pod || perehod){ torgFaza = 0; torgT = 0; return; }
      torgovets.torgovlya = true;
      const d = Math.hypot(fonStiv.x - torgovets.x, fonStiv.z - torgovets.z);
      if (d < KUB * 1.5){
        torgFaza = 2; torgFazaT = 0;
        torgovets.rotY = Math.atan2(fonStiv.x - torgovets.x, fonStiv.z - torgovets.z);
        fonStiv.rotY = Math.atan2(torgovets.x - fonStiv.x, torgovets.z - fonStiv.z);
        torgovets.sost = 'idle';
        torgRuda.visible = true; torgIzumrud.visible = true;
        zvuk(880, 0.12, 'sine', 0.04);
        return;
      }
      shagatK(torgovets, fonStiv.x - KUB * 0.7, fonStiv.z - KUB * 0.7, 90, dt);
      return;
    }
    /* фаза 2: лицом друг к другу, кубики летят по дуге и меняются местами */
    torgFazaT += dt;
    const kFaz = Math.min(1, torgFazaT / 1);
    const uS = { x: fonStiv.x, y: mirovayaVysota(fonStiv.x, fonStiv.z) + 34 * U, z: fonStiv.z };
    const uT = { x: torgovets.x, y: mirovayaVysota(torgovets.x, torgovets.z) + 34 * U, z: torgovets.z };
    const dugaY = Math.sin(kFaz * Math.PI) * KUB * 0.6;
    torgRuda.position.set(uS.x + (uT.x - uS.x) * kFaz, uS.y + dugaY, uS.z + (uT.z - uS.z) * kFaz);
    torgIzumrud.position.set(uT.x + (uS.x - uT.x) * kFaz, uT.y + dugaY, uT.z + (uS.z - uT.z) * kFaz);
    if (torgFazaT > 1 && torgFazaT < 1.05) zvuk(1170, 0.1, 'sine', 0.04);
    if (torgFazaT > 2.5){
      torgRuda.visible = false; torgIzumrud.visible = false;
      torgovets.torgovlya = false;
      torgFaza = 0; torgT = 0;
    }
  }
  /* спавн волн — плоские подходы у ворот стены, чтобы мобы не застревали на кручах */
  const TOCHKI_SPAVNA = [[0, 11], [11, 2], [-11, 2]];   /* южные ворота + два боковых прохода */
  function tochkaSpavna(i){
    let [kx, kz] = TOCHKI_SPAVNA[i % TOCHKI_SPAVNA.length];
    if (vysotaKletki(kx, kz) > 1){
      const sosedi = [[kx + 1, kz], [kx - 1, kz], [kx, kz + 1], [kx, kz - 1]];
      const nayden = sosedi.find(([nx, nz]) => vysotaKletki(nx, nz) <= 1);
      if (nayden) [kx, kz] = nayden;
    }
    const razbros = (Math.random() - 0.5) * KUB * 1.6;   /* чтобы не спавнились друг в друге */
    return kx === 0 ? [kx * KUB + razbros, kz * KUB] : [kx * KUB, kz * KUB + razbros];
  }
  function volna(n){
    const zhivyh = moby.filter(m => !m.mertv).length;
    for (let i = 0; i < Math.min(n, 7 - zhivyh); i++){
      const [x, z] = tochkaSpavna(i);
      novyGumanoid(i % 3 === 2 ? 'skelet' : 'zombi', x, z);
    }
    zvuk(70, 0.6, 'sawtooth', 0.05);
    /* D3: колокол бьёт тревогу на старте ночной волны, если уже стоит */
    if (kolokolPostavlen && nochNa()){
      kolokolKachka = 3;
      zvuk(220, 0.5, 'sine', 0.06);
      zvuk(165, 0.7, 'sine', 0.06);
      trevoga = true; trevogaOstalos = 10;
    }
  }
  /* драматургическая арка: ранние ночи мирные (зритель смотрит рост города
     на разгоне), угрозы нарастают ко второй трети — к голему, стене, празднику */
  const partitura = [
    { t: 40,  fn: () => volna(2) },
    { t: 105, fn: () => novoeZhivotnoe('ovtsa', -KUB * 4, KUB * 6) },
    { t: 130, fn: () => volna(3) },
    { t: 170, fn: () => { kriper = novyKriper(KUB * 13, KUB * 6); } },
    { t: 240, fn: () => volna(4) },
    { t: 300, fn: () => { kriper = novyKriper(-KUB * 13, -KUB * 3); } },
  ];
  let sledVolna = 360, razmerVolny = 4;

  /* ── интерфейс ── */
  let mirObzhit = false;
  function ozhivitFon(polnostyu){
    if (!mirObzhit){
      mirObzhit = true;
      /* жители появятся, только когда Стив построит им дома */
      novoeZhivotnoe('korova', -KUB * 1.5, KUB * 4);
      novoeZhivotnoe('korova', KUB * 5, KUB * 3);
      novoeZhivotnoe('ovtsa', KUB * 2, KUB * 6);
    }
    if (polnostyu && !fonStiv){
      fonStiv = novyGumanoid('stiv2', KUB, KUB * 0.5);
      fonStiv.hp = 9;
      const mech = new T.Group();
      const klinok = new T.Mesh(new T.BoxGeometry(0.14 * KUB, 0.85 * KUB, 0.05 * KUB), mat(zhelezo));
      klinok.position.y = -0.62 * KUB;
      const garda = new T.Mesh(new T.BoxGeometry(0.3 * KUB, 0.06 * KUB, 0.08 * KUB), mat(tex.doski));
      garda.position.y = -0.2 * KUB;
      mech.add(klinok, garda);
      mech.position.set(0, -9.5 * U, 1.2 * U);
      mech.rotation.x = -0.12;   /* клинок продолжает руку: при замахе встаёт вертикально */
      mech.visible = false;
      fonStiv.rR.add(mech);
      fonStiv.mech = mech;
      /* кирка для копания */
      const kirka = new T.Group();
      const ruch = new T.Mesh(new T.BoxGeometry(1.2 * U, 9 * U, 1.2 * U), mat(tex.doski));
      ruch.position.y = -1.5 * U;
      const golovka = new T.Mesh(new T.BoxGeometry(1.4 * U, 1.6 * U, 7 * U), mat(tex.kamen));
      golovka.position.set(0, -6.2 * U, 0);
      kirka.add(ruch, golovka);
      kirka.position.set(0, -8 * U, 1.2 * U);
      kirka.rotation.x = -0.5;
      kirka.visible = false;
      fonStiv.rR.add(kirka);
      fonStiv.kirka = kirka;
      /* E4: щит — железо с деревянной каймой, создаётся раз, дальше только toggle видимости */
      const shchitTex = pixTex(16, 16, g => {
        zalivka(g, 16, 16, '#c8ccd2', '#b4b9c0', 0.2);
        g.fillStyle = '#6d5339';
        g.fillRect(0, 0, 16, 2); g.fillRect(0, 14, 16, 2); g.fillRect(0, 0, 2, 16); g.fillRect(14, 0, 2, 16);
      });
      const shchit = new T.Mesh(new T.BoxGeometry(KUB * 0.7, KUB * 0.9, KUB * 0.08), mat(shchitTex));
      shchit.position.set(0, -8.5 * U, 1.5 * U);
      shchit.rotation.x = 1.2;   /* компенсирует наклон поднятой руки — щит остаётся вертикальным */
      shchit.castShadow = true;
      shchit.visible = false;
      fonStiv.rL.add(shchit);
      fonStiv.shchit = shchit;
      koshka = novayaKoshka(KUB * 1.5, KUB);
    }
  }
  function zhiznFona(dt, f, tekSolnVys, tekDen){
    solnVys = tekSolnVys; den = tekDen;
    /* камера-наезд: закладка нового кластера стройки (дом/башня/мельница/колодец) */
    if (shag < programma.length){
      const bTek = programma[shag];
      /* poRelefu (кольцо стены) даёт десятки ложных «зон» — камера наезжала бы вдоль всей стены */
      if (bTek.p && !bTek.poRelefu && (bTek.vid === 'd' || bTek.vid === 'k' || bTek.vid === 'ds')){
        const kl = `${Math.round(bTek.p[0] / (KUB * 4))},${Math.round(bTek.p[2] / (KUB * 4))}`;
        if (kl !== tekKlaster){
          tekKlaster = kl; tKlastera = 0;
          klasterPoz = { x: bTek.p[0], z: bTek.p[2] };
        }
      }
    }
    tKlastera += dt;
    obnovitLetyashchie(dt);
    obnovitRaschLog(dt);   /* этап 2: летящее бревно расчистки */
    if (fonStiv){
      tF += dt;
      for (const s of partitura) if (!s.done && tF >= s.t){ s.done = true; s.fn(); }
      if (tF > sledVolna){ sledVolna += 50; volna(Math.min(razmerVolny++, 7)); }
    }
    /* смена суток: ночью — подкрепление тьмы; на рассвете — пересдача пляжа
       и заселение пустующих домов */
    const noch = nochNa();
    /* C2: дым из труб — эмиссия только ночью */
    obnovitDym(dt);
    /* C3: фонари включаются с приходом ночи, гаснут днём */
    for (let i = 0; i < fonarSveta.length; i++){
      const svet = fonarSveta[i];
      const poz = fonariPozicii[i];
      if (!poz){ svet.intensity = 0; continue; }
      svet.position.set(poz.x, poz.y, poz.z);
      svet.intensity = noch ? 2 : 0;
      poz.lampa.material.color.set(noch ? 0xffcf8a : 0x9c8468);
    }
    /* D1: капли полива */
    obnovitKapli(dt);
    /* E2: дроп с убитых мобов */
    obnovitDropy(dt);
    /* E1: летящие стрелы скелетов */
    obnovitStrely(dt);
    /* D2: торговля торговца со Стивом */
    obnovitTorgovlю(dt);
    /* D3: качание колокола + отсчёт тревоги */
    if (kolokolMesh && kolokolKachka > 0){
      kolokolKachka = Math.max(0, kolokolKachka - dt);
      kolokolMesh.rotation.z = Math.sin(kolokolKachka * 14) * (kolokolKachka / 3) * 0.35;
    } else if (kolokolMesh) kolokolMesh.rotation.z *= 0.9;
    if (trevogaOstalos > 0){
      trevogaOstalos -= dt;
      if (trevogaOstalos <= 0){ trevogaOstalos = 0; trevoga = false; }
    }
    /* D4: салют и таймер праздника стены */
    obnovitSalyut(dt);
    if (prazdnikT >= 0){
      prazdnikT += dt;
      if (prazdnikZalpov < 3 && prazdnikT >= prazdnikZalpov * 1.2) { zapustitZalp(); prazdnikZalpov++; }
      if (prazdnikT > 8){
        prazdnikT = -1;
        for (const zh of zhiteli) zh.prazdnik = false;
      }
    }
    if (noch && !nochByla){ nochByla = true; if (fonStiv) volna(1 + Math.min(den, 2)); }
    if (!noch && nochByla){
      nochByla = false;
      /* канон: лишние мобы догорают на солнце — поле чистится, ночи-бои не
         превращаются в бесконечную мясорубку (кап выживших — 3, они идут на пляж) */
      const zhivye = moby.filter(m => !m.mertv && !m.lezhit);
      for (let i = 3; i < zhivye.length; i++){
        zhivye[i].mertv = true; zhivye[i].mertvT = 0;
        iskryU(zhivye[i].x, KUB * 1.4, zhivye[i].z);
      }
      for (const m of moby) m.plyazhTochka = null;
      while (zhiteli.length < zaseleno && zhiteli.length < DOMA.length){
        const i = zhiteli.length;
        const zh = novyGumanoid('zhitel', DOMA[i][0] * KUB, (DOMA[i][1] - 2.6) * KUB);
        zh.dom = [DOMA[i][0] * KUB, DOMA[i][1] * KUB];
      }
      /* D5: ребёнок — раз в ≥2 ночи затишья, если взрослых хватает и лимит не выбран */
      const vzroslyh = zhiteli.filter(z => !z.rebyonok).length;
      const detey = zhiteli.filter(z => z.rebyonok).length;
      if (vzroslyh >= 2 && detey < 2 && den - posledneeSobytieDen >= 2){
        posledneeSobytieDen = den;
        const roditeli = zhiteli.filter(z => !z.rebyonok);
        const dom = roditeli.length ? roditeli[Math.floor(Math.random() * roditeli.length)].dom : [DOM_X, DOM_Z];
        const rb = novyGumanoid('zhitel', dom[0], dom[1] - KUB * 1.5, true);
        rb.rost = 0.55;
        rb.g.scale.setScalar(0.55);
        zamedlenie = Math.max(zamedlenie, 3);   /* ребёнок родился — момент, темп ×1 */
        rb.dom = dom;
        iskryU(rb.x, KUB * 0.6, rb.z);
        zvuk(1040, 0.16, 'sine', 0.05);
      }
    }
    if (krylya.visible) krylya.rotation.z += dt * 0.9;
    /* разведение: пара в загоне — приплод (лимит стада) */
    razvT += dt;
    if (razvT > 42 && skot.length < 9){
      for (const vid of ['korova', 'ovtsa']){
        const vZag = skot.filter(z => z.vid !== undefined ? false : z.tip === vid && z.vZagone && (z.rost === undefined || z.rost >= 1));
        if (vZag.length >= 2){
          const [a, b] = vZag;
          if (Math.hypot(a.x - b.x, a.z - b.z) < KUB * 2.2){
            razvT = 0;
            const malysh = novoeZhivotnoe(vid, (a.x + b.x) / 2 + KUB * 0.4, (a.z + b.z) / 2);
            malysh.rost = 0.45;
            malysh.g.scale.setScalar(0.45);
            malysh.vZagone = true;
            iskryU(malysh.x, KUB * 1.2, malysh.z);
            zvuk(980, 0.12, 'sine', 0.05); zvuk(1240, 0.1, 'sine', 0.04);
            break;
          }
        }
      }
    }
    /* СЕПАРАЦИЯ: два тела не пересекаются — толпа расходится, а не сливается
       (владелец 12.08: «5 зомби друг в друге, овцы и коровы друг в друге») */
    sepKadr = !sepKadr;
    if (sepKadr){
      const R_SEP = KUB * 0.6;
      for (let i = 0; i < sushchestva.length; i++){
        const a = sushchestva[i];
        if (a.mertv || a.lezhit) continue;
        for (let j = i + 1; j < sushchestva.length; j++){
          const b = sushchestva[j];
          if (b.mertv || b.lezhit) continue;
          const dx = b.x - a.x, dz = b.z - a.z;
          const d = Math.hypot(dx, dz);
          if (d >= R_SEP || d < 0.0001) continue;
          const t = (R_SEP - d) / 2, nx = dx / d, nz = dz / d;
          /* Стива не толкаем — он режиссёрский центр; сосед уходит на всю величину */
          if (a === fonStiv){ b.x += nx * t * 2; b.z += nz * t * 2; }
          else if (b === fonStiv){ a.x -= nx * t * 2; a.z -= nz * t * 2; }
          else { a.x -= nx * t; a.z -= nz * t; b.x += nx * t; b.z += nz * t; }
        }
      }
    }
    for (const s of [...sushchestva]){
      if (s === fonStiv){ if (s.g.visible) planStiva(s, dt, f); }
      else if (s.tip === 'zombi' || s.tip === 'skelet') planMoba(s, dt);
      else if (s.tip === 'zhitel') planZhitelya(s, dt, f);
      else if (s.tip === 'koshka') planKoshki(s, dt);
      else if (s.tip === 'korova' || s.tip === 'ovtsa') planSkota(s, dt);
      else if (s.tip === 'kriper') planKripera(s, dt);
      else if (s.tip === 'golem') planGolema(s, dt);
      pozaSushch(s, dt, f);
    }
  }
  /* режиссёрская партитура: что считается событием — см. шапку файла.
     Вызывается из index.html раз в кадр с реальным dt; возвращает множитель,
     на который умножается мировое время (zhiznFona, сутки, облака). */
  let raschistkaVremya = 0;
  function tempo(dt){
    /* бой — событие, только когда он РЯДОМ с деревней/Стивом (как в planStiva) */
    const boy = nochNa() && moby.some(m => !m.mertv && !m.lezhit &&
      (Math.hypot(m.x, m.z) < KUB * 10 ||
       (fonStiv && Math.hypot(m.x - fonStiv.x, m.z - fonStiv.z) < KUB * 8)));
    if (nochNa() && nochT === 0) nochNomer++;
    nochT = nochNa() ? nochT + dt : 0;
    /* сшибку ×1 показываем целиком первые 3 ночи и потом раз в 5 ночей —
       иначе 30 ночей × 5 с сшибки съедали 2.5 минуты хронометража */
    const sshibkaNochi = nochNomer <= 3 || nochNomer % 5 === 0;
    /* этап 2: первые 6 реальных секунд расчистки — темп ×1, камера на Стиве у первого дерева */
    const vRaschistke = shag < programma.length && programma[shag].vid === 'raschistka';
    raschistkaVremya = vRaschistke ? raschistkaVremya + dt : 0;
    const sobytie =
      (boy && sshibkaNochi && nochT < 5) ||                     /* сшибка ночи: первые 5 с */
      (kriper && !kriper.vzorvan) ||                            /* крипер крадётся */
      (klasterPoz && tKlastera < 6) ||                          /* закладка здания, камера наезжает */
      (vRaschistke && raschistkaVremya < 6) ||                  /* старт расчистки — первые 6 с */
      (shag < programma.length && programma[shag].vid === 'sgon') || /* сгон стада */
      torgFaza > 0 ||                                           /* сценка обмена */
      uEkranaFlag || perehod ||                                 /* Стив у экрана / лестница */
      zamedlenie > 0;                                           /* одноразовые события */
    if (zamedlenie > 0) zamedlenie -= dt;
    if (sobytie) tekTempo = 1;                                  /* замедление — мгновенный удар */
    else if (boy) tekTempo += (5 - tekTempo) * Math.min(1, dt); /* затянувшийся бой — полурежим ×5 */
    else tekTempo += (TEMPO_MAX - tekTempo) * Math.min(1, dt * 0.35); /* разгон ~6 с */
    return tekTempo * USKOR;
  }
  function tochkaInteresa(){
    const boy = nochNa() && moby.find(m => !m.mertv && !m.lezhit);
    if (boy && fonStiv) return { x: (boy.x + fonStiv.x) / 2, z: (boy.z + fonStiv.z) / 2, blizko: true };
    if (kriper && !kriper.vzorvan) return { x: kriper.x, z: kriper.z, blizko: true };
    /* новый кластер стройки — наезд камеры на первые 6 секунд, потом отпускаем */
    if (klasterPoz && tKlastera < 6) return { x: klasterPoz.x, z: klasterPoz.z, blizko: true };
    /* этап 2: первые 6 с расчистки — камера на Стиве у первого дерева */
    if (raschistkaVremya > 0 && raschistkaVremya < 6 && fonStiv) return { x: fonStiv.x, z: fonStiv.z, blizko: true };
    if (fonStiv && fonStiv.g.visible) return { x: fonStiv.x, z: fonStiv.z, blizko: false };
    return { x: 0, z: 0, blizko: false };
  }
  function rezhim(){
    if (nochNa() && moby.some(m => !m.mertv && !m.lezhit)) return 'boj';
    if (moby.some(m => m.lezhit)) return 'plyazh';
    return 'stroit';
  }
  return {
    ozhivitFon, zhiznFona, tochkaInteresa, rezhim,
    rovnyat(kx, kz){ if (tekVys(kx, kz) > 0) opustitKletku(kx, kz); },
    shahtyor(poz){
      if (!fonStiv) return;
      fonStiv.pod = poz;
      if (poz) fonStiv.g.visible = true;
    },
    kLestnice(){ if (fonStiv && !uEkranaFlag && !perehod) perehod = { faza: 0, t: 0 }; },
    zanyat(kx, kz){ zanyato.add(`${kx},${kz}`); },
    debug(){
      return {
        shag, dlina: programma.length,
        tekShag: programma[shag] ? programma[shag].vid : 'конец',
        stiv: fonStiv ? { x: Math.round(fonStiv.x / KUB * 10) / 10, z: Math.round(fonStiv.z / KUB * 10) / 10,
          sost: fonStiv.sost, vidim: fonStiv.g.visible, pod: !!fonStiv.pod } : null,
        perehod: perehod ? perehod.faza : null, uEkrana: uEkranaFlag,
        mobov: moby.length, zhitelej: zhiteli.length, shahtaOstalos, remont: remont.length, tF: Math.round(tF),
        tempo: Math.round(tekTempo * 10) / 10, polozheno, zamedl: Math.round(zamedlenie * 10) / 10,
        planT: fonStiv ? Math.round((fonStiv.planT || 0) * 100) / 100 : null,
        tKl: Math.round(tKlastera * 10) / 10,
        zT: fonStiv ? Math.round((fonStiv.zT || 0) * 100) / 100 : null,
        zR: fonStiv ? (fonStiv.zRezhim || null) : null
      };
    },
    tempo,
    uEkrana(){ return uEkranaFlag; },
    vernulsya(){
      if (!fonStiv) return;
      uEkranaFlag = false;
      fonStiv.g.visible = true;
      fonStiv.x = LEST.x; fonStiv.z = LEST.z - KUB;
      fonStiv.yOverride = null;
    },
    pokazatStiva(v){ if (fonStiv) fonStiv.g.visible = v; },
    estZhiteli(){ return zhiteli.length > 0; }
  };
}
