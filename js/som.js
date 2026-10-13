/* Som sintetizado (Web Audio). Nenhum arquivo de música: tudo nasce aqui.
   Camadas entram conforme a "intensidade" (0..1), que a rolagem controla:
   pad > hat > bumbo > baixo > arpejo.
   Mesmo com o som desligado, o relógio visual continua a bater no mesmo BPM. */
(function () {
  'use strict';

  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, filtro = null, analisador = null, dados = null;
  var ligado = false;
  var bpm = 100, intensidade = 0, tom = 0;
  var passo = 0, proximo = 0;               // 16avos
  var ouvintes = [];
  var timer = null;
  var ruido = null;

  // acordes (graus em semitons a partir da tônica) — Am, F, C, G
  var ACORDES = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
  var BAIXO = [0, 0, -4, -4, 3, 3, -2, -2];
  var base = 110; // A2

  function hz(semi) { return base * Math.pow(2, (semi + tom) / 12); }

  function criar() {
    if (ctx || !AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 500; filtro.Q.value = .7;
    analisador = ctx.createAnalyser(); analisador.fftSize = 256; analisador.smoothingTimeConstant = .8;
    dados = new Uint8Array(analisador.frequencyBinCount);
    filtro.connect(master); master.connect(analisador); analisador.connect(ctx.destination);
    // ruído branco de 1 s para o chimbal
    var n = ctx.sampleRate, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    ruido = buf;
  }

  function nota(f, t, dur, tipo, vol, att) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (att || .01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(filtro);
    o.start(t); o.stop(t + dur + .05);
  }
  function bumbo(t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
    g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .32);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + .36);
  }
  function chimbal(t, aberto) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(aberto ? .16 : .1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (aberto ? .22 : .05));
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + .3);
  }

  function agendar(p, t) {
    var compasso = Math.floor(p / 16) % 4, i = p % 16, I = intensidade;
    var acorde = ACORDES[compasso];
    // pad: no início de cada compasso
    if (i === 0 && I > .02) {
      acorde.forEach(function (s, k) {
        nota(hz(s + 12), t, 60 / bpm * 4.1, 'triangle', .05 + I * .05, .4 + k * .05);
      });
    }
    // chimbal
    if (I > .25 && i % 2 === 0) chimbal(t, i % 8 === 6);
    // bumbo: quatro no chão a partir de .4
    if (I > .4 && i % 4 === 0) bumbo(t);
    // baixo
    if (I > .6 && (i % 4 === 0 || i === 10)) {
      var g = BAIXO[(compasso * 2 + (i >= 8 ? 1 : 0)) % BAIXO.length];
      nota(hz(g - 12), t, 60 / bpm * .45, 'sawtooth', .22, .005);
    }
    // arpejo
    if (I > .78 && i % 2 === 1) {
      var s = acorde[((i - 1) / 2) % acorde.length | 0];
      nota(hz(s + 24), t, 60 / bpm * .22, 'square', .045, .004);
    }
  }

  function agora() { return (ctx && ligado) ? ctx.currentTime : performance.now() / 1000; }

  function loop() {
    var dur16 = 60 / bpm / 4;
    var t0 = agora();
    if (proximo < t0 - .5) proximo = t0 + .05;
    while (proximo < t0 + .12) {
      if (ligado && ctx) agendar(passo, proximo);
      var atraso = Math.max(0, (proximo - t0) * 1000), p = passo;
      (function (p, atraso) {
        setTimeout(function () { ouvintes.forEach(function (f) { f(p); }); }, atraso);
      })(p, atraso);
      proximo += dur16; passo = (passo + 1) % 64;
    }
    if (ligado && ctx) {
      // a rolagem abre o filtro: som abafado no silêncio, aberto no show
      var alvo = 380 + Math.pow(intensidade, 1.3) * 7600;
      filtro.frequency.setTargetAtTime(alvo, ctx.currentTime, .15);
    }
  }

  function iniciarRelogio() { if (!timer) timer = setInterval(loop, 25); }

  window.Som = {
    suportado: !!AC,
    ligado: function () { return ligado; },
    ligar: function () {
      if (!AC) return false;
      criar();
      if (ctx.state === 'suspended') ctx.resume();
      ligado = true; proximo = 0;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(.75, ctx.currentTime, .25);
      return true;
    },
    desligar: function () {
      if (!ctx) { ligado = false; return; }
      master.gain.setTargetAtTime(0, ctx.currentTime, .12);
      ligado = false; proximo = 0;
    },
    alternar: function () { return ligado ? (this.desligar(), false) : this.ligar(); },
    intensidade: function (v) { intensidade = Math.max(0, Math.min(1, v)); },
    bpm: function (v) { if (v) bpm = Math.max(60, Math.min(160, v)); return bpm; },
    tom: function (v) { tom = v | 0; },
    aoPasso: function (f) { ouvintes.push(f); },
    /* nível médio 0..1 vindo do som real (0 se desligado) */
    nivel: function () {
      if (!ligado || !analisador) return 0;
      analisador.getByteFrequencyData(dados);
      var s = 0, n = 24; for (var i = 0; i < n; i++) s += dados[i];
      return s / n / 255;
    },
    espectro: function () { if (!ligado || !analisador) return null; analisador.getByteFrequencyData(dados); return dados; }
  };

  iniciarRelogio();
})();
