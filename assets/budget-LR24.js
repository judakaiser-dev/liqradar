/* LIQRADAR v24 — Makro-Daten: Staatshaushalt je Land (Überschuss = „Gewinn“, Defizit = „Verlust“)
   Quelle: IWF World Economic Outlook (DataMapper): GGXCNL_NGDP (Finanzierungssaldo des Gesamtstaats in % des BIP)
   und NGDPD (BIP in US-Dollar). Ab 2025 IWF-Schätzungen/Prognosen. Abgerufen am 15.11.2026. */
(function () {
  'use strict'
  // [Jahr, Saldo in % des BIP, Saldo in Mrd. US-$]
  var DATA = {"JPN":[[2000,-7.2,-363.1],[2001,-6.1,-270.8],[2002,-7.2,-305.7],[2003,-7.3,-333.9],[2004,-5.3,-261.9],[2005,-4.4,-214.5],[2006,-3,-139.4],[2007,-2.9,-134.1],[2008,-4.1,-211.6],[2009,-9.6,-512.3],[2010,-9.1,-528.9],[2011,-9,-565.1],[2012,-8.2,-519.4],[2013,-7.6,-400.7],[2014,-5.6,-279.2],[2015,-3.6,-163.2],[2016,-3.6,-184.0],[2017,-3,-151.1],[2018,-2.4,-123.7],[2019,-3,-157.4],[2020,-9,-467.0],[2021,-6.3,-329.3],[2022,-4.2,-186.7],[2023,-2.4,-105.3],[2024,-1.7,-71.5],[2025,-0.7,-31.2],[2026,-1.4,-60.8]],"GRC":[[2000,-4.2,-5.4],[2001,-5.6,-7.4],[2002,-6.2,-9.3],[2003,-8,-15.8],[2004,-9.1,-21.4],[2005,-6.3,-15.3],[2006,-6,-16.1],[2007,-6.8,-21.4],[2008,-10.3,-36.2],[2009,-15.4,-50.3],[2010,-11.4,-33.8],[2011,-10.5,-29.7],[2012,-6.9,-16.5],[2013,-4.1,-9.7],[2014,-4.3,-10.1],[2015,-3,-5.8],[2016,0.3,0.6],[2017,1.1,2.2],[2018,0.8,1.7],[2019,-0.1,-0.2],[2020,-10.7,-20.5],[2021,-7.8,-17.0],[2022,-2.6,-5.7],[2023,-1.4,-3.4],[2024,1.3,3.3],[2025,1.7,4.8],[2026,0.3,0.9]],"ITA":[[2000,-2.4,-27.6],[2001,-3.2,-37.5],[2002,-2.9,-37.1],[2003,-3.2,-50.6],[2004,-3.5,-63.4],[2005,-4.1,-76.5],[2006,-3.6,-70.5],[2007,-1.3,-28.9],[2008,-2.6,-62.8],[2009,-5.1,-112.6],[2010,-4.2,-90.2],[2011,-3.5,-80.7],[2012,-3,-63.0],[2013,-2.9,-62.4],[2014,-2.8,-60.9],[2015,-2.5,-46.1],[2016,-2.4,-45.3],[2017,-2.5,-49.3],[2018,-2.2,-46.2],[2019,-1.5,-30.3],[2020,-9.4,-179.2],[2021,-8.9,-194.1],[2022,-8.1,-170.6],[2023,-7.1,-164.5],[2024,-3.4,-81.0],[2025,-3.1,-79.1],[2026,-2.9,-78.4]],"USA":[[2001,-0.5,-52.9],[2002,-3.8,-415.3],[2003,-4.8,-549.9],[2004,-4.2,-513.1],[2005,-3.1,-404.2],[2006,-2,-276.3],[2007,-2.9,-419.8],[2008,-6.6,-974.8],[2009,-13.2,-1911.1],[2010,-11,-1655.4],[2011,-9.7,-1513.2],[2012,-8.1,-1316.6],[2013,-4.6,-776.5],[2014,-4,-704.3],[2015,-3.5,-640.3],[2016,-4.4,-827.4],[2017,-4.8,-941.4],[2018,-5.3,-1094.8],[2019,-5.8,-1249.3],[2020,-14.1,-3013.9],[2021,-11.5,-2730.8],[2022,-3.7,-964.2],[2023,-7.9,-2198.2],[2024,-7.8,-2291.7],[2025,-7.1,-2191.2],[2026,-8.5,-2774.6]],"FRA":[[2000,-1.3,-17.7],[2001,-1.4,-19.2],[2002,-3.2,-47.7],[2003,-4.1,-75.2],[2004,-3.6,-75.9],[2005,-3.5,-76.8],[2006,-2.7,-62.6],[2007,-3,-79.7],[2008,-3.5,-102.4],[2009,-7.4,-199.6],[2010,-7.2,-190.7],[2011,-5.3,-152.1],[2012,-5.2,-139.6],[2013,-4.9,-138.0],[2014,-4.6,-131.7],[2015,-3.9,-95.3],[2016,-3.8,-93.8],[2017,-3.4,-88.0],[2018,-2.3,-64.0],[2019,-2.4,-65.4],[2020,-8.9,-235.5],[2021,-6.6,-195.9],[2022,-4.7,-131.5],[2023,-5.4,-165.5],[2024,-5.8,-184.3],[2025,-5.1,-172.5],[2026,-5.4,-191.9]],"CAN":[[2000,2.6,19.4],[2001,0.5,3.7],[2002,-0.2,-1.5],[2003,-0.1,-0.9],[2004,0.8,8.2],[2005,1.6,18.8],[2006,1.8,23.7],[2007,1.8,26.4],[2008,0.2,3.1],[2009,-3.9,-53.7],[2010,-4.7,-76.0],[2011,-3.3,-59.2],[2012,-2.5,-45.7],[2013,-1.5,-27.7],[2014,0.2,3.6],[2015,-0.1,-1.6],[2016,-0.5,-7.6],[2017,-0.1,-1.6],[2018,0.4,6.9],[2019,0,0.0],[2020,-10.9,-180.5],[2021,-3.1,-62.7],[2022,0.6,13.2],[2023,-0.2,-4.4],[2024,-2.1,-47.7],[2025,-1.7,-39.5],[2026,-2.5,-62.3]],"GBR":[[2000,1.4,23.4],[2001,0.3,4.9],[2002,-2,-35.7],[2003,-3.2,-65.8],[2004,-3.2,-77.5],[2005,-3.1,-78.9],[2006,-2.7,-73.2],[2007,-2.6,-80.5],[2008,-5.1,-151.4],[2009,-10,-243.4],[2010,-9.3,-232.3],[2011,-7.4,-198.1],[2012,-8,-217.8],[2013,-5.3,-148.6],[2014,-5.5,-170.0],[2015,-4.5,-132.6],[2016,-3.3,-89.7],[2017,-2.5,-67.7],[2018,-2.2,-64.0],[2019,-2.4,-69.4],[2020,-12.9,-352.8],[2021,-7.5,-240.7],[2022,-4.6,-147.4],[2023,-6,-206.4],[2024,-6,-222.8],[2025,-5.3,-212.6],[2026,-3.8,-162.2]],"ESP":[[2000,-1.2,-7.2],[2001,-0.5,-3.1],[2002,-0.3,-2.1],[2003,-0.4,-3.6],[2004,-0.1,-1.1],[2005,1.2,13.9],[2006,2.1,26.5],[2007,1.9,28.1],[2008,-4.6,-75.3],[2009,-11.2,-167.4],[2010,-9.5,-135.8],[2011,-9.7,-144.3],[2012,-11.5,-153.2],[2013,-7.5,-102.2],[2014,-6.1,-84.2],[2015,-5.3,-63.9],[2016,-4.3,-53.4],[2017,-3.1,-41.0],[2018,-2.6,-37.2],[2019,-3,-42.1],[2020,-10,-128.9],[2021,-6.7,-98.0],[2022,-4.6,-66.7],[2023,-3.3,-53.4],[2024,-3.2,-55.4],[2025,-2.4,-45.8],[2026,-2.4,-50.0]],"CHN":[[2000,-2.8,-34.3],[2001,-2.6,-35.2],[2002,-2.8,-41.7],[2003,-2.4,-40.4],[2004,-1.5,-29.8],[2005,-1.4,-32.5],[2006,-1.1,-30.7],[2007,0.1,3.6],[2008,0,0.0],[2009,-1.7,-88.2],[2010,-0.4,-24.8],[2011,-0.1,-7.7],[2012,-0.3,-26.0],[2013,-0.8,-78.0],[2014,-0.7,-74.7],[2015,-2.5,-282.0],[2016,-3.3,-378.2],[2017,-3.3,-414.2],[2018,-4.2,-594.1],[2019,-6,-874.9],[2020,-9.6,-1440.3],[2021,-5.9,-1073.5],[2022,-7.3,-1339.3],[2023,-6.7,-1230.6],[2024,-7.2,-1362.9],[2025,-7.9,-1550.5],[2026,-8,-1723.7]],"DEU":[[2000,-1.7,-33.5],[2001,-3.1,-61.0],[2002,-4.1,-86.1],[2003,-3.8,-96.3],[2004,-3.4,-96.9],[2005,-3.4,-98.4],[2006,-1.8,-54.8],[2007,0.2,7.0],[2008,-0.3,-11.4],[2009,-3.2,-111.2],[2010,-4.4,-152.7],[2011,-0.8,-30.6],[2012,-0.1,-3.6],[2013,0.1,3.8],[2014,0.7,27.8],[2015,0.9,30.9],[2016,1.1,39.0],[2017,1.3,49.1],[2018,1.9,77.5],[2019,1.3,51.8],[2020,-4.3,-170.7],[2021,-3.2,-140.6],[2022,-1.9,-80.3],[2023,-2.2,-101.2],[2024,-2.7,-128.2],[2025,-2.9,-148.4],[2026,-4.3,-235.3]]}
  var EST_FROM = 2025
  var EVENTS = {
    _: { 2008: 'Finanzkrise', 2009: 'Finanzkrise', 2020: 'Corona-Pandemie', 2021: 'Corona-Pandemie', 2022: 'Energiekrise' },
    GRC: { 2010: 'Euro-Schuldenkrise', 2011: 'Euro-Schuldenkrise', 2012: 'Schuldenschnitt', 2015: 'Drittes Hilfspaket', 2016: 'Sparprogramm wirkt' },
    ESP: { 2012: 'Bankenrettung', 2011: 'Euro-Schuldenkrise', 2006: 'Immobilienboom' },
    ITA: { 2011: 'Euro-Schuldenkrise', 2012: 'Euro-Schuldenkrise', 2021: 'Corona + Bau-Bonus', 2022: 'Superbonus/Energiekrise' },
    DEU: { 2014: '„Schwarze Null“', 2015: '„Schwarze Null“', 2016: '„Schwarze Null“', 2017: '„Schwarze Null“', 2018: '„Schwarze Null“', 2019: '„Schwarze Null“', 2026: 'Sondervermögen Infrastruktur/Verteidigung' },
    USA: { 2001: 'Ende der Überschuss-Ära', 2002: '9/11 & Steuersenkungen', 2018: 'Steuerreform', 2023: 'Hohe Zinskosten' },
    GBR: { 2010: 'Sparprogramm beginnt', 2016: 'Brexit-Votum' },
    JPN: { 2011: 'Erdbeben/Fukushima', 2014: 'Mehrwertsteuer-Erhöhung' },
    CHN: { 2015: 'Konjunkturprogramme', 2019: 'Handelskonflikt mit den USA' },
    CAN: { 2000: 'Überschuss-Phase', 2007: 'Überschuss-Phase' },
    FRA: { 2024: 'Defizitverfahren der EU' },
  }

  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })
  function sgn(v) { return v > 0 ? '+' : v < 0 ? '−' : '±' }
  function pct(v) { return sgn(v) + nf1.format(Math.abs(v)) + ' %' }
  function usd(v) {
    var a = Math.abs(v)
    return sgn(v) + (a >= 1000 ? nf1.format(a / 1000) + ' Bio. $' : nf0.format(a) + ' Mrd. $')
  }
  function ev(iso, y) { return (EVENTS[iso] && EVENTS[iso][y]) || EVENTS._[y] || '' }

  var state = {} // iso -> {sel, mode}
  var CSS =
    '.lrb{margin-top:14px;padding-top:12px;border-top:1px solid var(--hairline)}' +
    '.lrb-h{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px}' +
    '.lrb-t{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--text-muted)}' +
    '.lrb-seg{display:flex;border:1px solid var(--hairline);border-radius:4px;overflow:hidden}' +
    '.lrb-seg button{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10.5px;padding:4px 8px;border:0;background:transparent;color:var(--text-muted);cursor:pointer}' +
    '.lrb-seg button.on{color:var(--live);background:rgba(34,211,238,.12)}' +
    '.lrb-x{margin-top:4px;font-size:11px;color:var(--text-muted);line-height:1.45}' +
    '.lrb svg{display:block;width:100%;height:auto;margin-top:8px;touch-action:pan-y}' +
    '.lrb svg rect.b{cursor:pointer}' +
    '.lrb-d{margin-top:6px;padding:9px 11px;border-radius:6px;background:var(--panel-2);border:1px solid var(--hairline);font-size:12.5px;line-height:1.5}' +
    '.lrb-d b.g{color:#4ade80}.lrb-d b.r{color:#f87171}' +
    '.lrb-s{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}' +
    '.lrb-s div{padding:7px 9px;border:1px solid var(--hairline);border-radius:5px;font-size:11px;color:var(--text-muted)}' +
    '.lrb-s div b{display:block;margin-top:2px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12.5px;color:var(--text)}' +
    '.lrb details{margin-top:8px}.lrb summary{cursor:pointer;font-size:11.5px;color:var(--live)}' +
    '.lrb table{width:100%;margin-top:6px;border-collapse:collapse;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11.5px}' +
    '.lrb td{padding:4px 2px;border-bottom:1px dashed var(--hairline)}.lrb td:nth-child(2),.lrb td:nth-child(3){text-align:right}' +
    '.lrb td:nth-child(4){color:var(--text-muted);font-family:Inter,system-ui,sans-serif;font-size:11px;padding-left:8px}' +
    '.lrb tr.on td{background:rgba(148,163,184,.1)}.lrb .g{color:#4ade80}.lrb .r{color:#f87171}'

  function chart(iso, rows, s) {
    var W = 520, Hh = 170, padL = 34, padR = 6, top = 10, bot = 22
    var cw = W - padL - padR, ch = Hh - top - bot
    var idx = s.mode === 'usd' ? 2 : 1
    var max = 0
    rows.forEach(function (r) { max = Math.max(max, Math.abs(r[idx])) })
    max = max || 1
    var pos = 0, neg = 0
    rows.forEach(function (r) { if (r[idx] > 0) pos = Math.max(pos, r[idx]); else neg = Math.max(neg, -r[idx]) })
    var span = (pos + neg) || 1
    var zeroY = top + ch * (pos / span)
    function y(v) { return zeroY - v / span * ch }
    var bw = cw / rows.length
    var out = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Haushaltssaldo je Jahr">'
    // Hilfslinien
    var ticks = [pos, -neg].filter(function (v) { return Math.abs(v) > 0 })
    ticks.forEach(function (v) {
      out += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--hairline)" stroke-dasharray="3 3"/>' +
        '<text x="' + (padL - 4) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="var(--text-muted)" font-family="JetBrains Mono,monospace">' +
        (s.mode === 'usd' ? (v > 0 ? '+' : '−') + nf0.format(Math.abs(v)) : (v > 0 ? '+' : '−') + nf1.format(Math.abs(v)) + '%') + '</text>'
    })
    out += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + zeroY.toFixed(1) + '" y2="' + zeroY.toFixed(1) + '" stroke="var(--text-muted)" stroke-width="1"/>' +
      '<text x="' + (padL - 4) + '" y="' + (zeroY + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="var(--text-muted)" font-family="JetBrains Mono,monospace">0</text>'
    rows.forEach(function (r, i) {
      var v = r[idx], x = padL + i * bw, h = Math.max(1, Math.abs(y(v) - zeroY))
      var yy = v >= 0 ? zeroY - h : zeroY
      var col = v >= 0 ? '#4ade80' : '#f87171'
      var est = r[0] >= EST_FROM
      var on = s.sel === r[0]
      out += '<rect class="b" data-y="' + r[0] + '" x="' + (x + bw * 0.14).toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + (bw * 0.72).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1.5" fill="' + col + '"' +
        ' fill-opacity="' + (on ? 1 : est ? 0.4 : 0.75) + '"' + (on ? ' stroke="var(--text)" stroke-width="1.2"' : '') + '/>'
      // große Klickfläche
      out += '<rect class="b" data-y="' + r[0] + '" x="' + x.toFixed(1) + '" y="' + top + '" width="' + bw.toFixed(1) + '" height="' + ch + '" fill="transparent"/>'
      if ((r[0] % 5 === 0 && i < rows.length - 3) || i === rows.length - 1) {
        out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (Hh - 6) + '" text-anchor="middle" font-size="9.5" fill="var(--text-muted)" font-family="JetBrains Mono,monospace">' + r[0] + (r[0] >= EST_FROM ? '*' : '') + '</text>'
      }
    })
    return out + '</svg>'
  }

  function render(el) {
    var iso = el.getAttribute('data-iso')
    var rows = DATA[iso]
    if (!rows) { el.innerHTML = ''; return }
    var s = state[iso] || (state[iso] = { sel: null, mode: 'pct' })
    var actual = rows.filter(function (r) { return r[0] < EST_FROM })
    if (s.sel == null) s.sel = actual.length ? actual[actual.length - 1][0] : rows[rows.length - 1][0]
    var sel = rows.filter(function (r) { return r[0] === s.sel })[0]
    var surplus = actual.filter(function (r) { return r[1] > 0 }).length
    var worst = actual.reduce(function (a, b) { return b[1] < a[1] ? b : a })
    var best = actual.reduce(function (a, b) { return b[1] > a[1] ? b : a })
    var sum = rows.reduce(function (a, r) { return a + r[2] }, 0)
    var sumAct = actual.reduce(function (a, r) { return a + r[2] }, 0)

    var e = ev(iso, sel[0])
    var good = sel[1] > 0
    var detail = '<b>' + sel[0] + (sel[0] >= EST_FROM ? '* (IWF-Prognose)' : '') + ':</b> ' +
      (sel[1] === 0 ? 'ausgeglichener Haushalt' : good ? '<b class="g">Überschuss („Gewinn“)</b>' : '<b class="r">Defizit („Verlust“)</b>') +
      ' von <b class="' + (good ? 'g' : 'r') + '">' + pct(sel[1]) + '</b> der Wirtschaftsleistung' +
      ' ≈ <b class="' + (good ? 'g' : 'r') + '">' + usd(sel[2]) + '</b>' + (e ? ' · ' + e : '') + '.'
    if (!good && sel[1] < -3 && ['DEU', 'FRA', 'ITA', 'ESP', 'GRC'].indexOf(iso) >= 0) detail += ' <span style="color:var(--text-muted)">Über der EU-Grenze von 3 %.</span>'

    var html = '<div class="lrb"><div class="lrb-h"><span class="lrb-t">Staatshaushalt · Gewinn / Verlust je Jahr</span>' +
      '<div class="lrb-seg"><button type="button" data-m="pct" class="' + (s.mode === 'pct' ? 'on' : '') + '">% BIP</button><button type="button" data-m="usd" class="' + (s.mode === 'usd' ? 'on' : '') + '">Mrd. $</button></div></div>' +
      '<div class="lrb-x">Grün = Überschuss (Staat nimmt mehr ein als er ausgibt), Rot = Defizit (neue Schulden). Balken antippen für Details.</div>' +
      chart(iso, rows, s) +
      '<div class="lrb-d">' + detail + '</div>' +
      '<div class="lrb-s">' +
      '<div>Jahre mit Überschuss<b>' + surplus + ' von ' + actual.length + '</b></div>' +
      '<div>Größtes Defizit<b class="r">' + worst[0] + ': ' + pct(worst[1]) + '</b></div>' +
      '<div>Bestes Jahr<b class="' + (best[1] > 0 ? 'g' : 'r') + '">' + best[0] + ': ' + pct(best[1]) + '</b></div>' +
      '<div>Summe ' + actual[0][0] + '–' + actual[actual.length - 1][0] + '<b class="' + (sumAct >= 0 ? 'g' : 'r') + '">' + usd(sumAct) + '</b></div>' +
      '</div>' +
      '<details><summary>Alle Jahre anzeigen</summary><table>' +
      rows.slice().reverse().map(function (r) {
        var c = r[1] > 0 ? 'g' : r[1] < 0 ? 'r' : ''
        return '<tr class="' + (r[0] === s.sel ? 'on' : '') + '"><td>' + r[0] + (r[0] >= EST_FROM ? '*' : '') + '</td><td class="' + c + '">' + pct(r[1]) + '</td><td class="' + c + '">' + usd(r[2]) + '</td><td>' + ev(iso, r[0]) + '</td></tr>'
      }).join('') + '</table></details>' +
      '<div class="lrb-x" style="margin-top:8px">Quelle: IWF World Economic Outlook (Finanzierungssaldo des Gesamtstaats, BIP in US-$). * = IWF-Schätzung/Prognose. Summe inkl. Prognosen bis 2026: ' + usd(sum) + '.</div></div>'
    var openDetails = el.querySelector('details') && el.querySelector('details').open
    el.innerHTML = html
    if (openDetails) el.querySelector('details').open = true
    Array.prototype.forEach.call(el.querySelectorAll('rect.b'), function (r) {
      r.addEventListener('click', function () { s.sel = +r.getAttribute('data-y'); render(el) })
    })
    Array.prototype.forEach.call(el.querySelectorAll('.lrb-seg button'), function (b) {
      b.addEventListener('click', function () { s.mode = b.getAttribute('data-m'); render(el) })
    })
  }

  function scan() {
    var els = document.querySelectorAll('#lr-budget-root')
    Array.prototype.forEach.call(els, function (el) {
      var iso = el.getAttribute('data-iso')
      if (el.getAttribute('data-lrb') === iso) return
      el.setAttribute('data-lrb', iso)
      if (!document.getElementById('lrb-style')) {
        var st = document.createElement('style'); st.id = 'lrb-style'; st.textContent = CSS; document.head.appendChild(st)
      }
      render(el)
    })
  }
  function start() { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-iso'] }) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
