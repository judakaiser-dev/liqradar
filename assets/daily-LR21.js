/* LIQRADAR v21 — Reiter „Heute": Tages-Vorschau fürs Trading
   Regelbasiert aus Live-Daten (Bybit, Binance, Hyperliquid) + festem Termin-Kalender.
   Keine KI, kein Server. Keine Anlageberatung. */
(function () {
  'use strict'

  /* ---------- Termin-Kalender (offizielle Daten, US-Ostküstenzeit) ----------
     Quellen: federalreserve.gov (FOMC-Kalender), bls.gov (CPI- und Employment-Situation-Zeitplan) */
  var MACRO = [
    // Fed-Zinsentscheid (14:00 ET, Pressekonferenz 14:30 ET); * = mit Projektionen/Dot-Plot
    ['2026-12-09', '14:00', 'fomc', true],
    ['2027-01-27', '14:00', 'fomc', false], ['2027-03-17', '14:00', 'fomc', true],
    ['2027-04-28', '14:00', 'fomc', false], ['2027-06-09', '14:00', 'fomc', true],
    ['2027-07-28', '14:00', 'fomc', false], ['2027-09-15', '14:00', 'fomc', true],
    ['2027-10-27', '14:00', 'fomc', false], ['2027-12-08', '14:00', 'fomc', true],
    ['2028-01-26', '14:00', 'fomc', false],
    // Fed-Protokolle (14:00 ET)
    ['2026-11-18', '14:00', 'minutes'], ['2026-12-30', '14:00', 'minutes'],
    // US-Inflation CPI (08:30 ET)
    ['2026-12-10', '08:30', 'cpi'],
    ['2027-01-13', '08:30', 'cpi'], ['2027-02-11', '08:30', 'cpi'], ['2027-03-10', '08:30', 'cpi'],
    ['2027-04-13', '08:30', 'cpi'], ['2027-05-12', '08:30', 'cpi'], ['2027-06-10', '08:30', 'cpi'],
    ['2027-07-14', '08:30', 'cpi'], ['2027-08-11', '08:30', 'cpi'], ['2027-09-14', '08:30', 'cpi'],
    ['2027-10-14', '08:30', 'cpi'], ['2027-11-10', '08:30', 'cpi'], ['2027-12-10', '08:30', 'cpi'],
    // US-Arbeitsmarktbericht NFP (08:30 ET)
    ['2026-12-04', '08:30', 'nfp'],
    ['2027-01-08', '08:30', 'nfp'], ['2027-02-05', '08:30', 'nfp'], ['2027-03-05', '08:30', 'nfp'],
    ['2027-04-02', '08:30', 'nfp'], ['2027-05-07', '08:30', 'nfp'], ['2027-06-04', '08:30', 'nfp'],
    ['2027-07-02', '08:30', 'nfp'], ['2027-08-06', '08:30', 'nfp'], ['2027-09-03', '08:30', 'nfp'],
    ['2027-10-08', '08:30', 'nfp'], ['2027-11-05', '08:30', 'nfp'], ['2027-12-03', '08:30', 'nfp'],
  ]
  var MACRO_INFO = {
    fomc: { title: 'Fed-Zinsentscheid', weight: 3, text: 'Höchste Volatilität des Monats möglich. Pressekonferenz 30 Min. später.' },
    cpi: { title: 'US-Inflation (CPI)', weight: 3, text: 'Starke Sofortreaktion typisch — Spreads und Slippage steigen.' },
    nfp: { title: 'US-Arbeitsmarkt (NFP)', weight: 2, text: 'Schnelle Ausschläge in beide Richtungen möglich.' },
    minutes: { title: 'Fed-Protokoll', weight: 1, text: 'Meist moderate Reaktion, kann Zinserwartungen verschieben.' },
  }
  var MACRO_LAST = '2028-01-26'

  var H = 3600e3, D = 24 * H
  var st = { coin: 'BTC', day: 0, data: null, loading: false, err: null, at: null }
  try {
    var sv = JSON.parse(localStorage.getItem('liqradar-daily') || '{}')
    if (sv.coin) st.coin = sv.coin
  } catch (e) {}
  function save() { try { localStorage.setItem('liqradar-daily', JSON.stringify({ coin: st.coin })) } catch (e) {} }

  function api() { return window.__lrHeatmap }
  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  var nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  var nf3 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  function pct(v, d) { return (v >= 0 ? '+' : '−') + (d === 2 ? nf2 : nf1).format(Math.abs(v)) + ' %' }
  function pad2(n) { return (n < 10 ? '0' : '') + n }
  function hm(t) { var d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }

  /* ---------- Zeitzonen ---------- */
  var fmtCache = {}
  function partsIn(t, tz) {
    var f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short',
    }))
    var o = {}
    f.formatToParts(new Date(t)).forEach(function (p) { o[p.type] = p.value })
    return o
  }
  // Uhrzeit in einer Zeitzone -> UTC-Zeitstempel
  function zoned(y, mo, d, h, mi, tz) {
    var target = Date.UTC(y, mo - 1, d, h, mi), guess = target
    for (var i = 0; i < 3; i++) {
      var p = partsIn(guess, tz)
      var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute)
      guess += target - asUtc
    }
    return guess
  }

  /* ---------- Termine eines lokalen Tages ---------- */
  function dayRange(offset) {
    var n = new Date()
    var s = new Date(n.getFullYear(), n.getMonth(), n.getDate() + offset)
    var e = new Date(n.getFullYear(), n.getMonth(), n.getDate() + offset + 1)
    return { start: s.getTime(), end: e.getTime(), date: s }
  }
  function ymd(dt) { return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()) }

  function macroEvents(from, to) {
    var out = []
    MACRO.forEach(function (m) {
      var p = m[0].split('-'), t = m[1].split(':')
      var ts = zoned(+p[0], +p[1], +p[2], +t[0], +t[1], 'America/New_York')
      if (ts >= from && ts < to) {
        var info = MACRO_INFO[m[2]]
        out.push({ t: ts, kind: 'macro', type: m[2], weight: info.weight, title: info.title + (m[3] ? ' + Projektionen' : ''), text: info.text })
      }
    })
    return out
  }

  function eventsFor(range) {
    var ev = macroEvents(range.start, range.end)
    // Börsen-Sitzungen (Mo–Fr)
    for (var off = -1; off <= 1; off++) {
      var dt = new Date(range.date.getFullYear(), range.date.getMonth(), range.date.getDate() + off)
      var y = dt.getFullYear(), mo = dt.getMonth() + 1, d = dt.getDate(), wd = dt.getDay()
      if (wd >= 1 && wd <= 5) {
        ev.push({ t: zoned(y, mo, d, 9, 0, 'Asia/Tokyo'), kind: 'session', title: 'Asien-Handel (Tokio) öffnet', text: 'Oft ruhigere Phase, Bewegungen aus der Nacht werden getestet.' })
        ev.push({ t: zoned(y, mo, d, 8, 0, 'Europe/London'), kind: 'session', title: 'Europa-Handel (London) öffnet', text: 'Volumen steigt, erste Richtungsentscheidung des Tages.' })
        ev.push({ t: zoned(y, mo, d, 9, 30, 'America/New_York'), kind: 'session', title: 'US-Aktienmarkt öffnet', text: 'Volatilste Phase für Krypto — ETF-Flüsse und Aktien-Korrelation.' })
        ev.push({ t: zoned(y, mo, d, 16, 0, 'America/New_York'), kind: 'session', title: 'US-Aktienmarkt schließt', text: 'Danach dünnere Liquidität.' })
      }
      // CME-Bitcoin-Futures: Freitag-Schluss / Sonntag-Öffnung
      if (wd === 5) ev.push({ t: zoned(y, mo, d, 17, 0, 'America/New_York'), kind: 'cme', title: 'CME-Futures schließen fürs Wochenende', text: 'Wochenend-Kurs kann eine „CME-Lücke“ bilden.' })
      if (wd === 0) ev.push({ t: zoned(y, mo, d, 18, 0, 'America/New_York'), kind: 'cme', title: 'CME-Futures öffnen wieder', text: 'Offene CME-Lücke wird oft angelaufen.' })
      // Funding 00/08/16 UTC
      ;[0, 8, 16].forEach(function (hh) {
        ev.push({ t: Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), hh), kind: 'funding', title: 'Funding-Abrechnung (Binance/Bybit)', text: 'Kurz davor oft Positions-Anpassungen.' })
      })
      // Optionsverfall Deribit freitags 08:00 UTC
      if (wd === 5) {
        var last = new Date(y, mo - 1, d + 7).getMonth() !== mo - 1
        var quarter = last && (mo % 3 === 0)
        ev.push({
          t: Date.UTC(y, mo - 1, d, 8), kind: 'options', weight: quarter ? 2 : last ? 2 : 0,
          title: quarter ? 'Großer Quartals-Optionsverfall' : last ? 'Monatlicher Optionsverfall' : 'Wöchentlicher Optionsverfall',
          text: last ? 'Kurs wird oft zum „Max-Pain“-Preis gezogen, danach Ausbrüche möglich.' : 'Meist geringe Wirkung.',
        })
      }
    }
    var seen = {}
    ev = ev.filter(function (e) {
      if (e.t < range.start || e.t >= range.end) return false
      var k = e.t + e.title
      if (seen[k]) return false
      seen[k] = 1
      return true
    })
    ev.sort(function (a, b) { return a.t - b.t })
    return ev
  }
  function upcomingMacro(from, days) {
    return macroEvents(from, from + days * D)
  }

  /* ---------- Daten ---------- */
  function load(force) {
    var A = api()
    if (!A) { setTimeout(function () { load(force) }, 300); return }
    var coin = st.coin, sym = coin + 'USDT'
    st.loading = true; render()
    var J = A.fetchJson
    var B = 'https://api.bybit.com/v5/market/'
    var tf7 = A.TFS.filter(function (t) { return t.key === '7d' })[0]
    var cols = Math.round(tf7.ms / A.IV_MS[tf7.iv])
    var jobs = {
      ticker: J(B + 'tickers?category=linear&symbol=' + sym),
      oi: J(B + 'open-interest?category=linear&symbol=' + sym + '&intervalTime=1h&limit=25'),
      ratio: J(B + 'account-ratio?category=linear&symbol=' + sym + '&period=1h&limit=1'),
      daily: A.fetchCandles('bybit', coin, '1d', 60),
      bnFund: J('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=' + sym),
    }
    A.EXCHANGES.forEach(function (e) { jobs['lv_' + e.key] = A.fetchCandles(e.key, coin, tf7.iv, cols * 2) })
    var keys = Object.keys(jobs)
    Promise.all(keys.map(function (k) { return jobs[k].then(function (v) { return v }, function () { return null }) })).then(function (vals) {
      if (coin !== st.coin) return
      var r = {}
      keys.forEach(function (k, i) { r[k] = vals[i] })
      st.data = analyse(r, tf7)
      st.loading = false; st.at = new Date()
      render()
    })
  }

  function analyse(r, tf7) {
    var A = api(), o = { ok: false }
    var tk = r.ticker && r.ticker.result && r.ticker.result.list && r.ticker.result.list[0]
    var daily = r.daily
    if (!tk && !(daily && daily.length)) return o
    o.ok = true
    o.price = tk ? +tk.lastPrice : daily[daily.length - 1].c
    o.ch24 = tk ? +tk.price24hPcnt * 100 : null
    o.hi24 = tk ? +tk.highPrice24h : null
    o.lo24 = tk ? +tk.lowPrice24h : null
    var fr = []
    if (tk && tk.fundingRate !== '') fr.push(+tk.fundingRate)
    if (r.bnFund && r.bnFund.lastFundingRate != null) fr.push(+r.bnFund.lastFundingRate)
    o.funding = fr.length ? fr.reduce(function (a, b) { return a + b }, 0) / fr.length * 100 : null // % je 8 h
    // Open Interest 24 h
    var oiL = r.oi && r.oi.result && r.oi.result.list
    if (oiL && oiL.length >= 25) o.oiCh = (+oiL[0].openInterest / +oiL[24].openInterest - 1) * 100
    var rl = r.ratio && r.ratio.result && r.ratio.result.list && r.ratio.result.list[0]
    if (rl) o.longShare = +rl.buyRatio * 100
    // Tageskerzen
    if (daily && daily.length > 20) {
      var trs = []
      for (var i = 1; i < daily.length; i++) {
        var k = daily[i], pc = daily[i - 1].c
        trs.push(Math.max(k.h - k.l, Math.abs(k.h - pc), Math.abs(k.l - pc)) / pc * 100)
      }
      var last14 = trs.slice(-15, -1)
      o.atr = last14.reduce(function (a, b) { return a + b }, 0) / last14.length
      var sorted = trs.slice(0, -1).slice().sort(function (a, b) { return a - b })
      o.atrMed = sorted[Math.floor(sorted.length / 2)]
      var prev = daily[daily.length - 2]
      o.prevHi = prev.h; o.prevLo = prev.l
      // Wochen-Eröffnung (Montag 00:00 UTC)
      for (var j = daily.length - 1; j >= 0; j--) {
        if (new Date(daily[j].t).getUTCDay() === 1) { o.weekOpen = daily[j].o; break }
      }
      var closes = daily.map(function (x) { return x.c })
      var sma = function (n) { var s = closes.slice(-n); return s.reduce(function (a, b) { return a + b }, 0) / s.length }
      o.sma20 = sma(20); o.sma50 = closes.length >= 50 ? sma(50) : null
      o.ch7 = (closes[closes.length - 1] / closes[closes.length - 8] - 1) * 100
      var vols = daily.map(function (x) { return x.qv })
      var v20 = vols.slice(-21, -1).reduce(function (a, b) { return a + b }, 0) / 20
      o.volRatio = v20 ? vols[vols.length - 2] / v20 : null
    }
    // Liquidations-Cluster (7 Tage, alle Börsen)
    var act = []
    A.EXCHANGES.forEach(function (e) {
      var c = r['lv_' + e.key]
      if (c && c.length) act = act.concat(A.activeLevels(A.buildLevels(c, tf7)))
    })
    if (act.length && o.price) {
      var P = o.price, step = 0.005, range = 0.12, nb = Math.round(range / step)
      var up = new Float64Array(nb), dn = new Float64Array(nb)
      act.forEach(function (a) {
        var dpos = (a.p / P - 1)
        if (dpos > 0 && dpos < range) up[Math.floor(dpos / step)] += a.a
        if (dpos < 0 && -dpos < range) dn[Math.floor(-dpos / step)] += a.a
      })
      function top(arr, sign) {
        // 3 Nachbar-Bins zusammenfassen, stärkste Zone + nächstgelegene starke Zone
        var sm = [], max = 0, best = -1
        for (var i = 0; i < arr.length; i++) {
          var v = (arr[i - 1] || 0) + arr[i] + (arr[i + 1] || 0)
          sm.push(v)
          if (v > max) { max = v; best = i }
        }
        if (best < 0) return null
        var near = best
        for (var j = 0; j < sm.length; j++) { if (sm[j] >= max * 0.6) { near = j; break } }
        function mk(i) { var d = (i + 0.5) * step; return { p: P * (1 + sign * d), dist: sign * d * 100, amt: sm[i] } }
        return { strongest: mk(best), nearest: near !== best ? mk(near) : null }
      }
      o.clUp = top(up, 1); o.clDn = top(dn, -1)
      var s2 = 0, l2 = 0
      for (var q = 0; q < 4; q++) { s2 += up[q]; l2 += dn[q] }
      o.short2 = s2; o.long2 = l2
    }
    return o
  }

  /* ---------- Bewertung ---------- */
  function assess(o, ev, isWeekend) {
    var score = 20, notes = [], todo = []
    var macro = ev.filter(function (e) { return e.kind === 'macro' })
    var maxW = 0
    macro.forEach(function (m) { maxW = Math.max(maxW, m.weight) })
    if (maxW >= 3) score += 30; else if (maxW === 2) score += 20; else if (maxW === 1) score += 8
    macro.forEach(function (m) {
      if (m.weight >= 2) todo.push('<b>' + esc(m.title) + ' um ' + hm(m.t) + ' Uhr:</b> 15–30 Min. vorher keine neuen Positionen, Stopps nicht zu eng, Hebel reduzieren.')
      else todo.push('<b>' + esc(m.title) + ' um ' + hm(m.t) + ' Uhr</b> im Blick behalten.')
    })
    var opt = ev.filter(function (e) { return e.kind === 'options' && e.weight >= 2 })[0]
    if (opt) { score += 8; todo.push('<b>' + esc(opt.title) + ' um ' + hm(opt.t) + ' Uhr:</b> vorher oft „festgenagelter“ Kurs, danach Ausbruch möglich.') }
    if (o.atr && o.atrMed) {
      var vr = o.atr / o.atrMed
      if (vr > 1.4) { score += 15; notes.push('Volatilität deutlich erhöht (' + nf1.format(vr) + '× normal).') }
      else if (vr > 1.15) { score += 8; notes.push('Volatilität leicht erhöht.') }
      else if (vr < 0.75) { notes.push('Ungewöhnlich ruhiger Markt — ruhige Phasen enden oft mit einem starken Ausbruch.') ; todo.push('Ruhiger Markt: Auf einen <b>Ausbruch aus der Tagesspanne</b> vorbereitet sein, nicht vorwegnehmen.') }
    }
    if (o.funding != null) {
      var f = o.funding
      if (f > 0.05) { score += 15; todo.push('<b>Funding stark positiv (' + nf3.format(f) + ' %):</b> viele Longs mit Hebel — Risiko eines Long-Squeeze nach unten.') }
      else if (f > 0.02) { score += 6; notes.push('Funding positiv — Longs leicht in der Überzahl.') }
      else if (f < -0.03) { score += 15; todo.push('<b>Funding negativ (' + nf3.format(f) + ' %):</b> Shorts überwiegen — Short-Squeeze nach oben möglich.') }
      else if (f < 0) { score += 4; notes.push('Funding leicht negativ — Shorts leicht in der Überzahl.') }
    }
    if (o.oiCh != null) {
      if (o.oiCh > 6) { score += 10; todo.push('<b>Open Interest +' + nf1.format(o.oiCh) + ' % in 24 h:</b> es wird mehr Hebel aufgebaut — Liquidations-Kaskaden werden wahrscheinlicher.') }
      else if (o.oiCh < -6) { score += 4; notes.push('Open Interest −' + nf1.format(Math.abs(o.oiCh)) + ' % in 24 h — Hebel wurde abgebaut, Markt „bereinigt“.') }
    }
    if (o.clDn && o.clDn.nearest && Math.abs(o.clDn.nearest.dist) < 2) score += 6
    if (o.clUp && o.clUp.nearest && Math.abs(o.clUp.nearest.dist) < 2) score += 6
    if (o.clDn) {
      var c = o.clDn.nearest || o.clDn.strongest
      todo.push('<b>Long-Liquidationen bei ≈ ' + api().fmtPrice(c.p, o.price) + ' (' + pct(c.dist) + '):</b> Bruch darunter kann einen schnellen Abverkauf auslösen.')
    }
    if (o.clUp) {
      var c2 = o.clUp.nearest || o.clUp.strongest
      todo.push('<b>Short-Liquidationen bei ≈ ' + api().fmtPrice(c2.p, o.price) + ' (' + pct(c2.dist) + '):</b> Ausbruch darüber kann einen Short-Squeeze auslösen.')
    }
    if (isWeekend) { score += 5; notes.push('Wochenende: dünnere Liquidität, Ausreißer und Fehlausbrüche häufiger.') }
    if (o.sma20) {
      if (o.price > o.sma20 && (!o.sma50 || o.sma20 > o.sma50)) notes.push('Trend: über dem 20-Tage-Schnitt — übergeordnet aufwärts.')
      else if (o.price < o.sma20 && (!o.sma50 || o.sma20 < o.sma50)) notes.push('Trend: unter dem 20-Tage-Schnitt — übergeordnet abwärts.')
      else notes.push('Trend: uneinheitlich um den 20-Tage-Schnitt — Seitwärtsphase wahrscheinlich.')
    }
    score = Math.max(0, Math.min(100, Math.round(score)))
    var level = score < 30 ? { k: 'calm', l: 'Ruhig', c: '#4ade80' } : score < 50 ? { k: 'normal', l: 'Normal', c: '#22d3ee' } : score < 70 ? { k: 'elev', l: 'Erhöht', c: '#fb923c' } : { k: 'high', l: 'Hoch', c: '#f87171' }
    var head
    if (maxW >= 3) head = 'Großer Termin-Tag — ' + macro.filter(function (m) { return m.weight >= 3 })[0].title + ' bestimmt das Bild.'
    else if (level.k === 'high') head = 'Unruhiger Tag erwartet — kleinere Positionen, weitere Stopps.'
    else if (level.k === 'elev') head = 'Erhöhte Schwankungen möglich — Hebel bewusst wählen.'
    else if (level.k === 'calm') head = 'Ruhiger Tag erwartet — Bewegungen eher innerhalb der Spanne.'
    else head = 'Normaler Handelstag — die markierten Zonen sind die Entscheidungspunkte.'
    return { score: score, level: level, head: head, notes: notes, todo: todo.slice(0, 7) }
  }

  /* ---------- Darstellung ---------- */
  var CSS =
    '.lrd-score{display:flex;align-items:center;gap:14px;padding:14px}' +
    '.lrd-ring{width:64px;height:64px;flex:0 0 64px}' +
    '.lrd-head{font-weight:700;font-size:16px;line-height:1.35}' +
    '.lrd-lvl{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-top:4px}' +
    '.lrd-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0;border-top:1px solid var(--hairline)}' +
    '@media(min-width:700px){.lrd-grid{grid-template-columns:repeat(4,1fr)}}' +
    '.lrd-kpi{padding:10px 14px;border-bottom:1px solid var(--hairline);border-right:1px solid var(--hairline)}' +
    '.lrd-kpi small{display:block;font-size:11px;color:var(--text-muted)}' +
    '.lrd-kpi b{display:block;margin-top:3px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:14px}' +
    '.lrd-kpi span{display:block;margin-top:2px;font-size:11px;color:var(--text-muted)}' +
    '.pos{color:#4ade80}.neg{color:#f87171}' +
    '.lrd-list{list-style:none;margin:0;padding:6px 14px 12px}' +
    '.lrd-list li{display:flex;gap:10px;padding:8px 0;border-bottom:1px dashed var(--hairline);font-size:13.5px;line-height:1.45}' +
    '.lrd-list li:last-child{border-bottom:0}' +
    '.lrd-t{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12.5px;min-width:46px;color:var(--live);padding-top:1px}' +
    '.lrd-list li.past{opacity:.45}' +
    '.lrd-list li .tx small{display:block;color:var(--text-muted);font-size:12px}' +
    '.lrd-tag{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;font-size:10px;font-family:"JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em;vertical-align:1px}' +
    '.lrd-tag.hi{background:rgba(248,113,113,.15);color:#f87171}.lrd-tag.md{background:rgba(251,146,60,.15);color:#fb923c}' +
    '.lrd-zones{padding:6px 14px 12px}' +
    '.lrd-z{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed var(--hairline);font-size:13px}' +
    '.lrd-z:last-child{border-bottom:0}.lrd-z .p{font-family:"JetBrains Mono",ui-monospace,monospace;min-width:92px;font-weight:600}' +
    '.lrd-z .d{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11.5px;min-width:62px;text-align:right}' +
    '.lrd-z .l{flex:1;color:var(--text-muted)}.lrd-z.now{background:rgba(249,115,22,.08);border-radius:4px;padding-left:6px}' +
    '.lrd-z .dot{width:8px;height:8px;border-radius:50%;flex:0 0 8px}' +
    '.lrd-todo{margin:0;padding:6px 14px 14px 32px}.lrd-todo li{padding:6px 0;font-size:13.5px;line-height:1.5}' +
    '.lrd-notes{padding:0 14px 12px;font-size:12.5px;color:var(--text-muted);line-height:1.5}'

  var root = null, timer = null
  function card(title, body, extraHead) {
    return '<section class="lrh-card lrh-span"><div class="lrh-card-h"><div class="lrh-title">' + title + '</div>' + (extraHead || '') + '</div>' + body + '</section>'
  }

  function ring(score, color) {
    var r = 26, c = 2 * Math.PI * r, f = score / 100 * c
    return '<svg class="lrd-ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="' + r + '" fill="none" stroke="var(--hairline)" stroke-width="6"/>' +
      '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + f.toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 32 32)"/>' +
      '<text x="32" y="37" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="16" font-weight="700" fill="' + color + '">' + score + '</text></svg>'
  }

  function render() {
    if (root && (!root.isConnected || root.id !== 'lr-daily-root')) root = null
    if (!root) return
    var A = api()
    var range = dayRange(st.day)
    var dt = range.date
    var dateStr = dt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    var wd = dt.getDay(), isWeekend = wd === 0 || wd === 6
    var ev = eventsFor(range)
    var o = st.data
    var now = Date.now()

    var html = '<div class="lrh">'
    html += '<header class="lrh-head"><div class="lrh-head-in"><span class="lrh-logo">LIQ<b>RADAR</b><small>TAGESPLAN</small></span>' +
      '<select class="lrh-sel" id="lrd-coin" aria-label="Coin auswählen">' + (A ? A.COINS : ['BTC']).map(function (c) { return '<option' + (c === st.coin ? ' selected' : '') + '>' + c + '</option>' }).join('') + '</select>' +
      '<div class="lrh-seg" id="lrd-day"><button type="button" data-d="0" class="' + (st.day === 0 ? 'on' : '') + '">Heute</button><button type="button" data-d="1" class="' + (st.day === 1 ? 'on' : '') + '">Morgen</button></div>' +
      '<span class="lrh-upd">' + (st.loading ? 'LÄDT …' : st.at ? 'STAND ' + hm(st.at) : '') + '</span></div></header>'
    html += '<main class="lrh-main">'

    if (!o || !o.ok) {
      html += card(esc(dateStr), '<div class="lrd-notes" style="padding-top:12px">' + (st.loading || !o ? 'Lade Live-Daten …' : 'Live-Daten gerade nicht erreichbar. Termine siehe unten.') + '</div>')
    }
    var as = o && o.ok ? assess(o, ev, isWeekend) : null
    if (as) {
      html += card(esc(dateStr) + (st.day === 1 ? ' · Vorschau' : ''),
        '<div class="lrd-score">' + ring(as.score, as.level.c) + '<div><div class="lrd-head">' + esc(as.head) + '</div>' +
        '<div class="lrd-lvl" style="color:' + as.level.c + '">Risiko-Lage: ' + as.level.l + ' · ' + as.score + '/100</div></div></div>' +
        (as.notes.length ? '<div class="lrd-notes">' + as.notes.map(esc).join(' ') + '</div>' : '') + kpis(o))

      html += card('Worauf ich ' + (st.day === 1 ? 'morgen' : 'heute') + ' achte', '<ol class="lrd-todo">' + as.todo.map(function (t) { return '<li>' + t + '</li>' }).join('') +
        '<li>Positionsgröße so wählen, dass ein Stopp-Treffer höchstens 1–2 % des Kontos kostet.</li></ol>')

      html += card('Wichtige Zonen · ' + st.coin, zones(o), '<div class="lrh-sub">Liquidations-Cluster (7 Tage, alle Börsen), Vortag, Wochenöffnung und erwartete Tagesspanne.</div>')
    }

    // Zeitplan
    var items = ev.map(function (e) {
      var tag = e.kind === 'macro' ? (e.weight >= 3 ? '<span class="lrd-tag hi">HOCH</span>' : e.weight === 2 ? '<span class="lrd-tag md">MITTEL</span>' : '') :
        e.kind === 'options' && e.weight >= 2 ? '<span class="lrd-tag md">MITTEL</span>' : ''
      return '<li class="' + (st.day === 0 && e.t < now ? 'past' : '') + '"><span class="lrd-t">' + hm(e.t) + '</span><span class="tx">' + esc(e.title) + tag + '<small>' + esc(e.text) + '</small></span></li>'
    })
    if (isWeekend) items.unshift('<li><span class="lrd-t">—</span><span class="tx">Wochenende<small>Aktienmärkte geschlossen, Krypto handelt mit dünnerer Liquidität.</small></span></li>')
    html += card('Zeitplan · ' + dt.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }), '<ul class="lrd-list">' + items.join('') + '</ul>',
      '<div class="lrh-sub">Alle Zeiten in deiner Ortszeit.</div>')

    // nächste Termine
    var next = upcomingMacro(range.end, 14)
    var nextHtml = next.length ? next.map(function (e) {
      var d = new Date(e.t)
      return '<li><span class="lrd-t">' + d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + '</span><span class="tx">' + esc(e.title) + (e.weight >= 3 ? '<span class="lrd-tag hi">HOCH</span>' : e.weight === 2 ? '<span class="lrd-tag md">MITTEL</span>' : '') + '<small>' + hm(e.t) + ' Uhr · ' + esc(e.text) + '</small></span></li>'
    }).join('') : '<li><span class="tx">Keine großen US-Termine in den nächsten 14 Tagen.</span></li>'
    html += card('Nächste große Termine', '<ul class="lrd-list">' + nextHtml + '</ul>')

    html += '<div class="lrh-note lrh-span">Regelbasierte Einschätzung aus Live-Daten von Bybit, Binance und Hyperliquid sowie den offiziellen Terminkalendern von Fed und US-Arbeitsstatistikbehörde (bis ' + MACRO_LAST.split('-').reverse().join('.') + '). ' +
      'Liquidations-Zonen sind Schätzungen. Keine Prognose, keine Anlageberatung.</div>'
    html += '</main></div>'
    root.innerHTML = html

    var sel = root.querySelector('#lrd-coin')
    if (sel) sel.addEventListener('change', function () { st.coin = sel.value; st.data = null; save(); load(true) })
    Array.prototype.forEach.call(root.querySelectorAll('#lrd-day button'), function (b) {
      b.addEventListener('click', function () { st.day = +b.getAttribute('data-d'); render() })
    })
  }

  function kpis(o) {
    var A = api(), P = o.price
    function k(label, val, sub, cls) { return '<div class="lrd-kpi"><small>' + label + '</small><b class="' + (cls || '') + '">' + val + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>' }
    var out = '<div class="lrd-grid">'
    out += k('Kurs ' + st.coin, A.fmtPrice(P, P) + ' $', o.ch24 != null ? '24 h: <span class="' + (o.ch24 >= 0 ? 'pos' : 'neg') + '" style="display:inline">' + pct(o.ch24, 2) + '</span>' : '')
    if (o.atr) out += k('Erwartete Tagesspanne', '± ' + nf1.format(o.atr / 2) + ' %', A.fmtPrice(P * (1 - o.atr / 200), P) + ' – ' + A.fmtPrice(P * (1 + o.atr / 200), P))
    if (o.funding != null) out += k('Funding (Ø 8 h)', (o.funding >= 0 ? '+' : '') + nf3.format(o.funding) + ' %', o.funding > 0.02 ? 'Longs zahlen' : o.funding < 0 ? 'Shorts zahlen' : 'ausgeglichen', o.funding > 0.05 || o.funding < -0.03 ? 'neg' : '')
    if (o.oiCh != null) out += k('Open Interest 24 h', pct(o.oiCh), o.oiCh > 3 ? 'Hebel wird aufgebaut' : o.oiCh < -3 ? 'Hebel wird abgebaut' : 'stabil', o.oiCh > 6 ? 'neg' : '')
    if (o.longShare != null) out += k('Long-Anteil (Bybit)', nf1.format(o.longShare) + ' %', o.longShare > 60 ? 'Crowd stark Long' : o.longShare < 40 ? 'Crowd stark Short' : 'ausgeglichen')
    if (o.ch7 != null) out += k('7 Tage', pct(o.ch7), o.sma20 ? (P > o.sma20 ? 'über' : 'unter') + ' 20-Tage-Schnitt' : '', o.ch7 >= 0 ? 'pos' : 'neg')
    if (o.long2 != null) out += k('Long-Liq. bis −2 %', A.fmtUsd(o.long2), 'geschätzt')
    if (o.short2 != null) out += k('Short-Liq. bis +2 %', A.fmtUsd(o.short2), 'geschätzt')
    return out + '</div>'
  }

  function zones(o) {
    var A = api(), P = o.price, z = []
    function add(p, label, color, extra) { if (p && isFinite(p) && Math.abs(p / P - 1) < 0.15) z.push({ p: p, label: label, color: color, extra: extra || '' }) }
    if (o.clUp) {
      add(o.clUp.strongest.p, 'Größter Short-Cluster', '#f87171', A.fmtUsd(o.clUp.strongest.amt))
      if (o.clUp.nearest) add(o.clUp.nearest.p, 'Nächster Short-Cluster', '#fca5a5', A.fmtUsd(o.clUp.nearest.amt))
    }
    if (o.clDn) {
      add(o.clDn.strongest.p, 'Größter Long-Cluster', '#4ade80', A.fmtUsd(o.clDn.strongest.amt))
      if (o.clDn.nearest) add(o.clDn.nearest.p, 'Nächster Long-Cluster', '#86efac', A.fmtUsd(o.clDn.nearest.amt))
    }
    add(o.prevHi, 'Vortageshoch', '#94a3b8')
    add(o.prevLo, 'Vortagestief', '#94a3b8')
    add(o.weekOpen, 'Wochen-Eröffnung', '#a78bfa')
    if (o.atr) {
      add(P * (1 + o.atr / 200), 'Obere erwartete Tagesspanne', '#64748b')
      add(P * (1 - o.atr / 200), 'Untere erwartete Tagesspanne', '#64748b')
    }
    z.push({ p: P, label: 'Aktueller Kurs', color: '#f97316', now: true })
    z.sort(function (a, b) { return b.p - a.p })
    return '<div class="lrd-zones">' + z.map(function (x) {
      var d = (x.p / P - 1) * 100
      return '<div class="lrd-z' + (x.now ? ' now' : '') + '"><span class="dot" style="background:' + x.color + '"></span><span class="p">' + A.fmtPrice(x.p, P) + '</span>' +
        '<span class="l">' + esc(x.label) + (x.extra ? ' · ' + x.extra : '') + '</span><span class="d ' + (x.now ? '' : d >= 0 ? 'pos' : 'neg') + '">' + (x.now ? 'jetzt' : pct(d)) + '</span></div>'
    }).join('') + '</div>'
  }

  function mount(el) {
    var A = api()
    if (A) A.ensureStyle()
    if (!document.getElementById('lrd-style')) {
      var s = document.createElement('style'); s.id = 'lrd-style'; s.textContent = CSS; document.head.appendChild(s)
    }
    root = el
    render()
    load(false)
    clearInterval(timer)
    timer = setInterval(function () {
      if (!root || !root.isConnected || root.id !== 'lr-daily-root') { clearInterval(timer); root = null; return }
      if (document.visibilityState === 'visible') load(false)
    }, 120e3)
  }
  function scan() {
    var el = document.getElementById('lr-daily-root')
    if (el && !el.getAttribute('data-lrd')) { el.setAttribute('data-lrd', '1'); mount(el) }
  }
  function start() { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()

  window.__lrDaily = { eventsFor: eventsFor, dayRange: dayRange, zoned: zoned, st: st }
})()
