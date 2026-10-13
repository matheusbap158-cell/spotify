/* Página: carregamento, revelação, contadores, cards, som e vídeos opcionais. */
(function () {
  'use strict';

  var reduz = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var tem = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (tem) gsap.registerPlugin(ScrollTrigger);

  /* ---- carregamento (real: fontes + página) ---- */
  var loader = $('#loader'), pct = $('#loaderPct');
  var feitos = 0, total = 2;
  function passo() {
    feitos++;
    if (pct) pct.textContent = String(Math.round(feitos / total * 100));
    if (feitos >= total) liberar();
  }
  function liberar() {
    setTimeout(function () {
      document.body.classList.remove('carregando');
      if (loader) loader.classList.add('fim');
      if (window.Palco) Palco.recalcular();
      if (tem) ScrollTrigger.refresh();
    }, 250);
  }
  var fontes = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  Promise.race([fontes, new Promise(function (r) { setTimeout(r, 4000); })]).then(passo);
  if (document.readyState === 'complete') passo(); else window.addEventListener('load', passo, { once: true });

  /* ---- barra de progresso e cabeçalho ---- */
  var barra = $('#barra');
  function progresso() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? window.scrollY / h : 0;
    if (barra) barra.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }
  window.addEventListener('scroll', progresso, { passive: true });
  progresso();

  /* ---- revelação do texto de cada capítulo ---- */
  if (tem && !reduz) {
    $$('.cap-trilho').forEach(function (trilho) {
      var itens = $$('[data-rev]', trilho);
      var baixo = $$('.medidor, .bpm, .faixa-lista, .wrapped, .nota', trilho);
      var tl = gsap.timeline({
        scrollTrigger: { trigger: trilho, start: 'top 55%', end: 'top 5%', scrub: .6 }
      });
      tl.to(itens, { opacity: 1, y: 0, filter: 'blur(0px)', stagger: .22, ease: 'none' });
      if (baixo.length) { gsap.set(baixo, { opacity: 0, y: 20 }); tl.to(baixo, { opacity: 1, y: 0, stagger: .1, ease: 'none' }, '-=.25'); }
      // saída: tudo sai no fim do trilho, sem corte seco
      gsap.to($('.cap-pin', trilho), {
        opacity: 0, y: -40, ease: 'none',
        scrollTrigger: { trigger: trilho, start: 'bottom 85%', end: 'bottom 35%', scrub: .6 }
      });
    });
    // abertura sai ao rolar
    gsap.to('.cap-0 .cap-cena', {
      opacity: 0, y: -50, ease: 'none',
      scrollTrigger: { trigger: '#cap-0', start: 'top top', end: 'bottom 30%', scrub: .6 }
    });
  } else {
    $$('[data-rev]').forEach(function (e) { e.style.opacity = 1; e.style.transform = 'none'; e.style.filter = 'none'; });
  }

  /* ---- contadores do Wrapped ---- */
  function formata(n) { return n.toLocaleString('pt-BR'); }
  $$('[data-conta]').forEach(function (el) {
    var alvo = +el.getAttribute('data-conta');
    if (reduz || !tem) { el.textContent = formata(alvo); return; }
    var o = { v: 0 };
    ScrollTrigger.create({
      trigger: '#cap-5', start: 'top 40%', once: true,
      onEnter: function () {
        gsap.to(o, { v: alvo, duration: 2.2, ease: 'power2.out', onUpdate: function () { el.textContent = formata(Math.round(o.v)); } });
      }
    });
  });

  /* ---- som ---- */
  var btn = $('#btnSom');
  function atualizaSom() {
    var on = window.Som && Som.ligado();
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = on ? 'Desligar o som (M)' : 'Ligar o som (M)';
    $('.btn-som-txt', btn).textContent = on ? 'Som ligado' : 'Som';
  }
  function alternarSom() {
    if (!window.Som || !Som.suportado) return;
    Som.alternar(); atualizaSom();
  }
  window.AlternarSom = function () { alternarSom(); };
  if (btn) {
    if (!window.Som || !Som.suportado) btn.hidden = true;
    btn.addEventListener('click', alternarSom);
  }
  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === 'm' || e.key === 'M') { alternarSom(); }
  });
  // som desliga ao sair da aba (não fica tocando escondido)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && window.Som && Som.ligado()) { Som.desligar(); atualizaSom(); }
  });

  /* ---- cards: cor e batida ---- */
  var cards = $$('.card'), dica = $('#cardsDica');
  var TONS = [0, 2, -2, 3, 5, -4];
  // aplica um clima (cor, batida, tom). auto = veio do giro da órbita, não de um clique.
  window.Clima = {
    aplicar: function (i, op) {
      var c = cards[i]; if (!c) return;
      var cor = c.getAttribute('data-cor');
      if (window.Palco) Palco.cor(cor);
      if (window.Som) { Som.bpm(+c.getAttribute('data-bpm')); Som.tom(TONS[i] || 0); }
      if (op && op.auto) return;
      cards.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); o.style.removeProperty('--cor'); });
      c.setAttribute('aria-pressed', 'true');
      c.style.setProperty('--cor', cor);
      if (dica) dica.textContent = c.getAttribute('data-nome') + ' · ' + c.getAttribute('data-bpm') + ' BPM' +
        (window.Som && Som.ligado() ? '' : ' (ligue o Som para ouvir a mudança)');
    }
  };
  cards.forEach(function (c, i) {
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', function () { window.Clima.aplicar(i); });
    // inclinação 3D leve
    if (!reduz && window.matchMedia('(hover:hover)').matches) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        c.style.transform = 'translateY(-6px) perspective(700px) rotateY(' + (x * 8).toFixed(2) + 'deg) rotateX(' + (-y * 8).toFixed(2) + 'deg)';
      });
      c.addEventListener('pointerleave', function () { c.style.transform = ''; });
    }
  });

  /* ---- botão "ouvir de novo" ---- */
  var topo = $('#btnTopo');
  if (topo) topo.addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduz ? 'auto' : 'smooth' });
  });
  // rolagem suave para âncoras do menu
  $$('.nav a, .marca').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var alvo = id && id.charAt(0) === '#' ? $(id) : null;
      if (!alvo) return;
      e.preventDefault();
      var y = alvo.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: y, behavior: reduz ? 'auto' : 'smooth' });
    });
  });

  /* ---- vídeos opcionais do Flow ----
     Se assets/video/batida.mp4 (ou show.mp4) existir, ele é guiado pela rolagem
     dentro do capítulo, por trás do desenho. Sem o arquivo, nada muda. */
  function existe(url) {
    return fetch(url, { method: 'HEAD' }).then(function (r) { return r.ok; }, function () { return false; });
  }
  if (window.CenaVideo && location.protocol.indexOf('http') === 0) {
    $$('.cap[data-video-desktop]').forEach(function (cap) {
      var d = cap.getAttribute('data-video-desktop'), m = cap.getAttribute('data-video-mobile') || d;
      existe(d).then(function (ok) {
        if (!ok) return;
        var video = $('.cena-video', cap), pin = $('.cap-pin', cap), trilho = $('.cap-trilho', cap);
        pin.insertBefore(video, pin.firstChild);
        var cena = window.CenaVideo({ secao: cap, video: video, desktop: d, mobile: m });
        cap.classList.add('cap-video-on');
        if (tem) {
          ScrollTrigger.create({
            trigger: trilho, start: 'top bottom', end: 'bottom top', scrub: true,
            onUpdate: function (s) {
              cena.definir(s.progress);
              var o = Math.sin(Math.PI * s.progress);
              video.style.opacity = String(Math.min(.55, o * .9));
            }
          });
        }
        if (reduz) cena.reproduzivel();
      });
    });
  }
})();
