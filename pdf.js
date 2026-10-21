// TROFEO RONCO 2026 – PDF delle classifiche (enduro, cross, assoluta)
// Costruisce una pagina A4 in HTML e la trasforma in PDF (html2pdf), pronta da condividere su WhatsApp.

const PDF = {
  data: 'Domenica 25 ottobre 2026',
  nome: (stato, num) => { const p = stato.piloti.find(x => x.num === Number(num)); return p ? p.nome : String(num); },
  coppia: (stato, n) => {
    const c = (stato.coppie || []).find(x => x.n === n);
    return c ? PDF.nome(stato, c.a) + (c.b ? ' – ' + PDF.nome(stato, c.b) : ' (Marathon)') : '?';
  },
  esc: s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),

  css: `
    .pdfpag { width: 794px; min-height: 1123px; box-sizing: border-box; padding: 34px 40px 30px; background: #fff; color: #0f172a;
              font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; position: relative; }
    .pdfpag * { box-sizing: border-box; }
    .ph { display: flex; align-items: stretch; gap: 24px; background: linear-gradient(135deg, #5c7286 0%, #475a6c 100%); border-radius: 14px; padding: 16px 22px; color: #fff; }
    .ph img { height: 200px; }
    .ph .tt { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 6px; }
    .ph .t2 { font-family: 'Oswald', 'Arial Narrow', sans-serif; font-weight: 600; font-size: 15px; letter-spacing: 3px; text-transform: uppercase; opacity: .9; }
    .ph .tit { font-family: 'Oswald', 'Arial Narrow', sans-serif; font-weight: 700; font-size: 48px; text-shadow: 0 2px 6px rgba(0,0,0,.25); line-height: 1; text-transform: uppercase; letter-spacing: 1px; margin: 6px 0 10px; }
    .ph .dt { font-size: 13px; opacity: .95; border-top: 1px solid rgba(255,255,255,.5); padding-top: 8px; }
    h3.ps { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 15px; letter-spacing: 2px; text-transform: uppercase; color: #5b7083; margin: 18px 0 6px; }
    table.pt { width: 100%; border-collapse: collapse; font-size: 12.5px; font-variant-numeric: tabular-nums; }
    table.pt th { background: #334155; color: #fff; font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; padding: 6px 6px; text-align: right; }
    table.pt th.l, table.pt td.l { text-align: left; }
    table.pt td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; text-align: right; }
    table.pt tr:nth-child(even) td { background: #f8fafc; }
    table.pt td.pos { text-align: center; font-weight: 800; width: 34px; }
    table.pt td.num { text-align: center; color: #5b7083; font-weight: 700; width: 38px; }
    table.pt td.nm { font-weight: 700; }
    table.pt td.tot { font-weight: 800; }
    table.pt td.pts { font-weight: 800; color: #334155; font-size: 14px; }
    table.pt small.pg { color: #8295a6; font-size: 10.5px; font-weight: 600; margin-left: 3px; }
    table.pt tr.p1 td.pos { color: #fff; background: #ca8a04 !important; }
    table.pt tr.p2 td.pos { color: #fff; background: #94a3b8 !important; }
    table.pt tr.p3 td.pos { color: #fff; background: #b45309 !important; }
    table.pt tr.rit td { color: #94a3b8; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .win { margin: 16px 0 0; padding: 10px 14px; border-radius: 10px; background: #e7edf2; border-left: 6px solid #5c7286; font-size: 15px; color: #1e293b; }
    .pf { position: absolute; left: 40px; right: 40px; bottom: 22px; border-top: 1px solid #e2e8f0; padding-top: 6px;
          display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  `,

  testa(titolo) {
    return `<div class="ph"><img src="logo2026.png" alt="Trofeo Ronco 2026">
      <div class="tt"><div class="tit">${titolo}</div><div class="dt">${PDF.data}</div></div></div>`;
  },
  piede: () => '',

  // ---------------- ENDURO: 3 giri, totale, distacco, punti
  enduro(stato) {
    const cl = R.classifica(stato), fini = cl.filter(r => r.giri === 3 && !r.rit), altri = cl.filter(r => !(r.giri === 3 && !r.rit));
    // posizione nel singolo giro: a pari tempo stessa posizione (3, 3, poi 5)
    const tg = [0, 1, 2].map(g => cl.map(r => r.t[g]).filter(R.ok));
    const posG = (v, g) => 1 + tg[g].filter(x => x < v).length;
    const riga = (r, rit) => `<tr class="${r.pos <= 3 && !rit ? 'p' + r.pos : ''} ${rit ? 'rit' : ''}">
      <td class="pos">${rit ? '–' : r.pos}</td><td class="num">${r.p.num}</td><td class="l nm">${PDF.esc(r.p.nome)}</td>
      ${r.t.map((v, g) => `<td>${R.ok(v) ? R.fmt(v) + `<small class="pg">(${posG(v, g)})</small>` : v != null ? R.fmt(v) : '–'}</td>`).join('')}
      <td class="tot">${rit ? (r.rit ? 'Rit.' : '') : R.fmt(r.somma)}</td><td>${!rit && r.distacco != null ? R.gap(r.distacco) : ''}</td>
      <td class="pts">${rit ? '' : r.punti}</td></tr>`;
    return PDF.testa('Classifica enduro') + `
      <h3 class="ps">Prova a cronometro · 3 giri</h3>
      <table class="pt"><tr><th>Pos</th><th>N°</th><th class="l">Pilota</th><th>Giro 1</th><th>Giro 2</th><th>Giro 3</th><th>Totale</th><th>Distacco</th><th>Punti</th></tr>
      ${fini.map(r => riga(r, false)).join('')}${altri.map(r => riga(r, true)).join('')}</table>` + PDF.piede();
  },

  // ---------------- CROSS: ogni manche, la finale, poi il totale per coppia
  cross(stato) {
    const xc = {}; (stato.cross || []).forEach(c => xc[c.n] = c);
    const gara = (g, titolo, extra) => {
      const l = (stato.arrivi || {})[g] || [];
      let pos = 0;
      return `<div><h3 class="ps">${titolo}</h3><table class="pt"><tr><th>Arr.</th><th class="l">Coppia</th><th>Punti</th></tr>
        ${l.map(a => { const fuori = extra && !(stato.qualificati || []).includes(a.c);
          const ok = !a.rit && a.sq !== 'SI' && !fuori, p = ok ? ++pos : '–', c = xc[a.c] || {};
          const pt = ok ? (extra ? '+' + c.puntiF : c.puntiM) : (a.rit ? 'rit.' : (fuori ? 'esclusa' : 'squal.'));
          return `<tr class="${ok && p <= 3 ? 'p' + p : ''} ${ok ? '' : 'rit'}"><td class="pos">${p}</td><td class="l nm">${PDF.esc(PDF.coppia(stato, a.c))}</td><td class="pts">${pt}</td></tr>`; }).join('')
          || '<tr><td colspan="3" class="l">–</td></tr>'}</table></div>`;
    };
    return PDF.testa('Classifica cross') + `
      <div class="grid2">${gara('M1', 'Manche 1')}${gara('M2', 'Manche 2')}</div>
      ${gara('F', 'Finale · punti extra', true)}
      ${(() => { const vc = R.vincitoreCross(stato); if (!vc.premiata) return '';
        return `<div class="win">🏆 Vince il cross: <b>${PDF.esc(PDF.coppia(stato, vc.premiata))}</b>${vc.regola === 'finale' ? ' · vincitore della finale' : ''}</div>`; })()}
      <h3 class="ps">Classifica cross a coppie</h3>
      <table class="pt"><tr><th>Pos</th><th class="l">Coppia</th><th>Manche</th><th>Punti manche</th><th>Finale</th><th>Totale</th></tr>
      ${(stato.cross || []).map(c => `<tr class="${c.pos <= 3 ? 'p' + c.pos : ''}"><td class="pos">${c.pos}</td><td class="l nm">${PDF.esc(PDF.coppia(stato, c.n))}</td>
        <td>M${c.manche}${c.posM ? ' · ' + c.posM + '°' : ''}</td><td>${c.puntiM}</td><td>${c.posF ? c.posF + '° · +' + c.puntiF : ''}</td><td class="pts">${c.tot}</td></tr>`).join('')}</table>
` + PDF.piede();
  },

  // ---------------- ASSOLUTA: punti enduro + punti cross − penalità
  assoluta(stato) {
    const end = {}; R.classifica(stato).forEach(r => end[r.p.num] = r);
    return PDF.testa('Classifica assoluta') + `
      <h3 class="ps">Punti enduro + punti cross della coppia − penalità</h3>
      <table class="pt"><tr><th>Pos</th><th>N°</th><th class="l">Pilota</th><th>Enduro</th><th class="l">Coppia cross</th><th>Cross</th><th>Pen.</th><th>Totale</th></tr>
      ${(stato.assoluta || []).map(r => { const e = end[r.num] || {}, c = (stato.coppie || []).find(x => x.n === r.coppia);
        const comp = c ? PDF.nome(stato, c.a === r.num ? c.b : c.a) : '';
        return `<tr class="${r.pos <= 3 ? 'p' + r.pos : ''}"><td class="pos">${r.pos}</td><td class="num">${r.num}</td><td class="l nm">${PDF.esc(PDF.nome(stato, r.num))}</td>
          <td>${r.enduro}${e.pos && e.giri === 3 ? ` <small style="color:#94a3b8">(${e.pos}°)</small>` : ''}</td><td class="l">${c ? (c.b ? 'con ' + PDF.esc(comp) : 'Marathon') : ''}</td>
          <td>${r.cross}</td><td>${r.pen ? '−' + r.pen : ''}</td><td class="pts">${r.tot}</td></tr>`; }).join('')}</table>
` + PDF.piede();
  },

  pagina(tipo, stato) { return `<style>${PDF.css}</style><div class="pdfpag">${PDF[tipo](stato)}</div>`; },

  // crea il PDF (serve html2pdf, caricato dalla regia) e lo condivide o lo scarica
  async condividi(tipo, stato) {
    // la pagina si costruisce in alto a sinistra, coperta da un avviso «Creo il PDF…»
    window.scrollTo(0, 0);
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:0;top:0;z-index:9998;background:#fff';
    box.innerHTML = PDF.pagina(tipo, stato);
    const velo = document.createElement('div');
    velo.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#f0f4f8;display:flex;align-items:center;justify-content:center;font:700 18px sans-serif;color:#334155';
    velo.textContent = '⏳ Creo il PDF…';
    document.body.appendChild(box); document.body.appendChild(velo);
    try {
      await document.fonts.ready;
      const nomeFile = `Trofeo_Ronco_2026_${{ enduro: 'Enduro', cross: 'Cross', assoluta: 'Assoluta' }[tipo]}.pdf`;
      const blob = await html2pdf().set({
        margin: 0, filename: nomeFile, image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 794 }, jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait' }
      }).from(box.querySelector('.pdfpag')).outputPdf('blob');
      const file = new File([blob], nomeFile, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: nomeFile });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nomeFile; a.click(); }
    } finally { box.remove(); velo.remove(); }
  }
};
