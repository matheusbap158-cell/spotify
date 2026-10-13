/* Hero: órbita 3D de capas, player "Tocando agora", título letra a letra,
   luz do cursor, botões magnéticos e entrada das seções. */
(function () {
  'use strict';

  var reduz = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var fino = window.matchMedia('(hover:hover)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var raiz = document.documentElement;

  /* ---- título: palavra por palavra, letra por letra ---- */
  $$('.hero-t .l').forEach(function (linha, li) {
    var texto = linha.textContent, n = 0;
    linha.textContent = '';
    texto.split(' ').forEach(function (palavra) {
      var p = document.createElement('span'); p.className = 'p';
      Array.prototype.forEach.call(palavra, function (c) {
        var s = document.createElement('span'); s.className = 'ch'; s.textContent = c;
        s.style.setProperty('--d', (li * .22 + n * .04).toFixed(2) + 's'); n++;
        p.appendChild(s);
      });
      linha.appendChild(p);
    });
  });

  /* ---- cursor: luz que segue e posição normalizada ---- */
  var mx = 0, my = 0, mxS = 0, myS = 0;
  window.addEventListener('pointermove', function (e) {
    raiz.style.setProperty('--mx', e.clientX + 'px');
    raiz.style.setProperty('--my', e.clientY + 'px');
    mx = e.clientX / window.innerWidth - .5;
    my = e.clientY / window.innerHeight - .5;
  }, { passive: true });

  /* ---- cabeçalho de vidro ---- */
  var topo = $('#topo');
  function aoRolar() { topo.classList.toggle('rolou', window.scrollY > 40); }
  window.addEventListener('scroll', aoRolar, { passive: true }); aoRolar();

  /* ---- dados dos climas: uma fonte só (os cards) ---- */
  var cards = $$('.card');
  var climas = cards.map(function (c) {
    return {
      nome: c.getAttribute('data-nome'),
      cor: c.getAttribute('data-cor'),
      bpm: +c.getAttribute('data-bpm'),
      sub: $('.card-sub', c).textContent,
      img: ['manha', 'foco', 'treino', 'estrada', 'pista', 'madrugada'][cards.indexOf(c)]
    };
  });

  /* ---- órbita ---- */
  var anel = $('#anel'), orbita = $('#orbita');
  var capas = $$('.capa', anel);
  var base = 0, vBase = 7;            // graus e graus/segundo
  var pausaAte = 0, alvoManual = null;
  var rot = 0, tx = -10, tz = 0;
  var frente = -1, arrasto = null;

  function mod(a, n) { return ((a % n) + n) % n; }
  function nomeCapa(i) { return climas[i] ? climas[i].nome : ''; }

  // clique numa capa leva ela para a frente
  capas.forEach(function (c) {
    c.addEventListener('click', function () {
      if (arrasto && arrasto.moveu) return;
      var i = +c.getAttribute('data-i');
      var alvo = -i * 60;
      var atual = base;
      var k = Math.round((atual - alvo) / 360);
      alvoManual = alvo + k * 360;
      pausaAte = performance.now() + 5000;
    });
  });

  // arrastar para girar
  var ini = 0;
  orbita.addEventListener('pointerdown', function (e) {
    arrasto = { x: e.clientX, base: base, moveu: false };
    ini = e.clientX;
  });
  window.addEventListener('pointermove', function (e) {
    if (!arrasto) return;
    var dx = e.clientX - arrasto.x;
    if (Math.abs(dx) > 5) arrasto.moveu = true;
    if (arrasto.moveu) { base = arrasto.base + dx * .35; alvoManual = null; pausaAte = performance.now() + 4000; }
  });
  window.addEventListener('pointerup', function () { setTimeout(function () { arrasto = null; }, 0); });

  /* ---- player ---- */
  var pl = $('#player'), plCapa = $('#playerCapa'), plNome = $('#playerNome'), plSub = $('#playerSub');
  var plBarra = $('#playerBarra'), plTempo = $('#playerTempo');
  var btnPlay = $('#btnPlay'), btnPlayTxt = $('#btnPlayTxt');
  var tocado = 0;                    // segundos tocados

  function atualizaPlayer(i) {
    var c = climas[i]; if (!c) return;
    plNome.textContent = c.nome; plSub.textContent = c.sub;
    plCapa.src = 'assets/capas/' + c.img + '.svg';
    capas.forEach(function (el, k) { el.style.setProperty('--br', k === i ? 1 : .72); });
  }
  function sincronizaBotao() {
    var on = window.Som && Som.ligado();
    btnPlay.setAttribute('aria-pressed', on ? 'true' : 'false');
    btnPlayTxt.textContent = on ? 'Pausar' : 'Apertar play';
    pl.classList.toggle('tocando', !!on);
  }
  if (btnPlay) {
    if (!window.Som || !Som.suportado) btnPlay.hidden = true;
    btnPlay.addEventListener('click', function () {
      if (window.AlternarSom) window.AlternarSom();
      sincronizaBotao();
    });
  }
  // o botão "Som" do cabeçalho também precisa refletir aqui
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#btnSom')) setTimeout(sincronizaBotao, 30); });
  document.addEventListener('keydown', function (e) { if (e.key === 'm' || e.key === 'M') setTimeout(sincronizaBotao, 30); });
  document.addEventListener('visibilitychange', function () { setTimeout(sincronizaBotao, 60); });

  function fmt(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  /* ---- laço ---- */
  var ult = performance.now();
  function quadro(agora) {
    requestAnimationFrame(quadro);
    var dt = Math.min(.05, (agora - ult) / 1000); ult = agora;
    var sy = window.scrollY, H = window.innerHeight;
    var prog = Math.min(1, sy / H);                  // 0..1 enquanto o hero sai

    // giro automático, ou ida suave até a capa clicada
    if (alvoManual !== null) {
      base += (alvoManual - base) * Math.min(1, dt * 5);
      if (Math.abs(alvoManual - base) < .15) { base = alvoManual; alvoManual = null; }
    } else if (!arrasto && agora > pausaAte) {
      var fator = (fino && orbita.matches(':hover')) ? .25 : 1;
      base -= vBase * dt * fator * (1 + (window.Palco ? window.Palco.energia() : 0) * 1.2);
    }

    // mouse e rolagem entram no giro e na inclinação
    mxS += (mx - mxS) * Math.min(1, dt * 4); myS += (my - myS) * Math.min(1, dt * 4);
    rot = base + mxS * 26 - sy * .12;
    tx = -10 + myS * -14 + prog * 18;
    tz = mxS * -3;
    anel.style.setProperty('--rot', rot.toFixed(2) + 'deg');
    anel.style.setProperty('--tx', tx.toFixed(2) + 'deg');
    anel.style.setProperty('--tz', tz.toFixed(2) + 'deg');

    // o hero "passa por dentro": a órbita cresce e some ao rolar
    var esc = 1 + prog * 1.1;
    orbita.style.transform = 'scale(' + esc.toFixed(3) + ') translateY(' + (-prog * 60).toFixed(1) + 'px)';
    orbita.style.opacity = String(Math.max(0, 1 - prog * 1.35).toFixed(3));

    // capa da frente comanda cor e batida (se a pessoa não escolheu um card)
    var f = mod(Math.round(-(rot - mxS * 26) / 60), 6);
    if (f !== frente) {
      frente = f;
      atualizaPlayer(f);
      if (window.Clima) window.Clima.aplicar(f, { auto: true });
    }

    // tempo tocado no player
    if (window.Som && Som.ligado()) tocado += dt;
    var T = 180;
    if (plBarra) plBarra.style.transform = 'scaleX(' + ((tocado % T) / T).toFixed(4) + ')';
    if (plTempo) plTempo.textContent = fmt(tocado % T);
  }
  if (!reduz) requestAnimationFrame(quadro);
  else { atualizaPlayer(0); }

  /* ---- botões magnéticos ---- */
  if (!reduz && fino) {
    $$('.btn').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * .22, y = (e.clientY - r.top - r.height / 2) * .32;
        b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(1.04)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  /* ---- seções entram com stagger ---- */
  if (!reduz && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    function entra(alvos, gatilho, atraso) {
      if (!alvos.length) return;
      gsap.set(alvos, { opacity: 0, y: 44 });
      ScrollTrigger.create({
        trigger: gatilho, start: 'top 82%', once: true,
        onEnter: function () { gsap.to(alvos, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .09, delay: atraso || 0, clearProps: 'transform' }); }
      });
    }
    $$('.sec').forEach(function (sec) {
      entra($$('.rotulo, .t-sec, .t-fim, .sec-sub', sec), sec);
    });
    entra($$('#cards .card'), '#cards');
    entra($$('.rec'), '.recursos');
    entra($$('.faq details'), '.faq');
    entra($$('.cta-linha .btn'), '.cta-linha');
  }
})();
