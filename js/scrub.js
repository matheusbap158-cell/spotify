/* Cenas de vídeo controladas pela rolagem (capítulos 02, 03 e 05).
   Mesma ideia do capítulo 01 (cena.js), em forma reutilizável:
   - o vídeo nunca toca sozinho; só recebe currentTime
   - uma busca por vez: a posição mais recente vence
   - carregamento preguiçoso: o arquivo só é baixado quando a cena está a ~2 telas de distância
   - enquanto não carrega, o cartaz (primeiro quadro) fica na tela e nada trava */
(function () {
  'use strict';

  var pequeno = window.matchMedia('(max-width:820px), (pointer:coarse) and (max-width:1100px)').matches;
  var PASSO = 1 / 48;
  var FOLGA = 0.04;

  /* cfg: { secao, video, desktop, mobile, aoPronto() } */
  window.CenaVideo = function (cfg) {
    var v = cfg.video;
    var anexado = false, pronto = false, falhou = false, duracao = 0;
    var quer = 0, ultimo = -1, ocupado = false, prog = 0;
    var aviso = cfg.secao.querySelector('.cena-carga');

    function marca(estado) {
      cfg.secao.setAttribute('data-video', estado);
      if (aviso) {
        aviso.classList.toggle('on', estado === 'carregando');
        // só existe texto enquanto há o que dizer (leitores de tela não devem ouvir "carregando" depois de pronto)
        aviso.textContent = estado === 'carregando' ? 'Carregando a cena…' : '';
      }
    }

    function bombear() {
      if (!pronto) return;
      if (Math.abs(quer - ultimo) < PASSO) { ocupado = false; return; }
      ocupado = true;
      ultimo = quer;
      if (typeof v.fastSeek === 'function' && !v.seeking) {
        try { v.fastSeek(quer); return; } catch (e) { /* cai no currentTime */ }
      }
      v.currentTime = quer;
    }
    function limite() {
      if (!duracao || !v.buffered.length) return 0;
      return Math.min(duracao, v.buffered.end(v.buffered.length - 1));
    }
    function aplicar() {
      var alvo = Math.max(0, Math.min(1, prog)) * Math.max(0, duracao - FOLGA);
      var lim = limite();
      // enquanto o restante chega, a busca não passa do que já está em buffer
      quer = (duracao && lim < duracao - 0.15 && lim > 0) ? Math.min(alvo, Math.max(0, lim - 0.12)) : alvo;
      if (!ocupado) bombear();
    }
    function checa() {
      if (pronto || falhou || !duracao) return;
      var f = limite() / duracao, pct = Math.round(f * 100);
      if (aviso) aviso.textContent = 'Carregando a cena… ' + pct + '%';
      if (f >= 0.985 || (v.readyState >= 3 && f >= 0.35)) aoTerTudo();
    }
    v.addEventListener('seeked', function () {
      ocupado = false;
      if (Math.abs(quer - ultimo) >= PASSO) bombear();
    });
    v.addEventListener('play', function () { if (!v.controls) v.pause(); });

    function aoTerTudo() {
      if (pronto || falhou) return;
      pronto = true;
      marca('pronto');
      // celular: um play/pause mudo libera a busca em navegadores que a restringem
      if (window.matchMedia('(pointer:coarse)').matches) {
        var p = v.play();
        var volta = function () { v.pause(); ultimo = -1; aplicar(); };
        if (p && p.then) p.then(volta, function () {});
      }
      ultimo = -1;
      aplicar();
      if (cfg.aoPronto) cfg.aoPronto();
      // continua acompanhando o restante do buffer para liberar toda a extensão do vídeo
      var resto = setInterval(function () { if (!duracao || limite() >= duracao - 0.15) { clearInterval(resto); aplicar(); } else aplicar(); }, 400);
    }
    function aoFalhar() {
      if (pronto || falhou) return;
      falhou = true;
      marca('erro');
    }

    function anexar() {
      if (anexado) return;
      anexado = true;
      marca('carregando');
      var lista = pequeno ? [cfg.mobile, cfg.desktop] : [cfg.desktop];
      lista.forEach(function (u) {
        var s = document.createElement('source');
        s.src = u; s.type = 'video/mp4';
        v.appendChild(s);
      });
      var fontes = v.querySelectorAll('source');
      fontes[fontes.length - 1].addEventListener('error', aoFalhar);
      v.addEventListener('error', aoFalhar);
      v.addEventListener('loadedmetadata', function () {
        if (isFinite(v.duration) && v.duration > 0) duracao = v.duration;
      });
      ['loadeddata', 'progress', 'canplay', 'canplaythrough', 'suspend'].forEach(function (ev) { v.addEventListener(ev, checa); });
      // o evento "progress" é esparso: esta leitura só confere o buffer real (e para ao ficar pronto)
      var sonda = setInterval(function () { if (pronto || falhou) clearInterval(sonda); else checa(); }, 250);
      // nem os metadados chegaram: falha de verdade
      setTimeout(function () { if (!pronto && v.readyState < 1) aoFalhar(); }, 40000);
      v.preload = 'auto';
      v.load();
      // celulares só carregam depois de um play mudo: pede já, sem som e sem aparecer
      if (window.matchMedia('(pointer:coarse)').matches) {
        v.addEventListener('loadedmetadata', function () {
          var p = v.play();
          if (p && p.then) p.then(function () { if (!v.controls) v.pause(); }, function () {});
        }, { once: true });
      }
    }

    // baixa só quando a cena está perto
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { anexar(); io.disconnect(); } });
      }, { rootMargin: '250% 0px 250% 0px' });
      io.observe(cfg.secao);
    } else {
      anexar();
    }

    return {
      definir: function (p) { prog = p; if (pronto) aplicar(); },
      anexar: anexar,
      // modo sem rolagem controlada: deixa a pessoa assistir normalmente
      reproduzivel: function () {
        anexar();
        v.controls = true;
        v.removeAttribute('aria-hidden');
        v.muted = true;
      }
    };
  };
})();
