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
  async leggi(pin) {
    const r = await fetch(API_URL + '?a=stato&pin=' + encodeURIComponent(pin) + '&t=' + Date.now());
    return r.json();
  },
  async scrivi(dati) {
    // text/plain: nessun controllo preliminare del browser, la risposta è leggibile
    const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify(dati) });
    return r.json();
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
      return { p, t, giri, somma, rit: t.includes('RIT') };
    });
    righe.sort((a, b) => (a.rit - b.rit) || (b.giri - a.giri) || (a.somma - b.somma) || (a.p.ordine - b.p.ordine));
    // posizione e distacco calcolati tra chi ha fatto lo stesso numero di giri
    righe.forEach((r, i) => {
      if (r.giri === 0 || r.rit) { r.pos = null; r.distacco = null; return; }
      const gruppo = righe.filter(x => x.giri === r.giri && !x.rit);
      r.pos = 1 + gruppo.filter(x => x.somma < r.somma).length;
      r.punti = r.giri === 3 ? (PUNTI[r.pos - 1] || 0) : null;
      r.distacco = r.pos > 1 ? r.somma - gruppo[0].somma : null;
    });
    return righe;
  },

  // classifica di un singolo giro (1-3)
  classificaGiro(stato, g) {
    return stato.piloti.filter(p => p.presente)
      .map(p => ({ p, v: (stato.tempi[p.num] || [])[g - 1] }))
      .filter(x => R.ok(x.v)).sort((a, b) => a.v - b.v);
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
  coppie(stato) {
    const ord = R.classifica(stato).map(r => r.p);
    const out = [], n = ord.length;
    for (let i = 0; i < Math.floor(n / 2); i++) out.push([ord[i], ord[n - 1 - i]]);
    if (n % 2) out.push([ord[Math.floor(n / 2)], null]);
    return out;
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
