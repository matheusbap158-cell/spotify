/* Palco: o desenho que a música faz, num canvas fixo atrás dos textos.
   "fase" é um número contínuo (0 a 5) derivado da rolagem; cada fase é uma cena
   e as vizinhas se misturam, nunca há corte seco. */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var cv = document.getElementById('palco');
  var ptr = { x: .5, y: .5, sx: .5, sy: .5 };
  window.addEventListener('pointermove', function (e) { ptr.x = e.clientX / window.innerWidth; ptr.y = e.clientY / window.innerHeight; }, { passive: true });
  var g = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  var reduz = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var pequeno = window.matchMedia('(max-width:700px)').matches;

  var estado = {
    fase: 0,          // 0..5 contínuo
    beat: 0,          // 1 no golpe, decai
    energia: 0,       // 0..1 suavizado
    giro: 0,          // rotação do disco, ligada à rolagem
    cor: [30, 215, 96],
    t: 0
  };
  var secoes = [];    // posições absolutas das seções cap-0..cap-5
  var scrollY = 0, scrollAnt = 0, vel = 0;

  /* ---- util ---- */
  function hexRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return [30, 215, 96];
    var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function suave(x) { return x * x * (3 - 2 * x); }
  // ruído barato e determinístico
  function rr(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function vn(x) { var i = Math.floor(x), f = x - i; return mix(rr(i), rr(i + 1), suave(f)); }

  /* ---- medidas ---- */
  function medir() {
    DPR = Math.min(window.devicePixelRatio || 1, pequeno ? 1.5 : 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    secoes = [];
    for (var i = 0; i <= 5; i++) {
      var el = document.getElementById('cap-' + i);
      if (!el) continue;
      var r = el.getBoundingClientRect();
      secoes.push({ top: r.top + window.scrollY, h: r.height });
    }
  }
  function calcularFase() {
    var y = window.scrollY + H * .5;
    var f = 0;
    for (var i = 0; i < secoes.length; i++) {
      var s = secoes[i];
      if (i === 0) { f = clamp(window.scrollY / Math.max(1, s.h - H * .5), 0, 1); continue; }
      if (y >= s.top) f = i + clamp((y - s.top) / s.h, 0, 1);
    }
    return clamp(f, 0, 5);
  }

  /* ---- cenas ---- */
  var N = 64;

  function linhaSilencio(a, amp, y) {
    var c = estado.cor;
    g.strokeStyle = rgba(c, .9 * a); g.lineWidth = 2;
    g.beginPath();
    for (var x = 0; x <= W; x += 6) {
      var env = Math.sin(Math.PI * x / W);
      var v = (vn(x * .02 + estado.t * 1.3) - .5) * amp * env;
      if (x === 0) g.moveTo(x, y + v); else g.lineTo(x, y + v);
    }
    g.stroke();
  }

  var poeira = null;
  function cena0(a, lp) {          // abertura: anel de espectro + poeira que foge do cursor
    ptr.sx += (ptr.x - ptr.sx) * .08; ptr.sy += (ptr.y - ptr.sy) * .08;
    var cx = W * (W < 900 ? .5 : .73), cy = H * (W < 900 ? .76 : .47);
    cx += (ptr.sx - .5) * 26; cy += (ptr.sy - .5) * 18;
    var R = Math.min(W * (W < 900 ? .4 : .3), H * (W < 900 ? .2 : .38));
    var esp = window.Som && Som.espectro();
    var M = pequeno ? 90 : 160;
    g.lineCap = 'round';
    for (var i = 0; i < M; i++) {
      var u = i / M, ang = u * 6.2832 - 1.5708;
      var k = Math.abs(u * 2 - 1);                       // espelhado, como um espectro de verdade
      var v = esp ? esp[2 + Math.floor((1 - k) * 60)] / 255
                  : vn(i * .22 + estado.t * 1.6) * (.35 + estado.beat * .55);
      var len = 6 + v * R * .55 + estado.beat * R * .06;
      var r0 = R * 1.02;
      g.strokeStyle = rgba(estado.cor, (.35 + v * .6) * a);
      g.lineWidth = pequeno ? 2 : 2.6;
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      g.lineTo(cx + Math.cos(ang) * (r0 + len), cy + Math.sin(ang) * (r0 + len));
      g.stroke();
    }
    // anéis finos que respiram
    for (var q = 0; q < 3; q++) {
      g.strokeStyle = rgba(estado.cor, (.16 - q * .04) * a);
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, R * (1.35 + q * .28) + estado.beat * (10 + q * 6), 0, 6.2832); g.stroke();
    }
    // poeira
    if (!poeira) {
      poeira = [];
      for (var d = 0; d < (pequeno ? 50 : 110); d++) poeira.push({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .9, p: Math.random() * 6 });
    }
    var mxp = ptr.sx * W, myp = ptr.sy * H;
    for (var n = 0; n < poeira.length; n++) {
      var o = poeira[n];
      var px = o.x * W + Math.sin(estado.t * .25 + o.p) * 18 * o.z, py = ((o.y * H - estado.t * 6 * o.z) % H + H) % H;
      var dx = px - mxp, dy = py - myp, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < 140) { var f = (1 - dd / 140) * 38; px += dx / (dd || 1) * f; py += dy / (dd || 1) * f; }
      g.fillStyle = rgba(estado.cor, (.12 + .35 * o.z + estado.beat * .15) * a);
      g.beginPath(); g.arc(px, py, .8 + o.z * 1.6, 0, 6.2832); g.fill();
    }
  }

  function cena1(a, lp) {          // silêncio: linha acorda, círculos lentos
    var cx = W * (pequeno ? .5 : .72), cy = H * .5;
    var amp = 4 + lp * 70 + estado.beat * 20;
    linhaSilencio(a, amp, cy);
    for (var i = 0; i < 4; i++) {
      var k = ((estado.t * .18 + i / 4) % 1);
      g.strokeStyle = rgba(estado.cor, (1 - k) * .35 * a * (.3 + lp));
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, 30 + k * Math.min(W, H) * .5, 0, 6.283); g.stroke();
    }
    var n = Math.round(1 + lp * 3);
    g.fillStyle = rgba(estado.cor, a * .9);
    g.beginPath(); g.arc(cx, cy, 5 + estado.beat * 4, 0, 6.283); g.fill();
  }

  function cena2(a, lp) {          // batida: equalizador de barras
    var esp = window.Som && Som.espectro();
    var bw = W / N, base = H * .96;
    var altura = H * (.18 + .42 * clamp(lp * 1.6, 0, 1));
    for (var i = 0; i < N; i++) {
      var u = i / N, v;
      if (esp) v = esp[Math.min(esp.length - 1, 2 + Math.floor(u * 70))] / 255;
      else v = vn(i * .35 + estado.t * 2.2) * (.35 + .65 * Math.sin(Math.PI * u)) * (.45 + estado.beat * .55);
      v = v * .85 + estado.beat * .12 * Math.sin(Math.PI * u);
      var h = Math.max(3, v * altura * (.5 + lp));
      var gr = g.createLinearGradient(0, base - h, 0, base);
      gr.addColorStop(0, rgba(estado.cor, .95 * a));
      gr.addColorStop(1, rgba(estado.cor, .15 * a));
      g.fillStyle = gr;
      var x = i * bw + bw * .18;
      g.fillRect(x, base - h, bw * .64, h);
      // espelho suave no teto
      g.fillStyle = rgba(estado.cor, .06 * a);
      g.fillRect(x, 0, bw * .64, h * .35);
    }
  }

  function cena3(a, lp) {          // playlist: disco que gira com a rolagem
    var cx = W * (pequeno ? .5 : .74), cy = H * (pequeno ? .8 : .5);
    var R = Math.min(W, H) * (pequeno ? .2 : .34);
    // brilho
    var gl = g.createRadialGradient(cx, cy, R * .2, cx, cy, R * 1.7);
    gl.addColorStop(0, rgba(estado.cor, .22 * a)); gl.addColorStop(1, rgba(estado.cor, 0));
    g.fillStyle = gl; g.fillRect(0, 0, W, H);
    g.save(); g.translate(cx, cy); g.rotate(estado.giro);
    g.fillStyle = '#0b0a0d'; g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.fill();
    g.lineWidth = 1;
    for (var r = R * .42; r < R * .98; r += 5) {
      g.strokeStyle = 'rgba(255,255,255,' + (.04 + ((r * .7) % 3) * .02) * a + ')';
      g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.stroke();
    }
    // reflexo
    var cone = g.createConicGradient ? g.createConicGradient(0, 0, 0) : null;
    if (cone) {
      cone.addColorStop(0, 'rgba(255,255,255,0)'); cone.addColorStop(.08, 'rgba(255,255,255,' + .16 * a + ')');
      cone.addColorStop(.16, 'rgba(255,255,255,0)'); cone.addColorStop(.5, 'rgba(255,255,255,0)');
      cone.addColorStop(.58, 'rgba(255,255,255,' + .12 * a + ')'); cone.addColorStop(.66, 'rgba(255,255,255,0)');
      g.fillStyle = cone; g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.fill();
    }
    // selo
    g.fillStyle = rgba(estado.cor, a); g.beginPath(); g.arc(0, 0, R * .3, 0, 6.283); g.fill();
    g.fillStyle = '#060507'; g.beginPath(); g.arc(0, 0, R * .045, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
    for (var k = 1; k <= 3; k++) { g.beginPath(); g.arc(0, 0, R * (.1 + k * .06), .3, 2.3); g.stroke(); }
    g.restore();
    // anel de barras ao redor
    var M = 72, esp = window.Som && Som.espectro();
    g.strokeStyle = rgba(estado.cor, .9 * a); g.lineWidth = 3; g.lineCap = 'round';
    for (var i = 0; i < M; i++) {
      var ang = i / M * 6.283 - 1.5708;
      var v = esp ? esp[2 + i % 40] / 255 : vn(i * .5 + estado.t * 2) * (.4 + estado.beat * .6);
      var l = 6 + v * R * .28;
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * (R * 1.08), cy + Math.sin(ang) * (R * 1.08));
      g.lineTo(cx + Math.cos(ang) * (R * 1.08 + l), cy + Math.sin(ang) * (R * 1.08 + l));
      g.stroke();
    }
  }

  function cena4(a, lp) {          // show: feixes de luz e plateia
    var lum = .35 + estado.beat * .65;
    g.globalCompositeOperation = 'lighter';
    var feixes = pequeno ? 5 : 8;
    for (var i = 0; i < feixes; i++) {
      var u = (i + .5) / feixes;
      var ox = W * u;
      var ang = Math.sin(estado.t * (.5 + i * .13) + i * 1.7) * .55 + (u - .5) * .6;
      var len = H * 1.1, ex = ox + Math.sin(ang) * len, ey = Math.cos(ang) * len;
      var cor = i % 3 === 0 ? estado.cor : (i % 3 === 1 ? [255, 255, 255] : [140, 120, 255]);
      var gr = g.createLinearGradient(ox, 0, ex, ey);
      gr.addColorStop(0, rgba(cor, .55 * a * lum)); gr.addColorStop(1, rgba(cor, 0));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(ox - 5, 0); g.lineTo(ox + 5, 0);
      g.lineTo(ex + 80, ey); g.lineTo(ex - 80, ey); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    // plateia: cabeças e mãos
    var n = pequeno ? 22 : 44;
    g.fillStyle = '#030204';
    for (var j = 0; j < n; j++) {
      var x = (j + .5) / n * W + (rr(j) - .5) * 30;
      var y = H * (.9 + rr(j + 9) * .1) - Math.abs(Math.sin(estado.t * 3 + j * 1.3)) * (6 + estado.beat * 14);
      var r = H * (.028 + rr(j + 3) * .018);
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      g.fillRect(x - r * 1.3, y, r * 2.6, H);
      if (rr(j + 20) > .6) {   // braço levantado
        g.fillRect(x + r * .6, y - r * 3.2 - estado.beat * 8, r * .5, r * 3.4);
      }
    }
    // flash no golpe forte
    if (estado.beat > .85) { g.fillStyle = 'rgba(255,255,255,' + .06 * a + ')'; g.fillRect(0, 0, W, H); }
  }

  function cena5(a, lp) {          // wrapped: ondas coloridas
    var cores = [[30, 215, 96], [79, 140, 255], [255, 122, 198], [255, 176, 46], [180, 107, 255]];
    g.globalCompositeOperation = 'lighter';
    for (var k = 0; k < cores.length; k++) {
      g.beginPath();
      var yb = H * (.28 + k * .12);
      for (var x = 0; x <= W; x += 8) {
        var y = yb + Math.sin(x * .006 + estado.t * (.7 + k * .18) + k) * (30 + estado.beat * 16)
          + Math.sin(x * .013 - estado.t * .9 + k * 2) * 14;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.lineTo(W, H); g.lineTo(0, H); g.closePath();
      g.fillStyle = rgba(cores[k], .09 * a);
      g.fill();
      g.strokeStyle = rgba(cores[k], .55 * a); g.lineWidth = 2; g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }

  var CENAS = [cena0, cena1, cena2, cena3, cena4, cena5];

  /* ---- loop ---- */
  var INTENS = [0, .12, .5, .72, 1, .62];
  var ultimoFrame = 0;
  var bpmEl = document.getElementById('bpmNum');
  var volEl = document.getElementById('medVol');

  function quadro(ts) {
    if (!reduz) requestAnimationFrame(quadro);
    var dt = Math.min(.05, (ts - ultimoFrame) / 1000 || .016); ultimoFrame = ts;
    estado.t += dt;
    scrollY = window.scrollY;
    vel = vel * .9 + Math.abs(scrollY - scrollAnt) * .1; scrollAnt = scrollY;

    var f = calcularFase(); estado.fase = mix(estado.fase, f, .18);
    var i0 = Math.floor(estado.fase), i1 = Math.min(5, i0 + 1), t = suave(clamp((estado.fase - i0 - .55) / .45, 0, 1));
    if (i0 === 5) { t = 0; }

    // intensidade → som e visual
    var alvo = mix(INTENS[i0], INTENS[i1], t);
    estado.energia = mix(estado.energia, alvo, .08);
    if (window.Som) Som.intensidade(estado.energia);
    estado.beat = Math.max(0, estado.beat - dt * 3.2);
    raiz.style.setProperty('--beat', estado.beat.toFixed(2));
    estado.giro += dt * (.35 + estado.energia * 1.6) + (scrollY - (estado._sy || scrollY)) * .0025;
    estado._sy = scrollY;

    // partes do texto ligadas à fase
    if (volEl) volEl.style.transform = 'scaleX(' + clamp((estado.fase - .8) * 1.6, 0, 1).toFixed(3) + ')';
    if (bpmEl) {
      var bpmAlvo = window.Som ? Som.bpm() : 100;
      bpmEl.textContent = Math.round(bpmAlvo * clamp((estado.fase - 1.55) / .7, 0, 1));
    }

    g.clearRect(0, 0, W, H);
    g.fillStyle = '#060507'; g.fillRect(0, 0, W, H);
    // as cenas de fundo só existem enquanto a jornada está na tela
    var a0 = 1 - t, a1 = t;
    g.globalAlpha = 1;
    desenhar(i0, a0);
    if (a1 > .01 && i1 !== i0) desenhar(i1, a1);
    g.globalAlpha = 1;
  }
  function desenhar(i, a) {
    if (a <= .01) return;
    var lp = clamp(estado.fase - i, 0, 1);
    g.save();
    try { CENAS[i](a, lp); } finally { g.restore(); }
  }

  /* ---- batidas vindas do relógio do som ---- */
  if (window.Som) {
    Som.aoPasso(function (p) {
      var forte = p % 16 === 0, quarto = p % 4 === 0;
      if (forte) estado.beat = 1;
      else if (quarto && estado.energia > .3) estado.beat = Math.max(estado.beat, .8);
      else if (p % 2 === 0 && estado.energia > .6) estado.beat = Math.max(estado.beat, .35);
    });
  }

  /* ---- API pública ---- */
  window.Palco = {
    cor: function (hex) {
      var c = hexRgb(hex); estado.cor = c;
      document.documentElement.style.setProperty('--acento', hex);
    },
    fase: function () { return estado.fase; },
    energia: function () { return estado.energia; },
    recalcular: medir
  };

  window.addEventListener('resize', function () { pequeno = window.matchMedia('(max-width:700px)').matches; medir(); });
  window.addEventListener('load', medir);
  medir();
  if (reduz) {
    // movimento reduzido: sem laço contínuo, só redesenha quando a pessoa rola
    var redesenha = function () { quadro(performance.now()); };
    window.addEventListener("scroll", redesenha, { passive: true });
    redesenha();
  } else {
    requestAnimationFrame(quadro);
  }
})();
