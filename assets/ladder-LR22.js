/* LIQRADAR v22 — Dashboard-Panel „Liquidations-Leiter"
   Ersetzt die Liquidationskarte durch eine leicht verständliche Leiter:
   Wie viel wird geschätzt liquidiert, wenn der Kurs um 1–5 % steigt oder fällt?
   Live-Daten (Binance, Bybit, Hyperliquid), Schätzmodell aus dem Reiter „Heatmap". */
(function () {
  'use strict'
  var STEPS = [1, 2, 3, 4, 5]
  var st = { coin: 'BTC', data: null, loading: false, sel: null, at: null }
  try { var sv = JSON.parse(localStorage.getItem('liqradar-ladder') || '{}'); if (sv.coin) st.coin = sv.coin } catch (e) {}
  function save() { try { localStorage.setItem('liqradar-ladder', JSON.stringify({ coin: st.coin })) } catch (e) {} }
  function api() { return window.__lrHeatmap }
  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  function pad2(n) { return (n < 10 ? '0' : '') + n }

  var CSS =
    '.lrl{display:flex;flex-direction:column;height:100%;font-size:13px}' +
    '.lrl-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:10px 14px 0}' +
    '.lrl-sel{font-family:"JetBrains Mono",ui-monospace,monospace;height:28px;border-radius:4px;border:1px solid var(--hairline);background:var(--panel-2);color:var(--text);padding:0 6px;font-size:11px}' +
    '.lrl-live{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.1em;color:var(--text-muted)}' +
    '.lrl-live i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--live);margin-right:5px;vertical-align:1px}' +
    '.lrl-sum{margin:10px 14px 0;padding:10px 12px;border-radius:6px;border:1px solid var(--hairline);background:var(--panel-2);line-height:1.5}' +
    '.lrl-sum b.u{color:#f87171}.lrl-sum b.d{color:#4ade80}' +
    '.lrl-rows{padding:8px 14px 4px}' +
    '.lrl-row{display:grid;grid-template-columns:44px 82px 1fr 84px;align-items:center;gap:8px;padding:5px 6px;border-radius:5px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.lrl-row:hover,.lrl-row.on{background:rgba(148,163,184,.10)}' +
    '.lrl-pct{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700;font-size:12px}' +
    '.lrl-pct.u{color:#f87171}.lrl-pct.d{color:#4ade80}' +
    '.lrl-px{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;color:var(--text-muted)}' +
    '.lrl-bar{height:12px;border-radius:3px;background:var(--hairline);overflow:hidden}' +
    '.lrl-bar span{display:block;height:100%;border-radius:3px}' +
    '.lrl-bar span.u{background:linear-gradient(90deg,#f87171aa,#f87171)}.lrl-bar span.d{background:linear-gradient(90deg,#4ade80aa,#4ade80)}' +
    '.lrl-amt{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;text-align:right;font-weight:600}' +
    '.lrl-now{display:grid;grid-template-columns:44px 1fr;gap:8px;align-items:center;margin:4px 0;padding:6px;border-radius:5px;background:rgba(249,115,22,.10);border:1px dashed rgba(249,115,22,.5)}' +
    '.lrl-now b{font-family:"JetBrains Mono",ui-monospace,monospace;color:#f97316}' +
    '.lrl-exp{margin:4px 14px 0;min-height:44px;line-height:1.5;color:var(--text)}' +
    '.lrl-legend{display:flex;flex-wrap:wrap;gap:4px 14px;padding:8px 14px 12px;font-size:11.5px;color:var(--text-muted);line-height:1.45}' +
    '.lrl-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:0}' +
    '@media(max-width:400px){.lrl-row{grid-template-columns:38px 70px 1fr 74px;gap:6px}}'

  function load() {
    var A = api()
    if (!A) { setTimeout(load, 300); return }
    var coin = st.coin
    var tf = A.TFS.filter(function (t) { return t.key === '7d' })[0]
    var cols = Math.round(tf.ms / A.IV_MS[tf.iv])
    st.loading = true; render()
    Promise.all(A.EXCHANGES.map(function (e) {
      return A.fetchCandles(e.key, coin, tf.iv, cols * 2).then(function (c) { return c }, function () { return null })
    })).then(function (res) {
      if (coin !== st.coin) return
      var act = [], P = null, used = []
      res.forEach(function (c, i) {
        if (!c || !c.length) return
        if (P == null) P = c[c.length - 1].c
        used.push(A.EXCHANGES[i].label)
        act = act.concat(A.activeLevels(A.buildLevels(c, tf)))
      })
      st.loading = false; st.at = new Date()
      if (P == null) { st.data = { err: true }; render(); return }
      var up = STEPS.map(function (s) {
        var lim = P * (1 + s / 100), v = 0
        act.forEach(function (a) { if (a.s === -1 && a.p >= P && a.p <= lim) v += a.a })
        return { s: s, p: lim, v: v }
      })
      var dn = STEPS.map(function (s) {
        var lim = P * (1 - s / 100), v = 0
        act.forEach(function (a) { if (a.s === 1 && a.p <= P && a.p >= lim) v += a.a })
        return { s: -s, p: lim, v: v }
      })
      st.data = { P: P, up: up, dn: dn, used: used }
      render()
    })
  }

  function explain(row, P) {
    var A = api(), coin = st.coin
    if (row.s > 0) return 'Steigt ' + coin + ' um ' + row.s + ' % auf <b>' + A.fmtPrice(row.p, P) + ' $</b>, werden geschätzt <b class="u" style="color:#f87171">' + A.fmtUsd(row.v) + '</b> an Short-Positionen zwangsgeschlossen. Diese Zwangskäufe können den Anstieg zusätzlich antreiben.'
    return 'Fällt ' + coin + ' um ' + Math.abs(row.s) + ' % auf <b>' + A.fmtPrice(row.p, P) + ' $</b>, werden geschätzt <b style="color:#4ade80">' + A.fmtUsd(row.v) + '</b> an Long-Positionen zwangsgeschlossen. Diese Zwangsverkäufe können den Rückgang zusätzlich verstärken.'
  }

  function summary(d) {
    var A = api(), coin = st.coin
    var u5 = d.up[4].v, d5 = d.dn[4].v
    var html
    if (u5 > d5 * 1.15) html = '<b class="u">Mehr Druck nach oben.</b> Über dem Kurs liegen ' + nf1.format(u5 / Math.max(d5, 1)) + '× mehr Short-Liquidationen als darunter Long-Liquidationen. Steigt ' + coin + ', können Zwangskäufe den Anstieg beschleunigen.'
    else if (d5 > u5 * 1.15) html = '<b class="d">Mehr Druck nach unten.</b> Unter dem Kurs liegen ' + nf1.format(d5 / Math.max(u5, 1)) + '× mehr Long-Liquidationen als darüber Short-Liquidationen. Fällt ' + coin + ', können Zwangsverkäufe den Rückgang beschleunigen.'
    else html = '<b>Ausgeglichen.</b> Ober- und unterhalb des Kurses liegen ähnlich viele Liquidationen — keine Seite ist deutlich im Vorteil.'
    // größter Sprung
    var best = null
    ;[d.up, d.dn].forEach(function (arr) {
      for (var i = 0; i < arr.length; i++) {
        var inc = arr[i].v - (i ? arr[i - 1].v : 0)
        if (!best || inc > best.inc) best = { inc: inc, a: i ? arr[i - 1] : null, b: arr[i] }
      }
    })
    if (best && best.inc > 0) {
      var from = best.a ? best.a.p : d.P, sgn = best.b.s > 0 ? '+' : '−'
      html += ' Die meisten Liquidationen warten zwischen <b>' + (best.a ? sgn + Math.abs(best.a.s) : '0') + ' % und ' + sgn + Math.abs(best.b.s) + ' %</b> (' + A.fmtPrice(Math.min(from, best.b.p), d.P) + '–' + A.fmtPrice(Math.max(from, best.b.p), d.P) + ' $) — diese Zone wirkt wie ein Magnet.'
    }
    return html
  }

  var root = null, timer = null
  function render() {
    if (root && (!root.isConnected || root.id !== 'lr-ladder-root')) root = null
    if (!root) return
    var A = api(), d = st.data
    var coins = A ? A.COINS : ['BTC']
    var html = '<div class="lrl"><div class="lrl-top"><select class="lrl-sel" aria-label="Coin für die Liquidations-Leiter">' +
      coins.map(function (c) { return '<option' + (c === st.coin ? ' selected' : '') + '>' + c + '</option>' }).join('') + '</select>' +
      '<span class="lrl-live"><i></i>LIVE · 7 TAGE · ' + (d && d.used ? d.used.join(', ').toUpperCase() : 'BINANCE, BYBIT, HYPERLIQUID') +
      (st.at ? ' · ' + pad2(st.at.getHours()) + ':' + pad2(st.at.getMinutes()) : '') + '</span></div>'
    if (!d || d.err) {
      html += '<div class="lrl-exp" style="padding:16px 0;color:var(--text-muted)">' + (st.loading || !d ? 'Lade Live-Daten …' : 'Live-Daten gerade nicht erreichbar.') + '</div></div>'
      root.innerHTML = html; bind(); return
    }
    var max = 0
    d.up.concat(d.dn).forEach(function (r) { if (r.v > max) max = r.v })
    function row(r, idx) {
      var cls = r.s > 0 ? 'u' : 'd', w = max ? Math.max(2, r.v / max * 100) : 0
      return '<div class="lrl-row' + (st.sel === r.s ? ' on' : '') + '" data-s="' + r.s + '"><span class="lrl-pct ' + cls + '">' + (r.s > 0 ? '+' : '−') + Math.abs(r.s) + ' %</span>' +
        '<span class="lrl-px">' + A.fmtPrice(r.p, d.P) + '</span><span class="lrl-bar"><span class="' + cls + '" style="width:' + w.toFixed(1) + '%"></span></span>' +
        '<span class="lrl-amt">' + A.fmtUsd(r.v).replace(' $', '') + '</span></div>'
    }
    html += '<div class="lrl-sum">' + summary(d) + '</div>'
    html += '<div class="lrl-rows">' + d.up.slice().reverse().map(row).join('') +
      '<div class="lrl-now"><b>JETZT</b><span><b>' + A.fmtPrice(d.P, d.P) + ' $</b> <span style="color:var(--text-muted);font-size:12px">aktueller ' + st.coin + '-Kurs</span></span></div>' +
      d.dn.map(row).join('') + '</div>'
    var selRow = d.up.concat(d.dn).filter(function (r) { return r.s === st.sel })[0]
    html += '<div class="lrl-exp">' + (selRow ? explain(selRow, d.P) : '<span style="color:var(--text-muted)">Tippe auf eine Zeile — dann steht hier in einem Satz, was bei dieser Kursbewegung passiert.</span>') + '</div>'
    html += '<div class="lrl-legend"><span><i style="background:#f87171"></i>Rot = Short-Positionen, verlieren wenn der Kurs <b>steigt</b></span>' +
      '<span><i style="background:#4ade80"></i>Grün = Long-Positionen, verlieren wenn der Kurs <b>fällt</b></span>' +
      '<span>Beträge = geschätzte Summe bis zu dieser Kursmarke. Schätzmodell, keine Anlageberatung.</span></div></div>'
    root.innerHTML = html
    bind()
  }
  function bind() {
    var sel = root.querySelector('.lrl-sel')
    if (sel) sel.addEventListener('change', function () { st.coin = sel.value; st.data = null; st.sel = null; save(); load() })
    Array.prototype.forEach.call(root.querySelectorAll('.lrl-row'), function (r) {
      r.addEventListener('click', function () { var s = +r.getAttribute('data-s'); st.sel = st.sel === s ? null : s; render() })
    })
  }

  function mount(el) {
    if (!document.getElementById('lrl-style')) {
      var s = document.createElement('style'); s.id = 'lrl-style'; s.textContent = CSS; document.head.appendChild(s)
    }
    root = el
    render(); load()
    clearInterval(timer)
    timer = setInterval(function () {
      if (!root || !root.isConnected) { clearInterval(timer); root = null; return }
      if (document.visibilityState === 'visible') load()
    }, 120e3)
  }
  function scan() {
    var el = document.getElementById('lr-ladder-root')
    if (el && !el.getAttribute('data-lrl')) { el.setAttribute('data-lrl', '1'); mount(el) }
  }
  function start() { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
