// TROFEO RONCO 2026 – funzioni comuni a crono, tabellone e regia

// Indirizzo /exec dello script Google (Esegui il deployment → App web)
const API_URL = 'https://script.google.com/macros/s/AKfycbxVePime0EgENife7HpowruQGQuEUyidsihXycoSyBgNpRV0N_ljDPZdOOIu4Z7Z5ZTlQ/exec';

const PUNTI = [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

// ---------- PIN: si scrive una volta e resta sul dispositivo
const R = {
  pinKey: page => 'ronco26_pin_' + page,
  getPin(page) { try { return localStorage.getItem(R.pinKey(page)) || ''; } catch (e) { return ''; } },
  setPin(page, v) { try { v ? localStorage.setItem(R.pinKey(page), v) : localStorage.removeItem(R.pinKey(page)); } catch (e) {} },

  // ---------- chiamate allo script
  // fetch con tempo massimo: se lo script non risponde, si rinuncia e si riprova dopo
  async _fetch(url, opz, ms) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, Object.assign({ signal: ctl.signal }, opz)); return await r.json(); }
    finally { clearTimeout(t); }
  },
  _inLettura: false,
  // una sola lettura alla volta: se la precedente non è finita, questa si salta
  async leggi(pin) {
    if (R._inLettura) throw new Error('occupato');
    R._inLettura = true;
    try { return await R._fetch(API_URL + '?a=stato&pin=' + encodeURIComponent(pin) + '&t=' + Date.now(), {}, 20000); }
    finally { R._inLettura = false; }
  },
  async scrivi(dati) {
    // text/plain: nessun controllo preliminare del browser, la risposta è leggibile
    return R._fetch(API_URL, { method: 'POST', body: JSON.stringify(dati) }, 30000);
  },

  // ---------- tempi
  // "32515" → 205.15 secondi (3:25,15)
  daCifre(d) {
    if (!d) return null;
    const s = d.padStart(5, '0');
    const cs = +s.slice(-2), sec = +s.slice(-4, -2), min = +s.slice(0, -4);
    if (sec > 59) return { errore: true };
    return { val: Math.round((min * 60 + sec + cs / 100) * 100) / 100 };
  },
  cifreDisplay(d) {
    const s = (d || '').padStart(5, '0');
    return (+s.slice(0, -4)) + ':' + s.slice(-4, -2) + ',' + s.slice(-2);
  },
  fmt(v) {
    if (v === 'RIT') return 'Rit.';
    if (typeof v !== 'number') return '–';
    const m = Math.floor(v / 60), s = v - m * 60;
    return m + ':' + s.toFixed(2).padStart(5, '0').replace('.', ',');
  },
  gap(v) { // distacco: +4,32 oppure +1:02,10
    if (v < 60) return '+' + v.toFixed(2).replace('.', ',');
    return '+' + R.fmt(v);
  },
  ok: v => typeof v === 'number' && v > 0,

  // ---------- classifica
  // Prima chi ha più giri, poi il tempo sommato. Punti solo con 3 giri.
  classifica(stato) {
    const righe = stato.piloti.filter(p => p.presente).map(p => {
      const t = stato.tempi[p.num] || [null, null, null];
      const giri = t.filter(R.ok).length;
      const somma = t.filter(R.ok).reduce((a, b) => a + b, 0);
      const ok = t.filter(R.ok);
      return { p, t, giri, somma: Math.round(somma * 100) / 100, rit: t.includes('RIT'),
               best: ok.length ? Math.min(...ok) : Infinity, ultimo: R.ok(t[2]) ? t[2] : Infinity };
    });
    // a parità di tempo: miglior giro singolo, poi giro 3 (regola B)
    const meglio = (a, b) => (a.somma - b.somma) || (a.best - b.best) || (a.ultimo - b.ultimo);
    righe.sort((a, b) => (a.rit - b.rit) || (b.giri - a.giri) || meglio(a, b) || (a.p.ordine - b.p.ordine));
    // posizione e distacco calcolati tra chi ha fatto lo stesso numero di giri
    righe.forEach((r, i) => {
      if (r.giri === 0 || r.rit) { r.pos = null; r.distacco = null; return; }
      const gruppo = righe.filter(x => x.giri === r.giri && !x.rit);
      r.pos = 1 + gruppo.filter(x => meglio(x, r) < 0).length;
      r.punti = r.giri === 3 ? (PUNTI[r.pos - 1] || 0) : null;
      r.distacco = r.pos > 1 ? r.somma - gruppo[0].somma : null;
    });
    return righe;
  },

  // classifica di un singolo giro (1-3)
  classificaGiro(stato, g) {
    return stato.piloti.filter(p => p.presente)
      .map(p => ({ p, v: (stato.tempi[p.num] || [])[g - 1] }))
      .filter(x => R.ok(x.v))
      .map(x => { const t = stato.tempi[x.p.num] || []; x.cum = t.slice(0, g).filter(R.ok).reduce((a, b) => a + b, 0); return x; })
      .sort((a, b) => (a.v - b.v) || (a.cum - b.cum));   // a pari tempo del giro, davanti chi ha il totale migliore
  },

  // ritirato in un giro precedente: non va più cronometrato
  fuori(stato, num, g) { return (stato.tempi[num] || []).slice(0, g - 1).includes('RIT'); },

  // giro in corso: il primo giro non ancora completo per tutti i presenti
  giroInCorso(stato) {
    const pres = stato.piloti.filter(p => p.presente);
    for (let g = 1; g <= 3; g++) {
      if (pres.some(p => !R.fuori(stato, p.num, g) && (stato.tempi[p.num] || [])[g - 1] == null)) return g;
    }
    return 4; // finito
  },

  // ---------- coppie cross: 1° con ultimo, 2° con penultimo… dispari = Marathon
  // gruppi di partenza: "4" = tutti da 4; "4-4-5-5" = esatti. Restituisce le dimensioni dei gruppi.
  gruppi(schema, n) {
    const parti = String(schema || '4').split(/[^0-9]+/).map(Number).filter(x => x > 0), out = [];
    let resto = n, i = 0;
    while (resto > 0) { const g = parti.length > 1 ? (parti[i] || parti[parti.length - 1]) : (parti[0] || 4); out.push(Math.min(g, resto)); resto -= g; i++; }
    return out;
  },
  // per la posizione k (1 = primo a partire): { g: n° gruppo, i: posto nel gruppo, n: piloti nel gruppo }
  gruppoDi(schema, n, k) {
    let start = 1, g = 0;
    for (const dim of R.gruppi(schema, n)) { g++; if (k < start + dim) return { g, i: k - start + 1, n: dim }; start += dim; }
    return null;
  },

  // fuori = N° di chi non corre il cross: esclusi solo dalle coppie, la classifica enduro non cambia
  coppie(stato, fuori = []) {
    const ord = R.classifica(stato).map(r => r.p).filter(p => !fuori.includes(p.num));
    const out = [], n = ord.length;
    for (let i = 0; i < Math.floor(n / 2); i++) out.push([ord[i], ord[n - 1 - i]]);
    if (n % 2) out.push([ord[Math.floor(n / 2)], null]);
    return out;
  },

  // vincitore del cross: a punti (tradizione) oppure chi vince la finale, come scelto in regia
  vincitoreCross(stato) {
    const fin = ((stato.arrivi || {}).F || []).filter(a => !a.rit && a.sq !== 'SI' && (stato.qualificati || []).includes(a.c));
    const aPunti = (stato.cross || [])[0] ? stato.cross[0].n : null, finale = fin[0] ? fin[0].c : null;
    return { premiata: stato.premioCross === 'finale' ? (finale || aPunti) : aPunti, aPunti, finale, regola: stato.premioCross || 'punti' };
  },
  nomeCoppia(stato, n) {
    const c = (stato.coppie || []).find(x => x.n === n), nm = k => (stato.piloti.find(p => p.num === k) || {}).nome || k;
    return c ? nm(c.a) + (c.b ? ' – ' + nm(c.b) : ' (Marathon)') : '?';
  },

  esc: s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),

  toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(R._tt); R._tt = setTimeout(() => t.classList.remove('show'), 2000);
  },

  // ---------- schermata PIN
  chiediPin(page, titolo, onOk) {
    const box = document.createElement('div');
    box.className = 'pinbox';
    box.innerHTML = `<div class="pincard"><h2>${titolo}</h2><p>Inserisci il PIN</p>
      <input id="pinin" type="password" inputmode="numeric" autocomplete="off">
      <button id="pinok">Entra</button><p id="pinerr" class="err"></p></div>`;
    document.body.appendChild(box);
    const inp = box.querySelector('#pinin');
    inp.focus();
    const prova = async () => {
      box.querySelector('#pinerr').textContent = 'Controllo…';
      try {
        const s = await R.leggi(inp.value);
        if (!s.ok) { box.querySelector('#pinerr').textContent = 'PIN errato'; return; }
        if (page === 'regia' && s.ruolo !== 'regia') { box.querySelector('#pinerr').textContent = 'Serve il PIN di regia'; return; }
        if (page === 'crono' && s.ruolo === 'tabellone') { box.querySelector('#pinerr').textContent = 'Questo PIN è solo per il tabellone'; return; }
        R.setPin(page, inp.value); box.remove(); onOk(inp.value, s);
      } catch (e) { box.querySelector('#pinerr').textContent = 'Nessuna connessione, riprova'; }
    };
    box.querySelector('#pinok').onclick = prova;
    inp.onkeydown = e => { if (e.key === 'Enter') prova(); };
  }
};
