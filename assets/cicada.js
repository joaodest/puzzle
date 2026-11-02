// Atmosfera compartilhada do puzzle: grão, falhas de sinal, decifragem, runas e som.
(() => {
  const raiz = document.documentElement;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RUNAS = 'ᚠᚢᚦᚩᚱᚳᚷᚹᚻᚾᛁᛄᛇᛈᛉᛋᛏᛒᛖᛗᛚᛝᛟᛞᚪᚫᚣᛡᛠ';
  // Só glifos da fonte mono, para a largura não pular durante a decifragem
  const GLIFOS = '$#%@&*!?<>/\\=+ABCDEFGHJKLMNPRSTVXZ0123456789';
  const SIGILO = '$##%@#';
  const sorteia = (s) => s[Math.floor(Math.random() * s.length)];
  const entre = (a, b) => a + Math.random() * (b - a);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const tela = document.querySelector('.tela');

  const camada = (classe) => {
    const el = document.createElement('div');
    el.className = classe;
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    return el;
  };

  // Grão: poucos ladrilhos de ruído pré-gerados trocados em loop, em vez de redesenhar a tela inteira
  const ladrilhos = Array.from({ length: 6 }, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.random() * 255;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return `url(${c.toDataURL()})`;
  });
  const grao = camada('fx-grao');
  grao.style.backgroundImage = ladrilhos[0];
  camada('fx-varredura');
  const rasgos = camada('fx-rasgos');
  if (!reduz) {
    let i = 0;
    setInterval(() => { grao.style.backgroundImage = ladrilhos[(i = (i + 1) % ladrilhos.length)]; }, 90);
  }

  // ---------- Som (só depois do primeiro gesto, como o navegador exige) ----------
  let audio;
  const acorda = () => {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  };
  addEventListener('pointerdown', acorda);
  addEventListener('keydown', acorda);

  function sfx(tipo) {
    if (!audio || audio.state !== 'running') return;
    const t = audio.currentTime;
    const tom = (freq, forma, ini, dur, vol) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = forma;
      o.frequency.setValueAtTime(freq, t + ini);
      g.gain.setValueAtTime(vol, t + ini);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ini + dur);
      o.connect(g).connect(audio.destination);
      o.start(t + ini);
      o.stop(t + ini + dur);
    };
    if (tipo === 'erro') {
      const dur = 0.5;
      const buf = audio.createBuffer(1, audio.sampleRate * dur, audio.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.25 ? 0.9 : 0.15) * (1 - i / d.length);
      }
      const ruido = audio.createBufferSource();
      const g = audio.createGain();
      ruido.buffer = buf;
      g.gain.value = 0.12;
      ruido.connect(g).connect(audio.destination);
      ruido.start(t);
      tom(55, 'square', 0, dur, 0.08);
      tom(58, 'sawtooth', 0, dur, 0.05);
    } else if (tipo === 'ok') {
      tom(523.25, 'sine', 0, 0.18, 0.08);
      tom(783.99, 'sine', 0.12, 0.4, 0.07);
    } else {
      tom(entre(1600, 2000), 'square', 0, 0.025, 0.015);
    }
  }

  // ---------- Falhas de sinal ----------
  document.querySelectorAll('.glitch').forEach((g) => { g.dataset.text ??= g.textContent.trim(); });

  const pulsa = (el, classe, ms) => {
    el.classList.remove(classe);
    void el.offsetWidth;
    el.classList.add(classe);
    setTimeout(() => el.classList.remove(classe), ms);
  };

  function surto(forca = 1) {
    if (reduz) return;
    tela?.animate([
      { translate: '0 0', filter: 'none' },
      { translate: `${entre(-14, 14) * forca}px 0`, filter: 'drop-shadow(3px 0 rgba(255,30,50,.85)) drop-shadow(-3px 0 rgba(30,120,255,.85))' },
      { translate: `${entre(-6, 6)}px ${entre(-2, 2)}px`, filter: 'contrast(1.8) brightness(1.3)' },
      { translate: '0 0', filter: 'none' },
    ], { duration: 240 + 80 * forca, easing: 'steps(3, end)' });
    document.querySelector('.mariposa')?.animate(
      [{ opacity: 0.07 }, { opacity: 0.4, translate: `${entre(-12, 12)}px 0` }, { opacity: 0.07 }],
      { duration: 220, easing: 'steps(2, end)' },
    );
    const n = 2 + Math.floor(Math.random() * 3 * forca);
    for (let i = 0; i < n; i++) {
      const barra = document.createElement('div');
      barra.className = 'fx-barra';
      barra.style.cssText = `top:${entre(0, 100)}%;height:${entre(1, 10 * forca)}px;translate:${entre(-30, 30)}px 0`;
      rasgos.append(barra);
      setTimeout(() => barra.remove(), entre(70, 260));
    }
    document.querySelectorAll('.glitch').forEach((g) => pulsa(g, 'is-glitching', 380));
  }

  // Troca alguns caracteres de textos visíveis pelo sigilo e devolve o original logo depois
  function corrompe(qtd = 2) {
    if (reduz || !tela) return;
    const nos = [];
    const andarilho = document.createTreeWalker(tela, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.trim().length > 6 && !n.parentElement.closest('[data-decrypt], .censura, .sigilo')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT),
    });
    while (andarilho.nextNode()) nos.push(andarilho.currentNode);
    for (let k = 0; k < qtd && nos.length; k++) {
      const no = nos.splice(Math.floor(Math.random() * nos.length), 1)[0];
      const original = no.nodeValue;
      const chars = [...original];
      for (let j = 0; j < 1 + Math.random() * 3; j++) {
        const p = Math.floor(Math.random() * chars.length);
        if (chars[p].trim()) chars[p] = sorteia(SIGILO);
      }
      no.nodeValue = chars.join('');
      setTimeout(() => { no.nodeValue = original; }, entre(90, 220));
    }
  }

  (function agenda() {
    if (reduz) return;
    const tensao = raiz.classList.contains('contencao');
    setTimeout(() => {
      surto(tensao ? 2 : 1);
      corrompe(tensao ? 6 : 2);
      agenda();
    }, tensao ? entre(450, 1500) : entre(2600, 7500));
  })();

  // A censura reage ao cursor, mas nunca revela o que esconde
  document.querySelectorAll('.censura').forEach((c) => {
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', 'trecho censurado');
    const original = c.textContent;
    c.addEventListener('pointerenter', () => {
      if (reduz) return;
      c.textContent = original.replace(/\S/g, () => sorteia(GLIFOS));
      setTimeout(() => { c.textContent = original; }, 160);
    });
  });

  // ---------- Decifragem ----------
  // O leitor de tela recebe o texto final numa cópia invisível; a versão animada fica oculta para ele
  function prepara(el) {
    if (el.dataset.texto !== undefined) return;
    el.dataset.texto = el.textContent;
    const leitura = document.createElement('span');
    leitura.className = 'sr-only';
    leitura.textContent = el.textContent;
    el.setAttribute('aria-hidden', 'true');
    el.before(leitura);
  }
  document.querySelectorAll('[data-decrypt]').forEach(prepara);

  function decifra(el, ms = 700) {
    prepara(el);
    const final = el.dataset.texto;
    if (reduz) {
      el.textContent = final;
      return Promise.resolve();
    }
    return new Promise((fim) => {
      const inicio = performance.now();
      let ultimo = 0;
      const quadro = (agora) => {
        const p = Math.min(1, (agora - inicio) / ms);
        if (agora - ultimo > 40 || p === 1) {
          ultimo = agora;
          const corte = Math.floor(final.length * p);
          el.textContent = final.slice(0, corte) + final.slice(corte).replace(/\S/g, () => sorteia(GLIFOS));
        }
        if (p < 1) requestAnimationFrame(quadro);
        else fim();
      };
      requestAnimationFrame(quadro);
    });
  }

  // Revela linhas em sequência; qualquer clique ou tecla pula direto para o fim
  async function revela(linhas, passo = 110) {
    let pula = reduz;
    const pular = () => { pula = true; };
    addEventListener('pointerdown', pular);
    addEventListener('keydown', pular);
    let anterior;
    for (const ln of linhas) {
      anterior?.classList.remove('cursor');
      ln.classList.add('on', 'cursor');
      anterior = ln;
      if (pula) continue;
      const alvos = ln.hasAttribute('data-decrypt') ? [ln] : ln.querySelectorAll('[data-decrypt]');
      alvos.forEach((a) => decifra(a, Math.min(900, 200 + 25 * a.dataset.texto.length)));
      sfx('tique');
      await espera(passo + Number(ln.dataset.pausa ?? 0));
    }
    removeEventListener('pointerdown', pular);
    removeEventListener('keydown', pular);
  }

  // ---------- Runas nas margens ----------
  document.querySelectorAll('.runas').forEach((trilho) => {
    trilho.setAttribute('aria-hidden', 'true');
    trilho.textContent = Array.from({ length: 48 }, () => sorteia(RUNAS)).join('');
    if (reduz) return;
    setInterval(() => {
      const c = [...trilho.textContent];
      for (let k = 0; k < 3; k++) c[Math.floor(Math.random() * c.length)] = sorteia(RUNAS);
      trilho.textContent = c.join('');
    }, 180);
  });

  const titulo = document.title;
  if (!reduz) {
    (function pisca() {
      setTimeout(() => {
        document.title = titulo.replace(/./g, () => sorteia(RUNAS + SIGILO));
        setTimeout(() => { document.title = titulo; pisca(); }, 260);
      }, entre(3500, 9000));
    })();
  }

  // ---------- Navegação: o tubo desliga antes de trocar de página ----------
  function sai(url) {
    if (reduz || !tela) {
      location.href = url;
      return;
    }
    sfx('tique');
    tela.animate([
      { transform: 'none', filter: 'none', opacity: 1 },
      { transform: 'scale(1, .004)', filter: 'brightness(5)', opacity: 1, offset: 0.55 },
      { transform: 'scale(0, .004)', filter: 'brightness(5)', opacity: 0 },
    ], { duration: 460, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' }).finished.then(() => { location.href = url; });
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-transicao]');
    if (!link || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    sai(link.href);
  });
  // Ao voltar pelo histórico, a página não pode ficar presa na animação de desligar
  addEventListener('pageshow', (e) => { if (e.persisted) tela?.getAnimations().forEach((a) => a.cancel()); });

  function contencao() {
    sfx('erro');
    surto(3);
    if (raiz.classList.contains('contencao')) return;
    raiz.classList.add('contencao');
    const aviso = camada('aviso-contencao');
    aviso.removeAttribute('aria-hidden');
    aviso.setAttribute('role', 'alert');
    aviso.innerHTML = '<span class="glitch" data-text="Protocolo de contenção ativo">Protocolo de contenção ativo</span>';
    camada('fx-flash');
  }

  window.fx = { surto, corrompe, decifra, revela, sfx, sai, contencao, espera };
})();
